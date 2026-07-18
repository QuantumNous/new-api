# Log Query Baseline

Cursor pagination uses `(created_at, id)` for SQLite/MySQL/PostgreSQL and `(created_at, request_id)` for ClickHouse. Offset pagination remains available only for compatibility.

PostgreSQL staging baseline:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM logs
WHERE (created_at < :created_at OR (created_at = :created_at AND id < :id))
ORDER BY created_at DESC, id DESC
LIMIT 101;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM logs
WHERE trace_id = :trace_id
ORDER BY created_at ASC, id ASC
LIMIT 200;
```

Acceptance:

- no large `OFFSET` in the cursor query;
- an index scan uses `idx_created_at_id` or a more selective filter index;
- trace lookup uses `idx_logs_trace_id` / `idx_logs_trace_created`;
- representative deep-page P95 is below 300 ms under staging data volume.

The model test suite runs SQLite `EXPLAIN QUERY PLAN` assertions. PostgreSQL, MySQL and ClickHouse plans must be captured in staging because their optimizers and data distributions cannot be represented by the in-memory unit database.
