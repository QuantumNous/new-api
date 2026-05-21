# UI audit tooling (`scripts/dev/ui-audit`)

批量扫描旧文案、分级验收清单、可选 Playwright 截图。  
**不修改** `web/default` 业务逻辑；报告与截图目录默认 **gitignore**。

---

## 1. 旧词 / 风险词扫描

```bash
# 从仓库根目录
bash scripts/dev/ui-audit/scan-ui-legacy-terms.sh
```

**依赖：** `ripgrep` (`rg`) 推荐；无 `rg` 时回退 `grep -R`。

**扫描范围：** `web/default/src`

**排除：** `node_modules`、`dist`、`routeTree.gen.ts`、LICENSE/NOTICE/THIRD-PARTY-LICENSES

**报告路径：** `scripts/dev/ui-audit/reports/legacy-terms-report.md`（不提交）

报告字段：文件路径、行号、命中词、行内容、分类（需要人工判断）。

许可证头行（Copyright / AGPL / quantumnous.com）会自动跳过，减少噪声。

---

## 2. 查看报告

```bash
less scripts/dev/ui-audit/reports/legacy-terms-report.md
# 或按词搜索
rg '^## Term:' scripts/dev/ui-audit/reports/legacy-terms-report.md
```

结合 `UI_ACCEPTANCE_SCOPE.md` 的 P0/P1/P2 过滤：

- **必改：** P0 页面用户可见英文 / New API / 额度 $
- **慎改：** i18n key 英文、TypeScript 字段名（禁止改名）
- **可忽略：** 已过滤的许可证头、仅管理员 P2 页

---

## 3. 截图验收

```bash
bash scripts/dev/ui-audit/screenshot-ui-acceptance.sh
```

| 变量 | 默认 | 说明 |
|------|------|------|
| `BASE_URL` | `http://192.168.18.92:3001` | 前端 dev 地址 |
| `DEMO_USERNAME` | 空 | 可选，如 `aioc_demo_zhang` |
| `DEMO_PASSWORD` | 空 | 可选，勿写入脚本 |

**输出：** `scripts/dev/ui-audit/screenshots/*.png`（不提交）

### Playwright 状态

当前 **`web/default/package.json` 未声明 Playwright**。首次运行会：

1. 生成 `playwright-screenshots.mjs` 骨架；
2. 打印安装说明并 **退出 0**（不安装依赖）。

在单独 PR 中安装后可直接运行：

```bash
cd web/default
pnpm add -D @playwright/test
pnpm exec playwright install chromium
cd ../..
BASE_URL=http://192.168.18.92:3001 \
DEMO_USERNAME=aioc_demo_zhang \
DEMO_PASSWORD='DevUi@123456' \
bash scripts/dev/ui-audit/screenshot-ui-acceptance.sh
```

登录选择器在 `playwright-screenshots.mjs` 中，若登录页改版需只改该文件。

### 无 Playwright 时

按 `UI_ACCEPTANCE_SCOPE.md` **手动截图** 存入 `screenshots/`。

---

## 4. 不应提交的内容

见 `.gitignore`：

- `reports/`
- `screenshots/`
- `*.log`

**应提交：** 本目录下 `.sh`、`.md`、`UI_ACCEPTANCE_SCOPE.md`、根目录 `UI_REDESIGN_CURSOR_PROMPT.md`。

---

## 5. 配合 AIOC_DEMO 种子数据

本地演示数据（**仅 dev**）：

```bash
DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh
```

账号见 `scripts/dev/README.md`：

| 账号 | 密码 | 用途 |
|------|------|------|
| `aioc_demo_zhang` | `DevUi@123456` | 租户 /keys、日志 |
| `admin` | （已有） | 管理端、系统设置 |

演示数据前缀：`AIOC_DEMO`（日志/任务/绘图筛选）。

清理：

```bash
./scripts/dev/cleanup-aioc-demo-data.sh
```

---

## 6. 相关文档

| 文件 | 说明 |
|------|------|
| `/UI_REDESIGN_RULES.md` | 硬性规则 |
| `/UI_REDESIGN_CURSOR_PROMPT.md` | Cursor 批量收尾提示 |
| `UI_ACCEPTANCE_SCOPE.md` | P0/P1/P2 页面清单 |
