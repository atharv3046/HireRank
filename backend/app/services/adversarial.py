"""
adversarial.py
==============
Adversarial Shield Service for HireRank
Detects:
  1. Prompt injection attacks (jailbreaks, instruction overrides, score tampering)
  2. Hidden & invisible text (white-on-white text, font-size < 1.5pt, zero-width Unicode)
  3. Excessive keyword stuffing

Protects recruiters from gamed resumes and gates downstream AI generation (Claude API).
"""

from __future__ import annotations
import os
import re
import unicodedata
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── 1. Prompt Injection Signatures ──────────────────────────────────────────
# High-confidence adversarial patterns targeting LLM evaluators
INJECTION_RULES: List[Tuple[str, str, str]] = [
    (
        "Instruction Override",
        r"(?i)\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|prompts?|rules?|directives?)",
        "Attempts to override system instructions and prompt context."
    ),
    (
        "System Prompt Impersonation",
        r"(?i)(?:system\s*prompt\s*:|\[system\]|<system>|system\s*directive\s*:|developer\s*mode\s*:)",
        "Impersonates a system-level instruction block to hijack evaluator persona."
    ),
    (
        "Direct Score Tampering",
        r"(?i)\b(?:rate|score|give|assign)\s+(?:this\s+)?(?:candidate|resume|applicant|profile)\s+(?:a\s+score\s+of\s+)?(?:100|100%|top\s+score|maximum|strong|perfect|highest)",
        "Explicitly commands the evaluator to assign a 100% score or Strong tier."
    ),
    (
        "Tier Manipulation Directive",
        r"(?i)\b(?:you\s+must|always)\s+(?:rate|score|rank|classify)\s+(?:this\s+)?(?:candidate|resume|profile)\s+as\s+(?:strong|top|tier\s+1|100)",
        "Directs the evaluator to unconditionally assign top classification."
    ),
    (
        "Assistant Persona Hijacking",
        r"(?i)\b(?:you\s+are\s+now|act\s+as\s+an?)\s+(?:unrestricted|compliant|helpful\s+assistant|ai\s+evaluator\s+that\s+gives\s+top)",
        "Attempts to redefine AI agent behavior and bypass security rules."
    ),
    (
        "Penalty Bypass Directive",
        r"(?i)\b(?:do\s+not\s+penalize|ignore\s+missing\s+skills|bypass\s+skill\s+requirements|override\s+scoring\s+algorithm)",
        "Attempts to disable penalty capping or missing skill detection."
    ),
    (
        "Hidden Instruction Tag",
        r"(?i)\[(?:instruction|admin|override|secret_instruction)\]",
        "Uses pseudo-markup tags to inject hidden administrative instructions."
    ),
]

# Zero-width / invisible Unicode codepoint ranges
ZERO_WIDTH_PATTERN = re.compile(r"[\u200B-\u200D\uFEFF\u2060\u200E\u200F]")


def scan_text_for_injections(text: Optional[str]) -> List[Dict[str, Any]]:
    """Scan raw text for prompt injections and invisible unicode characters."""
    if not text:
        return []

    detections = []

    # 1. Regex signature scans
    for rule_name, pattern, explanation in INJECTION_RULES:
        for match in re.finditer(pattern, text):
            start, end = match.start(), match.end()
            # Context window around match
            ctx_start = max(0, start - 40)
            ctx_end = min(len(text), end + 40)
            snippet = text[ctx_start:ctx_end].strip().replace("\n", " ")

            detections.append({
                "type": "prompt_injection",
                "rule": rule_name,
                "snippet": snippet,
                "matched_text": match.group(0),
                "start_offset": start,
                "end_offset": end,
                "explanation": explanation
            })

    # 2. Zero-width invisible Unicode characters
    zero_width_matches = list(ZERO_WIDTH_PATTERN.finditer(text))
    if len(zero_width_matches) >= 5:
        first_match = zero_width_matches[0]
        st = max(0, first_match.start() - 30)
        en = min(len(text), first_match.end() + 30)
        detections.append({
            "type": "invisible_unicode",
            "rule": "Zero-Width Character Stuffing",
            "snippet": text[st:en].strip() or "[Invisible Unicode sequence]",
            "matched_text": f"{len(zero_width_matches)} zero-width characters detected",
            "start_offset": first_match.start(),
            "end_offset": zero_width_matches[-1].end(),
            "explanation": f"Contains {len(zero_width_matches)} invisible Unicode characters often used for steganographic prompt injection."
        })

    # 3. Excessive consecutive keyword stuffing (e.g., repeating a single skill 10+ times)
    words = text.split()
    if len(words) >= 10:
        consecutive_count = 1
        last_word = words[0].lower()
        for w in words[1:]:
            w_norm = re.sub(r"[^\w]", "", w.lower())
            if w_norm and w_norm == last_word and len(w_norm) > 2:
                consecutive_count += 1
                if consecutive_count >= 10:
                    detections.append({
                        "type": "keyword_stuffing",
                        "rule": "Repetitive Keyword Stuffing",
                        "snippet": f"Repeated '{last_word}' {consecutive_count}+ times consecutively.",
                        "matched_text": last_word,
                        "explanation": f"Keyword '{last_word}' artificially repeated {consecutive_count} times to game ranking algorithms."
                    })
                    break
            else:
                consecutive_count = 1
                last_word = w_norm

    return detections


