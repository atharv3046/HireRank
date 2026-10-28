"""
HireRank Fine-Tuning Script
============================
Fine-tunes all-MiniLM-L6-v2 on resume-job description pairs
to learn RECRUITMENT-SPECIFIC semantic similarity.

Setup:
    pip install sentence-transformers datasets torch

Run:
    python finetune_model.py

Output:
    ./hirerank-finetuned-v1/   ← Set EMBEDDING_MODEL=./hirerank-finetuned-v1 in backend/.env
"""

import json
import random
import logging
import re
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("hirerank-finetune")

# Domain keyword dictionary for semantic category classification
DOMAIN_KEYWORDS = {
    "software_engineering": [
        "developer", "software", "engineer", "frontend", "backend", "full stack",
        "python", "java", "react", "devops", "cloud", "web", "c++", "golang",
        "qa", "test automation", "mobile", "ios", "android", "architecture"
    ],
    "data_ai": [
        "data", "data scientist", "data analyst", "machine learning", "deep learning",
        "ai", "nlp", "computer vision", "bi analyst", "sql", "statistics", "analytics"
    ],
    "finance_accounting": [
        "accountant", "accounting", "finance", "financial", "auditor", "audit",
        "tax", "payroll", "banking", "bookkeeper", "cpa", "controller"
    ],
    "human_resources": [
        "human resources", "hr", "talent", "recruiter", "recruiting", "staffing",
        "people operations", "onboarding"
    ],
    "sales_marketing": [
        "sales", "marketing", "account executive", "growth", "business development",
        "seo", "content writer", "social media", "advertising", "copywriter", "brand"
    ],
    "operations_management": [
        "operations", "project manager", "product manager", "scrum", "coordinator",
        "logistics", "supply chain", "program manager", "general manager"
    ],
    "healthcare": [
        "nurse", "medical", "healthcare", "clinical", "pharmacy", "physician",
        "patient care", "health", "hospital"
    ],
    "legal": [
        "attorney", "lawyer", "paralegal", "legal", "counsel", "advocate", "compliance"
    ],
    "design": [
        "designer", "ui/ux", "graphic designer", "visual designer", "product designer"
    ]
}


def classify_text_domain(text: str) -> str:
    """Classifies a job title or resume snippet into a functional domain."""
    if not text:
        return "general"
    lower_text = text.lower()
    best_domain = "general"
    max_matches = 0

    for domain, keywords in DOMAIN_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in lower_text)
        if matches > max_matches:
            max_matches = matches
            best_domain = domain

    return best_domain


