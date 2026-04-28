package doubao

import (
	"strconv"
	"strings"

	"github.com/tidwall/gjson"
)

const seedanceOutputFPS = 24

// seedanceDefaultResolution maps each model (and bare alias) to its default
// output resolution when the request body does not specify one.
var seedanceDefaultResolution = map[string]string{
	"doubao-seedance-2-0-260128":          "720p",
	"doubao-seedance-2-0-fast-260128":     "720p",
	"doubao-seedance-1-5-pro-251215":      "720p",
	"doubao-seedance-1-0-pro-250528":      "1080p",
	"doubao-seedance-1-0-pro-fast-251015": "1080p",
	"doubao-seedance-1-0-lite-i2v-250428": "720p",
	"doubao-seedance-1-0-lite-t2v-250428": "720p",
	// bare aliases
	"seedance-2-0-260128":          "720p",
	"seedance-2-0-fast-260128":     "720p",
	"seedance-1-5-pro-251215":      "720p",
	"seedance-1-0-pro-250528":      "1080p",
	"seedance-1-0-pro-fast-251015": "1080p",
	"seedance-1-0-lite-i2v-250428": "720p",
	"seedance-1-0-lite-t2v-250428": "720p",
}

// seedanceMaxDuration maps each model (and bare alias) to its maximum video
// duration in seconds, used as the upper-bound estimate when duration is absent.
var seedanceMaxDuration = map[string]int{
	"doubao-seedance-2-0-260128":          15,
	"doubao-seedance-2-0-fast-260128":     15,
	"doubao-seedance-1-5-pro-251215":      12,
	"doubao-seedance-1-0-pro-250528":      12,
	"doubao-seedance-1-0-pro-fast-251015": 12,
	"doubao-seedance-1-0-lite-i2v-250428": 12,
	"doubao-seedance-1-0-lite-t2v-250428": 12,
	// bare aliases
	"seedance-2-0-260128":          15,
	"seedance-2-0-fast-260128":     15,
	"seedance-1-5-pro-251215":      12,
	"seedance-1-0-pro-250528":      12,
	"seedance-1-0-pro-fast-251015": 12,
	"seedance-1-0-lite-i2v-250428": 12,
	"seedance-1-0-lite-t2v-250428": 12,
}

// seedanceInputVideoMaxDuration is the conservative upper-bound for input video
// duration when we cannot inspect the actual video file (upper Volc limit = 15 s).
const seedanceInputVideoMaxDuration = 15

// fallbackResolution / fallbackMaxDuration used when model name not in tables.
const (
	fallbackResolution  = "720p"
	fallbackMaxDuration = 12
)

// EstimateSeedanceTokens applies the Volc token formula to produce a conservative
// upper-bound token estimate for pre-charge locking.
//
// Formula (Volc docs):
//
//	tokens = (inputVideoDuration + outputDuration) × outputWidth × outputHeight × outputFPS / 1024
//
// Known values:
//   - outputFPS = 24 (fixed per Volc docs)
//   - resolution from body field "resolution" or model default
//   - duration from body field "duration", or frames/24 (ceil), or model max
//
// Conservative over-estimates (多锁不少锁):
//   - Input video duration: if content[] contains a video_url item, we cannot
//     read the actual clip length, so we use the Volc upper-limit of 15 s.
//   - Duration = -1 in body → use model max duration.
//   - Draft mode (1.5 pro only) is NOT discounted — over-lock 43-67%; acceptable.
//
// The body must be Volc-native shape (top-level fields only).
func EstimateSeedanceTokens(modelName string, body []byte) int64 {
	// 1. Resolve output resolution → width × height.
	res := ""
	if len(body) > 0 {
		res = gjson.GetBytes(body, "resolution").String()
	}
	if res == "" {
		if d, ok := seedanceDefaultResolution[modelName]; ok {
			res = d
		} else {
			res = fallbackResolution
		}
	}
	outW, outH := parseResolution(res)

	// 2. Resolve output duration in seconds.
	outDurSec := 0
	if len(body) > 0 {
		// Prefer frames over duration (frames / fps = seconds, ceiling).
		framesResult := gjson.GetBytes(body, "frames")
		if framesResult.Exists() && framesResult.Int() > 0 {
			frames := framesResult.Int()
			outDurSec = int((frames + seedanceOutputFPS - 1) / seedanceOutputFPS) // ceil
		} else {
			durResult := gjson.GetBytes(body, "duration")
			if durResult.Exists() {
				d := int(durResult.Int())
				if d > 0 {
					outDurSec = d
				}
				// d == 0 or -1 → fall through to model max
			}
		}
	}
	if outDurSec <= 0 {
		if maxDur, ok := seedanceMaxDuration[modelName]; ok {
			outDurSec = maxDur
		} else {
			outDurSec = fallbackMaxDuration
		}
	}

	// 3. Resolve input video duration (conservative upper bound).
	inputVideoDurSec := 0
	if len(body) > 0 {
		contentRaw := []byte(gjson.GetBytes(body, "content").Raw)
		if hasVideoInVolcContent(contentRaw) {
			inputVideoDurSec = seedanceInputVideoMaxDuration
		}
	}

	// 4. Apply formula.
	totalDurSec := inputVideoDurSec + outDurSec
	tokens := int64(totalDurSec) * int64(outW) * int64(outH) * int64(seedanceOutputFPS) / 1024
	return tokens
}

// parseResolution converts a resolution string to (width, height) in pixels.
//
// Supported formats:
//   - "480p"  → 854×480
//   - "720p"  → 1280×720
//   - "1080p" → 1920×1080
//   - "WxH"   → W×H (e.g. "1280x720")
//
// Unknown formats fall back to 1280×720 (720p).
func parseResolution(res string) (int, int) {
	res = strings.ToLower(strings.TrimSpace(res))
	switch res {
	case "480p":
		return 854, 480
	case "720p":
		return 1280, 720
	case "1080p":
		return 1920, 1080
	}
	// Try "WxH" format (ASCII 'x').
	if idx := strings.IndexByte(res, 'x'); idx > 0 {
		w, errW := strconv.Atoi(res[:idx])
		h, errH := strconv.Atoi(res[idx+1:])
		if errW == nil && errH == nil && w > 0 && h > 0 {
			return w, h
		}
	}
	// Fallback to 720p.
	return 1280, 720
}
