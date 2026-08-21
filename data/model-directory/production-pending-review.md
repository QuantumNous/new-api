# Production model-directory metadata: pending review

This file records live production catalogue names that are intentionally **not** included in `production-candidate.json`.
No production database write has been performed.

## Pending exact-name records

| Model name | Why it is excluded | Required before import |
| --- | --- | --- |
| `eleven_multilingual_v2` | Live production model has no reviewed metadata row yet. | Confirm authoritative provider/model documentation for series, modalities, context, categories, release date, and distillability. |
| `eleven_sound_v1` | Live production model has no reviewed metadata row yet. | Confirm authoritative provider/model documentation for series, modalities, context, categories, release date, and distillability. |

Repository evidence confirms these are audio models and identifies their billing behavior:

- `relay/channel/elevenlabs/constants.go` identifies `eleven_multilingual_v2` as text-to-speech and `eleven_sound_v1` as sound effects.
- `controller/model_list_test.go` classifies both names as `audio`.
- `relay/channel/elevenlabs/adaptor.go` documents character billing for `eleven_multilingual_v2` and requested-second billing for `eleven_sound_v1`.

Those facts are not sufficient to fill every directory filter field. Do not invent release dates, context windows, categories, or distillability. Add both rows to a new reviewed import file only after authoritative sources are attached to the review.

## Import boundary

`production-candidate.json` contains the 89 exact-name rows that overlap the current full production catalogue. It deliberately excludes these two records and all 24 reviewed candidates that are not currently live in the full catalogue.
