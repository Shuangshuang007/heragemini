# Gateway Performance Test Report

**Test Time**: 12/26/2025, 5:08:54 AM UTC
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
| Min | 12671 |
| Max | 25009 |
| Average | 15159 |
| **p50 (Median)** | **14760** |
| **p95** | **17887** |
| p99 | 25009 |

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
| Min | 8599 |
| Max | 10757 |
| Average | 9136 |
| **p50 (Median)** | **8906** |
| **p95** | **10119** |
| p99 | 10757 |

---

## Comparison

| Metric | recommend_jobs | search_jobs |
|--------|---------|
| Success Rate | 100.0% | 100.0% |
| Timeout Rate | 0.0% | 0.0% |
| p50 | 14760ms | 8906ms |
| p95 | 17887ms | 10119ms |
| Average | 15159ms | 9136ms |

---

*Generated at 2025-12-26T05:08:54.836Z*
