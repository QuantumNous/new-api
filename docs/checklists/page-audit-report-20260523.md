# Page audit report (visible text + screenshots)

- **Generated:** 2026-05-23T07:54:49.709Z
- **BASE_URL:** http://192.168.18.92:3001
- **Auth:** yes (admin)
- **Screenshots:** `screenshots/`

## Summary

| Metric | Count |
|--------|------:|
| Pages audited | 21 |
| P0 visible term hits | 0 |
| P1 visible term hits | 0 |
| Failed pages | 0 |
| Skipped (auth required) | 0 |
| Skipped (login rate limited) | 0 |

## Pages

| Page | Status | P0 hits | P1 hits | Screenshot | Notes |
|------|--------|--------:|--------:|------------|-------|
| p0-keys | ok | 0 | 0 | `p0-keys.png` | — |
| p0-usage-logs-common | ok | 0 | 0 | `p0-usage-logs-common.png` | — |
| p0-usage-logs-task | ok | 0 | 0 | `p0-usage-logs-task.png` | — |
| p0-usage-logs-drawing | ok | 0 | 0 | `p0-usage-logs-drawing.png` | — |
| p0-wallet | ok | 0 | 0 | `p0-wallet.png` | — |
| p0-system-settings-site-system-info | ok | 0 | 0 | `p0-system-settings-site-system-info.png` | — |
| p1-redemption-codes | ok | 0 | 0 | `p1-redemption-codes.png` | — |
| p1-subscriptions | ok | 0 | 0 | `p1-subscriptions.png` | — |
| p1-models-metadata | ok | 0 | 0 | `p1-models-metadata.png` | — |
| p1-channels | ok | 0 | 0 | `p1-channels.png` | — |
| p1-users | ok | 0 | 0 | `p1-users.png` | — |
| p1-groups | ok | 0 | 0 | `p1-groups.png` | — |
| p1-system-settings-site-notice | ok | 0 | 0 | `p1-system-settings-site-notice.png` | — |
| p1-system-settings-site-header-navigation | ok | 0 | 0 | `p1-system-settings-site-header-navigation.png` | — |
| p1-system-settings-site-sidebar-modules | ok | 0 | 0 | `p1-system-settings-site-sidebar-modules.png` | — |
| p0-dashboard | ok | 0 | 0 | `p0-dashboard.png` | — |
| p0-home | ok | 0 | 0 | `p0-home.png` | — |
| p0-login | ok | 0 | 0 | `p0-login.png` | — |
| p0-pricing | ok | 0 | 0 | `p0-pricing.png` | — |
| p0-rankings | ok | 0 | 0 | `p0-rankings.png` | — |
| p0-about | ok | 0 | 0 | `p0-about.png` | — |

## P0 risk terms scanned

- New API
- QuantumNous
- USD
- dollar
- 美元
- Midjourney
- MJ
- Uptime Kuma
- io.net
- GitHub release
- Open release
- Calcium-Ion
- new-api
- Open in GitHub
- System Settings
- Operation Settings
- Group & Model Pricing

## P1 terms scanned

- API Key
- Token
- Wallet
- Balance
- User
- Channel
- Model
- Provider
- Cost
- Fee
- Prompt
- Fail Reason
- Image Preview
- Playground
- Dashboard

## Failure detection notes

Earlier runs treated any `500` substring in `body.innerText` as a server error. On `/usage-logs/common`, table cells often contain HTTP status codes (e.g. 500), quotas, or timings — that is normal data, not the `/500` error route or an ErrorBoundary. Failed now requires explicit error-page copy (e.g. `Internal Server Error`, `Something went wrong`) or an error title of `500` / `Internal Server Error`. Usage-logs routes pass when expected Chinese column labels are visible (positive matcher).