def generate_synthetic_recruitment_pairs(target_count: int = 400) -> list:
    """
    Fallback dataset generator when HuggingFace datasets or internet is unavailable.
    Generates balanced positive and negative pairs across diverse professional domains.
    """
    logger.info("Generating high-quality synthetic recruitment training pairs...")

    domains_corpus = {
        "software_engineering": {
            "resumes": [
                "Full Stack Software Engineer with 5+ years of experience building scalable web applications. Proficient in React, Node.js, TypeScript, PostgreSQL, and AWS. Designed REST and GraphQL APIs, implemented microservices architecture, and optimized database queries.",
                "Backend Python Engineer specializing in FastAPI, Django, Celery, and Redis. Strong experience in building high-throughput asynchronous services, containerization with Docker, and CI/CD pipelines via GitHub Actions.",
                "Senior Frontend Developer with expertise in React, Next.js, Vue, Tailwind CSS, and state management (Redux, Zustand). Passionate about web performance, accessibility, responsive UI, and unit testing with Jest.",
                "DevOps and Cloud Engineer with AWS and Kubernetes certifications. Expertise in Terraform, Docker, CI/CD, Prometheus monitoring, and infrastructure automation."
            ],
            "jobs": [
                "Senior Software Engineer: We are looking for an experienced developer with strong skills in TypeScript, React, Node.js, and distributed systems. Responsible for designing clean architectures, mentoring engineers, and delivering robust SaaS products.",
                "Python Backend Developer: Seeking a developer proficient in Python, FastAPI, relational databases (PostgreSQL), Redis caching, and Docker. Must have experience building secure REST APIs and background task processing.",
                "Frontend Engineer: Join our product team to build high-performance web interfaces. Requirements: Modern JavaScript/TypeScript, React, CSS architectures, responsive design, and component-driven development.",
                "Cloud DevOps Engineer: Seeking an engineer to manage our cloud infrastructure on AWS, automate deployments with Terraform, maintain Kubernetes clusters, and establish observability."
            ]
        },
        "data_ai": {
            "resumes": [
                "Data Scientist with 4 years experience applying machine learning and statistical modeling to solve business problems. Proficient in Python, Scikit-Learn, PyTorch, Pandas, and SQL. Deployed predictive models in production.",
                "Machine Learning Engineer experienced in fine-tuning Transformer models, LLM integration, HuggingFace, PyTorch, and Vector databases (Pinecone, ChromaDB). Track record in semantic search and NLP pipelines.",
                "Data Analyst skilled in SQL, Tableau, Power BI, Python, and dimensional data modeling. Experienced in building executive dashboards, KPI tracking, and conducting exploratory data analysis."
            ],
            "jobs": [
                "Data Scientist: Looking for a Data Scientist to build predictive ML models. Requirements: Python, Pandas, Scikit-Learn, SQL, experience with regression, classification, and statistical hypothesis testing.",
                "AI/NLP Engineer: Seeking an engineer to develop and fine-tune natural language processing models and embedding pipelines. Strong background in PyTorch, Transformers, and semantic vector search required.",
                "Senior Business Intelligence & Data Analyst: Responsible for writing complex SQL queries, building dashboard solutions in Tableau, and providing actionable business insights to stakeholders."
            ]
        },
        "finance_accounting": {
            "resumes": [
                "Certified Public Accountant (CPA) with 7 years of corporate accounting and auditing experience. Expert in GAAP compliance, general ledger reconciliation, financial reporting, and tax return preparation.",
                "Senior Financial Analyst with background in financial planning and analysis (FP&A), budget forecasting, cash flow modeling, and variance analysis using Excel and ERP systems (SAP, Oracle).",
                "Staff Accountant experienced in accounts payable/receivable (AP/AR), month-end closing, bank reconciliations, payroll processing, and QuickBooks."
            ],
            "jobs": [
                "Corporate Controller / Senior Accountant: Requires CPA certification, 5+ years experience in GAAP financial statements, balance sheet reconciliations, external audit preparation, and corporate tax.",
                "Financial Planning & Analysis (FP&A) Manager: Seeking an analyst to manage annual budgeting, quarterly forecasts, financial modeling, and management reporting. Advanced financial modeling skills required.",
                "Staff Accountant: Looking for an accountant to handle general ledger accounting, AP/AR operations, journal entries, and bank account reconciliations using QuickBooks."
            ]
        },
        "sales_marketing": {
            "resumes": [
                "Digital Marketing Specialist with 5 years experience managing SEO, SEM, Google Ads, and content marketing campaigns. Proven record of increasing organic traffic by 140% and lowering customer acquisition cost (CAC).",
                "Senior Account Executive with 6 years experience in B2B SaaS sales. Exceeded annual quota by 130%, closed enterprise deals, and managed the full sales cycle from prospecting to negotiation.",
                "Content Strategist and Copywriter skilled in brand storytelling, email marketing, social media campaigns, and conversion rate optimization (CRO)."
            ],
            "jobs": [
                "Growth & Performance Marketing Manager: Seeking a marketer with proven experience running Google Ads, Facebook Ads, SEO strategy, and analytics to scale customer acquisition.",
                "Enterprise Account Executive (B2B SaaS): Responsible for prospecting enterprise accounts, conducting product demos, managing pipeline in Salesforce, and closing complex software contracts.",
                "Content Marketing Manager: Looking for a creative writer to lead blog, whitepaper, and case study production. Knowledge of SEO best practices and editorial calendar management required."
            ]
        },
        "human_resources": {
            "resumes": [
                "Technical Recruiter with 4 years experience sourcing, interviewing, and hiring software engineering and product talent for hyper-growth tech startups. Experienced with ATS systems (Greenhouse, Lever).",
                "HR Generalist experienced in employee relations, onboarding, performance reviews, benefits administration, and HR compliance with federal and state labor laws."
            ],
            "jobs": [
                "Senior Talent Acquisition Specialist: Seeking an experienced technical recruiter to manage full-cycle hiring for engineering and product roles. Strong outbound sourcing and negotiation skills required.",
                "Human Resources Generalist: Looking for an HR professional to oversee employee onboarding, HR policy adherence, benefits administration, and culture initiatives."
            ]
        }
    }

    pairs = []
    domain_keys = list(domains_corpus.keys())

    while len(pairs) < target_count:
        # 1. Positive pair: Same domain (Score = 1.0)
        dom = random.choice(domain_keys)
        res_sample = random.choice(domains_corpus[dom]["resumes"])
        job_sample = random.choice(domains_corpus[dom]["jobs"])
        pairs.append({"resume": res_sample, "job": job_sample, "score": 1.0})

        # 2. Negative pair: Different domains (Score = 0.0)
        other_dom = random.choice([d for d in domain_keys if d != dom])
        job_neg = random.choice(domains_corpus[other_dom]["jobs"])
        pairs.append({"resume": res_sample, "job": job_neg, "score": 0.0})

    random.shuffle(pairs)
    return pairs[:target_count]


