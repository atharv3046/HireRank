from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from typing import List, Optional, Dict, Any

from datetime import datetime, timedelta, timezone

import hashlib

import secrets

from pydantic import BaseModel, ConfigDict

from sqlalchemy.exc import IntegrityError

import re

from app.core.database import get_db

from app.core.config import settings

from app.models.user import User

from app.models.job_posting import JobPosting

from app.models.candidate import Candidate

from app.models.match_score import MatchScore

from app.models.assessment import Assessment

from app.models.interview import InterviewInvitation, InterviewSlot

from app.services.email import send_assessment_invitation_email, send_interview_booking_email, send_recruiter_interview_notice

from app.routers.auth import get_current_user

from app.services.extraction import get_extractor



router = APIRouter(prefix="/assessments", tags=["assessments"])





# ── SCHEMAS ──────────────────────────────────────────────────────────────────



class ScreeningBatchOption(BaseModel):

    id: int

    title: str

    description: str

    required_skills: List[str]

    candidate_count: int



class ExtractBlueprintRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    job_description: str

    batch_id: Optional[int] = None



class QuestionCategory(BaseModel):

    category: str

    count: int

    percentage: int

    topics: List[str]



class BlueprintData(BaseModel):

    estimated_duration_minutes: int

    difficulty_level: str

    categories: List[QuestionCategory]



class PassRatePreview(BaseModel):

    total_evaluated: int

    passed_count: int

    pass_rate_pct: float

    summary: str



class ExtractedBlueprintResponse(BaseModel):

    detected_title: str

    min_experience_years: float

    education_requirement: str

    required_skills: List[str]

    blueprint: BlueprintData

    pass_preview: PassRatePreview



class SimulatePassRateRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    required_skills: List[str]

    min_experience_years: float = 0.0

    batch_id: Optional[int] = None



class CreateAssessmentRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    title: str

    job_description: str

    required_skills: List[str]

    min_experience_years: float = 0.0

    education_requirement: Optional[str] = None

    blueprint: Dict[str, Any]



class AssessmentRead(BaseModel):

    id: int

    recruiter_id: int

    title: str

    job_description: str

    required_skills: List[str]

    min_experience_years: float

    education_requirement: Optional[str]

    blueprint_json: Dict[str, Any]

    status: str

    created_at: str





class SendInterviewInvitationsRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    candidate_ids: List[int]

    message: Optional[str] = None

    expires_in_days: int = 7





class CreateInterviewSlotRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    starts_at: datetime

    duration_minutes: int = 30

    meeting_url: str





class InterviewAnswersRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    answers: Dict[str, str]





class SaveInterviewDraftRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    answers: Dict[str, str]





class BookInterviewSlotRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    slot_id: int





class ReviewInterviewRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    rating: int

    decision: str

    notes: str = ""





# ── HELPERS ──────────────────────────────────────────────────────────────────



def _detect_title_from_jd(jd: str) -> str:

    lines = [l.strip() for l in jd.splitlines() if l.strip()]

    if not lines:

        return "Assessment Role"

    first_line = lines[0]

    # Remove common prefixes

    cleaned = re.sub(r'^(job title|role|position|opening|we are looking for an?|we are hiring an?|we need an?|hiring:?)\s*', '', first_line, flags=re.IGNORECASE)

    if len(cleaned) <= 60 and not cleaned.endswith('.'):

        return cleaned

    # Search for role keywords

    match = re.search(r'(Senior|Lead|Staff|Principal|Junior|Mid-Level)?\s*([A-Z][A-Za-z0-9+#.\s]{2,25}(?:Developer|Engineer|Architect|Designer|Manager|Analyst|Consultant|Scientist|Specialist))', jd)

    if match:

        return match.group(0).strip()

    return "Technical Specialist"





def _compute_pass_preview(

    required_skills: List[str],

    min_experience: float,

    candidates: List[Candidate],

    match_scores: Dict[int, MatchScore]

) -> PassRatePreview:

    total = len(candidates)

    if total == 0:

        return PassRatePreview(

            total_evaluated=0,

            passed_count=0,

            pass_rate_pct=0.0,

            summary="No candidates available in workspace for preview."

        )



    req_lower = [s.lower() for s in required_skills]

    passed = 0



    for c in candidates:

        ms = match_scores.get(c.id)

        score = ms.overall_score if ms else 0

        exp = c.experience_years or 0

        skills = [s.lower() for s in (c.extracted_skills or [])]



        # Check skill overlap

        overlap = sum(1 for s in req_lower if any(s in cs or cs in s for cs in skills))

        skill_pct = (overlap / len(req_lower)) if req_lower else 1.0



        # Candidate passes if score >= 60% OR skill overlap >= 50% and exp >= min_exp

        if (score and score >= 60.0) or (skill_pct >= 0.5 and exp >= max(0, min_experience - 1)):

            passed += 1



    rate = round((passed / total) * 100, 1)

    summary = f"{passed} of {total} candidates match this blueprint ({rate}% pass rate)"



    return PassRatePreview(

        total_evaluated=total,

        passed_count=passed,

        pass_rate_pct=rate,

        summary=summary

    )





# ── ENDPOINTS ────────────────────────────────────────────────────────────────



@router.get("/batches", response_model=List[ScreeningBatchOption])

