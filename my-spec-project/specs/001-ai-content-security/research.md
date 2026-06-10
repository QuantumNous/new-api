# Research: AI Content Security Management Module

**Date**: 2026-06-10
**Feature**: AI Content Security Management Module
**Purpose**: Resolve technical unknowns and document design decisions

---

## Decision: Multi-Engine Detection Architecture

**Decision**: Use four parallel detection engines — Keyword (AC Automaton), Regex (pre-compiled), NER (named entity recognition), and AI-powered (async with timeout fallback).

**Rationale**:
- Keyword matching provides the fastest baseline detection (< 10ms) for known sensitive terms.
- Regex handles structured patterns (phone numbers, IDs, emails) with predictable performance.
- NER catches entities that are not in static word lists (names, companies, addresses).
- AI detection provides the highest accuracy for semantic understanding but is intentionally asynchronous with a 3-second timeout to avoid blocking the request pipeline.
- Parallel execution of local engines (keyword, regex, NER) minimizes latency. AI engine runs concurrently but does not gate the final decision — its result refines the risk score if it returns in time.

**Alternatives considered**:
- Single AI-only detection: Rejected due to latency (> 3s) and cost. Would create a single point of failure.
- Single keyword-only detection: Rejected due to low accuracy for semantic content and inability to detect novel patterns.
- Sequential engine execution: Rejected because latency would accumulate. Parallel execution meets the < 20% overhead constraint.

---

## Decision: Nested Group Hierarchy with Materialized Path

**Decision**: Implement nested sensitive word groups using a materialized path pattern (`/1/2/3`) with a configurable max depth of 5.

**Rationale**:
- Materialized path allows efficient subtree queries without recursive CTEs (which have limited support in SQLite).
- A depth limit of 5 balances organizational flexibility with query performance and UI complexity.
- Groups are independent of users; policies bind groups to users, enabling reuse across users.

**Alternatives considered**:
- Adjacency list (parent_id only): Rejected because querying all descendants requires recursive CTEs, which are problematic for SQLite compatibility.
- Closure table: Rejected as overkill for a max depth of 5 and increases write complexity.

---

## Decision: Rule Action Priority (Block > Review > Mask > Alert > Pass)

**Decision**: When multiple rules match, apply the most restrictive action using a fixed priority order.

**Rationale**:
- Security-first principle: The safest action wins. This prevents a permissive rule from overriding a strict rule.
- Simple and predictable for administrators. No complex scoring or weighting required.
- Aligns with enterprise DLP practices where the strictest policy always applies.

**Alternatives considered**:
- Sum/average risk score: Rejected because a single low-risk alert could dilute a critical block rule.
- Configurable priority per rule: Rejected as unnecessary complexity for v1. Fixed priority is easier to reason about.

---

## Decision: Content Hashing for Audit Logs

**Decision**: Store SHA-256 hashes of original content in audit logs, never raw content.

**Rationale**:
- Compliance requirement: Audit logs should prove that detection occurred without becoming a secondary source of data leakage.
- Hash enables deduplication and correlation without storing sensitive text.
- Processed content (masked/redacted) can be stored if needed for debugging, as it is no longer sensitive.

**Alternatives considered**:
- Full content storage: Rejected due to data leakage risk in logs.
- No content reference at all: Rejected because forensics and debugging would be impossible.

---

## Decision: Global Enable/Disable Switch via Environment Variable

**Decision**: Implement a `SECURITY_ENABLED` environment variable that can disable the entire security module at runtime without code changes.

**Rationale**:
- Operational safety: If the security module causes issues in production, operators can disable it immediately.
- Simplifies incident response and rollback.
- Checked once at startup and cached; minimal runtime overhead.

**Alternatives considered**:
- Database-backed toggle: Rejected because it requires a healthy database connection during an incident.
- Compile-time flag: Rejected because it requires redeployment.

---

## Open Questions Resolved

| Unknown | Resolution | Source |
|---------|------------|--------|
| How to handle database compatibility for nested groups? | Materialized path pattern; avoids recursive CTEs | Research above |
| How to prevent AI detection from blocking requests? | Async execution with 3s timeout; local engines decide immediately | Research above |
| How to store audit logs without leaking data? | SHA-256 hashes only; processed content optionally | Research above |
| Which masking strategies to support? | Full replace, preserve first/last, preserve N/M, custom symbol | Spec FR-009 |
| How to handle rule conflicts? | Fixed priority order (block highest) | Research above |
