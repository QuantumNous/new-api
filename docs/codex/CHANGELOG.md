# Changelog

## 2026-06-13 - CC Switch 应用名称与缩写图标统一

- 类型：UI 调整
- 变更文件：
  - `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`
  - `web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx`
  - `docs/codex/CHANGELOG.md`
- 变更原因：“导入 CC Switch”弹窗中的应用名称和前置图标需要在 default、classic 两套前端保持一致。
- 主要调整：两端固定使用 `Codex`、`Claude Code` 作为应用展示名称；原产品类图标改为名称缩写徽标，分别显示 `C`、`CC`。
- 验证结果：两个目标文件已完成 Prettier 格式化，classic/default 局部 ESLint 均通过；default 全量 TypeScript 检查运行 120 秒后超时；统一 `scripts/codex-check.ps1` 仍因脚本自身第 61、129、136 行附近的既有解析错误而未执行。浏览器可进入 classic 令牌页并打开弹窗，但 `localhost:3000` 当前服务的是修改前静态包，未将其作为本次视觉通过证据。
- 风险点：仅修改应用卡片的展示名称与图标，不影响目标 key、导入参数、接口调用或 CC Switch 跳转。
- 人工验收点：分别打开 default 与 classic 的“导入 CC Switch”弹窗，确认应用卡名称为 `Codex`、`Claude Code`，前置图标分别为 `C`、`CC`，选中态和禁用态显示正常。

## 2026-06-13 - CC Switch 导入弹窗令牌区对齐

- 类型：UI 调整
- 变更文件：
  - `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`
  - `web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx`
  - `docs/codex/CHANGELOG.md`
- 变更原因：“当前令牌”需要与“应用”“主模型”保持同级标题位置，同时去掉与“令牌名称”重复的令牌摘要信息。
- 主要调整：default 与 classic 均移除标题下说明文案、令牌框内“当前令牌 + 名称摘要”、可用状态与钥匙图标；在令牌框外新增同级“当前令牌”标题，框内仅保留令牌名称、API Key 和 API 地址/Base URL。
- 验证结果：`powershell -ExecutionPolicy Bypass -File .\scripts\codex-check.ps1` 仍因脚本自身在第 61、129、136 行附近出现解析错误而未执行；已对两个目标文件运行 Prettier 写入与检查，并分别运行局部 ESLint，均通过。
- 风险点：仅调整弹窗展示结构与冗余文案，不修改导入参数、接口调用、权限或数据结构。
- 人工验收点：分别在 default `/keys` 与 classic `/console/token` 打开“导入 CC Switch”弹窗，确认顶部说明消失，令牌区标题与“应用”“主模型”对齐，令牌框内没有钥匙图标和重复名称摘要。

## 2026-06-12 - CC Switch 导入弹窗 UI 层次优化

- 类型：UI 调整
- 变更文件：
  - `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`
  - `web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx`
  - `docs/codex/CHANGELOG.md`
- 变更原因：令牌管理中的“导入 CC Switch”弹窗局部模块比例、图标质感和底部提示排版不协调；项目同时存在 default 与 classic 两套令牌管理前端，需要两边的“导入”入口和弹窗体验保持一致。
- 主要调整：default 与 classic 的弹窗宽度收敛到约 35rem/560px；令牌摘要改为轻阴影、细描边的紧凑信息块；应用选择卡只在 hover/选中态给轻微浮起和描边；主模型区域改为输入框式单行选择；Claude Code 的 Haiku/Sonnet/Opus 模型收进“高级设置”折叠区；手动开启提示改为单列步骤列表，避免中文被三列布局挤压。
- 验证结果：`powershell -ExecutionPolicy Bypass -File .\scripts\codex-check.ps1` 仍因脚本自身在第 61、129、136 行附近出现解析错误而未执行；已分别运行 classic/default 的 Prettier 写入与检查、局部 ESLint，均通过；classic 生产构建通过；default 生产构建仍因现有 `@hugeicons/core-free-icons` 解析问题失败，失败点分布在多个既有 UI 组件与本弹窗 import；已通过 `scripts/windows/project.ps1 restart` 重建并启动 Docker，本地 `/api/status` 返回当前主题为 `classic`，服务出的 classic JS 包含新布局类与“高级设置/API地址”，且不再包含旧的 `sm:grid-cols-3` 手动步骤布局；Playwright 打开 `/console/token` 时因未登录跳转到登录页，未做弹窗点击验收。
- 风险点：仅调整两套前端弹窗内部展示，不修改接口参数、导入链接生成、权限、数据结构或无关页面。
- 人工验收点：分别在 default `/keys` 与 classic `/console/token` 打开令牌管理的“导入”弹窗，确认令牌区无异常空白、应用图标不再像占位块、模型选择和 Claude 高级设置可正常展开，手动开启提示在桌面和窄屏下不拥挤、不重叠。