def list_importable_batches(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    List recruiter's candidate screening batches to import into Assessment wizard.

    """

    jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()

    results = []

    for j in jobs:

        count = db.query(Candidate).filter(Candidate.job_posting_id == j.id).count()

        results.append(

            ScreeningBatchOption(

                id=j.id,

                title=j.title,

                description=j.description,

                required_skills=j.required_skills or [],

                candidate_count=count

            )

        )

    return results





@router.post("/extract-blueprint", response_model=ExtractedBlueprintResponse)

def extract_blueprint(

    req: ExtractBlueprintRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    Extracts skills, role title, experience, education, and compiles live question blueprint.

    """

    if not req.job_description or len(req.job_description.strip()) < 20:

        raise HTTPException(status_code=400, detail="Job description must be at least 20 characters")



    extractor = get_extractor()

    jd = req.job_description.strip()



    # Title detection

    title = _detect_title_from_jd(jd)



    # Skills extraction

    skills = extractor.extract_skills(jd)

    if not skills:

        # Fallback keyword extraction

        words = re.findall(r'\b[A-Za-z0-9#+.]{2,15}\b', jd)

        common_tech = ["Python", "FastAPI", "React", "TypeScript", "SQL", "Docker", "AWS", "Git"]

        skills = [t for t in common_tech if any(t.lower() == w.lower() for w in words)] or ["Python", "Problem Solving"]



    # Experience extraction

    exp = extractor.extract_experience_years(jd)

    if exp == 0.0:

        exp_match = re.search(r'(\d+)\+?\s*years?', jd, re.IGNORECASE)

        if exp_match:

            try: exp = float(exp_match.group(1))

            except ValueError: exp = 2.0

        else:

            exp = 2.0



    # Education extraction

    edu_info = extractor.extract_education(jd)

    edu_req = edu_info.get("level") or "bachelors"



    # Blueprint categories

    categories = [

        QuestionCategory(

            category="Technical & Coding Proficiency",

            count=4,

            percentage=40,

            topics=skills[:4] if len(skills) >= 4 else skills + ["Code Structure", "Clean Code"]

        ),

        QuestionCategory(

            category="System Architecture & Scalability",

            count=3,

            percentage=30,

            topics=["Scalable API Design", "Data Modeling", "Failure Handling"]

        ),

        QuestionCategory(

            category="Algorithms & Problem Solving",

            count=2,

            percentage=20,

            topics=["Time Complexity", "Edge Case Analysis"]

        ),

        QuestionCategory(

            category="Behavioral & Engineering Practices",

            count=1,

            percentage=10,

            topics=["Code Review Culture", "Stakeholder Communication"]

        )

    ]



    blueprint = BlueprintData(

        estimated_duration_minutes=45,

        difficulty_level="Mid-Senior",

        categories=categories

    )



    # Compute candidate pass preview

    user_jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()

    job_ids = [req.batch_id] if req.batch_id else [j.id for j in user_jobs]



    candidates = db.query(Candidate).filter(Candidate.job_posting_id.in_(job_ids)).all() if job_ids else []

    scores = db.query(MatchScore).filter(MatchScore.job_posting_id.in_(job_ids)).all() if job_ids else []

    score_map = {ms.candidate_id: ms for ms in scores}



    pass_preview = _compute_pass_preview(skills, exp, candidates, score_map)



    return ExtractedBlueprintResponse(

        detected_title=title,

        min_experience_years=exp,

        education_requirement=edu_req,

        required_skills=skills,

        blueprint=blueprint,

        pass_preview=pass_preview

    )





@router.post("/simulate-pass-rate", response_model=PassRatePreview)

def simulate_pass_rate(

    req: SimulatePassRateRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    Dynamically recalculate pass preview as recruiter edits skills or experience.

    """

    user_jobs = db.query(JobPosting).filter(JobPosting.recruiter_id == current_user.id).all()

    job_ids = [req.batch_id] if req.batch_id else [j.id for j in user_jobs]



    candidates = db.query(Candidate).filter(Candidate.job_posting_id.in_(job_ids)).all() if job_ids else []

    scores = db.query(MatchScore).filter(MatchScore.job_posting_id.in_(job_ids)).all() if job_ids else []

    score_map = {ms.candidate_id: ms for ms in scores}



    return _compute_pass_preview(req.required_skills, req.min_experience_years, candidates, score_map)





@router.post("", response_model=AssessmentRead)

@router.post("/", response_model=AssessmentRead, include_in_schema=False)

def create_assessment(

    req: CreateAssessmentRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    Save and launch an assessment pipeline.

    """

    assessment = Assessment(

        recruiter_id=current_user.id,

        title=req.title,

        job_description=req.job_description,

        min_experience_years=req.min_experience_years,

        education_requirement=req.education_requirement,

        status="active"

    )

    assessment.required_skills = req.required_skills

    assessment.blueprint_json = req.blueprint



    db.add(assessment)

    db.commit()

    db.refresh(assessment)



    return AssessmentRead(

        id=assessment.id,

        recruiter_id=assessment.recruiter_id,

        title=assessment.title,

        job_description=assessment.job_description,

        required_skills=assessment.required_skills,

        min_experience_years=assessment.min_experience_years,

        education_requirement=assessment.education_requirement,

        blueprint_json=assessment.blueprint_json,

        status=assessment.status,

        created_at=assessment.created_at.strftime("%d %b %Y") if assessment.created_at else ""

    )





@router.get("", response_model=List[AssessmentRead])

@router.get("/", response_model=List[AssessmentRead], include_in_schema=False)

def list_assessments(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    """

    List assessments created by recruiter.

    """

    items = db.query(Assessment).filter(Assessment.recruiter_id == current_user.id).order_by(Assessment.created_at.desc()).all()

    return [

        AssessmentRead(

            id=a.id,

            recruiter_id=a.recruiter_id,

            title=a.title,

            job_description=a.job_description,

            required_skills=a.required_skills,

            min_experience_years=a.min_experience_years,

            education_requirement=a.education_requirement,

            blueprint_json=a.blueprint_json,

            status=a.status,

            created_at=a.created_at.strftime("%d %b %Y") if a.created_at else ""

        )

        for a in items

    ]





# ── Candidate interview and scheduling flow ─────────────────────────────────



def _token_hash(token: str) -> str:

    return hashlib.sha256(token.encode("utf-8")).hexdigest()





def _as_utc(value: datetime) -> datetime:

    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)





def _iso_utc(value: datetime) -> str:

    return _as_utc(value).isoformat()





def _get_owned_assessment(db: Session, assessment_id: int, recruiter_id: int) -> Assessment:

    assessment = db.query(Assessment).filter(

        Assessment.id == assessment_id,

        Assessment.recruiter_id == recruiter_id,

    ).first()

    if not assessment:

        raise HTTPException(status_code=404, detail="Assessment not found")

    return assessment





DSA_QUESTION_BANK = [

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Two-Sum Target Array (Optimized Hash Map)",

        "prompt": (

            "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n"

            "• Each input has exactly one valid solution.\n"

            "• You may not use the same element twice.\n"

            "• Provide an optimal O(n) time complexity solution.\n\n"

            "**Example 1:**\n"

            "Input: `nums = [2, 7, 11, 15]`, `target = 9`\n"

            "Output: `[0, 1]` (Since nums[0] + nums[1] == 9)\n\n"

            "**Example 2:**\n"

            "Input: `nums = [3, 2, 4]`, `target = 6`\n"

            "Output: `[1, 2]`\n\n"

            "**Instructions:** Write your complete solution below and analyze Time & Space complexity."

        ),

        "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    # Optimal O(n) solution using hash map\n    seen = {}\n    for i, num in enumerate(nums):\n        diff = target - num\n        if diff in seen:\n            return [seen[diff], i]\n        seen[num] = i\n    return []\n",

    },

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Longest Substring Without Repeating Characters (Sliding Window)",

        "prompt": (

            "Given a string `s`, find the length of the longest substring without duplicate characters.\n\n"

            "**Example 1:**\n"

            "Input: `s = \"abcabcbb\"`\n"

            "Output: `3` (The answer is `\"abc\"`, length = 3)\n\n"

            "**Example 2:**\n"

            "Input: `s = \"bbbbb\"`\n"

            "Output: `1` (The answer is `\"b\"`, length = 1)\n\n"

            "**Example 3:**\n"

            "Input: `s = \"pwwkew\"`\n"

            "Output: `3` (The answer is `\"wke\"`, length = 3)\n\n"

            "**Constraints:** 0 <= len(s) <= 50,000\n\n"

            "**Instructions:** Implement using sliding window (O(n) time) and explain pointer updates."

        ),

        "starter_code": "def length_of_longest_substring(s: str) -> int:\n    # Implement sliding window algorithm\n    pass\n",

    },

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Merge Overlapping Intervals",

        "prompt": (

            "Given an array of `intervals` where `intervals[i] = [start, end]`, merge all overlapping intervals, and return an array of non-overlapping intervals.\n\n"

            "**Example 1:**\n"

            "Input: `intervals = [[1,3],[2,6],[8,10],[15,18]]`\n"

            "Output: `[[1,6],[8,10],[15,18]]`\n"

            "(Since [1,3] and [2,6] overlap, merge them into [1,6])\n\n"

            "**Example 2:**\n"

            "Input: `intervals = [[1,4],[4,5]]`\n"

            "Output: `[[1,5]]`\n\n"

            "**Instructions:** Sort intervals by start time and iteratively merge in O(n log n) time."

        ),

        "starter_code": "def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    # Sort intervals and merge in single pass\n    pass\n",

    },

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Valid Parentheses & Bracket Matching",

        "prompt": (

            "Given a string `s` containing only the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\n"

            "An input string is valid if:\n"

            "1. Open brackets must be closed by the same type of brackets.\n"

            "2. Open brackets must be closed in the correct order.\n"

            "3. Every close bracket has a corresponding open bracket of the same type.\n\n"

            "**Example 1:** `\"()[]{}\"` -> `True`\n"

            "**Example 2:** `\"(]\"` -> `False`\n"

            "**Example 3:** `\"([])\"` -> `True`\n\n"

            "**Instructions:** Write the stack-based O(n) solution and state the auxiliary space complexity."

        ),

        "starter_code": "def is_valid_parentheses(s: str) -> bool:\n    # Use stack data structure\n    pass\n",

    },

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Least Recently Used (LRU) Cache Eviction Policy",

        "prompt": (

            "Design an LRU Cache data structure that supports `get(key)` and `put(key, value)` operations, both executing in average O(1) time complexity.\n\n"

            "• `get(key)`: Returns value if key exists, otherwise -1.\n"

            "• `put(key, value)`: Insert or update key. If cache capacity is exceeded, evict the least recently accessed key.\n\n"

            "**Instructions:** Detail why a Hash Map combined with a Doubly Linked List achieves O(1) operations, and provide the class implementation."

        ),

        "starter_code": "class LRUCache:\n    def __init__(self, capacity: int):\n        self.capacity = capacity\n\n    def get(self, key: int) -> int:\n        pass\n\n    def put(self, key: int, value: int) -> None:\n        pass\n",

    },

    {

        "type": "coding",

        "category": "DSA (Algorithms)",

        "title": "Binary Tree Level Order Traversal (BFS)",

        "prompt": (

            "Given the `root` of a binary tree, return the level order traversal of its nodes' values (i.e. from left to right, level by level).\n\n"

            "**Example 1:**\n"

            "Input: `root = [3, 9, 20, null, null, 15, 7]`\n"

            "Output: `[[3], [9, 20], [15, 7]]`\n\n"

            "**Instructions:** Implement BFS using a FIFO queue (`collections.deque`), handling level boundaries."

        ),

        "starter_code": "from collections import deque\n\ndef level_order(root) -> list[list[int]]:\n    # Implement BFS level-order traversal using deque\n    pass\n",

    },

]



