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

[✨ Features](#-key-features) • [🔄 Architecture & Flowchart](#-system-architecture--flowchart) • [📊 Hybrid Scoring Engine](#-5-pillar-hybrid-scoring-formula) • [🛠️ Tech Stack](#-tech-stack-details) • [📂 Repository Structure](#-repository-structure) • [🚀 Quick Start](#-quick-start) • [📡 API Reference](#-api-endpoints)

</div>

---

## 📌 Overview

**HireRank** is an enterprise-grade AI resume screening, ranking, and talent intelligence platform designed to replace legacy keyword-matching ATS systems. 

Instead of naive substring search (which overlooks qualified candidates with non-standard phrasing and rewards resume keyword stuffing), HireRank combines:
- **spaCy Named Entity Recognition (NER)** for contact and biographical detail extraction.
- **Rule-based temporal timeline parsing** for accurate, non-overlapping career tenure calculations.
- **Taxonomy-driven canonical phrase matching** (250+ tech skills with alias normalization).
- **Sentence-Transformers dense vector embeddings** (`all-MiniLM-L6-v2`) for deep semantic context comparison.
- **Explainable Hybrid Ranking Engine (`HybridScorer`)** with must-have skill capping, trapezoidal experience scoring, and zero black-box scoring.

HireRank also includes a **Guest Instant Triage Mode** (screen up to 5 resumes with zero login required), **AI-driven Technical Assessments**, **Recruiter Candidate Kanban Pipeline**, and **Team Workspace Collaboration**.

---

## ✨ Key Features

- 📑 **Universal Resume Ingestion**: High-fidelity text extraction supporting `.pdf` (with layout-aware `pdfplumber` and `pypdf` fallback) and `.docx` documents.
- 🧠 **Dual NLP Extraction Pipeline**:
  - **Entity Recognition (NER)**: Extracts candidate name, email, and phone number.
  - **Skills Taxonomy & Normalization**: 250+ canonical skills with automatic alias resolution (e.g., `K8s` $\rightarrow$ `Kubernetes`, `React.js` $\rightarrow$ `React`).
  - **Date Range Parsing & Overlap Merging**: Accurate career tenure calculation preventing double-counting of simultaneous positions.
  - **Education Level Ordinal Hierarchy**: Recognizes PhD $\rightarrow$ Master's $\rightarrow$ Bachelor's $\rightarrow$ Associate $\rightarrow$ High School.
- 🔢 **Standalone HybridScorer Engine**:
  - **35% Semantic Similarity**: 384-dimensional dense normalized embeddings via `all-MiniLM-L6-v2`.
  - **30% Skill Coverage**: Canonical set intersection with required and preferred skills.
  - **20% Trapezoidal Experience Fit**: 100% credit inside target experience band, gentle linear falloff outside.
  - **10% Title Relevance**: Semantic alignment between target job title and extracted candidate title.
  - **05% Education Match**: Ordinal degree requirement fit.
  - **Must-Have Skill Hard Cap (59.9%)**: Candidates missing any mandatory skill are strictly capped at 59.9 (Potential tier), preventing unqualified candidates from receiving top scores.
  - **Manual Review Safeguard**: Corrupted or unparseable files receive `needs_manual_review=True` and Tier `Needs Review` with no hallucinated scores.
- ⚡ **Guest Instant Triage Flow**: Screen up to 5 resumes instantly with live animated progress, tier breakdown, and one-click account creation to claim candidates into a persistent workspace.
- 🎯 **Candidate Interviews**: Build a role-specific interview from an assessment blueprint, email each candidate a secure expiring link, autosave written responses, let candidates book a live interview time, and review responses with a rating, decision, and recruiter notes. Recruiters provide the Google Meet, Zoom, or other HTTPS meeting URL for each available slot.
- 📝 **Assessment Builder**: Create role-specific assessments, draft questions from a job description, generate technical questions with OpenAI when configured (with a deterministic fallback), and preview estimated pass rates before inviting candidates.
- 📋 **Candidate Pipeline & Kanban**: Visual stage tracking (`Screened`, `Interview`, `Offer`, `Hired`, `Rejected`) with instant status transitions.
- 🕶️ **Blind Screening**: Hide selected identifying details during early review, with candidate details revealed after the configured pipeline stage.
- 🔎 **Evidence-Based Review**: Inspect resume excerpts supporting extracted skills and score components rather than relying on an unexplained score alone.
- ⚖️ **Per-Job Score Weights**: Adjust the scoring factor weights for a role and rerank its candidates against the updated criteria.
- 🧭 **Career Pattern Signals**: Surface role progression, tenure summaries, and short-tenure indicators as additional context for recruiter review.
- 🛡️ **Adversarial Resume Checks**: Detect suspicious instruction-like or hidden text in uploaded resumes, sanitize relevant text, and flag files for recruiter review.
- 🆚 **Candidate Comparison**: Compare selected candidates side by side, including score deltas, skill overlap, and evidence.
- ✉️ **Candidate Communications**: Generate interview questions and compliant, templated rejection messages; send invitations and rejection emails when email delivery is configured.
- 📤 **Recruiter Operations**: Filter and manage candidate lists, perform bulk actions, export candidate and score data as CSV, and review dashboard and job-level statistics.
- 👥 **Team & Workspace Management**: Manage company profiles, invite and remove workspace members, assign roles, and configure team access.
- 🔐 **Authentication & Access Control**: Password-based signup/login, Google OAuth, refreshable JWT sessions, protected recruiter routes, role-aware team access, and demo sign-in.
- 🎨 **Recruiter and Candidate Experiences**: Responsive React and TypeScript interfaces for public guest screening, recruiter workflows, candidate interview links, team settings, and legal pages.

### Candidate screening and hiring workflow

1. Create a job with its title, description, required skills, experience and education criteria, and optional scoring weights.
2. Upload PDF or DOCX resumes to the job, or start a guest screening session without signing in. Guest screening accepts up to five resumes and is rate limited.
3. HireRank extracts resume text and candidate details, calculates the explainable score, and presents score breakdowns, matched/missing skills, and evidence. Unreadable files are sent for manual review instead of receiving an invented score.
4. Review candidates in the ranked list, compare candidates, enable blind screening, inspect career-pattern and adversarial flags, update pipeline stages, and export results.
5. Build an assessment, invite candidates to complete it through secure expiring links, review responses, and optionally schedule a live interview using a recruiter-provided meeting URL.
6. Claim guest-session candidates into a recruiter workspace to continue reviewing them after signing in.

Resume files are processed from temporary storage and removed after text extraction; candidate screening data and extracted text are retained in the configured database. Guest-session records are subject to automated retention cleanup.

HireRank is a recruiter decision-support tool. Scores, extracted details, and automated flags should be reviewed by a person and should not be used as the sole basis for an employment decision.

---

## 🔄 System Architecture & Flowchart

```mermaid
flowchart TD
    classDef startEnd fill:#0284c7,stroke:#0369a1,stroke-width:2px,color:#fff;
    classDef process fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef storage fill:#0f172a,stroke:#64748b,stroke-width:1.5px,color:#94a3b8;
    classDef ml fill:#064e3b,stroke:#34d399,stroke-width:1.5px,color:#ecfdf5;

    A([📄 Resume Upload: PDF / DOCX]) --> B[FastAPI Upload Handler]:::process
    B --> C[Temporary File Storage]:::storage
    
    subgraph Extraction_Stage [🔍 1. NLP Extraction Pipeline]
        C --> D[pdfplumber / python-docx Parser]:::process
        D --> E[Raw Text Normalization]:::process
        D --> D2[Delete Temporary Upload]:::process
        E --> F[spaCy NER: Name & Contact]:::ml
        E --> G[PhraseMatcher: 250+ Skills Taxonomy]:::ml
        E --> H[Regex Date Parser: Overlap Merged Years]:::process
        E --> I[Education Hierarchy Classifier]:::process
    end

    subgraph Embedding_Stage [🧠 2. Vector Embedding Engine]
        F & G & H & I --> J[Candidate Profile Synthesis]:::process
        J --> K[Sentence-Transformers: all-MiniLM-L6-v2]:::ml
        K --> L[(384-dim Dense Embeddings)]:::storage
    end

    subgraph Scoring_Stage [📊 3. HybridScorer Engine]
        L --> M[Semantic Cosine Similarity: 35%]:::ml
        G --> N[Taxonomy Skill Coverage: 30%]:::process
        H --> O[Trapezoidal Experience Fit: 20%]:::process
        J --> P[Job Title Relevance: 10%]:::process
        I --> Q[Education Requirement Fit: 5%]:::process
        M & N & O & P & Q --> R{Must-Have Skills Present?}:::process
        R -- Yes --> S[Weighted Score Normalization 0-100]:::ml
        R -- No --> T[Apply Hard Cap at 59.9% Potential]:::process
    end

    S & T --> U[(Database: SQLite / PostgreSQL)]:::storage
    U --> V([💻 HireRank Dashboard: Ranked Candidates & Breakdown]):::startEnd
```

---

## 📊 5-Pillar Hybrid Scoring Formula

HireRank uses an explainable, 5-pillar composite scoring formula producing an objective score between $0.0$ and $100.0$:

$$\boxed{\text{Composite Score} = 0.35 \cdot S_{\text{semantic}} + 0.30 \cdot S_{\text{skills}} + 0.20 \cdot S_{\text{experience}} + 0.10 \cdot S_{\text{title}} + 0.05 \cdot S_{\text{education}}}$$

These are the default weights. Recruiters can customize the factor weights per job and rerank candidates; the saved score breakdown makes each factor visible.

---

### 1️⃣ Semantic Similarity ($S_{\text{semantic}}$ — 35% Weight)
Measures conceptual relevance between candidate background and job requirements:
- **Model**: `all-MiniLM-L6-v2` produces unit-normalized vectors $\vec{u}_{\text{candidate}}, \vec{v}_{\text{job}} \in \mathbb{R}^{384}$.
- **Cosine Similarity**:
  $$\text{CosineSim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}, \quad \text{CosineSim} \in [-1.0, 1.0]$$
- **Normalized to $[0, 100]$**:
  $$S_{\text{semantic}} = \left(\frac{\text{CosineSim}(\vec{u}, \vec{v}) + 1}{2}\right) \times 100$$

### 2️⃣ Skills Match Ratio ($S_{\text{skills}}$ — 30% Weight)
Matches canonical skills and aliases against required and preferred criteria:
- Required skills are evaluated first with alias resolution (`['K8s', 'ReactJS']` $\rightarrow$ `{'Kubernetes', 'React'}`).
- Missing any required must-have skill activates the **Must-Have Hard Cap**:
  $$\text{Final Score} \le 59.9 \quad (\text{Tier} = \text{Potential})$$

### 3️⃣ Experience Fit ($S_{\text{experience}}$ — 20% Weight)
Uses a **trapezoidal target band** $[\text{min\_years}, \text{max\_years}]$:
- Inside target band $[\text{min}, \text{max}] \rightarrow 100\%$
- Below $\text{min\_years} \rightarrow$ Linear falloff to 0
- Above $\text{max\_years} \rightarrow$ Gentle overqualification penalty (capped at 50%)

### 4️⃣ Title Relevance ($S_{\text{title}}$ — 10% Weight)
Calculates token overlap and semantic alignment between target title and detected candidate title.

### 5️⃣ Education Hierarchy Fit ($S_{\text{education}}$ — 5% Weight)
Evaluates formal qualification against an ordinal scale:
$$\text{PhD} (5) > \text{Master's} (4) > \text{Bachelor's} (3) > \text{Associate} (2) > \text{High School} (1)$$

---

### 🎯 Score Tiers

| Score Range | Tier Classification | Badge | Action |
| :---: | :---: | :---: | :--- |
| **$\ge 75$** | 🟢 **Strong** | Emerald | Immediate shortlist for interview |
| **$55 – 74.9$** | 🟡 **Potential** | Amber | Proceed to screening round / review missing skills |
| **$< 55$** | 🔴 **Low** | Rose | Fundamental mismatch |
| **N/A** | ⚪ **Needs Review** | Purple | File unparseable or corrupted (zero hallucinated score) |

---

## 🛠️ Tech Stack Details

### 🖥️ Backend Infrastructure

| Technology | Purpose | Architectural Role |
| :--- | :--- | :--- |
| **Python 3.10–3.13** | Core Language | AI/NLP ecosystem and type annotations |
| **FastAPI** | REST API Engine | Asynchronous ASGI endpoints with auto OpenAPI docs |
| **Uvicorn** | Web Server | High-performance ASGI server |
| **SQLAlchemy 2.0** | ORM & DB Engine | Declarative models supporting SQLite and PostgreSQL |
| **Alembic** | DB Migrations | Controlled schema evolution |
| **Pydantic v2** | Data Validation | Request/response DTOs and strict schema validation |
| **spaCy (en_core_web_sm)**| NLP & NER | Candidate name, phone, email, and skill extraction |
| **sentence-transformers** | Embeddings | 384-dimensional dense vectors via `all-MiniLM-L6-v2` |
| **pdfplumber & pypdf** | PDF Ingestion | Layout-aware text extraction with fallback |
| **python-docx** | DOCX Ingestion | OpenXML document parsing |
| **Resend API / SMTP** | Email Delivery | Transactional candidate invite and alert emails |

---

### 🎨 Frontend Architecture

| Technology | Purpose | Highlights |
| :--- | :--- | :--- |
| **React 18.3** | UI Framework | Component-driven concurrent rendering |
| **TypeScript 5.0** | Type Safety | Strongly typed API contracts matching Pydantic schemas |
| **Vite 5.4** | Build Tool | Sub-second Hot Module Replacement (HMR) |
| **Tailwind CSS 3.4** | Styling | Dark glassmorphism, responsive grid layouts |
| **Framer Motion** | Animations | Smooth modal slide-overs, progress bars, transitions |
| **@react-oauth/google**| Authentication | Google One-Tap & Sign-In integration |
| **Axios** | HTTP Client | Bearer token interceptor and upload progress handlers |
| **React Router 6** | Routing | Protected routes with authentication guards |

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
│   │   │   ├── 📄 user.py                  # Recruiter User Accounts & Domains
│   │   │   ├── 📄 job_posting.py           # Job Roles, Required Skills & Experience Req.
│   │   │   ├── 📄 candidate.py             # Candidate Profile, Raw Text & Embeddings
│   │   │   ├── 📄 match_score.py           # Multi-Factor Score Breakdowns & Unique Constraints
│   │   │   ├── 📄 assessment.py            # AI Skill Assessments & Candidate Test Taker
│   │   │   ├── 📄 team_member.py           # Workspace Invitations & Roles
│   │   │   └── 📄 guest_session.py         # Instant Triage Guest Screening Sessions
│   │   │
│   │   ├── 📁 schemas/                     # Pydantic Request/Response DTOs
│   │   │   ├── 📄 auth.py                  # Login, Signup & TokenResponse Models
│   │   │   ├── 📄 job_posting.py           # Job Creation & Detail Schemas
│   │   │   ├── 📄 candidate.py             # Candidate Data Transfer Objects
│   │   │   └── 📄 scoring.py               # MatchScore Read & Rerank Response Schemas
│   │   │
│   │   ├── 📁 routers/                     # FastAPI Endpoint Route Handlers
│   │   │   ├── 📄 auth.py                  # /auth/signup, /auth/login, /auth/google, /auth/demo-login
│   │   │   ├── 📄 jobs.py                  # /jobs/ CRUD Operations & Filtering
│   │   │   ├── 📄 candidates.py            # Upload, candidate review, comparison, exports & communication
│   │   │   ├── 📄 guest.py                 # Anonymous screening, session status/results & claim
│   │   │   ├── 📄 assessments.py           # /assessments/ CRUD, generate, invite, take & submit
│   │   │   └── 📄 settings.py              # /settings/ Workspace & Team Member Management
│   │   │
│   │   ├── 📁 services/                    # Machine Learning & NLP Core Engines
│   │   │   ├── 📄 extraction.py            # ResumeExtractor (NER, Date Parsing, PhraseMatcher)
│   │   │   ├── 📄 embeddings.py            # EmbeddingService (all-MiniLM-L6-v2 Singleton)
│   │   │   ├── 📄 scoring.py               # Scoring service
│   │   │   ├── 📄 scoring_shared.py        # Shared score_and_save implementation
│   │   │   ├── 📄 evidence.py              # Resume evidence excerpts for score components
│   │   │   ├── 📄 masking.py               # Blind-screening fields
│   │   │   ├── 📄 career_pattern.py        # Career progression and tenure signals
│   │   │   ├── 📄 adversarial.py           # Suspicious resume content detection
│   │   │   ├── 📄 comparison.py            # Candidate head-to-head comparison
│   │   │   └── 📄 interview_prep.py        # Interview question generation
│   │   │
│   │   ├── 📁 tasks/                       # Task Pipelines & Cleanup
│   │   │   ├── 📄 resume_tasks.py          # Asynchronous Background Processing Pipeline
│   │   │   └── 📄 cleanup.py               # Hourly Guest Session Data Retention Cleaner
│   │   │
│   │   ├── 📁 data/
│   │   │   └── 📄 skills_taxonomy.json     # 250+ Canonical Technical Skills & Known Aliases
│   │   └── 📄 main.py                      # FastAPI App Instantiation, CORS & Seed Data
│   │
│   ├── 📁 scoring/                         # Standalone Hybrid Scoring Engine
│   │   ├── 📄 scorer.py                    # HybridScorer, JobCriteria, ScoreBreakdown
│   │   ├── 📄 taxonomy.py                  # SkillsTaxonomy & Phrase Matching
│   │   └── 📄 extractor.py                 # ParsedResume & ExtractedProfile Dataclasses
│   │
│   ├── 📁 tests/                           # Pytest suite for scoring, extraction, security & workflows
│   │
│   ├── 📁 uploads/                         # Resume File Storage
│   ├── 📄 requirements.txt                 # Backend Python Dependencies
│   ├── 📄 pytest.ini                       # Test Runner Configuration
│   └── 📄 .env.example                     # Environment Template
│
├── 📁 frontend/                            # React 18 + TypeScript Client Application
│   ├── 📁 src/
│   │   ├── 📁 api/
│   │   │   └── 📄 client.ts                # Axios Instance with JWT Interceptors & Typed API Methods
│   │   ├── 📁 context/
│   │   │   └── 📄 AuthContext.tsx          # Authentication Global State & Token Storage
│   │   ├── 📁 components/
│   │   │   ├── 📄 Sidebar.tsx              # Sticky Dark Navigation Sidebar
│   │   │   ├── 📄 ProtectedRoute.tsx       # Auth Guard for Recruiter Routes
│   │   │   ├── 📄 ScoreBar.tsx             # Animated Score Indicator Bars
│   │   │   ├── 📄 SkillTag.tsx             # Colored Skill Chips
│   │   │   ├── 📄 StatusBadge.tsx          # Real-time Status Badges
│   │   │   ├── 📄 EvidencePanel.tsx        # Resume evidence excerpts
│   │   │   ├── 📄 BlindScreeningToggle.tsx # Toggle blind-screening mode
│   │   │   ├── 📄 WeightCustomizer.tsx     # Per-job scoring weights
│   │   │   ├── 📄 HeadToHeadComparison.tsx # Side-by-side candidate comparison
│   │   │   └── 📄 AdversarialShieldBadge.tsx # Resume integrity warning
│   │   ├── 📁 pages/
│   │   │   ├── 📄 MarketingPage.tsx        # High-Conversion Landing Page & Feature Showcase
│   │   │   ├── 📄 GuestTriagePage.tsx      # Instant Zero-Auth Resume Screening Screen
│   │   │   ├── 📄 ProcessingPage.tsx       # Real-Time Animated Processing Queue
│   │   │   ├── 📄 ResultsPreviewPage.tsx   # Guest Results, Tier Breakdown & Claim Account CTA
│   │   │   ├── 📄 LoginPage.tsx            # Recruiter Login & Demo Sign-In
│   │   │   ├── 📄 SignupPage.tsx           # Recruiter Registration
│   │   │   ├── 📄 DashboardPage.tsx        # Active Job Postings, Stats Counters & New Job Modal
│   │   │   ├── 📄 JobDetailPage.tsx        # Ranked Candidates Table & Slide-over Comparison Drawer
│   │   │   ├── 📄 UploadPage.tsx           # Multi-file Drag & Drop Processing Queue with Progress Bars
│   │   │   ├── 📄 CandidatePipelinePage.tsx# Candidate Kanban Pipeline Management
│   │   │   ├── 📄 AssessmentsPage.tsx      # AI Assessment Builder, Invites & Results
│   │   │   ├── 📄 InterviewsPage.tsx       # Interview submissions, reviews & scheduling
│   │   │   ├── 📄 CandidatesPage.tsx       # Candidate search and review
│   │   │   └── 📄 SettingsPage.tsx         # Workspace Settings & Team Collaboration
│   │   ├── 📄 App.tsx                      # Application Router Configuration
│   │   ├── 📄 main.tsx                     # React DOM Entrypoint
│   │   └── 📄 index.css                    # Tailwind Directives & Custom Animation Keyframes
│   │
│   ├── 📄 package.json                     # Frontend Dependencies & Scripts
│   ├── 📄 tsconfig.json                    # TypeScript Configuration
│   ├── 📄 tailwind.config.js               # Tailwind Color Palette & Theme Extensions
│   └── 📄 vite.config.ts                   # Vite Server & Backend Proxy Setup
│
├── 📄 docker-compose.yml                   # Containerized PostgreSQL (pgvector) + Redis Stack
├── 📄 .gitignore                           # Git Exclusion Rules
└── 📄 README.md                            # Comprehensive Documentation
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (Tested on Python 3.11 & 3.13)
- **Node.js 18+** & **npm**
- **Git**
- **Optional:** Docker Compose for the PostgreSQL/pgvector and Redis services in `docker-compose.yml`.

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

The backend defaults to a local SQLite database and eager task execution, so Redis is not required for the basic local workflow. To use PostgreSQL, set `DATABASE_URL` in `backend/.env` and start the optional services with `docker compose up -d`. Change `SECRET_KEY` before deploying. Scanned/image-only PDFs are not OCR-processed and may be marked for manual review.

---

### 3️⃣ Frontend Setup

In a separate terminal:

```bash
cd frontend

# Install npm packages
npm install

# Start Vite Development Server
npm run dev
```
- **Web Application**: `http://localhost:5173`

To confirm the frontend builds for production, run `npm run build`.
To enable Google sign-in in the frontend, set `VITE_GOOGLE_CLIENT_ID` in `frontend/.env.local` to the OAuth client ID also configured as `GOOGLE_CLIENT_ID` in `backend/.env`.

### Candidate Interview Email Setup

Set `APP_BASE_URL` in `backend/.env` to the public frontend URL so emailed links open the right site. Configure either `RESEND_API_KEY` (and a permitted sender in `EMAIL_FROM`) or Gmail SMTP (`SMTP_USER` and an App Password in `SMTP_PASSWORD`). If email delivery is unavailable during development, HireRank shows the secure candidate links so they can be sent manually. Interview links expire after 7 days by default.

In the recruiter workspace, create an assessment and invite candidates. Add future interview slots from **Interviews**, including an HTTPS meeting link. Candidates complete the written questions first, then choose a slot. HireRank sends the booking details to the candidate and recruiter; the meeting itself runs in the linked meeting provider.

---

### 4️⃣ One-Click Demo Mode
1. Open `http://localhost:5173` and choose the demo sign-in option.
2. The seeded demo account is `demo@recruitai.com` with password `demo1234`.
3. Open the pre-seeded **Senior Python Engineer** role.
4. Upload resumes to try extraction, scoring, evidence, and candidate review. Use only non-sensitive sample data in a local demo.

---

## 📡 API Endpoints

| Method | Route | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/auth/demo-login` | Generates a demo recruiter session & token | ❌ |
| `POST` | `/auth/signup` | Registers a new recruiter account | ❌ |
| `POST` | `/auth/login` | Authenticates recruiter and returns JWT | ❌ |
| `POST` | `/auth/google` | Google OAuth token verification & login | ❌ |
| `POST` | `/auth/refresh` | Refreshes an access token | ❌ |
| `POST` | `/guest/screen` | Instant screening of up to 5 resumes | ❌ |
| `GET` | `/guest/session/{id}/status` | Polls progress for a guest session | ❌ |
| `GET` | `/guest/session/{id}/results`| Returns full candidate rankings for guest session | ❌ |
| `POST` | `/guest/session/{id}/claim` | Transfers guest candidates to recruiter workspace | ✅ |
| `GET` | `/jobs/` | Lists all recruiter's job postings | ✅ |
| `POST` | `/jobs/` | Creates a new job posting with skill requirements | ✅ |
| `GET` | `/jobs/{id}` | Fetches detailed job specifications | ✅ |
| `PUT` | `/jobs/{id}` | Updates job criteria and requirements | ✅ |
| `DELETE`| `/jobs/{id}` | Removes job posting and associated candidates | ✅ |
| `PATCH` | `/jobs/{id}/weights` | Updates per-job scoring weights | ✅ |
| `GET` | `/jobs/{id}/export` | Exports job candidates and score breakdowns as CSV | ✅ |
| `POST` | `/jobs/{id}/upload` | Async multipart resume upload & background processing | ✅ |
| `GET` | `/jobs/{id}/candidates` | Retrieves ranked candidates with full score breakdowns | ✅ |
| `POST` | `/jobs/{id}/rerank-all` | Re-computes embeddings and scores across candidates | ✅ |
| `GET` | `/jobs/{id}/stats` | Returns job-level candidate screening statistics | ✅ |
| `GET` | `/dashboard/summary` | Returns recruiter dashboard summary statistics | ✅ |
| `GET` | `/candidates/{id}/status`| Real-time polling endpoint for candidate processing state | ✅ |
| `GET` | `/candidates` | Lists recruiter-owned candidates | ✅ |
| `POST` | `/candidates/compare` | Compares selected candidates and their score/skill differences | ✅ |
| `POST` | `/candidates/export` | Exports candidate results as CSV | ✅ |
| `POST` | `/candidates/bulk-invite` | Invites multiple candidates to an assessment | ✅ |
| `POST` | `/candidates/bulk-delete` | Deletes selected candidates | ✅ |
| `PATCH` | `/candidates/{id}/pipeline-status` | Updates a candidate's pipeline stage | ✅ |
| `PATCH` | `/candidates/{id}` | Updates supported candidate details | ✅ |
| `DELETE` | `/candidates/{id}` | Deletes a candidate | ✅ |
| `GET` | `/candidates/{id}/interview-questions` | Gets generated interview questions for a candidate | ✅ |
| `POST` | `/candidates/{id}/interview-questions` | Generates interview questions for a candidate | ✅ |
| `GET` | `/candidates/{id}/rejection-template` | Previews a templated rejection message | ✅ |
| `POST` | `/candidates/{id}/send-rejection` | Sends a rejection message using configured email delivery | ✅ |
| `GET` | `/assessments/batches` | Lists screening batches for assessment setup | ✅ |
| `POST` | `/assessments/extract-blueprint` | Extracts an assessment blueprint from role details | ✅ |
| `POST` | `/assessments/simulate-pass-rate` | Estimates assessment pass rates | ✅ |
| `POST` | `/assessments` | Creates an assessment blueprint | ✅ |
| `GET` | `/assessments/` | Lists recruiter-owned assessment blueprints | ✅ |
| `POST` | `/assessments/{id}/invitations` | Creates per-candidate expiring interview links and emails them | ✅ |
| `GET` | `/assessments/invitations` | Lists submissions, bookings, and recruiter evaluations | ✅ |
| `PATCH` | `/assessments/invitations/{id}/review` | Saves recruiter rating, decision, and notes | ✅ |
| `POST` | `/assessments/{id}/slots` | Adds a live interview time and HTTPS meeting URL | ✅ |
| `GET` | `/assessments/{id}/slots` | Lists available live interview times | ✅ |
| `POST` | `/assessments/invitations/{id}/resend` | Resends a candidate invitation | ✅ |
| `DELETE` | `/assessments/invitations/{id}` | Revokes an invitation | ✅ |
| `GET` | `/assessments/invitation/{token}` | Loads a candidate interview using its secure link | ❌ |
| `POST` | `/assessments/invitation/{token}/save-draft` | Saves candidate responses while they work | ❌ |
| `POST` | `/assessments/invitation/{token}/submit` | Submits completed candidate responses | ❌ |
| `POST` | `/assessments/invitation/{token}/book` | Books an available live interview time | ❌ |
| `GET` | `/settings/profile` | Reads the company workspace profile | ✅ |
| `PUT` | `/settings/profile` | Updates the company workspace profile | ✅ |
| `GET` | `/settings/team` | Lists workspace members | ✅ |
| `POST` | `/settings/team/invite` | Invites a workspace member | ✅ |
| `GET` | `/settings/team/members/{id}/invite-link` | Retrieves an invite link for a team member | ✅ |
| `GET` | `/settings/team/invite/verify` | Verifies a team invitation | ❌ |
| `POST` | `/settings/team/invite/accept` | Accepts a team invitation | ❌ |
| `PATCH` | `/settings/team/members/{id}` | Updates a team member | ✅ |
| `DELETE` | `/settings/team/members/{id}` | Removes a team member | ✅ |
| `GET` | `/settings/billing` | Retrieves workspace billing information | ✅ |

The API is also mounted under `/api` for frontend proxy compatibility. The complete, interactive OpenAPI specification is available at `/docs`.

---

## 🧪 Running Automated Tests

Run the test suite with pytest:

```bash
cd backend
python -m pytest -v
```

The test suite covers scoring and configurable weights, resume parsing and extraction, authentication and security, guest screening and retention, blind screening, evidence, career-pattern signals, adversarial resume detection, assessments and interviews, candidate comparison, rejection templates, and team-workspace behavior.

---

<div align="center">
  <sub>Built with ❤️ for modern talent acquisition teams.</sub>
</div>
