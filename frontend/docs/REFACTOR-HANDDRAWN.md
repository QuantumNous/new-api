# 手绘雅致风格方案归档

> 归档日期：2026-08-24。本文不再作为实施计划或生图任务清单。

该文档记录的早期“手绘雅致”重构草案包含未执行的 Phase 任务、IMG-01～IMG-10 生图计划、占位 API Key 名称和拟议文件清单。当前实现已经收敛到语义主题令牌、日间手绘/夜间材质分层、公共控制台组件和真实资产目录，原草案中的逐页改造清单与生图参数不再代表项目事实。

当前事实请以以下来源为准：

- `src/styles/tokens.css`、`src/styles/base.css`：主题令牌、明暗覆盖和手绘兼容层。
- `src/components/common/`：公共卡片、按钮、开关、输入、表格和弹窗组件。
- `src/components/console/`、`src/views/console/`：控制台页面结构与页面级视觉实现。
- `docs/THEMES.md`：日间 Desert Ledger 与夜间 One Night 的现行设计约束。
- 工作区根目录的 `docs/REN2HUB_FRONTEND_ARCHITECTURE.md`：当前交付、路由、认证和质量基线。

后续视觉变更必须基于当前组件和语义 token，经过明暗主题、移动端、键盘焦点、图片失败和 reduced-motion 验证后再形成新的专项方案；不得恢复本文中的占位生图任务或未验证的外部图像服务配置。
