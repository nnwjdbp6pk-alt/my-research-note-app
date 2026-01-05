"""Seed script for prototype usage.
Run: python -m app.seed
"""
from sqlalchemy.orm import Session
from .db import SessionLocal, Base, engine
from . import models


def run():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if db.query(models.Project).count() == 0:
            project = models.Project(
                name="Adhesive Optimization",
                project_type="REGULAR",
                status="ONGOING",
            )
            db.add(project)
            db.commit()
            db.refresh(project)

            schemas = [
                models.ResultSchema(project_id=project.id, key="viscosity_cps", label="Viscosity (cps)", value_type="quantitative", unit="cps", description="Brookfield @25C"),
                models.ResultSchema(project_id=project.id, key="ph", label="pH", value_type="quantitative"),
                models.ResultSchema(project_id=project.id, key="peel_strength", label="Peel strength (N/cm)", value_type="quantitative", unit="N/cm"),
                models.ResultSchema(project_id=project.id, key="appearance", label="Appearance", value_type="categorical", options=["clear", "cloudy", "opaque"]),
                models.ResultSchema(project_id=project.id, key="notes", label="Notes", value_type="qualitative"),
            ]
            db.add_all(schemas)
            db.commit()

            db.add(models.OutputConfig(project_id=project.id, included_keys=["viscosity_cps", "ph", "peel_strength", "appearance", "notes"]))
            db.commit()

            experiments = [
                models.Experiment(
                    project_id=project.id,
                    name="Batch A",
                    author="alice",
                    purpose="Baseline adhesive viscosity tuning",
                    materials=[
                        {"name": "Resin", "amount": 1200, "unit": "g", "ratio": 60},
                        {"name": "Solvent", "amount": 800, "unit": "g", "ratio": 40},
                    ],
                    result_values={"viscosity_cps": 4200, "ph": 7.1, "peel_strength": 11.2, "appearance": "clear", "notes": "Looks stable"},
                ),
                models.Experiment(
                    project_id=project.id,
                    name="Batch B",
                    author="bob",
                    purpose="Increase solid content",
                    materials=[
                        {"name": "Resin", "amount": 1500, "unit": "g", "ratio": 62},
                        {"name": "Solvent", "amount": 700, "unit": "g", "ratio": 38},
                    ],
                    result_values={"viscosity_cps": 5100, "ph": 6.9, "peel_strength": 12.4, "appearance": "cloudy", "notes": "Slightly hazy"},
                ),
                models.Experiment(
                    project_id=project.id,
                    name="Batch C",
                    author="chris",
                    purpose="pH adjustment",
                    materials=[
                        {"name": "Resin", "amount": 1300, "unit": "g", "ratio": 58},
                        {"name": "Solvent", "amount": 900, "unit": "g", "ratio": 42},
                    ],
                    result_values={"viscosity_cps": 4600, "ph": 7.5, "peel_strength": 10.9, "appearance": "clear", "notes": "Better pH"},
                ),
            ]
            db.add_all(experiments)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
