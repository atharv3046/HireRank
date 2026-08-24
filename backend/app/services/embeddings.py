import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _load_model(self):
        if self._model is None:
            logger.info("Loading sentence-transformers model all-MiniLM-L6-v2...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Model loaded.")
        return self._model

    def generate_embedding(self, text: str) -> list:
        """Generate a 384-dimensional embedding for the given text."""
        model = self._load_model()
        # Clean text: strip excessive whitespace
        cleaned = " ".join(text.split()[:512])  # Limit tokens
        embedding = model.encode(cleaned, normalize_embeddings=True)
        return embedding.tolist()

    def embed_candidate(self, candidate_id: int, db=None) -> list:
        """Generate and store embedding for a candidate."""
        from app.core.database import SessionLocal
        from app.models.candidate import Candidate
        
        close_db = db is None
        if db is None:
            db = SessionLocal()
        
        try:
            candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
            if not candidate:
                raise ValueError(f"Candidate {candidate_id} not found")
            
            text = candidate.raw_text or ""
            
            # Build a focused text for embedding (skills + summary + experience)
            parts = []
            if candidate.extracted_skills:
                parts.append("Skills: " + ", ".join(candidate.extracted_skills))
            if candidate.education_details:
                parts.append("Education: " + candidate.education_details)
            if candidate.experience_years:
                parts.append(f"Experience: {candidate.experience_years} years")
            parts.append(text[:3000])  # Full text (truncated)
            
            combined_text = "\n".join(parts)
            embedding = self.generate_embedding(combined_text)
            candidate.embedding = embedding
            candidate.processing_status = "embedded"
            db.commit()
            return embedding
        finally:
            if close_db:
                db.close()

    def embed_job_posting(self, job_id: int, db=None) -> list:
        """Generate embedding for a job posting."""
        from app.core.database import SessionLocal
        from app.models.job_posting import JobPosting
        
        close_db = db is None
        if db is None:
            db = SessionLocal()
        
        try:
            job = db.query(JobPosting).filter(JobPosting.id == job_id).first()
            if not job:
                raise ValueError(f"Job {job_id} not found")
            
            text = f"{job.title}\n{job.description}\nRequired skills: {', '.join(job.required_skills)}"
            embedding = self.generate_embedding(text)
            # Store in DB — for job postings, we store inline as JSON in a text col
            # (We'll use a simple approach: store in a temp field or compute on demand)
            # Return the embedding for use in scoring
            return embedding
        finally:
            if close_db:
                db.close()

    def cosine_similarity(self, embedding1: list, embedding2: list) -> float:
        """Compute cosine similarity between two embeddings."""
        a = np.array(embedding1)
        b = np.array(embedding2)
        if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
            return 0.0
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# Singleton
_embedding_service = None

def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
