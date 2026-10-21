/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * ============================================================================
 * Structured pricing types (image-gen / video-gen / audio-in / audio-out)
 * ============================================================================
 *
 * Mirrors setting/ratio_setting/{image,video,audio_in,audio_out}_pricing.go
 * on the backend, 1:1. Every JSON field name here MUST match the Go struct
 * `json:` tag exactly — they're serialized into
 * OptionMap["ImagePricing" | "VideoPricing" | "AudioInPricing" |
 * "AudioOutPricing"] and read on both sides.
 *
 * Values are ALWAYS in base USD (image-gen: $/image, video-gen: $/second,
 * audio-in: $/minute, audio-out: $/1M chars). The drawer's currency
 * conversion helpers translate to/from the admin-facing display currency.
 */

/**
 * ImagePricing — per-image billing with optional quality + size uplifts.
 * Matches Go: ratio_setting.ImagePricing
 */
export type ImagePricing = {
  price_per_image: number
  /** Keys are provider-specific quality tokens ("low"/"medium"/"high"/"hd"). */
  quality_multipliers?: Record<string, number>
  /** Keys are size strings ("1024x1024", "1024x1792"). */
  size_multipliers?: Record<string, number>
}

/**
 * VideoPricing — per-second billing with resolution multipliers and an
 * optional audio-on multiplier (Veo family).
 * Matches Go: ratio_setting.VideoPricing
 */
export type VideoPricing = {
  price_per_second: number
  /** Keys: "480p"/"720p"/"1080p"/"4k" — always lowercase. */
  resolution_multipliers?: Record<string, number>
  /** 1.0 or absent = no audio uplift; e.g. Veo 3.1 charges 1.5× on audio-on. */
  has_audio_multiplier?: number
}

/**
 * AudioInPricing — per-minute ASR billing with an optional floor.
 * Matches Go: ratio_setting.AudioInPricing
 */
export type AudioInPricing = {
  price_per_minute: number
  min_bill_minutes?: number
}

/**
 * AudioOutPricing — per-1M-characters TTS billing with optional voice
 * multipliers.
 * Matches Go: ratio_setting.AudioOutPricing
 */
export type AudioOutPricing = {
  price_per_million_chars: number
  voice_multipliers?: Record<string, number>
}

// ---------------------------------------------------------------------------
// Convenience empty-value factories — used when the drawer opens a new model
// with no existing entry. Each factory returns a struct with sensible defaults
// (empty maps rather than undefined) so downstream form components don't
// have to null-check.
// ---------------------------------------------------------------------------

export function emptyImagePricing(): ImagePricing {
  return {
    price_per_image: 0,
    quality_multipliers: {},
    size_multipliers: {},
  }
}

export function emptyVideoPricing(): VideoPricing {
  return {
    price_per_second: 0,
    resolution_multipliers: {},
    has_audio_multiplier: 0,
  }
}

export function emptyAudioInPricing(): AudioInPricing {
  return {
    price_per_minute: 0,
    min_bill_minutes: 0,
  }
}

export function emptyAudioOutPricing(): AudioOutPricing {
  return {
    price_per_million_chars: 0,
    voice_multipliers: {},
  }
}