# ──────────────────────────────────────────────────────────────────────────────
# STEP 1 — Download & prepare dataset from HuggingFace
# ──────────────────────────────────────────────────────────────────────────────

def download_and_prepare_dataset() -> list:
    """
    Downloads recruitment datasets from HuggingFace, extracts job descriptions
    and resumes, and creates balanced (resume_text, job_description, score) pairs.
    Gracefully falls back to synthetic pairs if datasets or network is unavailable.
    """
    try:
        from datasets import load_dataset  # pyrefly: ignore[missing-import]  # type: ignore
    except ImportError:
        logger.warning("Package 'datasets' not found. Run 'pip install datasets' to download from HuggingFace.")
        return generate_synthetic_recruitment_pairs()

    pairs = []

    # 1. Load Job Postings
    try:
        logger.info("Downloading job descriptions dataset from HuggingFace (jacob-hugging-face/job-descriptions)...")
        job_dataset = load_dataset("jacob-hugging-face/job-descriptions", split="train")
        logger.info(f"Loaded {len(job_dataset)} job postings")
    except Exception as e:
        logger.warning(f"Could not download job descriptions dataset: {e}")
        job_dataset = None

    # 2. Load Resume Dataset
    resume_dataset = None
    if job_dataset is not None:
        try:
            logger.info("Downloading resume dataset from HuggingFace (InferencePrince555/Resume-Dataset)...")
            resume_dataset = load_dataset("InferencePrince555/Resume-Dataset", split="train")
            logger.info(f"Loaded {len(resume_dataset)} resumes")
        except Exception as e:
            logger.warning(f"Resume dataset unavailable: {e}")

    # If neither dataset is available, use synthetic data
    if job_dataset is None:
        return generate_synthetic_recruitment_pairs()

    # 3. Process Job Postings into Domain Buckets
    jobs_by_domain = {}
    for item in job_dataset:
        # Schema field is 'position_title', fallback to 'job_title' or 'title'
        title = item.get("position_title") or item.get("job_title") or item.get("title") or ""
        jd = item.get("job_description") or item.get("description") or ""
        if not jd or len(jd) < 50:
            continue

        domain = classify_text_domain(title or jd[:200])
        if domain not in jobs_by_domain:
            jobs_by_domain[domain] = []
        jobs_by_domain[domain].append(jd[:1200])

    # 4. Pair Resumes with Job Descriptions
    if resume_dataset is not None:
        resumes_by_domain = {}

        for item in resume_dataset:
            # Schema field is 'Resume_test', fallback to 'Resume' or 'resume_text'
            resume_text = item.get("Resume_test") or item.get("Resume") or item.get("resume_text") or ""
            if not resume_text or len(resume_text) < 100:
                continue

            # Extract category or instruction
            instruction = item.get("instruction", "")
            cat = item.get("Category") or item.get("category") or ""
            if not cat and instruction:
                m = re.search(r"for an?\s+(.*?)\s+(?:Job|position|role|$)", instruction, re.IGNORECASE)
                cat = m.group(1).strip() if m else instruction

            domain = classify_text_domain(f"{cat} {resume_text[:200]}")
            if domain not in resumes_by_domain:
                resumes_by_domain[domain] = []
            resumes_by_domain[domain].append(resume_text[:1500])

        # Generate Positive and Negative Pairs
        available_domains = [d for d in resumes_by_domain if d in jobs_by_domain and jobs_by_domain[d]]
        for domain in available_domains:
            domain_resumes = resumes_by_domain[domain]
            domain_jobs = jobs_by_domain[domain]
            other_domains = [d for d in jobs_by_domain if d != domain and jobs_by_domain[d]]

            for r_text in domain_resumes[:100]:  # Cap per domain for balance
                # Positive pair (same domain) -> Score = 1.0
                pos_jd = random.choice(domain_jobs)
                pairs.append({"resume": r_text, "job": pos_jd, "score": 1.0})

                # Negative pair (different domain) -> Score = 0.0
                if other_domains:
                    neg_domain = random.choice(other_domains)
                    neg_jd = random.choice(jobs_by_domain[neg_domain])
                    pairs.append({"resume": r_text, "job": neg_jd, "score": 0.0})

    else:
        # Fallback: Job-to-Job similarity if resumes are missing
        logger.info("Creating job-to-job similarity pairs...")
        available_domains = [d for d in jobs_by_domain if len(jobs_by_domain[d]) >= 2]
        other_domains = [d for d in jobs_by_domain if jobs_by_domain[d]]

        for domain in available_domains:
            domain_jobs = jobs_by_domain[domain]
            for i in range(min(50, len(domain_jobs))):
                j1 = domain_jobs[i]
                # Positive pair (same domain) -> Score = 0.9
                other_jobs = [j for j in domain_jobs if j != j1]
                if other_jobs:
                    j2 = random.choice(other_jobs)
                    pairs.append({"resume": j1, "job": j2, "score": 0.9})

                # Negative pair (different domain) -> Score = 0.1
                diff_domains = [d for d in other_domains if d != domain]
                if diff_domains:
                    diff_d = random.choice(diff_domains)
                    j_neg = random.choice(jobs_by_domain[diff_d])
                    pairs.append({"resume": j1, "job": j_neg, "score": 0.1})

    if not pairs:
        logger.warning("Could not create pairs from HuggingFace dataset. Falling back to synthetic recruitment pairs.")
        return generate_synthetic_recruitment_pairs()

    random.shuffle(pairs)
    pos_count = sum(1 for p in pairs if p["score"] >= 0.7)
    neg_count = sum(1 for p in pairs if p["score"] < 0.5)
    logger.info(f"Created {len(pairs)} training pairs ({pos_count} positive, {neg_count} negative)")
    return pairs


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — Add your own HireRank real data (optional but best)
# ──────────────────────────────────────────────────────────────────────────────

