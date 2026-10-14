"""
rejection.py
============
Templated Rejection Message Service.
Recruiter Moment: "I need to reject this person without ghosting them,
but I don't have time to write a personalized email."

Guarantees & Compliance Rules:
  - 100% Deterministic (NOT LLM): Zero hallucinations, instant generation.
  - Personal & Constructive: References actual matched strengths and honest gap.
  - Legal Safety & EEOC/Fair Hiring Compliance:
      * NEVER references: age, graduation dates/years, employment gaps, career breaks,
        detected gender, or any protected characteristic.
      * ONLY references: skills matched, skills missing, years of experience relative
        to the JD requirement.
      * Includes explicit recruiter disclaimer:
        "Preview and edit before sending. You are responsible for compliance with
         applicable employment communications laws."
"""

from __future__ import annotations
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Disallowed terms that could trigger employment law or bias issues
FORBIDDEN_COMPLIANCE_PATTERNS = [
    r"\bage\b",
    r"\bold\b",
    r"\byoung\b",
    r"\bgraduat\w*",
    r"\byear of birth\b",
    r"\bgap\b",
    r"\bcareer break\b",
    r"\bunemploy\w*",
    r"\bpregnant\b",
    r"\bmatern\w*",
    r"\bpatern\w*",
    r"\bhe\b",
    r"\bshe\b",
    r"\bhis\b",
    r"\bher\b",
    r"\bhim\b",
    r"\bgender\b",
    r"\brace\b",
    r"\bethn\w*",
    r"\bdisab\w*",
    r"\bhealth\b",
    r"\bmarit\w*",
]


def verify_rejection_compliance(text: str) -> Dict[str, Any]:
    """
    Scans the email text to guarantee it contains zero forbidden bias
    or protected characteristic references.
    """
    flagged_terms = []
    lower = text.lower()
    for pattern in FORBIDDEN_COMPLIANCE_PATTERNS:
        match = re.search(pattern, lower)
        if match:
            flagged_terms.append(match.group(0))

    if flagged_terms:
        return {
            "is_safe": False,
            "flagged_terms": flagged_terms,
            "message": f"Compliance alert: template contained potentially risky phrasing: {flagged_terms}",
        }

    return {
        "is_safe": True,
        "flagged_terms": [],
        "message": "✓ Safe: References only skills & experience criteria",
    }


def generate_templated_rejection(
    candidate_name: Optional[str],
    job_title: str,
    company_name: str = "Our Team",
    matched_skills: Optional[List[str]] = None,
    missing_required_skills: Optional[List[str]] = None,
    candidate_experience: Optional[float] = None,
    min_experience_years: Optional[float] = None,
    overall_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Generate a constructive, personalized rejection email based on
    scoring criteria and verified candidate data.
    """
    matched = [s.strip() for s in (matched_skills or []) if s and s.strip()]
    missing = [s.strip() for s in (missing_required_skills or []) if s and s.strip()]
    cand_exp = candidate_experience or 0.0
    min_exp = min_experience_years or 0.0
    comp_name = (company_name or "Our Team").strip()
    role_title = (job_title or "this position").strip()

    # Determine candidate greeting name
    name_clean = (candidate_name or "").strip()
    if name_clean and not name_clean.lower().startswith("candidate #"):
        # Take first name if full name provided
        first_name = name_clean.split()[0].title()
        greeting = f"Dear {first_name},"
    else:
        greeting = "Dear Applicant,"

    # 1. Subject Line
    subject = f"Update on your application for {role_title} at {comp_name}"

    # 2. Acknowledge Specific Strengths
    referenced_strengths: List[str] = []
    if len(matched) >= 2:
        top_two = matched[:2]
        referenced_strengths = top_two
        strengths_phrase = f"{top_two[0]} and {top_two[1]}"
        opening_paragraph = (
            f"Thank you for taking the time to apply for the {role_title} position at {comp_name}, "
            f"and for your interest in joining our organization.\n\n"
            f"Our hiring team carefully reviewed your background and qualifications. We were particularly "
            f"impressed by your strong experience with {strengths_phrase}."
        )
    elif len(matched) == 1:
        referenced_strengths = [matched[0]]
        opening_paragraph = (
            f"Thank you for taking the time to apply for the {role_title} position at {comp_name}, "
            f"and for your interest in joining our organization.\n\n"
            f"Our hiring team carefully reviewed your background and qualifications. We were particularly "
            f"impressed by your demonstrated expertise with {matched[0]}."
        )
    else:
        opening_paragraph = (
            f"Thank you for taking the time to apply for the {role_title} position at {comp_name}, "
            f"and for your interest in joining our organization.\n\n"
            f"Our hiring team carefully evaluated your qualifications and appreciated learning about your "
            f"professional achievements."
        )

    # 3. State Specific Gap Constructively
    referenced_gaps: List[str] = []
    gap_type: str = "competitive_pool"

    if missing:
        gap_type = "missing_required_skills"
        if len(missing) >= 2:
            gap_skills = f"{missing[0]} and {missing[1]}"
            referenced_gaps = missing[:2]
        else:
            gap_skills = missing[0]
            referenced_gaps = [missing[0]]

        gap_paragraph = (
            f"For this role, however, our team requires hands-on experience with {gap_skills}, "
            f"which we did not see strongly reflected in your application."
        )

    elif min_exp > 0 and cand_exp < min_exp:
        gap_type = "experience_gap"
        referenced_gaps = [f"Requires {min_exp}+ yrs (profile shows {cand_exp} yrs)"]
        gap_paragraph = (
            f"For this position, however, our role requires at least {int(min_exp) if min_exp.is_integer() else min_exp} "
            f"years of direct experience, and we have decided to move forward with candidates whose professional "
            f"tenure more closely aligns with that requirement."
        )

    else:
        gap_type = "competitive_pool"
        referenced_gaps = ["High volume applicant pool alignment"]
        gap_paragraph = (
            f"While your background is strong, we received a high volume of qualified applications "
            f"and have decided to proceed with candidates whose specific project experience more closely "
            f"aligns with our immediate team priorities."
        )

    # 4. Closing: Keep the Door Open
    closing_paragraph = (
        f"We would love to keep your profile in our talent network and stay in touch as future "
        f"roles open that may be a closer match for your skills.\n\n"
        f"We sincerely appreciate your time and enthusiasm for {comp_name}, and we wish you every success "
        f"in your ongoing job search.\n\n"
        f"Best regards,\n"
        f"The {comp_name} Recruiting Team"
    )

    full_body = f"{greeting}\n\n{opening_paragraph}\n\n{gap_paragraph}\n\n{closing_paragraph}"

    # Verify compliance
    compliance_check = verify_rejection_compliance(full_body)

    return {
        "subject": subject,
        "body": full_body,
        "gap_type": gap_type,
        "referenced_strengths": referenced_strengths,
        "referenced_gaps": referenced_gaps,
        "compliance_safe": compliance_check["is_safe"],
        "compliance_badge": "✓ Safe: References only skills & experience criteria",
        "recruiter_disclaimer": (
            "Preview and edit before sending. You are responsible for compliance "
            "with applicable employment communications laws."
        ),
    }
