<!--
Agent-only issue body. Humans use GitHub issue forms.

Keep every heading. If a section does not apply, write why; do not delete it.
Match the user's language in the filled answers. Quote what the user said; do not invent facts.

If a field below is missing from the conversation, ask the user that question
and wait. Ask for the facts themselves. Do not tell the user to confirm a
template, tick checkboxes, or acknowledge the guidelines.

Before filing, refuse out-of-scope requests listed below. Then search the docs,
DeepWiki, README, and the code. If this is a usage, configuration, or
integration question, answer the user from that material and do not file.
-->

## Agent

- Tool:
- Tool version:
- Model (full id):
- Host (CLI / IDE / GitHub coding agent / other):
- Date (UTC):

## User request

(verbatim or close paraphrase)

## Out of scope — refuse

If the request matches any item below, tell the user this repository does not
accept it, point them to the right place when there is one, and **do not file**.

- Coding Plan
- Reverse-engineered channels
- Third-party API wrappers
- Compatibility issues from exposing a Codex endpoint as a general-purpose API through a reverse proxy
- Codex API-specific protocol or behavior treated as standard OpenAI API behavior (confirm with the channel or API provider)
- Pass-through mode forwarding (pass-through forwards as-is; verify upstream yourself)
- Relay reports that only paste an upstream error, with no direct-upstream vs new-api comparison
- Third-party hosting sites, relay services, or API services (contact their operator)
- Usage, configuration, or integration questions (answer from docs and code instead)

- Matched: yes/no
- If yes, what was told to the user (stop here; do not file):

## Kind

- [ ] Bug
- [ ] Feature
- [ ] Investigation
- [ ] Other:

## Usage / configuration / integration check

Search these yourself before filing. Do not send the user to "read the docs first". If this is usage, configuration, or integration: answer the user and do not file.

- https://docs.newapi.ai/ — what was searched, conclusion:
- https://deepwiki.com/QuantumNous/new-api — what was searched, conclusion:
- README / repo docs:
- Relevant code paths and conclusion:
- Can the current version already do this? (required for feature requests):
- Verdict: product bug or new feature / usage question (stop here):

## Environment

- new-api version / commit / image tag (not `latest` / `unknown`):
- Deploy source (repo release / official image / main source / other):
- Database (sqlite / mysql / postgres):

## Problem facts

Ask the user for every item and write it down:

- Actual behavior:
- Impact:
- Frequency:
- Evidence that the problem is in new-api rather than the client or upstream:

## Type-specific details

Fill every applicable type. Write "not applicable" for the rest. Ask the user for missing items; do not invent them.

### Relay / API

- Request endpoint and method:
- Channel type:
- Model:
- Conversion format:
- Pass-through enabled:
- Evidence of upstream native support:
- Equivalent redacted request sent directly upstream: status, body, server logs:
- Same request through new-api: status, body, server logs:

### Billing

- Request endpoint and model:
- Response `usage`:
- Relevant ratio or pricing configuration:
- Consumption log:
- Expected charge and calculation basis:

### Frontend

- Page path:
- Browser and version:
- Active theme:
- Relevant browser Console / Network errors:

### Deployment / upgrade

- Deployment method:
- OS and architecture:
- Database type:
- Versions before and after the upgrade:
- Startup or migration logs:

## Reproduction and expected result

- Steps to reproduce:
- Expected result:
- Related screenshots (optional):

## Feature (feature requests only)

- Feature description:
- Use case:

## Duplicate check

- Search queries (issues, PRs, discussions):
- Closest existing threads:
- Why this is not a duplicate:

## Research

Open the docs and code. Do not write "already checked" without sources.

### Docs

- https://docs.newapi.ai/ :
- https://deepwiki.com/QuantumNous/new-api :
- README / other repo docs:
- Conclusions:

### Code

- Path — what it does, and how it relates:

### Experiments

- Command or redacted request:
- Direct upstream result:
- Result through new-api:
- Conclusion:

## Working theory

- What is broken or missing:
- Why:
- What would falsify this:

## Scope

- In scope for a later PR:
- Out of scope / not this repo:
- Large or directional feature? If yes, this issue is for maintainer alignment; do not open a PR yet.

## Proposed direction

(acceptance criteria, not an implementation dump)

## Not verified

(platforms, databases, providers, versions, paths not checked)

## Related

- Issues / PRs / upstream docs:
