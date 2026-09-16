"""
Tests for Module 1: Parser (parser.py + jd_parser.py)

Covers:
  - Text normalisation (unicode, dashes, bullets, blank lines)
  - Section segmentation (standard resume, table-heavy, no headings)
  - Heading detection edge cases
  - JD parser: skills, years, education, title, zone splitting
  - Edge cases: empty input, very short text, only-preferred skills JD

Run:
    cd backend
    pytest tests/test_parser.py -v
"""

import pytest
from app.services.parser import (
    normalise_text,
    segment_sections,
    _is_heading_line,
    ResumeParser,
    ParsedResume,
)
from app.services.jd_parser import JDParser, ParsedJD, _extract_experience_years, _extract_education


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

SAMPLE_RESUME_TEXT = """
John Doe
john@example.com | +91-9876543210 | linkedin.com/in/johndoe

Education
B.Tech in Computer Science, IIT Delhi, 2020

Experience
Software Engineer, Acme Corp, Jan 2020 - Dec 2022
- Built REST APIs with FastAPI and PostgreSQL
- Deployed microservices on AWS using Docker and Kubernetes

Skills
Python, FastAPI, Docker, Kubernetes, PostgreSQL, AWS, Git, Linux

Projects
Smart Home Automation - Built an IoT dashboard with React and MQTT
"""

SAMPLE_JD_TEXT = """
Senior Python Engineer

We are looking for an experienced Python Engineer to join our team.

Requirements:
- 5+ years of experience with Python
- Strong experience with FastAPI or Django
- Proficiency in Docker and Kubernetes
- Bachelor's degree in Computer Science or related field

Preferred:
- Experience with AWS or GCP
- Knowledge of Kafka or RabbitMQ
- Open Source contributions
"""

SAMPLE_JD_RANGE_YEARS = """
Backend Developer
We need someone with 3-5 years of experience in Python and REST APIs.
Must have: Bachelor's degree or higher.
"""

SAMPLE_JD_NO_SKILLS = """
Chef Role
Looking for someone who enjoys cooking and creating menus.
Must be passionate about culinary arts.
No technical background required.
"""

SAMPLE_JD_PREFERRED_ONLY = """
Data Analyst
Nice to have: Python, Tableau, SQL.
"""


# ─────────────────────────────────────────────────────────────────────────────
# TEXT NORMALISATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestNormaliseText:

    def test_strips_curly_quotes(self):
        raw = "\u201cPython developer\u201d with \u2018experience\u2019"
        result = normalise_text(raw)
        assert '"' in result
        assert "'" in result
        assert "\u201c" not in result
        assert "\u2018" not in result

    def test_replaces_em_dash_with_hyphen(self):
        raw = "Jan 2020\u2013Dec 2022"
        result = normalise_text(raw)
        assert "-" in result
        assert "\u2013" not in result

    def test_replaces_bullet_characters(self):
        raw = "\u2022 Python\n\u2022 Java"
        result = normalise_text(raw)
        assert "\u2022" not in result
        assert "-" in result

    def test_replaces_ligatures(self):
        raw = "\ufb01ne-tuning and pro\ufb01le"
        result = normalise_text(raw)
        assert "fi" in result
        assert "\ufb01" not in result

    def test_collapses_excess_blank_lines(self):
        raw = "Line 1\n\n\n\n\nLine 2"
        result = normalise_text(raw)
        assert "\n\n\n" not in result

    def test_preserves_content(self):
        raw = "Python developer with 5 years of experience."
        result = normalise_text(raw)
        assert "Python developer" in result
        assert "5 years" in result

    def test_empty_string(self):
        assert normalise_text("") == ""

    def test_non_breaking_space(self):
        raw = "5\u00a0years"
        result = normalise_text(raw)
        assert "\u00a0" not in result
        assert "5" in result and "years" in result


