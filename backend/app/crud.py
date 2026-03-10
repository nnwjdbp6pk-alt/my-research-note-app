from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas

EXPORT_COLUMNS = [
    "project_name",
    "project_type",
    "project_status",
    "expected_end_date",
    "experiment_name",
    "author",
    "purpose",
    "experiment_conditions",
    "experiment_date",
    "requester",
    "received_date",
    "materials_json",
    "result_values_json",
]


def _result_schema_map(db: Session, project_id: int) -> dict[str, models.ResultSchema]:
    stmt = select(models.ResultSchema).where(models.ResultSchema.project_id == int(project_id))
    return {s.key: s for s in db.scalars(stmt).all()}


def _normalize_ingredient_name(name: str) -> str:
    return " ".join((name or "").strip().lower().split())


def _sync_ingredients_from_materials(
    db: Session,
    materials: list[dict[str, Any]] | list[schemas.MaterialLine],
    stats: dict[str, int] | None = None,
) -> None:
    now = datetime.utcnow()
    seen: set[str] = set()

    for row in materials or []:
        raw_name = getattr(row, "name", None) if not isinstance(row, dict) else row.get("name")
        name = (raw_name or "").strip()
        if not name:
            continue

        normalized = _normalize_ingredient_name(name)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)

        stmt = select(models.Ingredient).where(models.Ingredient.normalized_name == normalized)
        existing = db.scalars(stmt).first()

        if existing:
            existing.name = name
            existing.last_used_at = now
            existing.use_count += 1
            if stats is not None:
                stats["ingredients_updated"] = stats.get("ingredients_updated", 0) + 1
        else:
            db.add(
                models.Ingredient(
                    name=name,
                    normalized_name=normalized,
                    use_count=1,
                    created_at=now,
                    last_used_at=now,
                )
            )
            if stats is not None:
                stats["ingredients_created"] = stats.get("ingredients_created", 0) + 1


def validate_result_values(db: Session, project_id: int, values: dict[str, object]) -> None:
    schema_map = _result_schema_map(db, project_id)
    for key, val in values.items():
        schema = schema_map.get(key)
        if schema is None:
            continue

        if val is None or val == "":
            continue

        if schema.value_type == "quantitative":
            if isinstance(val, list):
                try:
                    for v in val:
                        float(v)
                except (ValueError, TypeError):
                    raise ValueError(f"'{schema.label}' 항목의 배열 값 중 숫자가 아닌 값이 포함되어 있습니다.")
            else:
                try:
                    values[key] = float(val)
                except (ValueError, TypeError):
                    raise ValueError(f"'{schema.label}' 항목은 숫자여야 합니다. (입력값: {val})")

        elif schema.value_type == "categorical":
            if not isinstance(val, str):
                raise ValueError(f"'{schema.label}' 항목은 문자열이어야 합니다.")
            if schema.options and val not in schema.options:
                raise ValueError(f"'{schema.label}' 항목은 다음 중 하나여야 합니다: {schema.options} (입력값: {val})")

        else:
            if not isinstance(val, str):
                raise ValueError(f"'{schema.label}' 항목은 텍스트여야 합니다.")


# --- Project CRUD ---

