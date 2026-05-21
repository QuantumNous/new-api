# UI audit tooling (`scripts/dev/ui-audit`)

一键本地验收：**健康检查 → 源码旧词扫描 → Playwright 页面截图 + 可见文本扫描 → 汇总报告**。
不修改 `web/default` 业务代码；`reports/`、`screenshots/` **不提交**。

规范：[`UI_REDESIGN_RULES.md`](../../../UI_REDESIGN_RULES.md)、[`UI_REDESIGN_CURSOR_PROMPT.md`](../../../UI_REDESIGN_CURSOR_PROMPT.md)、[`UI_ACCEPTANCE_SCOPE.md`](./UI_ACCEPTANCE_SCOPE.md)。

---

## 一键审计（推荐）

```bash
cd /home/lobster/projects/new-api

# 仅源码扫描 + 公开页（无登录）
bash scripts/dev/ui-audit/run-ui-audit.sh

# 完整验收（登录后 P0/P1 页面）
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/run-ui-audit.sh

# 严格模式：源码 P0 actionable 或 页面 P0 可见命中 或 页面 failed → exit 1
UI_AUDIT_STRICT=1 \
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

### 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `BASE_URL` | `http://192.168.18.92:3001` | 前端 dev 地址 |
| `UI_AUDIT_USERNAME` | 空 | 登录账号（兼容 `DEMO_USERNAME`） |
| `UI_AUDIT_PASSWORD` | 空 | 登录密码（兼容 `DEMO_PASSWORD`） |
| `UI_AUDIT_SKIP_SCREENSHOTS` | `0` | `1` 跳过 Playwright 页面验收 |
| `UI_AUDIT_STRICT` | `0` | `1` 时：源码 P0 actionable **或** 页面 P0 可见命中 **或** 页面 `failed` → exit 1 |

### 产出

| 文件 | 说明 |
|------|------|
| `reports/legacy-terms-report.md` | 源码扫描摘要 |
| `reports/legacy-terms-full.tsv` | 源码全量命中 |
| `reports/scan-meta.env` | 源码 P0/P1/P2 计数 |
| **`reports/page-audit-report.md`** | **页面可见文本 + 截图验收** |
| **`reports/page-audit-full.tsv`** | 页面级 TSV |
| `reports/page-audit-meta.env` | 页面 P0/P1 命中数、failed 数 |
| `reports/ui-audit-summary.md` | 一键汇总 |
| `reports/screenshot.log` | Playwright 日志 |
| **`screenshots/*.png`** | 按页命名，如 `p0-home.png`、`p1-channels.png` |

### 无登录时行为

仍会对公开页截图并扫描：

- `/`、`/sign-in`（及 `/login` 尝试）
- `/pricing`、`/rankings`、`/about`

需登录的 P0/P1 路径状态为 **`skipped_auth_required`**，**不算** `UI_AUDIT_STRICT` 失败。

### 查看截图与页面报告

```bash
ls scripts/dev/ui-audit/screenshots/
less scripts/dev/ui-audit/reports/page-audit-report.md
column -t -s $'\t' scripts/dev/ui-audit/reports/page-audit-full.tsv | less -S
```

### 已知限制

- 不同账号 / `SidebarModulesAdmin` 配置下，侧栏可见菜单可能不同。
- `/groups` 若路由不存在会记为 `unavailable`，不导致脚本崩溃。
- 登录失败时仅公开页有完整验收；请确认 `UI_AUDIT_USERNAME` / `UI_AUDIT_PASSWORD` 与种子数据一致。

---

## 前端未启动时

```text
cd web/default
pnpm dev --host 0.0.0.0 --port 3001
```

脚本会继续**源码扫描**；Playwright 页面验收跳过。

---

## 源码扫描说明

见 `scan-ui-legacy-terms.sh`。匹配分类含 `oauth_provider_allowed`、`likely_internal_contract` 等，**命中不等于必须改**。

```bash
bash scripts/dev/ui-audit/scan-ui-legacy-terms.sh
```

---

## Playwright 依赖

已安装于 `web/default`（`@playwright/test`）。若本机缺浏览器：

```bash
cd web/default
pnpm exec playwright install chromium
```

单独跑页面验收：

```bash
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
node scripts/dev/ui-audit/playwright-page-audit.mjs
```

---

## 演示模式可见性

导航隐藏清单：`web/default/src/config/aioc-demo-visibility.ts`（与页面验收独立）。

---

## 演示数据（AIOC_DEMO）

```bash
DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh
```

| 账号 | 密码 | 用途 |
|------|------|------|
| `aioc_demo_zhang` | `DevUi@123456` | 租户 / 日志 / keys |
| `admin` | 环境已有 | 管理端、系统设置 |

---

## 不应提交

`.gitignore`：`reports/`、`screenshots/`、`*.log`

**可提交：** `*.sh`、`*.mjs`、`*.md`

---

## 脚本一览

| 脚本 | 作用 |
|------|------|
| `run-ui-audit.sh` | 一键：健康检查 + 源码扫描 + 页面验收 + 汇总 |
| `scan-ui-legacy-terms.sh` | 源码 P0/P1 旧词 |
| `screenshot-ui-acceptance.sh` | 调用 Playwright 页面验收 |
| `playwright-page-audit.mjs` | 截图 + `innerText` 扫描 + 页面报告 |
| `playwright-screenshots.mjs` | 兼容包装（转调 page-audit） |
