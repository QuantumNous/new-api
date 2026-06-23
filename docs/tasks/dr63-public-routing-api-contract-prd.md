# DR-63 Public Routing API Contract PRD

Status: ship

Date: 2026-06-23

Refs: R2/D-09; replaces the former Playground execution request contract.

## Problem

Downloaded Skill packages need a stable external execution contract. The old Playground-oriented request path let package-shaped requests carry fields that looked like trusted identity or execution policy, which creates ambiguity: the server must not trust package-provided `user_id`, `tenant_id`, Kids fields, entry point, model, prompt history, or routing hints.

## Scope

- Document the public routing request contract for external package clients.
- Use `Authorization: Bearer <runner key>` as the only trusted identity source.
- Require `deeprouter.skill_id` on the public routing endpoint.
- Support `deeprouter.skill_version_id` as an explicit package pin, verified server-side against the requested Skill.
- Force public routing analytics entry point to `skill_package`.
- Strip `deeprouter` before provider forwarding and reject pass-through when the extension exists.

## Non-Goals

- Do not add provider-native public routing surfaces.
- Do not trust package-provided user, tenant, Kids, model-selection, prompt, or policy fields.
- Do not change ordinary `/v1/chat/completions` compatibility behavior beyond existing Skill relay handling.

## Contract

Endpoint:

`POST /v1/routing/chat/completions`

Headers:

- `Authorization: Bearer <runner key>`
- `Content-Type: application/json`

Required body shape:

```json
{
  "messages": [
    {"role": "user", "content": "Run the skill on this input"}
  ],
  "deeprouter": {
    "skill_id": "<published skill id>",
    "skill_version_id": "<manifest-pinned skill version id>"
  }
}
```

Server behavior:

- The authenticated runner key resolves the user identity; body fields such as `user`, `user_id`, `tenant_id`, `kids_mode`, `policy_profile`, and nested identity-looking objects are ignored as identity sources.
- `deeprouter.skill_id` selects the Skill.
- `deeprouter.skill_version_id`, when present, pins execution to that exact active version for that Skill. Missing pins fall back to the Skill's current active version for backward compatibility.
- Public routing forces `entry_point=skill_package`, regardless of any package-provided `deeprouter.entry_point`.
- Provider payload is rebuilt from server-owned SkillVersion snapshot state: `instruction_template`, server-selected model whitelist entry, and the last user message.
- The `deeprouter` extension is stripped before upstream provider forwarding.

## Acceptance

- Public routing requests authenticate with runner key and never trust body identity fields.
- Public routing rejects missing `deeprouter.skill_id`.
- Public routing honors a valid `deeprouter.skill_version_id` pin and rejects mismatched, missing, or non-active version pins.
- Public routing forces `skill_package` entry point even when the package sends another entry point.
- Regression tests cover trusted-looking field ignorance and version pinning.

## Verification

- `go test ./internal/skill/relay ./middleware ./relay`
- Relevant tests must cover active-version fallback, explicit version pin success, cross-skill pin rejection, inactive pin rejection, public-routing entry-point forcing, and client identity spoofing attempts.
