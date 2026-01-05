from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True

def test_project_crud_roundtrip():
    r = client.post("/api/projects", json={"name": "T_Project_1", "project_type": "VOC", "status": "ONGOING"})
    assert r.status_code == 200
    pid = r.json()["id"]

    r = client.get("/api/projects")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    r = client.patch(f"/api/projects/{pid}", json={"status": "CLOSED"})
    assert r.status_code == 200
    assert r.json()["status"] == "CLOSED"

    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_result_schema_requires_options_for_categorical():
    # project
    r = client.post("/api/projects", json={"name": "T_Project_Cat", "project_type": "VOC", "status": "ONGOING"})
    pid = r.json()["id"]

    r = client.post("/api/result-schemas", json={"project_id": pid, "key": "appearance", "label": "Appearance", "value_type": "categorical"})
    assert r.status_code == 422


def test_experiment_result_value_validation():
    r = client.post("/api/projects", json={"name": "T_Project_Exp", "project_type": "VOC", "status": "ONGOING"})
    pid = r.json()["id"]

    r = client.post("/api/result-schemas", json={"project_id": pid, "key": "temperature", "label": "Temp", "value_type": "quantitative"})
    assert r.status_code == 200

    payload = {
        "project_id": pid,
        "name": "E1",
        "author": "tester",
        "purpose": "validate",
        "materials": [],
        "result_values": {"temperature": "not-a-number"},
    }
    r = client.post("/api/experiments", json=payload)
    assert r.status_code == 400
    assert "numeric" in r.json()["detail"]

    payload["result_values"] = {"temperature": 23.5}
    r = client.post("/api/experiments", json=payload)
    assert r.status_code == 200
