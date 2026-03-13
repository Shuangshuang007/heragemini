# Gateway Performance Test Report

**Test Time**: 12/26/2025, 5:36:55 AM UTC
**Environment**: https://www.heraai.net.au
**Iterations**: 30 per tool
**Timeout Threshold**: 30000ms

---

## recommend_jobs

### Summary

| Metric | Value |
|--------|-------|
| Total Requests | 30 |
| Successful | 30 (100.0%) |
| Failed | 0 (0.0%) |
| Timeout (≥30000ms) | 0 (0.0%) |

### Performance Metrics (Successful Requests Only)

| Metric | Value (ms) |
|--------|-----------|
| Min | 7362 |
| Max | 19947 |
| Average | 11271 |
| **p50 (Median)** | **10507** |
| **p95** | **18429** |
| p99 | 19947 |

---

## search_jobs

### Summary

| Metric | Value |
|--------|-------|
| Total Requests | 30 |
| Successful | 30 (100.0%) |
| Failed | 0 (0.0%) |
| Timeout (≥30000ms) | 0 (0.0%) |

### Performance Metrics (Successful Requests Only)

| Metric | Value (ms) |
|--------|-----------|
| Min | 6839 |
| Max | 13312 |
| Average | 8011 |
| **p50 (Median)** | **7548** |
| **p95** | **9796** |
| p99 | 13312 |

---

## Comparison

| Metric | recommend_jobs | search_jobs |
|--------|----------------------|----------------|
| Success Rate | 100.0% | 100.0% |
| Timeout Rate | 0.0% | 0.0% |
| p50 | 10507ms | 7548ms |
| p95 | 18429ms | 9796ms |
| Average | 11271ms | 8011ms |

---

*Generated at 2025-12-26T05:36:55.427Z*
