# Bug Records

## 2026-06-13 - Docker build fails in modernc SQLite with Go 1.26

- Symptom: `go build` fails in `modernc.org/sqlite@v1.40.1` with `undefined: unsafm`.
- Root cause: the Go 1.26 Docker builder enables Green Tea GC by default, while the Dockerfile also forced the legacy `greenteagc` experiment setting. This compiler path is incompatible with the generated SQLite source used by the project.
- Fix: set `GOEXPERIMENT=nogreenteagc` for the backend build until the SQLite dependency/toolchain combination compiles reliably with Green Tea GC.
- Verification: the rebuild passed the previous SQLite compilation point and reached the final linker stage.
- Environment blocker: the final link then failed because Docker Desktop's BuildKit storage became read-only. The Windows `C:` drive had only about 0.01 GB free, and Docker's 25.92 GB data disk was located at `C:\Users\Free\AppData\Local\Docker\wsl\disk\docker_data.vhdx`.
- Regression check after freeing system-drive space: restart Docker Desktop, rebuild the `new-api` image, and verify `http://localhost:3000/api/status` reports success.