MCQ_QUESTION_BANK = [

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "What is the average and worst-case time complexity of lookup in a balanced Binary Search Tree (such as Red-Black Tree or AVL tree)?",

        "options": [

            "A) Average: O(log N) · Worst: O(log N)",

            "B) Average: O(log N) · Worst: O(N)",

            "C) Average: O(1) · Worst: O(N)",

            "D) Average: O(N) · Worst: O(N log N)",

        ],

        "correct_option": "A) Average: O(log N) · Worst: O(log N)",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "In Python, which of the following operations has an average time complexity of O(1)?",

        "options": [

            "A) Checking key existence in a dictionary (`key in dict`)",

            "B) Inserting an element at index 0 of a large list (`list.insert(0, val)`)",

            "C) Sorting an arbitrary list with `list.sort()`",

            "D) Searching for an item by value in an unsorted list (`val in list`)",

        ],

        "correct_option": "A) Checking key existence in a dictionary (`key in dict`)",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "Which HTTP status code should be returned by a REST API when a client request fails authentication credentials?",

        "options": [

            "A) 400 Bad Request",

            "B) 401 Unauthorized",

            "C) 403 Forbidden",

            "D) 405 Method Not Allowed",

        ],

        "correct_option": "B) 401 Unauthorized",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "What does the 'I' in database ACID properties stand for, and what does it guarantee?",

        "options": [

            "A) Idempotency — repeated requests produce the exact same outcome",

            "B) Indexing — all queries run in logarithmic time",

            "C) Isolation — concurrent transactions execute without interfering with one another",

            "D) Integrity — foreign key relationships cannot be orphaned",

        ],

        "correct_option": "C) Isolation — concurrent transactions execute without interfering with one another",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "Which of the following database index structures is best suited for range queries such as `WHERE created_at BETWEEN '2026-01-01' AND '2026-02-01'`?",

        "options": [

            "A) Hash Index",

            "B) B-Tree / B+ Tree Index",

            "C) Bloom Filter",

            "D) Spatial R-Tree only",

        ],

        "correct_option": "B) B-Tree / B+ Tree Index",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "According to the HTTP/1.1 specification (RFC 7231), which of the following HTTP methods is NOT idempotent?",

        "options": [

            "A) GET",

            "B) PUT",

            "C) DELETE",

            "D) POST",

        ],

        "correct_option": "D) POST",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "What is the primary difference between a process and an operating system thread?",

        "options": [

            "A) Threads have completely isolated virtual memory spaces; processes share heap",

            "B) Threads in the same process share memory and address space; processes have independent memory spaces",

            "C) Processes can execute concurrently; threads must always execute sequentially",

            "D) A process context switch is significantly faster than a thread context switch",

        ],

        "correct_option": "B) Threads in the same process share memory and address space; processes have independent memory spaces",

    },

    {

        "type": "mcq",

        "category": "MCQ (Quiz)",

        "prompt": "In modern web and backend development, what is the primary benefit of connection pooling for relational databases?",

        "options": [

            "A) It eliminates the need for database migrations entirely",

            "B) It reuses existing TCP/TLS connections, avoiding the expensive overhead of creating new handshakes per request",

            "C) It encrypts all queries automatically without CPU penalty",

            "D) It converts SQL queries into GraphQL at runtime",

        ],

        "correct_option": "B) It reuses existing TCP/TLS connections, avoiding the expensive overhead of creating new handshakes per request",

    },

]



