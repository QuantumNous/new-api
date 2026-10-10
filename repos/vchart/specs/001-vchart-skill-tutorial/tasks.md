# Tasks: 新增 vchart-skill 教程文档

**Input**: Design documents from `/specs/001-vchart-skill-tutorial/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 本特性未要求 TDD 或新增自动化测试，采用文档构建与人工验收检查。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认文档信息架构落点与文件命名，建立变更骨架

- [x] T001 Audit existing guide navigation structure in docs/assets/guide/menu.json and locate the "快速上手" sibling insertion position
- [x] T002 Create tutorial draft file skeleton in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md with top-level headings
- [x] T003 [P] Collect and normalize external reference links (VChart repo, Cursor docs, Trae docs) in specs/001-vchart-skill-tutorial/research.md for copy-safe usage

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 完成所有用户故事共享的导航与文档契约前置项

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Add a new zh tutorial menu node at the same level as "快速上手" in docs/assets/guide/menu.json
- [x] T005 Define final tutorial metadata (title/path/order) and align with menu mapping in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T006 [P] Add "与快速上手的关系" section anchor and intra-doc cross-reference in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T007 Validate menu path resolution and avoid dead links against docs/assets/guide/menu.json and docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 新用户可通过教程完成首次接入 (Priority: P1) 🎯 MVP

**Goal**: 新用户可完成 skill 安装、启用与最小示例闭环

**Independent Test**: 仅阅读该教程可完成安装与“生成简单图表”示例，不依赖额外上下文

### Implementation for User Story 1

- [x] T008 [US1] Write introduction and value proposition section in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T009 [US1] Add installation section with command `npx skills add VisActor/VChart` in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T010 [US1] Add installation section with command `npx skills add VisActor/VChart --skill vchart-development-assistant` in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T011 [P] [US1] Add Cursor skill setup reference and usage note in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T012 [P] [US1] Add Trae skill setup reference and usage note in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T013 [US1] Add "生成简单图表" demo walkthrough with expected output description in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T014 [US1] Add project skill-directory verification guidance (e.g., .cursor/skills style path explanation) in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T015 [US1] Run MVP content self-check against FR-003/FR-004/FR-006/FR-010/FR-011 in specs/001-vchart-skill-tutorial/checklists/requirements.md

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 现有用户可快速定位 vchart-skill 最佳实践 (Priority: P2)

**Goal**: 让已有 VChart 用户快速定位可复用实践与排障路径

**Independent Test**: 有经验用户可在 3 分钟内定位“样式调整/配置修复/注意事项”并完成实践迁移

### Implementation for User Story 2

- [x] T016 [US2] Add "调整图表样式" scenario with prompt examples and expected improvement notes in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T017 [US2] Add "修复配置问题" scenario with troubleshooting flow in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T018 [US2] Add "常见问题与注意事项" section for editor compatibility and context gaps in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T019 [P] [US2] Add quick-jump table of contents for scenario navigation in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T020 [US2] Validate scenario completeness against contract DOC-CONTENT-001 in specs/001-vchart-skill-tutorial/contracts/interface.md

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 文档维护者可长期维护教程一致性 (Priority: P3)

**Goal**: 确保教程长期可维护，结构与命名符合既有文档规范

**Independent Test**: 维护者可按既有流程更新教程且不破坏导航与链接

### Implementation for User Story 3

- [x] T021 [US3] Align naming/style conventions (headings, code block style, link labels) with neighboring docs in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T022 [US3] Add maintenance note for future command/link drift and update trigger in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T023 [P] [US3] Cross-check menu node consistency (zh/en labels and ordering) in docs/assets/guide/menu.json
- [x] T024 [US3] Update feature checklist status after maintainability review in specs/001-vchart-skill-tutorial/checklists/requirements.md

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全局收尾与最终验收

- [x] T025 [P] Run final markdown quality pass for docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md (typos, heading levels, code formatting)
- [x] T026 Verify link integrity contract DOC-LINK-001 for docs/assets/guide/menu.json and docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md
- [x] T027 Execute quickstart verification checklist in specs/001-vchart-skill-tutorial/quickstart.md and record outcome in specs/001-vchart-skill-tutorial/checklists/requirements.md
- [x] T028 [P] Prepare implementation handoff notes for /speckit.implement in specs/001-vchart-skill-tutorial/tasks.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - delivers MVP independently
- **User Story 2 (P2)**: Can start after Phase 2 - depends on US1 tutorial skeleton but independently testable
- **User Story 3 (P3)**: Can start after Phase 2 - focuses on maintainability and governance

### Within Each User Story

- Skeleton/navigation first
- Core scenario content next
- Review/checklist updates last

### Parallel Opportunities

- Phase 1: T003 in parallel with T001/T002
- Phase 2: T006 can run in parallel after T004 starts
- US1: T011 and T012 can run in parallel
- US2: T019 can run in parallel with T016/T017
- US3: T023 can run in parallel with T021/T022
- Polish: T025 and T028 can run in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Add Cursor skill setup reference in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md"
Task: "Add Trae skill setup reference in docs/assets/guide/zh/tutorial_docs/Basic/VChart_Skill_Usage.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate with quickstart and checklist gates

### Incremental Delivery

1. Deliver US1 as MVP (installation + simple chart)
2. Add US2 scenarios (style tuning + config fix)
3. Add US3 maintainability hardening
4. Run final polish and contract checks

### Parallel Team Strategy

1. One owner handles menu/navigation (T004-T007)
2. One owner writes US1 core tutorial (T008-T015)
3. One owner prepares US2/US3 improvements after US1 skeleton stabilizes

---

## Notes

- [P] tasks = different file segments, low coupling, can run in parallel
- [USx] labels map tasks directly to user stories for traceability
- Prefer finishing each phase checkpoint before starting broad parallel execution
