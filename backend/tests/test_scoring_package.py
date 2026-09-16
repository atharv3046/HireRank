"""
Comprehensive Unit Test Suite for Standalone scoring/ Package
=============================================================
Tests parsing, timeline overlap merging, rapidfuzz skill alias reduction,
trapezoidal experience fit, 59.9 must-have capping, and 4-tier assignment.
Guarantees zero FastAPI or database dependencies.
"""

import sys
import tempfile
from pathlib import Path
import pytest

from scoring import (
    SkillsTaxonomy,
    get_taxonomy,
    ResumeParser,
    ParsedResume,
    normalise_text,
    segment_sections,
    ResumeExtractor,
    ExtractedProfile,
    merge_date_intervals,
    HybridScorer,
    JobCriteria,
    ScoreBreakdown,
    Tier,
)


class TestZeroFastapiDependency:
    """Ensure the scoring package has zero imports from FastAPI or SQLAlchemy."""

    def test_no_fastapi_or_db_imports(self):
        forbidden = {"fastapi", "starlette", "sqlalchemy"}
        import scoring
        import scoring.taxonomy
        import scoring.parser
        import scoring.extractor
        import scoring.scorer

        scoring_modules = [
            scoring,
            scoring.taxonomy,
            scoring.parser,
            scoring.extractor,
            scoring.scorer,
        ]

        for mod in scoring_modules:
            for attr in dir(mod):
                obj = getattr(mod, attr)
                if hasattr(obj, "__module__") and obj.__module__:
                    top_pkg = obj.__module__.split(".")[0]
                    assert top_pkg not in forbidden, f"Forbidden import {top_pkg} found in {mod.__name__}.{attr}"


class TestSkillsTaxonomy:
    """Test skill normalization and RapidFuzz alias mapping."""

    @pytest.fixture
    def taxonomy(self):
        return get_taxonomy()

    def test_exact_canonical_match(self, taxonomy):
        assert taxonomy.normalize_skill("Python") == "Python"
        assert taxonomy.normalize_skill("python") == "Python"
        assert taxonomy.normalize_skill("FastAPI") == "FastAPI"

    def test_registered_aliases(self, taxonomy):
        # React aliases
        assert taxonomy.normalize_skill("ReactJS") == "React"
        assert taxonomy.normalize_skill("React.js") == "React"
        assert taxonomy.normalize_skill("react.js") == "React"

        # Postgres aliases
        assert taxonomy.normalize_skill("Postgres") == "PostgreSQL"
        assert taxonomy.normalize_skill("postgres") == "PostgreSQL"

        # Kubernetes aliases
        assert taxonomy.normalize_skill("K8s") == "Kubernetes"
        assert taxonomy.normalize_skill("k8s") == "Kubernetes"

    def test_rapidfuzz_alias_matching(self, taxonomy):
        # Slightly mistyped or accented aliases
        assert taxonomy.normalize_skill("PostgreSql") == "PostgreSQL"
        assert taxonomy.normalize_skill("Typescript") == "TypeScript"
        assert taxonomy.normalize_skill("Javascript") == "JavaScript"

    def test_unknown_skill_returns_cleaned(self, taxonomy):
        assert taxonomy.normalize_skill("VeryNicheCustomToolX") == "VeryNicheCustomToolX"