def create_project(db: Session, data: schemas.ProjectCreate) -> models.Project:
    obj = models.Project(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_projects(db: Session) -> list[models.Project]:
    return list(db.scalars(select(models.Project).order_by(models.Project.created_at.desc())).all())


def get_project(db: Session, project_id: int) -> models.Project | None:
    return db.get(models.Project, project_id)


def get_project_by_name(db: Session, name: str) -> models.Project | None:
    stmt = select(models.Project).where(models.Project.name == name)
    return db.scalars(stmt).first()


def update_project(db: Session, project_id: int, data: schemas.ProjectUpdate | dict) -> models.Project | None:
    obj = get_project(db, project_id)
    if not obj:
        return None

    patch = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data
    for k, v in patch.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


def delete_project(db: Session, project_id: int) -> bool:
    obj = get_project(db, project_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# --- Experiment CRUD ---

def create_experiment(
    db: Session,
    data: schemas.ExperimentCreate,
    ingredient_stats: dict[str, int] | None = None,
) -> models.Experiment:
    payload = data.model_dump()
    payload["author"] = (payload.get("author") or "-").strip() or "-"
    payload["purpose"] = (payload.get("purpose") or "-").strip() or "-"
    payload["experiment_conditions"] = (payload.get("experiment_conditions") or "").strip() or None
    payload["requester"] = (payload.get("requester") or "").strip() or None

    validate_result_values(db, data.project_id, payload.get("result_values", {}))

    obj = models.Experiment(**payload)
    db.add(obj)
    _sync_ingredients_from_materials(db, payload.get("materials", []), ingredient_stats)

    try:
        db.commit()
        db.refresh(obj)
    except Exception as e:
        db.rollback()
        raise e
    return obj


def list_experiments(db: Session, project_id: int) -> list[models.Experiment]:
    stmt = (
        select(models.Experiment)
        .where(models.Experiment.project_id == int(project_id))
        .order_by(models.Experiment.created_at.desc())
    )
    return list(db.scalars(stmt).all())


def get_experiment(db: Session, experiment_id: int) -> models.Experiment | None:
    return db.get(models.Experiment, experiment_id)


def get_experiment_by_project_and_name(db: Session, project_id: int, name: str) -> models.Experiment | None:
    stmt = (
        select(models.Experiment)
        .where(models.Experiment.project_id == int(project_id), models.Experiment.name == name)
        .order_by(models.Experiment.created_at.desc())
    )
    return db.scalars(stmt).first()


def update_experiment(
    db: Session,
    experiment_id: int,
    data: schemas.ExperimentUpdate | dict,
    ingredient_stats: dict[str, int] | None = None,
) -> models.Experiment | None:
    obj = db.get(models.Experiment, experiment_id)
    if not obj:
        return None

    patch = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data
    allowed_fields = {
        "name",
        "author",
        "purpose",
        "experiment_conditions",
        "experiment_date",
        "requester",
        "received_date",
        "materials",
        "result_values",
    }

    for k, v in patch.items():
        if k not in allowed_fields:
            continue

        if k in {"author", "purpose"} and isinstance(v, str):
            v = v.strip() or "-"

        if k == "experiment_conditions" and isinstance(v, str):
            v = v.strip() or None

        if k == "requester" and isinstance(v, str):
            v = v.strip() or None

        if k == "result_values" and v is not None:
            validate_result_values(db, obj.project_id, v)

        if k == "materials" and v is not None:
            _sync_ingredients_from_materials(db, v, ingredient_stats)

        setattr(obj, k, v)

    try:
        db.commit()
        db.refresh(obj)
    except Exception as e:
        db.rollback()
        raise e
    return obj


def delete_experiment(db: Session, experiment_id: int) -> bool:
    obj = get_experiment(db, experiment_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# --- Result Schema CRUD ---

def create_result_schema(db: Session, data: schemas.ResultSchemaCreate) -> models.ResultSchema:
    obj = models.ResultSchema(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_result_schemas(db: Session, project_id: int) -> list[models.ResultSchema]:
    stmt = (
        select(models.ResultSchema)
        .where(models.ResultSchema.project_id == int(project_id))
        .order_by(models.ResultSchema.id.asc())
    )
    return list(db.scalars(stmt).all())


def update_result_schema(db: Session, schema_id: int, data: schemas.ResultSchemaUpdate | dict) -> models.ResultSchema | None:
    obj = db.get(models.ResultSchema, schema_id)
    if not obj:
        return None

    patch = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data
    for k, v in patch.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


def delete_result_schema(db: Session, schema_id: int) -> bool:
    obj = db.get(models.ResultSchema, schema_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


# --- Output Config CRUD ---

def upsert_output_config(db: Session, data: schemas.OutputConfigUpsert) -> models.OutputConfig:
    valid_schemas = _result_schema_map(db, data.project_id)
    valid_keys = set(valid_schemas.keys())
    filtered_keys = [k for k in data.included_keys if k in valid_keys]
    data.included_keys = filtered_keys

    stmt = select(models.OutputConfig).where(models.OutputConfig.project_id == int(data.project_id))
    existing = db.scalars(stmt).first()

    if existing:
        existing.included_keys = data.included_keys
        db.commit()
        db.refresh(existing)
        return existing

    obj = models.OutputConfig(project_id=data.project_id, included_keys=data.included_keys)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_output_config(db: Session, project_id: int) -> models.OutputConfig | None:
    stmt = select(models.OutputConfig).where(models.OutputConfig.project_id == int(project_id))
    return db.scalars(stmt).first()


# --- Ingredient lookup ---

def list_ingredients(db: Session, q: str | None = None, limit: int = 50) -> list[models.Ingredient]:
    stmt = select(models.Ingredient)
    if q:
        token = f"%{q.strip().lower()}%"
        stmt = stmt.where(models.Ingredient.normalized_name.like(token))

    stmt = stmt.order_by(models.Ingredient.use_count.desc(), models.Ingredient.name.asc()).limit(max(1, min(limit, 200)))
    return list(db.scalars(stmt).all())


# --- Import / Export ---

def _parse_iso_date(raw: Any) -> date | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    return date.fromisoformat(text)


def _parse_json_field(raw: Any, fallback: Any) -> Any:
    if raw is None:
        return fallback
    text = str(raw).strip()
    if not text:
        return fallback
    return json.loads(text)


def export_flat_rows(db: Session, project_id: int | None = None) -> list[dict[str, str]]:
    projects: list[models.Project]
    if project_id is None:
        projects = list_projects(db)
    else:
        p = get_project(db, project_id)
        projects = [p] if p else []

    rows: list[dict[str, str]] = []
    for project in projects:
        experiments = list_experiments(db, project.id)
        if not experiments:
            rows.append(
                {
                    "project_name": project.name,
                    "project_type": project.project_type,
                    "project_status": project.status,
                    "expected_end_date": project.expected_end_date.isoformat() if project.expected_end_date else "",
                    "experiment_name": "",
                    "author": "",
                    "purpose": "",
                    "experiment_conditions": "",
                    "experiment_date": "",
                    "requester": "",
                    "received_date": "",
                    "materials_json": "[]",
                    "result_values_json": "{}",
                }
            )
            continue

        for exp in experiments:
            rows.append(
                {
                    "project_name": project.name,
                    "project_type": project.project_type,
                    "project_status": project.status,
                    "expected_end_date": project.expected_end_date.isoformat() if project.expected_end_date else "",
                    "experiment_name": exp.name,
                    "author": exp.author,
                    "purpose": exp.purpose,
                    "experiment_conditions": exp.experiment_conditions or "",
                    "experiment_date": exp.experiment_date.isoformat() if exp.experiment_date else "",
                    "requester": exp.requester or "",
                    "received_date": exp.received_date.isoformat() if exp.received_date else "",
                    "materials_json": json.dumps(exp.materials or [], ensure_ascii=False),
                    "result_values_json": json.dumps(exp.result_values or {}, ensure_ascii=False),
                }
            )

    return rows


def import_flat_rows(db: Session, rows: list[dict[str, Any]]) -> schemas.DataImportSummary:
    stats: dict[str, int] = {
        "projects_created": 0,
        "projects_updated": 0,
        "experiments_created": 0,
        "experiments_updated": 0,
        "ingredients_created": 0,
        "ingredients_updated": 0,
        "skipped_rows": 0,
    }

    for row in rows:
        try:
            project_name = str(row.get("project_name", "")).strip()
            if not project_name:
                stats["skipped_rows"] += 1
                continue

            project_type = str(row.get("project_type") or "REGULAR").strip() or "REGULAR"
            if project_type not in {"VOC", "REGULAR", "PROPERTY_COMPARE"}:
                project_type = "REGULAR"

            project_status = str(row.get("project_status") or "ONGOING").strip() or "ONGOING"
            if project_status not in {"ONGOING", "CLOSED"}:
                project_status = "ONGOING"

            expected_end_date = _parse_iso_date(row.get("expected_end_date"))

            project = get_project_by_name(db, project_name)
            if not project:
                project = create_project(
                    db,
                    schemas.ProjectCreate(
                        name=project_name,
                        project_type=project_type,
                        status=project_status,
                        expected_end_date=expected_end_date,
                    ),
                )
                stats["projects_created"] += 1
            else:
                update_project(
                    db,
                    project.id,
                    {
                        "project_type": project_type,
                        "status": project_status,
                        "expected_end_date": expected_end_date,
                    },
                )
                stats["projects_updated"] += 1

            experiment_name = str(row.get("experiment_name", "")).strip()
            if not experiment_name:
                continue

            author = str(row.get("author") or "-")
            purpose = str(row.get("purpose") or "-")
            experiment_conditions = str(row.get("experiment_conditions") or "").strip() or None
            experiment_date = _parse_iso_date(row.get("experiment_date"))
            requester = str(row.get("requester") or "").strip() or None
            received_date = _parse_iso_date(row.get("received_date"))
            materials = _parse_json_field(row.get("materials_json"), [])
            result_values = _parse_json_field(row.get("result_values_json"), {})

            if not isinstance(materials, list):
                materials = []
            if not isinstance(result_values, dict):
                result_values = {}

            existing_exp = get_experiment_by_project_and_name(db, project.id, experiment_name)
            if existing_exp:
                update_experiment(
                    db,
                    existing_exp.id,
                    {
                        "author": author,
                        "purpose": purpose,
                        "experiment_conditions": experiment_conditions,
                        "experiment_date": experiment_date,
                        "requester": requester,
                        "received_date": received_date,
                        "materials": materials,
                        "result_values": result_values,
                    },
                    ingredient_stats=stats,
                )
                stats["experiments_updated"] += 1
            else:
                create_experiment(
                    db,
                    schemas.ExperimentCreate(
                        project_id=project.id,
                        name=experiment_name,
                        author=author,
                        purpose=purpose,
                        experiment_conditions=experiment_conditions,
                        experiment_date=experiment_date,
                        requester=requester,
                        received_date=received_date,
                        materials=materials,
                        result_values=result_values,
                    ),
                    ingredient_stats=stats,
                )
                stats["experiments_created"] += 1

        except Exception:
            db.rollback()
            stats["skipped_rows"] += 1

    return schemas.DataImportSummary(**stats)

