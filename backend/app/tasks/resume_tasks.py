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
        logger.info(f"Extracted fields for candidate {candidate_id}: {result}")
        return result
    except Exception as e:
        logger.error(f"Extraction failed for candidate {candidate_id}: {e}")
        raise


@celery_app.task(name="tasks.embed_candidate")
def embed_candidate_task(candidate_id: int):
    """Generate and store embedding for candidate."""
    try:
        from app.services.embeddings import get_embedding_service
        svc = get_embedding_service()
        svc.embed_candidate(candidate_id)
        logger.info(f"Embedded candidate {candidate_id}")
    except Exception as e:
        logger.error(f"Embedding failed for candidate {candidate_id}: {e}")
        raise


@celery_app.task(name="tasks.score_candidate")
def score_candidate_task(candidate_id: int, job_posting_id: int):
    """Score a candidate against a job posting."""
    try:
        from app.core.database import SessionLocal
        from app.services.scoring import get_scorer
        scorer = get_scorer()
        db = SessionLocal()
        try:
            result = scorer.calculate_overall_score(candidate_id, job_posting_id, db)
            logger.info(f"Scored candidate {candidate_id} for job {job_posting_id}: {result['overall_score']}")
            return result
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Scoring failed for candidate {candidate_id}: {e}")
        raise


def process_resume_pipeline(candidate_id: int, job_posting_id: int):
    """Run the full pipeline: extract -> embed -> score."""
    from app.core.database import SessionLocal
    from app.models.candidate import Candidate
    
    db = SessionLocal()
    try:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            return
        
        # Step 1: Extract fields
        candidate.processing_status = "extracting"
        db.commit()
        
        from app.services.extraction import get_extractor
        extractor = get_extractor()
        extractor.extract_all(candidate_id, db)
        
        # Step 2: Embed
        candidate.processing_status = "scoring"
        db.commit()
        
        from app.services.embeddings import get_embedding_service
        emb_svc = get_embedding_service()
        emb_svc.embed_candidate(candidate_id, db)
        
        # Step 3: Score
        from app.services.scoring import get_scorer
        scorer = get_scorer()
        scorer.calculate_overall_score(candidate_id, job_posting_id, db)
        
        candidate.processing_status = "done"
        db.commit()
        
    except Exception as e:
        logger.error(f"Pipeline failed for candidate {candidate_id}: {e}")
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if candidate:
            candidate.processing_status = "error"
            candidate.error_message = str(e)
            db.commit()
    finally:
        db.close()
