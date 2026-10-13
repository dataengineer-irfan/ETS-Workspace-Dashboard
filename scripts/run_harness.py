"""
ETS Genie — AI Evaluation and Test Harness Runner
Processes question batches from input CSV files, captures high-precision telemetry,
classifies answering subsystems (Python vs. LLM), and streams live results to CSV/JSON.

Usage:
  python scripts/run_harness.py --limit 50
  python scripts/run_harness.py --resume
  python scripts/run_harness.py --schedule-interval 60
  python scripts/run_harness.py --schedule-at 02:00
"""

import os
import sys
import csv
import json
import time
import datetime
import argparse
from typing import Dict, Any, List, Optional, Set, Tuple

# Reconfigure stdout/stderr for UTF-8 on Windows
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure repository root is in sys.path
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.app.ai.orchestrator import llm_orchestrator

DEFAULT_INPUT_CSV = os.path.join(REPO_ROOT, '_input', 'ETS_Employee_Dashboard_10000_Test_Questions.csv')
DEFAULT_OUTPUT_DIR = os.path.join(REPO_ROOT, '_output')

FIELDNAMES = [
    'question_id',
    'prompt',
    'answer',
    'time_taken_seconds',
    'time_taken_ms',
    'answered_by',
    'llm_or_python',
    'intent',
    'confidence',
    'category',
    'complexity',
    'sql_query',
    'status',
    'timestamp'
]


def classify_subsystem(res: Dict[str, Any]) -> Tuple[str, str]:
    """
    Determines whether the query was handled by Python (deterministic/compositional)
    or LLM (planner/synthesis/RAG), returning (answered_by, llm_or_python).
    """
    trace = res.get('execution_trace') or {}
    llm_calls = res.get('llm_calls', 0)
    intent = str(res.get('intent', 'UNKNOWN'))
    
    is_llm = (
        llm_calls > 0
        or bool(trace.get('llm_planner_used'))
        or bool(trace.get('llm_synthesis_used'))
        or intent.startswith('LLM_')
    )
    
    if is_llm:
        llm_or_python = 'LLM'
        if trace.get('llm_planner_used') and trace.get('llm_synthesis_used'):
            answered_by = 'LLM (Ollama Planner + Synthesis)'
        elif trace.get('llm_planner_used'):
            answered_by = 'LLM (Ollama Planner)'
        elif trace.get('llm_synthesis_used'):
            answered_by = 'LLM (Ollama Synthesis)'
        elif 'RAG' in intent:
            answered_by = 'LLM (Semantic RAG)'
        else:
            answered_by = f'LLM ({intent})'
    else:
        llm_or_python = 'Python'
        if intent == 'DETERMINISTIC_SQL':
            if trace.get('deterministic_route'):
                answered_by = 'Python (Deterministic SQL)'
            else:
                answered_by = 'Python (Compositional Engine)'
        elif intent == 'EXECUTIVE_REASONING':
            answered_by = 'Python (Executive Reasoner)'
        elif intent == 'ASK_CLARIFICATION':
            answered_by = 'Python (Clarification Handler)'
        elif intent in ('ACCESS_DENIED', 'UNSUPPORTED_DOMAIN', 'NO_MATCH', 'AI_UNAVAILABLE'):
            answered_by = f'Python (Guardrail: {intent})'
        else:
            answered_by = f'Python ({intent})'
            
    return answered_by, llm_or_python


