# UI audit tooling (`scripts/dev/ui-audit`)

一键本地验收：**健康检查 → 旧词扫描 → 可选截图 → 汇总报告**。
不修改 `web/default` 业务代码；`reports/`、`screenshots/` **不提交**。

规范：[`UI_REDESIGN_RULES.md`](../../../UI_REDESIGN_RULES.md)、[`UI_REDESIGN_CURSOR_PROMPT.md`](../../../UI_REDESIGN_CURSOR_PROMPT.md)、[`UI_ACCEPTANCE_SCOPE.md`](./UI_ACCEPTANCE_SCOPE.md)。

---

## 一键审计（推荐）

```bash
cd /home/lobster/projects/new-api

# 默认 BASE_URL=http://192.168.18.92:3001
bash scripts/dev/ui-audit/run-ui-audit.sh

# 指定地址与登录（截图用）
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

### 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `BASE_URL` | `http://192.168.18.92:3001` | 前端 dev 地址 |
| `UI_AUDIT_USERNAME` | 空 | 截图前登录（兼容 `DEMO_USERNAME`） |
| `UI_AUDIT_PASSWORD` | 空 | 截图前登录（兼容 `DEMO_PASSWORD`） |
| `UI_AUDIT_SKIP_SCREENSHOTS` | `0` | 设为 `1` 跳过截图 |
| `UI_AUDIT_STRICT` | `0` | 设为 `1` 且 P0 actionable > 0 时 **exit 1** |

### 产出

| 文件 | 说明 |
|------|------|
| `reports/legacy-terms-report.md` | 摘要 + Top 20 文件 + 前 300 条 actionable |
| `reports/legacy-terms-full.tsv` | 全量命中（含 classification） |
| `reports/scan-meta.env` | P0/P1/P2 计数 |
| `reports/ui-audit-summary.md` | 一键汇总 |
| `reports/screenshot.log` | 截图脚本日志 |
| `reports/screenshot-meta.env` | 截图状态（`printf %q` 引用，可供 `source`） |
| `screenshots/*.png` | Playwright 可用且前端可达时 |

### 前端未启动时

脚本会提示：

```text
cd web/default
pnpm dev --host 0.0.0.0 --port 3001
```

并 **继续** 旧词扫描与汇总（不因前端 down 而整体失败）。截图会跳过。

---

## 如何解读扫描结果

扫描是**辅助审计**，不是“命中即必须改”。

| 类型 | 处理建议 |
|------|----------|
| **actionable** / **i18n_value_user_visible** / **tsx_user_visible** | 优先人工修复（用户可见文案） |
| **i18n_key_only** | 通常只改 zh/en **value**，不要改 key |
| **likely_internal_contract** | 字段名、类型、API 路径 — **禁止改名** |
| **source_logic_keep** | 如 `LEGACY_SYSTEM_NAMES` 屏蔽列表 |
| **comment_or_doc** | 注释/许可证头 |
| **p2_deep_settings** | P2 深层页（如 GitHub 更新检查） |
| **p2_upstream_release** | 禁止暴露：GitHub release、Open release、Calcium-Ion/new-api 等 |
| **oauth_provider_allowed** | 允许的第三方账号服务名（GitHub 登录/OAuth/绑定/Client ID 等） |

匹配规则已收紧：

- **USD**：`value: 'USD'`、`currency: 'USD'`、`WaffoCurrency` 默认值、类型联合中的 `'USD'` 等计为 **likely_internal_contract**；仅 Label/placeholder/i18n value/用户可见文案计 actionable。
- **$**：正则结尾 `$`、`^gpt-4o.*$` 占位符、`e.g. ¥ or HK$` 不计 actionable；用户可见 `$/M` 等仍计 actionable。
- **GitHub**：OAuth/账号绑定/Client ID 等计 **oauth_provider_allowed**；`github_id`/`github_oauth`/`id: 'github'` 计 internal；release/上游仓库计 **p2_upstream_release**。
- **Midjourney**：`key: 'midjourney'`、配置对象键、类型名计 internal；title/description/i18n value 计 actionable。
- **MJ**：独立词匹配。

查看全量：

```bash
column -t -s $'\t' scripts/dev/ui-audit/reports/legacy-terms-full.tsv | less -S
rg 'action_required' scripts/dev/ui-audit/reports/legacy-terms-full.tsv
```

## 仅跑旧词扫描

```bash
bash scripts/dev/ui-audit/scan-ui-legacy-terms.sh
```

- 依赖：`ripgrep` (`rg`) 推荐
- 报告：`reports/legacy-terms-report.md` + `reports/legacy-terms-full.tsv`

---

## 跳过截图

```bash
UI_AUDIT_SKIP_SCREENSHOTS=1 bash scripts/dev/ui-audit/run-ui-audit.sh
```

或单独：

```bash
bash scripts/dev/ui-audit/screenshot-ui-acceptance.sh   # 无 Playwright 时 exit 0 + 说明
```

---

## 查看 / 清理报告

```bash
less scripts/dev/ui-audit/reports/ui-audit-summary.md
less scripts/dev/ui-audit/reports/legacy-terms-report.md
less scripts/dev/ui-audit/reports/screenshot.log

# 清理生成物
rm -rf scripts/dev/ui-audit/reports scripts/dev/ui-audit/screenshots
```

---

## Playwright 截图（可选）

当前仓库 **默认无** Playwright 依赖。安装后（需单独 PR 改 `web/default/package.json`）：

```bash
cd web/default
pnpm add -D @playwright/test
pnpm exec playwright install chromium
cd ../..
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=aioc_demo_zhang \
UI_AUDIT_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/screenshot-ui-acceptance.sh
```

无 Playwright：按 `UI_ACCEPTANCE_SCOPE.md` **手动截图** 到 `screenshots/`。

---

## 配合演示数据（AIOC_DEMO）

```bash
DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh
```

| 账号 | 密码 | 用途 |
|------|------|------|
| `aioc_demo_zhang` | `DevUi@123456` | 租户 /keys、日志 |
| `admin` | 环境已有 | 管理端、系统设置 |

清理：`./scripts/dev/cleanup-aioc-demo-data.sh` — 详见 [`scripts/dev/README.md`](../README.md)。

---

## 不应提交

`.gitignore`：`reports/`、`screenshots/`、`*.log`

**可提交：** `*.sh`、`*.md`、`playwright-screenshots.mjs`（骨架）、根目录 `UI_REDESIGN_CURSOR_PROMPT.md`

---

## 脚本一览

| 脚本 | 作用 |
|------|------|
| `run-ui-audit.sh` | 一键流程 |
| `scan-ui-legacy-terms.sh` | P0/P1 旧词扫描 |
| `screenshot-ui-acceptance.sh` | 截图（可选） |
| `playwright-screenshots.mjs` | Playwright 实现 |
