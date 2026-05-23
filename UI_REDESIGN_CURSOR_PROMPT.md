# UI 重构 — Cursor 批量收尾提示词

面向 `web/default` 前端展示层包装，将用户可见界面统一为 **昀河星泽词元运营中心** 运营后台。与 `UI_REDESIGN_RULES.md` 配套使用；批量阶段优先跑审计脚本与验收清单，再按 P0 → P1 → P2 分级修复。

---

## 1. 项目目标

- 将 `web/default` 包装为 **昀河星泽词元运营中心**（副标题：面向政企场景的一体化模型服务与 AI 资源运营平台）。
- **只改前端展示层**（文案、样式、布局、i18n、主题）；不碰后端与数据逻辑。
- 用户界面 **不得暴露** New API、QuantumNous、开源项目/GitHub Star、上游后台口吻。
- **额度类**统一：词元额度、词元消耗、资源充值等；**金额/单价**才使用人民币（¥ / CNY）。
- **数字展示**：必须区分「人民币金额」与「词元数量」——金额/价格/费用/单价/支付/充值/结算/余额金额 → **必须带 `¥`**，禁止 `$`/`USD`；词元数量/词元额度/词元消耗/配额/Token 数/调用消耗 → **禁止 `¥`/`$`/`USD`/`CNY`**，用纯数字或「词元」后缀（详见 `UI_REDESIGN_RULES.md` 第六节 6.1–6.3）。
- **深色主题**下 label、说明、输入框、按钮、表格、弹窗、下拉在 **默认态** 必须可读（禁止白底浅字、浅底浅字、仅靠 hover 才看清）。

---

## 2. 绝对禁止修改

| 类别 | 禁止项 |
|------|--------|
| 后端 | Go 服务、数据库、migration、Docker/部署脚本 |
| 接口 | API 路径、请求方法、payload、响应字段处理语义 |
| 路由生成 | `routeTree.gen.ts` |
| 合规 | `LICENSE`、`NOTICE`、`THIRD-PARTY-LICENSES`、源码文件顶部 **许可证头**（可保留，不得删改伪造） |
| 数据契约 | 表单/API **字段名**、配置 **key**、枚举 **值**（如 `theme.frontend` 的 `default`/`classic`） |
| 业务逻辑 | 计费/额度计算、鉴权、渠道调度、relay、保存/序列化逻辑 |

允许：i18n 文案、label/description/placeholder、className、局部样式 token、不改字段名的展示组件。

---

## 3. 术语词典（用户可见文案）

| 旧/技术词 | 目标表达 | 备注 |
|-----------|----------|------|
| New API / new-api / One API | **昀河星泽词元运营中心** / 平台 / 运营中心 | 不可用户可见 |
| QuantumNous / GitHub Star / 开源项目 | 不出现 | 许可证头除外 |
| API Key | **应用接入密钥** | |
| Token | **词元** / **应用接入密钥**（按上下文） | 禁止机械「令牌」 |
| Wallet | **词元额度管理** | |
| Balance | **可用词元额度** | |
| Quota | **词元额度** | |
| Usage | **词元消耗** | |
| Cost | **词元消耗** | 不要单独译为「费用」 |
| Fee | **词元消耗** / **违规词元消耗** | 按场景 |
| Model | **模型资源** | |
| Channel | **服务通道** | |
| User | **账号** | |
| Group | **租户分组** | |
| Provider / Vendor | **服务来源** | |
| Prompt | **提示词内容** | |
| Fail Reason | **失败原因** | |
| Image Preview | **图片预览** | |
| Midjourney / MJ | **绘图** / **绘图任务** | 配置 key 可保留，label 产品化 |
| USD / $ / dollar / 美元 | 词元数量场景 **禁止**；人民币金额/单价 **必须 `¥`**，禁止 `$`/`USD` | 勿把额度格式化成金额 |
| 纯数字 + 货币符号 | 金额 → `¥12.50`；词元 → `24,200` 或 `24,200 词元` | 同屏勿混用 |
| Deployment / io.net | 客户演示 **不应作为主功能露出** | |
| Header Navigation / Sidebar Modules | **顶部导航配置** / **菜单模块配置** | |
| New Frontend / Legacy Frontend | **默认运营界面** / **经典运营界面** | |
| Markdown / HTML / iframe | 尽量改为「富文本 / 外链」等产品说法 | 必要时简短提及 |

