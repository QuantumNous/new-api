# 登录页品牌栏方案归档

> 归档日期：2026-08-24。原“只做计划”文档已由 `253da6a4` 的实现取代。

登录页左栏现由 `AuthBrandPanel.vue` 与 `AuthScene.ts` 提供真实的双主题 Canvas 场景，使用现有模型资产、主题色盘、reduced-motion 和页面可见性闸门。构建期背景和钥匙资源位于 `src/assets/auth/`，不依赖外部图像生成服务。

当前修改入口：

- `src/components/auth/AuthBrandPanel.vue`
- `src/canvas/AuthScene.ts`、`src/canvas/theme.ts`
- `src/components/layout/AuthLayout.vue`
- `src/assets/auth/`

本文保留为设计决策索引，不再保留旧的生图端点、凭据占位名称、未勾选验收清单或阶段任务。新的认证视觉变更必须遵循真实资源、明暗主题、移动端隐藏、reduced-motion 和 Playwright 验证约束。
