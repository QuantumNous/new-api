# 日夜主题分层完成记录

> 完成记录：2026-08-24。原“主题分层调优计划”已由 `2719ead5` 及后续控制台设计系统提交实现。

当前主题事实：

- 日间 Desert Ledger 使用语义 token、纸面纹理、手绘形态和结构性分隔线。
- 夜间 One Night 使用统一圆角、Material elevation、金色状态层和收敛的装饰线。
- 两个主题共享组件和 DOM 结构，通过 `tokens.css`、`base.css` 及 `data-theme`/`html.dark` 覆盖完成分层。
- 纸纹和印章等本地资源位于 `src/assets/textures/`，图表主题 preset 位于 `src/charts/themePreset.ts`。

当前修改入口：

- `src/styles/tokens.css`、`src/styles/base.css`、`src/styles/console.css`
- `src/charts/palette.ts`、`src/charts/themePreset.ts`
- `src/components/common/` 与 `src/components/console/`
- `src/assets/textures/`
- `docs/THEMES.md`

本文不再保留旧的生图端点、密钥片段、未执行 Phase 清单或候选参数。后续主题调整必须使用本地资产和语义 token，并验证明暗主题、移动端、焦点状态、reduced-motion、溢出和图表可读性。
