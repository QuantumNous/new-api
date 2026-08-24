# Public Pricing Units Design

## Decision

Extend the existing `GET /api/website/pricing?group=plg` response with a
`display_pricing` map. The website consumes this display-ready contract first
and keeps the current `data`, `group_ratio`, and `group_model_ratio` formulas as
a compatibility fallback.

The public endpoint path does not change. The existing `/v2` endpoint is not a
dependency of this rollout.

## Goal

- Show configured video prices as `from $x / second` when a model has multiple
  valid per-second tiers.
- Show fixed image and other request-priced models per request.
- Show token-priced image and text models per one million tokens, including
  input, output, image, cache, and audio dimensions when configured.
- Keep older API responses and older frontend calculations working during a
  rolling deployment.

## Backend Contract

The v1 payload gains one additive top-level field:

```json
{
  "display_pricing": {
    "seedance-2.0": {
      "billing_kind": "per_second",
      "prices": {
        "second": {
          "configured": "0.1512",
          "plg": "0.13608",
          "from": true
        }
      }
    },
    "gpt-image-1": {
      "billing_kind": "token",
      "prices": {
        "input": { "configured": "5", "plg": "4.5" },
        "output": { "configured": "40", "plg": "36" },
        "image": { "configured": "10", "plg": "9" }
      }
    },
    "dall-e-3": {
      "billing_kind": "request",
      "prices": {
        "request": { "configured": "0.04", "plg": "0.036" }
      }
    }
  }
}
```

All monetary values are decimal strings. `configured` is the configured base
price. `plg` applies the same effective PLG group ratio as actual billing,
including per-model group overrides.

Supported `billing_kind` values are:

- `per_second`: the model appears in the live video price rule table;
- `request`: `quota_type=1` and no video rule applies;
- `token`: `quota_type=0` and no video rule applies;
- `tiered_expr`: the model uses an expression that cannot be safely reduced to
  a static public price.

Supported price keys are `second`, `request`, `input`, `output`, `cache`,
`image`, `audio_input`, and `audio_output`.

## Price Sources and Precedence

Video display prices come only from
`billing_setting.GetVideoPriceRules()`. For each visible model, the builder
selects the smallest positive finite `PricePerSecond` across its rules. It sets
`from=true` only when more than one valid rule exists for that model. Rule
dimensions, resolution, `basis`, fallback duration, and billing expressions
are never exposed.

For non-video models:

- request price is `ModelPrice`;
- token input price is `1_000_000 * ModelRatio / QuotaPerUnit`;
- output and optional token dimensions multiply the input price by their
  configured ratios.

For every value, PLG price is `configured * effective PLG group ratio`.
Per-second classification takes precedence over legacy `quota_type`, because
the video configuration is the active billing source for configured models.

## Payload Integration

Both v1 builders add the same field:

- `buildWebsitePublicGroupPricingPayload` builds display prices for its already
  filtered PLG-visible model list.
- `buildWebsitePricingPayloadDefault` builds display prices for its already
  filtered public model list but still prices the map for the PLG group.

If display-price construction fails, the response keeps serving the legacy
fields and returns an empty display map. A malformed optional display contract
must not take the established public pricing endpoint offline.

## Frontend Data Flow

`getPricingData` parses the top-level map and attaches the matching entry to
each `PricingModel` as `display_pricing`. Consumers use a shared resolver:

1. use a valid display-price pair for the requested dimension;
2. otherwise calculate from the legacy fields;
3. otherwise omit the price.

The resolver returns price text, numeric values for sorting/comparison, unit,
and the `from` flag. Units are rendered per row rather than in a fixed table
header:

- `per_second` -> `/ second` (Chinese locale may render `/ 秒`);
- `request` -> `/ request` (Chinese locale may render `/ 次`);
- `token` -> `/ 1M tokens`.

The `/models` directory, pricing model cards/drawer, and public model detail
page all use the resolver. Legacy payload tests prove that pages still render
when `display_pricing` is absent.

## Error Handling

- Non-finite, negative, or unparsable display values are ignored by the
  frontend and fall back to legacy calculations.
- A video rule with an invalid price is ignored for public display; the live
  configuration validator remains responsible for rejecting such rules at
  save/load time.
- No internal match dimensions or billing expressions are copied into
  `display_pricing`.

## Testing

- Go service tests cover request, token, optional token dimensions, minimum
  video tier selection, `from`, PLG model overrides, visibility, and invalid
  rule handling.
- Go controller tests assert both v1 payload builders include the additive map
  without removing legacy fields.
- TypeScript tests cover parsing, display-price precedence, all three units,
  `from`, malformed-new-field fallback, and old payload compatibility.
- Component/view-model tests cover the models directory and public model page.

## Non-Goals

- Do not expose video variants, match dimensions, resolution, duration basis,
  fallback duration, or billing expressions.
- Do not change billing calculations, configured prices, group ratios, API
  routing, or the `/v2` endpoint.
- Do not infer image billing mode from model names; use the actual pricing
  fields and `quota_type` supplied by the backend.
