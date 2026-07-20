package megabyai

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

func normalizeCreateBody(body map[string]interface{}) {
	if body == nil {
		return
	}
	syncDurationSeconds(body)

	if ar, ok := body["aspect_ratio"].(string); ok {
		ar = strings.TrimSpace(ar)
		if ar != "" {
			if ratio, _ := body["ratio"].(string); strings.TrimSpace(ratio) == "" {
				body["ratio"] = ar
			}
		}
		delete(body, "aspect_ratio")
	}

	mapSizeToRatioResolution(body)

	remapStringSlice(body, "images", "referenceImages")
	remapStringSlice(body, "image", "referenceImages")
	remapStringSlice(body, "input_reference", "referenceImages")
	remapStringSlice(body, "videos", "referenceVideos")
	remapStringSlice(body, "audios", "referenceAudios")

	if res, ok := body["resolution"].(string); ok {
		body["resolution"] = normalizeResolution(res)
	}

	// MegaByAI rejects OpenAI-only / aliased fields ("Extra inputs are not permitted").
	delete(body, "seconds")
	delete(body, "size")
	delete(body, "aspect_ratio")
	delete(body, "images")
	delete(body, "image")
	delete(body, "input_reference")
	delete(body, "videos")
	delete(body, "audios")
}

func rejectUnsupportedFrames(body map[string]interface{}) error {
	if body == nil {
		return nil
	}
	if _, ok := body["first_image"]; ok {
		return errors.New("first_image is not supported")
	}
	if _, ok := body["last_image"]; ok {
		return errors.New("last_image is not supported")
	}
	if meta, ok := body["metadata"].(map[string]interface{}); ok {
		if _, ok := meta["first_image"]; ok {
			return errors.New("first_image is not supported")
		}
		if _, ok := meta["last_image"]; ok {
			return errors.New("last_image is not supported")
		}
	}
	return nil
}

// syncDurationSeconds maps OpenAI `seconds` into MegaByAI `duration`.
// Upstream only accepts `duration`; callers must strip `seconds` after sync.
func syncDurationSeconds(body map[string]interface{}) {
	if body == nil {
		return
	}
	dur := positiveInt(body["duration"])
	sec := positiveInt(body["seconds"])
	if dur <= 0 && sec > 0 {
		body["duration"] = sec
	}
}

func mapSizeToRatioResolution(body map[string]interface{}) {
	size, ok := body["size"].(string)
	if !ok {
		return
	}
	size = strings.TrimSpace(size)
	delete(body, "size")
	if size == "" {
		return
	}

	// aspect-ratio style size (e.g. "16:9") → ratio only
	if strings.Contains(size, ":") {
		if ratio, _ := body["ratio"].(string); strings.TrimSpace(ratio) == "" {
			body["ratio"] = size
		}
		return
	}

	w, h, ok := parseWxH(size)
	if !ok {
		// bare resolution token like "720p"
		if _, hasRes := body["resolution"]; !hasRes {
			body["resolution"] = normalizeResolution(size)
		}
		return
	}

	if ratio, _ := body["ratio"].(string); strings.TrimSpace(ratio) == "" {
		switch {
		case w > h:
			body["ratio"] = "16:9"
		case h > w:
			body["ratio"] = "9:16"
		default:
			body["ratio"] = "1:1"
		}
	}
	if _, hasRes := body["resolution"]; !hasRes {
		short := w
		if h < w {
			short = h
		}
		body["resolution"] = normalizeResolution(fmt.Sprintf("%dp", short))
	}
}

func remapStringSlice(body map[string]interface{}, from, to string) {
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

func normalizeResolution(res string) string {
	res = strings.TrimSpace(res)
	if res == "" {
		return ""
	}
	lower := strings.ToLower(res)
	if strings.HasSuffix(lower, "p") && !strings.Contains(lower, ":") && !strings.Contains(lower, "x") {
		n, err := strconv.Atoi(strings.TrimSuffix(lower, "p"))
		if err == nil {
			switch {
			case n >= 720:
				return "720p"
			case n >= 480:
				return "480p"
			}
		}
		if lower == "720p" || lower == "480p" {
			return lower
		}
		return lower
	}
	if w, h, ok := parseWxH(lower); ok {
		short := w
		if h < w {
			short = h
		}
		return normalizeResolution(fmt.Sprintf("%dp", short))
	}
	return res
}

func parseWxH(size string) (w, h int, ok bool) {
	size = strings.ToLower(strings.TrimSpace(size))
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, false
	}
	return w, h, true
}

func positiveInt(v interface{}) int {
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
	case json.Number:
		n, err := x.Int64()
		if err == nil && n > 0 {
			return int(n)
		}
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(x))
		if err == nil && n > 0 {
			return n
		}
	}
	return 0
}
