# Monitor Service & Health Dashboard

Two companion Node.js services for New API monitoring, both read-only against the main PostgreSQL database.

## Monitor Service (`service/`)

Full-featured monitoring dashboard based on [onenov/newapi-monitor-service](https://github.com/onenov/newapi-monitor-service), providing:

- **Dashboard overview** — request count, success rate, active models/users, quota consumption
- **Per-model analytics** — hourly stats, success rate, avg response time, peak hours
- **Key/User/Channel lookup** — usage summary, hourly breakdown, top models
- **Captcha-protected search** — optional Geetest integration for key/channel/user search
- **In-memory cache** — configurable TTL to reduce database load

### Setup

```bash
cd monitor/service
cp .env.example .env   # Edit with your database credentials
npm install
npm run build
npm start
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/dashboard` | Overview stats + hourly chart + top models |
| `GET /api/logs/models` | Model list with usage stats |
| `GET /api/logs?model_name=X` | Per-model detailed stats |
| `GET /api/key/quota?key=X` | Key usage + owner info |
| `GET /api/user/quota?username=X` | User usage stats |
| `GET /api/channel/records?channel_id=X` | Channel usage stats |
| `GET /api/health` | Service health check |
| `GET /api/config` | Site config from upstream New API |

## Health Dashboard (`health/`)

Lightweight channel & model health monitoring dashboard, providing:

- **Channel status cards** — operational/failed/auto-disabled
- **Model availability** — which models are available on which channels
- **Request success rate timeline** — per-channel hourly/daily buckets
- **Availability statistics** — 1d/7d/15d/30d success rate per channel
- **i18n** — Chinese/English, dark/light mode

### Setup

```bash
cd monitor/health
cp .env.example .env   # Edit with your database credentials
npm install
npm run build
npm start
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/overview` | Channel count, model count, avg response time |
| `GET /api/channels` | All channels with status and models |
| `GET /api/models` | Model availability across channels |
| `GET /api/timeline/:channelId?period=7d` | Request success rate timeline |
| `GET /api/availability?period=7d` | Per-channel availability stats |

## Deployment

Both services connect to New API's PostgreSQL database in **read-only** mode. They can be deployed as systemd services, PM2 processes, or Docker containers.

Recommended Nginx configuration:
```nginx
location /monitor {
    proxy_pass http://127.0.0.1:43100;
}
location /monitor/health/ {
    proxy_pass http://127.0.0.1:43200/;
}
```