class TestParserAndNormalization:
    """Test text normalization, section segmentation, and unparseable file handling."""

    def test_unicode_and_ligature_normalization(self):
        raw = "Experienced in ﬁnancial systems. • Python • Docker. “Good” code."
        norm = normalise_text(raw)
        assert "financial" in norm  # 'ﬁ' ligature expanded
        assert "- Python" in norm   # bullet normalized
        assert '"Good"' in norm     # curly quotes normalized

    def test_segment_sections(self):
        text = (
            "Alex Smith\nalex@example.com\n\n"
            "EDUCATION\n"
            "B.S. in Computer Science, 2020\n\n"
            "EXPERIENCE\n"
            "Senior Developer at Acme Corp (2020 - Present)\n\n"
            "TECHNICAL SKILLS\n"
            "Python, Docker, FastAPI"
        )
        sections = segment_sections(text)
        assert "education" in sections
        assert "experience" in sections
        assert "skills" in sections
        assert "B.S. in Computer Science" in sections["education"]
        assert "Acme Corp" in sections["experience"]
        assert "Python, Docker" in sections["skills"]

    def test_unparseable_or_empty_file_triggers_manual_review(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(b"%PDF-1.4 corrupt gibberish without font or pages")
            temp_path = Path(f.name)

        try:
            parsed = ResumeParser.parse(temp_path)
            assert parsed.needs_manual_review is True
            assert parsed.parse_status == "needs_manual_review"
            assert len(parsed.parse_notes) > 0
        finally:
            temp_path.unlink(missing_ok=True)

    def test_nonexistent_file(self):
        parsed = ResumeParser.parse("nonexistent_resume_file.pdf")
        assert parsed.needs_manual_review is True
        assert parsed.parse_status == "failed"


class TestExtractorTimelineMerging:
    """Test timeline extraction and overlapping interval arithmetic."""

    def test_disjoint_intervals_merged_correctly(self):
        # Job 1: 2018-01 to 2019-12 (24 months)
        # Job 2: 2021-01 to 2022-12 (24 months)
        # Total = 48 months = 4.0 years
        intervals = [
            ((2018, 1), (2019, 12)),
            ((2021, 1), (2022, 12)),
        ]
        merged = merge_date_intervals(intervals)
        assert len(merged) == 2
        months = sum((e[0] - s[0]) * 12 + (e[1] - s[1]) for s, e in merged)
        assert months == 46  # (2019-2018)*12 + (12-1) = 23 months each = 46 months

    def test_overlapping_intervals_do_not_duplicate_experience(self):
        # Parallel roles:
        # Job A: Jan 2020 (2020, 1) to Dec 2021 (2021, 12)  [24 months]
        # Job B (Part-time / overlapping): Jun 2021 (2021, 6) to Jun 2022 (2022, 6)
        # True continuous span is Jan 2020 to Jun 2022 = 30 months (2.5 years)
        # Without merging, naive addition gives 24 + 12 = 36 months (3.0 years) - WRONG!
        intervals = [
            ((2020, 1), (2021, 12)),
            ((2021, 6), (2022, 6)),
        ]
        merged = merge_date_intervals(intervals)
        assert len(merged) == 1
        assert merged[0] == ((2020, 1), (2022, 6))

    def test_experience_extraction_from_text(self):
        extractor = ResumeExtractor()
        text = (
            "Work Experience\n"
            "Software Engineer - CloudTech\n"
            "Jan 2020 - Dec 2022\n"
            "Backend Developer - DataSoft\n"
            "Jan 2018 - Dec 2019\n"
        )
        years, raw_ranges = extractor.extract_experience_years(text)
        assert years >= 3.8  # ~4 years total
        assert len(raw_ranges) == 2


class TestTrapezoidalExperienceScoring:
    """Test trapezoidal experience target band fit."""

    @pytest.fixture
    def scorer(self):
        return HybridScorer()

    def test_inside_target_band_full_credit(self, scorer):
        # Target: 3 to 7 years
        assert scorer.calculate_experience_score(3.0, 3.0, 7.0) == 100.0
        assert scorer.calculate_experience_score(5.0, 3.0, 7.0) == 100.0
        assert scorer.calculate_experience_score(7.0, 3.0, 7.0) == 100.0

    def test_below_target_band_linear_falloff(self, scorer):
        # Target: 4 years. Margin low is 2.5 years (floor is 1.5 years)
        score_3 = scorer.calculate_experience_score(3.0, 4.0, 8.0)
        score_2 = scorer.calculate_experience_score(2.0, 4.0, 8.0)
        score_0 = scorer.calculate_experience_score(0.5, 4.0, 8.0)

        assert 0.0 < score_3 < 100.0
        assert 0.0 < score_2 < score_3
        assert score_0 == 0.0  # Far below target

    def test_above_target_band_overqualification(self, scorer):
        # Target: 3 to 6 years. Candidate has 10 years.
        score_10 = scorer.calculate_experience_score(10.0, 3.0, 6.0)
        # Should be penalized gently for overqualification, but not zero
        assert 50.0 <= score_10 < 100.0


class TestMustHaveCappingAndTiers:
    """Test 59.9 score capping for missing must-have skills and 4-tier assignments."""

    @pytest.fixture
    def scorer(self):
        return HybridScorer()

    def test_missing_must_have_skill_capped_at_59_9(self, scorer):
        job = JobCriteria(
            title="Senior Python Architect",
            description="Leading microservices with Python, FastAPI, Docker, and Kubernetes.",
            required_skills=["Python", "FastAPI", "Docker", "Kubernetes"],
            min_years=4.0,
            max_years=8.0,
            required_education="bachelors"
        )

        # Candidate is strong in everything, but MISSING Kubernetes
        candidate = ExtractedProfile(
            name="Jane Doe",
            email="jane@example.com",
            skills=["Python", "FastAPI", "Docker", "PostgreSQL", "Redis"],
            years_experience=6.0,
            education_level="masters",
            detected_title="Senior Python Developer",
            raw_text="Senior Python Developer with 6 years experience building FastAPI services with Docker."
        )

        # Provide high mock embeddings so raw score would easily exceed 80
        high_sim_vector = [0.1] * 384
        breakdown = scorer.score_candidate(
            candidate,
            job,
            candidate_embedding=high_sim_vector,
            job_embedding=high_sim_vector
        )

        assert "Kubernetes" in breakdown.missing_required_skills
        assert breakdown.is_capped is True
        assert breakdown.final_score == 59.9
        # Per user instruction: Capping at 59.9 keeps them in POTENTIAL tier (55 - 74.9), NOT Low
        assert breakdown.tier == Tier.POTENTIAL
        assert "Missing must-have skill(s)" in breakdown.cap_reason

    def test_all_requirements_met_earns_strong_tier(self, scorer):
        job = JobCriteria(
            title="Python Developer",
            description="Building APIs with Python and FastAPI.",
            required_skills=["Python", "FastAPI"],
            min_years=2.0,
            max_years=5.0,
            required_education="bachelors"
        )

        candidate = ExtractedProfile(
            name="John Developer",
            skills=["Python", "FastAPI"],
            years_experience=3.5,
            education_level="bachelors",
            detected_title="Python Developer",
            raw_text="Experienced Python Developer building FastAPI REST APIs for 3 years."
        )

        identical_vec = [0.2] * 384
        breakdown = scorer.score_candidate(
            candidate,
            job,
            candidate_embedding=identical_vec,
            job_embedding=identical_vec
        )

        assert breakdown.is_capped is False
        assert breakdown.final_score is not None
        assert breakdown.final_score >= 75.0
        assert breakdown.tier == Tier.STRONG

    def test_unparseable_file_score_is_none_and_tier_is_needs_review(self, scorer):
        job = JobCriteria(
            title="Backend Engineer",
            description="Python engineer",
            required_skills=["Python"]
        )
        empty_candidate = ExtractedProfile(raw_text="")

        breakdown = scorer.score_candidate(
            empty_candidate,
            job,
            needs_manual_review=True
        )

        # Must NOT generate a synthetic score
        assert breakdown.final_score is None
        assert breakdown.tier == Tier.NEEDS_REVIEW
        assert breakdown.needs_manual_review is True
        assert any("Unable to parse" in note for note in breakdown.explanation_notes)
        assert breakdown.to_dict()["final_score"] is None
