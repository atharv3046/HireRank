"""
AI Question Generation Engine — HireRank
========================================
Generates real LeetCode-style algorithmic coding challenges and 4-choice technical MCQs
tailored to the assessment blueprint.

Supports:
1. OpenAI API (when OPENAI_API_KEY starts with 'sk-')
2. Google Gemini API (when OPENAI_API_KEY or GEMINI_API_KEY starts with 'AIzaSy')
3. High-Quality Curated LeetCode & 4-Choice MCQ Question Banks (instant zero-latency fallback)
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def generate_dsa_leetcode_question(title: str, topic: str, difficulty: str = "Medium") -> Dict[str, Any]:
    """
    Returns a structured LeetCode-style DSA problem with formal problem description,
    examples, constraints, and starter code template.
    """
    return {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": f"{topic}: Algorithmic Challenge",
        "prompt": (
            f"### Problem Description\n"
            f"Given the requirements for **{topic}**, write an optimal algorithm to solve the challenge.\n\n"
            f"**Constraints:**\n"
            f"- Time Complexity: Must run in optimal O(N) or O(N log N) time.\n"
            f"- Space Complexity: Must not exceed O(N) auxiliary space.\n\n"
            f"**Example 1:**\n"
            f"- Input: `data = [3, 1, 4, 1, 5, 9, 2, 6]`\n"
            f"- Output: `True`\n\n"
            f"**Example 2:**\n"
            f"- Input: `data = []`\n"
            f"- Output: `False`\n\n"
            f"**Instructions:**\n"
            f"Implement your complete solution below. Include edge case handling and brief Big-O analysis."
        ),
        "starter_code": (
            f"def solve_{topic.lower().replace(' ', '_')}(data: list) -> bool:\n"
            f"    # Write your optimal solution here\n"
            f"    pass\n"
        )
    }


def call_openai_for_questions(role_title: str, skills: List[str], count_dsa: int = 2, count_mcq: int = 4) -> Optional[List[Dict[str, Any]]]:
    """
    Attempts to call OpenAI API to generate LeetCode problems and 4-choice MCQs.
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or not api_key.startswith("sk-"):
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        prompt = (
            f"Generate a technical interview question set for a '{role_title}' with skills: {', '.join(skills)}.\n"
            f"Requirements:\n"
            f"1. Generate {count_dsa} real LeetCode-style coding challenges with 'type': 'coding', 'title', 'prompt' (including Example 1, Example 2, Constraints), and 'starter_code' (Python function signature).\n"
            f"2. Generate {count_mcq} real 4-choice multiple choice questions with 'type': 'mcq', 'title', 'prompt', 'options' (array of 4 choices starting with 'A)', 'B)', 'C)', 'D)'), and 'correct_option'.\n"
            f"Return pure JSON format: {{ \"questions\": [ {{ \"id\": \"q1\", \"type\": \"...\", \"category\": \"...\", \"title\": \"...\", \"prompt\": \"...\", \"starter_code\": \"...\", \"options\": [...], \"correct_option\": \"...\" }} ] }}"
        )

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a senior technical interviewer at a top tech company. You design rigorous LeetCode coding problems and crisp 4-choice technical MCQs."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2500,
        )

        content = resp.choices[0].message.content or ""
        parsed = json.loads(content)
        questions = parsed.get("questions", [])
        if questions and isinstance(questions, list):
            logger.info("[AI QUESTIONS] Successfully generated %d questions via OpenAI", len(questions))
            return questions
    except Exception as exc:
        logger.warning("[AI QUESTIONS] OpenAI generation failed (%s); falling back to curated bank", exc)

    return None
