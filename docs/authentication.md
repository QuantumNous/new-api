# User authentication and login session

Panel authentication uses a combination of short-term Access Token, HttpOnly Refresh Cookie and server-side login session control plane. Panel requests no longer rely on Gin session, and no longer require the `New-Api-User` request header.

## Authentication model

- Access Token is a JWT valid for 15 minutes. It is only stored in the browser memory and sent through `Authorization: Bearer <token>`.
- Refresh Token is a random opaque value and is valid for up to 30 days. The browser only holds it through the `HttpOnly` and `SameSite=Strict` cookies; the server only saves the HMAC digest and rotates it every time it is refreshed.
- `new_api_has_session` is the session prompt of the Refresh Cookie. The value is always `1`, `Path=/`, non-`HttpOnly`. It is written at the same time, cleared at the same time, and has the same expiration time as the Refresh Cookie. It only declares that "Refresh Cookie has been issued", does not contain any credentials, and does not participate in any authentication judgment; the only effect of forging it is to pay for a refresh that is destined to fail. The reason for its existence is that the Refresh Cookie is double restricted by `HttpOnly` and `Path=/api/user/auth`. The page on `/` cannot determine whether it is anonymous. Otherwise, a refresh destined to 401 will be sent every cold start, and this request will also occupy the `CriticalRateLimit` quota counted by IP.
- `user_sessions` is the login session control plane, recording device, IP, login method, last active time, expiration time and revocation status. Session state in the database is final authority; revocation propagation speed depends on the Redis topology described below.
- When there is a security-related change to a user's password, status, role, or security factor, `auth_version` is incremented and old login sessions are invalidated. Group upgrades and downgrades caused by subscriptions only refresh the authorization cache and will not log out of any logged-in device.
- Redis cache saves user authentication snapshots and login session snapshots. Version fence and revocation tombstone prevent old cache reauthorization; Session snapshot uses short TTL following `SYNC_FREQUENCY`, falling back to database verification when cache misses or Redis is not enabled.

`SESSION_SECRET` Different-purpose keys used to derive Access Tokens, Security Proofs, Refresh Token digests, and AuthFlow digests. Production environments and multi-node deployments must configure the same high-strength random value on all nodes; replacing this value will invalidate all existing logins, temporary authentication processes, and Security Proof.

## Multi-node Redis topology

Multi-node deployments must share the same master database. Login sessions, account-level active session upper limits, and issuance window counts are all authoritative to the database, so these limits take effect globally across application nodes. The Session Hash in Redis (including `revoking`/`revoked` tombstone) is just a cache, and its TTL is the smaller value of the remaining life of the Session and the effective `SYNC_FREQUENCY`; the default and illegal value fallback of `SYNC_FREQUENCY` is `60` seconds. The read cache will not be renewed and will be returned to the source database by SID after expiration. An active cache writeback that completes lazily can only use the TTL that its database observation window has not yet consumed and cannot be restarted for a full cache cycle after the undo tombstone expires.

| Redis deployment method | Session state propagation | Current limiting semantics |
| --- | --- | --- |
| All nodes share Redis | Normal revocation and version release are propagated instantly through the same cache | Redis current limit is shared among all nodes |
| Each node uses independent Redis | At the latest, the source converges after the node Session cache TTL expires, that is, it does not exceed the effective `SYNC_FREQUENCY`; During version rotation, the new Token may briefly return 401 on the node holding the old cache | Each node is counted independently, and the total cluster scale is at worst approximately the single node threshold multiplied by the number of nodes |
| Not using Redis | Read the database directly for each session verification | Use the memory current limiter of each node, and the quota is also independent by node |

The larger the `SYNC_FREQUENCY`, the longer the stale window for a standalone Redis deployment; the smaller the value, the more frequently each active SID is returned to the origin database on each node. Under the default configuration, each node of a continuously active Session will add a database primary key check at most every 60 seconds. Undo tombstones and version releases remain instantaneous when sharing Redis.

All nodes must use the same `SESSION_SECRET`. When multiple nodes connect to the same Redis, the same `CRYPTO_SECRET` must also be used, otherwise the cache key digest generated by the nodes is inconsistent and the cache cannot be shared correctly. The above guarantee only covers the bounded stale semantics of login session authentication; the current limit and other Redis caches will still be affected by the Redis topology, and it cannot be considered that the entire control plane is independent of the topology.

## Browser interface

