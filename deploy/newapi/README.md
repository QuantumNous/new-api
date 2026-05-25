# new-api 部署说明

这个目录用于在远端主机上独立部署 `new-api`。默认只监听 `127.0.0.1:3000`，方便先通过 SSH 或 Nginx 内部反代测试，避免提前影响现有 `sub2api` 流量。

## 首次部署

```bash
mkdir -p /root/new-api
cd /root/new-api
cp /path/to/deploy/newapi/docker-compose.yml .
cp /path/to/deploy/newapi/.env.example .env
openssl rand -hex 32
```

把 `.env` 里的 `POSTGRES_PASSWORD`、`REDIS_PASSWORD`、`SESSION_SECRET`、`CRYPTO_SECRET` 都替换成固定随机值，然后启动：

```bash
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:3000/api/status
```

## GitHub Actions 部署

`.github/workflows/deploy-new-api.yml` 会构建当前仓库镜像，推送到 GHCR，然后通过 SSH 更新远端 `/root/new-api` 的 `new-api` 容器。

仓库需要配置这些 GitHub Secrets：

| 名称 | 说明 |
| --- | --- |
| `SSH_HOST` | 远端主机地址 |
| `SSH_PORT` | SSH 端口，未设置时按 `22` |
| `SSH_USER` | SSH 用户，未设置时按 `root` |
| `SSH_KEY` | SSH 私钥 |
| `NEW_API_DEPLOY_DIR` | 部署目录，未设置时按 `/root/new-api` |
| `GHCR_TOKEN` | 可选。GHCR 包是私有时，填有 `read:packages` 权限的 token |

如果 GHCR 镜像是公开的，`GHCR_TOKEN` 可以不填。

## 域名切换

正式切换时建议拆成两个入口：

- `api.dstopology.com` 反代到 `127.0.0.1:3000`，作为用户访问的 `new-api`。
- `llmback.dstopology.com` 反代到 `127.0.0.1:8080`，作为 `sub2api` 管理入口。

`new-api` 和 `sub2api` 都使用 Docker 部署时，`new-api` 渠道上游地址应填 `http://sub2api:8080`。这是容器网络内的服务名，不会经过 Cloudflare 或 Nginx。

当前部署使用 Cloudflare Origin Certificate，需覆盖 `*.dstopology.com`，以便 Cloudflare Full Strict 模式访问 `api.dstopology.com` 和 `llmback.dstopology.com`。
