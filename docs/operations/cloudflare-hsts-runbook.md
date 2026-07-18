# Cloudflare HSTS 操作说明（控制台，不改应用代码）

- **日期**：2026-07-18  
- **Zone**：`incc.qzz.io`（Zone ID `5809d3b745bd78542b59f0d852a66167`，Account `1f96bc464a296cbf14ed104073ccba08`）  
- **Tunnel**：`incc-newapi` → `http://localhost:3000`  
- **为何本机未自动打开 HSTS**：  
  - Wrangler OAuth token **无** `zone_settings:edit`（读 `security_header` 返回 403 Unauthorized）。  
  - 浏览器自动化打开 `dash.cloudflare.com` 被 **CF 人机验证**拦截。  
- **推荐**：你在已登录的浏览器中按下列点击开启（**不改 new-api 代码、不重启 exe**）。

---

## 推荐参数（对单域名生产站）

| 项 | 建议值 | 说明 |
|----|--------|------|
| Enable HSTS (Strict-Transport-Security) | **On** | 浏览器强制 HTTPS |
| Max Age Header | **6 months**（15768000）或 12 months | 首次可 6 个月，稳定后 12 个月 |
| Apply HSTS policy to subdomains (includeSubDomains) | **Off**（若只有 `incc.qzz.io` 且无子域业务） | 有 `www` 且均 HTTPS 才考虑 On |
| Preload | **Off**（除非你明确要提交 HSTS preload 列表） | 误开会很难撤销 |
| No-Sniff header | 可 On | 与 HSTS 同页常见选项 |

同时确认：

- SSL/TLS → Overview：**Full (strict)**  
- SSL/TLS → Edge Certificates：**Always Use HTTPS = On**（你侧 HTTP 已 301，多半已开）

---

## 点击路径

1. 登录 https://dash.cloudflare.com  
2. 选择站点 **incc.qzz.io**  
3. 左侧 **SSL/TLS** → **Edge Certificates**  
4. 找到 **HTTP Strict Transport Security (HSTS)** → **Enable HSTS**  
5. 按上表设置 → Save  
6. 验证（任选）：

```bash
curl -sSI https://incc.qzz.io/ | findstr /i strict
```

期望类似：

```text
strict-transport-security: max-age=15768000
```

（具体 max-age 以你选的为准；若在 CF 开，头由 CF 注入，源站 new-api 无需改。）

---

## 回滚

同一页面关闭 HSTS 或把 max-age 调为 0；已缓存 HSTS 的浏览器会保留到 max-age 到期。

---

## 自动化缺口（可选后续）

若希望脚本开关 HSTS，创建 **API Token** 权限至少：

- Zone → Zone Settings → Edit  
- Zone → Zone → Read  

绑定 zone `incc.qzz.io` 后：

```http
PATCH /zones/{zone_id}/settings/security_header
```

body 使用 CF 文档中的 `strict_transport_security` 结构。  
**不要**把 token 写进仓库或聊天记录。
