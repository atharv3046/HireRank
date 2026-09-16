"""
Module 1: Job Description (JD) Parser
=======================================
Parses a raw job description string into structured fields:
  - title          : inferred job title
  - required_skills: list of must-have skills (from taxonomy)
  - preferred_skills: list of nice-to-have skills
  - min_years      : minimum years of experience required
  - max_years      : maximum years of experience (None if not stated)
  - required_education: canonical education level
  - target_titles  : normalised job title(s) mentioned

Design choices
--------------
- Pure regex + keyword extraction. No LLM calls.
- "Required" and "Preferred" sections are detected by heading keywords.
  Skills that appear in no labelled section default to "required".
- Years of experience extracted by a set of patterns covering the most common
  English phrasings: "3+ years", "3-5 years", "minimum 3 years", "at least 3".
- Education level uses the same ordinal taxonomy as the scoring module.
- The skill extractor uses the expanded skills_taxonomy.json with fuzzy alias
  matching so "ReactJS", "React.js", "React" all map to "React".
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

TAXONOMY_PATH = Path(__file__).parent.parent / "data" / "skills_taxonomy.json"

EDUCATION_LEVELS = {
    "phd": 5, "ph.d": 5, "doctorate": 5, "doctoral": 5,
    "masters": 4, "master": 4, "m.s": 4, "m.sc": 4, "m.tech": 4, "mba": 4, "m.e": 4,
    "bachelors": 3, "bachelor": 3, "b.s": 3, "b.sc": 3, "b.tech": 3,
    "b.e": 3, "undergraduate": 3, "b.a": 3,
    "associate": 2, "a.s": 2, "a.a": 2,
    # "high school" is a two-word phrase — must match before "school" alone
    "high school": 1, "high school diploma": 1, "secondary school": 1,
    "secondary": 1, "12th": 1, "diploma": 1,
}

# Canonical education level name for each ordinal
ORDINAL_TO_LABEL = {5: "phd", 4: "masters", 3: "bachelors", 2: "associate", 1: "high_school"}


# ──────────────────────────────────────────────────────────────────────────────
# Data Structure
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ParsedJD:
    """Structured output of JDParser.parse()."""
    raw_text: str
    title: str                                         # e.g. "Senior Python Engineer"
    required_skills: list[str] = field(default_factory=list)
    preferred_skills: list[str] = field(default_factory=list)
    min_years: float = 0.0
    max_years: Optional[float] = None
    required_education: Optional[str] = None           # canonical: 'bachelors', 'masters', etc.
    target_titles: list[str] = field(default_factory=list)
    parse_notes: list[str] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# Skill Alias Map (loaded once from taxonomy)
# ──────────────────────────────────────────────────────────────────────────────

_ALIAS_MAP: dict[str, str] | None = None   # alias.lower() -> canonical

def _load_alias_map() -> dict[str, str]:
    global _ALIAS_MAP
    if _ALIAS_MAP is None:
        try:
            with open(TAXONOMY_PATH, encoding="utf-8") as f:
                data = json.load(f)
            _ALIAS_MAP = {}
            for entry in data:
                canonical = entry["canonical"]
                _ALIAS_MAP[canonical.lower()] = canonical
                for alias in entry.get("aliases", []):
                    _ALIAS_MAP[alias.lower()] = canonical
        except Exception as e:
            logger.error("Failed to load skills taxonomy: %s", e)
            _ALIAS_MAP = {}
    return _ALIAS_MAP


def _match_skills_in_text(text: str) -> list[str]:
    """
    Find all canonical skills mentioned in text using the alias map.
    Returns deduplicated list of canonical skill names.
    Uses \\b word boundaries on the lowercased text to avoid false matches
    (e.g. 'R' inside 'React', 'Go' inside 'Django').
    """
    alias_map = _load_alias_map()
    found: set[str] = set()
    text_lower = text.lower()

    for alias, canonical in alias_map.items():
        escaped = re.escape(alias.lower())
        # \b works correctly on lowercase ASCII; handles "react" not matching "reactive"
        # For aliases that start/end with non-word chars (e.g. "C++"), skip \b on that side
        left_b  = r"\b" if re.match(r"\w", escaped[0]) else ""
        right_b = r"\b" if re.match(r"\w", escaped[-1]) else ""
        pattern = left_b + escaped + right_b
        try:
            if re.search(pattern, text_lower):
                found.add(canonical)
        except re.error:
            pass   # skip malformed patterns

    return sorted(found)


# ──────────────────────────────────────────────────────────────────────────────
# Experience Year Extraction
# ──────────────────────────────────────────────────────────────────────────────

# Covers the most common English phrasings
_YEAR_PATTERNS: list[re.Pattern] = [
    # "3-5 years" / "3 to 5 years" → min=3, max=5
    re.compile(r"(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*(?:\+\s*)?years?", re.I),
    # "3+ years" / "3 or more years" → min=3
    re.compile(r"(\d+(?:\.\d+)?)\s*\+\s*years?", re.I),
    re.compile(r"(\d+(?:\.\d+)?)\s*or\s*more\s*years?", re.I),
    re.compile(r"(\d+(?:\.\d+)?)\s*plus\s*years?", re.I),
    # "at least 3 years" / "minimum 3 years"
    re.compile(r"(?:at\s+least|minimum|min\.?)\s*(\d+(?:\.\d+)?)\s*years?", re.I),
    # "5 years of experience"
    re.compile(r"(\d+(?:\.\d+)?)\s*years?\s+of\s+(?:relevant\s+|related\s+)?experience", re.I),
    # fallback: bare "5 years"
    re.compile(r"(\d+(?:\.\d+)?)\s*years?", re.I),
]

def _extract_experience_years(text: str) -> tuple[float, Optional[float]]:
    """
    Returns (min_years, max_years).
    Tries patterns in priority order; returns (0.0, None) if nothing found.
    """
    # Range pattern first
    range_pat = _YEAR_PATTERNS[0]
    m = range_pat.search(text)
    if m:
        lo, hi = float(m.group(1)), float(m.group(2))
        return min(lo, hi), max(lo, hi)

    # Single-value patterns
    for pat in _YEAR_PATTERNS[1:]:
        m = pat.search(text)
        if m:
            years = float(m.group(1))
            # Sanity check: ignore if value looks unreasonable
            if 0 < years <= 40:
                return years, None

    return 0.0, None


# ──────────────────────────────────────────────────────────────────────────────
# Education Level Extraction
# ──────────────────────────────────────────────────────────────────────────────

def _extract_education(text: str) -> Optional[str]:
    """
    Scan for education keywords and return the canonical label for the
    highest-level degree mentioned.
    Longer phrases are checked first to avoid 'school' matching inside
    'high school'.
    """
    text_lower = text.lower()
    highest = 0

    # Sort by keyword length descending → "high school diploma" checked before "diploma"
    for keyword, ordinal in sorted(EDUCATION_LEVELS.items(), key=lambda x: -len(x[0])):
        escaped = re.escape(keyword)
        pattern = r"(?<![a-z])" + escaped + r"(?![a-z])"
        if re.search(pattern, text_lower) and ordinal > highest:
            highest = ordinal

    return ORDINAL_TO_LABEL.get(highest)


# ──────────────────────────────────────────────────────────────────────────────
# Title Extraction
# ──────────────────────────────────────────────────────────────────────────────

def _extract_title(text: str) -> str:
    """
    Heuristic title extraction:
    1. First non-empty line of the JD is often the job title.
    2. Look for lines containing common title keywords.
    3. Fall back to empty string.
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return ""

    # First line heuristic (JDs usually start with the title)
    first = lines[0]
    if len(first) < 80 and not first.endswith(":"):
        return first

    # Search for explicit "Position:", "Job Title:", "Role:" labels
    title_label = re.compile(r"(?:position|job\s*title|role|opening)\s*:?\s*(.+)", re.I)
    for line in lines[:10]:
        m = title_label.match(line)
        if m:
            return m.group(1).strip()

    return first


