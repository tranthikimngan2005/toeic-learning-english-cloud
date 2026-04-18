# Pengwin - AI English Learning Platform

## System Requirements

Make sure your system meets the following requirements before running the project:

* **Python:** `>= 3.11` (supports `datetime.UTC`)
* **Node.js:** `>= 18.x`
* **Database:** SQLite *(pre-configured in the project)*

---

## Installation & Running Guide

### 1. Backend (FastAPI)

#### Step 1: Navigate to backend folder

```bash
cd backend/lingai
```

#### Step 2: Install dependencies

```bash
pip install -r requirements.txt
```

#### Step 3: Run the server

```bash
python -m uvicorn app.main:app --reload
```

#### API Documentation

* Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### 2. Frontend (ReactJS)

#### Step 1: Navigate to frontend folder

```bash
cd lingai-frontend
```

#### Step 2: Install dependencies

```bash
npm install
```

#### Step 3: Start the application

```bash
npm start
```

#### Web Interface

* URL: [http://localhost:3000](http://localhost:3000)

---

## Project Structure (Optional)

```text
ai-english-learning-platform/
|-- backend/
|   `-- lingai/
|       `-- app/
|
|-- lingai-frontend/
|
`-- README.md
```

---

## Notes

* Ensure backend is running before starting frontend.
* Default ports:
	* Backend: `8000`
	* Frontend: `3000`
* SQLite database is automatically initialized.

---

## Tips

* Use virtual environment for Python:

```bash
python -m venv venv
venv\Scripts\activate     # Windows
source venv/bin/activate   # Linux/Mac
```
