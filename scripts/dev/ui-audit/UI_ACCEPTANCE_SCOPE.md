# UI 验收范围 — P0 / P1 / P2

配合 `UI_REDESIGN_RULES.md`、`UI_REDESIGN_CURSOR_PROMPT.md` 与 `scan-ui-legacy-terms.sh` 使用。  
**额度** → 词元额度 / 词元消耗；**金额/单价** → ¥ / 人民币。

---

## 验收维度（每页勾选）

| 维度 | 检查项 |
|------|--------|
| 品牌 | 无 New API、QuantumNous、开源/GitHub Star、Powered by 等 |
| 货币 | 额度场景无 USD/$/dollar；单价/金额用 ¥ |
| 术语 | API Key→应用接入密钥；Token/Wallet/Balance/Quota 按词典 |
| 深色 | 默认态 label/说明/输入/按钮/表格/弹窗可读；无遮罩挡表单 |
| 反馈 | Toast/常见错误提示为中文产品语气 |
| 控件 | 下拉、分页、空状态未 hover 可辨认 |

---

## P0 — 客户一定会看到

| 路径 | 验收重点 |
|------|----------|
| `/` | 首页/落地：品牌名、副标题、无开源痕迹；深色可读；无错误 $ 展示 |
| `/login` | 平台名称、登录文案；无 New API；按钮默认可读 |
| `/dashboard` 或默认控制台首页 | 运营概览用语；统计为词元口径；图表/卡片深色 |
| `/keys` | 「应用接入密钥」；额度列词元；表格/弹窗深色 |
| `/usage-logs/common` | 「词元消耗明细」；列头词元非 ¥；失败行/标签可读；详情列可达 |
| `/usage-logs/task` | 「任务审计」产品名；无 MJ 外露；深色表格 |
| `/usage-logs/drawing` | 「绘图」审计；无 Midjourney 主标题；深色表格 |
| `/wallet` | 「词元额度管理」；充值/余额词元；支付确认 ¥ 仅真金额 |
| `/system-settings/site/system-info` | 「平台基础信息」；无 New/Legacy Frontend/OAuth 堆砌；cockpit 可读 |

**P0 通过标准**：演示路径 15 分钟内无英文旧品牌、无额度 $、无「看不清的默认灰字」。

---

## P1 — 客户可能会点到

| 路径 | 验收重点 |
|------|----------|
| `/redemption-codes` | 「资源兑换/充值管理」一致；无 Token 旧称 |
| `/subscriptions` | 「订阅方案管理」；价格 ¥ 口径 |
| `/models/metadata` | 「模型资源」；无裸 Model/API 菜单腔 |
| `/channels` | 「服务通道」；无 Channel 英文标题 |
| `/users` | 「租户与账号」；User→账号 |
| `/groups` | 「租户分组」 |
| `/system-settings/site/notice` | 运营公告；无 Markdown/UTC 示例；深色表单 |
| `/system-settings/site/header-navigation` | 顶部导航配置；无 Header Navigation/Docs/Pricing 英文；开关可读 |
| `/system-settings/site/sidebar-modules` | 菜单模块；无 Playground/Midjourney 英文 label；与侧栏菜单名一致 |

**P1 通过标准**：侧栏能点到的管理页与 P0 同一品牌与深色标准。

---

## P2 — 深层配置 / 后续处理

| 类别 | 说明 |
|------|------|
| 更新检查 | `operations` 内 GitHub/new-api Release；客户演示建议隐藏或改文案 |
| 多语言 | vi/fr/ru/ja 等非中文 locale 未产品化 |
| 极端错误 | 后端英文 `message` 直出 |
| 第三方 OAuth | GitHub/Discord 等集成配置页（技术名可保留但说明需中文） |
| 经典前端 | `theme.frontend=classic` 切换后 classic 主题 |
| 隐藏部署 | io.net deployment、worker 等 |
| 运营监控深层 | 性能、日志清理、倍率 JSON 编辑器等 |
| 计费 JSON 编辑器 | USD 出现在管理员倍率配置（非客户主路径） |

**P2 策略**：扫描报告标记 → 排期或标注「仅管理员」；不阻塞 P0 演示。

---

## 建议验收顺序

1. 种子数据：`DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh`（见 `scripts/dev/README.md`）
2. P0 路径手动或截图脚本走一遍
3. 跑 `scan-ui-legacy-terms.sh`，处理 P0 命中（人工过滤许可证头）
4. P1 → P2

---

## 账号与数据（本地）

| 用途 | 账号 | 密码 |
|------|------|------|
| 租户演示 | `aioc_demo_zhang` | `DevUi@123456` |
| 管理端 | `admin` | （环境已有） |

过滤演示数据：日志/任务/绘图前缀 `AIOC_DEMO`。
