# ETS Genie AI Evaluation Report

**Evaluation Run ID**: `RUN_20260913_110908`  
**Generated At**: 2026-09-13T05:39:50.340840+00:00  
**Questions Executed**: 10  

---

## 1. Executive Scorecard

```text
ETS GENIE AI EVALUATION SCORECARD
=================================
Questions Executed:              10

Overall Performance:
  Passed:                        8 (80.0%)
  Failed:                        2
  Expected Governed Rejections:  0
  Unexpected Failures:           2

Latency Statistics:
  Average Latency:               20.59s
  P50 (Median) Latency:          15.64s
  P95 Latency:                   32.98s
  P99 Latency:                   33.22s

Zero-Trust Integrity Verification:
  Unexpected Fallbacks:          0 (0 expected)
  Mocks / Fakes Detected:        0 (0 expected)
  Hardcoded Answers Detected:    0 (0 expected)
```

---

## 2. Six-Page Coverage Matrix

| Page Name | Route / Context | Questions | Passed | Failed | Accuracy |
|---|---|---:|---:|---:|---:|
| `home` | `/home` | 8 | 6 | 2 | 75.0% |
| `techwise` | `/techwise` | 0 | 0 | 0 | 0.0% |
| `statewise` | `/statewise` | 2 | 2 | 0 | 100.0% |
| `salarywise` | `/salarywise` | 0 | 0 | 0 | 0.0% |
| `calendar` | `/calendar` | 0 | 0 | 0 | 0.0% |
| `employee_details` | `/employee_details` | 0 | 0 | 0 | 0.0% |

---

## 3. Performance by Question Category

| Category | Total Questions | Passed | Failed | Accuracy |
|---|---:|---:|---:|---:|
| `sql` | 10 | 8 | 2 | 80.0% |

---

## 4. Failure Triage & Diagnostics

Total Unexpected Failures: **2**

| Question ID | Question | Expected Outcome | Actual Outcome | Failure Stage | Error Message |
|---|---|---|---|---|---|
| `Q000002` | Who has the shortest tenure at ETS? | `SUCCESS` | `PLANNER_REJECTED` | `PLANNER` | N/A |
| `Q000010` | List the top 5 employees with the longest tenure. | `SUCCESS` | `SYNTHESIS_FAILED` | `SYNTHESIS` | N/A |
