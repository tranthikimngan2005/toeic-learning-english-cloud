# Pengwin - AI English Learning Platform

## Chay nhanh bang 3 terminal

Luu y: dung `venv` (Python 3.12), khong dung `.venv` de tranh loi `pydantic-core`.

### Terminal 1: Backend (install + seed + run)

```powershell
cd E:\dtdm
if (Get-Command deactivate -ErrorAction SilentlyContinue) { deactivate }
.\venv\Scripts\Activate.ps1
cd .\backend\lingai
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Terminal 2: Gateway

```powershell
cd E:\dtdm
.\venv\Scripts\Activate.ps1
python gateway_fix.py
```

### Terminal 3: Frontend

```powershell
cd E:\dtdm\frontend
npm install
npm run dev
```

## URL

- Frontend: http://localhost:3000
- Backend docs: http://127.0.0.1:8001/docs
- Gateway API: http://127.0.0.1:8000/api/v1

## Demo Accounts

- Student: an@pengwin.com / student123
- Creator: creator@pengwin.com / creator123
- Admin: admin@pengwin.com / admin123
//const BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
