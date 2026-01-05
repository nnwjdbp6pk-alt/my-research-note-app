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
            p = models.Project(name="Sample Project", project_type="REGULAR", status="ONGOING")
            db.add(p)
            db.commit()
            db.refresh(p)

            db.add_all([
                models.ResultSchema(project_id=p.id, key="viscosity_cps", label="Viscosity (cps)", value_type="quantitative", unit="cps"),
                models.ResultSchema(project_id=p.id, key="ph", label="pH", value_type="quantitative"),
                models.ResultSchema(project_id=p.id, key="notes", label="Notes", value_type="qualitative"),
            ])
            db.commit()

            db.add(models.OutputConfig(project_id=p.id, included_keys=["viscosity_cps", "ph", "notes"]))
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    run()
