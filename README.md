# ?? HireRank — Smart Resume Screening & Candidate Ranking System

An AI-driven recruitment and talent intelligence platform that parses resumes, extracts structured candidate profiles, semantically matches them against job postings, and ranks candidates using a hybrid multi-factor algorithm.

---

## ?? Key Features

- **? Instant Demo Access**: One-click demo dashboard access pre-seeded with sample job postings and test workflows.
- **?? Multi-Format Resume Parsing**: High-fidelity extraction from PDF (pdfplumber, pypdf) and DOCX (python-docx).
- **?? Advanced NLP & Information Extraction**:
  - Contact Information Extraction (Email, Phone, Name with spaCy PERSON NER).
  - PhraseMatcher skill extraction matched against a **250+ skill taxonomy** with alias normalization (e.g. K8s ? Kubernetes, ReactJS ? React).
  - Work experience date range parsing and interval merging (prevents double-counting overlapping roles).
  - Ordinal education level detection (PhD, Master's, Bachelor's, Associate, High School).
- **?? Semantic Matching (Sentence-Transformers)**: Generates 384-dimensional dense vector embeddings (ll-MiniLM-L6-v2) to capture contextual semantic relevance between candidates and job descriptions.
- **?? 4-Factor Weighted Ranking Algorithm**:
  \text{Score} = (0.50 \times \text{Semantic}) + (0.25 \times \text{Skills}) + (0.15 \times \text{Experience}) + (0.10 \times \text{Education})
- **? Async Non-Blocking Pipeline**: FastAPI BackgroundTasks / Celery task queues for seamless background processing without UI freezing.
- **?? Recruiter Dashboard**: Modern React + TypeScript + Tailwind CSS UI with candidate modal breakdowns, ranked tables, filter controls, and score visualizers.

---

## ??? Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.13, FastAPI, Uvicorn, Pydantic v2 |
| **NLP & AI** | spaCy (en_core_web_sm), Sentence-Transformers (ll-MiniLM-L6-v2), scikit-learn, NumPy |
| **Parsing** | pdfplumber, pypdf, python-docx |
| **Database** | SQLite (Dev) / PostgreSQL with pgvector (Prod), SQLAlchemy 2.0 ORM, Alembic |
| **Async Queue** | FastAPI BackgroundTasks / Celery + Redis |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Heroicons, Axios |
| **Auth & Security** | JWT (python-jose), Passlib (Bcrypt) |

---

## ?? Getting Started

### Prerequisites
- **Python 3.10+** (tested on Python 3.13)
- **Node.js 18+** & **npm**

---

### 1. Backend Setup

`ash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Download the spaCy English NLP model
python -m spacy download en_core_web_sm

# (Optional) Review environment configuration
# Default uses SQLite with EAGER_TASKS=true for easy local development
copy .env.example .env

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
`
Backend will be available at http://localhost:8000 (Interactive docs at http://localhost:8000/docs).

---

### 2. Frontend Setup

`ash
# Navigate to frontend directory (in a new terminal)
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev -- --port 5173
`
Frontend will be live at http://localhost:5173.

---

## ?? Running Tests

`ash
cd backend
python -m pytest tests/ -v
`

---

## ?? Docker Deployment (PostgreSQL + pgvector + Redis)

For production setup with Postgres vector extension and Redis broker:

`ash
docker-compose up -d
`

---

## ?? License
This project is licensed under the MIT License.
