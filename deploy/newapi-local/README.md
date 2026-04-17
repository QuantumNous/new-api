# NewAPI Local Docker Deployment

This setup runs `New API` locally with:

- `calciumion/new-api:latest`
- SQLite for persistence in `./data`
- Log files in `./logs`
- HTTP exposed on `http://localhost:3000`
- A local NewAPI metadata source exposed on `http://localhost:8088`

Start:

```bash
docker compose up -d
```

Stop:

```bash
docker compose down
```

On first visit, open `http://localhost:3000` and complete the initialization page to create the admin account and password.

## PostgreSQL Mode

Use `docker-compose.postgres.yml` when you want NewAPI to store its main database in PostgreSQL instead of `./data/one-api.db`.

Create a local env file first:

```bash
cp .env.postgres.example .env.postgres
```

Edit `NEWAPI_POSTGRES_PASSWORD` in `.env.postgres`, then start:

```bash
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --build
```

Stop:

```bash
docker compose --env-file .env.postgres -f docker-compose.postgres.yml down
```

This mode uses:

```env
SQL_DSN=postgresql://<user>:<password>@postgres:5432/<db>?sslmode=disable
```

PostgreSQL data is persisted in the Docker volume `newapi_pg_data`. The existing SQLite file in `./data/one-api.db` is not migrated automatically; starting PostgreSQL mode creates a fresh NewAPI database unless you migrate data separately.

## Local Model Metadata

This directory includes a maintainable NewAPI upstream metadata copy:

- `metadata/api/newapi/models.json`
- `metadata/api/newapi/vendors.json`

The `new-api` service is configured with:

```yaml
SYNC_UPSTREAM_BASE: "http://metadata"
```

Inside this compose stack, NewAPI syncs from:

```text
http://metadata/api/newapi/models.json
http://metadata/api/newapi/vendors.json
```

The same files are also exposed to other machines through:

```text
http://<this-host>:8088/api/newapi/models.json
http://<this-host>:8088/api/newapi/vendors.json
```

For another NewAPI deployment to reuse this shared source, configure that deployment with:

```env
SYNC_UPSTREAM_BASE=http://<this-host>:8088
```
