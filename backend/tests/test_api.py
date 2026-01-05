from fastapi.testclient import TestClient
from app.main import app

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