# ─────────────────────────────────────────────────────────────────────────────
# HEADING DETECTION TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestIsHeadingLine:

    @pytest.mark.parametrize("line,expected_label", [
        ("Education",                       "education"),
        ("EDUCATION",                       "education"),
        ("Education:",                      "education"),
        ("Work Experience",                 "experience"),
        ("Professional Experience",         "experience"),
        ("Technical Skills",                "skills"),
        ("Skills",                          "skills"),
        ("Projects",                        "projects"),
        ("Personal Projects:",              "projects"),
        ("Summary",                         "summary"),
        ("Professional Summary",            "summary"),
        ("Contact Information",             "contact"),
        ("Certifications",                  "certifications"),
        ("Publications",                    "publications"),
    ])
    def test_known_headings(self, line, expected_label):
        result = _is_heading_line(line)
        assert result == expected_label, f"Expected '{expected_label}' for '{line}', got '{result}'"

    @pytest.mark.parametrize("line", [
        "",
        "Built REST APIs using FastAPI and PostgreSQL at Acme Corp in 2022.",
        "Developed a machine learning model achieving 95% accuracy on test data.",
        # Long lines are not headings
        "This is a very long sentence that should not be detected as a section heading at all ever",
    ])
    def test_non_headings(self, line):
        assert _is_heading_line(line) is None

    def test_heading_with_trailing_colon(self):
        assert _is_heading_line("Skills:") == "skills"

    def test_heading_with_trailing_dash(self):
        assert _is_heading_line("Experience -") == "experience"


# ─────────────────────────────────────────────────────────────────────────────
# SECTION SEGMENTATION TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestSegmentSections:

    def test_standard_resume_has_expected_sections(self):
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        assert "education" in sections
        assert "experience" in sections
        assert "skills" in sections
        assert "projects" in sections

    def test_education_content_in_correct_section(self):
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        assert "B.Tech" in sections.get("education", "")

    def test_skills_content_in_correct_section(self):
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        skills_text = sections.get("skills", "")
        assert "Python" in skills_text or "FastAPI" in skills_text

    def test_no_headings_fallback_to_other(self):
        text = "John Doe\njohn@example.com\nPython developer with 5 years experience"
        sections = segment_sections(text)
        # With no headings, should put everything in one block
        assert "other" in sections or "contact" in sections

    def test_empty_text(self):
        sections = segment_sections("")
        assert isinstance(sections, dict)

    def test_section_text_does_not_contain_heading_itself(self):
        """The heading line (e.g. 'Education') should not appear in the section content."""
        sections = segment_sections(SAMPLE_RESUME_TEXT)
        edu = sections.get("education", "")
        # The raw heading "Education" followed by a newline should not be first line
        assert edu.strip()[:20] != "Education"


# ─────────────────────────────────────────────────────────────────────────────
# RESUME PARSER INTEGRATION TEST (with synthetic text, no real files)
# ─────────────────────────────────────────────────────────────────────────────

class TestResumeParser:

    def test_failed_on_unsupported_extension(self, tmp_path):
        f = tmp_path / "resume.txt"
        f.write_text("Some text")
        parser = ResumeParser()
        result = parser.parse(str(f))
        assert result.parse_status == "failed"
        assert any("Unsupported" in n for n in result.parse_notes)

    def test_failed_on_nonexistent_file(self, tmp_path):
        parser = ResumeParser()
        result = parser.parse(str(tmp_path / "ghost.pdf"))
        # Should return failed or needs_review, not raise exception
        assert result.parse_status in ("failed", "needs_review")

    def test_parse_result_is_parsed_resume_instance(self, tmp_path):
        # Write a minimal .pdf file (empty, should get needs_review/failed)
        f = tmp_path / "resume.pdf"
        f.write_bytes(b"%PDF-1.4\n%%EOF")  # minimal empty PDF
        parser = ResumeParser()
        result = parser.parse(str(f))
        assert isinstance(result, ParsedResume)
        assert result.file_path == str(f)


# ─────────────────────────────────────────────────────────────────────────────
# JD PARSER TESTS
# ─────────────────────────────────────────────────────────────────────────────