def scan_file_for_hidden_text(file_path: Optional[str]) -> List[Dict[str, Any]]:
    """
    Inspect PDF or DOCX file formatting for invisible/white text and microscopic font sizes.
    """
    if not file_path or not os.path.exists(file_path):
        return []

    ext = os.path.splitext(file_path)[1].lower()
    detections = []

    # ── PDF Inspection ──
    if ext == ".pdf":
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page_idx, page in enumerate(pdf.pages[:10]):
                    # Inspect individual character objects
                    chars = getattr(page, "chars", [])
                    hidden_chars = []
                    white_chars = []

                    for ch in chars:
                        text_val = ch.get("text", "")
                        if not text_val.strip():
                            continue

                        # Check font size (< 1.5 pt is microscopic/invisible)
                        size = ch.get("size", 10.0)
                        if 0.0 < size < 1.5:
                            hidden_chars.append(text_val)

                        # Check color: white text
                        non_stroke = ch.get("non_stroking_color")
                        if non_stroke is not None:
                            is_white = False
                            if isinstance(non_stroke, (int, float)) and non_stroke >= 0.98:
                                is_white = True
                            elif isinstance(non_stroke, (list, tuple)):
                                if len(non_stroke) >= 3 and all(c >= 0.98 for c in non_stroke[:3]):
                                    is_white = True
                                elif len(non_stroke) >= 3 and all(c >= 250 for c in non_stroke[:3]):
                                    is_white = True
                                elif len(non_stroke) == 1 and non_stroke[0] >= 0.98:
                                    is_white = True

                            if is_white:
                                white_chars.append(text_val)

                    if hidden_chars:
                        sample = "".join(hidden_chars[:120])
                        detections.append({
                            "type": "invisible_text",
                            "rule": "Microscopic Font Size (<1.5pt)",
                            "snippet": sample,
                            "page": page_idx + 1,
                            "explanation": f"Page {page_idx + 1} contains microscopic text (font size < 1.5pt) invisible to human recruiters."
                        })

                    if white_chars:
                        sample = "".join(white_chars[:120])
                        detections.append({
                            "type": "invisible_text",
                            "rule": "White Text on White Background",
                            "snippet": sample,
                            "page": page_idx + 1,
                            "explanation": f"Page {page_idx + 1} contains text rendered in white (#FFFFFF) invisible to human recruiters."
                        })
        except Exception as e:
            logger.debug("PDF hidden text inspection error: %s", e)

    # ── DOCX Inspection ──
    elif ext in (".docx", ".doc"):
        try:
            from docx import Document
            doc = Document(file_path)
            hidden_runs = []
            white_runs = []

            for p in doc.paragraphs:
                for run in p.runs:
                    txt = run.text.strip()
                    if not txt:
                        continue
                    # Check hidden property
                    if getattr(run.font, "hidden", False):
                        hidden_runs.append(txt)
                    # Check tiny font size
                    if run.font.size and run.font.size.pt < 1.5:
                        hidden_runs.append(txt)
                    # Check color RGB(255, 255, 255)
                    if run.font.color and run.font.color.rgb:
                        rgb = run.font.color.rgb
                        if (rgb[0], rgb[1], rgb[2]) == (255, 255, 255):
                            white_runs.append(txt)

            if hidden_runs:
                detections.append({
                    "type": "invisible_text",
                    "rule": "Hidden / Microscopic DOCX Run",
                    "snippet": " ".join(hidden_runs[:5]),
                    "explanation": "DOCX document contains explicitly hidden or microscopic text runs."
                })

            if white_runs:
                detections.append({
                    "type": "invisible_text",
                    "rule": "White Text in DOCX Run",
                    "snippet": " ".join(white_runs[:5]),
                    "explanation": "DOCX document contains text rendered in RGB(255, 255, 255) white font."
                })
        except Exception as e:
            logger.debug("DOCX hidden text inspection error: %s", e)

    return detections


def sanitize_text(text: str, detections: List[Dict[str, Any]]) -> str:
    """
    Remove detected adversarial prompt injection spans and zero-width characters
    so subsequent downstream tasks or LLM calls receive sanitized input.
    """
    if not text:
        return ""

    sanitized = text

    # Remove zero-width characters
    sanitized = ZERO_WIDTH_PATTERN.sub("", sanitized)

    # Remove matched prompt injection snippets
    for d in detections:
        matched = d.get("matched_text")
        if matched and len(matched) > 4:
            try:
                sanitized = re.sub(re.escape(matched), "[QUARANTINED_INJECTION]", sanitized, flags=re.IGNORECASE)
            except Exception:
                pass

    return sanitized


def analyze_resume_for_adversarial(
    raw_text: Optional[str],
    file_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Full Adversarial Shield pipeline.
    Scans both text and binary document formatting.
    Returns comprehensive security analysis dictionary.
    """
    text = raw_text or ""
    detections: List[Dict[str, Any]] = []

    # 1. Text-based scan
    text_detections = scan_text_for_injections(text)
    detections.extend(text_detections)

    # 2. File formatting scan (PDF/DOCX)
    if file_path:
        file_detections = scan_file_for_hidden_text(file_path)
        detections.extend(file_detections)

    is_flagged = len(detections) > 0
    threat_level = "CLEAN"
    if is_flagged:
        has_injection = any(d["type"] == "prompt_injection" for d in detections)
        has_invisible = any(d["type"] == "invisible_text" for d in detections)
        if has_injection or has_invisible:
            threat_level = "HIGH"
        else:
            threat_level = "MEDIUM"

    sanitized = sanitize_text(text, detections) if is_flagged else text

    return {
        "is_flagged": is_flagged,
        "threat_level": threat_level,
        "threat_count": len(detections),
        "detections": detections,
        "action_taken": (
            "Flagged for manual review & gated from generative interview prompting."
            if is_flagged
            else "Clean — passed all adversarial integrity checks."
        ),
        "sanitized_text": sanitized,
    }
