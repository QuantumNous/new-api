# Changelog

## 2026-06-12 - CC Switch 导入弹窗 UI 优化

- 类型：UI 调整
- 变更文件：
  - `web/default/src/features/keys/components/dialogs/cc-switch-dialog.tsx`
  - `web/classic/src/components/table/tokens/modals/CCSwitchModal.jsx`
  - `web/default/src/i18n/static-keys.ts`
  - `web/default/src/i18n/locales/*.json`
  - `web/classic/src/i18n/locales/*.json`
- 变更原因：令牌管理的“导入 CC Switch”弹窗需要按 demo 增加“应用”说明，并改善信息层级、选中态、模型配置密度和小屏滚动体验。
- 主要调整：默认版与经典版统一为紧凑令牌信息条、带图标的应用双选、成组模型配置和轻量手动步骤提示；加载、错误与空数据状态改用现有 Skeleton/Spin、Alert/Banner 组件。
- 验证结果：已补齐默认前端与经典前端新增文案的 locale key；格式、ESLint、统一检查和 Docker 页面验收结果见本次任务最终回复。
- 风险点：仅调整弹窗展示与按钮文案，不改变接口参数、导入链接生成、权限或数据结构。
- 人工验收点：在 Docker Desktop 启动的项目中打开令牌管理，分别切换 Codex 与 Claude Code，确认应用说明、模型分组、手动开启项和主按钮文案按选择联动；桌面与移动尺寸下正文可滚动、底部按钮不被裁切。
