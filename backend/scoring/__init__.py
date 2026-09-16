"""
Standalone Scoring Package
==========================
Zero FastAPI or DB imports.
"""

from scoring.taxonomy import SkillsTaxonomy, get_taxonomy
from scoring.parser import ResumeParser, ParsedResume, ResumeSection, normalise_text, segment_sections
from scoring.extractor import ResumeExtractor, ExtractedProfile, merge_date_intervals
from scoring.scorer import HybridScorer, JobCriteria, ScoreBreakdown, Tier, EmbeddingModel

__all__ = [
    "SkillsTaxonomy",
    "get_taxonomy",
    "ResumeParser",
    "ParsedResume",
    "ResumeSection",
    "normalise_text",
    "segment_sections",
    "ResumeExtractor",
    "ExtractedProfile",
    "merge_date_intervals",
    "HybridScorer",
    "JobCriteria",
    "ScoreBreakdown",
    "Tier",
    "EmbeddingModel",
]