After successful login, password login, 2FA, Passkey, OAuth, WeChat and Telegram login all return unified data:

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "token_type": "Bearer",
    "access_expires_at": 1730000000,
    "user": {},
    "session": {
      "sid": "...",
      "current": true,
      "login_method": "password",
      "ip": "...",
      "user_agent": "...",
      "created_at": 1730000000,
      "last_active_at": 1730000000,
      "expires_at": 1732592000
    }
  }
}
```

Session related interface:

| Interface | Authentication | Purpose |
| --- | --- | --- |
| `POST /api/user/auth/refresh` | Refresh Cookie; Secure mode appends Origin verification | Rotate Refresh Token and issue new Access Token |
| `POST /api/user/auth/logout` | Refresh Cookie; Secure mode attaches Origin verification and can carry Bearer at the same time | Revoke the current login session and clear Cookies |
| `GET /api/user/sessions` | Bearer | View valid login sessions of the current authentication version, the current session takes priority, up to 100 entries |
| `DELETE /api/user/sessions/:sid` | Bearer | Revoke the specified login session, including the current session |
| `POST /api/user/sessions/revoke-others` | Bearer | Keep current session and revoke other sessions |

`X-Auth-Session: <sid>` should be sent in the refresh/logout request when the client already has a session in memory. When the Refresh Cookie is inconsistent with the SID, both endpoints will return `409 AUTH_SESSION_MISMATCH` and will not rotate, revoke or clear any session; the client first clears the old SID of this tab through refresh, restores the session currently corresponding to the Cookie, and then tries logout again. This request header can be omitted when there is no memory session during cold start.

When the same Refresh Token is used concurrently, the server restores the same successor Token through deterministic rotation, and multiple browser tabs will not be forced to exit due to the loss of the "winner" response. If the latest generation Refresh Token appears again after the short fault tolerance window, the corresponding session will be revoked; unrecognized earlier generation or random Token will only be rejected, and attackers will not be allowed to kick out the session based on guesswork.

The front end uses Web Locks to serialize refreshes within the same browser profile and synchronizes only the session ID and login/exit events via BroadcastChannel (fallback to `storage` events when not supported); neither the Access Token nor the Refresh Token are passed via cross-tab messaging or persisted to Web Storage.

The front end manages cold start status and login status separately. Temporary network or server failures allow subsequent navigation to retry refresh; the server enters the completed anonymous state only after confirming that the Refresh Cookie is invalid. When the memory SID is inconsistent with the cookie SID, the client clears the old memory identity and tries again without carrying the old SID.

The cold start of the public page will read `new_api_has_session` first: skip refresh when the prompt does not exist and there is no identity in the memory, directly press anonymous rendering, and do not record this skip as a completed anonymous judgment - skipping is just a delay, not a server-side conclusion. The location of the jump (protected route and login page) will be made based on the authentication result without any prompts. When the memory is empty, it will always return to the source. Therefore, users whose prompts are missing but whose Refresh Cookie is valid (sessions established before the cookie went online, or browsers that only cleared the `/` site data) will appear anonymous on the public page, and will be automatically restored to the logged-in state when entering any of the above locations without the need to re-enter their password. When the prompt expires due to server withdrawal, the refresh returns 401 and clears the prompt in the same response. The wasted request only occurs once.

## Session issuance quota and retention policy

The server implements two-level account restrictions at the unified Session issuance outlet for all login methods:

- `USER_SESSION_ACTIVE_LIMIT` (default `50`): the upper limit of sessions for a single user that have not expired and are active. When the upper limit is reached, new logins return `409 AUTH_SESSION_LIMIT`.
- `USER_SESSION_ISSUANCE_LIMIT` (default `100`) and `USER_SESSION_ISSUANCE_WINDOW_SECONDS` (default `86400`): All sessions created by the user in the statistics window, including records of revoked and old authentication versions. Returns `429 AUTH_SESSION_ISSUANCE_LIMIT` when the upper limit is reached.
- These two counts and insertions do not include cross-database locks; extreme concurrent logins may cause a small amount of overage, but if the count fails, the issuance will be refused and the release will not be downgraded.

Accounts that have exceeded the active limit at the time of upgrade will not be automatically offline or have their old sessions squeezed out; the restriction will only apply to subsequent issuance of new sessions.

`USER_SESSION_REVOKED_RETENTION_DAYS` (default `7`) controls the audit retention period for revoked rows. Rows within the issuance count dependent window still exist, so the issuance window must not exceed the revoked retention period. If the configuration is exceeded, an alarm will be recorded at startup and the actual window will be clamped to the retention period to avoid deleting the revoked row in advance and causing the current limit count to be underestimated.

Even if `expires_at` is found to have expired during scheduled cleaning, rows of `created_at` that still fall within the actual issuance window will not be deleted; revoked records that have not yet reached the revoked retention period will also continue to be retained. This way expiration cleanup will not silently weaken the issue count or audit retention when the configuration window is expanded.

The active number will be included in the abnormal residual rows whose status is still active but `user_auth_version` has expired, and the device list only displays the current authentication version. Therefore, when encountering `AUTH_SESSION_LIMIT`, you should first perform "Revoke other sessions" on the device that is still logged in. This operation will also clean up the invisible old version active row; when there is no available device, you can use password reset to revoke all sessions. Password reset does not clear the issuance window count.

Only the master node deletes expired Sessions and revoked Sessions that have exceeded the retention period in batches every hour. `USER_SESSION_HOURLY_ALERT_THRESHOLD` (default `5000`) only records an alarm when the global issuance volume is abnormal in the last hour, and does not form a site-wide login rejection switch that can be abused.

## Origin verification of Refresh/Logout

The Origin protection of refresh/logout is bound to the Secure mode of Refresh Cookie:

- When `SESSION_COOKIE_SECURE` is not configured or explicitly set to `false`, the Refresh cookie is available for local HTTP, OriginGuard for refresh/logout is turned off, and `SESSION_COOKIE_TRUSTED_URL` must not be configured. This allows the Rsbuild/Vite development agent on a different port on `http://localhost` to forward requests normally. This mode is only used in trusted local development environments and should not be exposed to the public network.
- `SESSION_COOKIE_SECURE=true`, the Refresh cookie is only sent over HTTPS with strict OriginGuard enabled. `POST /api/user/auth/refresh` and `POST /api/user/auth/logout` will verify the browser's `Origin`; when `Origin` is missing, only a legal single `Referer` will be accepted as a fallback. Allowed origins include the exact Origin of the request itself, as well as the exact Origin configured in `SESSION_COOKIE_TRUSTED_URL`.

