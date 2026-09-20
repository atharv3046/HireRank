"""
Standalone Entity & Timeline Extractor
======================================
Extracts contact info, degree, canonical skills, and calculates true years of
experience by parsing and merging overlapping date intervals.
Zero FastAPI or DB imports.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Tuple, Set
import spacy
from spacy.matcher import PhraseMatcher

from scoring.taxonomy import SkillsTaxonomy, get_taxonomy
from scoring.parser import ParsedResume

logger = logging.getLogger(__name__)

# Education level ordinal map (for scoring comparison)
EDUCATION_ORDINAL: Dict[str, int] = {
    "high_school": 1,
    "associate": 2,
    "bachelors": 3,
    "masters": 4,
    "phd": 5,
}

EDUCATION_KEYWORDS: Dict[str, List[str]] = {
    "phd": ["phd", "ph.d", "ph.d.", "doctorate", "doctoral", "doctor of philosophy"],
    "masters": ["master", "m.s.", "ms ", " ms,", "m.tech", "mtech", "mba", "m.b.a", "m.eng", "meng", "m.sc", "msc"],
    "bachelors": ["bachelor", "b.s.", "bs ", " bs,", "b.tech", "btech", "b.e.", " be ", "b.sc", "bsc", "b.a.", "b.a ", "undergraduate"],
    "associate": ["associate degree", "associate of", "a.s.", "a.a."],
    "high_school": ["high school", "hsc", "secondary school", "ged", "12th grade", "12th std"],
}

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9, "sept": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


@dataclass
class ExtractedProfile:
    """Structured candidate profile extracted from text."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    skills: List[str] = field(default_factory=list)
    years_experience: float = 0.0
    education_level: Optional[str] = None
    education_details: Optional[str] = None
    detected_title: Optional[str] = None
    timeline_intervals: List[Tuple[str, str]] = field(default_factory=list)
    raw_text: str = ""


def _parse_month_year(date_str: str, current_year: int) -> Optional[Tuple[int, int]]:
    """Parse date string to (year, month). Returns None if unparseable."""
    s = date_str.strip().lower()
    if s in ("present", "current", "now", "ongoing"):
        now = datetime.now()
        return (now.year, now.month)

    # "Jan 2020", "January 2020"
    m_named = re.match(r"^([a-z]+)\.?\s+(\d{4})$", s)
    if m_named:
        month_name, year = m_named.group(1), int(m_named.group(2))
        month = MONTH_MAP.get(month_name)
        if month and 1970 <= year <= current_year + 1:
            return (year, month)

    # "06/2018" or "2018/06"
    m_slash = re.match(r"^(\d{1,2})/(\d{4})$", s)
    if m_slash:
        month, year = int(m_slash.group(1)), int(m_slash.group(2))
        if 1 <= month <= 12 and 1970 <= year <= current_year + 1:
            return (year, month)

    m_slash_rev = re.match(r"^(\d{4})/(\d{1,2})$", s)
    if m_slash_rev:
        year, month = int(m_slash_rev.group(1)), int(m_slash_rev.group(2))
        if 1 <= month <= 12 and 1970 <= year <= current_year + 1:
            return (year, month)

    # Just "2020"
    m_year = re.match(r"^(\d{4})$", s)
    if m_year:
        year = int(m_year.group(1))
        if 1970 <= year <= current_year + 1:
            return (year, 1)

    return None


def merge_date_intervals(intervals: List[Tuple[Tuple[int, int], Tuple[int, int]]]) -> List[Tuple[Tuple[int, int], Tuple[int, int]]]:
    """
    Merge overlapping or contiguous (year, month) date intervals into disjoint spans.
    This guarantees overlapping roles/internships don't artificially inflate experience.
    """
    if not intervals:
        return []

    # Sort intervals by start date
    sorted_intervals = sorted(intervals, key=lambda iv: (iv[0][0], iv[0][1]))
    merged = [sorted_intervals[0]]

    for current_start, current_end in sorted_intervals[1:]:
        last_start, last_end = merged[-1]

        # Check if current interval overlaps or directly abuts the last interval
        if (current_start[0] < last_end[0]) or (
            current_start[0] == last_end[0] and current_start[1] <= last_end[1] + 1
        ):
            # Extend last interval if current ends later
            new_end = max(last_end, current_end, key=lambda dt: (dt[0], dt[1]))
            merged[-1] = (last_start, new_end)
        else:
            merged.append((current_start, current_end))

    return merged


