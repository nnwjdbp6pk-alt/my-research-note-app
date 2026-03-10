from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

ProjectType = Literal["VOC", "REGULAR", "PROPERTY_COMPARE"]
ProjectStatus = Literal["ONGOING", "CLOSED"]
ResultValueType = Literal["quantitative", "qualitative", "categorical"]
UnitType = Literal["g", "kg"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    project_type: ProjectType = "REGULAR"
    expected_end_date: Optional[date] = None
    status: ProjectStatus = "ONGOING"


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    project_type: Optional[ProjectType] = None
    expected_end_date: Optional[date] = None
    status: Optional[ProjectStatus] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    project_type: str
    expected_end_date: Optional[date]
    status: str
    created_at: datetime


class MaterialLine(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    unit: UnitType
    ratio: float = Field(ge=0, le=100)


class ExperimentCreate(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=80)
    purpose: str = Field(min_length=1)
    experiment_conditions: Optional[str] = None
    experiment_date: Optional[date] = None
    requester: Optional[str] = Field(default=None, max_length=120)
    received_date: Optional[date] = None
    materials: list[MaterialLine] = Field(default_factory=list)
    result_values: dict[str, Any] = Field(default_factory=dict)


class ExperimentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    author: Optional[str] = Field(default=None, min_length=1, max_length=80)
    purpose: Optional[str] = Field(default=None, min_length=1)
    experiment_conditions: Optional[str] = None
    experiment_date: Optional[date] = None
    requester: Optional[str] = Field(default=None, max_length=120)
    received_date: Optional[date] = None
    materials: Optional[list[MaterialLine]] = None
    result_values: Optional[dict[str, Any]] = None


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    author: str
    purpose: str
    experiment_conditions: Optional[str]
    experiment_date: Optional[date]
    requester: Optional[str]
    received_date: Optional[date]
    materials: list[dict[str, Any]]
    result_values: dict[str, Any]
    created_at: datetime


class ResultSchemaCreate(BaseModel):
    project_id: int
    key: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_\-]+$")
    label: str = Field(min_length=1, max_length=200)
    value_type: ResultValueType
    unit: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=500)
    options: Optional[list[str]] = None
    order: int = 0

    @model_validator(mode="after")
    def validate_categorical_options(self) -> "ResultSchemaCreate":
        if self.value_type == "categorical" and (not self.options or len(self.options) == 0):
            raise ValueError("categorical 타입은 options가 필요합니다.")
        return self


class ResultSchemaUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    value_type: Optional[ResultValueType] = None
    unit: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=500)
    options: Optional[list[str]] = None
    order: Optional[int] = None

    @model_validator(mode="after")
    def check_options_on_type_change(self) -> "ResultSchemaUpdate":
        if self.value_type == "categorical" and (self.options is None or len(self.options) == 0):
            raise ValueError("categorical 타입 변경 시 options가 필요합니다.")
        return self


class ResultSchemaOut(BaseModel):
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


class OutputConfigUpsert(BaseModel):
    project_id: int
    included_keys: list[str] = Field(default_factory=list)


class OutputConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    included_keys: list[str]
    created_at: datetime


class IngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    normalized_name: str
    use_count: int
    created_at: datetime
    last_used_at: datetime


class DataImportSummary(BaseModel):
    projects_created: int
    projects_updated: int
    experiments_created: int
    experiments_updated: int
    ingredients_created: int
    ingredients_updated: int
    skipped_rows: int
