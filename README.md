<div align="center">

# ⚡ HireRank — AI Recruitment & Resume Screening Platform

<p align="center">
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/FastAPI.svg" height="45" alt="FastAPI" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/React-Dark.svg" height="45" alt="React" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TypeScript.svg" height="45" alt="TypeScript" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/Python-Dark.svg" height="45" alt="Python" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/TailwindCSS-Dark.svg" height="45" alt="TailwindCSS" />
  <img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/PostgreSQL-Dark.svg" height="45" alt="PostgreSQL" />
</p>

**Autonomous, Explainable, Multi-Factor AI Candidate Ranking & NLP Screening Engine**

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%20%7C%203.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![spaCy](https://img.shields.io/badge/spaCy-3.8-09A3D5?style=for-the-badge&logo=spacy&logoColor=white)](https://spacy.io)
[![HuggingFace Transformers](https://img.shields.io/badge/Sentence--Transformers-all--MiniLM--L6--v2-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

[✨ Features](#-key-features) • [🔄 Architecture & Flowchart](#-system-architecture--flowchart) • [📊 Multi-Factor Scoring](#-multi-factor-scoring-formula) • [🛠️ Tech Stack](#-tech-stack-details) • [📂 Repository Structure](#-repository-structure) • [🚀 Quick Start](#-quick-start) • [📡 API Reference](#-api-endpoints)

</div>

---

## 📌 Overview

**HireRank** is an enterprise-grade AI resume screening and ranking platform designed to streamline talent acquisition. Instead of primitive keyword search (which discards qualified candidates with alternative phrasing), HireRank leverages **spaCy NER entity extraction, rule-based temporal parsing, taxonomy-driven phrase matching, and Sentence-Transformer vector embeddings** (`all-MiniLM-L6-v2`) to deeply understand candidates' trajectories and objectively rank them against job descriptions.

---

## ✨ Key Features

- 📑 **Universal Resume Ingestion**: High-fidelity text extraction supporting `.pdf` (with `pdfplumber` layout parser and `pypdf` fallback) and Microsoft Word `.docx` documents.
- 🧠 **Dual NLP Extraction Pipeline**:
  - **Entity Recognition (NER)**: Identifies candidate name and contact information.
  - **Skills Taxonomy & Normalization**: 250+ canonical skills with automatic alias matching (e.g., `K8s` $\rightarrow$ `Kubernetes`, `ReactJS` $\rightarrow$ `React`).
  - **Date Range Parsing & Overlap Merging**: Accurate career duration calculation preventing double-counting simultaneous positions.
  - **Education Level Ordinal Hierarchy**: Prioritizes PhD $\rightarrow$ Master's $\rightarrow$ Bachelor's $\rightarrow$ Associate's.
- 🔢 **Contextual Semantic Matching**: Transforms candidate experience and job descriptions into 384-dimensional dense vectors to calculate true cosine semantic similarity.
- 📊 **Explainable 0–100 Multi-Factor Scoring**: Transparent weighted composite scores with breakdown across Semantic fit, Skills match, Experience years, and Education level.
- 🎨 **Modern TalentRank UI**:
  - Sleek layout with sticky Sidebar navigation.
  - Real-time animated **Processing Queue** with per-file progress indicators.
  - Interactive Candidate slide-over drawer with **Candidate vs. Requirements** side-by-side comparison tables.
  - Filterable by skill keywords and interactive minimum match score slider.
- ⚡ **Asynchronous Background Processing**: High-throughput file uploads respond immediately while NLP pipeline executes in the background.
- 🔑 **Stateless JWT Security**: Industry standard authentication with instant one-click recruiter demo access.

---

## 🔄 System Architecture & Flowchart

### 🧩 End-to-End Processing Pipeline

```mermaid
flowchart TD
    classDef startEnd fill:#4F46E5,stroke:#312E81,stroke-width:2px,color:#fff;
    classDef process fill:#F3F4F6,stroke:#4F46E5,stroke-width:2px,color:#111827;
    classDef storage fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#1E3A8A;
    classDef ml fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#065F46;

    A([📄 Resume Upload: PDF / DOCX]) --> B[FastAPI BackgroundTasks Queue]:::process
    B --> C[File Storage & UUID Preservation]:::storage
    
    subgraph Extraction_Stage [🔍 1. Extraction Pipeline]
        C --> D[pdfplumber / python-docx Parsing]:::process
        D --> E[Raw Text Normalization]:::process
        E --> F[spaCy NER: Name & Contact]:::ml
        E --> G[PhraseMatcher: 250+ Skills Taxonomy]:::ml
        E --> H[Regex Date Parser: Overlap Merged Years]:::process
        E --> I[Education Keyword Classifier]:::process
    end

    subgraph Embedding_Stage [🧠 2. Vector Embedding]
        F & G & H & I --> J[Candidate Profile Synthesis]:::process
        J --> K[Sentence-Transformers: all-MiniLM-L6-v2]:::ml
        K --> L[(384-dim Vector Embedding)]:::storage
    end

    subgraph Scoring_Stage [📊 3. Multi-Factor Scoring Engine]
        L --> M[Cosine Semantic Similarity 50%]:::ml
        G --> N[Taxonomy Skill Match Ratio 25%]:::process
        H --> O[Experience Duration Match 15%]:::process
        I --> P[Education Hierarchy Match 10%]:::process
        M & N & O & P --> Q[Weighted Score Normalization 0-100]:::ml
    end

    Q --> R[(Database: Candidates & Match Scores)]:::storage
    R --> S([💻 TalentRank UI: Ranked Dashboard & Comparisons]):::startEnd
```

---

## 📊 Multi-Factor Scoring Formula

HireRank replaces opaque "black-box" hiring algorithms with a mathematically transparent, **4-pillar composite scoring model** yielding an explainable score between $0.0$ and $100.0$:

$$\boxed{\text{Final Overall Score} = 0.50 \cdot S_{\text{semantic}} + 0.25 \cdot S_{\text{skills}} + 0.15 \cdot S_{\text{experience}} + 0.10 \cdot S_{\text{education}}}$$

---

### 1️⃣ Semantic Similarity ($S_{\text{semantic}}$ — 50% Weight)
Measures the deep conceptual relevance between the candidate's contextual background and the job requirements.
- **Model**: `all-MiniLM-L6-v2` generates 384-dimensional dense normalized embeddings: $\vec{u}_{\text{candidate}}, \vec{v}_{\text{job}} \in \mathbb{R}^{384}$.
- **Cosine Similarity**:
  $$\text{CosineSim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}, \quad \text{where } \text{CosineSim} \in [-1.0, 1.0]$$
- **Normalization to $[0, 100]$**:
  $$S_{\text{semantic}} = \left(\frac{\text{CosineSim}(\vec{u}, \vec{v}) + 1}{2}\right) \times 100$$

### 2️⃣ Skills Match Ratio ($S_{\text{skills}}$ — 25% Weight)
Evaluates canonical technical competencies matched through the 250+ skill taxonomy:
$$S_{\text{skills}} = \begin{cases} 
100.0 & \text{if } |\text{Required Skills}| = 0 \\ 
\min\left(100.0, \dfrac{|\text{Extracted Skills} \cap \text{Required Skills}|}{|\text{Required Skills}|} \times 100\right) & \text{otherwise}
\end{cases}$$
*Aliases are mapped prior to set intersection (e.g., `['K8s', 'ReactJS']` $\rightarrow$ `{'Kubernetes', 'React'}`).*

### 3️⃣ Experience Fit ($S_{\text{experience}}$ — 15% Weight)
Computes professional tenure from non-overlapping career date intervals:
$$S_{\text{experience}} = \begin{cases} 
100.0 & \text{if } \text{Years}_{\text{required}} \le 0 \\ 
\min\left(1.0, \dfrac{\text{Years}_{\text{candidate}}}{\text{Years}_{\text{required}}}\right) \times 100 & \text{otherwise}
\end{cases}$$

### 4️⃣ Education Hierarchy Fit ($S_{\text{education}}$ — 10% Weight)
Evaluates formal qualification against an ordinal ranking: $\text{PhD} (5) > \text{Master's} (4) > \text{Bachelor's} (3) > \text{Associate} (2) > \text{High School} (1)$:

$$S_{\text{education}} = \begin{cases} 
100.0 & \text{if } \text{Level}_{\text{candidate}} \ge \text{Level}_{\text{required}} \text{ or Requirement is None} \\ 
60.0 & \text{if } \text{Level}_{\text{candidate}} = \text{Level}_{\text{required}} - 1 \quad \text{(1 level below)} \\ 
20.0 & \text{if } \text{Level}_{\text{candidate}} \le \text{Level}_{\text{required}} - 2 \quad \text{(2+ levels below)}
\end{cases}$$

---

### 🎯 Score Tier Interpretation

| Score Range | Tier Classification | Visual Indicator | Recommended Recruiter Action |
| :---: | :---: | :---: | :--- |
| **85 – 100** | 🟢 **High Match / Top Tier** | Green Glow Badge | Immediate shortlist for technical interview |
| **70 – 84** | 🟡 **Good Fit / Qualified** | Yellow Badge | Proceed to recruiter screening round |
| **50 – 69** | 🟠 **Moderate Match** | Orange Badge | Review missing skill list & secondary qualifications |
| **< 50** | 🔴 **Low Fit / Mismatch** | Red Badge | Candidate lacks fundamental prerequisites |

---

## 🛠️ Tech Stack Details

### 🖥️ Backend Infrastructure

| Technology | Version | Purpose | Architectural Rationale |
| :--- | :---: | :--- | :--- |
| **Python** | `3.10 - 3.13` | Core Runtime | Robust ecosystem for modern AI/NLP tools and typing support. |
| **FastAPI** | `0.115.0` | REST API Engine | High-throughput asynchronous ASGI execution with native OpenAPI docs. |
| **Uvicorn** | `0.30.0` | ASGI Web Server | Lightning-fast asynchronous server built on `uvloop` and `httptools`. |
| **SQLAlchemy** | `2.0.30` | ORM & DB Engine | Next-gen mapped models with support for SQLite (dev) and Postgres (prod). |
| **Alembic** | `1.13.1` | Schema Migrations | Controlled, declarative schema evolution and migration tracking. |
| **Pydantic v2** | `2.6.0+` | Validation & Settings | High-speed data parsing and strict typing for requests and responses. |
| **python-jose** | `3.3.0` | JWT Cryptography | RFC 7519 compliant JSON Web Token authentication with HS256 encryption. |
| **passlib + bcrypt** | `4.0.1` | Secure Password Hashing | Salted cryptographic key derivation protecting user passwords. |

---

### 🧠 NLP, Parsing & Vector Intelligence

| Library | Version | Purpose | Technical Role |
| :--- | :---: | :--- | :--- |
| **spaCy** | `3.8.0` | Linguistic Engine & NER | Industrial-strength NER for names and tokenized `PhraseMatcher` rules. |
| **en_core_web_sm** | `3.8.0` | English Language Model | Pretrained CNN weights for entity recognition and syntax dependency parsing. |
| **sentence-transformers**| `latest` | Embedding Computation | Generates 384-dimensional dense semantic vectors using PyTorch. |
| **all-MiniLM-L6-v2** | `latest` | Embedding Transformer | 5x faster than BERT-base with 99.2% retained semantic benchmark quality. |
| **pdfplumber** | `0.11.0` | Primary PDF Parser | Visual layout-aware extraction respecting column alignment and tables. |
| **pypdf** | `5.1.0` | Fallback PDF Parser | High-speed fallback reader for complex or non-standard PDF formats. |
| **python-docx** | `1.1.2` | DOCX Document Parser | Native OpenXML parser extracting formatted text and paragraphs. |
| **scikit-learn & numpy**| `latest` | Vector Mathematics | High-speed vectorized cosine similarity and array linear algebra. |

---

### 🎨 Frontend Architecture

| Technology | Version | Purpose | Highlights |
| :--- | :---: | :--- | :--- |
| **React** | `18.3.1` | UI Library | Concurrent mode rendering with reusable component hierarchy. |
| **TypeScript** | `5.0+` | Type Safety | End-to-end typed contracts matching backend Pydantic models. |
| **Vite** | `5.4.0` | Build Tool & Dev Server | Sub-second HMR and automated proxying `/api` $\rightarrow$ `http://localhost:8000`. |
| **Tailwind CSS** | `3.4.0` | Design System | Utility-first styling with custom keyframe animations (`slide-in`, `fade-up`). |
| **Heroicons** | `2.1.0` | Iconography | Clean, SVG iconography crafted by the Tailwind team. |
| **Axios** | `1.7.0` | HTTP Client | Request/Response interceptors with automatic Bearer token injection. |
| **React Router** | `6.23.0` | Client-side Routing | Declarative nested routing with `ProtectedRoute` guards. |

---

## 📂 Repository Structure

```
HireRank/
│
├── 📁 backend/                             # FastAPI Application Backend
│   ├── 📁 app/
│   │   ├── 📁 core/                        # System Configurations & Security
│   │   │   ├── 📄 config.py                # Pydantic BaseSettings & Environment Variables
│   │   │   ├── 📄 database.py              # SQLAlchemy DB Engine & SessionLocal Factory
│   │   │   └── 📄 security.py              # Bcrypt Password Hashing & JWT Token Logic
│   │   │
│   │   ├── 📁 models/                      # SQLAlchemy 2.0 ORM Declarative Models
│   │   │   ├── 📄 user.py                  # Recruiter User Accounts
│   │   │   ├── 📄 job_posting.py           # Job Roles, Required Skills & Experience Req.
│   │   │   ├── 📄 candidate.py             # Candidate Profile, Raw Text & 384-dim Embeddings
│   │   │   └── 📄 match_score.py           # Multi-Factor Score Breakdowns & Unique Constraints
│   │   │
│   │   ├── 📁 schemas/                     # Pydantic Request/Response DTOs
│   │   │   ├── 📄 auth.py                  # Login, Signup & TokenResponse Models
│   │   │   ├── 📄 job_posting.py           # Job Creation & Detail Schemas
│   │   │   ├── 📄 candidate.py             # Candidate Data Transfer Objects
│   │   │   └── 📄 scoring.py               # MatchScore Read & Rerank Response Schemas
│   │   │
│   │   ├── 📁 routers/                     # FastAPI Endpoint Route Handlers
│   │   │   ├── 📄 auth.py                  # /auth/signup, /auth/login, /auth/demo-login
│   │   │   ├── 📄 jobs.py                  # /jobs/ CRUD Operations & Filtering
│   │   │   └── 📄 candidates.py            # /jobs/{id}/upload, /candidates/{id}/status
│   │   │
│   │   ├── 📁 services/                    # Machine Learning & NLP Core Engines
│   │   │   ├── 📄 extraction.py            # ResumeExtractor (NER, Date Parsing, PhraseMatcher)
│   │   │   ├── 📄 embeddings.py            # EmbeddingService (all-MiniLM-L6-v2 Singleton)
│   │   │   └── 📄 scoring.py               # MatchScorer (Multi-Factor Scoring Formula)
│   │   │
│   │   ├── 📁 tasks/                       # Task Scheduling & Pipelines
│   │   │   ├── 📄 resume_tasks.py          # End-to-end Async Extract -> Embed -> Score Pipeline
│   │   │   └── 📄 celery_app.py            # Distributed Celery Configuration
│   │   │
│   │   ├── 📁 data/
│   │   │   └── 📄 skills_taxonomy.json     # 250+ Canonical Technical Skills & Known Aliases
│   │   └── 📄 main.py                      # FastAPI App Instantiation, CORS & Seed Endpoint
│   │
│   ├── 📁 tests/                           # Pytest Automated Test Suite
│   │   ├── 📄 test_extraction.py           # Tests for Contact, Skills, Dates, and Education NLP
│   │   └── 📄 test_scoring.py              # Tests for 4-factor scoring calculations
│   │
│   ├── 📁 uploads/                         # Local Resume File Storage
│   ├── 📄 requirements.txt                 # Backend Python Dependencies
│   ├── 📄 pytest.ini                       # Test Runner Configuration
│   └── 📄 .env.example                     # Environment Template
│
├── 📁 frontend/                            # React 18 + TypeScript Client Application
│   ├── 📁 src/
│   │   ├── 📁 api/
│   │   │   └── 📄 client.ts                # Axios Instance with JWT Interceptors & Typed Methods
│   │   ├── 📁 context/
│   │   │   └── 📄 AuthContext.tsx          # Authentication Global State & LocalStorage Management
│   │   ├── 📁 components/
│   │   │   ├── 📄 Sidebar.tsx              # Modern Sidebar Navigation Bar
│   │   │   ├── 📄 ProtectedRoute.tsx       # Auth Guard for Protected Dashboards
│   │   │   ├── 📄 ScoreBar.tsx             # Animated Score Indicator Bars
│   │   │   ├── 📄 SkillTag.tsx             # Colored Skill Chips
│   │   │   └── 📄 StatusBadge.tsx          # Real-time Processing Status Badges
│   │   ├── 📁 pages/
│   │   │   ├── 📄 LandingPage.tsx          # Hero Section, Live Demo CTA, Features & Architecture
│   │   │   ├── 📄 LoginPage.tsx            # Split-Screen Recruiter Login & Demo Sign-In
│   │   │   ├── 📄 SignupPage.tsx           # Recruiter Registration Page
│   │   │   ├── 📄 DashboardPage.tsx        # Active Job Postings, Stats Counters & New Job Modal
│   │   │   ├── 📄 JobDetailPage.tsx        # Ranked Candidates Table & Slide-over Comparison Drawer
│   │   │   └── 📄 UploadPage.tsx           # Multi-file Drag & Drop Processing Queue with Progress Bars
│   │   ├── 📄 App.tsx                      # Root Router Configuration
│   │   ├── 📄 main.tsx                     # React DOM Entrypoint
│   │   └── 📄 index.css                    # Tailwind Directives & Custom Animation Keyframes
│   │
│   ├── 📄 package.json                     # Frontend Dependencies & Scripts
│   ├── 📄 tsconfig.json                    # TypeScript Configuration
│   ├── 📄 tailwind.config.js               # Tailwind Color Palette & Custom Animations
│   └── 📄 vite.config.ts                   # Vite Server & Backend Proxy Setup
│
├── 📄 docker-compose.yml                   # Containerized PostgreSQL (pgvector) + Redis Stack
├── 📄 .gitignore                           # Git Exclusion Rules
└── 📄 README.md                            # Comprehensive Documentation
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** & **npm**
- **Git**

---

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/atharv3046/HireRank.git
cd HireRank
```

---

### 2️⃣ Backend Setup

```bash
cd backend

# Install Python dependencies (use --prefer-binary on Windows)
pip install --prefer-binary -r requirements.txt

# Download spaCy English linguistic model
python -m spacy download en_core_web_sm

# Configure environment variables
copy .env.example .env     # Windows
# cp .env.example .env      # macOS/Linux

# Launch FastAPI Server
uvicorn app.main:app --port 8000
```
- **API Server**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`

---

### 3️⃣ Frontend Setup

In a separate terminal:

```bash
cd frontend

# Install npm packages
npm install

# Start Vite Development Server
npm run dev -- --port 5173
```
- **Web Application**: `http://localhost:5173`

---

### 4️⃣ One-Click Demo Mode
1. Open `http://localhost:5173`.
2. Click **⚡ Enter Demo Dashboard** on the login page (or use the Hero CTA).
3. Open the pre-seeded **Senior Python Engineer** role.
4. Click **Upload Resume** to test real-time parsing, vector embedding, and score generation!

---

## 📡 API Endpoints

| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/demo-login` | Generates a demo recruiter session & token | ❌ |
| `POST` | `/auth/signup` | Registers a new recruiter account | ❌ |
| `POST` | `/auth/login` | Authenticates recruiter and returns JWT | ❌ |
| `GET` | `/jobs/` | Lists all recruiter's job postings | ✅ |
| `POST` | `/jobs/` | Creates a new job posting with skill requirements | ✅ |
| `GET` | `/jobs/{id}` | Fetches detailed job specifications | ✅ |
| `PUT` | `/jobs/{id}` | Updates job criteria and requirements | ✅ |
| `DELETE`| `/jobs/{id}` | Removes job posting and associated candidates | ✅ |
| `POST` | `/jobs/{id}/upload` | Async multipart resume upload & background processing | ✅ |
| `GET` | `/jobs/{id}/candidates` | Retrieves ranked candidates with full score breakdowns | ✅ |
| `POST` | `/jobs/{id}/rerank-all` | Re-computes embeddings and scores across all candidates | ✅ |
| `GET` | `/candidates/{id}/status`| Real-time polling endpoint for candidate processing state | ✅ |

---

## 🧪 Running Automated Tests

Run the complete test suite with pytest:

```bash
cd backend
python -m pytest tests/ -v
```

```
tests/test_scoring.py     -- 19 passed (Skills, Experience, and Education Scorer tests)
tests/test_extraction.py  -- 14 passed (Contact, Skills Taxonomy, Experience NLP tests)

============================== 33 passed in 2.85s ==============================
```

---

## 🐳 Docker Deployment

To run a production PostgreSQL (with `pgvector`) and Redis stack:

```bash
docker-compose up -d
```

Update `backend/.env`:
```env
DATABASE_URL=postgresql://resumeuser:resumepass@localhost:5432/resumedb
EAGER_TASKS=false
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

Start the Celery asynchronous worker:
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ for modern talent acquisition teams.</sub>
</div>
