# 登录页中转动画完成记录

> 完成记录：2026-08-24。原“重构计划”已由 `f74b27fe` 的实现取代。

登录页中转动画现由 `AuthRelayFlow.vue` 提供，`AuthEditorialPanel.vue` 负责品牌栏布局。线条和上游节点使用 HTML/SVG 排版，日间采用手绘抖动与纸面语义，夜间采用近直线、金色光环和 elevation；主题切换、reduced-motion、移动端隐藏和内容不溢出均由组件与 token 控制。

当前修改入口：

- `src/components/auth/AuthRelayFlow.vue`
- `src/components/auth/AuthEditorialPanel.vue`
- `src/components/auth/__tests__/AuthRelayFlow.spec.ts`
- `src/styles/tokens.css`

此前的尺寸实测、候选构图、动画阶段和外部依赖说明仅用于设计过程，不再是实施依据。后续变更应以组件测试、双主题视觉检查和 `prefers-reduced-motion` 验收为准。
