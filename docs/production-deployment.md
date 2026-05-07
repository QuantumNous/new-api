# Production Deployment

This repo now includes a production-oriented Docker Compose stack for an Oracle Linux 9 aarch64 host. It builds the app from the local source tree, runs `new-api`, PostgreSQL, and Redis, and binds the app only to `127.0.0.1:3000` for host Caddy.

Production currently deploys from the `prod-config` branch. Keep the Oracle checkout on `prod-config` until the deployment policy intentionally changes.

The expected public path is:

```text
Visitor -> Cloudflare -> Caddy on host -> 127.0.0.1:3000 -> new-api -> PostgreSQL / Redis
```

## 0. Oracle Linux Host Prep

On Oracle Linux 9, install Docker Engine with the Compose plugin if it is not already installed:

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in after adding your user to the `docker` group.

Allow public web traffic both in Oracle Cloud Infrastructure security rules and on the instance firewall:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 1. Prepare Secrets

Clone or update the production checkout:

```bash
sudo mkdir -p /opt/new-api
sudo chown opc:opc /opt/new-api
git clone -b prod-config https://github.com/birdy-nyquiste/new-api.git /opt/new-api
cd /opt/new-api
```

For later updates:

```bash
cd /opt/new-api
git fetch origin
git checkout prod-config
git pull --ff-only origin prod-config
```

Create the server-local `.env`:

```bash
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

Edit `.env` and replace every `change-me` value. Use different values for `SESSION_SECRET`, `CRYPTO_SECRET`, `POSTGRES_PASSWORD`, and `REDIS_PASSWORD`. After changing passwords, update the matching values inside `SQL_DSN` and `REDIS_CONN_STRING`.

Set `TRUSTED_REDIRECT_DOMAINS` to the production domain, for example:

```env
TRUSTED_REDIRECT_DOMAINS=example.com
```

If your generated database or Redis password contains reserved URL characters, URL-encode it in `SQL_DSN` or `REDIS_CONN_STRING`. Hex strings from `openssl rand -hex 32` do not need URL encoding.

## 2. Start The Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:3000/api/status
```

The application container is bound only to `127.0.0.1:3000` on the host. Caddy is the only public service and proxies to that localhost port.

## 3. Caddy And Cloudflare

The bundled Caddyfile template is at `deploy/caddy/Caddyfile`. Install Caddy on the Oracle host, copy this file to `/etc/caddy/Caddyfile`, replace `api.example.com` with your production hostname, replace `admin@example.com` with your ACME notification email, then reload Caddy.

In Cloudflare:

- Create an `A` record for `APP_DOMAIN` pointing to the Oracle instance public IPv4 address.
- For the first Caddy start, keep the DNS record DNS-only if certificate issuance fails through the proxy.
- After Caddy has issued the origin certificate, enable proxying if you want Cloudflare WAF/CDN features.
- Set SSL/TLS mode to `Full (strict)` once the proxied record is enabled.
- Keep ports 80 and 443 reachable from Cloudflare so Caddy can serve traffic and ACME HTTP challenges.

The Caddyfile uses Cloudflare's published IP ranges as static trusted proxies because the standard packaged Caddy does not include the optional dynamic Cloudflare trusted-proxy module. If Cloudflare changes its ranges, update the Caddyfile.

Keep `SESSION_COOKIE_SECURE=true` because users will access the service over HTTPS. `TRUSTED_PROXIES` is set to localhost so the app trusts forwarded headers from host Caddy, not arbitrary public clients.

## 4. First Login Setup

Open the public URL, complete the setup wizard, and immediately set the system server address in the admin panel to the exact public origin, for example:

```text
https://api.example.com
```

This value is used for OAuth callbacks, payment callbacks, passkeys, and generated API links.

## 5. Operations

```bash
# Follow logs
docker compose -f docker-compose.prod.yml logs -f new-api

# Restart after changing .env
docker compose -f docker-compose.prod.yml up -d

# Stop without deleting data
docker compose -f docker-compose.prod.yml down
```

PostgreSQL, Redis, uploaded data, and app logs are stored in named Docker volumes. Back those volumes up before upgrades.
