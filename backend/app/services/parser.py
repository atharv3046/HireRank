"""
Module 1: Resume Parser
========================
Responsibilities:
  1. Extract raw text from PDF / DOCX files (with fallback chain)
  2. Normalise whitespace, unicode characters, and encoding artifacts
  3. Segment text into canonical sections:
       contact | education | experience | skills | projects | other
  4. Expose a single ResumeParser.parse(path) -> ParsedResume dataclass

Design choices
--------------
- Section detection uses a priority-ranked regex table. Each heading candidate
  is scored; the section with the highest-priority match wins. A rule-based
  fallback assigns remaining text to the last known section.
- We never trust a heading that appears on the same line as dense body text
  (likely a table cell, not a real heading).
- Unicode normalisation converts curly quotes, em-dashes, and common
  ligatures so downstream regex patterns can use plain ASCII.
- All extraction is deterministic. No LLM is called.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Data Structures
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ResumeSection:
    """A labelled segment of a resume."""
    label: str          # 'contact' | 'education' | 'experience' | 'skills' | 'projects' | 'other'
    raw_text: str       # verbatim lines in this section


@dataclass
class ParsedResume:
    """Output of ResumeParser.parse()."""
    file_path: str
    raw_text: str                          # full normalised text
    sections: dict[str, str]              # label -> text
    parse_status: str                     # 'ok' | 'needs_review' | 'failed'
    parse_notes: list[str] = field(default_factory=list)   # warnings

    # Convenience accessors
    @property
    def contact_text(self) -> str:
        return self.sections.get("contact", "")

    @property
    def education_text(self) -> str:
        return self.sections.get("education", "")

    @property
    def experience_text(self) -> str:
        return self.sections.get("experience", "")

    @property
    def skills_text(self) -> str:
        return self.sections.get("skills", "")

    @property
    def projects_text(self) -> str:
        return self.sections.get("projects", "")


# ──────────────────────────────────────────────────────────────────────────────
# Section Heading Patterns
# Each entry: (canonical_label, [regex patterns], priority)
# Lower priority number = checked first. First match wins.
# ──────────────────────────────────────────────────────────────────────────────

SECTION_PATTERNS: list[tuple[str, list[str], int]] = [
    ("contact", [
        r"contact\s*(information|details|info)?",
        r"personal\s*(information|details|profile)?",
        r"(phone|email|address|linkedin)\s*:",   # common field labels
    ], 1),

    ("education", [
        r"education(al)?\s*(background|qualifications|history)?",
        r"academic\s*(background|record|history|qualifications)",
        r"qualifications?",
        r"degrees?\s*(and\s*certifications?)?",
    ], 2),

    ("experience", [
        r"(work|professional|employment|career|job)\s*(experience|history|background)?",
        r"experience",
        r"internship(s)?",
        r"positions?\s*(held|of\s*responsibility)",
    ], 3),

    ("skills", [
        r"(technical\s*)?(skills?|competenc(y|ies)|expertise|proficienc(y|ies))",
        r"(core|key|primary)\s*(skills?|strengths?)",
        r"technologies\s*(used)?",
        r"programming\s*(languages?|skills?)",
        r"tools?\s*(and\s*(technologies?|frameworks?))?",
        r"languages?\s*and\s*frameworks?",
    ], 4),

    ("projects", [
        r"(personal\s*|academic\s*|key\s*|major\s*)?projects?",
        r"portfolio",
        r"open[\s-]source\s*(contributions?)?",
        r"side\s*projects?",
        r"notable\s*(works?|contributions?)",
    ], 5),

    ("certifications", [
        r"certifications?\s*(and\s*(awards?|achievements?))?",
        r"licenses?\s*and\s*certifications?",
        r"awards?\s*(and\s*achievements?)?",
        r"achievements?",
        r"accomplishments?",
    ], 6),

    ("publications", [
        r"publications?\s*(and\s*research)?",
        r"research\s*(papers?|work|experience)?",
        r"conference\s*papers?",
    ], 7),

    ("summary", [
        r"(professional\s*)?summary",
        r"(career|executive|professional)\s*(objective|summary|profile|overview)",
        r"about\s*(me|myself)?",
        r"objective",
        r"profile",
        r"overview",
    ], 0),   # priority 0 = checked very first (summary/objective are at top)
]

# Pre-compile all patterns (case-insensitive, full-line anchored)
_COMPILED_SECTIONS: list[tuple[str, list[re.Pattern], int]] = [
    (label, [re.compile(p, re.IGNORECASE) for p in patterns], priority)
    for label, patterns, priority in SECTION_PATTERNS
]


# ──────────────────────────────────────────────────────────────────────────────
# Text Normalisation
# ──────────────────────────────────────────────────────────────────────────────

# Characters that should become a plain space
_UNICODE_SPACES = re.compile(r"[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]")

# Characters that should become a plain hyphen/dash
_DASHES = re.compile(r"[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]")

# Smart quotes → plain quotes
_CURLY_QUOTES = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
})

# Common ligatures
_LIGATURES = str.maketrans({
    "\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl",
    "\ufb03": "ffi", "\ufb04": "ffl",
})

# Bullet characters → plain dash
_BULLETS = re.compile(r"[•·‣▪▸◦‐–]")

# Collapse excessive blank lines (more than 2 consecutive)
_EXCESS_BLANKS = re.compile(r"\n{3,}")


def normalise_text(raw: str) -> str:
    """
    Clean a raw extracted string:
    1. Decode to NFC unicode (canonical composition)
    2. Replace non-standard whitespace, dashes, quotes, ligatures
    3. Strip control characters
    4. Normalise blank lines
    """
    if not raw:
        return ""

    # NFC normalisation (e.g. é as one codepoint, not e + combining accent)
    text = unicodedata.normalize("NFC", raw)

    # Unicode substitutions
    text = _UNICODE_SPACES.sub(" ", text)
    text = _DASHES.sub("-", text)
    text = text.translate(_CURLY_QUOTES)
    text = text.translate(_LIGATURES)
    text = _BULLETS.sub("-", text)

    # Remove zero-width and other invisible control characters (keep newlines/tabs)
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Cc", "Cf") or ch in "\n\t\r")

    # Normalise line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Strip trailing whitespace from each line
    text = "\n".join(line.rstrip() for line in text.split("\n"))

    # Collapse excessive blank lines
    text = _EXCESS_BLANKS.sub("\n\n", text)

    return text.strip()


# ──────────────────────────────────────────────────────────────────────────────
# Text Extraction Backends
# ──────────────────────────────────────────────────────────────────────────────

def _extract_pdf(path: str) -> tuple[str, str]:
    """
    Returns (text, status).
    Tries pdfplumber first (best for text-based PDFs), falls back to pypdf.
    Returns ('', 'needs_review') for scanned/image PDFs with no extractable text.
    """
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            pages = [page.extract_text(x_tolerance=2, y_tolerance=2) or "" for page in pdf.pages]
        text = "\n\n".join(p for p in pages if p.strip())
        if len(text.strip()) > 50:
            return text, "ok"
    except Exception as e:
        logger.warning("pdfplumber failed for %s: %s", path, e)

    # Fallback: pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(p for p in pages if p.strip())
        if len(text.strip()) > 50:
            return text, "ok"
    except Exception as e:
        logger.warning("pypdf fallback failed for %s: %s", path, e)

    return "", "needs_review"


def _extract_docx(path: str) -> tuple[str, str]:
    """Extract text from .docx preserving paragraph breaks."""
    try:
        from docx import Document
        doc = Document(path)
        paragraphs = [para.text for para in doc.paragraphs]

        # Also pull text from tables (common in formatted resumes)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text:
                        paragraphs.append(cell_text)

        text = "\n".join(paragraphs)
        if len(text.strip()) > 50:
            return text, "ok"
        return text, "needs_review"
    except Exception as e:
        logger.warning("docx extraction failed for %s: %s", path, e)
        return "", "needs_review"


def extract_raw_text(file_path: str) -> tuple[str, str]:
    """
    Route to the correct extractor based on file extension.
    Returns (raw_text, status) where status ∈ {'ok', 'needs_review', 'failed'}.
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext in (".docx", ".doc"):
        return _extract_docx(file_path)
    else:
        return "", "failed"


