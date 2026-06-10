---

description: "Task list for AI Content Security Management Module implementation"
---

# Tasks: AI Content Security Management Module

**Input**: Design documents from `/specs/001-ai-content-security/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `controller/`, `service/security/`, `middleware/`, `model/`, `dto/`, `constant/` at repository root
- **Frontend**: `web/default/src/features/security/` for admin UI
- **Tests**: Go test files co-located with source (`*_test.go`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create `constant/security.go` with enums for rule types, actions, risk levels, content types, and scopes
- [x] T002 [P] Create `dto/security.go` with request/response structs for groups, rules, policies, and logs
- [x] T003 [P] Create `web/default/src/features/security/` directory structure with `components/`, `pages/`, `api/` subdirectories
- [x] T004 [P] Create frontend API client `web/default/src/features/security/api/security.ts` with typed HTTP clients for all backend endpoints
- [x] T005 Configure security module environment variables in `.env.example` (`SECURITY_ENABLED`, `SECURITY_AI_TIMEOUT`, etc.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create `model/security.go` with GORM models for `SecurityGroup`, `SecurityRule`, `SecurityUserPolicy`, `SecurityHitLog`, and `SecurityAuditLog`
- [x] T007 Create database migration scripts compatible with SQLite, MySQL, and PostgreSQL for all security tables
- [x] T008 [P] Create `service/security/group.go` with group CRUD operations and nested hierarchy helpers (materialized path)
- [x] T009 [P] Create `service/security/rule.go` with rule CRUD operations and validation (syntax check for regex patterns)
- [x] T010 [P] Create `service/security/policy.go` with policy CRUD and user-group binding logic
- [x] T011 [P] Create `service/security/audit.go` with audit log writer for administrative actions
- [x] T012 Create `service/security/cache.go` with Redis-based rule/policy cache loader and invalidation logic
- [x] T013 Create `service/security/dashboard.go` with statistics aggregation queries (daily counts, top categories, top users)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Administrator Configures Security Policies (Priority: P1) 🎯 MVP

**Goal**: Enable administrators to create and manage sensitive word groups, detection rules, and user policies through a web interface.

**Independent Test**: An administrator can log into the admin panel, create a group, add rules, bind them to a user policy, and verify the configuration is persisted and active.

### Implementation for User Story 1

- [x] T014 [P] [US1] Create `controller/security.go` with admin API handlers for group CRUD (`GET/POST/PUT/DELETE /api/security/groups`)
- [x] T015 [P] [US1] Add `controller/security.go` handlers for rule CRUD (`GET/POST/PUT/DELETE /api/security/rules`)
- [x] T016 [P] [US1] Add `controller/security.go` handlers for policy CRUD (`GET/POST/PUT/DELETE /api/security/policies`)
- [x] T017 [US1] Add `controller/security.go` handler for group copy (`POST /api/security/groups/:id/copy`)
- [x] T018 [P] [US1] Create `web/default/src/features/security/pages/GroupListPage.tsx` - group management list with create/edit/delete/copy actions
- [x] T019 [P] [US1] Create `web/default/src/features/security/pages/RuleListPage.tsx` - rule management within a selected group
- [x] T020 [P] [US1] Create `web/default/src/features/security/pages/PolicyListPage.tsx` - user policy assignment and configuration
- [x] T021 [US1] Create `web/default/src/features/security/components/GroupFormModal.tsx` - modal form for creating/editing groups with parent selection
- [x] T022 [US1] Create `web/default/src/features/security/components/RuleFormModal.tsx` - modal form for creating/editing rules with type selector and content validation
- [x] T023 [US1] Register security admin routes in frontend router (`/admin/security/groups`, `/admin/security/rules`, `/admin/security/policies`)
- [x] T024 [US1] Add navigation menu item for Security Management in admin sidebar

**Checkpoint**: At this point, administrators can fully configure security policies via the web UI. User Story 1 should be independently functional and testable.

---

## Phase 4: User Story 2 - Real-Time Request Content Detection (Priority: P1) 🎯 MVP

**Goal**: Scan user requests before forwarding to AI providers and apply configured actions (mask, block, alert) based on detected sensitive content.

**Independent Test**: A user sends a request containing a phone number or confidential keyword; the system detects it and applies the configured action before the request reaches the AI provider.

### Implementation for User Story 2

- [x] T025 [P] [US2] Create `service/security/detector.go` with detection orchestrator interface and result aggregation logic
- [x] T026 [P] [US2] Create `service/security/engine_keyword.go` - AC automaton keyword detection engine using existing `anknown/ahocorasick` library
- [x] T027 [P] [US2] Create `service/security/engine_regex.go` - pre-compiled regex detection engine using `dlclark/regexp2`
- [x] T028 [P] [US2] Create `service/security/engine_ner.go` - named entity recognition engine (placeholder/interface for future NER integration)
- [x] T029 [P] [US2] Create `service/security/engine_ai.go` - AI-powered detection engine with async execution and 3-second timeout fallback
- [x] T030 [P] [US2] Create `service/security/mask.go` with masking strategies: full replace, preserve first/last, preserve N/M, custom symbol
- [x] T031 [P] [US2] Create `service/security/engine.go` with rule engine: loads active rules from cache, runs engines in parallel, resolves final action by priority (block > review > mask > alert > pass)
- [x] T032 [US2] Create `middleware/security.go` with `SecurityCheck()` middleware that intercepts requests after `TokenAuth()`, loads user policy, runs detection, and applies action
- [x] T033 [US2] Integrate `SecurityCheck()` middleware into the main request pipeline (`router/relay.go` or equivalent) for chat completion endpoints
- [x] T034 [US2] Create `service/security/hitlog.go` with async hit log writer that records detection events to `security_hit_logs` table
- [x] T035 [US2] Wire hit log recording into the middleware so every detection event is persisted with content hash (not raw content)

**Checkpoint**: At this point, request detection is fully operational. User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Real-Time Response Content Detection (Priority: P1) 🎯 MVP

**Goal**: Scan AI responses before delivering them to users, preventing sensitive data leakage from model outputs.

**Independent Test**: An AI response containing a credit card number or other sensitive pattern is detected and handled before reaching the user.

### Implementation for User Story 3

- [x] T036 [US3] Extend `middleware/security.go` with `SecurityCheckResponse()` middleware that intercepts AI responses
- [~] T037 [US3] Integrate `SecurityCheckResponse()` into the response pipeline so it executes after the upstream AI provider returns but before the response is sent to the client
- [x] T038 [US3] Update `service/security/hitlog.go` to support `content_type: 2` (response) in hit log records
- [x] T039 [US3] Ensure response detection reuses the same detection engines and masking logic as request detection (verify no code duplication)

**Checkpoint**: At this point, both request and response detection are operational. User Stories 1, 2, and 3 should all work independently.

---

## Phase 6: User Story 4 - Audit Log Query and Traceability (Priority: P2)

**Goal**: Enable security administrators to query, filter, and export historical detection events for compliance and investigation.

**Independent Test**: An administrator can open the audit log page, apply filters by user and date range, view matching events, and export results to Excel/CSV.

### Implementation for User Story 4

- [x] T040 [P] [US4] Add `controller/security.go` handler for audit log query (`GET /api/security/logs`) with pagination and multi-field filtering
- [x] T041 [P] [US4] Add `controller/security.go` handler for log export (`GET /api/security/logs/export`) supporting CSV and Excel formats
- [x] T042 [US4] Create `web/default/src/features/security/pages/LogListPage.tsx` - audit log query page with filter panel (user, model, date range, category, action, risk level)
- [x] T043 [US4] Create `web/default/src/features/security/components/LogDetailDrawer.tsx` - slide-out panel showing full detection event details
- [x] T044 [US4] Add log export button with format selection (CSV/Excel) to the Log List page

**Checkpoint**: At this point, User Stories 1-4 are all independently functional.

---

## Phase 7: User Story 5 - Security Event Statistics Dashboard (Priority: P3)

**Goal**: Provide administrators with a visual overview of security metrics and trends.

**Independent Test**: An administrator can open the dashboard and see summary cards, charts for top categories, top users, and risk distribution.

### Implementation for User Story 5

- [x] T045 [P] [US5] Add `controller/security.go` handler for dashboard statistics (`GET /api/security/dashboard`) with aggregated metrics for a given time range
- [x] T046 [P] [US5] Create `web/default/src/features/security/pages/DashboardPage.tsx` - main dashboard with summary cards (total detections, interceptions, alerts, today's count)
- [x] T047 [P] [US5] Create `web/default/src/features/security/components/RiskDistributionChart.tsx` - pie/bar chart showing risk level breakdown
- [x] T048 [P] [US5] Create `web/default/src/features/security/components/TopCategoriesChart.tsx` - bar chart of top triggered sensitive categories
- [x] T049 [P] [US5] Create `web/default/src/features/security/components/TopUsersTable.tsx` - table of top users with most detection events
- [x] T050 [US5] Register dashboard route in frontend router (`/admin/security/dashboard`) and add to navigation menu

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T051 [P] Add `controller/security.go` handler for global security status check (`GET /api/security/status`) exposing module health and rule cache stats
- [x] T052 [P] Implement global enable/disable switch logic in `middleware/security.go` reading `SECURITY_ENABLED` env var at startup
- [x] T053 [P] Add input validation middleware for all security admin APIs to prevent XSS and injection attacks
- [x] T054 [P] Create backend unit tests for detection engines (`service/security/engine_*_test.go`) with mock data and edge cases
- [x] T055 [P] Create integration tests for the full detection pipeline (`middleware/security_test.go`) using `httptest`
- [x] T056 Add rate limiting to security admin APIs to prevent abuse
- [x] T057 Performance optimization: pre-load all active rules into memory cache on startup and refresh on policy changes
- [~] T058 Run `quickstart.md` validation scenarios end-to-end and fix any issues
- [x] T059 Update project documentation (README or docs/) with security module setup and configuration instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Depends on US1 for policy configuration but detection engine can be tested with hardcoded policies
- **User Story 3 (P1)**: Can start after Foundational + US2 (shares detection engine) - No dependencies on US1 or US4
- **User Story 4 (P2)**: Can start after Foundational + US2 (needs hit logs) - No dependencies on US1, US3, US5
- **User Story 5 (P3)**: Can start after Foundational + US4 (needs log data for meaningful dashboard) - No dependencies on US1, US2, US3

### Within Each User Story

- Core backend implementation before frontend pages
- Models before services
- Services before controllers
- Controllers before frontend integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes:
  - US1 frontend pages and US2 detection engines can be developed in parallel
  - US4 log query and US5 dashboard can be developed in parallel after US2 completes
- All frontend components within a story marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (admin configuration)
4. Complete Phase 4: User Story 2 (request detection)
5. Complete Phase 5: User Story 3 (response detection)
6. **STOP and VALIDATE**: Test the core detection and admin flows end-to-end using `quickstart.md` Scenarios 1-3
7. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (admin ready!)
3. Add User Story 2 → Test independently → Deploy/Demo (request protection ready!)
4. Add User Story 3 → Test independently → Deploy/Demo (bidirectional protection ready!)
5. Add User Story 4 → Test independently → Deploy/Demo (audit ready!)
6. Add User Story 5 → Test independently → Deploy/Demo (full feature complete!)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (admin UI)
   - Developer B: User Story 2 (detection engine + request middleware)
   - Developer C: User Story 4 (audit logs, can start after US2 hit logging is ready)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (if tests are included)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
