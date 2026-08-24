import json
import logging
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

EDUCATION_ORDINAL = {
    "high_school": 1, "associate": 2, "bachelors": 3, "masters": 4, "phd": 5
}

SKILLS_PATH = Path(__file__).parent.parent / "data" / "skills_taxonomy.json"
_skill_alias_map = None  # lazy loaded


def _load_skill_alias_map():
    global _skill_alias_map
    if _skill_alias_map is None:
        with open(SKILLS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        _skill_alias_map = {}
        for entry in data:
            canonical = entry["canonical"]
            _skill_alias_map[canonical.lower()] = canonical
            for alias in entry.get("aliases", []):
                _skill_alias_map[alias.lower()] = canonical
    return _skill_alias_map


def _normalize_skill(skill: str) -> str:
    """Normalize a skill name to its canonical form."""
    alias_map = _load_skill_alias_map()
    return alias_map.get(skill.lower(), skill)


class MatchScorer:
    
    def calculate_semantic_score(self, candidate_embedding: list, job_embedding: list) -> float:
        """Compute cosine similarity and normalize to 0-100."""
        if not candidate_embedding or not job_embedding:
            return 0.0
        from app.services.embeddings import get_embedding_service
        svc = get_embedding_service()
        cosine = svc.cosine_similarity(candidate_embedding, job_embedding)
        # Cosine similarity is -1 to 1, normalize to 0-100
        normalized = (cosine + 1) / 2 * 100
        return round(min(100.0, max(0.0, normalized)), 2)

    def calculate_skills_score(self, candidate_skills: list, required_skills: list) -> dict:
        """Calculate skills match score."""
        if not required_skills:
            return {"score": 100.0, "matched": list(candidate_skills), "missing": [], "note": "No required skills specified"}
        
        # Normalize to canonical forms
        candidate_canonical = set(_normalize_skill(s) for s in candidate_skills)
        required_canonical = [_normalize_skill(s) for s in required_skills]
        
        matched = [s for s in required_canonical if s in candidate_canonical]
        missing = [s for s in required_canonical if s not in candidate_canonical]
        
        score = (len(matched) / len(required_canonical)) * 100 if required_canonical else 100.0
        
        return {
            "score": round(score, 2),
            "matched": matched,
            "missing": missing
        }

    def calculate_experience_score(self, candidate_years: float, required_years: float) -> float:
        """Calculate experience score."""
        if not required_years or required_years <= 0:
            return 100.0
        if candidate_years is None:
            return 0.0
        if candidate_years >= required_years:
            return 100.0
        score = (candidate_years / required_years) * 100
        return round(min(100.0, max(0.0, score)), 2)

    def calculate_education_score(self, candidate_level: Optional[str], required_level: Optional[str]) -> float:
        """Calculate education score using ordinal ranking."""
        if not required_level:
            return 100.0
        if not candidate_level:
            return 20.0  # No education info = significantly under
        
        candidate_ord = EDUCATION_ORDINAL.get(candidate_level, 0)
        required_ord = EDUCATION_ORDINAL.get(required_level, 0)
        
        if candidate_ord >= required_ord:
            return 100.0
        elif candidate_ord == required_ord - 1:
            return 60.0
        else:
            return 20.0

    def _generate_summary(self, overall: float, skills_result: dict, exp_score: float, edu_score: float,
                           candidate_years: float, required_years: float) -> str:
        """Generate a human-readable summary string."""
        if overall >= 80:
            strength = "Strong match"
        elif overall >= 50:
            strength = "Moderate match"
        else:
            strength = "Weak match"
        
        notes = []
        
        missing_count = len(skills_result.get("missing", []))
        total_required = len(skills_result.get("matched", [])) + missing_count
        if missing_count > 0:
            notes.append(f"missing {missing_count} of {total_required} required skills")
        elif total_required > 0:
            notes.append("meets all skill requirements")
        
        if required_years and required_years > 0:
            if candidate_years and candidate_years >= required_years:
                notes.append("exceeds experience requirement")
            elif candidate_years:
                notes.append(f"has {candidate_years}y vs {required_years}y required")
            else:
                notes.append("experience data unavailable")
        
        if edu_score < 60:
            notes.append("education below requirement")
        
        if notes:
            return f"{strength} — {', '.join(notes)}"
        return strength

    def calculate_overall_score(self, candidate_id: int, job_posting_id: int, db: Session) -> dict:
        """Run full scoring pipeline and save to match_scores table."""
        from app.models.candidate import Candidate
        from app.models.job_posting import JobPosting
        from app.models.match_score import MatchScore
        from app.services.embeddings import get_embedding_service
        
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        job = db.query(JobPosting).filter(JobPosting.id == job_posting_id).first()
        
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")
        if not job:
            raise ValueError(f"Job {job_posting_id} not found")
        
        # Generate embeddings if missing
        emb_svc = get_embedding_service()
        candidate_emb = candidate.embedding
        if not candidate_emb and candidate.raw_text:
            candidate_emb = emb_svc.embed_candidate(candidate_id, db)
        
        job_emb = emb_svc.embed_job_posting(job_posting_id, db)
        
        # Calculate sub-scores
        semantic_score = self.calculate_semantic_score(candidate_emb, job_emb)
        skills_result = self.calculate_skills_score(candidate.extracted_skills, job.required_skills)
        experience_score = self.calculate_experience_score(
            candidate.experience_years or 0.0,
            job.min_experience_years or 0.0
        )
        education_score = self.calculate_education_score(
            candidate.education_level,
            job.education_requirement
        )
        
        # Overall score formula
        overall_score = (
            semantic_score * 0.50 +
            skills_result["score"] * 0.25 +
            experience_score * 0.15 +
            education_score * 0.10
        )
        
        summary = self._generate_summary(
            overall_score, skills_result, experience_score, education_score,
            candidate.experience_years or 0.0, job.min_experience_years or 0.0
        )
        
        # Upsert to match_scores
        match_score = db.query(MatchScore).filter(
            MatchScore.candidate_id == candidate_id,
            MatchScore.job_posting_id == job_posting_id
        ).first()
        
        if match_score:
            # Update existing
            match_score.overall_score = round(overall_score, 2)
            match_score.semantic_score = round(semantic_score, 2)
            match_score.skills_score = round(skills_result["score"], 2)
            match_score.experience_score = round(experience_score, 2)
            match_score.education_score = round(education_score, 2)
            match_score.matched_skills = skills_result["matched"]
            match_score.missing_skills = skills_result["missing"]
            match_score.summary = summary
        else:
            match_score = MatchScore(
                candidate_id=candidate_id,
                job_posting_id=job_posting_id,
                overall_score=round(overall_score, 2),
                semantic_score=round(semantic_score, 2),
                skills_score=round(skills_result["score"], 2),
                experience_score=round(experience_score, 2),
                education_score=round(education_score, 2),
                summary=summary
            )
            match_score.matched_skills = skills_result["matched"]
            match_score.missing_skills = skills_result["missing"]
            db.add(match_score)
        
        # Update candidate status
        candidate.processing_status = "done"
        db.commit()
        db.refresh(match_score)
        
        return {
            "overall_score": round(overall_score, 2),
            "semantic_score": round(semantic_score, 2),
            "skills_score": round(skills_result["score"], 2),
            "experience_score": round(experience_score, 2),
            "education_score": round(education_score, 2),
            "matched_skills": skills_result["matched"],
            "missing_skills": skills_result["missing"],
            "summary": summary
        }


# Singleton
_scorer = None

def get_scorer() -> MatchScorer:
    global _scorer
    if _scorer is None:
        _scorer = MatchScorer()
    return _scorer
