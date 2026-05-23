# 昀河星泽词元运营中心 — 演示脚本与验收清单

> 本文档仅用于**本地/内网演示与交付验收**，不修改任何业务代码。  
> 规范配套：[`UI_REDESIGN_RULES.md`](../UI_REDESIGN_RULES.md)、[`UI_REDESIGN_CURSOR_PROMPT.md`](../UI_REDESIGN_CURSOR_PROMPT.md)、[`scripts/dev/ui-audit/README.md`](../scripts/dev/ui-audit/README.md)。

---

## 一、演示前准备

### 1. 启动前端

```bash
cd /home/lobster/projects/new-api/web/default
pnpm dev --host 0.0.0.0 --port 3001
```

确认终端无报错，浏览器可访问下方地址。

### 2. 访问地址

| 环境 | URL |
|------|-----|
| 内网演示（本机/局域网） | http://192.168.18.92:3001/ |

公开页可直接访问；运营控制台需登录（见下表）。

### 3. 演示账号（仅本地演示环境使用）

> **安全说明**：下列账号与密码仅适用于当前内网演示环境，**请勿写入对外材料、勿提交至公开仓库**。交付给客户时改用客户自有账号体系。

| 角色 | 账号 | 密码 | 用途 |
|------|------|------|------|
| 管理员 | `admin` | `!@#456QWErty` | 全量运营控制台、平台配置中心、通道与租户管理 |
| 普通演示租户 | `aioc_demo_zhang` | `DevUi@123456` | 租户视角：密钥、词元消耗、审计记录（种子数据前缀 `AIOC_DEMO`） |

可选：导入演示种子数据（日志/任务/绘图等）：

```bash
cd /home/lobster/projects/new-api
DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh
```

### 4. UI 自动化验收（推荐演示前跑一遍）

```bash
cd /home/lobster/projects/new-api

BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=admin \
UI_AUDIT_PASSWORD='!@#456QWErty' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

严格模式（P0 可见命中或 failed 页则 exit 1）：

```bash
UI_AUDIT_STRICT=1 \
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=admin \
UI_AUDIT_PASSWORD='!@#456QWErty' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

报告与截图目录（**不提交 Git**）：

- `scripts/dev/ui-audit/reports/ui-audit-summary.md` — 汇总
- `scripts/dev/ui-audit/reports/page-audit-report.md` — 页面可见文本扫描
- `scripts/dev/ui-audit/screenshots/*.png` — 按页截图

---

## 二、演示路线（建议 25～40 分钟）

按下列顺序讲解；路径以当前 `web/default` 路由为准。

| 序号 | 模块 | 路径（参考） | 演示要点 |
|------|------|--------------|----------|
| 1 | **产品首页** | `/` | 平台定位：**政企级 AI 资源统一接入与词元运营中心**；强调统一运营、审计追踪、资源可控、接入便捷 |
| 2 | **资源计费说明** | `/pricing` | 模型资源计费口径；**金额统一人民币 ¥**；**词元数量不带 ¥ / $ / USD** |
| 3 | **运营排行榜** | `/rankings` | 模型使用热度、运营排行、资源分布 |
| 4 | **关于中心** | `/about` | 平台能力矩阵与产品说明 |
| 5 | **登录** | `/sign-in` | 使用 `admin` 或 `aioc_demo_zhang` 进入控制台 |
| 6 | **运营总览** | `/dashboard/overview` | 调用量、词元消耗、模型通道健康、租户运营状态 |
| 7 | **模型调用分析** | `/dashboard/models` | 词元、RPM、TPM、消耗分布；**不出现 $ / Token / TOKEN** |
| 8 | **应用接入密钥** | `/keys` | 业务系统如何申请与管理接入密钥 |
| 9 | **词元消耗明细** | `/usage-logs/common` | 调用审计、请求追踪、输入/输出词元 |
| 10 | **任务审计记录** | `/usage-logs/task` | 异步/任务类调用的审计留痕 |
| 11 | **绘图审计记录** | `/usage-logs/drawing` | 绘图类任务的审计留痕 |
| 12 | **模型服务通道** | `/channels` | 服务通道、模型资源、上游能力、额度与状态 |
| 13 | **租户与账号管理** | `/users` | 多租户、账号、权限 |
| 14 | **租户分组** | `/groups` | 分组策略、模型与额度绑定（若菜单可见） |
| 15 | **平台配置中心** | `/system-settings/...` | 平台基础信息、计费与结算、模型定价、分组定价等；侧栏应可 **返回运营控制台** |
| 16 | **账号资料 / 通知设置** | `/profile` | 个人资料、偏好；Webhook/Bark/Gotify 等应对客户隐藏 |

**顶部导航（公开页全程）**：产品首页 → 运营控制台 → 资源计费说明 → 运营排行榜 → 关于中心 — 需 **单行完整显示**，品牌名「昀河星泽词元运营中心」完整、无省略号。

---

## 三、演示话术要点

1. **统一品牌**：全程称 **「昀河星泽词元运营中心」**，不说 New API、QuantumNous、开源中转等。
2. **价值定位**：不是简单 token 转售，而是面向政企的 **统一接入、运营、计费、审计与管控** 平台。
3. **计量口径**：
   - **金额**（单价、费用、充值、结算）→ 统一 **人民币 ¥**；
   - **词元**（消耗、额度、配额、调用量）→ **纯数字或「词元」**，不带 ¥ / $ / USD。
4. **部署扩展**：支持云端、私有化、边缘盒子；可提及后续对接 **「星泽 AI 边缘盒子」** 等形态。
5. **审计合规**：强调任务/绘图/通用调用均可追溯，满足政企审计与运维要求。

