# Free deployment: Koyeb + Neon

This guide is for running the full application for personal use without installing Docker locally.

Koyeb builds the existing `Dockerfile` in the cloud. Neon provides a free PostgreSQL database. Do not use SQLite on free cloud instances, because local files are not a reliable long-term database there.

## 1. Push the project to GitHub

Commit and push this repository to a GitHub repository. You do not need to upload local runtime files such as:

- `new-api.exe`
- `one-api.db`
- `logs/`
- `one-api*.out`
- `one-api*.err`
- `one-api.lock`

## 2. Create a Neon PostgreSQL database

Create a free Neon project and copy the PostgreSQL connection string.

Use the pooled or direct connection string, but keep `sslmode=require`.

Example format:

```text
postgresql://user:password@host/dbname?sslmode=require
```

## 3. Create the Koyeb service

Create a Koyeb Web Service from the GitHub repository.

Recommended settings:

- Builder: `Dockerfile`
- Dockerfile path: `Dockerfile`
- Port: `3000`
- Instance: free instance

## 4. Set environment variables

Required:

```text
SQL_DSN=postgresql://user:password@host/dbname?sslmode=require
SESSION_SECRET=replace-with-a-long-random-string
PORT=3000
```

Optional for personal use:

```text
MEMORY_CACHE_ENABLED=true
SYNC_FREQUENCY=60
CHANNEL_UPDATE_FREQUENCY=30
BATCH_UPDATE_ENABLED=true
BATCH_UPDATE_INTERVAL=5
```

Leave `REDIS_CONN_STRING` empty unless you also have a Redis service. The application will disable Redis automatically when it is not set.

## 5. Open the deployed URL

After the deployment succeeds, open the HTTPS URL provided by Koyeb on your phone.

On first startup, the application creates the root user automatically when no user exists:

```text
username: root
password: 123456
```

Change the password immediately after logging in.

## Free tier limitations

Free instances can sleep after inactivity, so the first request from your phone may take extra time while the service wakes up.

For stable long-running use, move to a paid instance or a VPS later. The same PostgreSQL database can usually be reused.
