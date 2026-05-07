# Production Deployment

This guide deploys `new-api` on an Oracle Linux 9.7 aarch64 instance using Docker Compose, host-installed Caddy, and Cloudflare DNS/TLS.

Production currently deploys from the `prod-config` branch. Keep the Oracle checkout on `prod-config` until the deployment policy intentionally changes.

Expected request path:

```text
Visitor or API client
-> Cloudflare
-> Caddy on Oracle Linux, ports 80/443
-> 127.0.0.1:3000
-> Docker Compose: new-api + PostgreSQL + Redis
```

Only Caddy should be public. `new-api` is bound to localhost, and PostgreSQL/Redis have no public host ports.

## 1. Prerequisites

Expected server state:

- Oracle Linux Server 9.7, aarch64 / ARM64
- SSH user: `opc`
- Repository branch: `prod-config`
- Deployment directory: `/opt/new-api`
- Public hostname example: `router.reangle.app`
- Cloudflare manages DNS for the hostname

Install basic tools if missing:

```bash
sudo dnf install -y git nano curl openssl dnf-plugins-core
git --version
```

If `nano` fails in Ghostty with `Error opening terminal: xterm-ghostty`, run:

```bash
export TERM=xterm-256color
```

You can make that persistent for future SSH sessions:

```bash
echo 'export TERM=xterm-256color' >> ~/.bashrc
source ~/.bashrc
```

## 2. Install Docker And Compose

Install Docker Engine and the Compose plugin:

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and SSH back in after adding `opc` to the `docker` group.

Verify:

```bash
docker --version
docker compose version
```

## 3. Open Required Network Ports

There are two firewall layers:

- Oracle Cloud Infrastructure ingress rules
- Oracle Linux `firewalld` on the instance

In OCI, allow:

```text
22/tcp   SSH, preferably restricted to trusted admin IPs
80/tcp   HTTP for Caddy and ACME certificate challenges
443/tcp  HTTPS for public traffic
```

Do not expose:

```text
3000/tcp  new-api
5432/tcp  PostgreSQL
6379/tcp  Redis
```

On the server, allow HTTP and HTTPS in `firewalld`:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-services
```

Expected output should include `http` and `https`.

## 4. Clone Or Update The Repository

First-time setup:

```bash
sudo mkdir -p /opt/new-api
sudo chown opc:opc /opt/new-api
git clone -b prod-config https://github.com/birdy-nyquiste/new-api.git /opt/new-api
cd /opt/new-api
```

Later updates:

```bash
cd /opt/new-api
git fetch origin
git checkout prod-config
git pull --ff-only origin prod-config
```

## 5. Create The Production `.env`

Create the server-local env file:

```bash
cd /opt/new-api
cp .env.production.example .env
chmod 600 .env
```

Generate four separate secrets:

```bash
openssl rand -hex 32  # POSTGRES_PASSWORD
openssl rand -hex 32  # REDIS_PASSWORD
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CRYPTO_SECRET
```

Edit `.env`:

```bash
nano .env
```

If using Ghostty and `nano` fails:

```bash
export TERM=xterm-256color
nano .env
```

Replace every `change-me` value. Use different values for:

```env
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
SESSION_SECRET=...
CRYPTO_SECRET=...
```

After changing passwords, update the matching connection strings:

```env
SQL_DSN=postgresql://newapi:<same-postgres-password>@postgres:5432/new-api
REDIS_CONN_STRING=redis://:<same-redis-password>@redis:6379/0
```

Set redirect trust to the production domain:

```env
TRUSTED_REDIRECT_DOMAINS=reangle.app
```

Keep these production-safe defaults:

```env
NEW_API_BIND_ADDRESS=127.0.0.1
NEW_API_HOST_PORT=3000
PORT=3000
SESSION_COOKIE_SECURE=true
TRUSTED_PROXIES=127.0.0.1/8,::1
```

If a generated database or Redis password contains reserved URL characters, URL-encode it in `SQL_DSN` or `REDIS_CONN_STRING`. Hex strings from `openssl rand -hex 32` do not need URL encoding.

Validate Compose can read the env file:

```bash
docker compose -f docker-compose.prod.yml config
```

## 6. Start Docker Compose

Start or rebuild the stack:

```bash
cd /opt/new-api
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Verify the app directly on localhost:

```bash
curl http://127.0.0.1:3000/api/status
```

Use `curl` without `-I` here. `curl -I` sends a `HEAD` request, and this app may return `404` for `HEAD /api/status` even when `GET /api/status` works.

Useful logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 new-api
docker compose -f docker-compose.prod.yml logs -f new-api
```

## 7. Install And Configure Caddy

Caddy runs directly on the Oracle host, not in Docker Compose.

Install Caddy:

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf copr enable @caddy/caddy -y
sudo dnf install -y caddy
sudo systemctl enable --now caddy
caddy version
```

Copy the repo template:

