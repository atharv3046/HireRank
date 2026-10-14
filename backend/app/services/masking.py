"""
Masking & Blind Screening Service
=================================
Provides PII redaction and pedigree masking for DEI and NYC Local Law 144 compliance.
Masks candidate name, email, phone, institution pedigree, and graduation years
during early-stage evaluation so candidates are shortlisted on substance and skills.

Automatically unmasks candidate identity only once the recruiter advances them
to 'Interview' stage or beyond.
"""

from __future__ import annotations
import re
from typing import Optional, Dict, Any


def mask_email(email: Optional[str]) -> str:
    """
    Mask an email address while preserving domain context for spam/validity checks.
    Reuses the canonical guest masking logic.
    Example: 'john.smith@gmail.com' -> 'j****@gmail.com'
    """
    if not email or "@" not in email:
        return "c****@***.com"
    local, domain = email.split("@", 1)
    prefix = local[0] if local else "c"
    return f"{prefix}****@{domain}"


def mask_phone(phone: Optional[str]) -> str:
    """Mask phone number completely to prevent demographic bias."""
    if not phone:
        return ""
    return "+* (***) ***-****"


def mask_institution_and_grad_year(
    education_details: Optional[str],
    education_level: Optional[str] = None
) -> str:
    """
    Mask institution names (to eliminate university prestige bias) and remove
    graduation years (to eliminate age discrimination), while preserving the
    merit-based degree level (e.g. 'Master of Science (Accredited University)').
    """
    level_title = education_level.replace("_", " ").title() if education_level else "Degree"

    if not education_details or not education_details.strip():
        return f"{level_title} (Accredited Institution)"

    cleaned = education_details.strip()

    # Strip 4-digit years (e.g., 1998, 2017, 2024) to prevent age bias
    cleaned = re.sub(r"\b(19|20)\d{2}\b", "", cleaned)

    # Mask known university / college phrases
    institution_patterns = [
        r"(?:University of [A-Za-z\s]+|Stanford|Harvard|MIT|Berkeley|Oxford|Cambridge|Princeton|Columbia|Yale|Caltech|Carnegie Mellon|Cornell)",
        r"[A-Za-z\s]+ (?:University|College|Institute of Technology|Polytechnic|Academy)",
    ]
    for pattern in institution_patterns:
        cleaned = re.sub(pattern, "Accredited Institution", cleaned, flags=re.IGNORECASE)

    # Clean up dangling delimiters left by year/name removal
    cleaned = re.sub(r"[\s\-–—,;]+$", "", cleaned).strip()
    cleaned = re.sub(r"^\s*[\-–—,;]+\s*", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)

    if not cleaned or cleaned.lower() in ("-", "–", "—", "none"):
        return f"{level_title} (Accredited Institution)"

    return cleaned


def is_candidate_post_interview(pipeline_status: Optional[str]) -> bool:
    """
    Returns True if candidate has reached or passed the 'Interview' stage.
    Pre-interview statuses (e.g. 'Screened', initial intake, None) return False.
    """
    if not pipeline_status:
        return False
    norm = pipeline_status.strip().lower().replace(" ", "").replace("_", "")
    return norm in ("interview", "interviewed", "invited", "offer", "offered", "hire", "hired")


def apply_blind_screening_to_candidate(
    candidate_dict: Dict[str, Any],
    index: Optional[int] = None
) -> Dict[str, Any]:
    """
    Applies blind screening masking if candidate is pre-Interview.
    If candidate is post-Interview, returns full unmasked identity.
    """
    c = dict(candidate_dict)
    status = c.get("pipeline_status")

    if is_candidate_post_interview(status):
        # Post-Interview: identity is fully revealed
        c["is_masked"] = False
        return c

    # Pre-Interview: apply strict DEI masking
    cand_id = c.get("id")
    label_num = index if index is not None else cand_id
    c["name"] = f"Candidate #{label_num}"
    c["email"] = mask_email(c.get("email"))
    c["phone"] = mask_phone(c.get("phone")) if c.get("phone") else None
    c["education_details"] = mask_institution_and_grad_year(
        c.get("education_details"),
        c.get("education_level")
    )
    c["is_masked"] = True
    return c
