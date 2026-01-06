from __future__ import annotations

from datetime import datetime, date
from typing import Any, Optional

from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON
from sqlalchemy import UniqueConstraint

from .db import Base

class Project(Base):
    """
    연구 프로젝트 테이블
    - 정규 과제 및 VOC 요청을 구분하여 관리합니다.
    """
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 프로젝트 명칭 (중복 불가)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    # 프로젝트 유형: "REGULAR"(정규), "VOC"(비정규)
    project_type: Mapped[str] = mapped_column(String(20), nullable=False, default="REGULAR")
    # 목표 종료일 (선택 사항)
    expected_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # 진행 상태: "ONGOING"(진행중), "CLOSED"(종료됨)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ONGOING")
    # 생성 일시
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # 관계 설정 (Cascade 적용: 프로젝트 삭제 시 관련 데이터 모두 삭제)
    experiments: Mapped[list["Experiment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    result_schemas: Mapped[list["ResultSchema"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    output_configs: Mapped[list["OutputConfig"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Experiment(Base):
    """
    실험 기록 테이블
    - 특정 프로젝트 내에서 수행된 개별 실험의 원료 배합 및 결과값을 저장합니다.
    """
    __tablename__ = "experiments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    # 실험 제목 및 기본 정보
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    author: Mapped[str] = mapped_column(String(80), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)

    # 원료 배합 정보 (JSON List 형태)
    # 구조: [{"name": "원료A", "amount": 10.5, "unit": "g", "ratio": 15.2}, ...]
    materials: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    # 실험 결과값 (JSON Dict 형태)
    # 구조: {"viscosity_cps": 1500, "ph_value": 7.2, "status": "Good"}
    result_values: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # 관계 설정
    project: Mapped["Project"] = relationship(back_populates="experiments")

    # 성능 최적화를 위한 인덱스
    __table_args__ = (
        Index("ix_experiments_project_created", "project_id", "created_at"),
    )


class ResultSchema(Base):
    """
    결과 항목 정의 테이블 (결과 스키마)
    - 실험 시 입력받을 결과 항목(점도, 강도 등)의 규격을 정의합니다.
    """
    __tablename__ = "result_schemas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    # 시스템 식별 키 (영문/숫자, 예: viscosity_cps)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    # 화면 표시 이름 (한글 가능, 예: 점도 (cps))
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    # 데이터 타입: "quantitative"(수치), "qualitative"(텍스트), "categorical"(선택형)
    value_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # 단위 (선택 사항)
    unit: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    # 측정 방법 또는 항목 설명
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    # 선택형(categorical)일 경우 사용 가능한 옵션 리스트
    options: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True)
    
    # [추가] 정렬 순서: 화면에서 항목이 배치되는 순서 (낮은 숫자가 앞)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # 관계 설정
    project: Mapped["Project"] = relationship(back_populates="result_schemas")
    # [추가] 프로젝트 ID와 Key의 조합은 유니크해야 함
    __table_args__ = (
        UniqueConstraint("project_id", "key", name="uq_project_key"),
    )


class OutputConfig(Base):
    """
    출력 구성 테이블
    - 결과 조회 페이지(Output)의 테이블 및 차트에 포함할 필드 리스트를 관리합니다.
    """
    __tablename__ = "output_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)

    # 포함된 결과 키 리스트 (JSON 구조)
    # 구조: ["key1", "key2", "key3"]
    included_keys: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    # 관계 설정
    project: Mapped["Project"] = relationship(back_populates="output_configs")