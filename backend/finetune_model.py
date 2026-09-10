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
    ./hirerank-finetuned-v1/   ← Swap into embeddings.py
"""

import json
import random
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hirerank-finetune")


# ──────────────────────────────────────────────────────────────────────────────
# STEP 1 — Download & prepare dataset from HuggingFace
# ──────────────────────────────────────────────────────────────────────────────

def download_and_prepare_dataset():
    """
    Uses the 'jacob-hugging-face/job-descriptions' dataset from HuggingFace.
    We create (resume_text, job_description, score) triplets.
    
    Score = 1.0 if same job category (good match)
    Score = 0.0 if different category (bad match)
    """
    try:
        from datasets import load_dataset
    except ImportError:
        raise ImportError("Run: pip install datasets")

    logger.info("Downloading job descriptions dataset from HuggingFace...")
    dataset = load_dataset("jacob-hugging-face/job-descriptions", split="train")
    logger.info(f"Loaded {len(dataset)} job postings")

    # Also try the resume dataset
    try:
        resume_dataset = load_dataset("InferencePrince555/Resume-Dataset", split="train")
        logger.info(f"Loaded {len(resume_dataset)} resumes")
        has_resumes = True
    except Exception:
        logger.warning("Resume dataset unavailable — using synthetic pairs")
        has_resumes = False

    pairs = []

    if has_resumes:
        # Match resumes to jobs by category
        job_by_category = {}
        for item in dataset:
            cat = item.get("job_title", "General")
            if cat not in job_by_category:
                job_by_category[cat] = []
            job_by_category[cat].append(item.get("job_description", ""))

        for resume_item in resume_dataset:
            resume_text = resume_item.get("Resume", "") or resume_item.get("resume_text", "")
            category = resume_item.get("Category", "")
            if not resume_text or len(resume_text) < 100:
                continue

            # Positive pair — same category job
            matching_jobs = job_by_category.get(category, [])
            if matching_jobs:
                jd = random.choice(matching_jobs)
                if jd:
                    pairs.append({"resume": resume_text[:1500], "job": jd[:1000], "score": 1.0})

            # Negative pair — different category job
            other_cats = [c for c in job_by_category if c != category]
            if other_cats:
                neg_cat = random.choice(other_cats)
                neg_jd = random.choice(job_by_category[neg_cat])
                if neg_jd:
                    pairs.append({"resume": resume_text[:1500], "job": neg_jd[:1000], "score": 0.0})

    else:
        # Fallback: job-to-job similarity (same title = similar)
        all_jobs = list(dataset)
        for i, item in enumerate(all_jobs[:2000]):
            jd1 = item.get("job_description", "")
            title1 = item.get("job_title", "")
            if not jd1:
                continue

            # Positive: same job title → high similarity
            same_title = [j for j in all_jobs if j.get("job_title") == title1 and j != item]
            if same_title:
                jd2 = random.choice(same_title).get("job_description", "")
                pairs.append({"resume": jd1[:1500], "job": jd2[:1000], "score": 0.9})

            # Negative: different job title → low similarity
            diff = random.choice(all_jobs)
            if diff.get("job_title") != title1:
                jd_neg = diff.get("job_description", "")
                pairs.append({"resume": jd1[:1500], "job": jd_neg[:1000], "score": 0.1})

    random.shuffle(pairs)
    logger.info(f"Created {len(pairs)} training pairs ({sum(1 for p in pairs if p['score']>=0.7)} positive, {sum(1 for p in pairs if p['score']<0.5)} negative)")
    return pairs


# ──────────────────────────────────────────────────────────────────────────────
# STEP 2 — Add your own HireRank real data (optional but best)
# ──────────────────────────────────────────────────────────────────────────────

def load_hirerank_real_data():
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
            candidate = db.query(Candidate).filter(Candidate.id == ms.candidate_id).first()
            job = db.query(JobPosting).filter(JobPosting.id == ms.job_posting_id).first()
            if not candidate or not job or not candidate.raw_text:
                continue

            # Normalize score from 0-100 to 0.0-1.0
            normalized_score = ms.overall_score / 100.0

            resume_text = candidate.raw_text[:1500]
            job_text = f"{job.title}\n{job.description}\nRequired skills: {', '.join(job.required_skills or [])}"

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
        - score = 1.0 → model learns these two texts should have cosine = 1
        - score = 0.0 → model learns these two texts should have cosine = -1
    """
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
        if p["resume"] and p["job"]
    ]
    logger.info(f"Training on {len(train_examples)} examples")

    # DataLoader — batch_size=16 works on CPU; use 32 if GPU available
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=16)

    # Loss function
    train_loss = losses.CosineSimilarityLoss(model)

    # Train — 3 epochs (~30 min on CPU for 5000 pairs, ~5 min on GPU)
    epochs = 3
    warmup_steps = int(len(train_dataloader) * epochs * 0.1)

    logger.info(f"Starting training — {epochs} epochs, {warmup_steps} warmup steps")
    logger.info("This will take ~10-30 minutes on CPU. Use Google Colab GPU for 5 min.")

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
    from sentence_transformers import SentenceTransformer
    import numpy as np

    test_pairs = pairs[-200:]  # Last 200 as test set

    original = SentenceTransformer("all-MiniLM-L6-v2")
    finetuned = SentenceTransformer(finetuned_path)

    def eval_model(model, pairs):
        errors = []
        for p in pairs:
            emb1 = model.encode(p["resume"], normalize_embeddings=True)
            emb2 = model.encode(p["job"], normalize_embeddings=True)
            pred = float(np.dot(emb1, emb2))
            # Normalize pred from [-1,1] to [0,1]
            pred_norm = (pred + 1) / 2
            errors.append(abs(pred_norm - p["score"]))
        return np.mean(errors)

    orig_error = eval_model(original, test_pairs)
    ft_error = eval_model(finetuned, test_pairs)

    logger.info("\n" + "="*50)
    logger.info(f"EVALUATION on {len(test_pairs)} test pairs:")
    logger.info(f"  Original model MAE:   {orig_error:.4f}")
    logger.info(f"  Fine-tuned model MAE: {ft_error:.4f}")
    improvement = ((orig_error - ft_error) / orig_error) * 100
    logger.info(f"  Improvement:          {improvement:.1f}%")
    logger.info("="*50)


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

    # 1. Download public dataset
    public_pairs = download_and_prepare_dataset()

    # 2. Add real HireRank DB data if available
    real_pairs = load_hirerank_real_data()

    # 3. Combine
    all_pairs = public_pairs + real_pairs
    random.shuffle(all_pairs)

    # Use training set (first 80%) — keep last 20% for evaluation
    split = int(len(all_pairs) * 0.8)
    train_pairs = all_pairs[:split]
    test_pairs = all_pairs[split:]

    logger.info(f"Total: {len(all_pairs)} pairs — Train: {len(train_pairs)}, Test: {len(test_pairs)}")

    # 4. Save sample for inspection
    save_training_data(all_pairs)

    # 5. Fine-tune
    model_path = finetune_model(train_pairs, OUTPUT_DIR)

    # 6. Evaluate
    evaluate_models(test_pairs, model_path)

    logger.info("\n✅ DONE! To use the fine-tuned model in HireRank:")
    logger.info(f"   In embeddings.py line 21, change:")
    logger.info(f'   FROM: self._model = SentenceTransformer("all-MiniLM-L6-v2")')
    logger.info(f'   TO:   self._model = SentenceTransformer("{OUTPUT_DIR}")')
