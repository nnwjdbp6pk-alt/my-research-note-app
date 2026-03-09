from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .db import get_db
from . import schemas, crud

router = APIRouter(prefix="/api")

# --- ?꾨줈?앺듃 愿??API ---

@router.get("/projects", response_model=list[schemas.ProjectOut], summary="?꾩껜 ?꾨줈?앺듃 紐⑸줉 議고쉶")
def list_projects(db: Session = Depends(get_db)):
    """?깅줉??紐⑤뱺 ?꾨줈?앺듃??紐⑸줉??理쒖떊?쒖쑝濡?媛?몄샃?덈떎."""
    return crud.list_projects(db)

@router.post("/projects", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED, summary="???꾨줈?앺듃 ?앹꽦")
def create_project(payload: schemas.ProjectCreate, db: Session = Depends(get_db)):
    """?덈줈???곌뎄 ?꾨줈?앺듃瑜??앹꽦?⑸땲??"""
    return crud.create_project(db, payload)

@router.get("/projects/{project_id}", response_model=schemas.ProjectOut, summary="?⑥씪 ?꾨줈?앺듃 ?곸꽭 議고쉶")
def get_project(project_id: int, db: Session = Depends(get_db)):
    """?뱀젙 ID瑜?媛吏??꾨줈?앺듃???곸꽭 ?뺣낫瑜?議고쉶?⑸땲??"""
    obj = crud.get_project(db, project_id)
    if not obj:
        raise HTTPException(status_code=404, detail="?대떦 ?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.")
    return obj

@router.patch("/projects/{project_id}", response_model=schemas.ProjectOut, summary="?꾨줈?앺듃 ?뺣낫 ?섏젙")
def update_project(project_id: int, payload: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    """?꾨줈?앺듃???대쫫, ?곹깭(吏꾪뻾/醫낅즺), ?좏삎 ?깆쓣 ?섏젙?⑸땲??"""
    obj = crud.update_project(db, project_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="?섏젙???꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.")
    return obj

@router.delete("/projects/{project_id}", summary="?꾨줈?앺듃 ??젣")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """?꾨줈?앺듃? 愿?⑤맂 紐⑤뱺 ?곗씠???ㅽ뿕, ?ㅽ궎留???瑜???젣?⑸땲??"""
    ok = crud.delete_project(db, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="??젣???꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.")
    return {"ok": True, "message": "?꾨줈?앺듃媛 ?깃났?곸쑝濡???젣?섏뿀?듬땲??"}


# --- ?ㅽ뿕(Experiment) 愿??API ---

@router.get("/projects/{project_id}/experiments", response_model=list[schemas.ExperimentOut], summary="?꾨줈?앺듃蹂??ㅽ뿕 紐⑸줉 議고쉶")
def list_experiments(project_id: int, db: Session = Depends(get_db)):
    """?뱀젙 ?꾨줈?앺듃???랁븳 紐⑤뱺 ?ㅽ뿕 湲곕줉??理쒖떊?쒖쑝濡?議고쉶?⑸땲??"""
    return crud.list_experiments(db, project_id)

@router.post("/experiments", response_model=schemas.ExperimentOut, status_code=status.HTTP_201_CREATED, summary="?ㅽ뿕 寃곌낵 湲곕줉")
def create_experiment(payload: schemas.ExperimentCreate, db: Session = Depends(get_db)):
    """?덈줈???ㅽ뿕 ?곗씠?곕? 湲곕줉?⑸땲?? 諛고빀 ?뺣낫? 寃곌낵媛?寃利앹씠 ?ы븿?⑸땲??"""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="?좏슚?섏? ?딆? ?꾨줈?앺듃 ID?낅땲??")
    try:
        return crud.create_experiment(db, payload)
    except ValueError as exc:
        # crud.validate_result_values ?깆뿉??諛쒖깮??寃利??먮윭瑜?諛섑솚
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/experiments/{experiment_id}", response_model=schemas.ExperimentOut, summary="?ㅽ뿕 ?곸꽭 議고쉶")
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """?뱀젙 ?ㅽ뿕???먮즺 諛고빀 諛?寃곌낵媛??곸꽭 ?뺣낫瑜?議고쉶?⑸땲??"""
    obj = crud.get_experiment(db, experiment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="?대떦 ?ㅽ뿕 湲곕줉??李얠쓣 ???놁뒿?덈떎.")
    return obj

