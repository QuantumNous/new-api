# Seedance Native Passthrough Notes

## Goal

Make the local `seedance-compat` gateway preserve native Seedance request fields and content as much as possible when forwarding to NewAPI and then to BytePlus/Doubao upstream.

## What changed

### Request path

The compatibility layer at `deploy/newapi-local/seedance-compat` now:

- parses the incoming Seedance JSON as a raw object instead of a fixed struct
- keeps the full original request payload inside NewAPI `metadata`
- still derives:
  - `model`
  - `prompt` from the first text content item
  - `seconds` from `duration`

This keeps NewAPI validation working while avoiding loss of unknown Seedance fields.

### Doubao upstream conversion

The Doubao task adaptor now builds the final upstream payload from `metadata` without rewriting the request into a narrow typed shape.

It preserves:

- unknown top-level request fields
- `content` arrays with multiple text items
- content item `role`
- unknown content item fields
- nested media object fields such as extra properties under `video_url`
- tool entries with vendor-specific extra keys

It still overrides the final `duration` using NewAPI standard fields in this order:

1. `seconds`
2. `duration`
3. original metadata value

This keeps current NewAPI behavior for duration normalization while preserving the rest of the native request.

### Response path

The compatibility layer now translates both:

- task submit response
- task fetch response

from NewAPI/OpenAI-style video responses into a more Seedance-native task response shape.

Current translation behavior:

- `status` mapping:
  - `queued` / `pending` -> `queued`
  - `in_progress` / `processing` / `running` -> `processing`
  - `completed` / `succeeded` / `success` -> `succeeded`
  - `failed` / `failure` -> `failed`
- `task_id` is backfilled from `id` when missing
- `updated_at` is backfilled from `completed_at` when present
- `content.video_url` is built from:
  - `metadata.url`
  - or a first result URL inside upstream `content`

The translator preserves existing upstream fields by starting from the raw NewAPI response and then normalizing the Seedance-facing fields.

## Known limits

- NewAPI still requires a non-empty `prompt`, so the compatibility layer currently derives it from the first text item in `content`.
- If the upstream/NewAPI response does not contain vendor-native fields, the compatibility layer cannot invent them.
- This work focuses on the Seedance compatibility gateway and the Doubao task adaptor. Other vendor task adaptors are unchanged.

## Tests

Targeted regression coverage was added for:

- preserving unknown top-level Seedance request fields
- preserving multiple text content items
- preserving unknown content item fields
- preserving tool entry extras
- preserving nested media extras
- translating fetch responses back into Seedance-style task responses

Commands used:

```bash
cd deploy/newapi-local/seedance-compat && go test
cd ../.. && go test ./relay/channel/task/doubao
```