专用 i18n 建议前缀：`systemSettings.site.*`、`usageLogs.*`、`keys.*` 等，避免误改全局 key。

---

## 4. 数字展示：金额 vs 词元（硬性）

| 类型 | 适用场景 | 格式要求 | 示例 |
|------|----------|----------|------|
| 人民币金额 | 价格、费用、单价、支付、充值、结算、余额金额 | 必须 `¥`；禁止 `$`/`USD` | `¥0`、`¥75 / 百万词元` |
| 词元数量 | 词元额度、词元消耗、配额、Token 数、调用消耗 | 禁止 `¥`/`$`/`USD`/`CNY`；可纯数字或加「词元」 | `24,200`、`150,000,000 词元` |

实现时优先复用项目内展示层约定（如 `web/default/src/lib/ops-billing-display.ts` 中金额与额度分流函数），**本轮若无任务说明，不要为此做大范围页面改动**。

---

## 5. 深色可读性规则

1. 禁止 **白底 + 浅灰字**、**浅底 + 浅字** 作为默认态。
2. **outline / secondary 按钮** 默认态须有清晰边框与 `text-slate-100` 量级前景。
3. **hover / selected** 不得变成白底黑字（破坏运营台一致性）。
4. 次级说明不低于 **`text-slate-400`**；重要 label 建议 **`text-slate-100`~`200`**。
5. 表格、分页、Popover、Select、Dialog 在深色背景下 **未 hover 即可辨认**。
6. 避免 `after:` / `fixed` 底部渐变 **遮挡表单**（参考 system-settings 已修案例）。
7. 未保存提示、校验错误需用深色友好色（如 amber/rose 半透明底），不用 `bg-orange-50` 浅色块。

---

## 6. 批量收尾工作流

1. **扫描**：`bash scripts/dev/ui-audit/scan-ui-legacy-terms.sh` → `reports/legacy-terms-report.md`
2. **分级**：对照 `scripts/dev/ui-audit/UI_ACCEPTANCE_SCOPE.md`（P0 / P1 / P2）
3. **修复**：按优先级改 i18n + TSX 展示；每批尽量同一模块
4. **验收**：种子数据 + 截图脚本 / 手动清单（见 `scripts/dev/ui-audit/README.md`）
5. **禁止**：未跑扫描就大面积改全局 i18n key 的 value（易误伤其他页）

---

## 7. 推荐 Cursor 任务描述模板

```
严格遵守 UI_REDESIGN_RULES.md 与 UI_REDESIGN_CURSOR_PROMPT.md。
本轮只处理 [P0|P1] 页面：[路径列表]。
只改展示层与 i18n，不改 API/字段名/配置 key/保存逻辑。
先读 scripts/dev/ui-audit/reports/legacy-terms-report.md 中相关文件命中。
完成后说明修改文件与未改动的禁止项。
```

---

## 8. 相关文件

| 文件 | 用途 |
|------|------|
| `UI_REDESIGN_RULES.md` | 项目级硬性规则 |
| `scripts/dev/ui-audit/scan-ui-legacy-terms.sh` | 旧词扫描 |
| `scripts/dev/ui-audit/UI_ACCEPTANCE_SCOPE.md` | P0/P1/P2 验收范围 |
| `scripts/dev/ui-audit/screenshot-ui-acceptance.sh` | 截图验收（需 Playwright 时） |
| `scripts/dev/ui-audit/README.md` | 工具使用说明 |
| `scripts/dev/seed-ui-acceptance.sh` | 本地演示数据（AIOC_DEMO） |
