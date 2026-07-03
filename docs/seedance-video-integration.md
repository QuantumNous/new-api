# Seedance Video Integration

This document describes the local NewAPI video model aliases used for Seedance channels.
It is intended for future Codex maintenance and operational handoff.

## Public Endpoint

Submit a video generation task:

```bash
curl --location --request POST 'https://token.mewinyou.shop/v1/video/generations' \
  --header 'Authorization: Bearer <user-api-key>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "model": "seedance-720p-fast-c37",
    "prompt": "海边日落，镜头缓慢向前推进，电影感，柔和光线",
    "duration": 4,
    "resolution": "720p",
    "size": "16:9",
    "mode_type": "text2video",
    "n": 1
  }'
```

Poll task status:

```bash
curl --location 'https://token.mewinyou.shop/v1/video/generations/<task_id>' \
  --header 'Authorization: Bearer <user-api-key>'
```

Users must call the public alias model names listed below. Do not expose or ask users to call
raw upstream model names such as `12:seedance-2.0-720p`.

## Public Models

| Public model | Upstream mapped model | Unit | Current sell price |
| --- | --- | --- | ---: |
| `seedance-720p-fast-c37` | `37:seedance-2.0-720p-fast` | per item | 3.90 |
| `seedance-720p-c37` | `37:seedance-2.0-720p` | per item | 5.20 |
| `seedance-480p-fast-c13` | `13:seedance-2.0-480p-fast` | per second | 0.39 |
| `seedance-480p-c13` | `13:seedance-2.0-480p` | per second | 0.47 |
| `seedance-480p-fast-c36` | `36:seedance-2.0-480p-fast` | per second | 0.39 |
| `seedance-720p-fast-c12` | `12:seedance-2.0-720p-fast` | per second | 0.58 |
| `seedance-720p-c12` | `12:seedance-2.0-720p` | per second | 0.68 |
| `seedance-720p-c33` | `33:seedance-2.0-720p` | per second | 0.68 |
| `seedance-720p-c29` | `29:seedance-2.0-720p` | per second | 0.68 |
| `seedance-1080p-c30` | `30:seedance-2.0-1080p` | per second | 1.04 |
| `seedance-720p-c31` | `31:seedance-2.0-720p` | per item | 9.75 |
| `seedance-720p-fast-c8` | `8:seedance-2.0-720p-fast` | per item | 8.19 |
| `seedance-720p-c8` | `8:seedance-2.0-720p` | per item | 9.75 |
| `seedance-720p-fast-c35` | `35:seedance-2.0-720p-fast` | per item | 8.19 |
| `seedance-720p-fast-4img-c18` | `18:seedance-2.0-720p-fast-4img` | per item | 6.24 |
| `seedance-720p-4img-c18` | `18:seedance-2.0-720p-4img` | per item | 7.80 |
| `seedance-720p-c17` | `17:seedance-2.0-720p` | per second | 0.68 |

The prices above include the currently configured 30% markup over the upstream cost list.
Do not divide these numbers by an exchange rate before writing `ModelPrice`.

## Billing Rules

NewAPI uses `ModelPrice` for all public Seedance aliases.

Per-second models are not listed in `TASK_PRICE_PATCH`, so their final quota is:

```text
ModelPrice * duration * group_ratio
```

Per-item models must be listed in `TASK_PRICE_PATCH`, so their final quota is:

```text
ModelPrice * group_ratio
```

The current `TASK_PRICE_PATCH` value should include only the per-item aliases:

```text
seedance-720p-fast-c37,
seedance-720p-c37,
seedance-720p-c31,
seedance-720p-fast-c8,
seedance-720p-c8,
seedance-720p-fast-c35,
seedance-720p-fast-4img-c18,
seedance-720p-4img-c18
```

Do not add per-second aliases to `TASK_PRICE_PATCH`.

## Model Marketplace

The model marketplace should show the 17 public aliases under vendor `即梦`.

Display metadata:

- Vendor: `即梦`
- Icon: `Jimeng.Color`
- Public alias models have `sync_official = 0`.
- Per-item aliases are tagged with `按条`.
- Per-second aliases are tagged with `按秒`.

