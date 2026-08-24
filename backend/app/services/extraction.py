import re
import json
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

SKILLS_PATH = Path(__file__).parent.parent / "data" / "skills_taxonomy.json"

# Education level ordinal map (for scoring)
EDUCATION_LEVELS = {
    "high_school": 1, "associate": 2, "bachelors": 3, "masters": 4, "phd": 5
}

EDUCATION_KEYWORDS = {
    "phd": ["phd", "ph.d", "ph.d.", "doctorate", "doctoral", "doctor of philosophy"],
    "masters": ["master", "m.s.", "ms ", " ms,", "m.tech", "mtech", "mba", "m.b.a", "m.eng", "meng", "m.sc", "msc"],
    "bachelors": ["bachelor", "b.s.", "bs ", " bs,", "b.tech", "btech", "b.e.", " be ", "b.sc", "bsc", "b.a.", "b.a ", "undergraduate"],
    "associate": ["associate", "a.s.", "a.a."],
    "high_school": ["high school", "hsc", "secondary school", "ged", "12th grade", "12th std"]
}

SECTION_HEADERS = {
    "skills": ["skills", "technical skills", "technologies", "tech stack", "tools", "competencies", "expertise", "proficiencies"],
    "experience": ["experience", "work experience", "employment", "work history", "professional experience", "career"],
    "education": ["education", "academic", "qualification", "degree", "university", "college"]
}


