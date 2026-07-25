# Token Batch Edit Rollout

`TOKEN_BATCH_GROUP_ENABLED` controls the authenticated batch token editor. The current UI uses `PUT /api/token/batch`; the original `PUT /api/token/batch/group` route remains as a group-only compatibility alias. The flag defaults to `false` so every Go process sharing Redis can adopt the cache protocol before users can invoke either endpoint.

Batch group changes apply to every selected token. Batch available-quota changes apply the same absolute quota to each selected finite-quota token; tokens already configured for unlimited quota remain unchanged. PLG users can batch-edit quota, but the server continues to force their tokens to the `plg` group and disables cross-group retry.

Roll out in this order:

1. Deploy every Redis-sharing Go service and revision with `TOKEN_BATCH_GROUP_ENABLED=false`. This includes router, console, and any legacy Go service connected to the same Redis database.
2. Drain old revisions and their in-flight goroutines.
3. Wait for each drained process's pending in-memory token quota batches to flush to the database.
4. Only after the quota batches have flushed, purge existing `token:*` hashes or wait one full token-cache TTL. Do not purge while an old process can still flush a pending quota batch.
5. Enable `TOKEN_BATCH_GROUP_ENABLED=true` on the control-plane service that serves token management. In the split production runtime this is `newapi-console` only; `newapi-router` already has the compatible cache fencing/invalidation protocol but is not the capability owner for this console feature. The console reads the same runtime capability from `/api/status`, so the embedded batch action remains hidden while the flag is off and appears after the status cache refreshes.

Production keeps this setting explicit in `.github/workflows/gcp-deploy.yml` under the `deploy-console` job. The generic `.env.example` default remains `false` so a fresh or mixed-version environment cannot expose the endpoint before completing this rollout.

The quota batch store remains process-local. A safe rollout therefore depends on draining every old revision and allowing its pending batch to flush before cache cleanup or endpoint enablement.