The local frontend/backend patch uses `quota_type = 2` for marketplace display of per-second fixed-price models. This is display-only and does not drive runtime billing.

Raw upstream Seedance models are intentionally hidden:

```text
12:seedance-2.0-720p
12:seedance-2.0-720p-fast
13:seedance-2.0-480p
13:seedance-2.0-480p-fast
17:seedance-2.0-720p
18:seedance-2.0-720p-4img
18:seedance-2.0-720p-fast-4img
19:seedance-2.0-720p
19:seedance-2.0-720p-fast
26:seedance-2.0
29:seedance-2.0-1080p
29:seedance-2.0-720p
30:seedance-2.0-1080p
31:seedance-2.0-720p
33:seedance-2.0-720p
33:seedance-2.0-720p-fast
35:seedance-2.0-720p-fast
36:seedance-2.0-480p-fast
37:seedance-2.0-720p
37:seedance-2.0-720p-fast
8:seedance-2.0-720p
8:seedance-2.0-720p-fast
```

They should not appear in `/v1/models` or `/api/pricing`.

## Channel 17 Notes

The video channel named `video` has id `17`.

Important settings:

- Keep the public aliases in `channels.models`.
- Keep `channels.model_mapping` mapping each public alias to the raw upstream model.
- Keep raw upstream Seedance model names out of `abilities`.
- Keep raw upstream Seedance model metadata disabled with `models.status = 0`.
- Upstream model auto-sync for channel 17 should remain disabled, otherwise raw upstream models may reappear or public aliases may be treated as removed upstream models.

## AistarsLab Config Sync

Use the AistarsLab config endpoint to sync Seedance public aliases, prices, billing units, model marketplace metadata, and Channel 17 `models` / `model_mapping`.

Preview changes:

```bash
curl -sS 'https://token.mewinyou.shop/api/ratio_sync/aistarslab/sync' \
  -H 'Authorization: Bearer <Root API Key>' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":true}'
```

Apply changes:

```bash
curl -sS 'https://token.mewinyou.shop/api/ratio_sync/aistarslab/sync' \
  -H 'Authorization: Bearer <Root API Key>' \
  -H 'Content-Type: application/json' \
  -d '{"dry_run":false}'
```

Defaults:

```text
AISTARSLAB_CONFIG_URL=https://api.video.aistarslab.com/openapi/generation/config
AISTARSLAB_CONFIG_SYNC_CHANNEL_ID=17
AISTARSLAB_CREDIT_RATE=100
AISTARSLAB_MARKUP_RATE=1.3
AISTARSLAB_CONFIG_SYNC_ENABLED=false
AISTARSLAB_CONFIG_SYNC_INTERVAL_MINUTES=30
```

The sync key is read from `AISTARSLAB_API_KEY` first; if unset, it uses the configured sync channel API key.
Automatic sync is off by default and runs only on the master node when `AISTARSLAB_CONFIG_SYNC_ENABLED=true`.

## Verification Commands

Check that raw upstream Seedance names are not exposed:

```bash
curl -sS 'https://token.mewinyou.shop/api/pricing' \
  | jq -r '.data[]? | select(.model_name|test("^[0-9]+:seedance-2\\\\.0")) | .model_name'
```

Expected output: empty.

Check that all public aliases are visible:

```bash
curl -sS 'https://token.mewinyou.shop/api/pricing' \
  | jq -r '.data[]? | select(.model_name|test("^seedance-.*-c[0-9]+$")) | [.model_name, .quota_type, .model_price] | @tsv' \
  | sort
```

Expected count: 17.

`quota_type` meanings in this deployment:

```text
0 = token/ratio based
1 = per item
2 = per second, display-only marketplace extension
```

Check user-visible model list:

```bash
curl -sS 'https://token.mewinyou.shop/v1/models' \
  --header 'Authorization: Bearer <user-api-key>' \
  | jq -r '.data[]?.id' \
  | grep -E 'seedance|^[0-9]+:seedance' \
  | sort
```

Expected: public `seedance-...-cXX` aliases only.