# ──────────────────────────────────────────────────────────────────────────────
# Section Splitter for JD
# ──────────────────────────────────────────────────────────────────────────────

# Headings that signal "required" content
_REQUIRED_HEADS = re.compile(
    r"^(requirements?|required|must[\s-]have|mandatory|qualifications?"
    r"|what\s+you('ll|'d)?\s+(need|bring)|minimum\s+qualifications?)", re.I
)

# Headings that signal "preferred / nice-to-have" content
_PREFERRED_HEADS = re.compile(
    r"^(preferred|nice[\s-]to[\s-]have|bonus|desired|advantages?|optional"
    r"|what\s+would\s+be\s+(a\s+)?plus)", re.I
)


def _split_jd_into_zones(text: str) -> dict[str, str]:
    """
    Divide JD text into 'required', 'preferred', and 'general' zones.
    Used so skills appearing in "Preferred" are tagged as preferred, not required.
    """
    lines = text.split("\n")
    zones: dict[str, list[str]] = {"general": [], "required": [], "preferred": []}
    current = "general"

    for line in lines:
        stripped = line.strip().rstrip(":").strip()
        if _REQUIRED_HEADS.match(stripped):
            current = "required"
        elif _PREFERRED_HEADS.match(stripped):
            current = "preferred"
        else:
            zones[current].append(line)

    return {k: "\n".join(v) for k, v in zones.items()}


