"""
Shared Aggregation Logic
========================
Computes batch-level and org-level metrics:
  - total_processed
  - strong_count (>= 75)
  - potential_count (55 - 74.9)
  - low_count (< 55)
  - needs_review_count
  - average_score (calculated only over candidates with numeric scores)
  - tier_breakdown

Used identically by ResultsPreviewPage, DashboardPage, and JobDetailPage.
"""

from __future__ import annotations

from typing import List, Dict, Any, Optional


def compute_batch_aggregates(candidates_with_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Unified aggregation function for candidate batch results.
    Accepts candidate dicts containing at least 'score' and 'tier'.
    """
    total = len(candidates_with_scores)
    strong = 0
    potential = 0
    low = 0
    needs_review = 0
    numeric_scores: List[float] = []

    for c in candidates_with_scores:
        t = c.get("tier", "Low")
        score = c.get("score")

        if t == "Strong":
            strong += 1
        elif t == "Potential":
            potential += 1
        elif t == "Needs Review" or c.get("needs_manual_review"):
            needs_review += 1
        else:
            low += 1

        if score is not None and isinstance(score, (int, float)):
            numeric_scores.append(float(score))

    avg_score = round(sum(numeric_scores) / len(numeric_scores), 1) if numeric_scores else None

    return {
        "total_processed": total,
        "strong_count": strong,
        "potential_count": potential,
        "low_count": low,
        "needs_review_count": needs_review,
        "average_score": avg_score,
        "tier_distribution": {
            "Strong": strong,
            "Potential": potential,
            "Low": low,
            "Needs Review": needs_review,
        }
    }
