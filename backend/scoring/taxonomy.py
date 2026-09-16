"""
Standalone Skills Taxonomy Module
=================================
Loads canonical skills and aliases with RapidFuzz support.
Zero FastAPI or DB imports.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional, Dict, List, Set
from rapidfuzz import process, fuzz

logger = logging.getLogger(__name__)

# Default path to skills taxonomy data
DATA_PATH = Path(__file__).parent.parent / "app" / "data" / "skills_taxonomy.json"


class SkillsTaxonomy:
    """
    In-memory skills taxonomy lookup and fuzzy alias matcher.
    Maps known aliases to canonical skill names and categories.
    """

    def __init__(self, data_path: Optional[Path] = None):
        self.data_path = data_path or DATA_PATH
        self.canonical_skills: Set[str] = set()
        self.alias_to_canonical: Dict[str, str] = {}
        self.skill_to_category: Dict[str, str] = {}
        self.categories: Dict[str, List[str]] = {}
        self._all_lookup_keys: List[str] = []
        self._load_taxonomy()

    def _load_taxonomy(self) -> None:
        if not self.data_path.exists():
            logger.warning("Taxonomy file not found at %s. Initializing empty.", self.data_path)
            return

        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for entry in data:
            canonical = entry.get("canonical", "").strip()
            if not canonical:
                continue

            category = entry.get("category", "General")
            aliases = entry.get("aliases", [])

            self.canonical_skills.add(canonical)
            self.skill_to_category[canonical] = category
            self.categories.setdefault(category, []).append(canonical)

            # Map lowercase canonical to canonical
            self.alias_to_canonical[canonical.lower()] = canonical

            # Map aliases
            for alias in aliases:
                alias_clean = alias.strip().lower()
                if alias_clean:
                    self.alias_to_canonical[alias_clean] = canonical

        self._all_lookup_keys = list(self.alias_to_canonical.keys())

    def normalize_skill(self, skill_name: str) -> str:
        """
        Convert a raw skill string to canonical form using exact lowercase
        matching first, followed by rapidfuzz alias matching.
        """
        if not skill_name:
            return skill_name

        cleaned = skill_name.strip()
        lowered = cleaned.lower()

        # 1. Exact match (canonical or registered alias)
        if lowered in self.alias_to_canonical:
            return self.alias_to_canonical[lowered]

        # 2. Fuzzy match against registered aliases & canonicals using rapidfuzz
        if self._all_lookup_keys:
            match = process.extractOne(
                lowered,
                self._all_lookup_keys,
                scorer=fuzz.ratio,
                score_cutoff=88.0
            )
            if match:
                matched_key = match[0]
                return self.alias_to_canonical[matched_key]

        return cleaned

    def get_category(self, canonical_skill: str) -> str:
        return self.skill_to_category.get(canonical_skill, "Other")

    def is_known_skill(self, skill_name: str) -> bool:
        normalized = self.normalize_skill(skill_name)
        return normalized in self.canonical_skills


_GLOBAL_TAXONOMY: Optional[SkillsTaxonomy] = None


def get_taxonomy() -> SkillsTaxonomy:
    global _GLOBAL_TAXONOMY
    if _GLOBAL_TAXONOMY is None:
        _GLOBAL_TAXONOMY = SkillsTaxonomy()
    return _GLOBAL_TAXONOMY
