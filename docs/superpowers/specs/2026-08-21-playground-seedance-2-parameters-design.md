# Playground Seedance 2.0 Parameter Repair Design

## Goal

Keep Playground controls and request payloads within the capabilities of the
Seedance 2.0 model variant selected by the user.

## Evidence

- BytePlus documents `seedance-2.0` with `480p`, `720p`, `1080p`, and `4k`.
- BytePlus documents `seedance-2.0-fast` and `seedance-2.0-mini` with only
  `480p` and `720p`.
- All Seedance 2.0 variants support `adaptive`, `16:9`, `4:3`, `1:1`, `3:4`,
  `9:16`, and `21:9` aspect ratios, `4` through `15` second durations, and
  `generate_audio`.
- BytePlus does not list `seed` as supported for the Seedance 2.0 series.
- Production per-second price rules have the same resolution split, and they
  reject an unknown resolution before the upstream request is submitted.

## Design

Define two immutable Playground profiles inside `media-generation.ts`:

1. The full profile for base and Pro aliases. It exposes `480p`, `720p`,
   `1080p`, and the exact upstream value `4k`.
2. The economy profile for Fast and Mini aliases. It exposes only `480p` and
   `720p`.

Both profiles default to `720p`, five seconds, `adaptive`, and audio enabled.
They expose the complete supported aspect-ratio set. They do not expose or
serialize `seed`.

Model resolution selects the economy profile when the normalized model name
contains a Fast or Mini variant marker; all other recognized Seedance 2.0
names, including base and Pro aliases, use the full profile. Existing profile
cloning and settings normalization will convert stale persisted values such as
Mini `1080p`, `4K`, or a removed ratio to the new defaults.

## Deliberate Limits

- Do not derive model capabilities from billing rules. Pricing configuration
  is not a model capability API.
- Do not expose `duration: -1`. Although BytePlus supports model-selected
  duration, the current per-second billing guard must know a positive duration
  before submission.
- Do not change relay adapters or production price configuration. Existing
  billing already rejects unsupported resolution combinations.

## Verification

- Unit tests prove the exact fields, defaults, and resolution options for base,
  Pro, Fast, and Mini aliases.
- Unit tests prove stale Fast/Mini settings normalize to valid defaults.
- Request-building tests prove `4k` stays lowercase and `seed` is absent.
- Run the complete Playground suite, TypeScript checks, targeted formatting and
  linting, and the production build check.
