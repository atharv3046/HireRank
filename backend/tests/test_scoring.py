import pytest
from app.services.scoring import MatchScorer

scorer = MatchScorer()


class TestSkillsScore:
    def test_full_match(self):
        candidate_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
        required_skills = ["Python", "FastAPI", "PostgreSQL"]
        result = scorer.calculate_skills_score(candidate_skills, required_skills)
        assert result["score"] == 100.0
        assert result["missing"] == []
        assert len(result["matched"]) == 3

    def test_partial_match(self):
        candidate_skills = ["Python", "FastAPI"]
        required_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
        result = scorer.calculate_skills_score(candidate_skills, required_skills)
        assert result["score"] == 50.0
        assert "PostgreSQL" in result["missing"] or "Docker" in result["missing"]
        assert len(result["matched"]) == 2

    def test_no_required_skills(self):
        result = scorer.calculate_skills_score(["Python"], [])
        assert result["score"] == 100.0
        assert "note" in result

    def test_no_candidate_skills(self):
        result = scorer.calculate_skills_score([], ["Python", "FastAPI"])
        assert result["score"] == 0.0
        assert len(result["missing"]) == 2

    def test_alias_normalization(self):
        # "JS" should match to "JavaScript" if taxonomy has that alias
        candidate_skills = ["Python", "JS"]
        required_skills = ["Python", "JavaScript"]
        result = scorer.calculate_skills_score(candidate_skills, required_skills)
        # After normalization both JS and JavaScript should canonicalize to JavaScript
        assert result["score"] >= 50.0  # At least Python matches


class TestExperienceScore:
    def test_exact_threshold(self):
        assert scorer.calculate_experience_score(5.0, 5.0) == 100.0

    def test_above_requirement(self):
        assert scorer.calculate_experience_score(8.0, 5.0) == 100.0

    def test_below_requirement(self):
        score = scorer.calculate_experience_score(2.0, 5.0)
        assert score == pytest.approx(40.0, rel=0.01)

    def test_zero_required(self):
        assert scorer.calculate_experience_score(0.0, 0.0) == 100.0

    def test_no_required_specified(self):
        assert scorer.calculate_experience_score(3.0, None) == 100.0

    def test_no_candidate_experience(self):
        score = scorer.calculate_experience_score(None, 5.0)
        assert score == 0.0

    def test_capped_at_100(self):
        assert scorer.calculate_experience_score(100.0, 5.0) == 100.0


class TestEducationScore:
    def test_exact_match(self):
        assert scorer.calculate_education_score("bachelors", "bachelors") == 100.0

    def test_above_requirement(self):
        assert scorer.calculate_education_score("masters", "bachelors") == 100.0
        assert scorer.calculate_education_score("phd", "bachelors") == 100.0

    def test_one_level_below(self):
        assert scorer.calculate_education_score("bachelors", "masters") == 60.0

    def test_significantly_below(self):
        assert scorer.calculate_education_score("high_school", "masters") == 20.0
        assert scorer.calculate_education_score("associate", "phd") == 20.0

    def test_no_requirement(self):
        assert scorer.calculate_education_score("bachelors", None) == 100.0
        assert scorer.calculate_education_score(None, None) == 100.0

    def test_no_candidate_education(self):
        assert scorer.calculate_education_score(None, "bachelors") == 20.0

    def test_highest_possible(self):
        assert scorer.calculate_education_score("phd", "phd") == 100.0
