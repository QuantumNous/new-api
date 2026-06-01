# Production Security Configuration

This guide covers the production Docker Compose security settings for `new-api`.

## Required `.env` Values

Before running `docker compose up -d`, copy `.env.example` to `.env` and set these values:

```dotenv
NEW_API_IMAGE_TAG=
POSTGRES_USER=root
POSTGRES_PASSWORD=
POSTGRES_DB=new-api
REDIS_PASSWORD=
SESSION_SECRET=
CRYPTO_SECRET=
```

Use `NEW_API_IMAGE_TAG` with an immutable release tag. Do not use `latest` for commercial or production deployments because it makes upgrades implicit and rollback behavior ambiguous.

Generate unique high-entropy values for:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `SESSION_SECRET`
- `CRYPTO_SECRET`
- `MYSQL_ROOT_PASSWORD`, if using MySQL instead of PostgreSQL

Use at least 32 random characters for passwords, session secrets, and encryption secrets. Keep `.env` out of source control and restrict filesystem access to deployment operators.

`CRYPTO_SECRET` protects newly stored provider credentials, payment secrets, and other sensitive options. Keep it stable across restarts. Rotating it requires a planned credential migration because existing encrypted values must be decrypted with the previous secret and re-encrypted with the new one.

## Password Encoding

`SQL_DSN` and `REDIS_CONN_STRING` are URL-like connection strings. If a password contains reserved characters such as `@`, `:`, `/`, `?`, `#`, `&`, or `%`, URL-encode the password value before placing it in `.env`, or choose a generated value that avoids URL-reserved characters.

The Redis container password is also passed to `redis-server --requirepass`, so `REDIS_PASSWORD` must match the password embedded in `REDIS_CONN_STRING`.

## PostgreSQL Deployment

The default production compose file uses PostgreSQL:

```yaml
SQL_DSN=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

Do not expose PostgreSQL to the host or public network unless there is a specific operational need. If external database access is required, restrict it with host firewall rules and database-level credentials.

## MySQL Deployment

If switching to MySQL:

1. Comment out the PostgreSQL service and dependency.
2. Uncomment the MySQL service, dependency, volume, and MySQL `SQL_DSN`.
3. Set these values in `.env`:

```dotenv
MYSQL_USER=root
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=new-api
```

For production environments with shared database infrastructure, prefer a dedicated least-privilege database user instead of the root account.

## Pre-Deployment Checks

Render the final Compose configuration before deployment:

```bash
docker compose config
```

Confirm the rendered output:

- Does not reference `:latest` images.
- Does not contain example passwords such as `123456`.
- Contains the intended database and Redis connection strings.
- Does not expose database or Redis ports unless explicitly required.

Start the stack:

```bash
docker compose up -d
docker compose ps
```

Check application health:

```bash
curl -fsS http://localhost:3000/api/status
```
