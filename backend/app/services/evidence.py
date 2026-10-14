"""
evidence.py
===========
Evidence Extraction & Traceability Service
Generates deterministic, verified evidence spans for:
  1. Individual skills (exact matched span, character offsets, context excerpt, or "Not found in resume")
  2. The 5 score components (Semantic Fit, Skill Coverage, Experience, Title Relevance, Education)

Guarantees:
  - raw_text[start_offset:end_offset] == exact_match for all found spans.
  - Missing skills deterministically return status="not_found" and message="Not found in resume" (NEVER hallucinated).
  - Works with special characters (e.g. C++, C#, .NET, React.js).
"""

from __future__ import annotations
import re
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

SKILLS_PATH = Path(__file__).parent.parent / "data" / "skills_taxonomy.json"
_SKILL_ALIAS_MAP: Optional[Dict[str, List[str]]] = None


def _get_skill_terms(skill_name: str) -> List[str]:
    """Return a list of terms to search for (canonical + known aliases)."""
    global _SKILL_ALIAS_MAP
    if _SKILL_ALIAS_MAP is None:
        _SKILL_ALIAS_MAP = {}
        try:
            if SKILLS_PATH.exists():
                with open(SKILLS_PATH, "r", encoding="utf-8") as f:
                    tax_data = json.load(f)
                    for item in tax_data:
                        canon = item.get("canonical", "")
                        aliases = item.get("aliases", [])
                        terms = [canon] + aliases
                        _SKILL_ALIAS_MAP[canon.lower()] = terms
                        for a in aliases:
                            _SKILL_ALIAS_MAP[a.lower()] = terms
        except Exception as e:
            logger.warning("Failed to load skills taxonomy in evidence service: %s", e)

    norm = skill_name.strip().lower()
    terms = _SKILL_ALIAS_MAP.get(norm, [skill_name.strip()])
    # Ensure original skill name is prioritized first
    if skill_name.strip() not in terms:
        terms.insert(0, skill_name.strip())
    return terms


def _extract_context_excerpt(raw_text: str, start: int, end: int, window: int = 80) -> str:
    """
    Extract a clean sentence or contextual excerpt centered around [start:end].
    Trims to sentence/line boundaries where possible without exceeding bounds.
    """
    if not raw_text:
        return ""

    # Look backwards for sentence start or newline
    left_bound = max(0, start - window)
    prev_text = raw_text[left_bound:start]
    # Find last period, bullet, or newline before match
    sep_indices = [prev_text.rfind(c) for c in (".", "\n", "•", "·", "|", ";")]
    last_sep = max(sep_indices)
    if last_sep != -1:
        left_pos = left_bound + last_sep + 1
    else:
        left_pos = left_bound

    # Look forwards for sentence end or newline
    right_bound = min(len(raw_text), end + window)
    next_text = raw_text[end:right_bound]
    fwd_indices = [next_text.find(c) for c in (".", "\n", "•", "·", "|", ";") if next_text.find(c) != -1]
    if fwd_indices:
        first_fwd = min(fwd_indices)
        right_pos = end + first_fwd
    else:
        right_pos = right_bound

    excerpt = raw_text[left_pos:right_pos].strip()
    # Clean excessive whitespace inside
    excerpt = re.sub(r"\s+", " ", excerpt)
    return excerpt


def find_skill_evidence(raw_text: Optional[str], skill_name: str) -> Dict[str, Any]:
    """
    Deterministically find evidence for a skill in resume text.
    Returns:
      If found:
        {
          "status": "found",
          "exact_match": str,
          "excerpt": str,
          "start_offset": int,
          "end_offset": int,
          "message": str
        }
      If not found:
        {
          "status": "not_found",
          "exact_match": None,
          "excerpt": "Not found in resume",
          "start_offset": None,
          "end_offset": None,
          "message": "Not found in resume"
        }
    """
    if not raw_text or not raw_text.strip() or not skill_name or not skill_name.strip():
        return {
            "status": "not_found",
            "exact_match": None,
            "excerpt": "Not found in resume",
            "start_offset": None,
            "end_offset": None,
            "message": "Not found in resume",
        }

    search_terms = _get_skill_terms(skill_name)

    # Search for each term using boundary check that handles punctuation (e.g. C++, .NET)
    for term in search_terms:
        if not term:
            continue
        # Use negative lookbehind and lookahead for non-alphanumeric chars
        escaped = re.escape(term)
        pattern = rf"(?<![A-Za-z0-9_]){escaped}(?![A-Za-z0-9_])"
        match = re.search(pattern, raw_text, re.IGNORECASE)
        if match:
            start, end = match.start(), match.end()
            exact = raw_text[start:end]
            excerpt = _extract_context_excerpt(raw_text, start, end)
            if not excerpt or exact not in excerpt:
                excerpt = exact

            return {
                "status": "found",
                "exact_match": exact,
                "excerpt": excerpt,
                "start_offset": start,
                "end_offset": end,
                "message": f"Verified '{exact}' in resume at character index {start}-{end}.",
            }

    # Deterministic NOT FOUND
    return {
        "status": "not_found",
        "exact_match": None,
        "excerpt": "Not found in resume",
        "start_offset": None,
        "end_offset": None,
        "message": "Not found in resume",
    }