def load_hirerank_real_data() -> list:
    """
    If you have real uploaded resumes + job postings in your SQLite DB,
    extract them and add them to training with real scores.
    """
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from app.core.database import SessionLocal
        from app.models.candidate import Candidate
        from app.models.job_posting import JobPosting
        from app.models.match_score import MatchScore

        db = SessionLocal()
        pairs = []

        scores = db.query(MatchScore).all()
        for ms in scores:
            if ms.overall_score is None:
                continue

            candidate = db.query(Candidate).filter(Candidate.id == ms.candidate_id).first()
            job = db.query(JobPosting).filter(JobPosting.id == ms.job_posting_id).first()
            if not candidate or not job or not candidate.raw_text:
                continue

            # Normalize score from 0-100 to 0.0-1.0
            normalized_score = float(ms.overall_score) / 100.0

            resume_text = candidate.raw_text[:1500]
            skills_str = ", ".join(job.required_skills or []) if job.required_skills else ""
            job_text = f"{job.title}\n{job.description}\nRequired skills: {skills_str}"

            pairs.append({
                "resume": resume_text,
                "job": job_text[:1000],
                "score": normalized_score
            })

        db.close()
        logger.info(f"Loaded {len(pairs)} real HireRank training pairs from DB")
        return pairs

    except Exception as e:
        logger.warning(f"Could not load real data from DB: {e}")
        return []


# ──────────────────────────────────────────────────────────────────────────────
# STEP 3 — Fine-tune the model
# ──────────────────────────────────────────────────────────────────────────────

def finetune_model(pairs: list, output_dir: str = "./hirerank-finetuned-v1"):
    """
    Fine-tunes all-MiniLM-L6-v2 on the given (resume, job, score) pairs.
    Uses CosineSimilarityLoss:
        - score = 1.0 → model learns texts should have high cosine similarity
        - score = 0.0 → model learns texts should have low cosine similarity
    """
    if not pairs:
        logger.error("No training pairs provided for fine-tuning.")
        return None

    try:
        from sentence_transformers import SentenceTransformer, InputExample, losses
        from torch.utils.data import DataLoader
    except ImportError:
        raise ImportError("Run: pip install sentence-transformers torch")

    logger.info("Loading base model: all-MiniLM-L6-v2...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # Convert pairs to InputExample format
    train_examples = [
        InputExample(texts=[p["resume"], p["job"]], label=float(p["score"]))
        for p in pairs
        if p.get("resume") and p.get("job")
    ]

    if not train_examples:
        logger.error("No valid text examples available to train.")
        return None

    logger.info(f"Training on {len(train_examples)} examples")

    # DataLoader — batch_size=16 works on CPU; use 32 if GPU available
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)

    # Loss function
    train_loss = losses.CosineSimilarityLoss(model)

    # Train — 3 epochs (~10-20 min on CPU, ~2 min on GPU)
    epochs = 3
    warmup_steps = max(1, int(len(train_dataloader) * epochs * 0.1))

    logger.info(f"Starting training — {epochs} epochs, {warmup_steps} warmup steps")
    logger.info("This will take ~10-20 minutes on CPU (faster with CUDA GPU).")

    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=epochs,
        warmup_steps=warmup_steps,
        output_path=output_dir,
        show_progress_bar=True,
        checkpoint_save_steps=500,
        checkpoint_path=output_dir + "/checkpoints"
    )

    logger.info(f"Model saved to: {output_dir}")
    return output_dir