Origin verification in Secure mode does not trust the `X-Forwarded-Proto` sent directly by the client. TLS On reverse proxy termination, the panel's public HTTPS Origin should be explicitly written to `SESSION_COOKIE_TRUSTED_URL`.

`SESSION_COOKIE_TRUSTED_URL` now has explicit new semantics: it is a list of trusted Origins for refresh/logout cookie endpoints, not a CORS whitelist. The configuration rules are as follows:

- Only configured when `SESSION_COOKIE_SECURE=true`; multiple values are separated by commas.
- Each item must be an exact HTTPS Origin, such as `https://panel.example.com` or `https://panel.example.com:8443`.
- Wildcard, path, query parameter, user information or domain name suffix matching is not accepted.
- Does not modify the CORS behavior of relay, old billing dashboard, `/api/usage/token` or `/api/log/token`. The scenario where the browser uses the `sk-` key to directly connect to the relay remains unchanged.

Local HTTP development example (OriginGuard turned off):

```env
SESSION_SECRET=<local-random-value>
SESSION_COOKIE_SECURE=false
# SESSION_COOKIE_TRUSTED_URL must not be set
```

Production HTTPS example (OriginGuard on):

```env
SESSION_SECRET=<high-entropy-random-value>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://panel.example.com,https://admin.example.com
```

This switch only controls the OriginGuard of the Refresh Cookie and refresh/logout panels and does not modify the CORS behavior of relay, old billing dashboard, `/api/usage/token` or `/api/log/token`.

## Trusted proxy and IP current limiting

By default, Gin will trust all client IP request headers provided by proxies. This project is changed to a three-state configuration that takes into account common anti-generation topology and public network direct connection security:

- An `TRUSTED_PROXIES` that is not configured, an empty string, or is simply blank trusts `127.0.0.0/8`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `fc00::/7` by default, and outputs a startup warning. This default value covers Nginx, Docker Compose and common intranet reverse generation on the same machine; the public network direct connection address is not in the list, and its forged `X-Forwarded-For` will be ignored.
- `TRUSTED_PROXIES=none` (case-insensitive and must be used alone) enables strict direct mode and does not trust any proxy, `ClientIP()` uses only TCP direct addresses.
- Other non-null values are parsed by commas as proxy IP/CIDR and completely replace the default list. The address of the reverse proxy itself should be filled in instead of the client network segment; an illegal CIDR, an empty list, or mixing `none` with other values ​​will prevent the service from starting.