SYSTEM_DESIGN_BANK = [

    {

        "type": "system_design",

        "category": "System Design",

        "title": "Design a High-Throughput URL Shortener (bit.ly)",

        "prompt": (

            "**System Design: Scalable URL Shortener Service (bit.ly)**\n\n"

            "• **Scale:** 100 Million new URLs generated per month, 10 Billion redirects per month (100:1 read-to-write ratio).\n"

            "• **Requirements:** Generate unique 7-character URLs, HTTP 301/302 redirection, high availability, sub-10ms redirect latency.\n\n"

            "**Please structure your design to cover:**\n"

            "1. **High-Level Architecture:** Load balancers, API gateways, app servers, cache, and database.\n"

            "2. **Unique Hash Strategy:** Base62 encoding, pre-generated sequence tokens (Zookeeper/counter service) vs hashing with collision handling.\n"

            "3. **Data Model & Storage:** Relational vs Key-Value storage (e.g. PostgreSQL vs Redis/DynamoDB).\n"

            "4. **Caching & Eviction:** Redis cluster, LRU eviction for hot links."

        ),

    },

    {

        "type": "system_design",

        "category": "System Design",

        "title": "Design a Distributed Rate Limiter",

        "prompt": (

            "**System Design: Multi-Region Distributed Rate Limiter**\n\n"

            "• **Scenario:** Protect backend microservices serving 50,000 requests/second from client abuse and traffic spikes.\n"

            "• **Requirements:** Enforce limits per client API key (e.g. 100 requests/minute). Minimal latency overhead (< 3ms).\n\n"

            "**Address in your answer:**\n"

            "1. **Algorithm Comparison:** Token Bucket vs Leaky Bucket vs Sliding Window Log vs Sliding Window Counter.\n"

            "2. **Concurrency & Race Conditions:** Handling distributed counter updates in Redis (Lua scripts, Redis cell, or atomic increments).\n"

            "3. **Failure Handling:** Fallback strategy if the central cache experiences temporary outage (fail-open vs fail-closed)."

        ),

    },

]



CODE_QUALITY_BANK = [

    {

        "type": "code_quality",

        "category": "Code Quality",

        "title": "Code Review & Refactoring: N+1 Query & SQL Injection",

        "prompt": (

            "**Code Review & Security Analysis**\n\n"

            "Review the following function:\n\n"

            "```python\n"

            "def fetch_user_profiles(user_ids, db_connection):\n"

            "    profiles = []\n"

            "    for user_id in user_ids:\n"

            "        cursor = db_connection.cursor()\n"

            "        # Construct query dynamically\n"

            "        query = \"SELECT id, name, email, tier FROM users WHERE id = \" + str(user_id)\n"

            "        cursor.execute(query)\n"

            "        row = cursor.fetchone()\n"

            "        if row:\n"

            "            profiles.append({\"id\": row[0], \"name\": row[1], \"email\": row[2], \"tier\": row[3]})\n"

            "    return profiles\n"

            "```\n\n"

            "**Tasks:**\n"

            "1. Identify the two major flaws in this code (security and performance).\n"

            "2. Rewrite the function with parameterized SQL queries and batch execution (`WHERE id IN (...)`) to eliminate the N+1 problem.\n"

            "3. Include proper cursor context management (`with` statement) and error handling."

        ),

    },

]



