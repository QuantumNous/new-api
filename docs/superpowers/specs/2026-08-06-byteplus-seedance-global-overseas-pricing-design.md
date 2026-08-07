# BytePlus Seedance Global Overseas Pricing Design

## Decision

Use BytePlus's overseas Seedance prices as the global token-price baseline for
the public Seedance model names. Customer-specific pricing is controlled only
through `GroupRatio`; the BytePlus adapter adds the official resolution and
video-input scenario ratio.

The billing formula remains:

```text
total_tokens * ModelRatio * GroupRatio * Seedance scenario ratio
```

No Seedance entry belongs in `ModelPrice` or `TASK_PRICE_PATCH`, because either
path would turn the task into per-call billing and bypass token reconciliation.

## Official Overseas Prices

Source: <https://docs.byteplus.com/en/docs/ModelArk/1544106>, verified
2026-08-06. The official page labels these prices as USD per million tokens;
the table below uses the equivalent USD per 1M token unit.

| Model | Resolution | No video input | Video input |
| --- | --- | ---: | ---: |
| Seedance 2.0 | 480p/720p | $7.0 | $4.3 |
| Seedance 2.0 | 1080p | $7.7 | $4.7 |
| Seedance 2.0 | 4K | $4.0 | $2.4 |
| Seedance 2.0 Fast | supported resolutions | $5.6 | $3.3 |
| Seedance 2.0 Mini | supported resolutions | $3.5 | $2.1 |

## Global ModelRatio Contract

With `QuotaPerUnit = 500000`, raw ratio `1` equals `$2 / 1M tokens`.
The built-in global ratios are therefore:

```json
{
  "seedance-2.0": 3.5,
  "seedance2.0-pro": 3.5,
  "Seedance2.0-pro": 3.5,
  "seedance-2.0-fast": 2.8,
  "seedance-2.0-mini": 1.75
}
```

`seedance2.0-pro` is the canonical Flatkey public alias for overseas
Seedance 2.0. Only this lowercase Pro alias is advertised. `Seedance2.0-pro`
remains a billing-compatible legacy spelling, but is not exposed as a second
canonical model.

Persisted `ModelRatio` settings replace the built-in map. Deploying this code
does not overwrite an existing production option, so rollout must merge all
five Seedance keys above into the persisted production map and preserve
unrelated entries.

## BytePlus Scenario Resolution

BytePlus continues to price from `OriginModelName`, while
`UpstreamModelName` remains the private endpoint selected by channel model
mapping. A BytePlus-local exact alias map resolves both Pro spellings to
`seedance-2.0` before the scenario table lookup.

The scenario table stores official prices in tenths of USD per million tokens:

| Pricing key | Baseline and scenario units |
| --- | --- |
| `seedance-2.0` | `70, 43, 77, 47, 40, 24` |
| `seedance-2.0-fast` | `56, 33` |
| `seedance-2.0-mini` | `35, 21` |

Integer tenths preserve the exact official rational ratios (`43/70`,
`77/70`, and so on) and avoid a one-quota truncation caused by first storing
decimal floats such as `4.3`.

## Group Pricing

At `GroupRatio = 1`, the effective price is the official table above. A customer
group price is the official price multiplied by that group's ratio. No
customer-specific model ratio is required.

If production contains Seedance-specific `GroupModelRatio` overrides, delete
them before rollout. A match overrides that group/model's effective group
ratio, breaking the contract that only `GroupRatio` controls customer-specific
pricing. If an override cannot be deleted immediately, set it to the expected
`GroupRatio` value.

Examples:

- Pro baseline with `GroupRatio = 1.2`: `$7.0 * 1.2 = $8.4 / 1M tokens`.
- Pro 720p video input with `GroupRatio = 1.2`:
  `$4.3 * 1.2 = $5.16 / 1M tokens`.

## Scope

- Add global Seedance `defaultModelRatio` entries.
- Advertise canonical `seedance2.0-pro` in the BytePlus model list.
- Add canonical `seedance2.0-pro` to the default console BytePlus channel
  configuration and regression-test that the legacy case alias is not listed.
- Resolve the canonical and legacy Pro aliases to the Seedance 2.0 scenario
  table.
- Replace BytePlus's approximate legacy tier units with exact overseas units.
- Update relay pre-consumption, completion settlement, and design-contract
  tests and documentation.
- Keep Doubao/VolcEngine's separate domestic price table unchanged.

## Multi-node and Deployment

The runtime change is stateless and reads the same persisted settings on every
node; it introduces no process-local coordination. Router/backend deployment is
required because request pre-consumption and task completion settlement use the
changed ratios. The default console must also be deployed because its built-in
BytePlus channel configuration now advertises canonical Pro.

Before deployment, update the persisted production `ModelRatio` map without
replacing unrelated keys, verify all exact Seedance names in that contract are
absent from `ModelPrice` and `TASK_PRICE_PATCH`, delete any Seedance
`GroupModelRatio` overrides or set them to the expected `GroupRatio` value,
then complete one real token-settled task.

## Rejected Alternatives

- Duplicate the Seedance 2.0 table under every alias: rejected because prices
  would drift independently.
- Use prefix or case-insensitive matching: rejected because nearby unknown
  model names could be billed as Seedance 2.0.
- Put the prices in `ModelPrice`: rejected because it disables authoritative
  `total_tokens` settlement.
