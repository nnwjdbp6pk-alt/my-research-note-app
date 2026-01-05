from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from . import schemas, crud

router = APIRouter(prefix="/api")

@router.get("/projects", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return crud.list_projects(db)

@router.post("/projects", response_model=schemas.ProjectOut)
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, payload)

@router.get("/projects/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    obj = crud.get_project(db, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    return obj

@router.patch("/projects/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    obj = crud.update_project(db, project_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    return obj

@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_project(db, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}

@router.get("/projects/{project_id}/experiments", response_model=list[schemas.ExperimentOut])
def list_experiments(project_id: int, db: Session = Depends(get_db)):
    return crud.list_experiments(db, project_id)

@router.post("/experiments", response_model=schemas.ExperimentOut)
def create_experiment(payload: schemas.ExperimentCreate, db: Session = Depends(get_db)):
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="Invalid project_id")
    try:
        return crud.create_experiment(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/experiments/{experiment_id}", response_model=schemas.ExperimentOut)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    obj = crud.get_experiment(db, experiment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return obj

@router.patch("/experiments/{experiment_id}", response_model=schemas.ExperimentOut)
def update_experiment(experiment_id: int, payload: schemas.ExperimentUpdate, db: Session = Depends(get_db)):
    try:
        obj = crud.update_experiment(db, experiment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not obj:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return obj

@router.delete("/experiments/{experiment_id}")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_experiment(db, experiment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {"ok": True}

@router.get("/projects/{project_id}/result-schemas", response_model=list[schemas.ResultSchemaOut])
def list_result_schemas(project_id: int, db: Session = Depends(get_db)):
    return crud.list_result_schemas(db, project_id)

@router.post("/result-schemas", response_model=schemas.ResultSchemaOut)
def create_result_schema(payload: schemas.ResultSchemaCreate, db: Session = Depends(get_db)):
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="Invalid project_id")
    if payload.value_type == "categorical" and not payload.options:
        raise HTTPException(status_code=422, detail="options is required for categorical fields")
    return crud.create_result_schema(db, payload)

@router.patch("/result-schemas/{schema_id}", response_model=schemas.ResultSchemaOut)
def update_result_schema(schema_id: int, payload: schemas.ResultSchemaUpdate, db: Session = Depends(get_db)):
    if payload.value_type == "categorical" and not payload.options:
        raise HTTPException(status_code=422, detail="options is required for categorical fields")
    obj = crud.update_result_schema(db, schema_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Result schema not found")
    return obj

@router.delete("/result-schemas/{schema_id}")
def delete_result_schema(schema_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_result_schema(db, schema_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Result schema not found")
    return {"ok": True}

@router.get("/projects/{project_id}/output-config", response_model=schemas.OutputConfigOut | None)
def get_output_config(project_id: int, db: Session = Depends(get_db)):
    return crud.get_output_config(db, project_id)

@router.put("/output-config", response_model=schemas.OutputConfigOut)
def upsert_output_config(payload: schemas.OutputConfigUpsert, db: Session = Depends(get_db)):
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="Invalid project_id")
    return crud.upsert_output_config(db, payload)
