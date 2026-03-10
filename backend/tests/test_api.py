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
    assert r.status_code == 201
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
    assert "숫자" in r.json()["detail"]

    payload["result_values"] = {"temperature": 23.5}
    r = client.post("/api/experiments", json=payload)
    assert r.status_code == 201


def test_ingredient_index_auto_update():
    r = client.post("/api/projects", json={"name": "T_Project_Ing", "project_type": "REGULAR", "status": "ONGOING"})
    pid = r.json()["id"]

    payload = {
        "project_id": pid,
        "name": "E-Ing-1",
        "author": "tester",
        "purpose": "ingredient test",
        "materials": [
            {"name": "Resin A", "amount": 10, "unit": "g", "ratio": 50},
            {"name": "Solvent B", "amount": 10, "unit": "g", "ratio": 50},
        ],
        "result_values": {},
    }
    r = client.post("/api/experiments", json=payload)
    assert r.status_code == 201
    exp_id = r.json()["id"]

    r = client.get("/api/ingredients")
    assert r.status_code == 200
    names = [row["name"] for row in r.json()]
    assert "Resin A" in names
    assert "Solvent B" in names

    r = client.patch(
        f"/api/experiments/{exp_id}",
        json={
            "materials": [
                {"name": "Resin A", "amount": 20, "unit": "g", "ratio": 100},
                {"name": "Additive C", "amount": 1, "unit": "g", "ratio": 5},
            ]
        },
    )
    assert r.status_code == 200

    r = client.get("/api/ingredients")
    assert r.status_code == 200
    names = [row["name"] for row in r.json()]
    assert "Additive C" in names


def test_csv_import_and_export():
    csv_body = (
        "project_name,project_type,project_status,expected_end_date,experiment_name,author,purpose,experiment_conditions,experiment_date,requester,received_date,materials_json,result_values_json\n"
        "ImportP,REGULAR,ONGOING,,E-1,tester,test purpose,25C-30min,2026-03-10,,,\"[{\"\"name\"\":\"\"M1\"\",\"\"amount\"\":5,\"\"unit\"\":\"\"g\"\",\"\"ratio\"\":100}]\",\"{\"\"temp\"\":25}\"\n"
    )

    files = {"file": ("import.csv", csv_body.encode("utf-8"), "text/csv")}
    r = client.post("/api/data/import?format=csv", files=files)
    assert r.status_code == 200
    assert r.json()["projects_created"] == 1
    assert r.json()["experiments_created"] == 1

    r = client.get("/api/data/export?format=csv")
    assert r.status_code == 200
    text = r.content.decode("utf-8-sig")
    assert "ImportP" in text
    assert "E-1" in text
    assert "25C-30min" in text
