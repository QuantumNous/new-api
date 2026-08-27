# Automatic Channel Model Mapping Design

## Goal

Automatically convert provider-specific model IDs into the public canonical model names already used by New API routing, while retaining the exact upstream ID in `Channel.ModelMapping`.

## Scope

The first version covers channel creation, channel editing, and upstream-model synchronization. It does not replace channel selection, retry, priority, weight, pricing, or relay mapping.

No database schema or public API is added. Existing fields remain authoritative:

- `Channel.Models` and `Ability.Model` contain canonical public names.
- `Channel.ModelMapping` contains canonical-to-upstream translations for the channel.
- `Channel.Priority`, `Ability.Priority`, weight, and retry implement fallback.
- pricing and billing continue to use `RelayInfo.OriginModelName`.

## Canonicalization contract

For every configured model, the system produces a pair `(canonical, upstream)`:

1. Trim surrounding whitespace.
2. Apply only the data-driven prefix rules in `model/model_identity.go`.
3. Preserve dates, versions, `:0`, quantization suffixes, size suffixes, case, and all unrecognized namespaces.
4. Store `canonical` in `Channel.Models`.
5. When `canonical != upstream`, store `canonical -> upstream` in `Channel.ModelMapping`.
6. When both names are equal, no generated mapping entry is required.

Existing manual mappings are authoritative. A configured source model is retained as the canonical name and its mapping chain is not rewritten. Unrelated mapping entries are preserved. Collision checks and upstream availability resolve a mapping chain to the same terminal target as `ModelMappedHelper`; self-mapping terminates successfully and a real cycle rejects the operation.

## Collision policy

- Duplicate `(canonical, upstream)` pairs are deduplicated while preserving input order.
- Two different upstream IDs resolving to the same canonical name in one channel are rejected.
- A generated mapping that conflicts with an existing manual mapping is rejected.
- Empty model names and invalid `ModelMapping` JSON are rejected before persistence.
- Different channels may map the same canonical name to different upstream IDs; this is required for fallback.

All changes to `Models`, `ModelMapping`, settings, and derived abilities must succeed in one database transaction at the operation boundary. An invalid canonicalization or failed ability replacement must roll back the complete operation.

## Data flow

### Create channel

`controller.AddChannel` validates the request, normalizes each channel copy, then calls `model.BatchInsertChannels`. `AddAbilities` therefore receives canonical names only.

### Update channel

`controller.UpdateChannel` locks and loads the stored channel inside a transaction, merges omitted `type`, `models`, and `model_mapping` fields with the fresh stored values, normalizes the resulting model configuration, and persists the channel plus abilities through the same transaction.

PATCH compatibility is explicit:

- omitted fields and JSON `null` preserve stored `type`, `models`, and `model_mapping`;
- `type: 0` and `models: ""` preserve the current values;
- whitespace-only non-empty `models` is invalid;
- `model_mapping: ""` or `model_mapping: "{}"` clears the manual baseline, after which required generated mappings are rebuilt from the effective models;
- a non-empty mapping replaces the manual baseline before generated mappings are merged.

### Upstream synchronization

Detection compares each canonical local model with its exact upstream identity:

- if a local canonical model has a mapping chain, availability is checked using its terminal target;
- otherwise availability is checked using the canonical name;
- an upstream ID already covered by an active local model's terminal target is not reported as new;
- stale mappings whose source is not present in `Channel.Models` do not hide upstream additions.

Network discovery happens before locking. Persistence then reloads and locks the fresh channel, verifies that fetch-relevant channel configuration did not change during the network request, recomputes pending changes from the fresh `Models`, mapping, and settings, and commits models, mapping, settings, and abilities together. The freshness fingerprint includes channel type, key, effective base URL, proxy setting, header override, and stable multi-key configuration, but excludes the fetch-mutated polling index. Applying or auto-applying an upstream addition canonicalizes the raw upstream ID and adds both the canonical model and its mapping. Scheduled auto-sync keeps its existing add-only behavior; removal is staged and happens only through manual apply. Removing an unavailable terminal target manually removes the canonical model/ability; unrelated manual mappings remain untouched.

## Existing behavior reused

After the change, a request for `claude-fable-5` follows the current routing pipeline:

1. distributor selects the highest-priority ability for `claude-fable-5`;
2. `ModelMappedHelper` translates it to the selected channel's exact upstream ID;
3. a retryable failure lets the existing retry/distributor logic select the next priority;
4. billing continues to use `claude-fable-5` through `OriginModelName`.

## Non-goals

- a global compatibility-alias registry for accepting legacy provider-specific client requests;
- route-dependent customer pricing;
- automatic migration of every existing channel without an explicit edit or sync;
- fuzzy matching or removal of dates, versions, quantization, and model-size suffixes;
- changes to priority, weight, retry, distributor, or relay behavior;
- commit, push, PR, deploy, or production data migration.

## Verification

- Unit tests for canonicalization, terminal mapping chains and cycles, manual mapping preservation, invalid JSON, deduplication, and collisions.
- Controller/model tests proving create and update persist canonical `Models`, exact `ModelMapping`, and canonical abilities.
- Upstream-sync tests proving mapped terminal availability, canonical additions, removals, stale-mapping behavior, scheduled auto-sync, and rollback on ability-write failure.
- Targeted Go tests for `model` and `controller`, followed by the repository's applicable Go test gate.
