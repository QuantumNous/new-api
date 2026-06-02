# Schema Impact Workflow

Use these scripts before and after adding GORM models.

1. Export baseline schema from the local isolated PostgreSQL database:

```bash
SCHEMA_DATABASE_URL="$LOCAL_ISOLATED_PG_DSN" ops/schema-impact/export-schema.sh official-baseline
```

2. Run new-api AutoMigrate after code changes.

3. Export the updated schema:

```bash
SCHEMA_DATABASE_URL="$LOCAL_ISOLATED_PG_DSN" ops/schema-impact/export-schema.sh affiliate-after
```

4. Diff the snapshots:

```bash
ops/schema-impact/diff-schema.sh runtime/schema-impact/<before>.sql runtime/schema-impact/<after>.sql
```

Expected changes must be limited to `affiliate_*` or approved sidecar tables and indexes. Do not write production DSNs, passwords, dumps, or schema output files to git.