# ──────────────────────────────────────────────────────────────────────────────
# STEP 4 — Evaluate the fine-tuned model vs original
# ──────────────────────────────────────────────────────────────────────────────

def evaluate_models(pairs: list, finetuned_path: str):
    """Compare original vs fine-tuned on held-out test set."""
    if not pairs or not finetuned_path:
        logger.warning("No test pairs or fine-tuned model path available for evaluation.")
        return

    from sentence_transformers import SentenceTransformer
    import numpy as np

    test_pairs = pairs[-200:] if len(pairs) >= 200 else pairs
    if not test_pairs:
        return

    logger.info(f"Evaluating models on {len(test_pairs)} test pairs...")
    original = SentenceTransformer("all-MiniLM-L6-v2")
    finetuned = SentenceTransformer(finetuned_path)

    def eval_model(model, eval_pairs):
        errors = []
        for p in eval_pairs:
            emb1 = model.encode(p["resume"], normalize_embeddings=True)
            emb2 = model.encode(p["job"], normalize_embeddings=True)
            pred = float(np.dot(emb1, emb2))
            pred_norm = (pred + 1) / 2
            errors.append(abs(pred_norm - p["score"]))
        return float(np.mean(errors)) if errors else 0.0

    orig_error = eval_model(original, test_pairs)
    ft_error = eval_model(finetuned, test_pairs)

    logger.info("\n" + "=" * 50)
    logger.info(f"EVALUATION on {len(test_pairs)} test pairs:")
    logger.info(f"  Original model MAE:   {orig_error:.4f}")
    logger.info(f"  Fine-tuned model MAE: {ft_error:.4f}")
    if orig_error > 0:
        improvement = ((orig_error - ft_error) / orig_error) * 100
        logger.info(f"  Improvement:          {improvement:.1f}%")
    logger.info("=" * 50)


# ──────────────────────────────────────────────────────────────────────────────
# STEP 5 — Save training pairs to JSON (for inspection / reuse)
# ──────────────────────────────────────────────────────────────────────────────

def save_training_data(pairs: list, path: str = "./training_pairs.json"):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(pairs[:100], f, indent=2, ensure_ascii=False)  # save sample
    logger.info(f"Sample training pairs saved to: {path}")


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    OUTPUT_DIR = "./hirerank-finetuned-v1"

    logger.info("=" * 60)
    logger.info("HireRank Fine-Tuning Pipeline")
    logger.info("=" * 60)

    # 1. Download or generate training dataset
    public_pairs = download_and_prepare_dataset()

    # 2. Add real HireRank DB data if available
    real_pairs = load_hirerank_real_data()

    # 3. Combine
    all_pairs = public_pairs + real_pairs
    random.shuffle(all_pairs)

    if not all_pairs:
        logger.error("No training data available. Exiting pipeline.")
        exit(1)

    # Split: 80% train, 20% test
    split = max(1, int(len(all_pairs) * 0.8))
    train_pairs = all_pairs[:split]
    test_pairs = all_pairs[split:]

    logger.info(f"Total: {len(all_pairs)} pairs — Train: {len(train_pairs)}, Test: {len(test_pairs)}")

    # 4. Save sample for inspection
    save_training_data(all_pairs)

    # 5. Fine-tune
    model_path = finetune_model(train_pairs, OUTPUT_DIR)

    # 6. Evaluate
    if model_path:
        evaluate_models(test_pairs, model_path)

        logger.info("\n✅ DONE! To use the fine-tuned model in HireRank:")
        logger.info(f"   Set the EMBEDDING_MODEL in your backend/.env file:")
        logger.info(f"   EMBEDDING_MODEL={OUTPUT_DIR}")
