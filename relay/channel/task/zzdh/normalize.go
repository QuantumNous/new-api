package zzdh

import (
	"fmt"
	"strconv"
	"strings"
)

func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	if b == "" {
		return defaultBase
	}
	for _, suf := range []string{createPath, "/v8/videos/generations", "/v8/videos", "/v8", "/v1/videos"} {
		b = trimSuffixFold(b, suf)
	}
	return strings.TrimRight(b, "/")
}

func trimSuffixFold(s, suf string) string {
	if len(s) < len(suf) {
		return s
	}
	tail := s[len(s)-len(suf):]
	if strings.EqualFold(tail, suf) {
		return strings.TrimRight(s[:len(s)-len(suf)], "/")
	}
	return s
}

// normalizeCreateBody maps aliases and validates ZZDH MiniMax-H3 create JSON.
// Returns an error for invalid fps / duration / aspect_ratio.
// Resolution is always stripped — delivery tier is locked by model name.
func normalizeCreateBody(body map[string]interface{}, upstreamModel string) error {
	if body == nil {
		return fmt.Errorf("empty request body")
	}

	// ApiMart-style image_with_roles → reference_images
	if _, has := body["reference_images"]; !has {
		if roles, ok := body["image_with_roles"]; ok && roles != nil {
			body["reference_images"] = roles
		}
	}
	delete(body, "image_with_roles")

	// ratio / size(with :) → aspect_ratio
	if ar := firstNonEmptyString(body, "aspect_ratio"); ar == "" {
		if ratio := firstNonEmptyString(body, "ratio"); ratio != "" && strings.Contains(ratio, ":") {
			body["aspect_ratio"] = ratio
		} else if size := firstNonEmptyString(body, "size"); size != "" && strings.Contains(size, ":") {
			body["aspect_ratio"] = size
		}
	}
	delete(body, "ratio")
	if size := firstNonEmptyString(body, "size"); size != "" && strings.Contains(size, ":") {
		delete(body, "size")
	}

	// seconds → duration
	dur := asPositiveInt(body["duration"])
	if dur <= 0 {
		if sec := asPositiveInt(body["seconds"]); sec > 0 {
			body["duration"] = sec
			dur = sec
		}
	}
	delete(body, "seconds")

	if dur > 0 && (dur < minDurSec || dur > maxDurSec) {
		return fmt.Errorf("duration must be between %d and %d seconds", minDurSec, maxDurSec)
	}

	if ar := firstNonEmptyString(body, "aspect_ratio"); ar != "" {
		if _, ok := allowedAspectRatios[ar]; !ok {
			return fmt.Errorf("unsupported aspect_ratio %q", ar)
		}
	}

	if fpsRaw, exists := body["fps"]; exists && fpsRaw != nil {
		fps := asPositiveInt(fpsRaw)
		if fps == 0 {
			if s, ok := fpsRaw.(string); ok {
				fps, _ = strconv.Atoi(strings.TrimSpace(s))
			}
		}
		if fps != 0 && fps != defaultFPS {
			return fmt.Errorf("fps must be %d", defaultFPS)
		}
		if fps == 0 {
			delete(body, "fps")
		} else {
			body["fps"] = defaultFPS
		}
	}

	// Delivery resolution is locked by model name (480p/720p/1080p/2k).
	// Always omit resolution/quality and resolution-like size so clients
	// carrying ApiMart values (e.g. 768P) do not get rejected upstream.
	delete(body, "resolution")
	delete(body, "quality")
	if size := firstNonEmptyString(body, "size"); size != "" && !strings.Contains(size, ":") {
		delete(body, "size")
	}

	// unsupported
	delete(body, "negative_prompt")

	body["model"] = strings.TrimSpace(upstreamModel)
	return nil
}

func resolutionFromModel(modelName string) string {
	compact := strings.ToLower(strings.TrimSpace(modelName))
	switch {
	case strings.HasSuffix(compact, "-480p") || strings.Contains(compact, "h3-480p"):
		return "480P"
	case strings.HasSuffix(compact, "-720p") || strings.Contains(compact, "h3-720p"):
		return "720P"
	case strings.HasSuffix(compact, "-1080p") || strings.Contains(compact, "h3-1080p"):
		return "1080P"
	case strings.HasSuffix(compact, "-2k") || strings.Contains(compact, "h3-2k"):
		return "2K"
	default:
		return ""
	}
}

func firstNonEmptyString(body map[string]interface{}, key string) string {
	v, ok := body[key]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return strings.TrimSpace(x)
	default:
		return strings.TrimSpace(fmt.Sprint(x))
	}
}

func asPositiveInt(v interface{}) int {
	switch x := v.(type) {
	case int:
		return x
	case int64:
		return int(x)
	case float64:
		return int(x)
	case float32:
		return int(x)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(x))
		if err != nil {
			return 0
		}
		return n
	default:
		return 0
	}
}

func durationFromBody(body map[string]interface{}) int {
	if body == nil {
		return 0
	}
	if d := asPositiveInt(body["duration"]); d > 0 {
		return d
	}
	return asPositiveInt(body["seconds"])
}
