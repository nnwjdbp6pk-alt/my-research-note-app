from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select
from . import models, schemas


def _result_schema_map(db: Session, project_id: int) -> dict[str, models.ResultSchema]:
    """프로젝트별 결과 스키마를 딕셔너리 형태로 반환 (조회 최적화)"""
    # project_id를 명시적으로 int로 변환하여 바인딩 오류 방지
    stmt = select(models.ResultSchema).where(models.ResultSchema.project_id == int(project_id))
    return {s.key: s for s in db.scalars(stmt).all()}


def validate_result_values(db: Session, project_id: int, values: dict[str, object]) -> None:
    """
    실험 결과값이 프로젝트 정의(Schema)에 부합하는지 검증합니다.
    - 미정의 필드 체크
    - 데이터 타입(수치/문자/선택) 체크
    - 선택형(Categorical) 옵션 일치 여부 체크
    """
    schema_map = _result_schema_map(db, project_id)
    for key, val in values.items():
        schema = schema_map.get(key)
        if schema is None:
            # 정의되지 않은 필드는 무시하거나 에러 처리 (정책에 따라)
            continue 
        
        if val is None or val == "":
            continue
            
        if schema.value_type == "quantitative":
            # [수정] 리스트(배열)인 경우와 단일 값인 경우 모두 처리
            if isinstance(val, list):
                # 배열 내부의 모든 요소가 숫자인지 확인
                try:
                    # 모든 요소를 float로 변환 가능한지 체크 (실제 변환은 하지 않음, 저장 시 처리)
                    for v in val:
                        float(v)
                except (ValueError, TypeError):
                    raise ValueError(f"'{schema.label}' 항목의 배열 값 중 숫자가 아닌 것이 포함되어 있습니다.")
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
        
        else:  # qualitative
            if not isinstance(val, str):
                raise ValueError(f"'{schema.label}' 항목은 텍스트여야 합니다.")


# --- Project 관련 함수 ---

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


def update_project(db: Session, project_id: int, data: schemas.ProjectUpdate | dict) -> models.Project | None:
    obj = get_project(db, project_id)
    if not obj:
        return None
    
    if hasattr(data, "model_dump"):
        patch = data.model_dump(exclude_unset=True)
    else:
        patch = data

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


# --- Experiment 관련 함수 ---

def create_experiment(db: Session, data: schemas.ExperimentCreate) -> models.Experiment:
    """새 실험 기록 생성 (안전성 강화)"""
    # model_dump()는 이미 재귀적으로 dict 변환을 수행함
    payload = data.model_dump()
    
    # 결과값 유효성 검사 (DB 작업 전 수행)
    validate_result_values(db, data.project_id, payload.get("result_values", {}))
    
    obj = models.Experiment(**payload)
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
    except Exception as e:
        db.rollback()
        raise e
    return obj


def list_experiments(db: Session, project_id: int) -> list[models.Experiment]:
    stmt = select(models.Experiment).where(models.Experiment.project_id == int(project_id)).order_by(models.Experiment.created_at.desc())
    return list(db.scalars(stmt).all())


def get_experiment(db: Session, experiment_id: int) -> models.Experiment | None:
    return db.get(models.Experiment, experiment_id)


def update_experiment(db: Session, experiment_id: int, data: schemas.ExperimentUpdate | dict) -> models.Experiment | None:
    """실험 기록 수정 (필드 화이트리스트 및 트랜잭션 보호)"""
    obj = db.get(models.Experiment, experiment_id)
    if not obj:
        return None
    
    if hasattr(data, "model_dump"):
        patch = data.model_dump(exclude_unset=True)
    else:
        patch = data

    # 수정을 허용할 필드만 정의 (ID나 외래키 오염 방지)
    allowed_fields = {"name", "author", "purpose", "materials", "result_values"}

    for k, v in patch.items():
        if k not in allowed_fields:
            continue
            
        if k == "result_values" and v is not None:
            validate_result_values(db, obj.project_id, v)
            
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


# --- Result Schema 관련 함수 ---

def create_result_schema(db: Session, data: schemas.ResultSchemaCreate) -> models.ResultSchema:
    obj = models.ResultSchema(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_result_schemas(db: Session, project_id: int) -> list[models.ResultSchema]:
    # 에러 발생 지점: 정렬 순서를 보장하면서 명시적 형변환 적용
    stmt = select(models.ResultSchema).where(models.ResultSchema.project_id == int(project_id)).order_by(models.ResultSchema.id.asc())
    return list(db.scalars(stmt).all())


def update_result_schema(db: Session, schema_id: int, data: schemas.ResultSchemaUpdate | dict) -> models.ResultSchema | None:
    obj = db.get(models.ResultSchema, schema_id)
    if not obj:
        return None

    if hasattr(data, "model_dump"):
        patch = data.model_dump(exclude_unset=True)
    else:
        patch = data

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


# --- Output Configuration 관련 함수 ---

def upsert_output_config(db: Session, data: schemas.OutputConfigUpsert) -> models.OutputConfig:
    # [추가] 유효한 키인지 검증
    valid_schemas = _result_schema_map(db, data.project_id)
    valid_keys = set(valid_schemas.keys())
    
    # 입력된 키 중 유효한 것만 필터링 (혹은 에러 발생)
    filtered_keys = [k for k in data.included_keys if k in valid_keys]
    
    # 데이터 교체
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