class ResumeExtractor:
    def __init__(self):
        self._nlp = None
        self._skills_data = None
        self._phrase_matcher = None
        self._skill_alias_map = {}  # alias (lowercase) -> canonical

    def _load_nlp(self):
        if self._nlp is None:
            import spacy
            try:
                self._nlp = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("en_core_web_sm not found, downloading...")
                import subprocess, sys
                subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_sm"], check=True)
                self._nlp = spacy.load("en_core_web_sm")
        return self._nlp

    def _load_skills(self):
        if self._skills_data is None:
            with open(SKILLS_PATH, "r", encoding="utf-8") as f:
                self._skills_data = json.load(f)
            # Build alias -> canonical map
            for entry in self._skills_data:
                canonical = entry["canonical"]
                self._skill_alias_map[canonical.lower()] = canonical
                for alias in entry.get("aliases", []):
                    self._skill_alias_map[alias.lower()] = canonical
        return self._skills_data

    def _build_phrase_matcher(self):
        if self._phrase_matcher is None:
            from spacy.matcher import PhraseMatcher
            nlp = self._load_nlp()
            self._load_skills()
            self._phrase_matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
            for entry in self._skills_data:
                canonical = entry["canonical"]
                terms = [canonical] + entry.get("aliases", [])
                patterns = [nlp.make_doc(term) for term in terms]
                self._phrase_matcher.add(canonical, patterns)
        return self._phrase_matcher

    def extract_contact_info(self, text: str) -> dict:
        """Extract email, phone, and name from resume text."""
        result = {"email": None, "phone": None, "name": None}
        
        # Email
        email_pattern = r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, text)
        if emails:
            result["email"] = emails[0]
        
        # Phone — handles multiple formats
        phone_pattern = r'(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)?\d{3}[\s\-.]?\d{4}'
        phones = re.findall(phone_pattern, text)
        # Filter out short matches (e.g. year numbers)
        phones = [p.strip() for p in phones if len(re.sub(r'\D', '', p)) >= 10]
        if phones:
            result["phone"] = phones[0]
        
        # Name — from first 3 lines using spaCy PERSON NER
        try:
            nlp = self._load_nlp()
            first_lines = "\n".join(text.strip().splitlines()[:5])
            doc = nlp(first_lines)
            persons = [ent.text.strip() for ent in doc.ents if ent.label_ == "PERSON"]
            if persons:
                result["name"] = persons[0]
            else:
                # Fallback: first non-empty line that looks like a name (2-4 words, alpha only)
                for line in text.strip().splitlines()[:3]:
                    line = line.strip()
                    words = line.split()
                    if 2 <= len(words) <= 4 and all(w.replace("-", "").replace(".", "").isalpha() for w in words):
                        result["name"] = line
                        break
        except Exception as e:
            logger.warning(f"Name extraction failed: {e}")
        
        return result

    def _detect_sections(self, text: str) -> dict:
        """Split text into named sections by detecting section headers."""
        lines = text.splitlines()
        sections = {"skills": "", "experience": "", "education": "", "full": text}
        current_section = "full"
        section_text = {"full": []}
        
        for line in lines:
            line_lower = line.lower().strip()
            matched_section = None
            for section_name, headers in SECTION_HEADERS.items():
                if any(line_lower == h or line_lower.startswith(h + ":" ) or line_lower.startswith(h + " ") for h in headers):
                    if len(line_lower) < 40:  # Likely a header, not content
                        matched_section = section_name
                        break
            
            if matched_section:
                current_section = matched_section
                if current_section not in section_text:
                    section_text[current_section] = []
            else:
                if current_section not in section_text:
                    section_text[current_section] = []
                section_text[current_section].append(line)
                section_text["full"].append(line)
        
        for k, v in section_text.items():
            sections[k] = "\n".join(v)
        
        return sections

    def extract_skills(self, text: str) -> list:
        """Extract canonical skill names from resume text using PhraseMatcher."""
        try:
            nlp = self._load_nlp()
            matcher = self._build_phrase_matcher()
            sections = self._detect_sections(text)
            
            # Prioritize skills section + full text
            search_texts = [text]
            if sections.get("skills"):
                search_texts.insert(0, sections["skills"])
            
            found_skills = set()
            for search_text in search_texts:
                doc = nlp(search_text[:50000])  # Limit for performance
                matches = matcher(doc)
                for match_id, start, end in matches:
                    canonical = nlp.vocab.strings[match_id]
                    found_skills.add(canonical)
            
            return sorted(list(found_skills))
        except Exception as e:
            logger.warning(f"Skills extraction failed: {e}")
            return []

    def extract_experience_years(self, text: str) -> float:
        """Parse work experience date ranges and calculate total years."""
        try:
            sections = self._detect_sections(text)
            search_text = sections.get("experience", "") or text
            
            # Date range patterns
            month_names = r'(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
            year_pattern = r'(?:19|20)\d{2}'
            
            patterns = [
                # "Jan 2020 - Dec 2022" or "January 2020 - Present"
                rf'({month_names}\s+{year_pattern})\s*[-–—to]+\s*({month_names}\s+{year_pattern}|[Pp]resent|[Cc]urrent|[Nn]ow)',
                # "2019 - 2022" or "2019 – Present"
                rf'({year_pattern})\s*[-–—to]+\s*({year_pattern}|[Pp]resent|[Cc]urrent|[Nn]ow)',
                # "06/2018 - 03/2021" or "2018/06 - 2021/03"
                rf'(\d{{1,2}}/\d{{4}}|\d{{4}}/\d{{1,2}})\s*[-–—to]+\s*(\d{{1,2}}/\d{{4}}|\d{{4}}/\d{{1,2}}|[Pp]resent|[Cc]urrent)',
            ]
            
            intervals = []
            current_year = datetime.now().year
            
            for pattern in patterns:
                for match in re.finditer(pattern, search_text):
                    start_str, end_str = match.group(1), match.group(2)
                    start_dt = _parse_date_str(start_str, current_year)
                    end_dt = _parse_date_str(end_str, current_year)
                    if start_dt and end_dt and start_dt <= end_dt:
                        intervals.append((start_dt, end_dt))
            
            if intervals:
                # Merge overlapping intervals
                intervals.sort(key=lambda x: x[0])
                merged = [intervals[0]]
                for start, end in intervals[1:]:
                    if start <= merged[-1][1]:
                        merged[-1] = (merged[-1][0], max(merged[-1][1], end))
                    else:
                        merged.append((start, end))
                
                total_months = sum((e.year - s.year) * 12 + (e.month - s.month) for s, e in merged)
                return round(max(0, total_months / 12), 1)
            
            # Fallback: explicit statement like "5 years of experience"
            exp_match = re.search(r'(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:experience|exp)', text, re.IGNORECASE)
            if exp_match:
                return float(exp_match.group(1))
            
            return 0.0
        except Exception as e:
            logger.warning(f"Experience extraction failed: {e}")
            return 0.0

    def extract_education(self, text: str) -> dict:
        """Extract education level from resume text."""
        try:
            sections = self._detect_sections(text)
            search_text = sections.get("education", "") or text
            text_lower = search_text.lower()
            
            for level, keywords in EDUCATION_KEYWORDS.items():
                for kw in keywords:
                    if kw in text_lower:
                        # Find the matching line for transparency
                        for line in search_text.splitlines():
                            if kw in line.lower():
                                return {"level": level, "raw_text": line.strip()}
                        return {"level": level, "raw_text": kw}
            
            return {"level": None, "raw_text": ""}
        except Exception as e:
            logger.warning(f"Education extraction failed: {e}")
            return {"level": None, "raw_text": ""}

    def extract_all(self, candidate_id: int, db=None) -> dict:
        """Run full extraction pipeline on a candidate and update DB."""
        from app.core.database import SessionLocal
        from app.models.candidate import Candidate
        
        close_db = db is None
        if db is None:
            db = SessionLocal()
        
        try:
            candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
            if not candidate or not candidate.raw_text:
                logger.warning(f"Candidate {candidate_id} not found or has no raw_text")
                return {}
            
            candidate.processing_status = "extracting"
            db.commit()
            
            text = candidate.raw_text
            result = {}
            
            # Contact info
            try:
                contact = self.extract_contact_info(text)
                result.update(contact)
                if not candidate.name:
                    candidate.name = contact.get("name")
                if not candidate.email:
                    candidate.email = contact.get("email")
                candidate.phone = contact.get("phone")
            except Exception as e:
                logger.warning(f"Contact extraction failed for candidate {candidate_id}: {e}")
            
            # Skills
            try:
                skills = self.extract_skills(text)
                candidate.extracted_skills = skills
                result["skills"] = skills
            except Exception as e:
                logger.warning(f"Skills extraction failed for candidate {candidate_id}: {e}")
                candidate.extracted_skills = []
            
            # Experience
            try:
                exp_years = self.extract_experience_years(text)
                candidate.experience_years = exp_years
                result["experience_years"] = exp_years
            except Exception as e:
                logger.warning(f"Experience extraction failed for candidate {candidate_id}: {e}")
                candidate.experience_years = 0.0
            
            # Education
            try:
                edu = self.extract_education(text)
                candidate.education_level = edu.get("level")
                candidate.education_details = edu.get("raw_text")
                result["education"] = edu
            except Exception as e:
                logger.warning(f"Education extraction failed for candidate {candidate_id}: {e}")
            
            candidate.processing_status = "extracted_fields"
            db.commit()
            
            return result
        except Exception as e:
            logger.error(f"extract_all failed for candidate {candidate_id}: {e}")
            if candidate:
                candidate.processing_status = "error"
                candidate.error_message = str(e)
                db.commit()
            raise
        finally:
            if close_db:
                db.close()


def _parse_date_str(date_str: str, current_year: int):
    """Parse a date string into a datetime object."""
    from datetime import datetime
    
    date_str = date_str.strip()
    
    if date_str.lower() in ("present", "current", "now"):
        return datetime(current_year, datetime.now().month, 1)
    
    formats = [
        ("%B %Y", True),    # January 2020
        ("%b %Y", True),    # Jan 2020
        ("%Y", False),       # 2020
        ("%m/%Y", True),    # 06/2020
        ("%Y/%m", True),    # 2020/06
    ]
    
    for fmt, has_month in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt
        except ValueError:
            continue
    
    return None


# Singleton instance
_extractor = None

def get_extractor() -> ResumeExtractor:
    global _extractor
    if _extractor is None:
        _extractor = ResumeExtractor()
    return _extractor
