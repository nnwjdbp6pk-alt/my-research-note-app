# Backend (FastAPI)

## Run (Windows PowerShell)
```powershell
cd backend
python -m venv .venv
\.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Test
```powershell
pytest -q
```

## Migrations
- Alembic 설정 파일: `alembic.ini`
- 초기 생성/업그레이드: `alembic upgrade head`
