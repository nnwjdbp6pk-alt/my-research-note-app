# ELN (Electronic Lab Notebook) MVP

실행 가능한 전자 연구노트(ELN) 관리 웹앱 MVP입니다. 프로젝트별 실험과 결과 필드를 유연하게 정의하고, 표/그래프로 가시화할 수 있습니다.

## 파일 트리 (요약)
- backend/
  - app/ (FastAPI, SQLAlchemy 모델/스키마/API/CRUD/시드)
  - alembic/ (마이그레이션 설정과 버전)
  - requirements.txt, tests/
- frontend/
  - src/ (React + Vite, 페이지/컴포넌트/스타일)
  - package.json

## A) 간단 아키텍처 설명
- **클라이언트**: React + TypeScript + Vite. Axios로 API 호출, Recharts + Chart.js(box-plot 플러그인)로 시각화.
- **API 계층**: FastAPI 라우터가 CRUD 및 출력 설정(표/그래프 대상 필드 선택) 제공.
- **도메인/서비스**: `crud.py`에서 프로젝트/결과 스키마/실험/출력설정 처리 및 결과값 타입 검증.
- **DB 계층**: SQLAlchemy 모델 + SQLite. 결과값과 소재(원료) 리스트는 JSON 컬럼으로 유연 저장. Alembic으로 스키마 관리.

## B) DB 스키마 설계
- **projects**: `id`, `name`, `project_type(VOC|REGULAR)`, `expected_end_date`, `status(ONGOING|CLOSED)`, `created_at`.
- **result_schemas**: 프로젝트별 결과 항목 템플릿. `key`, `label`, `value_type(quantitative|qualitative|categorical)`, `unit`, `description`, `options`(categorical 옵션), `created_at`.
- **output_configs**: 프로젝트별 출력 대상 필드 목록 `included_keys`.
- **experiments**: `project_id`, `name`, `author`, `purpose`, `materials`(JSON: name/amount/unit/ratio), `result_values`(JSON: key-value), `created_at`.

## C) 백엔드 API 명세 (발췌)
- `GET /api/projects` / `POST /api/projects` / `PATCH|DELETE /api/projects/{id}`
- `GET /api/projects/{project_id}/result-schemas` / `POST /api/result-schemas` / `PATCH|DELETE /api/result-schemas/{id}`
- `GET /api/projects/{project_id}/experiments` / `POST /api/experiments` / `PATCH|DELETE /api/experiments/{id}`
- `GET /api/projects/{project_id}/output-config` / `PUT /api/output-config`

요청/응답 예시
```http
POST /api/experiments
{
  "project_id": 1,
  "name": "Batch D",
  "author": "alice",
  "purpose": "viscosity tuning",
  "materials": [{"name": "Resin", "amount": 1200, "unit": "g", "ratio": 60}],
  "result_values": {"viscosity_cps": 4300, "appearance": "clear"}
}
```
→ `201 OK` with created experiment JSON. 잘못된 타입(예: 수치 필드에 문자열)이면 `400` 응답.

## D) 프론트엔드 화면 구성
- **Projects**: 생성/목록, 각 프로젝트 상세로 이동.
- **Project Detail**: 결과 항목 템플릿 편집(추가/삭제/라벨·타입·단위·옵션/설명 변경), 출력 대상 필드 체크 후 저장.
- **New Experiment**: 실험명/작성자/목적 + 소재(여러 줄) + 결과값 입력(필드 타입에 맞는 입력 UI, 카테고리 필드는 select).
- **Output**: 선택된 결과 필드로 표 렌더링, 정량 필드 선택 UI + 그래프 4종(막대/꺾은선/수염상자/산점도). 데이터 부족 시 안내 메시지 표시.

## E) 실제 구현 코드 위치
- **백엔드**: `backend/app` (FastAPI 엔트리 `main.py`, 모델 `models.py`, 스키마 `schemas.py`, 라우터 `api.py`, 시드 `seed.py`)
- **프론트엔드**: `frontend/src/app/pages` (Projects, ProjectDetail, NewExperiment, Output), `frontend/src/api.ts` (Axios 래퍼)
- **마이그레이션**: `backend/alembic` (`alembic.ini`, `versions/0001_init.py`)
- **시드 데이터**: `python -m app.seed`로 프로젝트/결과항목/샘플 실험 생성

## F) 로컬 실행 방법
### Backend (Windows PowerShell)
```powershell
cd backend
python -m venv .venv
\.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head   # 최초 1회 마이그레이션
python -m app.seed     # 샘플 데이터
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API 문서: http://127.0.0.1:8000/docs

### Frontend
```powershell
cd frontend
npm install
npm run dev -- --host
```
앱: http://localhost:5173 (백엔드 CORS 허용: http://localhost:5173)

### 테스트 (백엔드)
```powershell
cd backend
pytest -q
```

## G) 향후 확장 제안
- 사용자/권한, 프로젝트 멤버십, 감사 로그(Audit trail)
- 파일/이미지 첨부 및 미디어 버전 관리
- 실험 템플릿/워크플로우 단계화, 승인 프로세스
- CSV/XLSX 내보내기·가져오기, 외부 LIMS/노션/슬랙 연동
- 그래프 라이브러리 확장(Plotly/ECharts) 및 대시보드 저장
