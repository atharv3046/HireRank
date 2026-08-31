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

[✨ Features](#-key-features) • [🔄 Architecture & Flowchart](#-system-architecture--flowchart) • [🚀 Quick Start](#-quick-start) • [📊 Scoring Algorithm](#-multi-factor-scoring-formula) • [📡 API Reference](#-api-endpoints)

</div>

---

## 📌 Overview

**HireRank** is an enterprise-grade AI resume screening and ranking platform designed to streamline talent acquisition. Instead of basic keyword scanning (which often rejects strong candidates), HireRank uses **spaCy NER entity extraction, rule-based date parsing, taxonomy-driven phrase matching, and Sentence-Transformer vector embeddings** (ll-MiniLM-L6-v2) to deeply understand candidates' trajectories and objectively rank them against job descriptions.

---

## ✨ Key Features

- 📑 **Universal Resume Ingestion**: Supports .pdf (with pdfplumber + pypdf fallback) and .docx formats.
- 🧠 **Dual NLP Extraction Pipeline**:
  - **Entity Recognition (NER)**: Identifies candidate name and contact information.
  - **Skills Taxonomy & Normalization**: 250+ canonical skills with automatic alias matching (e.g., K8s $\rightarrow$ Kubernetes, ReactJS $\rightarrow$ React).
  - **Date Range Parsing & Overlap Merging**: Accurate career duration calculation preventing double-counting simultaneous positions.
  - **Education Level Ordinal Hierarchy**: Prioritizes PhD $\rightarrow$ Master's $\rightarrow$ Bachelor's $\rightarrow$ Associate's.
- 🔢 **Contextual Semantic Matching**: Transforms candidate experience and job descriptions into 384-dimensional dense vectors to calculate true cosine semantic similarity.
- 📊 **Explainable 0–100 Multi-Factor Scoring**: Complete transparent breakdown of scores across Semantic fit, Skills match, Experience years, and Education level.
- 🎨 **Modern TalentRank UI**:
  - Sleek modern layout with responsive Sidebar navigation.
  - Real-time animated Processing Queue with per-file progress indicators.
  - Interactive Candidate slide-over drawer with **Candidate vs. Requirements** side-by-side comparison tables.
  - Filterable by skill keywords and interactive minimum match score slider.
- ⚡ **Asynchronous Background Processing**: High-throughput file uploads respond immediately while NLP pipeline executes in the background.
- 🔑 **Stateless JWT Security**: Industry standard authentication with instant one-click recruiter demo access.

---

## 🔄 System Architecture & Flowchart

### 🧩 End-to-End Processing Pipeline

`mermaid
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
`

---

## 📊 Multi-Factor Scoring Formula

HireRank applies a balanced composite ranking formula:

\text{Final Score} = 0.50 \cdot S_{\text{semantic}} + 0.25 \cdot S_{\text{skills}} + 0.15 \cdot S_{\text{experience}} + 0.10 \cdot S_{\text{education}}

| Component | Weight | Calculation Method |
| :--- | :---: | :--- |
| **Semantic Similarity** | **50%** | $\frac{\cos(\vec{u}_{\text{resume}}, \vec{v}_{\text{job}}) + 1}{2} \times 100$ |
| **Skills Match** | **25%** | $\frac{|\text{Matched Skills}|}{|\text{Required Skills}|} \times 100$ |
| **Experience Fit** | **15%** | $\min\left(\frac{\text{Years}_{\text{candidate}}}{\text{Years}_{\text{required}}}, 1.0\right) \times 100$ |
| **Education Fit** | **10%** | Ordinal evaluation: \%$ (Exact/Higher), \%$ (1 level below), \%$ (2+ below) |

---

## 🛠️ Tech Stack Details

`
HireRank
 ├── Backend (Python 3.10+ / 3.13)
 │    ├── Web Framework:       FastAPI (Async ASGI) & Uvicorn
 │    ├── NLP & Parsing:       spaCy (en_core_web_sm), pdfplumber, pypdf, python-docx
 │    ├── ML & Embeddings:     sentence-transformers (all-MiniLM-L6-v2), PyTorch, scikit-learn
 │    ├── Database & ORM:      SQLAlchemy 2.0, SQLite (Dev) / PostgreSQL + pgvector (Prod)
 │    ├── Security & Auth:     python-jose (JWT), passlib & bcrypt 4.0.1
 │    └── Task Queue:          FastAPI BackgroundTasks & Celery/Redis
 │
 └── Frontend (React 18 + TypeScript + Vite)
      ├── UI Styling:          Tailwind CSS with Custom Keyframe Animations
      ├── State & Routing:     React Context API & React Router DOM v6
      ├── Networking:          Axios with Auto-Attach JWT Interceptors & Proxying
      └── Icons & Design:      Heroicons & TalentRank Component Architecture
`

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** & **npm**
- **Git**

---

### 1️⃣ Clone the Repository
`ash
git clone https://github.com/atharv3046/HireRank.git
cd HireRank
`

---

### 2️⃣ Backend Setup

`ash
cd backend

# Install Python dependencies
pip install --prefer-binary -r requirements.txt

# Download spaCy linguistic model
python -m spacy download en_core_web_sm

# Configure environment variables
copy .env.example .env     # Windows
# cp .env.example .env      # macOS/Linux

# Launch FastAPI Server
uvicorn app.main:app --port 8000
`
- **API Server**: http://localhost:8000
- **Swagger Documentation**: http://localhost:8000/docs

---

### 3️⃣ Frontend Setup

In a separate terminal:

`ash
cd frontend

# Install npm packages
npm install

# Start Vite Development Server
npm run dev -- --port 5173
`
- **Web Application**: http://localhost:5173

---

### 4️⃣ One-Click Demo Mode
1. Navigate to http://localhost:5173.
2. Click **⚡ Enter Demo Dashboard** on the login page (or use the hero CTA).
3. Open the pre-seeded **Senior Python Engineer** role.
4. Click **Upload Resume** to test real-time parsing, vector embedding, and score generation!

---

## 📡 API Endpoints

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :---: |
| POST | /auth/demo-login | Generates a demo recruiter session & token | No |
| POST | /auth/signup | Registers a new recruiter account | No |
| POST | /auth/login | Authenticates recruiter and returns JWT | No |
| GET | /jobs/ | Lists all recruiter's job postings | Yes |
| POST | /jobs/ | Creates a new job posting with skill requirements | Yes |
| GET | /jobs/{id} | Fetches detailed job specifications | Yes |
| POST | /jobs/{id}/upload | Async multipart resume upload & background processing | Yes |
| GET | /jobs/{id}/candidates | Retrieves ranked candidates with full score breakdowns | Yes |
| POST | /jobs/{id}/rerank-all | Re-computes embeddings and scores across all candidates | Yes |
| GET | /candidates/{id}/status| Real-time polling endpoint for candidate processing state | Yes |

---

## 🧪 Running Automated Tests

Run the test suite with pytest:

`ash
cd backend
python -m pytest tests/ -v
`

`
tests/test_scoring.py     -- 19 passed (Skills, Experience, and Education Scorer tests)
tests/test_extraction.py  -- 14 passed (Contact, Skills Taxonomy, Experience NLP tests)

============================== 33 passed in 2.85s ==============================
`

---

## 📂 Repository Structure

`
HireRank/
├── backend/
│   ├── app/
│   │   ├── core/              # Config (Pydantic v2), DB engine, Security (JWT)
│   │   ├── models/            # SQLAlchemy ORM Models (User, JobPosting, Candidate, MatchScore)
│   │   ├── schemas/           # Pydantic Request & Response Schemas
│   │   ├── routers/           # Auth, Jobs, Candidate & Scoring Endpoints
│   │   ├── services/          # Extraction (spaCy/NER), Embeddings (MiniLM), Scoring
│   │   ├── tasks/             # Resume processing pipeline orchestration
│   │   ├── data/              # 250+ Skills Taxonomy JSON with Aliases
│   │   └── main.py            # FastAPI Application & Seed Logic
│   └── tests/                 # Unit & Integration Tests
│
├── frontend/
│   ├── src/
│   │   ├── components/        # Sidebar, ScoreBadge, SubBar, ProtectedRoute
│   │   ├── pages/             # LandingPage, DashboardPage, JobDetailPage, UploadPage, LoginPage
│   │   ├── api/               # Typed Axios Client with JWT interceptors
│   │   └── context/           # Authentication State Context
│   ├── index.html
│   └── tailwind.config.js     # Custom animations & TalentRank color tokens
│
├── docker-compose.yml         # Postgres + pgvector + Redis configuration
└── README.md
`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>Built with ❤️ for modern talent acquisition teams.</sub>
</div>
