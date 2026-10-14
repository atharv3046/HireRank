"""
Career Pattern Analysis Service
===============================
Analyzes candidate career trajectory and tenure patterns from date ranges and role titles.
Computes:
  - roles_count: Total number of roles / positions held
  - promotion_count: Count of internal promotions and seniority advancements
  - avg_tenure_months: Average tenure across roles in months
  - short_tenure_flag: Boolean flag if candidate exhibits frequent short stints / job-hopping pattern
  - summary: Concise recruiter-friendly summary string (e.g., "3 roles · 2 promotions · avg 18mo")

Designed for recruiter fast-triage: saves manual counting without penalizing candidate scores.
"""

from __future__ import annotations
import re
from datetime import datetime
from typing import List, Tuple, Optional, Any, Dict

# Seniority title hierarchy keywords
SENIORITY_HIERARCHY = {
    0: ["intern", "trainee", "co-op", "apprentice"],
    1: ["junior", "jr", "jr.", "associate", "entry", "level 1", "l1", "l2"],
    2: ["mid", "engineer", "developer", "analyst", "specialist", "consultant", "associate ii", "level 2", "l3"],
    3: ["senior", "sr", "sr.", "lead", "tech lead", "team lead", "specialist ii", "level 3", "l4", "l5"],
    4: ["staff", "principal", "architect", "engineering manager", "lead architect", "manager", "l6"],
    5: ["director", "vp", "vice president", "head of", "chief", "cto", "cio", "founder", "co-founder"],
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


def parse_date_input(val: Any, current_year: Optional[int] = None) -> Optional[datetime]:
    """Parse various date formats (datetime, tuple, string) into a datetime object."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, tuple) and len(val) == 2:
        # (year, month)
        y, m = int(val[0]), int(val[1])
        return datetime(y, max(1, min(12, m)), 1)

    if not isinstance(val, str):
        return None

    s = val.strip().lower()
    if s in ("present", "current", "now", "ongoing"):
        now = datetime.now()
        return datetime(now.year, now.month, 1)

    curr_yr = current_year or datetime.now().year

    # "Jan 2020" or "January 2020"
    m_named = re.match(r"^([a-z]+)\.?\s+(\d{4})$", s)
    if m_named:
        month_name, year = m_named.group(1), int(m_named.group(2))
        month = MONTH_MAP.get(month_name, 1)
        if 1970 <= year <= curr_yr + 2:
            return datetime(year, month, 1)

    # "2020-01" or "01/2020"
    m_dash = re.match(r"^(\d{4})[-/](\d{1,2})$", s)
    if m_dash:
        year, month = int(m_dash.group(1)), int(m_dash.group(2))
        if 1970 <= year <= curr_yr + 2 and 1 <= month <= 12:
            return datetime(year, month, 1)

    m_slash = re.match(r"^(\d{1,2})[-/](\d{4})$", s)
    if m_slash:
        month, year = int(m_slash.group(1)), int(m_slash.group(2))
        if 1970 <= year <= curr_yr + 2 and 1 <= month <= 12:
            return datetime(year, month, 1)

    # Just year "2020"
    m_year = re.match(r"^(\d{4})$", s)
    if m_year:
        year = int(m_year.group(1))
        if 1970 <= year <= curr_yr + 2:
            return datetime(year, 1, 1)

    # Standard strptime fallback
    for fmt in ("%b %Y", "%B %Y", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue

    return None


def detect_title_seniority(title: Optional[str]) -> int:
    """Return seniority level (0-5) based on keywords in title. Defaults to 2 (Mid)."""
    if not title:
        return 2
    t = title.lower()
    for level in sorted(SENIORITY_HIERARCHY.keys(), reverse=True):
        for kw in SENIORITY_HIERARCHY[level]:
            if re.search(rf"\b{re.escape(kw)}\b", t):
                return level
    return 2


def compute_career_pattern_from_ranges(
    ranges: List[Any],
    text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Compute career pattern metrics from a list of date ranges/roles.

    Parameters:
        ranges: List of date ranges. Each element can be:
            - (start, end)
            - (start, end, title)
            - {"start": ..., "end": ..., "title": ..., "company": ...}
        text: Optional full or experience section text to detect explicit promotion phrasing.

    Returns:
        dict with keys:
            - roles_count (int)
            - promotion_count (int)
            - avg_tenure_months (int)
            - short_tenure_flag (bool)
            - summary (str)
            - roles_details (list)
    """
    if not ranges:
        return {
            "roles_count": 0,
            "promotion_count": 0,
            "avg_tenure_months": 0,
            "short_tenure_flag": False,
            "summary": "No tenure history detected",
            "roles_details": []
        }

    parsed_roles = []
    for item in ranges:
        start_val, end_val, title, company = None, None, None, None
        if isinstance(item, dict):
            start_val = item.get("start")
            end_val = item.get("end")
            title = item.get("title")
            company = item.get("company")
        elif isinstance(item, (list, tuple)):
            if len(item) >= 2:
                start_val, end_val = item[0], item[1]
            if len(item) >= 3:
                title = item[2]
            if len(item) >= 4:
                company = item[3]

        start_dt = parse_date_input(start_val)
        end_dt = parse_date_input(end_val)

        if start_dt and end_dt and start_dt <= end_dt:
            # Tenure in months (inclusive of start and end months, e.g. Jan to Dec = 12 months)
            duration_months = (end_dt.year - start_dt.year) * 12 + (end_dt.month - start_dt.month) + 1
            duration_months = max(1, duration_months)
            parsed_roles.append({
                "start": start_dt,
                "end": end_dt,
                "duration_months": duration_months,
                "title": title,
                "company": company,
                "seniority": detect_title_seniority(title)
            })

    if not parsed_roles:
        return {
            "roles_count": 0,
            "promotion_count": 0,
            "avg_tenure_months": 0,
            "short_tenure_flag": False,
            "summary": "No tenure history detected",
            "roles_details": []
        }

    # Sort roles chronologically (oldest to newest)
    parsed_roles.sort(key=lambda r: (r["start"], r["end"]))
    roles_count = len(parsed_roles)

    # 1. Average tenure in months
    total_months = sum(r["duration_months"] for r in parsed_roles)
    avg_tenure_months = round(total_months / roles_count) if roles_count > 0 else 0

    # 2. Short tenure flag (job-hopping indicator)
    # Trigger if candidate has >= 2 roles and avg tenure is < 18 months,
    # or >= 3 roles with > 50% lasting under 12 months.
    short_tenures = sum(1 for r in parsed_roles if r["duration_months"] < 12)
    short_tenure_flag = False
    if roles_count >= 2 and avg_tenure_months < 18:
        short_tenure_flag = True
    elif roles_count >= 3 and (short_tenures / roles_count) >= 0.5:
        short_tenure_flag = True

    # 3. Promotion count
    promotion_count = 0

    # Check transitions between consecutive roles
    for i in range(len(parsed_roles) - 1):
        prev = parsed_roles[i]
        curr = parsed_roles[i + 1]

        # Calculate gap between end of previous and start of current
        gap_months = (curr["start"].year - prev["end"].year) * 12 + (curr["start"].month - prev["end"].month)

        is_promo = False
        # Condition A: Seniority increased
        if curr["seniority"] > prev["seniority"]:
            is_promo = True
        # Condition B: Contiguous or overlapping roles (gap <= 1 month or overlap), indicating promotion/internal progression
        elif gap_months <= 1:
            is_promo = True
        # Condition C: Explicitly same company
        elif prev["company"] and curr["company"] and prev["company"].strip().lower() == curr["company"].strip().lower():
            is_promo = True

        if is_promo:
            promotion_count += 1

    # Check if text contains explicit promotion phrasing not already captured
    if text:
        explicit_promos = len(re.findall(r"\b(?:promoted to|promotion to|advanced to)\b", text, re.IGNORECASE))
        if explicit_promos > promotion_count:
            promotion_count = explicit_promos

    # Build summary string
    # e.g., "3 roles · 2 promotions · avg 18mo"
    summary_parts = [f"{roles_count} role{'s' if roles_count != 1 else ''}"]
    if promotion_count > 0:
        summary_parts.append(f"{promotion_count} promotion{'s' if promotion_count != 1 else ''}")
    summary_parts.append(f"avg {avg_tenure_months}mo")

    summary = " · ".join(summary_parts)

    return {
        "roles_count": roles_count,
        "promotion_count": promotion_count,
        "avg_tenure_months": avg_tenure_months,
        "short_tenure_flag": short_tenure_flag,
        "summary": summary,
        "roles_details": [
            {
                "start": r["start"].strftime("%Y-%m"),
                "end": r["end"].strftime("%Y-%m"),
                "duration_months": r["duration_months"],
                "title": r["title"]
            }
            for r in parsed_roles
        ]
    }


def extract_career_pattern_from_text(text: str) -> Dict[str, Any]:
    """
    Extract work experience date ranges and titles from resume text,
    then compute career pattern metrics.
    """
    if not text or not text.strip():
        return compute_career_pattern_from_ranges([], text)

    # 1. Search experience section or full text
    month_names = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    year_re = r"(?:19|20)\d{2}"

    patterns = [
        # "Jan 2020 - Dec 2022" or "Jan 2020 to Present"
        rf"({month_names}\.?\s+{year_re})\s*[-–—to]+\s*({month_names}\.?\s+{year_re}|[Pp]resent|[Cc]urrent|[Nn]ow|[Oo]ngoing)",
        # "06/2018 - 03/2021"
        rf"(\d{{1,2}}/\d{{4}})\s*[-–—to]+\s*(\d{{1,2}}/\d{{4}}|[Pp]resent|[Cc]urrent|[Nn]ow)",
        # "2018 - 2021"
        rf"({year_re})\s*[-–—to]+\s*({year_re}|[Pp]resent|[Cc]urrent|[Nn]ow)",
    ]

    extracted_ranges = []
    lines = text.splitlines()

    for pattern in patterns:
        for match in re.finditer(pattern, text):
            start_str, end_str = match.group(1).strip(), match.group(2).strip()
            
            # Find surrounding line for title heuristic
            match_start = match.start()
            line_idx = text[:match_start].count("\n")
            
            # Look at previous line or current line for role title
            title = None
            candidate_lines = []
            if line_idx > 0:
                candidate_lines.append(lines[line_idx - 1])
            candidate_lines.append(lines[line_idx])
            if line_idx + 1 < len(lines):
                candidate_lines.append(lines[line_idx + 1])

            for line in candidate_lines:
                clean_l = re.sub(pattern, "", line).strip()
                clean_l = re.sub(r"[-–|•·]", " ", clean_l).strip()
                words = clean_l.split()
                if 1 <= len(words) <= 6:
                    title = clean_l
                    break

            extracted_ranges.append({
                "start": start_str,
                "end": end_str,
                "title": title
            })

    return compute_career_pattern_from_ranges(extracted_ranges, text)