BEHAVIORAL_BANK = [

    {

        "type": "behavioral",

        "category": "Behavioral",

        "title": "Production Incident & Root Cause Analysis",

        "prompt": (

            "**Incident Response & Technical Leadership**\n\n"

            "Describe a major production outage, latency spike, or critical bug you investigated.\n\n"

            "1. How did you identify, isolate, and triage the problem under time pressure?\n"

            "2. What immediate remediation did you deploy to stabilize the system?\n"

            "3. What post-mortem actions, automated tests, or architectural improvements did you introduce to prevent recurrence?"

        ),

    },

    {

        "type": "behavioral",

        "category": "Communication",

        "title": "Technical Disagreement & Architecture Alignment",

        "prompt": (

            "**Architecture Trade-offs & Communication**\n\n"

            "Tell us about a time you had a strong technical disagreement with a team member or stakeholder regarding system architecture, framework choice, or database design.\n\n"

            "1. What were the competing approaches and their respective trade-offs?\n"

            "2. How did you structure your arguments with data or prototypes rather than opinion?\n"

            "3. How was the final consensus reached, and what was the impact on project delivery?"

        ),

    },

]





def _candidate_questions(assessment: Assessment) -> List[Dict[str, Any]]:

    """

    Generate calibrated, real questions from the saved blueprint.

    Detects question category types:

      - DSA (Algorithms) -> real coding challenges with test constraints & starter code

      - MCQ (Quiz) -> real 4-choice multiple choice questions

      - System Design -> architecture scale scenarios

      - Code Quality -> refactoring & security review

      - Behavioral / Communication -> scenario & incident response

    """

    blueprint = assessment.blueprint_json or {}

    categories = blueprint.get("categories", []) if isinstance(blueprint, dict) else []

    questions: List[Dict[str, Any]] = []



    # Category counters for round-robin rotation from banks

    counters = {"dsa": 0, "mcq": 0, "system_design": 0, "code_quality": 0, "behavioral": 0}



    for category in categories:

        if not isinstance(category, dict):

            continue

        category_name = str(category.get("category") or "Role skills")

        cat_lower = category_name.lower()

        count = max(1, min(int(category.get("count") or 1), 8))



        # 1. DSA / Algorithms

        if any(term in cat_lower for term in ["dsa", "algorithm", "coding", "data structure", "problem solving"]):

            for _ in range(count):

                item = DSA_QUESTION_BANK[counters["dsa"] % len(DSA_QUESTION_BANK)]

                counters["dsa"] += 1

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "coding",

                    "category": category_name,

                    "title": item.get("title", "DSA Coding Problem"),

                    "prompt": item["prompt"],

                    "starter_code": item.get("starter_code", ""),

                })



        # 2. MCQ (Quiz)

        elif any(term in cat_lower for term in ["mcq", "quiz", "trivia", "multiple choice"]):

            for _ in range(count):

                item = MCQ_QUESTION_BANK[counters["mcq"] % len(MCQ_QUESTION_BANK)]

                counters["mcq"] += 1

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "mcq",

                    "category": category_name,

                    "title": "Technical Multiple Choice",

                    "prompt": item["prompt"],

                    "options": item["options"],

                    "correct_option": item.get("correct_option"),

                })



        # 3. System Design

        elif any(term in cat_lower for term in ["system", "design", "architect", "scale"]):

            for _ in range(count):

                item = SYSTEM_DESIGN_BANK[counters["system_design"] % len(SYSTEM_DESIGN_BANK)]

                counters["system_design"] += 1

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "system_design",

                    "category": category_name,

                    "title": item.get("title", "System Design Problem"),

                    "prompt": item["prompt"],

                })



        # 4. Code Quality / Refactoring

        elif any(term in cat_lower for term in ["quality", "refactor", "clean code", "review"]):

            for _ in range(count):

                item = CODE_QUALITY_BANK[counters["code_quality"] % len(CODE_QUALITY_BANK)]

                counters["code_quality"] += 1

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "code_quality",

                    "category": category_name,

                    "title": item.get("title", "Code Quality & Refactoring"),

                    "prompt": item["prompt"],

                })



        # 5. Behavioral / Communication

        elif any(term in cat_lower for term in ["behavior", "culture", "experience", "communication"]):

            for _ in range(count):

                item = BEHAVIORAL_BANK[counters["behavioral"] % len(BEHAVIORAL_BANK)]

                counters["behavioral"] += 1

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "behavioral",

                    "category": category_name,

                    "title": item.get("title", "Engineering Experience"),

                    "prompt": item["prompt"],

                })



        # 6. Fallback for custom skill topics

        else:

            topics = category.get("topics") or assessment.required_skills or [assessment.title]

            if isinstance(topics, str):

                topics = [topics]

            for idx in range(count):

                topic = str(topics[idx % len(topics)]) if topics else assessment.title

                q_id = f"q{len(questions) + 1}"

                questions.append({

                    "id": q_id,

                    "type": "open_ended",

                    "category": category_name,

                    "title": f"Technical Competency: {topic}",

                    "prompt": f"Explain an end-to-end technical problem you solved using {topic}. What was your design approach, how did you handle edge cases, and what was the measured outcome?",

                })



        if len(questions) >= 20:

            break



    # If blueprint had no categories, generate a balanced technical assessment

    if not questions:

        # Default: 2 DSA coding problems, 2 MCQs, 1 System Design

        for i in range(2):

            q_id = f"q{len(questions) + 1}"

            item = DSA_QUESTION_BANK[i % len(DSA_QUESTION_BANK)]

            questions.append({

                "id": q_id,

                "type": "coding",

                "category": "DSA (Algorithms)",

                "title": item.get("title", "DSA Problem"),

                "prompt": item["prompt"],

                "starter_code": item.get("starter_code", ""),

            })

        for i in range(2):

            q_id = f"q{len(questions) + 1}"

            item = MCQ_QUESTION_BANK[i % len(MCQ_QUESTION_BANK)]

            questions.append({

                "id": q_id,

                "type": "mcq",

                "category": "MCQ (Quiz)",

                "title": "Technical MCQ",

                "prompt": item["prompt"],

                "options": item["options"],

                "correct_option": item.get("correct_option"),

            })

        item_sd = SYSTEM_DESIGN_BANK[0]

        questions.append({

            "id": f"q{len(questions) + 1}",

            "type": "system_design",

            "category": "System Design",

            "title": item_sd.get("title", "System Architecture"),

            "prompt": item_sd["prompt"],

        })



    return questions





