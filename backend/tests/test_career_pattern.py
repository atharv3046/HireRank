import pytest
from app.services.career_pattern import (
    compute_career_pattern_from_ranges,
    extract_career_pattern_from_text,
    detect_title_seniority,
    parse_date_input,
)
from tests.conftest import SAMPLE_RESUMES


class TestCareerPatternComputation:
    """
    Test that promotion_count and short_tenure_flag compute correctly from known date ranges.
    """

    def test_promotion_count_from_contiguous_known_date_ranges(self):
        """
        Known date ranges with consecutive contiguous progression should compute promotions.
        3 roles, contiguous transitions -> 2 promotions, avg tenure 24 months, not short tenure.
        """
        known_ranges = [
            ("Jan 2018", "Dec 2019"),  # 24 months
            ("Jan 2020", "Dec 2021"),  # 24 months (starts within 1 month of previous end)
            ("Jan 2022", "Dec 2023"),  # 24 months (starts within 1 month of previous end)
        ]

        result = compute_career_pattern_from_ranges(known_ranges)

        assert result["roles_count"] == 3
        assert result["promotion_count"] == 2
        assert result["avg_tenure_months"] == 24
        assert result["short_tenure_flag"] is False
        assert result["summary"] == "3 roles · 2 promotions · avg 24mo"

    def test_short_tenure_flag_from_known_short_stints(self):
        """
        Known date ranges with frequent short stints (< 18 months avg, gaps between companies).
        Should flag short_tenure_flag=True and promotion_count=0.
        """
        short_ranges = [
            ("Jan 2020", "Jun 2020"),  # 6 months (Jan-Jun)
            ("Sep 2020", "Feb 2021"),  # 6 months (gap of 2 months)
            ("May 2021", "Nov 2021"),  # 7 months (gap of 2 months)
        ]

        result = compute_career_pattern_from_ranges(short_ranges)

        assert result["roles_count"] == 3
        assert result["promotion_count"] == 0
        assert result["avg_tenure_months"] < 18
        assert result["short_tenure_flag"] is True
        assert "3 roles" in result["summary"]
        assert "avg" in result["summary"]

    def test_promotion_from_title_seniority_progression(self):
        """
        Known roles with title progression (Junior Developer -> Senior Engineer).
        Should detect promotion via title seniority jump.
        """
        roles_with_titles = [
            {"start": "2018-01", "end": "2020-01", "title": "Junior Developer"},
            {"start": "2020-04", "end": "2023-01", "title": "Senior Engineer"},
        ]

        result = compute_career_pattern_from_ranges(roles_with_titles)

        assert result["roles_count"] == 2
        assert result["promotion_count"] == 1
        assert result["short_tenure_flag"] is False
        assert "2 roles · 1 promotion · avg" in result["summary"]

    def test_single_role_not_flagged_as_job_hopper(self):
        """
        A single entry-level role (e.g., 8 months) should not be flagged as a job-hopper.
        """
        single_role = [("Jan 2023", "Aug 2023")]

        result = compute_career_pattern_from_ranges(single_role)

        assert result["roles_count"] == 1
        assert result["promotion_count"] == 0
        assert result["short_tenure_flag"] is False
        assert result["summary"] == "1 role · avg 8mo"

    def test_empty_ranges_graceful(self):
        """Empty or unparseable ranges should return safe defaults without error."""
        result = compute_career_pattern_from_ranges([])

        assert result["roles_count"] == 0
        assert result["promotion_count"] == 0
        assert result["avg_tenure_months"] == 0
        assert result["short_tenure_flag"] is False
        assert "No tenure history" in result["summary"]

    def test_extraction_from_sample_resumes(self):
        """Verify extraction from real resume text produces career pattern."""
        senior_text = SAMPLE_RESUMES["senior_python_dev"]
        pattern = extract_career_pattern_from_text(senior_text)

        assert pattern["roles_count"] >= 2
        assert pattern["avg_tenure_months"] >= 18
        assert pattern["short_tenure_flag"] is False
        assert isinstance(pattern["summary"], str)
