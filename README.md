# ELN (Electronic Lab Notebook) MVP Scaffold

This zip contains a runnable prototype scaffold for an ELN-style project/experiment tracker.

- Backend: FastAPI + SQLAlchemy + SQLite
- Frontend: React + TypeScript + Vite
- Charts: Recharts (bar/line/scatter demo wired; box-plot noted as next-step)

## Quick start (Windows PowerShell)

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API docs:
- http://127.0.0.1:8000/docs

### Frontend
```powershell
cd frontend
npm install
npm run dev
```

Frontend:
- http://localhost:5173

## Notes
- Prototype only (no auth). Experiment has an "author" field.
- Result values are stored as JSON for flexibility.
- Next steps: Alembic migrations, auth/roles, audit logs, attachments, CSV/XLSX export, richer charting (box plot).