def _require_valid_invitation(db: Session, token: str) -> InterviewInvitation:

    invitation = db.query(InterviewInvitation).filter(

        InterviewInvitation.token_hash == _token_hash(token)

    ).first()

    if not invitation:

        raise HTTPException(status_code=404, detail="Interview link is invalid")

    expires_at = invitation.expires_at

    if expires_at.tzinfo is None:

        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc):

        raise HTTPException(status_code=410, detail="This interview link has expired. Contact the recruiter for a new invitation.")

    return invitation





@router.post("/{assessment_id}/invitations")

def send_interview_invitations(

    assessment_id: int,

    req: SendInterviewInvitationsRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Create per-candidate bearer links and email the assessment invitation."""

    assessment = _get_owned_assessment(db, assessment_id, current_user.id)

    if not req.candidate_ids:

        raise HTTPException(status_code=422, detail="Select at least one candidate")

    if len(req.candidate_ids) > 100:

        raise HTTPException(status_code=422, detail="A maximum of 100 candidates can be invited at once")

    if not 1 <= req.expires_in_days <= 30:

        raise HTTPException(status_code=422, detail="Invitation expiry must be between 1 and 30 days")



    owned_job_ids = [row[0] for row in db.query(JobPosting.id).filter(JobPosting.recruiter_id == current_user.id).all()]

    candidates = db.query(Candidate).filter(

        Candidate.id.in_(set(req.candidate_ids)), Candidate.job_posting_id.in_(owned_job_ids)

    ).all()

    found = {candidate.id for candidate in candidates}

    if found != set(req.candidate_ids):

        raise HTTPException(status_code=404, detail="One or more candidates were not found in your workspace")



    base_url = settings.APP_BASE_URL.rstrip("/")

    results = []

    sent_count = 0

    for candidate in candidates:

        if not candidate.email or "@" not in candidate.email:

            results.append({"candidate_id": candidate.id, "email": candidate.email, "sent": False, "error": "Candidate has no valid email address"})

            continue

        token = secrets.token_urlsafe(32)

        invitation = InterviewInvitation(

            assessment_id=assessment.id,

            candidate_id=candidate.id,

            candidate_name=candidate.name,

            candidate_email=candidate.email,

            token_hash=_token_hash(token),

            status="invited",

            expires_at=datetime.now(timezone.utc) + timedelta(days=req.expires_in_days),

        )

        db.add(invitation)

        db.flush()

        invite_url = f"{base_url}/interview/{token}"

        sent, error = send_assessment_invitation_email(

            to_email=candidate.email,

            candidate_name=candidate.name,

            assessment_title=assessment.title,

            company_name=current_user.company_name or "HireRank",

            recruiter_email=current_user.email,

            invite_url=invite_url,

            message=req.message,

            expires_in_days=req.expires_in_days,

            duration_minutes=(assessment.blueprint_json or {}).get("estimated_duration_minutes", 30),

        )

        if sent:

            sent_count += 1

            candidate.pipeline_status = "Invited"

        else:

            invitation.status = "delivery_failed"

        results.append({"candidate_id": candidate.id, "email": candidate.email, "sent": sent, "error": error, "manual_link": None if sent else invite_url})



    db.commit()

    return {"assessment_id": assessment.id, "invited_count": len(results), "emails_sent": sent_count, "results": results}





@router.get("/invitations")

def list_interview_invitations(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    """Recruiter view of candidate assessment submissions and booked recruiter meeting slots."""

    items = db.query(InterviewInvitation).join(

        Assessment, Assessment.id == InterviewInvitation.assessment_id

    ).filter(

        Assessment.recruiter_id == current_user.id,

        (InterviewInvitation.recruiter_decision != "decline") | (InterviewInvitation.recruiter_decision.is_(None))

    ).order_by(InterviewInvitation.created_at.desc()).all()

    response = []

    for invitation in items:

        assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()

        slot = db.query(InterviewSlot).filter(InterviewSlot.id == invitation.booked_slot_id).first() if invitation.booked_slot_id else None

        response.append({

            "id": invitation.id,

            "assessment_id": invitation.assessment_id,

            "assessment_title": assessment.title if assessment else "Assessment",

            "candidate_id": invitation.candidate_id,

            "candidate_name": invitation.candidate_name,

            "candidate_email": invitation.candidate_email,

            "status": invitation.status,

            "answers": invitation.answers,

            "questions": _candidate_questions(assessment) if assessment else [],

            "expires_at": _iso_utc(invitation.expires_at),

            "created_at": invitation.created_at.isoformat() if invitation.created_at else None,

            "submitted_at": invitation.submitted_at.isoformat() if invitation.submitted_at else None,

            "rating": invitation.recruiter_rating,

            "decision": invitation.recruiter_decision,

            "notes": invitation.recruiter_notes,

            "interview": ({"starts_at": _iso_utc(slot.starts_at), "duration_minutes": slot.duration_minutes, "meeting_url": slot.meeting_url} if slot else None),

        })

    return response





@router.patch("/invitations/{invitation_id}/review")

def save_interview_review(

    invitation_id: int,

    req: ReviewInterviewRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    if req.rating < 1 or req.rating > 5:

        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")

    if req.decision not in {"advance", "hold", "decline"}:

        raise HTTPException(status_code=422, detail="Decision must be advance, hold, or decline")

    invitation = db.query(InterviewInvitation).join(

        Assessment, Assessment.id == InterviewInvitation.assessment_id

    ).filter(InterviewInvitation.id == invitation_id, Assessment.recruiter_id == current_user.id).first()

    if not invitation:

        raise HTTPException(status_code=404, detail="Interview invitation not found")

    if invitation.status not in {"completed", "booked"} and req.decision != "decline":

        raise HTTPException(status_code=409, detail="Candidate must submit responses before review")

    invitation.recruiter_rating = req.rating

    invitation.recruiter_decision = req.decision

    invitation.recruiter_notes = req.notes.strip()[:10000]

    if invitation.candidate_id and req.decision in {"advance", "decline"}:

        candidate = db.query(Candidate).filter(Candidate.id == invitation.candidate_id).first()

        if candidate:

            candidate.pipeline_status = "Hire" if req.decision == "advance" else "No Hire"



    # If recruiter declines the candidate, remove the interview invitation so it doesn't linger in active interviews

    if req.decision == "decline":

        candidate_name = invitation.candidate_name or invitation.candidate_email

        db.delete(invitation)

        db.commit()

        return {

            "success": True,

            "removed": True,

            "decision": "decline",

            "message": f"Candidate {candidate_name} declined and removed from interviews",

        }



    db.commit()

    return {"success": True, "removed": False, "rating": invitation.recruiter_rating, "decision": invitation.recruiter_decision}





class ResendInvitationPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: Optional[str] = None


@router.post("/invitations/{invitation_id}/resend")
def resend_interview_invitation(
    invitation_id: int,
    payload: Optional[ResendInvitationPayload] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invitation = db.query(InterviewInvitation).join(
        Assessment, Assessment.id == InterviewInvitation.assessment_id
    ).filter(InterviewInvitation.id == invitation_id, Assessment.recruiter_id == current_user.id).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Interview invitation not found")

    if payload and payload.email and payload.email.strip():
        new_email = payload.email.strip()
        invitation.candidate_email = new_email
        if invitation.candidate_id:
            cand = db.query(Candidate).filter(Candidate.id == invitation.candidate_id).first()
            if cand:
                cand.email = new_email

    assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()
    token = secrets.token_urlsafe(32)
    invitation.token_hash = _token_hash(token)
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite_url = f"{settings.APP_BASE_URL.rstrip('/')}/interview/{token}"
    sent, error = send_assessment_invitation_email(
        to_email=invitation.candidate_email,
        candidate_name=invitation.candidate_name,
        assessment_title=assessment.title if assessment else "Interview Assessment",
        company_name=current_user.company_name or "HireRank",
        recruiter_email=current_user.email,
        invite_url=invite_url,
        expires_in_days=7,
        duration_minutes=(assessment.blueprint_json or {}).get("estimated_duration_minutes", 30) if assessment else 30,
    )
    invitation.status = "invited" if sent else "delivery_failed"
    db.commit()
    return {
        "sent": sent,
        "error": error,
        "invite_url": invite_url,
        "status": invitation.status,
        "candidate_email": invitation.candidate_email,
    }





@router.delete("/invitations/{invitation_id}")

def delete_interview_invitation(

    invitation_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    invitation = db.query(InterviewInvitation).join(

        Assessment, Assessment.id == InterviewInvitation.assessment_id

    ).filter(InterviewInvitation.id == invitation_id, Assessment.recruiter_id == current_user.id).first()

    if not invitation:

        raise HTTPException(status_code=404, detail="Interview invitation not found")

    db.delete(invitation)

    db.commit()

    return {"message": "Interview invitation deleted", "id": invitation_id}





@router.post("/{assessment_id}/slots")

def create_interview_slot(

    assessment_id: int,

    req: CreateInterviewSlotRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    _get_owned_assessment(db, assessment_id, current_user.id)

    starts_at = req.starts_at

    if starts_at.tzinfo is None:

        raise HTTPException(status_code=422, detail="Interview time must include a timezone")

    if starts_at <= datetime.now(timezone.utc):

        raise HTTPException(status_code=422, detail="Interview slot must be in the future")

    if not 15 <= req.duration_minutes <= 180:

        raise HTTPException(status_code=422, detail="Interview duration must be between 15 and 180 minutes")

    if not req.meeting_url.startswith("https://"):

        raise HTTPException(status_code=422, detail="Meeting URL must start with https://")

    slot = InterviewSlot(assessment_id=assessment_id, starts_at=starts_at.astimezone(timezone.utc), duration_minutes=req.duration_minutes, meeting_url=req.meeting_url.strip())

    db.add(slot)

    try:

        db.commit()

    except Exception:

        db.rollback()

        raise HTTPException(status_code=409, detail="A slot already exists at this time")

    db.refresh(slot)

    return {"id": slot.id, "assessment_id": slot.assessment_id, "starts_at": _iso_utc(slot.starts_at), "duration_minutes": slot.duration_minutes, "meeting_url": slot.meeting_url, "booked": False}





@router.get("/{assessment_id}/slots")

def list_interview_slots(

    assessment_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user),

):

    _get_owned_assessment(db, assessment_id, current_user.id)

    booked = {row[0] for row in db.query(InterviewInvitation.booked_slot_id).filter(InterviewInvitation.booked_slot_id.isnot(None)).all()}

    slots = db.query(InterviewSlot).filter(InterviewSlot.assessment_id == assessment_id).order_by(InterviewSlot.starts_at).all()

    return [{"id": slot.id, "starts_at": _iso_utc(slot.starts_at), "duration_minutes": slot.duration_minutes, "meeting_url": slot.meeting_url, "booked": slot.id in booked} for slot in slots]





@router.get("/invitation/{token}")

def get_candidate_interview(token: str, db: Session = Depends(get_db)):

    invitation = _require_valid_invitation(db, token)

    assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()

    if not assessment:

        raise HTTPException(status_code=404, detail="Assessment is no longer available")

    available_slots = []

    if invitation.status == "completed":

        booked_ids = {row[0] for row in db.query(InterviewInvitation.booked_slot_id).filter(InterviewInvitation.booked_slot_id.isnot(None)).all()}

        slots = db.query(InterviewSlot).filter(InterviewSlot.assessment_id == assessment.id, InterviewSlot.starts_at > datetime.now(timezone.utc)).order_by(InterviewSlot.starts_at).all()

        available_slots = [{"id": slot.id, "starts_at": _iso_utc(slot.starts_at), "duration_minutes": slot.duration_minutes} for slot in slots if slot.id not in booked_ids]

    booked_slot = db.query(InterviewSlot).filter(InterviewSlot.id == invitation.booked_slot_id).first() if invitation.booked_slot_id else None

    if invitation.status in {"invited", "delivery_failed"}:

        invitation.status = "started"

        invitation.started_at = datetime.now(timezone.utc)

        db.commit()

    owner = db.query(User).filter(User.id == assessment.recruiter_id).first()

    return {

        "assessment_title": assessment.title,

        "company_name": (owner.company_name if owner and owner.company_name else "Hiring Team"),

        "candidate_name": invitation.candidate_name,

        "duration_minutes": (assessment.blueprint_json or {}).get("estimated_duration_minutes", 30),

        "questions": _candidate_questions(assessment),

        "status": invitation.status,

        "answers": invitation.answers,

        "available_slots": available_slots,

        "booked_interview": ({"starts_at": _iso_utc(booked_slot.starts_at), "duration_minutes": booked_slot.duration_minutes, "meeting_url": booked_slot.meeting_url} if booked_slot else None),

    }





@router.post("/invitation/{token}/submit")

def submit_candidate_interview(token: str, req: InterviewAnswersRequest, db: Session = Depends(get_db)):

    invitation = _require_valid_invitation(db, token)

    if invitation.status in ("completed", "booked"):

        raise HTTPException(status_code=409, detail="This interview has already been submitted")

    assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()

    questions = _candidate_questions(assessment)

    expected_ids = {question["id"] for question in questions}

    if set(req.answers) != expected_ids:

        raise HTTPException(status_code=422, detail="Answer every question before submitting")

    cleaned = {}

    for question_id, answer in req.answers.items():

        answer = answer.strip()

        if len(answer) < 1:

            raise HTTPException(status_code=422, detail="Please provide an answer for every question")

        if len(answer) > 10000:

            raise HTTPException(status_code=422, detail="Each answer must be 10,000 characters or fewer")

        cleaned[question_id] = answer

    invitation.answers = cleaned

    invitation.status = "completed"

    invitation.submitted_at = datetime.now(timezone.utc)

    db.commit()

    return {"status": "completed", "message": "Your interview responses have been submitted."}





@router.post("/invitation/{token}/save-draft")

def save_candidate_interview_draft(token: str, req: SaveInterviewDraftRequest, db: Session = Depends(get_db)):

    invitation = _require_valid_invitation(db, token)

    if invitation.status in ("completed", "booked"):

        raise HTTPException(status_code=409, detail="This interview has already been submitted")

    assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()

    valid_ids = {question["id"] for question in _candidate_questions(assessment)}

    if not set(req.answers).issubset(valid_ids):

        raise HTTPException(status_code=422, detail="Draft contains an unknown question")

    draft = {}

    for question_id, answer in req.answers.items():

        if len(answer) > 10000:

            raise HTTPException(status_code=422, detail="Each answer must be 10,000 characters or fewer")

        draft[question_id] = answer

    invitation.answers = draft

    db.commit()

    return {"saved": True}





@router.post("/invitation/{token}/book")

def book_candidate_interview(token: str, req: BookInterviewSlotRequest, db: Session = Depends(get_db)):

    invitation = _require_valid_invitation(db, token)

    if invitation.status not in ("completed", "booked"):

        raise HTTPException(status_code=409, detail="Submit your written assessment responses before booking an interview meeting time")

    if invitation.booked_slot_id:

        raise HTTPException(status_code=409, detail="An interview meeting slot is already booked for this invitation")

    slot = db.query(InterviewSlot).filter(InterviewSlot.id == req.slot_id, InterviewSlot.assessment_id == invitation.assessment_id).first()

    if not slot or _as_utc(slot.starts_at) <= datetime.now(timezone.utc):

        raise HTTPException(status_code=404, detail="Interview slot is unavailable")

    if db.query(InterviewInvitation).filter(InterviewInvitation.booked_slot_id == slot.id).first():

        raise HTTPException(status_code=409, detail="That interview slot has just been booked. Choose another time.")

    invitation.booked_slot_id = slot.id

    invitation.status = "booked"

    assessment = db.query(Assessment).filter(Assessment.id == invitation.assessment_id).first()

    recruiter = db.query(User).filter(User.id == assessment.recruiter_id).first()

    try:

        db.commit()

    except IntegrityError:

        db.rollback()

        raise HTTPException(status_code=409, detail="That interview slot has just been booked. Choose another time.")

    email_sent, email_error = send_interview_booking_email(

        to_email=invitation.candidate_email,

        candidate_name=invitation.candidate_name,

        assessment_title=assessment.title,

        recruiter_email=recruiter.email,

        starts_at=slot.starts_at,

        duration_minutes=slot.duration_minutes,

        meeting_url=slot.meeting_url,

    )

    recruiter_notified, _ = send_recruiter_interview_notice(

        to_email=recruiter.email,

        candidate_name=invitation.candidate_name,

        candidate_email=invitation.candidate_email,

        assessment_title=assessment.title,

        starts_at=_as_utc(slot.starts_at),

        duration_minutes=slot.duration_minutes,

        meeting_url=slot.meeting_url,

    )

    return {"status": "booked", "starts_at": _iso_utc(slot.starts_at), "duration_minutes": slot.duration_minutes, "meeting_url": slot.meeting_url, "email_sent": email_sent, "email_error": email_error, "recruiter_notified": recruiter_notified}

