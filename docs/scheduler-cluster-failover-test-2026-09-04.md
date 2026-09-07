# Scheduler Cluster Failover Test Report

Date: 2026-09-04

## Setup

- `new-api` already running on `http://127.0.0.1:5678`
- Scheduler A: `http://127.0.0.1:18080`
- Scheduler B: `http://127.0.0.1:18082`
- `new-api` scheduler config:
  - `bootstrap_urls=http://127.0.0.1:18080,http://127.0.0.1:18082`
  - `local_url=http://127.0.0.1:18080`

## Checks

1. Cluster discovery
   - `GET /api/scheduler/config`
   - `GET /api/scheduler/monitor`
   - `POST /api/scheduler/test-connection`

2. Real request path
   - `POST /v1/chat/completions`
   - Request used a valid user token and triggered scheduler shadow routing

3. Failover
   - Stopped Scheduler A on `:18080`
   - Re-ran `monitor` and `test-connection`
   - Sent another real chat request through `new-api`

## Results

- Both scheduler nodes were visible to `new-api` after config update.
- Before failover, `monitor` reported both nodes reachable.
- After stopping Scheduler A, `monitor` reported:
  - `18080 reachable=false`
  - `18082 reachable=true`
- `test-connection` succeeded with fallback to `18082`.
- Real `POST /v1/chat/completions` still succeeded while `18080` was down.
- `new-api` logged scheduler decision and attempt report for the request.

## Conclusion

Cluster discovery and scheduler failover are working with the bootstrap list approach.
