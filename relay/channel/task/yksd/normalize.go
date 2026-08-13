package yksd

import (
	"fmt"
	"strconv"
	"strings"
)

// normalizeCreateBody remaps client aliases into KYY snake_case fields
// and sets the upstream model name. Keeps watermark (unlike yk-video).
func normalizeCreateBody(body map[string]interface{}, modelName string) error {
	if body == nil {
		return nil
	}

	upstream := resolveUpstreamModel(modelName)
	if upstream != "" {
		body["model"] = upstream
	}

	if ar, _ := body["aspect_ratio"].(string); strings.TrimSpace(ar) == "" {
		if ratio, ok := body["ratio"].(string); ok {
			if r := strings.TrimSpace(ratio); r != "" {
				body["aspect_ratio"] = r
			}
		}
	}
	delete(body, "ratio")

	if _, hasDur := body["duration"]; !hasDur {
		if d := positiveIntFromAny(body["seconds"]); d > 0 {
			body["duration"] = d
		}
	}
	delete(body, "seconds")
	if d := positiveIntFromAny(body["duration"]); d > 0 {
		body["duration"] = d
	}

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

	if err := validateResolution(body, upstream); err != nil {
		return err
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

	normalizeSingleMediaField(body, "first_image")
	normalizeSingleMediaField(body, "last_image")

	if md, ok := body["metadata"].(map[string]interface{}); ok && md != nil {
		for k, v := range md {
			if _, exists := body[k]; !exists {
				body[k] = v
			}
		}
		delete(body, "metadata")
	}

	for _, k := range []string{"input_reference", "kind"} {
		delete(body, k)
	}
	return nil
}

func validateResolution(body map[string]interface{}, upstreamModel string) error {
	res, _ := body["resolution"].(string)
	res = strings.TrimSpace(res)
	if res == "" {
		return nil
	}
	allowed := allowedResolutions(upstreamModel)
	if allowed == nil {
		return nil
	}
	if _, ok := allowed[res]; !ok {
		keys := make([]string, 0, len(allowed))
		for k := range allowed {
			keys = append(keys, k)
		}
		return fmt.Errorf("resolution %q is not supported for model %s; allowed: %s", res, upstreamModel, strings.Join(keys, ", "))
	}
	return nil
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

// normalizeSingleMediaField coerces first_image/last_image to a single string URL.
func normalizeSingleMediaField(body map[string]interface{}, key string) {
	v, ok := body[key]
	if !ok {
		return
	}
	switch t := v.(type) {
	case string:
		if u := strings.TrimSpace(t); u != "" {
			body[key] = u
		} else {
			delete(body, key)
		}
	case []string:
		if len(t) > 0 && strings.TrimSpace(t[0]) != "" {
			body[key] = strings.TrimSpace(t[0])
		} else {
			delete(body, key)
		}
	case []interface{}:
		if len(t) > 0 {
			if s, ok := t[0].(string); ok && strings.TrimSpace(s) != "" {
				body[key] = strings.TrimSpace(s)
				return
			}
		}
		delete(body, key)
	default:
		delete(body, key)
	}
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

func durationFromBody(body map[string]interface{}) int {
	if body == nil {
		return 0
	}
	if d := positiveIntFromAny(body["duration"]); d > 0 {
		return d
	}
	return positiveIntFromAny(body["seconds"])
}
