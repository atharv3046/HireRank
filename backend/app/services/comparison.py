"""
backend/app/services/comparison.py
==================================
Feature 6: Head-to-Head Comparison Service
(Recruiter moment: "Down to a few finalists — how do I decide between them?")

Provides deterministic calculations for:
  1. Skill Overlap Breakdown:
     - Common skills (shared by both/all)
     - Skills unique to each candidate
  2. 5-Component Score Deltas and Non-Generative Templated Sentences:
     - "{name} scores {delta} points higher on {component}."
  3. Radar Matrix data points (0-100 scale for Semantic, Skills, Experience, Title, Education).
"""

from typing import List, Dict, Any, Optional

SCORE_COMPONENTS = [
    ("semantic", "Semantic Context Match"),
    ("skills", "Technical Skills Match"),
    ("experience", "Experience & Tenure"),
    ("title", "Job Title & Seniority"),
    ("education", "Education & Credentials"),
]


def calculate_skill_overlap(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes common and unique skills across 2 or 3 candidates.
    Preserves skill display casing while doing case-insensitive comparison.
    """
    if not candidates:
        return {"common_skills": [], "unique_skills": {}}

    c_skills_sets = []
    c_lower_map = []
    for c in candidates:
        raw_skills = c.get("skills") or c.get("extracted_skills") or []
        lower_to_orig = {}
        for s in raw_skills:
            if isinstance(s, str) and s.strip():
                clean_s = s.strip()
                lower = clean_s.lower()
                if lower not in lower_to_orig:
                    lower_to_orig[lower] = clean_s
        c_skills_sets.append(set(lower_to_orig.keys()))
        c_lower_map.append(lower_to_orig)

    # Common skills
    if c_skills_sets:
        common_lowers = set.intersection(*c_skills_sets)
    else:
        common_lowers = set()

    # Recover display casing
    common_skills = sorted([c_lower_map[0][k] for k in common_lowers])

    # Unique skills per candidate
    unique_skills = {}
    for i, c in enumerate(candidates):
        cid = c.get("id", i)
        other_sets = [c_skills_sets[j] for j in range(len(candidates)) if j != i]
        union_others = set.union(*other_sets) if other_sets else set()
        c_unique = c_skills_sets[i] - union_others
        unique_skills[str(cid)] = sorted([c_lower_map[i][k] for k in c_unique])

    return {
        "common_skills": common_skills,
        "unique_skills": unique_skills,
    }


def _safe_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            return float(val)
        except ValueError:
            return 0.0
    return 0.0


def calculate_score_deltas(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Computes score deltas across the 5 components.
    Produces deterministic templated sentences:
    "{name} scores {delta} points higher on {component}."
    """
    deltas = []

    if len(candidates) < 2:
        return deltas

    for key, label in SCORE_COMPONENTS:
        scores = []
        for c in candidates:
            val = c.get(f"{key}_score")
            if val is None:
                # Only check shorthand key if key != "skills" (which can be a list of skills)
                if key != "skills":
                    val = c.get(key)
                elif isinstance(c.get("skills"), (int, float)):
                    val = c.get("skills")

            score_val = _safe_float(val)
            scores.append({
                "candidate_id": c.get("id"),
                "name": c.get("name", "Candidate"),
                "score": round(score_val, 1),
            })

        # Sort descending by score
        scores.sort(key=lambda x: x["score"], reverse=True)
        top = scores[0]
        runner_up = scores[1]
        delta = round(top["score"] - runner_up["score"], 1)

        if delta > 0:
            sentence = f"{top['name']} scores {delta} points higher on {label}."
        else:
            sentence = f"Candidates are tied on {label} ({top['score']}%)."

        deltas.append({
            "component_key": key,
            "component_label": label,
            "leader_id": top["candidate_id"] if delta > 0 else None,
            "leader_name": top["name"] if delta > 0 else "Tied",
            "delta": delta,
            "scores": {str(s["candidate_id"]): s["score"] for s in scores},
            "sentence": sentence,
        })

    return deltas


def generate_head_to_head_comparison(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Full head-to-head comparison payload for 2-3 candidates.
    """
    skill_overlap = calculate_skill_overlap(candidates)
    score_deltas = calculate_score_deltas(candidates)

    radar_axes = [
        {"key": "semantic", "label": "Semantic Fit"},
        {"key": "skills", "label": "Technical Skills"},
        {"key": "experience", "label": "Experience"},
        {"key": "title", "label": "Title Seniority"},
        {"key": "education", "label": "Education"},
    ]

    candidate_summaries = []
    for c in candidates:
        raw_skills = c.get("skills") or c.get("extracted_skills") or []
        candidate_summaries.append({
            "id": c.get("id"),
            "name": c.get("name", "Candidate"),
            "detected_title": c.get("detected_title") or c.get("title") or "Candidate",
            "overall_score": round(float(c.get("overall_score") or 0.0), 1),
            "tier": c.get("tier", "Low"),
            "experience_years": c.get("experience_years") or 0.0,
            "career_pattern_summary": c.get("career_pattern_summary"),
            "scores": {
                "semantic": round(_safe_float(c.get("semantic_score", c.get("semantic"))), 1),
                "skills": round(_safe_float(c.get("skills_score", c.get("skills") if isinstance(c.get("skills"), (int, float)) else 0.0)), 1),
                "experience": round(_safe_float(c.get("experience_score", c.get("experience"))), 1),
                "title": round(_safe_float(c.get("title_score", c.get("title"))), 1),
                "education": round(_safe_float(c.get("education_score", c.get("education"))), 1),
            },
            "skills_count": len(raw_skills),
            "matched_skills": c.get("matched_skills") or [],
            "missing_skills": c.get("missing_skills") or [],
        })

    return {
        "candidate_count": len(candidates),
        "candidates": candidate_summaries,
        "radar_axes": radar_axes,
        "skill_overlap": skill_overlap,
        "score_deltas": score_deltas,
    }