Gin only parses the client IP request header when the direct source of the request belongs to a trusted proxy, and looks for the first untrusted address from the right side of the forwarding chain to the left. Therefore, the common public client address in the Nginx `$proxy_add_x_forwarded_for` chain will prevent the forged prefix on the left from taking effect. The residual risk of trusting the private network by default is that other machines or containers with direct access to the application from the same private network can still forge these request headers; to eliminate this risk, you should use `none` or configure a precise proxy address.

Redis current limiting uses atomic Lua fixed windows to replace the old approximate sliding window List implementation. This is an intentional semantic change: both sides of the window boundary can be filled once each, and the maximum throughput in a very short time is approximately twice the configured value. For example `20 times/20 minutes` will allow about 40 passes at the boundary. The account-level Session upper limit and issuance window continue to control database growth; if boundary bursts need to be strictly suppressed in the future, they need to be separately migrated to the ZSET sliding window.

The original Redis List approximate sliding window is still used for successful user-level model request current limiting, but the list timestamp is uniformly written as UTC. During the rolling upgrade, the local time string written by the old node and the UTC string written by the new node cannot be distinguished in format, and may be temporarily mistakenly released or mistakenly rejected within a model current limiting window. All nodes will naturally converge after the upgrade is completed and a full window has passed; this upgrade will not switch keys or actively delete existing lists.

Open registration will still be protected by Critical IP throttling, but distributed IP multi-account attacks cannot be prevented by IP throttling alone. The deployment of public network open registration should enable Turnstile and email verification at the same time; stronger equipment or multi-dimensional risk control needs to be designed as an independent security project.

## PAT call contract

Panel PAT (Personal Access Token) is sent via `Authorization: Bearer <pat>`, also compatible with single value `Authorization: <pat>`; does not accept URL parameters. `New-Api-User` does not participate in authentication.

- The token format is `nap_` plus a 43-bit base62 random string (about 256 bit). The clear text is returned only once at creation time, and the database only saves the SHA-256 digest, which also serves as the `token_ref` in the audit record.
- Each user has a maximum of 20 tokens, stored in the `user_access_tokens` table. The scope and expiration time must be selected when creating: the default is 30 days, the minimum is 1 hour, and it is also allowed to never expire (the interface will prompt the risk). Expired tokens become invalid immediately and will be cleared by the master node after the retention period.
- scope is in the shape of `resource:action`. Personal permissions (data, API tokens, usage, wallet, account security) and some backend permissions are defined by the token directory; backend permissions protected by Casbin directly reuse the resources and actions of the administrator permission matrix. You can only grant the permissions you currently have, and each request will re-read roles and permissions: after revoking an administrator permission, the token carrying the scope will immediately lose its corresponding capabilities.
- Each panel route must declare the required scope. Undeclared routes are always rejected (403 `ACCESS_TOKEN_ROUTE_UNDECLARED`), insufficient scope returns 403 `ACCESS_TOKEN_SCOPE_DENIED`, and token expiration returns 401 `ACCESS_TOKEN_EXPIRED`.
- PAT cannot create, rename, or revoke PAT, nor can it manage login sessions; these interfaces only accept browser login sessions.
- PAT can complete secondary verification, Proof is bound to the token, and the token must hold the scope corresponding to the operation: `channel.key.read` requires `channel:secret_view`, `admin.user.*` requires `user:write`, and my password, 2FA, Passkey, account binding and logout require `account_security:write`. PAT cannot use OAuth authentication.
- Security changes done via PAT (e.g. password change, 2FA, Passkey) take all browser login sessions for that user offline, while the token itself remains available.
- While a user is disabled, all his or her tokens will be unavailable and will be restored after re-enablement; when a user is logged out or deleted, his or her tokens will be deleted.
- Last used time and IP Each token is updated at most once per minute; failure to update does not affect the request.

## Temporary authentication process and secondary verification

Temporary states such as OAuth state, 2FA pending, Passkey ceremony, Telegram bind, etc. are stored in `auth_flows`. The client only holds random `flow_token`, and the database only saves the HMAC digest; the process has purpose, provider, intent, user and login session bindings, and can only be consumed atomically once. The affiliate code registered with OAuth is also saved with the AuthFlow login.

The standard OAuth binding callback is handed to the opener by the popup through the same origin `postMessage`; only the opener calls the backend binding interface using the Bearer in its own memory. Telegram binding is first created by the logged-in front-end to bind AuthFlow, and then the widget callback carries the `flow_token` in the path. During the callback, it will reconfirm that the original login session is still valid. Telegram's signed widget assertion will also be registered as a one-time credential, and repeated playback will be rejected.

Sensitive operations use `X-Security-Proof` valid for 1 minute:

