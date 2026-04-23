powershell -ExecutionPolicy Bypass -File .\run_pengwin.ps1
terminal 1: cd E:\dtdm
if (Get-Command deactivate -ErrorAction SilentlyContinue) { deactivate }
.\venv\Scripts\Activate.ps1
cd .\backend\lingai
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
terminal 2: cd E:\dtdm
.\venv\Scripts\Activate.ps1
python gateway_fix.py
terminal 3: cd E:\dtdm\frontend
npm install
npm run dev