@router.patch("/experiments/{experiment_id}", response_model=schemas.ExperimentOut, summary="?ㅽ뿕 湲곕줉 ?섏젙")
def update_experiment(experiment_id: int, payload: schemas.ExperimentUpdate, db: Session = Depends(get_db)):
    """湲곗〈 ?ㅽ뿕???뺣낫瑜??섏젙?섍굅??異붽? 寃곌낵瑜??낅젰?⑸땲??"""
    try:
        obj = crud.update_experiment(db, experiment_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    
    if not obj:
        raise HTTPException(status_code=404, detail="?섏젙???ㅽ뿕 湲곕줉??李얠쓣 ???놁뒿?덈떎.")
    return obj

@router.delete("/experiments/{experiment_id}", summary="?ㅽ뿕 湲곕줉 ??젣")
def delete_experiment(experiment_id: int, db: Session = Depends(get_db)):
    """?뱀젙 ?ㅽ뿕 湲곕줉????젣?⑸땲??"""
    ok = crud.delete_experiment(db, experiment_id)
    if not ok:
        raise HTTPException(status_code=404, detail="??젣???ㅽ뿕 湲곕줉??李얠쓣 ???놁뒿?덈떎.")
    return {"ok": True}


# --- 寃곌낵 ?ㅽ궎留?Result Schema) 愿??API ---

@router.get("/projects/{project_id}/result-schemas", response_model=list[schemas.ResultSchemaOut], summary="?꾨줈?앺듃蹂?痢≪젙 ??ぉ 議고쉶")
def list_result_schemas(project_id: int, db: Session = Depends(get_db)):
    """?꾨줈?앺듃?먯꽌 ?뺤쓽??寃곌낵 ?낅젰 ??ぉ(?ㅽ궎留? 紐⑸줉??媛?몄샃?덈떎."""
    return crud.list_result_schemas(db, project_id)

@router.post("/result-schemas", response_model=schemas.ResultSchemaOut, summary="痢≪젙 ??ぉ ?뺤쓽 ?앹꽦")
def create_result_schema(payload: schemas.ResultSchemaCreate, db: Session = Depends(get_db)):
    """?ㅽ뿕 寃곌낵瑜??낅젰諛쏆쓣 ?덈줈????ぉ(?? ?먮룄, pH ?????뺤쓽?⑸땲??"""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="?좏슚?섏? ?딆? ?꾨줈?앺듃 ID?낅땲??")
    
        
    return crud.create_result_schema(db, payload)

@router.patch("/result-schemas/{schema_id}", response_model=schemas.ResultSchemaOut, summary="痢≪젙 ??ぉ ?뺤쓽 ?섏젙")
def update_result_schema(schema_id: int, payload: schemas.ResultSchemaUpdate, db: Session = Depends(get_db)):
    """湲곗〈???뺤쓽??痢≪젙 ??ぉ???대쫫, ?⑥쐞, ?듭뀡 ?깆쓣 ?섏젙?⑸땲??"""
    # ?섏젙 ?쒖뿉????낆씠 蹂寃쎈릺嫄곕굹 ?좎??섎뒗 寃쎌슦 ?듭뀡 ?좏슚??泥댄겕
    if payload.value_type == "categorical" and not payload.options:
        raise HTTPException(status_code=422, detail="?좏깮????ぉ?쇰줈 ?섏젙 ???듭뀡 ?낅젰???꾩닔?낅땲??")
        
    obj = crud.update_result_schema(db, schema_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="?대떦 痢≪젙 ??ぉ ?뺤쓽瑜?李얠쓣 ???놁뒿?덈떎.")
    return obj

@router.delete("/result-schemas/{schema_id}", summary="痢≪젙 ??ぉ ?뺤쓽 ??젣")
def delete_result_schema(schema_id: int, db: Session = Depends(get_db)):
    """痢≪젙 ??ぉ ?뺤쓽瑜???젣?⑸땲?? (二쇱쓽: 湲곗〈 ?ㅽ뿕 ?곗씠?곗쓽 ?대떦 ??ぉ 媛믪씠 ?좎떎?????덉쓬)"""
    ok = crud.delete_result_schema(db, schema_id)
    if not ok:
        raise HTTPException(status_code=404, detail="??젣????ぉ ?뺤쓽瑜?李얠쓣 ???놁뒿?덈떎.")
    return {"ok": True}


# --- 異쒕젰 ?ㅼ젙(Output Config) 愿??API ---

@router.get("/projects/{project_id}/output-config", response_model=schemas.OutputConfigOut | None, summary="?꾨줈?앺듃蹂?異쒕젰 ?ㅼ젙 議고쉶")
def get_output_config(project_id: int, db: Session = Depends(get_db)):
    obj = crud.get_output_config(db, project_id)
    if not obj:
        # ?꾨줎?몄뿏???먮윭 諛⑹?瑜??꾪븳 鍮?媛앹껜 諛섑솚
        return None
    return obj

@router.put("/output-config", response_model=schemas.OutputConfigOut, summary="異쒕젰 ?ㅼ젙 ????낅뜲?댄듃")
def upsert_output_config(payload: schemas.OutputConfigUpsert, db: Session = Depends(get_db)):
    """?뚯씠釉붿씠??李⑦듃???쒖떆????ぉ(??由ъ뒪??????ν빀?덈떎."""
    proj = crud.get_project(db, payload.project_id)
    if not proj:
        raise HTTPException(status_code=400, detail="?좏슚?섏? ?딆? ?꾨줈?앺듃 ID?낅땲??")
    return crud.upsert_output_config(db, payload)
