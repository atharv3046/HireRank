"""
resume_tasks.py
===============
Background pipeline for authenticated resume uploads.

Scoring is delegated entirely to app.services.scoring_shared.score_and_save
so the same HybridScorer logic (weights, must-have cap) is used here as
in the guest pipeline. The old MatchScorer / get_scorer() call path has
been removed; it no longer participates in scoring.
"""
import logging
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.extract_resume_fields")
def extract_resume_fields(candidate_id: int):
    """Extract structured fields from candidate's raw_text."""
    try:
        from app.services.extraction import get_extractor
        extractor = get_extractor()
        result = extractor.extract_all(candidate_id)
        logger.info("Extracted fields for candidate %s: %s", candidate_id, result)
        return result
    except Exception as e:
        logger.error("Extraction failed for candidate %s: %s", candidate_id, e)
        raise


@celery_app.task(name="tasks.embed_candidate")
def embed_candidate_task(candidate_id: int):
    """Generate and store embedding for candidate (legacy Celery task)."""
    try:
        from app.services.embeddings import get_embedding_service
        svc = get_embedding_service()
        svc.embed_candidate(candidate_id)
        logger.info("Embedded candidate %s", candidate_id)
    except Exception as e:
        logger.error("Embedding failed for candidate %s: %s", candidate_id, e)
        raise


def process_resume_pipeline(candidate_id: int, job_posting_id: int):
    """
    Run the full pipeline for an authenticated upload:
      1. Extract fields (spaCy NER, skills taxonomy, experience timeline)
      2. Score + save via the shared HybridScorer (score_and_save)

    The embed step is folded into score_and_save, which generates
    embeddings inline before calling HybridScorer.score_candidate —
    exactly as the guest pipeline does.
    """
    from app.core.database import SessionLocal
    from app.models.candidate import Candidate
    from app.services.scoring_shared import score_and_save

    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            logger.warning("process_resume_pipeline: candidate %s not found", candidate_id)
            return

        # ── Step 1: Extract structured fields ────────────────────────────────
        candidate.processing_status = "extracting"
        db.commit()

        from app.services.extraction import get_extractor
        extractor = get_extractor()
        extractor.extract_all(candidate_id, db)

        # ── Step 2: Score + save via the ONE shared scoring function ─────────
        candidate.processing_status = "scoring"
        db.commit()

        result = score_and_save(candidate_id, job_posting_id, db)
        logger.info(
            "Scored candidate %s for job %s: %.1f%% (%s)",
            candidate_id,
            job_posting_id,
            result.get("final_score") or 0,
            result.get("tier", ""),
        )

    except Exception as e:
        logger.error(
            "Pipeline failed for candidate %s (job %s): %s",
            candidate_id, job_posting_id, e, exc_info=True,
        )
        db_candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if db_candidate:
            db_candidate.processing_status = "error"
            db_candidate.error_message = str(e)
            db.commit()
    finally:
        db.close()
