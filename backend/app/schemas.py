from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional, Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator

ProjectType = Literal["VOC", "REGULAR"]
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
    materials: list[MaterialLine] = Field(default_factory=list)
    result_values: dict[str, Any] = Field(default_factory=dict)

class ExperimentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    author: Optional[str] = Field(default=None, min_length=1, max_length=80)
    purpose: Optional[str] = Field(default=None, min_length=1)
    materials: Optional[list[MaterialLine]] = None
    result_values: Optional[dict[str, Any]] = None

class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    name: str
    author: str
    purpose: str
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

    @field_validator("options")
    @classmethod
    def options_required_for_categorical(cls, v, info):
        if info.data.get("value_type") == "categorical":
            if not v or len(v) == 0:
                raise ValueError("options is required for categorical fields")
        return v

class ResultSchemaUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    value_type: Optional[ResultValueType] = None
    unit: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=500)
    options: Optional[list[str]] = None

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