def load_completed_ids(csv_path: str) -> Set[str]:
    """Reads existing CSV results to identify already processed question IDs for resumption."""
    completed = set()
    if not os.path.exists(csv_path):
        return completed
        
    try:
        with open(csv_path, 'r', encoding='utf-8-sig', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                qid = row.get('question_id')
                if qid:
                    completed.add(str(qid).strip())
    except Exception as e:
        print(f'[WARN] Could not read existing results for resume: {e}')
    return completed


def generate_summary(results: List[Dict[str, Any]], output_dir: str):
    """Generates summary metrics in JSON and Markdown formats."""
    if not results:
        return
        
    total = len(results)
    python_count = sum(1 for r in results if r['llm_or_python'] == 'Python')
    llm_count = sum(1 for r in results if r['llm_or_python'] == 'LLM')
    success_count = sum(1 for r in results if r['status'] == 'SUCCESS')
    
    latencies = [float(r['time_taken_seconds']) for r in results if r.get('time_taken_seconds') is not None]
    avg_latency = round(sum(latencies) / len(latencies), 4) if latencies else 0.0
    latencies_sorted = sorted(latencies)
    p50_latency = latencies_sorted[int(len(latencies_sorted) * 0.50)] if latencies_sorted else 0.0
    p95_latency = latencies_sorted[int(len(latencies_sorted) * 0.95)] if latencies_sorted else 0.0
    
    intents: Dict[str, int] = {}
    for r in results:
        intents[r['intent']] = intents.get(r['intent'], 0) + 1
        
    subsystems: Dict[str, int] = {}
    for r in results:
        subsystems[r['answered_by']] = subsystems.get(r['answered_by'], 0) + 1

    summary_data = {
        'total_questions_evaluated': total,
        'success_rate': f'{round((success_count / total) * 100, 2)}%',
        'python_vs_llm': {
            'python_count': python_count,
            'python_percent': f'{round((python_count / total) * 100, 2)}%',
            'llm_count': llm_count,
            'llm_percent': f'{round((llm_count / total) * 100, 2)}%'
        },
        'latency_profile_seconds': {
            'mean': avg_latency,
            'p50': p50_latency,
            'p95': p95_latency
        },
        'intent_distribution': intents,
        'subsystem_distribution': subsystems,
        'last_updated': datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    json_path = os.path.join(output_dir, 'harness_summary.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(summary_data, f, indent=2)
        
    md_path = os.path.join(output_dir, 'harness_summary.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('# ETS Genie — Test Harness Execution Summary\n\n')
        f.write(f'- **Total Questions Evaluated**: {total}\n')
        f.write(f'- **Success Rate**: {round((success_count / total) * 100, 2)}% ({success_count}/{total})\n')
        f.write(f'- **Python (Deterministic/Compositional)**: {python_count} ({round((python_count / total) * 100, 2)}%)\n')
        f.write(f'- **LLM (Model Calls)**: {llm_count} ({round((llm_count / total) * 100, 2)}%)\n')
        f.write(f'- **Mean Latency**: {avg_latency}s (P50: {p50_latency}s, P95: {p95_latency}s)\n\n')
        f.write('## Subsystem Distribution\n\n')
        f.write('| Subsystem | Count | Share |\n| :--- | :--- | :--- |\n')
        for sub, count in sorted(subsystems.items(), key=lambda x: x[1], reverse=True):
            f.write(f'| {sub} | {count} | {round((count / total) * 100, 1)}% |\n')
        f.write('\n## Intent Distribution\n\n')
        f.write('| Intent | Count | Share |\n| :--- | :--- | :--- |\n')
        for it, count in sorted(intents.items(), key=lambda x: x[1], reverse=True):
            f.write(f'| {it} | {count} | {round((count / total) * 100, 1)}% |\n')
        f.write(f'\n*Generated on: {summary_data["last_updated"]}*\n')


def run_harness_batch(
    input_csv: str = DEFAULT_INPUT_CSV,
    output_dir: str = DEFAULT_OUTPUT_DIR,
    limit: Optional[int] = None,
    offset: int = 0,
    batch_size: int = 10,
    resume: bool = True
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, 'harness_results.csv')
    json_path = os.path.join(output_dir, 'harness_results.json')
    
    print(f'[INFO] Ingesting questions from: {input_csv}')
    all_questions = []
    with open(input_csv, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            all_questions.append(row)
            
    total_in_file = len(all_questions)
    print(f'[INFO] Total questions in input dataset: {total_in_file}')
    
    completed_ids = set()
    if resume and os.path.exists(csv_path):
        completed_ids = load_completed_ids(csv_path)
        print(f'[INFO] Resuming run. Found {len(completed_ids)} already completed question IDs.')
        
    pending = []
    for idx, q in enumerate(all_questions):
        qid = str(q.get('question_id', idx + 1)).strip()
        if qid in completed_ids:
            continue
        pending.append(q)
        
    if offset > 0:
        pending = pending[offset:]
    if limit is not None and limit > 0:
        pending = pending[:limit]
        
    total_to_run = len(pending)
    print(f'[INFO] Total questions scheduled for this execution: {total_to_run}')
    if total_to_run == 0:
        print('[INFO] All questions have already been completed.')
        return {'total': 0, 'completed': 0}
        
    csv_exists = os.path.exists(csv_path) and os.path.getsize(csv_path) > 0
    csv_file = open(csv_path, 'a', encoding='utf-8-sig', newline='', errors='replace')
    csv_writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
    if not csv_exists:
        csv_writer.writeheader()
        csv_file.flush()
        
    existing_results: List[Dict[str, Any]] = []
    if os.path.exists(json_path) and os.path.getsize(json_path) > 0:
        try:
            with open(json_path, 'r', encoding='utf-8') as jf:
                existing_results = json.load(jf)
        except Exception:
            existing_results = []
            
    processed_count = 0
    batch_buffer: List[Dict[str, Any]] = []
    t_start_total = time.perf_counter()
    
    for i, item in enumerate(pending):
        qid = str(item.get('question_id', i + 1)).strip()
        prompt = item.get('prompt', '').strip()
        category = item.get('category', '')
        complexity = item.get('complexity', '')
        
        t0 = time.perf_counter()
        try:
            res = llm_orchestrator.process(prompt)
            dt_sec = round(time.perf_counter() - t0, 4)
            dt_ms = round(dt_sec * 1000, 2)
            
            answered_by, llm_or_python = classify_subsystem(res)
            answer = str(res.get('answer', '')).strip()
            intent = str(res.get('intent', 'UNKNOWN'))
            confidence = float(res.get('confidence', 0.0))
            sql_query = str(res.get('sql', '')).strip()
            status = 'SUCCESS' if res.get('status') != 'ERROR' else 'ERROR'
        except Exception as e:
            dt_sec = round(time.perf_counter() - t0, 4)
            dt_ms = round(dt_sec * 1000, 2)
            answered_by = 'Python (Error Handler)'
            llm_or_python = 'Python'
            answer = f'ERROR: {str(e)}'
            intent = 'EXECUTION_ERROR'
            confidence = 0.0
            sql_query = ''
            status = 'ERROR'
            
        record = {
            'question_id': qid,
            'prompt': prompt,
            'answer': answer,
            'time_taken_seconds': dt_sec,
            'time_taken_ms': dt_ms,
            'answered_by': answered_by,
            'llm_or_python': llm_or_python,
            'intent': intent,
            'confidence': confidence,
            'category': category,
            'complexity': complexity,
            'sql_query': sql_query,
            'status': status,
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        csv_writer.writerow(record)
        batch_buffer.append(record)
        existing_results.append(record)
        processed_count += 1
        
        if len(batch_buffer) >= batch_size or (i + 1) == total_to_run:
            csv_file.flush()
            os.fsync(csv_file.fileno())
            with open(json_path, 'w', encoding='utf-8') as jf:
                json.dump(existing_results, jf, indent=2)
            generate_summary(existing_results, output_dir)
            batch_buffer.clear()
            
        pct = round(((i + 1) / total_to_run) * 100, 1)
        print(f'[{i + 1}/{total_to_run} ({pct}%)] QID: {qid} | Time: {dt_sec}s | Subsystem: {llm_or_python} ({answered_by}) | Intent: {intent}')
        
    csv_file.close()
    t_duration = round(time.perf_counter() - t_start_total, 2)
    print(f'\n[DONE] Successfully processed {processed_count} questions in {t_duration}s.')
    print(f'[OUTPUT] Results saved to: {csv_path}')
    print(f'[OUTPUT] JSON saved to: {json_path}')
    return {'total': total_to_run, 'completed': processed_count, 'duration_seconds': t_duration}


def schedule_loop(args):
    if args.schedule_at:
        print(f'[SCHEDULER] Configured to run daily at {args.schedule_at}. Waiting for trigger...')
        while True:
            now_str = datetime.datetime.now().strftime('%H:%M')
            if now_str == args.schedule_at:
                print(f'[SCHEDULER] Trigger time {args.schedule_at} reached. Starting harness run...')
                run_harness_batch(
                    input_csv=args.input,
                    output_dir=args.output_dir,
                    limit=args.limit,
                    offset=args.offset,
                    batch_size=args.batch_size,
                    resume=args.resume
                )
                print('[SCHEDULER] Run complete. Sleeping 65 seconds...')
                time.sleep(65)
            time.sleep(10)
    elif args.schedule_interval:
        interval_sec = int(args.schedule_interval) * 60
        print(f'[SCHEDULER] Configured to run every {args.schedule_interval} minutes.')
        while True:
            print(f'[SCHEDULER] Starting scheduled execution at {datetime.datetime.now()}...')
            run_harness_batch(
                input_csv=args.input,
                output_dir=args.output_dir,
                limit=args.limit,
                offset=args.offset,
                batch_size=args.batch_size,
                resume=args.resume
            )
            print(f'[SCHEDULER] Sleeping for {args.schedule_interval} minutes...')
            time.sleep(interval_sec)
    else:
        run_harness_batch(
            input_csv=args.input,
            output_dir=args.output_dir,
            limit=args.limit,
            offset=args.offset,
            batch_size=args.batch_size,
            resume=args.resume
        )


def main():
    parser = argparse.ArgumentParser(description='ETS Genie AI Evaluation Harness Runner')
    parser.add_argument('--input', default=DEFAULT_INPUT_CSV, help='Path to input test questions CSV')
    parser.add_argument('--output-dir', default=DEFAULT_OUTPUT_DIR, help='Output directory for results')
    parser.add_argument('--limit', type=int, default=None, help='Max questions to evaluate')
    parser.add_argument('--offset', type=int, default=0, help='Question offset start index')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch flush interval')
    parser.add_argument('--resume', action='store_true', default=True, help='Resume from previous run')
    parser.add_argument('--no-resume', action='store_false', dest='resume', help='Do not resume from previous run')
    parser.add_argument('--schedule-interval', type=int, default=None, help='Recurring schedule interval in minutes')
    parser.add_argument('--schedule-at', type=str, default=None, help='Scheduled trigger time in 24h format (HH:MM)')
    
    args = parser.parse_args()
    schedule_loop(args)


if __name__ == '__main__':
    main()
