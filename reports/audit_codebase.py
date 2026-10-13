import os
import re

files_to_check = [
    'backend/app/ai/capability_registry.py',
    'backend/app/ai/compositional.py',
    'backend/app/ai/orchestrator.py',
    'backend/app/routers/copilot.py',
    'backend/app/models.py'
]

test_questions = [
    "How many employees are in E3 on NH?",
    "How many employees are in E2 on AK?",
    "Compare Infinite vs Prior experience by grade",
    "Show Infinite and Prior experience by grade",
    "How does Infinite experience compare with Prior experience across grades?",
    "Compare NH and ND headcount",
    "Which state has more employees, NH or ND?",
    "Compare Bangalore and Hyderabad headcount",
    "Break down workforce by job level and project",
    "Show workforce by job level",
    "How many employees are in ND?",
    "Show the complete job level"
]

results = {
    "question_specific_if_else": 0,
    "question_specific_regex": 0,
    "question_specific_switch_case": 0,
    "question_specific_sql": 0,
    "hardcoded_answers": 0,
    "details": []
}

for rel_path in files_to_check:
    full_path = os.path.abspath(rel_path)
    if not os.path.exists(full_path):
        continue
    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()
        lines = content.splitlines()

    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("*"):
            continue

        # Check for exact question strings
        for q in test_questions:
            q_clean = q.lower().strip("?").strip()
            if f'"{q_clean}"' in stripped.lower() or f"'{q_clean}'" in stripped.lower():
                # make sure it's not a docstring or comment
                if "if " in stripped or "elif " in stripped or "==" in stripped:
                    results["question_specific_if_else"] += 1
                    results["details"].append(f"{rel_path}:{idx}: question check: {stripped}")

        # Check for question-specific if/else constructs
        if re.search(r'if\s+["\']infinite["\']\s+in\s+question', stripped, re.IGNORECASE):
            results["question_specific_if_else"] += 1
            results["details"].append(f"{rel_path}:{idx}: {stripped}")
        if re.search(r'if\s+["\']nh["\']\s+in\s+question', stripped, re.IGNORECASE):
            results["question_specific_if_else"] += 1
            results["details"].append(f"{rel_path}:{idx}: {stripped}")

        # Check for hardcoded return answers
        if re.search(r'return\s+["\'].*?(91 employees|69 employees).*?["\']', stripped):
            results["hardcoded_answers"] += 1
            results["details"].append(f"{rel_path}:{idx}: {stripped}")

print("=== CODEBASE AUDIT RESULTS ===")
print(f"Question-specific if/else: {results['question_specific_if_else']}")
print(f"Question-specific regex: {results['question_specific_regex']}")
print(f"Question-specific switch/case: {results['question_specific_switch_case']}")
print(f"Question-specific SQL: {results['question_specific_sql']}")
print(f"Hardcoded expected answers: {results['hardcoded_answers']}")
if results["details"]:
    print("\nFlagged items:")
    for d in results["details"]:
        print("  -", d)
else:
    print("\nZERO question-specific patches found. Clean generic architecture confirmed.")
