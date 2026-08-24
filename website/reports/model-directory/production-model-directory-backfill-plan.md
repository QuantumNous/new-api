# Production Model Directory Metadata Backfill Plan

Generated at: 2026-08-21T15:26:15.572Z
Scopes:

- Full public pricing catalogue: `https://console.flatkey.ai/api/website/pricing`
- PLG models-directory catalogue: `https://console.flatkey.ai/api/website/pricing?group=plg`

This is a read-only review plan. No production database write was performed.

## Coverage snapshot

| Set | Count |
| --- | ---: |
| Current production full-catalogue models | 91 |
| Current production PLG models | 89 |
| Reviewed candidate metadata records | 113 |
| Full-catalogue exact-name overlap available for reuse | 89 |
| PLG exact-name overlap available for reuse | 87 |
| Production models without an exact reviewed record | 2 |
| Reviewed records not currently live in the full catalogue | 24 |
| Reviewed records not currently live in PLG | 26 |

The runtime table is currently empty in production (`metadata entries: 0`). The exact-name rule is intentional: a candidate record is not reused when its public model name differs by prefix, provider path, or alias.

## Proposed phases

1. Review and import `data/model-directory/production-candidate.json`, which contains the 89 exact-name records covering the full public catalogue. Of these, 87 cover the PLG models-directory catalogue.
2. Research and add exact-name records for `eleven_sound_v1` and `eleven_multilingual_v2`; do not infer their modality, context, release date, or distillability.
3. Keep the reviewed-but-not-live records out of production until their exact public names appear in the relevant catalogue scope.
4. Run the importer in `--dry-run` mode against production and review every insert/update/disable before any `--apply` execution.
5. After explicit approval, apply the reviewed set in one transaction, then rerun the read-only audit and require zero live metadata gaps.

The two excluded records and the evidence required to add them are tracked in `data/model-directory/production-pending-review.md`.

## Production-only pricing note

`gemini-embedding-001` is an input-only token model (`completion_ratio=0`), so its output filter price of `0` is a valid display value. The audit treats this zero as allowed for explicitly input-only models; no metadata backfill or pricing correction is required for this row.

## Reviewed records not currently live in the full catalogue

- `bytedance/seedance-2.0`
- `bytedance/seedance-2.0-fast`
- `claude-3-5-haiku-20241022`
- `doubao/doubao-seedance-2-0-260128`
- `gemini-2.0-flash`
- `gemini-2.5-flash-preview-tts`
- `gemini-2.5-pro-preview-tts`
- `gemini-3.1-flash-lite-preview`
- `gemini-3.7-flash`
- `gemini-flash-latest`
- `gemini-flash-lite-latest`
- `gemini-pro-latest`
- `gemma-4-26b-a4b-it`
- `gemma-4-31b-it`
- `jimeng-image-4.5`
- `jimeng-image-5.0-lite`
- `jimeng-video-3.0-fast`
- `jimeng-video-3.0-pro`
- `jimeng-video-seedance-2.0`
- `jimeng-video-seedance-2.0-fast`
- `jimeng-video-seedance-2.0-mini`
- `nano-banana-pro-preview`
- `veo-3.1-fast-generate-preview`
- `veo-3.1-generate-preview`

The PLG-only non-live list additionally contains `mirothinker-1-7-deepresearch` and `mirothinker-1-7-deepresearch-mini`.
