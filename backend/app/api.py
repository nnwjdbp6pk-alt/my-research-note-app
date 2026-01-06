from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from . import schemas, crud

router = APIRouter(prefix="/api")

# --- 프로젝트 관련 API ---

@router.get("/projects", response_model=list[schemas.ProjectOut], summary="전체 프로젝트 목록 조회")
def list_projects(db: Session = Depends(get_db)):
    """등록된 모든 프로젝트의 목록을 최신순으로 가져옵니다."""
    return crud.list_projects(db)

@router.post("/projects", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED, summary="새 프로젝트 생성")
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """새로운 연구 프로젝트를 생성합니다."""
    return crud.create_project(db, payload)

@router.get("/projects/{project_id}", response_model=schemas.ProjectOut, summary="단일 프로젝트 상세 조회")
def get_project(project_id: int, db: Session = Depends(get_db)):
    """특정 ID를 가진 프로젝트의 상세 정보를 조회합니다."""
    obj = crud.get_project(db, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="해당 프로젝트를 찾을 수 없습니다.")
    return obj

@router.patch("/projects/{project_id}", response_model=schemas.ProjectOut, summary="프로젝트 정보 수정")
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    """프로젝트의 이름, 상태(진행/종료), 유형 등을 수정합니다."""
    obj = crud.update_project(db, project_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="수정할 프로젝트를 찾을 수 없습니다.")
    return obj

@router.delete("/projects/{project_id}", summary="프로젝트 삭제")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """프로젝트와 관련된 모든 데이터(실험, 스키마 등)를 삭제합니다."""
    ok = crud.delete_project(db, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="삭제할 프로젝트를 찾을 수 없습니다.")
    return {"ok": True, "message": "프로젝트가 성공적으로 삭제되었습니다."}


# --- 실험(Experiment) 관련 API ---

@router.get("/projects/{project_id}/experiments", response_model=list[schemas.ExperimentOut], summary="프로젝트별 실험 목록 조회")
def list_experiments(project_id: int, db: Session = Depends(get_db)):
    """특정 프로젝트에 속한 모든 실험 기록을 최신순으로 조회합니다."""
    return crud.list_experiments(db, project_id)

@router.post("/experiments", response_model=schemas.ExperimentOut, status_code=status.HTTP_201_CREATED, summary="실험 결과 기록")
def create_experiment(payload: schemas.ExperimentCreate, db: Session = Depends(get_db)):
    """새로운 실험 데이터를 기록합니다. 배합 정보와 결과값 검증이 포함됩니다."""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="유효하지 않은 프로젝트 ID입니다.")
    try:
        return crud.create_experiment(db, payload)
    except ValueError as exc:
        # crud.validate_result_values 등에서 발생한 검증 에러를 반환
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/experiments/{experiment_id}", response_model=schemas.ExperimentOut, summary="실험 상세 조회")
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """특정 실험의 원료 배합 및 결과값 상세 정보를 조회합니다."""
    obj = crud.get_experiment(db, experiment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="해당 실험 기록을 찾을 수 없습니다.")
    return obj

@router.patch("/experiments/{experiment_id}", response_model=schemas.ExperimentOut, summary="실험 기록 수정")
def update_experiment(experiment_id: int, payload: schemas.ExperimentUpdate, db: Session = Depends(get_db)):
    """기존 실험의 정보를 수정하거나 추가 결과를 입력합니다."""
    try:
        obj = crud.update_experiment(db, experiment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    
    if not obj:
        raise HTTPException(status_code=404, detail="수정할 실험 기록을 찾을 수 없습니다.")
    return obj

@router.delete("/experiments/{experiment_id}", summary="실험 기록 삭제")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """특정 실험 기록을 삭제합니다."""
    ok = crud.delete_experiment(db, experiment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="삭제할 실험 기록을 찾을 수 없습니다.")
    return {"ok": True}


# --- 결과 스키마(Result Schema) 관련 API ---

@router.get("/projects/{project_id}/result-schemas", response_model=list[schemas.ResultSchemaOut], summary="프로젝트별 측정 항목 조회")
def list_result_schemas(project_id: int, db: Session = Depends(get_db)):
    """프로젝트에서 정의한 결과 입력 항목(스키마) 목록을 가져옵니다."""
    return crud.list_result_schemas(db, project_id)

@router.post("/result-schemas", response_model=schemas.ResultSchemaOut, summary="측정 항목 정의 생성")
def create_result_schema(payload: schemas.ResultSchemaCreate, db: Session = Depends(get_db)):
    """실험 결과를 입력받을 새로운 항목(예: 점도, pH 등)을 정의합니다."""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="유효하지 않은 프로젝트 ID입니다.")
    
        
    return crud.create_result_schema(db, payload)

@router.patch("/result-schemas/{schema_id}", response_model=schemas.ResultSchemaOut, summary="측정 항목 정의 수정")
def update_result_schema(schema_id: int, payload: schemas.ResultSchemaUpdate, db: Session = Depends(get_db)):
    """기존에 정의된 측정 항목의 이름, 단위, 옵션 등을 수정합니다."""
    # 수정 시에도 타입이 변경되거나 유지되는 경우 옵션 유효성 체크
    if payload.value_type == "categorical" and not payload.options:
        raise HTTPException(status_code=422, detail="선택형 항목으로 수정 시 옵션 입력이 필수입니다.")
        
    obj = crud.update_result_schema(db, schema_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="해당 측정 항목 정의를 찾을 수 없습니다.")
    return obj

@router.delete("/result-schemas/{schema_id}", summary="측정 항목 정의 삭제")
def delete_result_schema(schema_id: int, db: Session = Depends(get_db)):
    """측정 항목 정의를 삭제합니다. (주의: 기존 실험 데이터의 해당 항목 값이 유실될 수 있음)"""
    ok = crud.delete_result_schema(db, schema_id)
    if not ok:
        raise HTTPException(status_code=404, detail="삭제할 항목 정의를 찾을 수 없습니다.")
    return {"ok": True}


# --- 출력 설정(Output Config) 관련 API ---

@router.get("/projects/{project_id}/output-config", response_model=schemas.OutputConfigOut | None, summary="프로젝트별 출력 설정 조회")
def get_output_config(project_id: int, db: Session = Depends(get_db)):
    obj = crud.get_output_config(db, project_id)
    if not obj:
        # 프론트엔드 에러 방지를 위한 빈 객체 반환
        return {"project_id": project_id, "included_keys": [], "id": -1, "created_at": None}
    return obj

@router.put("/output-config", response_model=schemas.OutputConfigOut, summary="출력 설정 저장/업데이트")
def upsert_output_config(payload: schemas.OutputConfigUpsert, db: Session = Depends(get_db)):
    """테이블이나 차트에 표시할 항목(키 리스트)을 저장합니다."""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="유효하지 않은 프로젝트 ID입니다.")
    return crud.upsert_output_config(db, payload)