- `channel.key.read`: View channel key;
- `passkey.register`: Register Passkey;
- `passkey.delete`: Delete Passkey.

High-risk operations performed by administrators on other users also require Proof, and the context of the scope is bound to the user being operated on. Proof issued to a user cannot be reused for another user or another action:

- `admin.user.delete` (`{"user_id"}`): `delete` of `DELETE /api/user/:id` and `POST /api/user/manage`;
- `admin.user.manage` (`{"user_id","action"}`, action is `disable` / `enable` / `promote` / `demote`): `POST /api/user/manage`; amount adjustment `add_quota` does not require Proof;
- `admin.user.update` (`{"user_id"}`): `PUT /api/user/` is required when the request contains a new password or `admin_permissions`; only modifying the display name, grouping, and remarks is not required;
- `admin.user.create` (`{"role"}`): `POST /api/user/` is required when creating an administrator role; not required when creating an ordinary user;
- `admin.user.passkey.reset`（`{"user_id"}`）：`DELETE /api/user/:id/reset_passkey`；
- `admin.user.2fa.disable`（`{"user_id"}`）：`DELETE /api/user/:id/2fa`；
- `admin.user.binding.clear` (`{"user_id","binding_type"}` or `{"user_id","provider_id"}`): `DELETE /api/user/:id/bindings/:binding_type` and `DELETE /api/user/:id/oauth/bindings/:provider_id`.

These `admin.user.*` scopes are only issued to administrators and above; administrators who have enabled 2FA or Passkey must use one of them. When not enabled, they fall back to password (or bound OAuth) re-authentication; password verification is not accepted when password login is turned off. When calling the above interface through PAT, the token needs to hold `user:write` and complete secondary verification; old version tokens cannot be called.

Proof is bound to the user, login session, user authentication version, session version and scope at the same time and cannot be reused across users, sessions or purposes. For PAT, the "login session" that Proof is bound to is the token itself.

When a user with 2FA enabled registers Passkey, both register begin and finish must carry a valid `passkey.register` Proof; finish will re-verify the Proof before consuming one-time AuthFlow. This request header is not required for first-time Passkey registration without 2FA enabled.

## Upgrade Notes

- The old `session` cookie is no longer used; after the upgrade, the existing panel login will become invalid and the user needs to log in again.
- Database migration will add `user_sessions`, `auth_flows`, `external_identity_claims` and `users.auth_version`, initialize the authentication version for existing users, and backfill the unique ownership of the Telegram account; if the same Telegram ID in the historical data has been bound to multiple users, the migration will refuse to continue and the ambiguity needs to be eliminated first.
- Database migration will add new indexes for Session issuance count and batch cleaning; when the existing `user_sessions` is large, a maintenance window should be reserved for the first startup.
- `user_sessions.previous_refresh_hash` will be migrated from fixed-length `char(64)` to `varchar(64)`. The application will be compatible with filling spaces left by reading historical fixed-length fields; the target structure after migration must remain idempotent, and column type changes should not be repeatedly performed during continuous startup.
- Only the master node regularly cleans up expired login sessions, revoked sessions that have exceeded the configured retention period, and AuthFlow that has expired the retention period.
- Trust loopback and common private network proxies are compatible when `TRUSTED_PROXIES` is not configured; deployments using public network load balancers, `100.64.0.0/10`, link-local addresses, or custom CNI segments still require explicit configuration. Set to `none` when all forwarding headers need to be strictly ignored.
- Redis current limiting is changed from an approximate sliding window to an atomic fixed window, and there is a clear boundary double burst semantics.
- The UTC timestamp of the user-level model's successful request for throttling has a window of mixed format transition during the rolling upgrade, during which the UTC timestamp may be temporarily released or rejected by mistake.
- Self-built clients should be upgraded according to the new AuthBundle, `flow_token` and Security Proof contracts; PAT clients can directly remove `New-Api-User`.
- The old version of PAT remains in `users.access_token` and is available as usual for 30 days from the first launch of the new version, after which it is automatically deactivated and returns 401 `ACCESS_TOKEN_LEGACY_RETIRED`. The deactivation date is recorded in `LegacyAccessTokenRetireAt` of the `options` table, written by the server, and cannot be modified through the setting interface. Older tokens cannot be generated during the transition period, but they can be revoked.
- Removed the `/api/user/token*` interface and changed it to `/api/user/access_tokens`.
- After downgrading to an older version, new tokens will not be available; unrevoked older version tokens will be available again because the old version does not recognize deactivation dates.
