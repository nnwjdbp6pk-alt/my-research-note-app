from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

# --- 공통 타입 정의 ---
ProjectType = Literal["VOC", "REGULAR"]
ProjectStatus = Literal["ONGOING", "CLOSED"]
ResultValueType = Literal["quantitative", "qualitative", "categorical"]
UnitType = Literal["g", "kg"]

# --- 프로젝트(Project) 관련 스키마 ---

class ProjectCreate(BaseModel):
    """프로젝트 생성 요청 스키마"""
    name: str = Field(min_length=1, max_length=200, description="프로젝트 명칭")
    project_type: ProjectType = Field(default="REGULAR", description="프로젝트 유형 (정규/VOC)")
    expected_end_date: Optional[date] = Field(default=None, description="예정 종료일")
    status: ProjectStatus = Field(default="ONGOING", description="진행 상태")

class ProjectUpdate(BaseModel):
    """프로젝트 수정 요청 스키마 (모든 필드 선택 사항)"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    project_type: Optional[ProjectType] = None
    expected_end_date: Optional[date] = None
    status: Optional[ProjectStatus] = None

class ProjectOut(BaseModel):
    """프로젝트 정보 출력 스키마"""
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    project_type: str
    expected_end_date: Optional[date]
    status: str
    created_at: datetime


# --- 실험(Experiment) 관련 스키마 ---

class MaterialLine(BaseModel):
    """원료 배합 정보의 한 행(Row)을 정의하는 스키마"""

    name: str = Field(min_length=1, max_length=200, description="원료명")
    # 단일 값/배열 입력 모두 허용하되, 내부적으로는 배열(list[float])로 정규화한다.
    amount: list[float] = Field(description="투입량 (0보다 큰 값의 배열)")
    unit: UnitType = Field(description="단위 (g/kg)")
    ratio: float = Field(ge=0, le=100, description="배합비 (0~100 사이)")

    @field_validator("amount", mode="before")
    @classmethod
    def normalize_amount(cls, v: float | list[float]):
        """숫자 또는 숫자 배열 입력을 모두 배열(list[float])로 정규화"""
        if isinstance(v, (int, float)):
            if v <= 0:
                raise ValueError("투입량은 0보다 커야 합니다.")
            return [float(v)]

        if isinstance(v, list):
            if len(v) == 0:
                raise ValueError("투입량 목록이 비어 있습니다.")

            amounts: list[float] = []
            for item in v:
                try:
                    num = float(item)
                except (TypeError, ValueError):
                    raise ValueError("투입량은 숫자이거나 숫자 배열이어야 합니다.")
                if num <= 0:
                    raise ValueError("투입량은 0보다 커야 합니다.")
                amounts.append(num)

            return amounts

        raise ValueError("투입량은 숫자 또는 숫자 배열이어야 합니다.")

class ExperimentCreate(BaseModel):
    """실험 기록 생성 요청 스키마"""
    project_id: int = Field(description="소속 프로젝트 ID")
    name: str = Field(min_length=1, max_length=200, description="실험 명칭")
    author: str = Field(min_length=1, max_length=80, description="실험 작성자")
    purpose: str = Field(min_length=1, description="실험 목적 및 조건")
    materials: list[MaterialLine] = Field(default_factory=list, description="원료 배합 리스트")
    # 결과값은 key-value 쌍의 딕셔너리로 받음 (예: {"vis_01": 1500})
    result_values: dict[str, Any] = Field(default_factory=dict, description="실험 결과 데이터")

class ExperimentUpdate(BaseModel):
    """실험 기록 수정 요청 스키마"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    author: Optional[str] = Field(default=None, min_length=1, max_length=80)
    purpose: Optional[str] = Field(default=None, min_length=1)
    materials: Optional[list[MaterialLine]] = None
    result_values: Optional[dict[str, Any]] = None

class ExperimentOut(BaseModel):
    """실험 기록 출력 스키마"""
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    author: str
    purpose: str
    materials: list[dict[str, Any]]
    result_values: dict[str, Any]
    created_at: datetime


# --- 결과 항목 정의(Result Schema) 관련 스키마 ---

class ResultSchemaCreate(BaseModel):
    """실험 결과 측정 항목 정의 생성 요청 스키마"""
    project_id: int
    # 시스템 식별 키: 영문, 숫자, 언더바, 하이픈만 허용
    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_\-]+$")
    label: str = Field(min_length=1, max_length=200, description="화면 표시 라벨")
    value_type: ResultValueType = Field(description="데이터 타입 (수치/서술/선택)")
    unit: Optional[str] = Field(default=None, max_length=40, description="단위 (예: cps)")
    description: Optional[str] = Field(default=None, max_length=500, description="항목 설명")
    options: Optional[list[str]] = Field(default=None, description="선택형 항목의 옵션 리스트")
    order: int = Field(default=0, description="화면 표시 순서 (낮을수록 앞)")

    @model_validator(mode="after")
    def validate_categorical_options(self) -> "ResultSchemaCreate":
        """선택형(categorical) 타입일 경우 옵션 리스트가 필수임을 검증"""
        if self.value_type == "categorical":
            if not self.options or len(self.options) == 0:
                raise ValueError("선택형(categorical) 항목은 반드시 하나 이상의 옵션(options)이 필요합니다.")
        return self

class ResultSchemaUpdate(BaseModel):
    """결과 항목 정의 수정 요청 스키마"""
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    value_type: Optional[ResultValueType] = None
    unit: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=500)
    options: Optional[list[str]] = None
    order: Optional[int] = None

    @model_validator(mode="after")
    def check_options_on_type_change(self) -> "ResultSchemaUpdate":
        """타입을 선택형으로 변경할 때 옵션이 누락되지 않았는지 검증"""
        if self.value_type == "categorical" and (self.options is None or len(self.options) == 0):
            # 참고: 이 시점에는 기존 DB의 options를 알 수 없으므로, 
            # 타입 변경 시에는 항상 options를 함께 보내도록 가이드합니다.
            raise ValueError("항목 타입을 '선택형(categorical)'으로 설정할 때는 옵션 목록을 반드시 포함해야 합니다.")
        return self

class ResultSchemaOut(BaseModel):
    """결과 항목 정의 출력 스키마"""
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    key: str
    label: str
    value_type: str
    unit: Optional[str]
    description: Optional[str]
    options: Optional[list[str]]
    order: int
    created_at: datetime


# --- 출력 구성(Output Config) 관련 스키마 ---

class OutputConfigUpsert(BaseModel):
    """출력 구성 저장 요청 스키마"""
    project_id: int
    included_keys: list[str] = Field(default_factory=list, description="표시할 필드 키 리스트")

class OutputConfigOut(BaseModel):
    """출력 구성 정보 출력 스키마"""
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    included_keys: list[str]
    created_at: datetime