from __future__ import annotations

from datetime import datetime, date
from typing import Any, Optional

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .db import Base

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    project_type: Mapped[str] = mapped_column(String(20), nullable=False, default="REGULAR")  # VOC|REGULAR
    expected_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ONGOING")  # ONGOING|CLOSED
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    experiments: Mapped[list["Experiment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    result_schemas: Mapped[list["ResultSchema"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    output_configs: Mapped[list["OutputConfig"]] = relationship(back_populates="project", cascade="all, delete-orphan")

class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    author: Mapped[str] = mapped_column(String(80), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)

    # materials: list of {name, amount, unit, ratio}
    materials: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    # result_values: dict[field_key] = value (number/string/etc.)
    result_values: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="experiments")

class ResultSchema(Base):
    __tablename__ = "result_schemas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    key: Mapped[str] = mapped_column(String(80), nullable=False)  # stable key
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    value_type: Mapped[str] = mapped_column(String(30), nullable=False)  # quantitative|qualitative|categorical

    unit: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    options: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="result_schemas")

class OutputConfig(Base):
    __tablename__ = "output_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    included_keys: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="output_configs")
