# Registration Domain Trusted Option Lock Hotfix Design

## Problem

The admin “unblock, restore users, and trust domain” action fails on MySQL before any users are restored. The production query contains an unquoted `key` predicate:

```sql
SELECT * FROM `options`
WHERE key = ?
  AND `options`.`key` = ?
ORDER BY `options`.`key`
LIMIT 1 FOR UPDATE
```

`key` is a MySQL reserved word, so the transaction returns MySQL error 1064 and rolls back. GORM adds the second, correctly quoted predicate because the destination `Option` already contains its primary-key value.

## Chosen Scope

Apply the smallest production hotfix selected by the user:

- replace the explicit raw `key` column reference with the existing cross-database `commonKeyCol` value;
- retain GORM’s automatically appended primary-key predicate;
- retain the transaction, row lock, restoration, option update, cache invalidation, and multi-node behavior unchanged;
- do not migrate or modify production data;
- do not refactor other `Option` queries.

The resulting MySQL query may still contain two equivalent predicates, but both will quote the reserved column correctly. PostgreSQL will continue to use `"key"`, while MySQL and SQLite use `` `key` `` through the existing model-layer compatibility variable.

## Test Design

Add a focused query-shape regression test that uses GORM’s MySQL dialect in dry-run mode and exercises the locked trusted-domain option lookup. The test must demonstrate the current failure by detecting the unquoted `WHERE key =` fragment, then pass after the production query uses `commonKeyCol`.

Keep the existing SQLite behavioral tests for release and restoration. No new dependency is required.

## Acceptance Criteria

- the locked trusted-domain option query never emits an unquoted `key` predicate for MySQL;
- the query still uses `FOR UPDATE` and targets the configured trusted-domain option;
- existing release and restoration behavior remains unchanged;
- targeted registration-domain tests, the model test suite, and `go build ./...` pass, or any unrelated baseline failure is reported with evidence;
- the final diff is limited to the model query, its regression test, and this design/plan documentation.

## Deployment Scope

This changes an admin recovery path served by the Go console application. It does not change relay or model invocation behavior, so router deployment is not required based on this diff. Validate in staging before deploying `newapi-console` to production; the legacy `newapi` service is decommissioned and is not a deployment target.
