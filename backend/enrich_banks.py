with open('backend/app/routers/assessments.py', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.splitlines()

# Collapse redundant blank lines
collapsed = []
prev_blank = False
for l in lines:
    if not l.strip():
        if not prev_blank:
            collapsed.append('')
            prev_blank = True
    else:
        collapsed.append(l)
        prev_blank = False
lines = collapsed

# Locate DSA_QUESTION_BANK
start_dsa = None
end_dsa = None
for i, l in enumerate(lines):
    if 'DSA_QUESTION_BANK = [' in l:
        start_dsa = i
    if start_dsa is not None and 'MCQ_QUESTION_BANK = [' in l:
        end_dsa = i
        break

print(f"DSA bank located from line {start_dsa} to {end_dsa}")

new_dsa_bank = '''DSA_QUESTION_BANK = [
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Two-Sum Target Array (Optimized Hash Map)",
        "prompt": (
            "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\\n\\n"
            "• Each input has exactly one valid solution.\\n"
            "• You may not use the same element twice.\\n"
            "• Provide an optimal O(n) time complexity solution.\\n\\n"
            "**Example 1:**\\n"
            "Input: `nums = [2, 7, 11, 15]`, `target = 9`\\n"
            "Output: `[0, 1]` (Since nums[0] + nums[1] == 9)\\n\\n"
            "**Example 2:**\\n"
            "Input: `nums = [3, 2, 4]`, `target = 6`\\n"
            "Output: `[1, 2]`\\n\\n"
            "**Instructions:** Write your complete solution below and analyze Time & Space complexity."
        ),
        "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\\n    # Optimal O(n) solution using hash map\\n    seen = {}\\n    for i, num in enumerate(nums):\\n        diff = target - num\\n        if diff in seen:\\n            return [seen[diff], i]\\n        seen[num] = i\\n    return []\\n",
        "short_answer": "Use a single-pass hash map to store visited numbers and their indices. For each element num, check if (target - num) exists in map. Time Complexity: O(n), Space Complexity: O(n).",
        "solution": (
            "def two_sum(nums: list[int], target: int) -> list[int]:\\n"
            "    seen = {}\\n"
            "    for i, num in enumerate(nums):\\n"
            "        complement = target - num\\n"
            "        if complement in seen:\\n"
            "            return [seen[complement], i]\\n"
            "        seen[num] = i\\n"
            "    return []\\n\\n"
            "# Time Complexity: O(n) - single iteration through nums\\n"
            "# Space Complexity: O(n) - hash map stores at most n elements"
        ),
    },
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Longest Substring Without Repeating Characters (Sliding Window)",
        "prompt": (
            "Given a string `s`, find the length of the longest substring without duplicate characters.\\n\\n"
            "**Example 1:**\\n"
            "Input: `s = \\"abcabcbb\\"`\\n"
            "Output: `3` (The answer is `\\"abc\\"`, length = 3)\\n\\n"
            "**Example 2:**\\n"
            "Input: `s = \\"bbbbb\\"`\\n"
            "Output: `1` (The answer is `\\"b\\"`, length = 1)\\n\\n"
            "**Example 3:**\\n"
            "Input: `s = \\"pwwkew\\"`\\n"
            "Output: `3` (The answer is `\\"wke\\"`, length = 3)\\n\\n"
            "**Constraints:** 0 <= len(s) <= 50,000\\n\\n"
            "**Instructions:** Implement using sliding window (O(n) time) and explain pointer updates."
        ),
        "starter_code": "def length_of_longest_substring(s: str) -> int:\\n    # Implement sliding window algorithm\\n    pass\\n",
        "short_answer": "Sliding window with left/right pointers. Track the last seen index of each character in a dictionary. When duplicate is seen, jump left = max(left, last_seen[char] + 1). Time: O(n), Space: O(min(m, n)).",
        "solution": (
            "def length_of_longest_substring(s: str) -> int:\\n"
            "    last_seen = {}\\n"
            "    max_len = 0\\n"
            "    left = 0\\n"
            "    for right, ch in enumerate(s):\\n"
            "        if ch in last_seen and last_seen[ch] >= left:\\n"
            "            left = last_seen[ch] + 1\\n"
            "        last_seen[ch] = right\\n"
            "        max_len = max(max_len, right - left + 1)\\n"
            "    return max_len\\n\\n"
            "# Time Complexity: O(n) - each character processed in O(1)\\n"
            "# Space Complexity: O(k) - map contains unique characters"
        ),
    },
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Merge Overlapping Intervals",
        "prompt": (
            "Given an array of `intervals` where `intervals[i] = [start, end]`, merge all overlapping intervals, and return an array of non-overlapping intervals.\\n\\n"
            "**Example 1:**\\n"
            "Input: `intervals = [[1,3],[2,6],[8,10],[15,18]]`\\n"
            "Output: `[[1,6],[8,10],[15,18]]`\\n"
            "(Since [1,3] and [2,6] overlap, merge them into [1,6])\\n\\n"
            "**Example 2:**\\n"
            "Input: `intervals = [[1,4],[4,5]]`\\n"
            "Output: `[[1,5]]`\\n\\n"
            "**Constraints:** 1 <= intervals.length <= 10^4\\n\\n"
            "**Instructions:** Sort by start time, then merge in a single linear pass."
        ),
        "starter_code": "def merge(intervals: list[list[int]]) -> list[list[int]]:\\n    # Sort and merge in linear pass\\n    pass\\n",
        "short_answer": "Sort intervals by start time in O(n log n). Traverse and merge with previous interval if current.start <= prev.end; otherwise append as new interval. Time: O(n log n), Space: O(n).",
        "solution": (
            "def merge(intervals: list[list[int]]) -> list[list[int]]:\\n"
            "    if not intervals:\\n"
            "        return []\\n"
            "    intervals.sort(key=lambda x: x[0])\\n"
            "    merged = [intervals[0]]\\n"
            "    for start, end in intervals[1:]:\\n"
            "        prev_start, prev_end = merged[-1]\\n"
            "        if start <= prev_end:\\n"
            "            merged[-1][1] = max(prev_end, end)\\n"
            "        else:\\n"
            "            merged.append([start, end])\\n"
            "    return merged\\n\\n"
            "# Time Complexity: O(n log n) - sorting dominates\\n"
            "# Space Complexity: O(n) - result list"
        ),
    },
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Valid Parentheses & Bracket Matching",
        "prompt": (
            "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\\n\\n"
            "An input string is valid if:\\n"
            "1. Open brackets are closed by the same type of brackets.\\n"
            "2. Open brackets are closed in the correct order.\\n"
            "3. Every close bracket has a corresponding open bracket of the same type.\\n\\n"
            "**Example 1:** Input: `s = \\"()[]{}\\"` -> Output: `True`\\n"
            "**Example 2:** Input: `s = \\"(]\\"` -> Output: `False`\\n\\n"
            "**Instructions:** Write the stack-based O(n) solution and state the auxiliary space complexity."
        ),
        "starter_code": "def is_valid_parentheses(s: str) -> bool:\\n    # Use stack data structure\\n    pass\\n",
        "short_answer": "Use a LIFO stack. For opening brackets, push to stack. For closing brackets, pop and verify matching type. String is valid iff stack is empty at end. Time: O(n), Space: O(n).",
        "solution": (
            "def is_valid_parentheses(s: str) -> bool:\\n"
            "    pairs = {')': '(', '}': '{', ']': '['}\\n"
            "    stack = []\\n"
            "    for ch in s:\\n"
            "        if ch in pairs:\\n"
            "            if not stack or stack[-1] != pairs[ch]:\\n"
            "                return False\\n"
            "            stack.pop()\\n"
            "        else:\\n"
            "            stack.append(ch)\\n"
            "    return len(stack) == 0\\n\\n"
            "# Time: O(n) - single pass over string\\n"
            "# Space: O(n) - stack stores unclosed brackets"
        ),
    },
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Least Recently Used (LRU) Cache Eviction Policy",
        "prompt": (
            "Design an LRU Cache data structure that supports `get(key)` and `put(key, value)` operations, both executing in average O(1) time complexity.\\n\\n"
            "• `get(key)`: Returns value if key exists, otherwise -1.\\n"
            "• `put(key, value)`: Insert or update key. If cache capacity is exceeded, evict the least recently accessed key.\\n\\n"
            "**Instructions:** Detail why a Hash Map combined with a Doubly Linked List achieves O(1) operations, and provide the class implementation."
        ),
        "starter_code": "class LRUCache:\\n    def __init__(self, capacity: int):\\n        self.capacity = capacity\\n\\n    def get(self, key: int) -> int:\\n        pass\\n\\n    def put(self, key: int, value: int) -> None:\\n        pass\\n",
        "short_answer": "Combine Hash Map (key -> node for O(1) lookup) with Doubly Linked List (O(1) node removal and head insertion). Evict from tail on capacity overflow. Time: O(1) get/put, Space: O(capacity).",
        "solution": (
            "class Node:\\n"
            "    def __init__(self, key=0, val=0):\\n"
            "        self.key, self.val = key, val\\n"
            "        self.prev = self.next = None\\n\\n"
            "class LRUCache:\\n"
            "    def __init__(self, capacity: int):\\n"
            "        self.cap = capacity\\n"
            "        self.cache = {}\\n"
            "        self.head, self.tail = Node(), Node()\\n"
            "        self.head.next, self.tail.prev = self.tail, self.head\\n\\n"
            "    def _remove(self, node):\\n"
            "        node.prev.next = node.next\\n"
            "        node.next.prev = node.prev\\n\\n"
            "    def _add(self, node):\\n"
            "        node.next = self.head.next\\n"
            "        node.prev = self.head\\n"
            "        self.head.next.prev = node\\n"
            "        self.head.next = node\\n\\n"
            "    def get(self, key: int) -> int:\\n"
            "        if key in self.cache:\\n"
            "            node = self.cache[key]\\n"
            "            self._remove(node)\\n"
            "            self._add(node)\\n"
            "            return node.val\\n"
            "        return -1\\n\\n"
            "    def put(self, key: int, value: int) -> None:\\n"
            "        if key in self.cache:\\n"
            "            self._remove(self.cache[key])\\n"
            "        node = Node(key, value)\\n"
            "        self.cache[key] = node\\n"
            "        self._add(node)\\n"
            "        if len(self.cache) > self.cap:\\n"
            "            lru = self.tail.prev\\n"
            "            self._remove(lru)\\n"
            "            del self.cache[lru.key]\\n"
        ),
    },
    {
        "type": "coding",
        "category": "DSA (Algorithms)",
        "title": "Binary Tree Level Order Traversal (BFS)",
        "prompt": (
            "Given the `root` of a binary tree, return the level order traversal of its nodes' values (i.e. from left to right, level by level).\\n\\n"
            "**Example 1:**\\n"
            "Input: `root = [3, 9, 20, null, null, 15, 7]`\\n"
            "Output: `[[3], [9, 20], [15, 7]]`\\n\\n"
            "**Instructions:** Implement BFS using a FIFO queue (`collections.deque`), handling level boundaries."
        ),
        "starter_code": "from collections import deque\\n\\ndef level_order(root) -> list[list[int]]:\\n    # Implement BFS level-order traversal using deque\\n    pass\\n",
        "short_answer": "Breadth-First Search (BFS) using collections.deque. Process queue level-by-level using len(queue). Append each node value to level list and push non-null children. Time: O(n), Space: O(n).",
        "solution": (
            "from collections import deque\\n\\n"
            "def level_order(root) -> list[list[int]]:\\n"
            "    if not root:\\n"
            "        return []\\n"
            "    result = []\\n"
            "    q = deque([root])\\n"
            "    while q:\\n"
            "        level = []\\n"
            "        for _ in range(len(q)):\\n"
            "            node = q.popleft()\\n"
            "            level.append(node.val)\\n"
            "            if node.left:\\n"
            "                q.append(node.left)\\n"
            "            if node.right:\\n"
            "                q.append(node.right)\\n"
            "        result.append(level)\\n"
            "    return result\\n\\n"
            "# Time: O(n) - visits each tree node once\\n"
            "# Space: O(w) - max breadth of the tree"
        ),
    },
]
'''

lines = lines[:start_dsa] + new_dsa_bank.splitlines() + lines[end_dsa:]

# Locate MCQ_QUESTION_BANK
start_mcq = None
end_mcq = None
for i, l in enumerate(lines):
    if 'MCQ_QUESTION_BANK = [' in l:
        start_mcq = i
    if start_mcq is not None and 'SYSTEM_DESIGN_BANK = [' in l:
        end_mcq = i
        break

print(f"MCQ bank located from line {start_mcq} to {end_mcq}")

new_mcq_bank = '''MCQ_QUESTION_BANK = [
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
        "short_answer": "Option A is correct. A self-balancing BST (AVL or Red-Black) strictly maintains O(log N) height, guaranteeing O(log N) average and worst-case search time.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "In Python, which of the following operations has an average time complexity of O(1)?",
        "options": [
            "A) Accessing a dictionary key `d[k]`",
            "B) Checking list membership `x in my_list`",
            "C) Inserting an element at the beginning of a list `my_list.insert(0, x)`",
            "D) Finding the minimum value in an unsorted list `min(my_list)`",
        ],
        "correct_option": "A) Accessing a dictionary key `d[k]`",
        "short_answer": "Option A is correct. Python dictionaries use hash tables, providing average O(1) key lookup. List insertion at index 0 and membership check are O(n).",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "Which HTTP status code should be returned when an authenticated client requests a resource they do not have sufficient permissions to access?",
        "options": [
            "A) 403 Forbidden",
            "B) 401 Unauthorized",
            "C) 404 Not Found",
            "D) 422 Unprocessable Entity",
        ],
        "correct_option": "A) 403 Forbidden",
        "short_answer": "Option A is correct. 401 Unauthorized indicates missing or invalid credentials (unauthenticated), while 403 Forbidden indicates the server understands identity but refuses authorization.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "What does the 'I' in database ACID properties stand for, and what guarantee does it provide?",
        "options": [
            "A) Isolation — Concurrent transactions execute without interfering with one another",
            "B) Idempotency — Repeating an operation produces the exact same result",
            "C) Immutability — Once data is committed it cannot be altered or overwritten",
            "D) Integrity — Database schema constraints and foreign keys are strictly enforced",
        ],
        "correct_option": "A) Isolation — Concurrent transactions execute without interfering with one another",
        "short_answer": "Option A is correct. ACID stands for Atomicity, Consistency, Isolation, and Durability. Isolation ensures concurrent transactions behave as if executed sequentially.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "Which of the following database index structures is best suited for accelerating range queries (e.g. `WHERE age BETWEEN 25 AND 35`)?",
        "options": [
            "A) B-Tree / B+ Tree",
            "B) Hash Index",
            "C) Bloom Filter",
            "D) BitMap Index",
        ],
        "correct_option": "A) B-Tree / B+ Tree",
        "short_answer": "Option A is correct. B+ Trees maintain sorted key order, allowing O(log N) lookup of the range start followed by sequential leaf traversal. Hash indexes only support equality.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "According to the HTTP/1.1 specification (RFC 7231), which of the following HTTP methods is considered BOTH safe and idempotent?",
        "options": [
            "A) GET",
            "B) POST",
            "C) PATCH",
            "D) DELETE",
        ],
        "correct_option": "A) GET",
        "short_answer": "Option A is correct. GET and HEAD are both safe (read-only, no server side effects) and idempotent. DELETE and PUT are idempotent but not safe.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "What is the primary difference between a process and a thread in modern operating systems?",
        "options": [
            "A) Threads within the same process share memory address space, while processes have isolated memory spaces",
            "B) Processes are managed by the kernel, while threads can only run in user space",
            "C) Threads can utilize multiple CPU cores, whereas processes are confined to a single core",
            "D) Processes can switch contexts in zero time, whereas thread switching requires CPU cache flushes",
        ],
        "correct_option": "A) Threads within the same process share memory address space, while processes have isolated memory spaces",
        "short_answer": "Option A is correct. Threads share the parent process heap, file descriptors, and code segments, whereas processes have independent virtual address spaces.",
    },
    {
        "type": "mcq",
        "category": "MCQ (Quiz)",
        "prompt": "In modern web and backend development, what is the primary risk mitigated by using Prepared Statements (Parameterized Queries)?",
        "options": [
            "A) SQL Injection (SQLi) vulnerabilities",
            "B) Cross-Site Scripting (XSS)",
            "C) Distributed Denial of Service (DDoS)",
            "D) Insecure Direct Object References (IDOR)",
        ],
        "correct_option": "A) SQL Injection (SQLi) vulnerabilities",
        "short_answer": "Option A is correct. Parameterized queries pre-compile the SQL structure, treating all user input strictly as literal values rather than executable SQL syntax.",
    },
]
'''

lines = lines[:start_mcq] + new_mcq_bank.splitlines() + lines[end_mcq:]

# Update _candidate_questions function to map solution & short_answer
for i, l in enumerate(lines):
    if '"starter_code": item.get("starter_code", ""),\' in l:
        lines[i] = \'                    "starter_code": item.get("starter_code", ""),\\n                    "short_answer": item.get("short_answer", ""),\\n                    "solution": item.get("solution", ""),\'
    if '"correct_option": item.get("correct_option"),\' in l:
        lines[i] = \'                    "correct_option": item.get("correct_option"),\\n                    "short_answer": item.get("short_answer", ""),\'

with open('backend/app/routers/assessments.py', 'w', encoding='utf-8', newline='\\n') as f:
    f.write('\\n'.join(lines) + '\\n')

print("SUCCESS: enriched assessments.py with solutions & short answers!")
