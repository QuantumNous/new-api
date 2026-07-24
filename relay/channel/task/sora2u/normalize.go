package sora2u

import (
	"strconv"
	"strings"
)

// apiOrigin normalizes channel Base URL to origin without /api suffix.
func apiOrigin(raw string) string {
	b := strings.TrimRight(strings.TrimSpace(raw), "/")
	for _, suf := range []string{createPath, "/api/v1/videos", "/api/v1", "/api"} {
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

// normalizeCreateBody maps OpenAI Videos / alias fields to Sora2U create JSON.
func normalizeCreateBody(body map[string]interface{}) {
	if body == nil {
		return
	}

	// duration: prefer existing duration, else seconds
	dur := asPositiveInt(body["duration"])
	sec := asPositiveInt(body["seconds"])
	if dur <= 0 && sec > 0 {
		body["duration"] = sec
	}
	delete(body, "seconds")

	// size → aspect_ratio (do not overwrite explicit aspect_ratio)
	if _, hasAR := stringField(body, "aspect_ratio"); !hasAR {
		if size, ok := stringField(body, "size"); ok {
			if ar, res := mapSizeToAspectRatio(size); ar != "" {
				body["aspect_ratio"] = ar
				if _, hasRes := stringField(body, "resolution"); !hasRes && res != "" {
					body["resolution"] = res
				}
			}
		}
	}
	delete(body, "size")

	// image_url → reference_url
	if u, ok := stringField(body, "image_url"); ok && u != "" {
		if _, has := stringField(body, "reference_url"); !has {
			body["reference_url"] = u
		}
	}
	delete(body, "image_url")

	// image / image_base64 → reference
	for _, key := range []string{"image", "image_base64"} {
		if v, ok := stringField(body, key); ok && v != "" {
			if _, has := stringField(body, "reference"); !has {
				body["reference"] = ensureDataURL(v, "image/png")
			}
		}
		delete(body, key)
	}
}

func ensureDataURL(raw, defaultMIME string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw
	}
	if strings.HasPrefix(raw, "data:") {
		return raw
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	return "data:" + defaultMIME + ";base64," + raw
}

func mapSizeToAspectRatio(size string) (aspectRatio, resolution string) {
	size = strings.TrimSpace(strings.ToLower(size))
	if size == "" {
		return "", ""
	}
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return "", ""
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return "", ""
	}
	switch {
	case w > h:
		aspectRatio = "16:9"
	case h > w:
		aspectRatio = "9:16"
	default:
		aspectRatio = "1:1"
	}
	short := w
	if h < w {
		short = h
	}
	switch {
	case short >= 1000:
		resolution = "1080p"
	case short >= 700:
		resolution = "720p"
	case short >= 400:
		resolution = "480p"
	}
	return aspectRatio, resolution
}

func stringField(body map[string]interface{}, key string) (string, bool) {
	v, ok := body[key]
	if !ok || v == nil {
		return "", false
	}
	switch x := v.(type) {
	case string:
		s := strings.TrimSpace(x)
		return s, s != ""
	default:
		return "", false
	}
}

func asPositiveInt(v interface{}) int {
	switch x := v.(type) {
	case nil:
		return 0
	case float64:
		if x > 0 {
			return int(x)
		}
	case float32:
		if x > 0 {
			return int(x)
		}
	case int:
		if x > 0 {
			return x
		}
	case int64:
		if x > 0 {
			return int(x)
		}
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(x))
		if err == nil && n > 0 {
			return n
		}
	}
	return 0
}