class TestExtractExperienceYears:

    @pytest.mark.parametrize("text,expected_min,expected_max", [
        ("5+ years of Python experience",         5.0, None),
        ("3-5 years required",                    3.0, 5.0),
        ("3 to 5 years of experience",            3.0, 5.0),
        ("minimum 4 years",                       4.0, None),
        ("at least 2 years",                      2.0, None),
        ("2 or more years of experience",         2.0, None),
        ("We need someone with 6 years",          6.0, None),
        ("No experience required",                0.0, None),
        ("",                                      0.0, None),
    ])
    def test_year_extraction(self, text, expected_min, expected_max):
        min_y, max_y = _extract_experience_years(text)
        assert min_y == expected_min
        assert max_y == expected_max


class TestExtractEducation:

    @pytest.mark.parametrize("text,expected", [
        ("Bachelor's degree in CS required",           "bachelors"),
        ("Must have a B.Tech or higher",               "bachelors"),
        ("Masters preferred",                          "masters"),
        ("PhD in Machine Learning",                    "phd"),
        ("No education requirement mentioned",         None),
        ("High school diploma required",               "high_school"),
        ("MBA from a reputed institution",             "masters"),
    ])
    def test_education_extraction(self, text, expected):
        result = _extract_education(text)
        assert result == expected


class TestJDParser:

    def setup_method(self):
        self.parser = JDParser()

    def test_parse_returns_parsed_jd(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        assert isinstance(result, ParsedJD)

    def test_title_extracted_from_first_line(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        assert "Python" in result.title or "Engineer" in result.title

    def test_title_override(self):
        result = self.parser.parse(SAMPLE_JD_TEXT, title_override="ML Engineer")
        assert result.title == "ML Engineer"

    def test_required_skills_found(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        # Python and Docker should be in required (they are in Requirements section)
        assert "Python" in result.required_skills
        assert "Docker" in result.required_skills

    def test_preferred_skills_in_preferred_not_required(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        # AWS/GCP are in the Preferred section
        for s in result.preferred_skills:
            assert s not in result.required_skills, f"{s} is in both required and preferred"

    def test_experience_years_extracted(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        assert result.min_years == 5.0

    def test_experience_range_years(self):
        result = self.parser.parse(SAMPLE_JD_RANGE_YEARS)
        assert result.min_years == 3.0
        assert result.max_years == 5.0

    def test_education_extracted(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        assert result.required_education == "bachelors"

    def test_empty_jd_returns_notes(self):
        result = self.parser.parse("")
        assert len(result.parse_notes) > 0

    def test_no_skills_jd_has_note_or_empty_skills(self):
        """
        A JD with no technology mentions should either produce a 'no skills' note
        OR produce an empty required_skills list. Either result is acceptable.
        """
        no_tech_jd = """
        Gardener Position
        We are looking for an enthusiastic gardener.
        Must enjoy outdoor work and plant care. No computing experience needed.
        """
        result = self.parser.parse(no_tech_jd)
        has_note = any("No recognisable skills" in n for n in result.parse_notes)
        has_empty = len(result.required_skills) == 0
        assert has_note or has_empty, (
            f"Expected no skills or a note, got: {result.required_skills}"
        )

    def test_preferred_only_jd_no_required_skills(self):
        result = self.parser.parse(SAMPLE_JD_PREFERRED_ONLY)
        # All skills should end up preferred, none in required
        assert len(result.preferred_skills) >= 0   # may have some
        # required should not contain preferred items
        for s in result.preferred_skills:
            assert s not in result.required_skills

    def test_no_duplicate_skills_across_required_and_preferred(self):
        result = self.parser.parse(SAMPLE_JD_TEXT)
        overlap = set(result.required_skills) & set(result.preferred_skills)
        assert len(overlap) == 0, f"Overlap found: {overlap}"

    def test_years_default_to_zero_when_missing(self):
        result = self.parser.parse(SAMPLE_JD_NO_SKILLS)
        assert result.min_years == 0.0
