package ykvideo

import (
	"strconv"
	"strings"
)

// normalizeCreateBody remaps client aliases into KYY model-center snake_case fields
// and sets the upstream model name.
func normalizeCreateBody(body map[string]interface{}, modelName string) {
	if body == nil {
		return
	}

	upstream := resolveUpstreamModel(modelName)
	if upstream != "" {
		body["model"] = upstream
	}

	// ratio → aspect_ratio
	if ar, _ := body["aspect_ratio"].(string); strings.TrimSpace(ar) == "" {
		if ratio, ok := body["ratio"].(string); ok {
			if r := strings.TrimSpace(ratio); r != "" {
				body["aspect_ratio"] = r
			}
		}
	}
	delete(body, "ratio")

	// seconds → duration
	if _, hasDur := body["duration"]; !hasDur {
		if d := positiveIntFromAny(body["seconds"]); d > 0 {
			body["duration"] = d
		}
	}
	delete(body, "seconds")
	if d := positiveIntFromAny(body["duration"]); d > 0 {
		body["duration"] = d
	}

	// size may be ratio or resolution
	if size, ok := body["size"].(string); ok {
		size = strings.TrimSpace(size)
		if size != "" {
			if strings.Contains(size, ":") {
				if ar, _ := body["aspect_ratio"].(string); strings.TrimSpace(ar) == "" {
					body["aspect_ratio"] = size
				}
			} else if _, hasRes := body["resolution"]; !hasRes {
				body["resolution"] = normalizeResolution(size)
			}
		}
		delete(body, "size")
	}

	if res, ok := body["resolution"].(string); ok {
		body["resolution"] = normalizeResolution(res)
	}

	remapStringSliceField(body, "images", "reference_images")
	remapStringSliceField(body, "image_urls", "reference_images")
	remapStringSliceField(body, "referenceImages", "reference_images")
	if img, ok := body["image"].(string); ok {
		u := strings.TrimSpace(img)
		delete(body, "image")
		if u != "" {
			if _, exists := body["reference_images"]; !exists {
				body["reference_images"] = []string{u}
			}
		}
	}

	remapStringSliceField(body, "videos", "reference_videos")
	remapStringSliceField(body, "video_urls", "reference_videos")
	remapStringSliceField(body, "referenceVideos", "reference_videos")

	remapStringSliceField(body, "audios", "reference_audios")
	remapStringSliceField(body, "audio_urls", "reference_audios")
	remapStringSliceField(body, "referenceAudios", "reference_audios")

	// Merge metadata without overriding explicit top-level keys.
	if md, ok := body["metadata"].(map[string]interface{}); ok && md != nil {
		for k, v := range md {
			if _, exists := body[k]; !exists {
				body[k] = v
			}
		}
		delete(body, "metadata")
	}

	// Drop OpenAI-only / internal fields that upstream does not expect.
	for _, k := range []string{"input_reference", "kind", "watermark"} {
		delete(body, k)
	}
}

func normalizeResolution(res string) string {
	res = strings.TrimSpace(res)
	if res == "" {
		return ""
	}
	lower := strings.ToLower(res)
	if strings.HasSuffix(lower, "p") && !strings.Contains(lower, ":") {
		return lower
	}
	if lower == "2k" || lower == "4k" {
		return lower
	}
	return res
}

func remapStringSliceField(body map[string]interface{}, from, to string) {
	if _, exists := body[to]; exists {
		delete(body, from)
		return
	}
	v, ok := body[from]
	if !ok {
		return
	}
	delete(body, from)
	switch t := v.(type) {
	case []string:
		if len(t) > 0 {
			body[to] = t
		}
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				if u := strings.TrimSpace(s); u != "" {
					out = append(out, u)
				}
			}
		}
		if len(out) > 0 {
			body[to] = out
		}
	case string:
		if u := strings.TrimSpace(t); u != "" {
			body[to] = []string{u}
		}
	}
}

func positiveIntFromAny(v interface{}) int {
	switch t := v.(type) {
	case int:
		if t > 0 {
			return t
		}
	case int64:
		if t > 0 {
			return int(t)
		}
	case float64:
		if t > 0 {
			return int(t)
		}
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(t)); err == nil && n > 0 {
			return n
		}
	}
	return 0
}
