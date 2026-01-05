from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select
from . import models, schemas


def _result_schema_map(db: Session, project_id: int) -> dict[str, models.ResultSchema]:
    stmt = select(models.ResultSchema).where(models.ResultSchema.project_id == project_id)
    return {s.key: s for s in db.scalars(stmt).all()}


def validate_result_values(db: Session, project_id: int, values: dict[str, object]) -> None:
    schema_map = _result_schema_map(db, project_id)
    for key, val in values.items():
        schema = schema_map.get(key)
        if schema is None:
            raise ValueError(f"Unknown result field: {key}")
        if val is None:
            continue
        if schema.value_type == "quantitative":
            if not isinstance(val, (int, float)):
                raise ValueError(f"{key} must be numeric")
        elif schema.value_type == "categorical":
            if not isinstance(val, str):
                raise ValueError(f"{key} must be text and match options")
            if schema.options and val not in schema.options:
                raise ValueError(f"{key} must be one of {schema.options}")
        else:  # qualitative
            if not isinstance(val, str):
                raise ValueError(f"{key} must be text")

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

def update_project(db: Session, project_id: int, data: schemas.ProjectUpdate) -> models.Project | None:
    obj = get_project(db, project_id)
    if not obj:
        return None
    patch = data.model_dump(exclude_unset=True)
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

def create_experiment(db: Session, data: schemas.ExperimentCreate) -> models.Experiment:
    payload = data.model_dump()
    payload["materials"] = [m.model_dump() for m in data.materials]
    validate_result_values(db, data.project_id, payload.get("result_values", {}))
    obj = models.Experiment(**payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def list_experiments(db: Session, project_id: int) -> list[models.Experiment]:
    stmt = select(models.Experiment).where(models.Experiment.project_id == project_id).order_by(models.Experiment.created_at.desc())
    return list(db.scalars(stmt).all())

def get_experiment(db: Session, experiment_id: int) -> models.Experiment | None:
    return db.get(models.Experiment, experiment_id)

def update_experiment(db: Session, experiment_id: int, data: schemas.ExperimentUpdate) -> models.Experiment | None:
    obj = get_experiment(db, experiment_id)
    if not obj:
        return None
    patch = data.model_dump(exclude_unset=True)
    if "materials" in patch and patch["materials"] is not None:
        patch["materials"] = [m.model_dump() for m in patch["materials"]]
    if "result_values" in patch and patch["result_values"] is not None:
        validate_result_values(db, obj.project_id, patch["result_values"])
    for k, v in patch.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def delete_experiment(db: Session, experiment_id: int) -> bool:
    obj = get_experiment(db, experiment_id)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True

def create_result_schema(db: Session, data: schemas.ResultSchemaCreate) -> models.ResultSchema:
    obj = models.ResultSchema(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def list_result_schemas(db: Session, project_id: int) -> list[models.ResultSchema]:
    stmt = select(models.ResultSchema).where(models.ResultSchema.project_id == project_id).order_by(models.ResultSchema.created_at.asc())
    return list(db.scalars(stmt).all())

def update_result_schema(db: Session, schema_id: int, data: schemas.ResultSchemaUpdate) -> models.ResultSchema | None:
    obj = db.get(models.ResultSchema, schema_id)
    if not obj:
        return None
    patch = data.model_dump(exclude_unset=True)
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

def upsert_output_config(db: Session, data: schemas.OutputConfigUpsert) -> models.OutputConfig:
    stmt = select(models.OutputConfig).where(models.OutputConfig.project_id == data.project_id)
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
    stmt = select(models.OutputConfig).where(models.OutputConfig.project_id == project_id)
    return db.scalars(stmt).first()
