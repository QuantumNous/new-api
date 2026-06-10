# Implementation Plan: AI Content Security Management Module

**Branch**: `002-ai-content-security` | **Date**: 2026-06-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-ai-content-security/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement an AI content security management module for the New-API gateway that provides real-time detection and handling of sensitive content in both user requests and AI responses. The module includes a multi-engine detection system (keyword, regex, NER, AI-powered), configurable policy management with nested sensitive word groups, comprehensive audit logging, and a statistics dashboard. The feature ensures enterprise data protection and compliance when using third-party AI providers.

## Technical Context

**Language/Version**: Go 1.25.1

**Primary Dependencies**:
- Gin web framework (v1.9.1) — HTTP routing and middleware
- GORM (v1.25.2) — ORM for database operations
- go-redis (v8.11.5) — Caching layer for rules and policies
- anknown/ahocorasick — AC automaton for keyword matching
- dlclark/regexp2 — Advanced regex engine

**Storage**: SQLite / MySQL 5.7.8+ / PostgreSQL 9.6+ (all three must be supported simultaneously per project Rule 2)

**Testing**: Go Test + stretchr/testify

**Target Platform**: Linux server (containerized deployment via Docker)

**Project Type**: web-service (API gateway module)

**Performance Goals**:
- Keyword detection: < 10ms for 1,000 characters
- Regex detection: < 50ms for 1,000 characters
- Overall middleware overhead: < 20% additional latency
- Concurrent detection QPS: >= 1,000

**Constraints**:
- Must maintain compatibility with SQLite, MySQL, and PostgreSQL simultaneously
- Cannot use database-specific features without cross-DB fallback
- Detection must not block the request pipeline — timeout and degrade gracefully
- Audit logs must store content hashes only, never raw sensitive content

**Scale/Scope**:
- Support up to 10,000 sensitive word rules per deployment
- Support nested group hierarchies up to 5 levels deep
- Audit log retention: 30 days minimum

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| I. Specification-Driven Development | Plan references spec.md; all design artifacts trace to requirements | ✅ Pass | All sections map to FRs in spec |
| II. Test-First Quality Assurance | Test strategy includes contract, integration, and unit tests | ✅ Pass | Test coverage targets: unit >= 80%, integration >= 70% |
| III. Modular & Decoupled Architecture | Detection engines are independent; middleware is pluggable | ✅ Pass | Each engine can be tested and replaced independently |
| IV. Documentation as Code | Plan, spec, data model, and contracts co-located in specs/ | ✅ Pass | All docs under version control |
| V. Continuous Validation & Review | Constitution compliance verified in plan; gates enforced | ✅ Pass | No violations requiring justification |

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-content-security/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
controller/
├── security.go              # REST API handlers for security management

service/security/
├── detector.go              # Content detection orchestrator
├── engine.go                # Rule engine and priority resolver
├── mask.go                  # Masking/redaction strategies
├── policy.go                # Policy loading and evaluation
├── audit.go                 # Audit log writer
├── group.go                 # Group CRUD operations
├── rule.go                  # Rule CRUD operations
└── dashboard.go             # Statistics aggregation

middleware/
├── security.go              # Security detection middleware (request/response)

model/
├── security.go              # GORM models for security entities

dto/
├── security.go              # Request/response DTOs

constant/
├── security.go              # Security-related constants and enums

web/default/src/features/security/
├── components/              # React components for admin UI
├── pages/                   # Admin pages (groups, rules, policies, logs, dashboard)
└── api/                     # Frontend API clients
```

**Structure Decision**: Single backend module with dedicated service package. Frontend follows existing New-API pattern under `web/default/src/features/`. Detection engines are sub-packages within `service/security/` for modularity.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All constitution principles are satisfied without compromise.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
