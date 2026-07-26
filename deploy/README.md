# Deployment Artifacts

This directory stores files used for native server deployment.

- `.env` is the private server environment file and is ignored by Git.
- The server configuration assumes PostgreSQL and Redis listen on `127.0.0.1`.
- Keep `SESSION_SECRET` and `CRYPTO_SECRET` stable across deployments.
- Do not use this `.env` inside Docker. A container must connect through the database and Redis container names or another reachable host address.

Build the server binary into this directory from the repository root:

```powershell
go build -buildvcs=false -o deploy/new-api.exe .
```

Before starting the binary, load `deploy/.env` into the process environment or copy it next to the deployment working directory as `.env`.