# ──────────────────────────────────────────────────────────────────────────────
# Main JD Parser
# ──────────────────────────────────────────────────────────────────────────────

class JDParser:
    """
    Parse a job description string into a ParsedJD dataclass.

    Usage:
        parser = JDParser()
        result: ParsedJD = parser.parse("Senior Python Engineer\\n...")
    """

    def parse(self, raw_jd: str, title_override: str = "") -> ParsedJD:
        if not raw_jd or not raw_jd.strip():
            return ParsedJD(
                raw_text="",
                title=title_override,
                parse_notes=["Empty job description provided."]
            )

        notes: list[str] = []
        text = raw_jd.strip()

        # ── Title ─────────────────────────────────────────────────────────────
        title = title_override or _extract_title(text)

        # ── Zone splitting ─────────────────────────────────────────────────────
        zones = _split_jd_into_zones(text)

        # ── Skill extraction per zone ─────────────────────────────────────────
        required_skills = _match_skills_in_text(zones["required"])
        preferred_skills = _match_skills_in_text(zones["preferred"])

        # Skills found only in "general" (no explicit section) → required
        general_skills = _match_skills_in_text(zones["general"])
        for s in general_skills:
            if s not in required_skills and s not in preferred_skills:
                required_skills.append(s)

        # Deduplicate: a skill cannot be both required and preferred
        preferred_skills = [s for s in preferred_skills if s not in required_skills]

        if not required_skills:
            notes.append("No recognisable skills found in the job description.")

        # ── Experience years ───────────────────────────────────────────────────
        min_years, max_years = _extract_experience_years(text)
        if min_years == 0.0:
            notes.append("Could not detect required years of experience — defaulting to 0.")

        # ── Education ─────────────────────────────────────────────────────────
        required_education = _extract_education(text)

        # ── Target titles ─────────────────────────────────────────────────────
        # Normalise title into searchable list
        target_titles = [title] if title else []

        return ParsedJD(
            raw_text=text,
            title=title,
            required_skills=sorted(set(required_skills)),
            preferred_skills=sorted(set(preferred_skills)),
            min_years=min_years,
            max_years=max_years,
            required_education=required_education,
            target_titles=target_titles,
            parse_notes=notes,
        )
