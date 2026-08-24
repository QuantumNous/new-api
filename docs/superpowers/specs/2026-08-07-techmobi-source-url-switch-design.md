# TechMobi Channel Source URL Switch Design

Date: 2026-08-07

## Objective

Add a reversible channel-level switch that lets an explicitly configured TechMobi channel return the upstream video source URL directly. Enable it only for production channel 106. Preserve the existing GCS archive and white-label proxy behavior as the default for every channel.

This is a result-delivery behavior change. It must not modify Cloud Run traffic policy, revision retention, deployment workflows, Terraform, GCS infrastructure, or other video providers.

## Accepted Trade-offs

When the switch is enabled, customers can see the upstream hostname and provider infrastructure. Source URL availability and expiry are controlled by the upstream provider and may be shorter than the existing 24-hour GCS retention window. The user explicitly accepted both trade-offs.

## Configuration

Extend `dto.ChannelSettings` with:

```go
ReturnSourceURL bool `json:"return_source_url,omitempty"`
```

The zero value is `false`, so existing channel JSON and every unmodified channel retain current behavior. The field is honored only when the channel type is `constant.ChannelTypeTechMobiVideo`; setting it on another channel type has no effect.

No console UI is added. Production activation is an operational channel-106 configuration update after the compatible application revision is ready. The update must preserve all existing fields in the channel's `setting` JSON.

## Success Flow

During task polling:

1. Parse the TechMobi polling response as today.
2. Compute direct-source mode from the current channel type and channel setting.
3. If direct-source mode is disabled, run the existing GCS archive step unchanged and persist `VideoResult` metadata before marking the task successful.
4. If direct-source mode is enabled and the upstream URL is non-empty, skip GCS archival and persist the upstream URL in `Task.PrivateData.ResultURL`.
5. Continue storing a redacted polling response in `Task.Data`; do not reintroduce upstream URLs into task data or logs.
6. Complete status transition and billing settlement through the existing compare-and-swap path.
7. The TechMobi OpenAI-video conversion already returns `Task.GetResultURL()`, so the task query response exposes the persisted source URL without an additional response-layer exception.

Only tasks that reach success after the switch is active use the direct source URL. Existing GCS-backed tasks remain GCS-backed. Disabling the switch restores GCS archival for subsequent tasks; it does not rewrite already completed direct-source tasks.

## Failure and Retry Behavior

- If direct-source mode is enabled but a successful upstream response contains no usable URL, return a polling error before finalizing the task. The next polling cycle can retry.
- Do not fabricate a proxy URL for a missing upstream source URL in direct-source mode.
- Preserve current archive failure retry behavior when the switch is disabled.
- Preserve current URL and brand redaction in logs and stored upstream response data.
- Preserve exactly-once terminal transition and settlement behavior across multiple production nodes.

## Compatibility

- Default behavior remains GCS archive plus Flatkey proxy URL.
- Non-TechMobi channels ignore the new setting.
- Existing task rows require no migration.
- Existing `VideoResult` metadata and `/v1/videos/{task_id}/content` behavior remain valid for archived tasks.
- Direct-source tasks are consumed through the URL returned by the task query response. This change does not add a new content-proxy contract for those tasks.

## Operational Activation

1. Deploy a revision containing the switch support using the existing production workflow.
2. Update only channel 106's `setting` JSON to add `"return_source_url": true`, preserving all other setting keys.
3. Ensure the configuration update is visible to the polling node after deployment; the new revision must not rely on a stale pre-update channel cache.
4. Submit a new channel-106 task and verify the successful task response URL is the upstream HTTPS URL and no new object is written for that task under the GCS video-result prefix.
5. To restore GCS for new tasks, set `return_source_url` to `false` or remove the key. No traffic-policy or workflow rollback is required.

The exact production configuration mutation must be reviewed against the existing channel-update/cache-invalidation path during implementation planning. A direct SQL update is not acceptable unless cache visibility is handled explicitly.

## Tests

Use TDD and add service-level regression coverage before implementation:

1. Enabled TechMobi channel: successful source URL is persisted and returned; archive hook is not called.
2. Enabled TechMobi channel with empty URL: task is not finalized and settlement is not performed.
3. Disabled TechMobi channel: existing archive metadata and proxy URL behavior remain unchanged.
4. Non-TechMobi channel with the setting enabled: existing provider behavior remains unchanged.
5. Stored task data and logs remain scrubbed of upstream URLs in both modes.
6. A repeated poll after another node wins the terminal compare-and-swap does not settle twice.

Run the focused service, TechMobi adaptor, and controller tests, then the repository's standard Go checks that can complete within the environment. Record any pre-existing or timeout-only gaps separately.

## Deployment Recommendation

- Router deploy: not required by the direct-source decision path itself; the router already serializes the persisted result URL. If the standard production workflow deploys console and router as a paired immutable image, deploying the same revision to both is acceptable and does not require a workflow change.
- Console deploy: required because the console/master node owns task polling and persistence.
- Other deploy targets: no website, staging, Terraform, Cloudflare, or GCS configuration change is required for the feature.

## Non-goals

- Accelerating the upstream source URL.
- Guaranteeing a 24-hour lifetime for direct-source tasks.
- Backfilling source URLs for existing archived tasks.
- Returning source URLs for other white-label providers.
- Removing the existing GCS infrastructure or archive implementation.
