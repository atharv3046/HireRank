<div align="center">

<h1>HireRank — Smart Resume Screening & Candidate Ranking</h1>

<strong>AI-powered recruitment platform that reads, understands, and ranks resumes — so you hire the best, faster.</strong>

<br/><br/>

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![spaCy](https://img.shields.io/badge/spaCy-3.8-09A3D5?style=flat-square)](https://spacy.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## What Is HireRank?

HireRank is a full-stack AI recruitment platform that eliminates manual resume screening. Upload PDF or DOCX resumes, define a job posting, and let the AI pipeline automatically:

- **Parse** resumes using high-fidelity NLP extraction
- **Understand** candidates semantically, not just keyword matching
- **Score** every candidate on 4 objective factors
- **Rank** them from best to least fit, with full score breakdowns

> Try it instantly — the platform has a one-click Demo mode requiring zero signup.

---

## Features

| Feature | Details |
|---|---|
| Multi-Format Parsing | PDF (pdfplumber + pypdf fallback) and Microsoft Word (.docx) |
| NLP Extraction | Name, email, phone via spaCy NER + regex; experience date range merging |
| Skill Matching | 250+ skill taxonomy with alias normalization (K8s -> Kubernetes) |
| Semantic Embeddings | all-MiniLM-L6-v2 (384-dim vectors) for deep contextual relevance |
| Multi-Factor Ranking | Semantic (50%) + Skills (25%) + Experience (15%) + Education (10%) |
| Async Processing | FastAPI BackgroundTasks — uploads return instantly, AI runs in background |
| Live Status Polling | Dashboard auto-refreshes candidate status from processing to done |
| Recruiter Dashboard | React + Tailwind UI with ranked tables, skill breakdowns, score bars |
| JWT Authentication | Secure token-based auth with one-click demo access |
| Docker Ready | PostgreSQL + pgvector + Redis stack for production deployment |

---

## Architecture

`
+------------------------------------------------------+
|          React 18 + TypeScript + Vite                |
|  Tailwind CSS · Heroicons · Axios (via proxy)        |
|                                                      |
|  LoginPage (Demo Button)                             |
|  DashboardPage (Job Cards)                           |
|  JobDetailPage (Ranked Candidates + Score Bars)      |
|  UploadResumePage (Drag & Drop, Progress Bar)        |
+---------------------+--------------------------------+
                      | HTTP via Vite Proxy /api
                      v
+------------------------------------------------------+
|           FastAPI + Uvicorn (Port 8000)              |
|                                                      |
|  /auth/login  /auth/signup  /auth/demo-login         |
|  /jobs/  /jobs/{id}/upload                           |
|  /candidates/{id}/status                            |
|  /jobs/{id}/candidates (ranked, filtered)            |
|  /jobs/{id}/rerank-all                              |
+----------+--------------------------+----------------+
           |                          |
           v                          v
+----------------------+   +----------------------------+
|   AI/NLP Pipeline   |   |   Database Layer           |
|                      |   |                            |
|  spaCy               |   |  SQLite (dev)              |
|  - PhraseMatcher     |   |  PostgreSQL + pgvector     |
|  - PERSON NER        |   |  (prod)                    |
|  - Regex (dates)     |   |                            |
|                      |   |  SQLAlchemy 2.0 ORM        |
|  Sentence-           |   |  Alembic migrations        |
|  Transformers        |   |                            |
|  (MiniLM-L6-v2)      |   |  Tables:                   |
|                      |   |  - users                   |
|  Scoring Engine      |   |  - job_postings            |
|  - Semantic 50%      |   |  - candidates              |
|  - Skills   25%      |   |  - match_scores            |
|  - Exp.     15%      |   |                            |
|  - Edu.     10%      |   |  Celery + Redis (async)    |
+----------------------+   +----------------------------+
`

---

## How It Works

### 1. Resume Upload
Drop a PDF or DOCX onto the job page. The server responds **instantly** — AI processing runs in the background.

### 2. NLP Extraction Pipeline
`
Raw Text --> spaCy PERSON NER  ------------> Name
         |-> Regex patterns    ------------> Email, Phone
         |-> PhraseMatcher (250 skills) ---> Extracted Skills
         |-> Date Range Parser -----------> Experience Years
         --> Keyword Classifier ----------> Education Level
`

### 3. Semantic Embedding
Candidate profile (skills + education + raw text) --> all-MiniLM-L6-v2 --> 384-dim vector
Job posting (title + description + required skills) --> same model --> 384-dim vector

### 4. Multi-Factor Scoring

`
Score = 0.50 x Semantic + 0.25 x Skills + 0.15 x Experience + 0.10 x Education
`

| Factor | Calculation |
|---|---|
| Semantic | Cosine similarity normalized to 0-100 |
| Skills | len(matched) / len(required) x 100 |
| Experience | min(candidate_years / required_years, 1) x 100 |
| Education | Ordinal: 100 / 60 (1 level below) / 20 (2+ levels below) |

---

## Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115 | Async REST API framework |
| uvicorn | 0.30 | ASGI server |
| sqlalchemy | 2.0 | ORM + session management |
| alembic | 1.13 | Schema migrations |
| pydantic-settings | 2.6 | Config + env parsing |
| python-jose[cryptography] | 3.3 | JWT encoding/decoding |
| passlib[bcrypt] + bcrypt | 1.7.4 + 4.0.1 | Password hashing |
| pdfplumber | 0.11 | Primary PDF text extractor |
| pypdf | 5.1 | PDF fallback parser |
| python-docx | 1.1 | DOCX parser |
| spacy | 3.8 | NLP: NER + PhraseMatcher |
| sentence-transformers | latest | Semantic embeddings |
| numpy / scikit-learn | latest | Vector math + cosine similarity |
| celery | 5.4 | Distributed task queue |
| redis | 5.0 | Celery broker + result backend |

### Frontend
| Package | Purpose |
|---|---|
| react + react-dom 18 | UI framework |
| vite 5 | Build tool + dev server + proxy |
| typescript 5 | Type safety |
| tailwindcss | Utility-first styling |
| @heroicons/react | Icon library |
| axios | HTTP client with JWT interceptor |
| react-router-dom | Client-side routing |

---

## Quick Start

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Node.js 18+ and npm
- Git

---

### Step 1 — Clone the Repository

`ash
git clone https://github.com/atharv3046/HireRank.git
cd HireRank
`

---

### Step 2 — Backend Setup

`ash
cd backend

# Install Python dependencies (use --prefer-binary for compiled packages on Windows)
pip install --prefer-binary -r requirements.txt

# Download the spaCy English NLP model
python -m spacy download en_core_web_sm

# Copy environment config (SQLite is pre-configured for local dev)
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux

# Start the API server
uvicorn app.main:app --port 8000
`

- API:        http://localhost:8000
- Swagger UI: http://localhost:8000/docs

> Note: On first resume upload, the all-MiniLM-L6-v2 model (~90MB) is downloaded and cached automatically.

---

### Step 3 — Frontend Setup

Open a new terminal:

`ash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev -- --port 5173
`

- App: http://localhost:5173

---

### Step 4 — Try the Demo

1. Open http://localhost:5173
2. Click the blue "Enter Demo Dashboard" button (no signup needed)
3. A pre-seeded Senior Python Engineer job posting is ready
4. Click the job -> Upload Resume -> drop in a PDF or DOCX
5. Watch candidates get ranked in real time as the AI pipeline runs

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /auth/signup | No | Register a new recruiter account |
| POST | /auth/login | No | Login and get JWT token |
| POST | /auth/demo-login | No | One-click demo access |
| GET | /jobs/ | Yes | List all job postings |
| POST | /jobs/ | Yes | Create a job posting |
| GET | /jobs/{id} | Yes | Get a specific job |
| PUT | /jobs/{id} | Yes | Update a job |
| DELETE | /jobs/{id} | Yes | Delete a job |
| POST | /jobs/{id}/upload | Yes | Upload a resume (async pipeline) |
| GET | /jobs/{id}/candidates | Yes | Get ranked candidates |
| POST | /jobs/{id}/rerank-all | Yes | Re-score all candidates |
| GET | /candidates/{id}/status | Yes | Poll processing status |
| GET | /health | No | Health check |

Full interactive docs at /docs (Swagger UI).

---

## Running Tests

`ash
cd backend
python -m pytest tests/ -v
`

`
tests/test_scoring.py     -- 19 tests (SkillsScore, ExperienceScore, EducationScore)
tests/test_extraction.py  -- 14 tests (Contact, Skills, Experience, Education NLP)

================================ 33 passed ================================
`

---

## Docker Deployment

For a production-ready stack with PostgreSQL + pgvector and Redis:

`ash
# From project root
docker-compose up -d
`

This starts:
- postgres (with pgvector extension on port 5432)
- redis (on port 6379)

Then update backend/.env:

`env
DATABASE_URL=postgresql://resumeuser:resumepass@localhost:5432/resumedb
EAGER_TASKS=false
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
`

Start a Celery worker:

`ash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
`

---

## Project Structure

`
HireRank/
+-- backend/
|   +-- app/
|   |   +-- core/         # Config, DB engine, security (JWT + bcrypt)
|   |   +-- models/       # SQLAlchemy ORM models
|   |   +-- schemas/      # Pydantic request/response schemas
|   |   +-- routers/      # FastAPI routers (auth, jobs, candidates, scoring)
|   |   +-- services/     # AI services (extraction, embeddings, scoring)
|   |   +-- tasks/        # Celery tasks + pipeline orchestration
|   |   +-- data/         # skills_taxonomy.json (250+ skills + aliases)
|   |   +-- main.py       # App factory, startup seed, demo endpoint
|   +-- tests/            # pytest test suite + sample resumes
|   +-- uploads/          # Resume file storage
|   +-- requirements.txt
|   +-- .env.example
|
+-- frontend/
|   +-- src/
|       +-- api/          # Axios client (JWT interceptor, typed API calls)
|       +-- context/      # AuthContext (JWT state, localStorage)
|       +-- components/   # Navbar, ProtectedRoute, StatusBadge, ScoreBar, SkillTag
|       +-- pages/        # Login, Signup, Dashboard, JobDetail, UploadResume
|
+-- docker-compose.yml    # PostgreSQL + pgvector + Redis
+-- README.md
`

---

## Contributing

1. Fork the repository
2. Create a feature branch: git checkout -b feature/your-feature-name
3. Commit your changes: git commit -m 'feat: add your feature'
4. Push to the branch: git push origin feature/your-feature-name
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

Built with FastAPI, React, and Sentence-Transformers.
Star this repo if HireRank was useful to you!
