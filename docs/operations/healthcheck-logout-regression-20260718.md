# 健康检查 / 登出回归报告

- **时间：** 2026-07-18（复检补强 10:53 UTC+8 附近）
- **入口：** `https://incc.qzz.io` / `D:\newapi`
- **生产进程：** PID **19984**，启动 2026-07-18T18:39:47
- **二进制 revision：** `33be725d327813816d791d9d55a8a0d761a5566e`（与 `src` HEAD 一致，`vcs.modified=false`）
- **SHA-256：** `7a71b9280dd3b19cae11794d5ff10cb84b69871e66f5b0bd3a4879a182f4fc4d`
- **版本串：** `v1.0.0-rc.21-41-g33be725d`

---

## 1. 版本一致性

| 检查项 | 结果 |
|--------|------|
| 生产 exe revision | `33be725d…` |
| 源码 HEAD | `33be725d…` |
| 匹配 | **是** |
| dirty | false |

---

## 2. 本机探针（127.0.0.1:3000）

| 路径 | 期望 | 实际 | 说明 |
|------|------|------|------|
| `/livez` | 200 JSON | **通过** | 无 HSTS（纯 HTTP 预期） |
| `/readyz` | 200 JSON | **通过** | |
| `/healthz` | 200 JSON | **通过** | |
| `/api/status` | 200 JSON | **通过** | |
| `/v1/models` | 401 | **通过** | 无 Token |
| `/metrics` | 404 非 HTML | **通过** | SPA 不再吞路径 |
| `/frontend-healthz` | 404 非 HTML | **通过** | |
| `/api/user/logout` | 200 JSON | **通过** | |
| `/sign-in` | 200 HTML | **通过** | `lang=zh-CN` |
| `/console` | 200 HTML | **通过** | SPA |
| `/livez` + `X-Forwarded-Proto: https` | HSTS | **通过** | `max-age=15768000` |

---

## 3. 公网探针（https://incc.qzz.io）

| 路径 | 结果 | 说明 |
|------|------|------|
| `/livez` | **200** + HSTS | 稳定 |
| `/readyz` | **200** + HSTS | 稳定 |
| `/api/user/logout` | **200** + HSTS | 稳定 |
| `/oauth/github` | **200** HTML + HSTS | SPA 回调壳 |
| `/api/oauth/state` | **200** JSON + HSTS | |
| `/metrics` | **404** JSON 非 HTML | 通过 |
| `/api/status` GET | **200**（重试后） | 偶发 CF/`RemoteDisconnected`/403 挑战；**本地同源始终 200** |
| `/sign-in` GET | **200**（重试后） | 同上，偶发边缘抖动 |
| `http://incc.qzz.io/` | **301 → https://incc.qzz.io/** | `curl -sSI` 确认 |

**说明：** `curl -sI`（HEAD）对部分 API 可能返回 404，属 **HEAD 未实现/未路由**，不能当作 GET 失败；GET 体正常返回 JSON。

### 公网/本地 status 字段（GET）

| 字段 | 值 |
|------|-----|
| version | `v1.0.0-rc.21-41-g33be725d` |
| server_address | `https://incc.qzz.io` |
| github_oauth | true / `Ov23liURGuQ4SZgvLGGq` |
| passkey_rp_id | `incc.qzz.io` |
| passkey_origins | `https://incc.qzz.io` |
| passkey_allow_insecure | false |
| theme | default |

---

## 4. 登出回归

| 检查 | 结果 |
|------|------|
| `GET /api/user/logout` | 200 `{"success":true}` |
| Set-Cookie | `session` **Max-Age=0; Secure; HttpOnly; SameSite=Strict; Path=/** |
| 前端版本 | 含 `33be725d` 登出抑制 Session expired + `location.replace('/sign-in')` |
| 日志样本 | 可见 `GET /api/user/logout` 后 `GET /sign-in` |

**未做：** 持真实登录 Cookie 的浏览器 UI 全自动点退（需人工 30 秒确认）。

---

## 5. 基础设施

| 项 | 结果 |
|----|------|
| 防火墙 Block TCP 3000 | Enabled / Block |
| Cloudflared | Running，进程 1 |
| SQLite 备份任务 | Ready；上次 11:02:10 result=0；下次 03:30 |
| 最新备份 | `one-api-20260718-110210.db` 26.9MB |

---

## 6. 源码门禁

| 门禁 | 结果 |
|------|------|
| `go test ./router` | pass |
| `go test ./middleware` | pass |
| `go test -tags frontend_external .` | pass |

---

## 7. 总判定

| 类别 | 判定 |
|------|------|
| 核心健康（livez/readyz/本地 status/鉴权边界/metrics 404） | **通过** |
| 登出 Cookie 过期语义 | **通过** |
| HSTS | **通过**（公网 + 反代头） |
| 公网个别 GET 偶发断开/403 | **边缘/挑战抖动**，非进程宕机；本地直连正常 |
| 完整 UI 登出手测 | **待用户点一次** |

**总体：生产健康，可继续使用。** 若 UI 登出仍异常，带截图/文案再开一轮。