# ──────────────────────────────────────────────────────────────────────────────
# Section Segmenter
# ──────────────────────────────────────────────────────────────────────────────

def _is_heading_line(line: str) -> Optional[str]:
    """
    Determine if a line is a section heading.
    Returns canonical label string if matched, else None.

    Heuristics used to avoid false positives:
    - Line must be short (≤ 60 chars after stripping). A full sentence is not a heading.
    - Line should not contain sentence-ending punctuation mid-way (periods, commas in body)
      unless it is a known label like "B.Tech, Computer Science" → handled by education patterns.
    - Heading lines are often ALL CAPS or Title Case.
    """
    stripped = line.strip()
    if not stripped or len(stripped) > 65:
        return None

    # Lines that are clearly body text (contain many words and normal sentence punctuation)
    word_count = len(stripped.split())
    has_sentence_end = bool(re.search(r"[.;]\s+\w", stripped))
    if word_count > 8 and has_sentence_end:
        return None

    # Try each section pattern, ordered by priority
    matches: list[tuple[int, str]] = []
    for label, patterns, priority in _COMPILED_SECTIONS:
        for pat in patterns:
            # Match the full stripped line (anchored), allowing for trailing punctuation/colon
            if pat.fullmatch(stripped.rstrip(":- \t")):
                matches.append((priority, label))
                break

    if not matches:
        return None

    # Return the label with the lowest priority number (= highest precedence)
    matches.sort(key=lambda x: x[0])
    return matches[0][1]