class ResumeExtractor:
    """
    Information extraction pipeline using spaCy NER, PhraseMatcher,
    and interval-merging date arithmetic.
    """

    def __init__(self, taxonomy: Optional[SkillsTaxonomy] = None):
        self.taxonomy = taxonomy or get_taxonomy()
        self._nlp = None
        self._phrase_matcher = None

    def _load_nlp(self):
        if self._nlp is None:
            try:
                self._nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("en_core_web_sm not found, downloading...")
                import subprocess, sys
                subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"], check=True)
                self._nlp = spacy.load("en_core_web_sm")
        return self._nlp

    def _get_phrase_matcher(self) -> PhraseMatcher:
        if self._phrase_matcher is None:
            nlp = self._load_nlp()
            self._phrase_matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
            # Register all canonical skills and aliases
            for alias, canonical in self.taxonomy.alias_to_canonical.items():
                pattern = nlp.make_doc(alias)
                self._phrase_matcher.add(canonical, [pattern])
        return self._phrase_matcher

    def extract_contact_info(self, text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Extracts email, phone, and name from text."""
        email: Optional[str] = None
        phone: Optional[str] = None
        name: Optional[str] = None

        # Email regex
        email_pattern = r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
        email_matches = re.findall(email_pattern, text)
        if email_matches:
            email = email_matches[0]

        # Phone regex
        phone_pattern = r"(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)?\d{3}[\s\-.]?\d{4}"
        phones = re.findall(phone_pattern, text)
        # Filter out 4-digit years or tiny numbers
        valid_phones = [p.strip() for p in phones if len(re.sub(r"\D", "", p)) >= 10]
        if valid_phones:
            phone = valid_phones[0]

        # Name extraction using spaCy PERSON entity from first 6 lines
        try:
            nlp = self._load_nlp()
            top_lines = "\n".join(text.strip().splitlines()[:6])
            doc = nlp(top_lines)
            person_ents = [ent.text.strip() for ent in doc.ents if ent.label_ == "PERSON"]
            if person_ents:
                name = person_ents[0]
            else:
                # Fallback heuristic: first clean line with 2-4 alphabetic words
                for line in text.strip().splitlines()[:4]:
                    clean = line.strip()
                    words = clean.split()
                    if 2 <= len(words) <= 4 and all(w.replace("-", "").replace(".", "").isalpha() for w in words):
                        name = clean
                        break
        except Exception as e:
            logger.warning("Name extraction exception: %s", e)

        return name, email, phone

    def extract_experience_years(self, text: str, experience_text: str = "") -> Tuple[float, List[Tuple[str, str]]]:
        """
        Parse work history date intervals and merge overlapping intervals
        to calculate TRUE years of experience. Never trusts self-reported claims.
        """
        search_scope = experience_text if experience_text.strip() else text
        current_year = datetime.now().year

        month_names = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
        year_re = r"(?:19|20)\d{2}"

        date_patterns = [
            # "Jan 2020 - Dec 2022" or "Jan 2020 to Present"
            rf"({month_names}\.?\s+{year_re})\s*[-–—to]+\s*({month_names}\.?\s+{year_re}|[Pp]resent|[Cc]urrent|[Nn]ow|[Oo]ngoing)",
            # "06/2018 - 03/2021"
            rf"(\d{{1,2}}/\d{{4}})\s*[-–—to]+\s*(\d{{1,2}}/\d{{4}}|[Pp]resent|[Cc]urrent|[Nn]ow)",
            # "2018 - 2021"
            rf"({year_re})\s*[-–—to]+\s*({year_re}|[Pp]resent|[Cc]urrent|[Nn]ow)",
        ]

        found_intervals: List[Tuple[Tuple[int, int], Tuple[int, int]]] = []
        raw_interval_strings: List[Tuple[str, str]] = []

        for pat in date_patterns:
            for match in re.finditer(pat, search_scope):
                start_str, end_str = match.group(1).strip(), match.group(2).strip()
                s_dt = _parse_month_year(start_str, current_year)
                e_dt = _parse_month_year(end_str, current_year)

                if s_dt and e_dt and (s_dt <= e_dt):
                    # Sanity check: span not more than 45 years
                    if e_dt[0] - s_dt[0] <= 45:
                        found_intervals.append((s_dt, e_dt))
                        raw_interval_strings.append((start_str, end_str))

        if found_intervals:
            merged = merge_date_intervals(found_intervals)
            total_months = 0
            for start, end in merged:
                months = (end[0] - start[0]) * 12 + (end[1] - start[1])
                total_months += max(1, months)  # at least 1 month

            true_years = round(total_months / 12.0, 1)
            return true_years, raw_interval_strings

        # If no date ranges were discovered at all, fallback to explicit text patterns
        match_explicit = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|exp)", search_scope, re.IGNORECASE)
        if match_explicit:
            try:
                val = float(match_explicit.group(1))
                if 0.0 <= val <= 40.0:
                    return val, []
            except ValueError:
                pass

        return 0.0, []

    def extract_education(self, text: str, education_text: str = "") -> Tuple[Optional[str], Optional[str]]:
        """Extract highest education level and details snippet."""
        scope = education_text.lower() if education_text.strip() else text.lower()

        for level in ("phd", "masters", "bachelors", "associate", "high_school"):
            for kw in EDUCATION_KEYWORDS[level]:
                if kw in scope:
                    # Retrieve the line containing the keyword for transparency
                    for line in (education_text or text).splitlines():
                        if kw in line.lower():
                            return level, line.strip()
                    return level, kw

        return None, None

    def extract_skills(self, text: str, skills_section_text: str = "") -> List[str]:
        """
        Extract canonical skills using PhraseMatcher on skills section & full text,
        with rapidfuzz normalization to collapse aliases (e.g. React.js = React).
        """
        nlp = self._load_nlp()
        matcher = self._get_phrase_matcher()

        found_skills: Set[str] = set()

        # Prioritize skills section
        scopes = [skills_section_text[:15000], text[:40000]] if skills_section_text else [text[:40000]]

        for scope in scopes:
            if not scope.strip():
                continue
            doc = nlp(scope)
            matches = matcher(doc)
            for match_id, start, end in matches:
                canonical = nlp.vocab.strings[match_id]
                normalized = self.taxonomy.normalize_skill(canonical)
                found_skills.add(normalized)

        return sorted(list(found_skills))

    def extract_profile(self, parsed: ParsedResume) -> ExtractedProfile:
        """Extract all candidate details from a ParsedResume."""
        if parsed.needs_manual_review:
            return ExtractedProfile(raw_text=parsed.raw_text)

        full_text = parsed.raw_text
        name, email, phone = self.extract_contact_info(full_text)
        exp_years, intervals = self.extract_experience_years(full_text, parsed.experience_text)
        edu_level, edu_details = self.extract_education(full_text, parsed.education_text)
        skills = self.extract_skills(full_text, parsed.skills_text)

        # Detect candidate title from top lines or summary
        detected_title = None
        for line in full_text.splitlines()[:5]:
            clean = line.strip()
            if 3 < len(clean) < 50 and any(t in clean.lower() for t in ("engineer", "developer", "architect", "scientist", "manager", "lead", "analyst")):
                detected_title = clean
                break

        return ExtractedProfile(
            name=name,
            email=email,
            phone=phone,
            skills=skills,
            years_experience=exp_years,
            education_level=edu_level,
            education_details=edu_details,
            detected_title=detected_title,
            timeline_intervals=intervals,
        )

    def extract_from_text(self, text: str) -> ExtractedProfile:
        """Extract candidate profile directly from a raw text string."""
        parsed = ParsedResume(raw_text=text or "")
        return self.extract_profile(parsed)

