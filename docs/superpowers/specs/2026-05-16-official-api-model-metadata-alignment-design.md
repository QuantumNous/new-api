# Official API Model Metadata Alignment Design

## Context

The live test site at `https://api.opwan.ai/` currently has model metadata that was partly imported or edited from mixed sources. Some entries may describe upstream aliases, preview names, or channel-specific models as if they were official API models. The user selected the strict source-of-truth policy: only exact model IDs present in official API model documentation should be treated as confirmed.

This design covers a conservative audit and update process for live model metadata. It does not cover code changes, channel routing, keys, pricing, users, balances, payment settings, subscriptions, logs, or vendor deletion.

## Goal

Align live model metadata with official API model documentation only.

The result should be:

- Every visible model has an exact official API documentation source.
- Context window, max output, modality, and capability tags match the official API documentation.
- Models without an exact official API documentation match are hidden and marked unconfirmed.
- No non-model operational data is changed.

## Source Of Truth

Use only official API model documentation pages as authoritative sources for model metadata.

For OpenAI models, use official OpenAI API model documentation such as `developers.openai.com/api/docs/models/...` or equivalent OpenAI API docs pages.

For Anthropic or Claude models, use official Anthropic/Claude API model documentation pages that list model IDs and model capability metadata.

Do not use provider blogs, release posts, third-party API marketplaces, upstream channel names, marketing pages, community posts, or inferred family relationships as authoritative sources for confirmed metadata.

## Classification

Each live model is classified into one of three states.

`official_api_exact`: The exact live `model_name` appears in official API model documentation. The model may remain visible only when it is already intended to be sold on the site, and metadata can be filled from the official documentation.

`official_api_family_only`: The official API documentation contains a related family or nearby model name, but not the exact live `model_name`. The model is treated as unconfirmed and hidden unless the user explicitly approves alias display later.

`not_in_official_api_docs`: No exact official API documentation match exists. The model is hidden and marked unconfirmed.

## Fields In Scope

Only these model metadata fields may be changed:

- `description`
- `tags`
- `vendor_id`
- `icon`
- `sync_official`
- `status`, only when hiding an unconfirmed model or keeping a confirmed model visible

The update process must preserve unrelated model fields unless a field is explicitly listed above.

## Fields And Systems Out Of Scope

Do not change:

- channels
- channel keys
- users
- balances
- token quotas
- billing ratios
- model ratios
- group ratios
- payment settings
- subscriptions
- logs
- route weights
- vendor records
- API tokens
- bound channel configuration

Vendor deletion is explicitly out of scope. Empty vendors created by earlier sync activity should be left alone unless the user separately approves a vendor cleanup task.

## Data Flow

1. Fetch the current live model list from the management API.
2. For each model, look up the exact `model_name` in official API model documentation.
3. Build a difference table with current live metadata, official metadata, classification, and proposed action.
4. Present the difference table to the user before any live write.
5. After approval, update only approved model metadata fields.
6. Verify the public pricing page and management model list after writes.

## Update Rules

For `official_api_exact` models:

- Set `vendor_id` and `icon` to the confirmed provider.
- Set `description` to a concise factual summary from official API docs.
- Set `tags` to reflect official capability facts only, including modality, tools, context window, and max output when documented.
- Set `sync_official=1`.
- Keep `status=1` only if the model has an exact official API documentation match and is intended to remain visible. Do not unhide a currently hidden model solely because it is official.

For `official_api_family_only` models:

- Set `sync_official=0`.
- Set `status=0`.
- Use a non-promotional description stating that the exact model ID is not confirmed in official API model documentation.

For `not_in_official_api_docs` models:

- Set `sync_official=0`.
- Set `status=0`.
- Use a non-promotional description stating that the model is not confirmed in official API model documentation.

## Error Handling

If official documentation is unavailable or ambiguous for a model, classify the model as unconfirmed for this pass and do not keep it visible based on inference.

If any live update request fails, stop further writes, report the successful and failed model IDs, and re-fetch live state before deciding next steps.

If a model has active bound channels but no official API documentation match, do not alter the channels. Hide only the model metadata entry.

## Verification

After any approved write, verify:

- The management model list shows expected `vendor_id`, `status`, `sync_official`, description, and tags.
- The public pricing endpoint does not show any unconfirmed model.
- Every visible model has an exact official API documentation source.
- No channel, pricing, user, balance, payment, subscription, or vendor mutation was performed as part of the task.

## User Review Gate

The user must review the difference table before live writes. Approval to this design does not approve live metadata writes by itself.
