# Tasks: React-VChart 文档示例补充

**Input**: Design documents from `/specs/001-react-vchart-demo/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 更新菜单入口 docs/assets/examples-react/menu.json
- [x] T002 创建中文示例文档 docs/assets/examples-react/zh/component/react-common-demo.md
- [x] T003 创建英文示例文档 docs/assets/examples-react/en/component/react-common-demo.md

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 在示例文档中使用 livedemo template=react-vchart 代码块
- [x] T005 引入示例数据与 spec，并渲染 CommonChart
- [x] T006 实现自定义 tooltipRender 并保留/隐藏默认内容逻辑

---

## Phase 3: User Story 1 - 在文档中查看示例 (Priority: P1) 🎯 MVP

**Goal**: 用户可在文档站点看到 React-VChart 组合图示例
**Independent Test**: 运行 rush docs，示例页面展示正确

- [x] T007 [US1] 在中文文档插入示例说明与代码 docs/assets/examples-react/zh/component/react-common-demo.md
- [x] T008 [US1] 在英文文档插入示例说明与代码 docs/assets/examples-react/en/component/react-common-demo.md
- [ ] T009 [US1] 校验图例、轴、tooltip 显示完整 rush docs 预览

---

## Phase 4: User Story 2 - 复制示例内容用于试验 (Priority: P2)

**Goal**: 示例代码可复制并在本地复现
**Independent Test**: 从页面复制代码，本地运行得到一致效果

- [x] T010 [US2] 确保示例代码块完整且无外部依赖 docs/assets/examples-react/\*/component/react-common-demo.md
- [x] T011 [US2] 在说明中提示如何复制与卸载 ReactDom docs/assets/examples-react/\*/component/react-common-demo.md

---

## Phase 5: User Story 3 - 理解交互行为 (Priority: P3)

**Goal**: 用户理解图例点击与 tooltip 自定义行为
**Independent Test**: 交互触发可见反馈，日志或视觉响应清晰

- [x] T012 [US3] 在示例中实现图例点击回调并说明 docs/assets/examples-react/\*/component/react-common-demo.md
- [x] T013 [US3] 在示例中实现自定义 tooltip 按钮渲染 docs/assets/examples-react/\*/component/react-common-demo.md

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T014 文案与元信息优化（title/keywords/cover/option） docs/assets/examples-react/\*/component/react-common-demo.md
- [x] T015 在 quickstart.md 补充本地验证步骤 specs/001-react-vchart-demo/quickstart.md

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → Polish