def segment_sections(text: str) -> dict[str, str]:
    """
    Split normalised resume text into labelled sections.

    Algorithm:
    1. Walk lines top-to-bottom.
    2. When a heading line is detected, start accumulating into that section.
    3. Text before the first detected heading goes into 'contact' (resumes
       typically start with name/contact info).
    4. If no headings are detected at all (table-heavy layout), put everything
       in 'other' and note it as needing review.

    Returns dict mapping label → text block.
    """
    lines = text.split("\n")
    sections: dict[str, list[str]] = {}
    current_label = "contact"   # first block assumed to be contact info
    sections[current_label] = []

    heading_found = False

    for line in lines:
        label = _is_heading_line(line)
        if label:
            heading_found = True
            current_label = label
            if label not in sections:
                sections[label] = []
            # Don't include the heading line itself in content
        else:
            if current_label not in sections:
                sections[current_label] = []
            sections[current_label].append(line)

    # If no section headings found at all, put everything in 'other'
    if not heading_found:
        return {"other": text, "contact": ""}

    # Join and strip each section's text
    result = {}
    for label, collected_lines in sections.items():
        block = "\n".join(collected_lines).strip()
        if block:
            result[label] = block

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Main Parser
# ──────────────────────────────────────────────────────────────────────────────

class ResumeParser:
    """
    Entry point for resume parsing.

    Usage:
        parser = ResumeParser()
        result: ParsedResume = parser.parse("/path/to/resume.pdf")
    """

    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
    MAX_FILE_SIZE_MB = 10

    def parse(self, file_path: str) -> ParsedResume:
        notes: list[str] = []
        path = Path(file_path)

        # ── Validation ──────────────────────────────────────────────────────
        if path.suffix.lower() not in self.ALLOWED_EXTENSIONS:
            return ParsedResume(
                file_path=file_path,
                raw_text="",
                sections={},
                parse_status="failed",
                parse_notes=[f"Unsupported file type: {path.suffix}"]
            )

        size_mb = path.stat().st_size / (1024 * 1024) if path.exists() else 0
        if size_mb > self.MAX_FILE_SIZE_MB:
            notes.append(f"File size {size_mb:.1f} MB exceeds limit of {self.MAX_FILE_SIZE_MB} MB")
            return ParsedResume(
                file_path=file_path,
                raw_text="",
                sections={},
                parse_status="failed",
                parse_notes=notes
            )

        # ── Extraction ───────────────────────────────────────────────────────
        raw_text, extract_status = extract_raw_text(file_path)

        if extract_status == "failed" or not raw_text.strip():
            return ParsedResume(
                file_path=file_path,
                raw_text="",
                sections={},
                parse_status="failed",
                parse_notes=["Text extraction produced no output. File may be corrupt."]
            )

        if extract_status == "needs_review":
            notes.append("Very little text extracted. Resume may be image-based or scanned — needs manual review.")

        # ── Normalisation ────────────────────────────────────────────────────
        clean_text = normalise_text(raw_text)

        if len(clean_text.strip()) < 100:
            notes.append("Extracted text is very short (< 100 chars). May be incomplete.")
            return ParsedResume(
                file_path=file_path,
                raw_text=clean_text,
                sections={"other": clean_text},
                parse_status="needs_review",
                parse_notes=notes
            )

        # ── Section Segmentation ─────────────────────────────────────────────
        sections = segment_sections(clean_text)

        if "other" in sections and len(sections) == 1:
            notes.append("No section headings detected. Resume may use a table-heavy layout. Treating as single block.")
            parse_status = "needs_review"
        else:
            parse_status = "ok" if not notes else "needs_review"

        return ParsedResume(
            file_path=file_path,
            raw_text=clean_text,
            sections=sections,
            parse_status=parse_status,
            parse_notes=notes
        )