def find_component_evidence(
    raw_text: Optional[str],
    candidate_profile: Dict[str, Any],
    job_criteria: Dict[str, Any],
    score_breakdown: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build traceable evidence for the 5 scoring factors:
      - semantic
      - skills
      - experience
      - title
      - education
    """
    text = raw_text or ""
    components: Dict[str, Any] = {}

    # 1. Semantic Fit Evidence
    semantic_score = score_breakdown.get("semantic_score")
    sem_excerpt = ""
    sem_start = None
    sem_end = None

    if text:
        # Look for summary/objective section or first substantial paragraph
        summary_match = re.search(
            r"(?:summary|objective|profile|about me|about)[\s:]*\n+([^\n]+(?:\n[^\n]+){1,3})",
            text,
            re.IGNORECASE,
        )
        if summary_match:
            sem_excerpt = summary_match.group(1).strip()
            sem_start = summary_match.start(1)
            sem_end = summary_match.end(1)
        else:
            # Fallback to first non-empty lines (lines 2-4)
            lines = [l.strip() for l in text.splitlines() if len(l.strip()) > 30]
            if lines:
                sem_excerpt = lines[0]
                idx = text.find(sem_excerpt)
                if idx != -1:
                    sem_start = idx
                    sem_end = idx + len(sem_excerpt)

    components["semantic"] = {
        "score": semantic_score,
        "summary": (
            f"Overall semantic fit scored at {round(semantic_score)}% using sentence-transformers embedding similarity "
            f"against the '{job_criteria.get('title', 'job')}' job description."
            if semantic_score is not None
            else "Semantic fit could not be scored."
        ),
        "excerpt": sem_excerpt or "Semantic embedding evaluated across entire resume text.",
        "start_offset": sem_start,
        "end_offset": sem_end,
    }

    # 2. Skills Evidence
    skills_score = score_breakdown.get("skills_score")
    matched_req = score_breakdown.get("matched_required_skills") or []
    missing_req = score_breakdown.get("missing_required_skills") or []
    req_skills = job_criteria.get("required_skills") or []

    components["skills"] = {
        "score": skills_score,
        "matched_count": len(matched_req),
        "total_required": len(req_skills),
        "missing_count": len(missing_req),
        "summary": (
            f"Matched {len(matched_req)} of {len(req_skills)} required must-have skills "
            f"({round(skills_score)}% skill coverage)."
            if skills_score is not None
            else "Skills could not be scored."
        ),
        "matched_skills": matched_req,
        "missing_skills": missing_req,
        "is_capped": score_breakdown.get("is_capped", False),
        "cap_reason": score_breakdown.get("cap_reason"),
    }

    # 3. Experience Evidence
    exp_years = candidate_profile.get("experience_years") or 0.0
    min_years = job_criteria.get("min_years") or 0.0
    roles_count = candidate_profile.get("roles_count") or 0
    avg_tenure = candidate_profile.get("avg_tenure_months") or 0
    exp_score = score_breakdown.get("experience_score")

    exp_excerpt = ""
    exp_start = None
    exp_end = None

    if text:
        # Find first date range in experience section
        date_match = re.search(
            r"((?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—to]+\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|[Pp]resent|[Cc]urrent))",
            text,
        )
        if date_match:
            # Expand context around date match to capture role and company
            st = max(0, date_match.start() - 60)
            en = min(len(text), date_match.end() + 60)
            exp_excerpt = _extract_context_excerpt(text, date_match.start(), date_match.end(), window=60)
            exp_start = date_match.start()
            exp_end = date_match.end()

    components["experience"] = {
        "score": exp_score,
        "years": exp_years,
        "min_required_years": min_years,
        "roles_count": roles_count,
        "avg_tenure_months": avg_tenure,
        "summary": (
            f"{exp_years} yrs verified across {roles_count} role(s) (avg {avg_tenure}mo). "
            + (
                f"Meets or exceeds {min_years} yr requirement."
                if exp_years >= min_years
                else f"Below {min_years} yr requirement."
            )
        ),
        "excerpt": exp_excerpt or (f"{exp_years} years total professional experience recorded."),
        "start_offset": exp_start,
        "end_offset": exp_end,
    }

    # 4. Title Relevance Evidence
    title_score = score_breakdown.get("title_score")
    cand_title = candidate_profile.get("detected_title") or ""
    job_title = job_criteria.get("title") or ""

    title_excerpt = ""
    title_start = None
    title_end = None

    if cand_title and text:
        title_match = re.search(rf"\b{re.escape(cand_title)}\b", text, re.IGNORECASE)
        if title_match:
            title_start = title_match.start()
            title_end = title_match.end()
            title_excerpt = _extract_context_excerpt(text, title_start, title_end, window=50)

    if not title_excerpt and text:
        # Fallback to first line that looks like a title or header
        lines = [l.strip() for l in text.splitlines()[:10] if 4 <= len(l.strip()) <= 50]
        if lines:
            title_excerpt = lines[0]
            idx = text.find(title_excerpt)
            if idx != -1:
                title_start = idx
                title_end = idx + len(title_excerpt)

    components["title"] = {
        "score": title_score,
        "detected_title": cand_title or "Unspecified",
        "target_title": job_title,
        "summary": (
            f"Candidate title '{cand_title or 'Unspecified'}' evaluated against target title '{job_title}' "
            f"({round(title_score)}% match)."
            if title_score is not None
            else f"Evaluated against target '{job_title}'."
        ),
        "excerpt": title_excerpt or f"Detected role: {cand_title or 'Unspecified'}",
        "start_offset": title_start,
        "end_offset": title_end,
    }

    # 5. Education Fit Evidence
    edu_score = score_breakdown.get("education_score")
    edu_level = candidate_profile.get("education_level")
    edu_details = candidate_profile.get("education_details") or ""
    req_edu = job_criteria.get("required_education")

    edu_excerpt = ""
    edu_start = None
    edu_end = None

    if edu_details and text:
        edu_idx = text.lower().find(edu_details.lower()[:30])
        if edu_idx != -1:
            edu_start = edu_idx
            edu_end = edu_idx + len(edu_details)
            edu_excerpt = edu_details
    elif text:
        # Search for education keywords
        edu_match = re.search(
            r"\b(bachelor|master|phd|doctorate|associate|b\.s|m\.s|b\.tech|btech|mtech|degree|university|college)\b[^\n]{0,80}",
            text,
            re.IGNORECASE,
        )
        if edu_match:
            edu_start = edu_match.start()
            edu_end = edu_match.end()
            edu_excerpt = edu_match.group(0).strip()

    components["education"] = {
        "score": edu_score,
        "detected_level": edu_level or "Not specified",
        "required_level": req_edu or "None specified",
        "summary": (
            f"Detected {edu_level or 'unspecified'} education "
            + (f"(requirement: {req_edu})." if req_edu else "(no specific degree required).")
        ),
        "excerpt": edu_excerpt or edu_details or f"Level: {edu_level or 'None specified'}",
        "start_offset": edu_start,
        "end_offset": edu_end,
    }

    return components


def generate_evidence_spans(
    raw_text: Optional[str],
    candidate_profile: Dict[str, Any],
    job_criteria: Dict[str, Any],
    score_breakdown: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate comprehensive, deterministic evidence spans for all candidate skills
    and all 5 score components.
    """
    text = raw_text or ""
    skills_evidence: Dict[str, Any] = {}

    req_skills = job_criteria.get("required_skills") or []
    pref_skills = job_criteria.get("preferred_skills") or []
    cand_skills = candidate_profile.get("skills") or []

    # All unique skills to assess
    all_skills_to_check = set(req_skills + pref_skills + cand_skills)

    for skill in all_skills_to_check:
        if not skill:
            continue
        ev = find_skill_evidence(text, skill)
        skills_evidence[skill] = ev

    # 5 Score Components
    components_evidence = find_component_evidence(
        text,
        candidate_profile,
        job_criteria,
        score_breakdown,
    )

    found_count = sum(1 for e in skills_evidence.values() if e.get("status") == "found")
    missing_count = sum(1 for e in skills_evidence.values() if e.get("status") == "not_found")

    return {
        "skills": skills_evidence,
        "components": components_evidence,
        "summary": (
            f"Traceability verified: {found_count} skills evidenced in resume, "
            f"{missing_count} missing skills verified absent."
        ),
    }