---

## 四、最终验收清单

演示结束后逐项勾选（可与 UI audit 报告对照）。

### 4.1 品牌与旧词（页面可见）

- [ ] 全站无 **New API / QuantumNous / USD / dollar** 等用户可见痕迹
- [ ] 无 **System Settings / Operation Settings / Group & Model Pricing** 等英文旧菜单腔
- [ ] **Page P0 visible = 0**（见 `page-audit-meta.env` 或 `page-audit-report.md`）
- [ ] **Page P1 visible = 0**
- [ ] **Failed pages = 0**

### 4.2 布局与风格

- [ ] 顶部导航 **不换行、不截断**（含「关于中心」、品牌全称）
- [ ] 换页后导航组 **无明显左右漂移**
- [ ] 公开页与登录后控制台 **深色风格一致**

### 4.3 计费与数据展示

- [ ] **资源计费说明**：无美元符号；金额带 **¥**；词元列不带货币符号
- [ ] **模型调用分析**：无 **$ / Token / TOKEN** 展示
- [ ] **聊天/Playground 错误**：中文产品语气、深色卡片；无旧「系统设置」路径文案

### 4.4 导航与配置

- [ ] **平台配置中心** 二级侧栏可 **返回运营控制台**
- [ ] **账号设置** 中 Webhook / Bark / Gotify 已对客户隐藏
- [ ] 登录后 **不出现** 500/505 闪屏或持续报错页

### 4.5 品牌资源

- [ ] **favicon / logo**：新设备显示新 logo；旧浏览器若仍旧图，优先判断 **缓存**（见第五节）

### 4.6 一键验收命令（交付前复跑）

```bash
UI_AUDIT_STRICT=1 \
BASE_URL=http://192.168.18.92:3001 \
UI_AUDIT_USERNAME=admin \
UI_AUDIT_PASSWORD='!@#456QWErty' \
bash scripts/dev/ui-audit/run-ui-audit.sh
```

---

## 五、常见问题处理

### 1. 3001 端口掉线 / 页面无法访问

```bash
cd /home/lobster/projects/new-api/web/default
pnpm dev --host 0.0.0.0 --port 3001
```

- 确认进程在跑：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/`
- 防火墙是否放行 3001；局域网访问用 **机器 IP**（如 `192.168.18.92`），勿仅用 `localhost` 给他人演示。

### 2. Chrome 打不开但 Safari 能打开

| 排查项 | 操作 |
|--------|------|
| 混合内容 / HTTPS | 演示用 **http://IP:3001**，避免 https 页面嵌 http |
| 扩展/代理 | 无痕模式、关闭广告拦截与系统代理 |
| DNS / hosts | 确认 IP 可达，非错误域名缓存 |
| 硬刷新 | `Ctrl+Shift+R`（Mac：`Cmd+Shift+R`） |

### 3. 登录返回 429（限流）

- 现象：提示「请求过于频繁，请稍后再试」
- 处理：**间隔 5～10 分钟** 再登；避免短时间多次跑 `run-ui-audit.sh` 或反复试密
- 审计脚本会将需登录页标为 `skipped_rate_limited`，见 `scripts/dev/ui-audit/README.md`

### 4. logo / favicon 仍显示旧图

1. 强刷页面 + 清空该站点缓存  
2. 换无痕窗口或另一浏览器验证  
3. 确认访问的是 **3001 当前 dev 实例**，非旧端口或反向代理缓存  
4. 新设备/新浏览器仍旧 → 再查静态资源路径与构建产物；多数为 **浏览器缓存**

### 5. audit 报告怎么看

| 文件 | 内容 |
|------|------|
| `reports/ui-audit-summary.md` | 总览：源码扫描 + 页面验收是否通过 |
| `reports/page-audit-report.md` | 每页 P0/P1 可见命中、截图路径、`failed` / `skipped` 原因 |
| `reports/page-audit-full.tsv` | 页面级 TSV，便于筛选 |
| `reports/legacy-terms-report.md` | 源码旧词命中（不等于必须改，需结合分类） |
| `reports/page-audit-meta.env` | `PAGE_P0_VISIBLE_COUNT`、`PAGE_FAILED_COUNT` 等计数 |

快速查看：

```bash
less scripts/dev/ui-audit/reports/ui-audit-summary.md
less scripts/dev/ui-audit/reports/page-audit-report.md
ls scripts/dev/ui-audit/screenshots/
```

---

## 六、相关文档索引

| 文档 | 说明 |
|------|------|
| [`UI_REDESIGN_RULES.md`](../UI_REDESIGN_RULES.md) | 术语、¥/词元、深色可读性规则 |
| [`UI_REDESIGN_CURSOR_PROMPT.md`](../UI_REDESIGN_CURSOR_PROMPT.md) | Cursor 批量收尾提示 |
| [`scripts/dev/ui-audit/UI_ACCEPTANCE_SCOPE.md`](../scripts/dev/ui-audit/UI_ACCEPTANCE_SCOPE.md) | P0/P1/P2 路径与标准 |
| [`scripts/dev/ui-audit/README.md`](../scripts/dev/ui-audit/README.md) | 审计脚本与环境变量 |
| [`web/default/src/config/aioc-demo-visibility.ts`](../web/default/src/config/aioc-demo-visibility.ts) | 演示模式菜单隐藏清单 |

---

*文档版本：与 `web/default` UI 包装交付同步维护。仅本地演示环境使用账号密码，对外材料请脱敏。*
