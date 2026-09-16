"""
Standalone Hybrid Match Scorer & Ranking Engine
===============================================
Computes composite match score based on:
  - 35% Semantic Similarity (sentence-transformers dense 384-dim embeddings)
  - 30% Skill Coverage (canonical matching with must-have penalty capping)
  - 20% Experience Fit (trapezoidal target band fit with linear falloff)
  - 10% Title Relevance (semantic & keyword alignment)
  - 05% Education Match (ordinal degree requirement fit)

CRITICAL RULES:
1. Missing must-have skills cap the final score at 59.9 (Potential tier),
   preventing non-qualifying candidates from reaching Strong (>= 75) without
   unfairly demoting them to Low (< 55).
2. Trapezoidal experience fit awards 100% inside [min_years, max_years] band,
   falling off linearly outside, floored at 0.
3. Unparseable files (needs_manual_review=True) receive final_score=None
   and tier="Needs Review" with zero fake scores.
4. Zero FastAPI or database imports.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Any
import numpy as np

from scoring.taxonomy import SkillsTaxonomy, get_taxonomy
from scoring.extractor import ExtractedProfile, EDUCATION_ORDINAL

logger = logging.getLogger(__name__)


class Tier(str, Enum):
    STRONG = "Strong"
    POTENTIAL = "Potential"
    LOW = "Low"
    NEEDS_REVIEW = "Needs Review"


@dataclass
class JobCriteria:
    """Requirements against which candidates are scored."""
    title: str
    description: str
    required_skills: List[str]                  # Must-have skills
    preferred_skills: List[str] = field(default_factory=list) # Nice-to-have skills
    min_years: float = 0.0
    max_years: Optional[float] = None           # If None, defaults to min_years + 4.0
    required_education: Optional[str] = None    # phd/masters/bachelors/associate/high_school
    weights: Optional[Dict[str, float]] = None  # Optional custom weights


@dataclass
class ScoreBreakdown:
    """Full explainable ranking output."""
    final_score: Optional[float]
    tier: Tier
    semantic_score: Optional[float] = None
    skills_score: Optional[float] = None
    experience_score: Optional[float] = None
    title_score: Optional[float] = None
    education_score: Optional[float] = None
    matched_required_skills: List[str] = field(default_factory=list)
    missing_required_skills: List[str] = field(default_factory=list)
    matched_preferred_skills: List[str] = field(default_factory=list)
    missing_preferred_skills: List[str] = field(default_factory=list)
    is_capped: bool = False
    cap_reason: Optional[str] = None
    needs_manual_review: bool = False
    explanation_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "final_score": self.final_score,
            "tier": self.tier.value,
            "semantic_score": self.semantic_score,
            "skills_score": self.skills_score,
            "experience_score": self.experience_score,
            "title_score": self.title_score,
            "education_score": self.education_score,
            "matched_required_skills": self.matched_required_skills,
            "missing_required_skills": self.missing_required_skills,
            "matched_preferred_skills": self.matched_preferred_skills,
            "missing_preferred_skills": self.missing_preferred_skills,
            "is_capped": self.is_capped,
            "cap_reason": self.cap_reason,
            "needs_manual_review": self.needs_manual_review,
            "explanation_notes": self.explanation_notes,
        }


class EmbeddingModel:
    """Singleton wrapper for sentence-transformers all-MiniLM-L6-v2."""
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_model(self):
        if self._model is None:
            logger.info("Loading sentence-transformers all-MiniLM-L6-v2 model...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    def encode(self, text: str) -> List[float]:
        cleaned = text.replace("\n", " ").strip()[:8000]
        if not cleaned:
            return [0.0] * 384
        model = self.get_model()
        vec = model.encode([cleaned], convert_to_numpy=True)[0]
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        if not v1 or not v2:
            return 0.0
        a = np.array(v1, dtype=np.float32)
        b = np.array(v2, dtype=np.float32)
        dot = np.dot(a, b)
        denom = (np.linalg.norm(a) * np.linalg.norm(b))
        if denom == 0:
            return 0.0
        sim = float(dot / denom)
        # Normalize [-1, 1] to [0, 100]
        norm = (sim + 1.0) / 2.0 * 100.0
        return round(min(100.0, max(0.0, norm)), 2)


class HybridScorer:
    """
    Evaluates candidate profiles against job criteria using a weighted
    hybrid scoring model with must-have capping and trapezoidal fit.
    """

    DEFAULT_WEIGHTS = {
        "semantic": 0.35,
        "skills": 0.30,
        "experience": 0.20,
        "title": 0.10,
        "education": 0.05,
    }

    # Hard cap value for candidates missing any must-have required skill
    MUST_HAVE_CAP = 59.9

    def __init__(self, taxonomy: Optional[SkillsTaxonomy] = None):
        self.taxonomy = taxonomy or get_taxonomy()
        self.embedder = EmbeddingModel()

    def calculate_experience_score(
        self,
        candidate_years: float,
        min_years: float,
        max_years: Optional[float] = None
    ) -> float:
        """
        Trapezoidal experience fit:
          - Full 100% credit inside [min_years, max_years]
          - Linear falloff below min_years (floored at 0)
          - Linear falloff above max_years for overqualification (floored at 0)
        """
        cand = max(0.0, float(candidate_years or 0.0))
        target_min = max(0.0, float(min_years or 0.0))
        target_max = float(max_years) if max_years is not None else target_min + 4.0

        if target_max < target_min:
            target_max = target_min + 4.0

        # Inside target band -> 100%
        if target_min <= cand <= target_max:
            return 100.0

        # Below target band: linear falloff down to 0
        if cand < target_min:
            if target_min == 0.0:
                return 100.0
            margin_low = min(target_min, 2.5)
            floor_point = target_min - margin_low
            if cand <= floor_point:
                return 0.0
            ratio = (cand - floor_point) / margin_low
            return round(min(100.0, max(0.0, ratio * 100.0)), 2)

        # Above target band (overqualification): gentle linear falloff
        falloff_margin = 6.0
        over = cand - target_max
        if over >= falloff_margin:
            return 50.0  # Cap overqualification penalty at 50% rather than 0%
        penalty = (over / falloff_margin) * 50.0
        return round(max(50.0, 100.0 - penalty), 2)

    def calculate_skills_score(
        self,
        candidate_skills: List[str],
        required_skills: List[str],
        preferred_skills: List[str]
    ) -> Tuple[float, List[str], List[str], List[str], List[str]]:
        """
        Match normalized skills and report matched/missing required and preferred skills.
        """
        cand_set = {self.taxonomy.normalize_skill(s).lower() for s in candidate_skills}

        matched_req: List[str] = []
        missing_req: List[str] = []

        for req in required_skills:
            norm_req = self.taxonomy.normalize_skill(req)
            if norm_req.lower() in cand_set:
                matched_req.append(norm_req)
            else:
                missing_req.append(norm_req)

        matched_pref: List[str] = []
        missing_pref: List[str] = []

        for pref in preferred_skills:
            norm_pref = self.taxonomy.normalize_skill(pref)
            if norm_pref.lower() in cand_set:
                matched_pref.append(norm_pref)
            else:
                missing_pref.append(norm_pref)

        # Skills score computation
        if not required_skills and not preferred_skills:
            return 100.0, [], [], [], []

        if required_skills:
            req_ratio = len(matched_req) / len(required_skills)
        else:
            req_ratio = 1.0

        if preferred_skills:
            pref_ratio = len(matched_pref) / len(preferred_skills)
            # 85% required + 15% preferred bonus
            skills_score = (req_ratio * 85.0) + (pref_ratio * 15.0)
        else:
            skills_score = req_ratio * 100.0

        return round(min(100.0, max(0.0, skills_score)), 2), matched_req, missing_req, matched_pref, missing_pref

    def calculate_education_score(
        self,
        candidate_degree: Optional[str],
        required_degree: Optional[str]
    ) -> float:
        """Ordinal degree comparison."""
        if not required_degree:
            return 100.0
        if not candidate_degree:
            return 20.0  # Unspecified degree

        cand_ord = EDUCATION_ORDINAL.get(candidate_degree.lower(), 0)
        req_ord = EDUCATION_ORDINAL.get(required_degree.lower(), 0)

        if cand_ord >= req_ord:
            return 100.0
        elif cand_ord == req_ord - 1:
            return 65.0
        else:
            return 25.0

    def calculate_title_score(
        self,
        candidate_title: Optional[str],
        target_title: str
    ) -> float:
        """Semantic and token overlap score for job title."""
        if not target_title:
            return 100.0
        if not candidate_title:
            return 50.0  # Neutral if no title detected

        v1 = self.embedder.encode(candidate_title)
        v2 = self.embedder.encode(target_title)
        return self.embedder.cosine_similarity(v1, v2)

    def score_candidate(
        self,
        candidate: ExtractedProfile,
        job: JobCriteria,
        candidate_embedding: Optional[List[float]] = None,
        job_embedding: Optional[List[float]] = None,
        needs_manual_review: bool = False
    ) -> ScoreBreakdown:
        """Score candidate against JobCriteria with all explainability notes."""

        # Handle unparseable files
        if needs_manual_review:
            return ScoreBreakdown(
                final_score=None,
                tier=Tier.NEEDS_REVIEW,
                needs_manual_review=True,
                explanation_notes=["Unable to parse — review manually. File could not be read cleanly."]
            )

        # 1. Semantic Similarity
        if candidate_embedding is None:
            candidate_embedding = self.embedder.encode(candidate.raw_text)
        if job_embedding is None:
            job_embedding = self.embedder.encode(f"{job.title}\n{job.description}")

        semantic_score = self.embedder.cosine_similarity(candidate_embedding, job_embedding)

        # 2. Skill Coverage
        skills_score, matched_req, missing_req, matched_pref, missing_pref = self.calculate_skills_score(
            candidate.skills, job.required_skills, job.preferred_skills
        )

        # 3. Experience Fit (Trapezoidal)
        exp_score = self.calculate_experience_score(
            candidate.years_experience, job.min_years, job.max_years
        )

        # 4. Title Relevance
        title_score = self.calculate_title_score(
            candidate.detected_title, job.title
        )

        # 5. Education Fit
        edu_score = self.calculate_education_score(
            candidate.education_level, job.required_education
        )

        # 6. Weighted Composite
        w = job.weights or self.DEFAULT_WEIGHTS
        raw_score = (
            w.get("semantic", 0.35) * semantic_score +
            w.get("skills", 0.30) * skills_score +
            w.get("experience", 0.20) * exp_score +
            w.get("title", 0.10) * title_score +
            w.get("education", 0.05) * edu_score
        )
        raw_score = round(min(100.0, max(0.0, raw_score)), 1)

        # 7. Must-Have Penalty Capping
        is_capped = False
        cap_reason = None
        final_score = raw_score
        notes: List[str] = []

        if missing_req:
            if final_score > self.MUST_HAVE_CAP:
                final_score = self.MUST_HAVE_CAP
                is_capped = True
                cap_reason = f"Missing must-have skill(s) [{', '.join(missing_req)}] capped score at {self.MUST_HAVE_CAP}%"
                notes.append(cap_reason)
            else:
                notes.append(f"Missing must-have skill(s): {', '.join(missing_req)}")

        # 8. Tier Assignment
        if final_score >= 75.0:
            tier = Tier.STRONG
        elif final_score >= 55.0:
            tier = Tier.POTENTIAL
        else:
            tier = Tier.LOW

        return ScoreBreakdown(
            final_score=final_score,
            tier=tier,
            semantic_score=semantic_score,
            skills_score=skills_score,
            experience_score=exp_score,
            title_score=title_score,
            education_score=edu_score,
            matched_required_skills=matched_req,
            missing_required_skills=missing_req,
            matched_preferred_skills=matched_pref,
            missing_preferred_skills=missing_pref,
            is_capped=is_capped,
            cap_reason=cap_reason,
            needs_manual_review=False,
            explanation_notes=notes,
        )
