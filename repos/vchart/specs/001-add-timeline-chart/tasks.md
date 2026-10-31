# Tasks: Timeline 图表类型

**Input**: Design documents from `/specs/001-add-timeline-chart/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Verify spec artifacts exist under specs/001-add-timeline-chart/
- [ ] T002 [P] Run targeted build for @visactor/vchart
- [ ] T003 [P] Add docs navigation placeholder for Timeline in packages/docs

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Define Timeline public types in packages/vchart-types/types/chart/timeline.d.ts
- [ ] T005 [P] Register timeline chart in packages/vchart/src/vchart-all.ts
- [ ] T006 [P] Create chart entry dir packages/vchart/src/chart/timeline/
- [ ] T007 Establish unit test scaffold in packages/vchart/**tests**/timeline/
- [ ] T008 [P] Add schema generation hookup in packages/vchart-schema for Timeline spec

## Phase 3: User Story 1 - 创建并展示时间轴图表 (Priority: P1) 🎯 MVP

**Goal**: 渲染包含时间点与事件点的 Timeline 基本图表  
**Independent Test**: 提供最小数据，成功渲染并可视识别时间顺序与事件

- [ ] T009 [P] [US1] Implement timeline spec transformer in packages/vchart/src/chart/timeline/transformer.ts
- [ ] T010 [P] [US1] Implement layout engine (horizontal/vertical) in packages/vchart/src/chart/timeline/layout/base.ts
- [ ] T011 [US1] Render time axis and event markers in packages/vchart/src/chart/timeline/render.ts
- [ ] T012 [US1] Wire data ingestion for timePoints/eventPoints in packages/vchart/src/chart/timeline/data.ts
- [ ] T013 [US1] Add minimal theme defaults for timeline in packages/vchart/src/theme/chart/timeline.ts
- [ ] T014 [US1] Add unit tests for transformer and data handling in packages/vchart/**tests**/timeline/
- [ ] T015 [US1] Add visual regression case for basic timeline in packages/vchart/**tests**/runtime/browser/
- [ ] T016 [US1] Create runtime demo in **tests**/runtime/browser/test-page/timeline-basic.ts

## Phase 4: User Story 2 - 切换时间轴布局 (Priority: P2)

**Goal**: 支持横向、纵向、径向、S 线布局切换  
**Independent Test**: 对同一数据切换布局后结构明显变化

- [ ] T017 [P] [US2] Implement vertical layout strategy in packages/vchart/src/chart/timeline/layout/vertical.ts
- [ ] T018 [P] [US2] Implement radial layout strategy in packages/vchart/src/chart/timeline/layout/radial.ts
- [ ] T019 [P] [US2] Implement s-curve layout strategy in packages/vchart/src/chart/timeline/layout/s-curve.ts
- [ ] T020 [US2] Add layout type switching in transformer and spec in packages/vchart/src/chart/timeline/transformer.ts
- [ ] T021 [US2] Add layout switch tests in packages/vchart/**tests**/timeline/
- [ ] T022 [US2] Add layout demo in **tests**/runtime/browser/test-page/timeline-layouts.ts

## Phase 5: User Story 3 - 展示多系列事件点 (Priority: P3)

**Goal**: 多系列事件点同时展示并可区分  
**Independent Test**: 同一时间轴显示多个系列，颜色/图例区分明显

- [ ] T023 [P] [US3] Series mapping for eventPoints in packages/vchart/src/chart/timeline/data.ts
- [ ] T024 [US3] Legend integration and series styling in packages/vchart/src/chart/timeline/render.ts
- [ ] T025 [US3] Add multi-series unit tests in packages/vchart/**tests**/timeline/
- [ ] T026 [US3] Multi-series demo in **tests**/runtime/browser/test-page/timeline-series.ts

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T027 [P] Add docs examples and API reference in packages/docs/docs/timeline/
- [ ] T028 Add dense events performance test and tuning in packages/vchart/src/chart/timeline/layout/\*
- [ ] T029 Add edge-case handling for timePoints-only datasets in packages/vchart/src/chart/timeline/data.ts
- [ ] T030 Add fallback behavior for unsupported layout types in packages/vchart/src/chart/timeline/transformer.ts
- [ ] T031 Add quickstart example validation using specs/001-add-timeline-chart/quickstart.md

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → Polish
- [P] 任务表示可并行（不同文件、无未完成依赖）
