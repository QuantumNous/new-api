# Service Level Objectives

## Objectives

| Surface | Indicator | Objective (rolling 30 days) |
|---|---|---|
| Relay | non-4xx availability | >= 99.9% |
| Management API | non-5xx availability | >= 99.5% |
| Management API | request latency P95 | < 300 ms |
| Browser | LCP P75 | <= 2.5 s |
| Browser | INP P75 | <= 200 ms |
| Browser | CLS P75 | <= 0.1 |

The Relay latency SLO must be split by route and upstream model. End-to-end model generation time is not a gateway-only SLO; alert on gateway errors, header timeout, cancellation and queueing separately.

## Collection

- Enable `METRICS_ENABLED` and scrape `/metrics` every 15 seconds.
- The HTTP middleware exports request count, duration and in-flight requests using bounded route templates rather than raw paths.
- The frontend sends only metric name, value and rating to `/api/rum`. It sends no URL, user ID, token, trace ID or content, and honors browser Do Not Track.
- Keep `trace_id` and `request_id` in structured logs for drill-down after an alert.

## Error Budget Workflow

1. Page on sustained Relay 5xx or availability burn.
2. Create a trace sample from affected route/model groups.
3. Separate database, gateway and upstream duration before mitigation.
4. Freeze risky releases when the 30-day error budget is exhausted.
5. Record the incident, corrective action and regression test.

Prometheus alert examples are in `deploy/prometheus/new-api-alerts.yml`.