```bash
cd /opt/new-api
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

In `/etc/caddy/Caddyfile`:

- Replace `api.example.com` with the production hostname, for example `router.reangle.app`.
- Replace `admin@example.com` with your ACME certificate notification email.
- Keep `reverse_proxy 127.0.0.1:3000` unchanged.

Validate and reload:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Check that Caddy is listening:

```bash
sudo ss -lntp | grep -E ':80|:443'
```

Expected: `caddy` listening on `*:80` and `*:443`.

Check Caddy logs:

```bash
sudo journalctl -u caddy -n 100 --no-pager
```

## 8. Configure Cloudflare

In Cloudflare, create the DNS record:

```text
Type: A
Name: router
Content: <Oracle public IPv4 address>
Proxy status: DNS only
TTL: Auto
```

Use `DNS only` first. This makes Caddy certificate issuance easier to debug.

From your local machine, verify DNS:

```bash
dig router.reangle.app
```

Verify HTTP reaches Caddy:

```bash
curl -Iv --max-time 20 http://router.reangle.app
```

Expected: Caddy returns a redirect to HTTPS, usually `308 Permanent Redirect`.

Verify HTTPS reaches Caddy:

```bash
curl -Iv --max-time 20 https://router.reangle.app
```

If this hangs at `Trying <ip>:443`, check OCI ingress for `443/tcp`, `firewalld`, and whether Caddy is listening on `443`.

After HTTPS works with DNS-only:

1. In Cloudflare DNS, change the record to **Proxied**.
2. In **SSL/TLS → Overview**, set encryption mode to **Full (strict)**.
3. Do not use **Flexible** mode.

Verify through Cloudflare:

```bash
curl -i https://router.reangle.app/api/status
```

Expected:

- HTTP `200`
- JSON body with `"success":true`
- `cf-cache-status: DYNAMIC`
- `via: 1.1 Caddy`

For API traffic, add a Cloudflare cache rule:

```text
If hostname equals router.reangle.app
Then bypass cache
```

Keep WAF managed rules enabled. Add stricter rules, Managed Challenge, or rate limiting only after you understand expected traffic. Avoid aggressive rate limits during first rollout.

## 9. Complete The App Setup Wizard

Open:

```text
https://router.reangle.app
```

Complete the setup wizard.

After setup, immediately set the app server address in the admin settings:

```text
Server Address = https://router.reangle.app
```

This matters for redirects, OAuth, passkeys, payment callbacks, and generated API links. Before this is changed, `/api/status` may show defaults such as:

```json
"server_address": "http://localhost:3000"
```

If setup/login flow returns `429`, clear in-memory counters by restarting `new-api`:

```bash
cd /opt/new-api
docker compose -f docker-compose.prod.yml restart new-api
```

If `429` persists during first rollout, temporarily relax the web rate limit in `.env`:

```env
GLOBAL_WEB_RATE_LIMIT_ENABLE=false
```

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Alternative looser limit:

```env
GLOBAL_WEB_RATE_LIMIT_ENABLE=true
GLOBAL_WEB_RATE_LIMIT=300
GLOBAL_WEB_RATE_LIMIT_DURATION=180
```

Then restart:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 10. Operations

Stop the stack:

```bash
cd /opt/new-api
docker compose -f docker-compose.prod.yml down
```

Start it again:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Rebuild after code or Dockerfile changes:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Follow logs:

```bash
docker compose -f docker-compose.prod.yml logs -f new-api
```

Reload Caddy after changing `/etc/caddy/Caddyfile`:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Back up at minimum:

- Docker volume `new-api-prod_new_api_pg_data`
- Docker volume `new-api-prod_new_api_redis_data`
- `/opt/new-api/.env`
- `/etc/caddy/Caddyfile`

Do not run `docker compose down -v` unless you intentionally want to delete PostgreSQL/Redis/app data volumes.

## 11. Troubleshooting

| Symptom | What to check |
| --- | --- |
| `git: command not found` | Run `sudo dnf install -y git`. |
| `Error opening terminal: xterm-ghostty` | Run `export TERM=xterm-256color`, then retry `nano`. |
| `curl -I http://127.0.0.1:3000/api/status` returns `404` | Use `curl http://127.0.0.1:3000/api/status`; `-I` sends `HEAD`. |
| Local app works, public HTTP times out | Check DNS, OCI ingress for `80/tcp`, firewalld, and Caddy listener. |
| Public HTTP works, public HTTPS times out | Check OCI ingress for `443/tcp`, firewalld `https`, and `sudo ss -lntp | grep -E ':80|:443'`. |
| Caddy ACME challenge fails | Keep Cloudflare DNS record as DNS-only, ensure port `80` is public, then reload Caddy. |
| Cloudflare `525` | TLS handshake failed between Cloudflare and Caddy; check Caddy certs, status, and logs. |
| Cloudflare `526` | Origin certificate invalid or Full strict enabled before Caddy had a valid cert. |
| Public HTTPS fails but `curl http://127.0.0.1:3000/api/status` works | Inspect Caddy, Cloudflare, OCI ingress, and firewalld rather than Docker Compose. |
| Caddy reload fails | Run `sudo caddy validate --config /etc/caddy/Caddyfile` and `sudo journalctl -u caddy -n 100 --no-pager`. |
| Browser gets `429` after setup | Restart `new-api`; if needed, temporarily relax `GLOBAL_WEB_RATE_LIMIT_*` in `.env`. |

The Caddyfile uses Cloudflare's published IP ranges as static trusted proxies because the standard packaged Caddy does not include the optional dynamic Cloudflare trusted-proxy module. If Cloudflare changes its ranges, update `/etc/caddy/Caddyfile` from `deploy/caddy/Caddyfile`.
