# Doubao Agent Plan Base URL Design

## Context

VolcEngine / ByteDance Ark channels currently expose a small set of API base URL presets in the channel create/edit drawer. Operators can select standard Ark China, BytePlus Southeast Asia, or Doubao Coding Plan, but there is no first-class preset for Doubao Agent Plan.

Doubao Agent Plan uses subscription-style Agent Plan API keys and a dedicated OpenAI-compatible base URL:

```text
https://ark.cn-beijing.volces.com/api/plan/v3
```

If this URL is manually entered today, the VolcEngine adaptor still appends regular Ark paths such as `/api/v3/chat/completions`, which can produce invalid paths like:

```text
https://ark.cn-beijing.volces.com/api/plan/v3/api/v3/chat/completions
```

The goal is to make Agent Plan easy and safe to configure for AI tools by adding a preset in the UI and adapting backend path construction when the Agent Plan base URL is selected.

## Design

### Frontend

In `web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx`, add a new option to the VolcEngine channel type 45 API Base URL selector:

```text
Doubao Agent Plan
https://ark.cn-beijing.volces.com/api/plan/v3
```

The option appears alongside existing VolcEngine presets. Selecting it stores the full Agent Plan base URL in the channel `base_url` field. No new channel type is added.

### Backend

In `relay/channel/volcengine/adaptor.go`, introduce small URL helpers:

- `isVolcengineAgentPlanBase(baseURL string) bool`
- `buildVolcengineURL(baseURL, regularPath, agentPlanPath string) string`

For regular Ark base URLs, behavior stays unchanged:

```text
https://ark.cn-beijing.volces.com + /api/v3/chat/completions
```

For Agent Plan base URLs, paths use Agent Plan-compatible suffixes:

| Feature | Regular Ark path | Agent Plan path |
| --- | --- | --- |
| chat completions | `/api/v3/chat/completions` | `/chat/completions` |
| bot chat completions | `/api/v3/bots/chat/completions` | `/bots/chat/completions` |
| embeddings | `/api/v3/embeddings` | `/embeddings` |
| images generations | `/api/v3/images/generations` | `/images/generations` |
| rerank | `/api/v3/rerank` | `/rerank` |
| responses | `/api/v3/responses` | `/responses` |

This avoids appending `/api/v3` twice.

### Scope Boundary

This change does not modify `DoubaoVideo` channel behavior, does not add task-based video channel tests, and does not create or split channels automatically. Operators can create an `Ark-Agent Plan Image` channel manually using VolcEngine type 45 and the new Agent Plan base URL preset.

## Verification

- Backend unit tests cover regular Ark vs Agent Plan path generation for chat, images, and responses.
- Frontend typecheck ensures the new selector option compiles.
- Manual verification:
  1. Open `/channels`.
  2. Create or edit a VolcEngine channel.
  3. Select `Doubao Agent Plan` in API Base URL.
  4. Save and confirm `base_url` equals `https://ark.cn-beijing.volces.com/api/plan/v3`.
  5. Run a text or image model test and confirm requests do not contain `/api/plan/v3/api/v3`.
