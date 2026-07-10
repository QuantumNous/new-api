package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// BuildVideoRequestDataForLog returns user-facing request fields for usage log preview.
func BuildVideoRequestDataForLog(req *relaycommon.TaskSubmitReq) map[string]interface{} {
	if req == nil {
		return nil
	}

	data := map[string]interface{}{}
	if model := strings.TrimSpace(req.Model); model != "" {
		data["model"] = model
	}
	if prompt := strings.TrimSpace(req.Prompt); prompt != "" {
		data["prompt"] = prompt
	}

	duration := req.Duration
	if duration <= 0 {
		if seconds := strings.TrimSpace(req.Seconds); seconds != "" {
			if v, err := strconv.Atoi(seconds); err == nil && v > 0 {
				duration = v
			}
		}
	}
	if duration <= 0 && strings.HasPrefix(strings.TrimSpace(req.Model), "sora-2") {
		duration = 4
	}
	if duration > 0 {
		data["duration"] = duration
	}

	if modelName := strings.TrimSpace(req.Model); modelName == "kling-v3-motion-control" {
		appendKlingMotionRequestData(data, req)
	}

	size := normalizedVideoSize(req.Size)
	if size == "" && strings.HasPrefix(strings.TrimSpace(req.Model), "sora-2") {
		size = "720x1280"
	}
	appendVideoDerivedFields(data, size)
	data["actual_image_count"] = videoActualImageCount(req)

	if len(data) == 0 {
		return nil
	}
	return EnrichVideoRequestData(data)
}

// EnrichVideoRequestData fills derived video preview fields on stored or backfilled rows.
func EnrichVideoRequestData(data map[string]interface{}) map[string]interface{} {
	if len(data) == 0 {
		return nil
	}

	size := normalizedVideoSize(stringField(data["size"]))
	if size == "" {
		size = normalizedVideoSize(stringField(data["resolution_size"]))
	}
	appendVideoDerivedFields(data, size)

	if _, ok := data["duration"]; !ok {
		if seconds := stringField(data["seconds"]); seconds != "" {
			if v, err := strconv.Atoi(seconds); err == nil && v > 0 {
				data["duration"] = v
			}
		}
	} else if duration := coerceRequestInt(data["duration"]); duration > 0 {
		data["duration"] = duration
	}
	if count := coerceRequestInt(data["actual_image_count"]); count > 0 {
		data["actual_image_count"] = count
	} else {
		data["actual_image_count"] = 1
	}

	delete(data, "seconds")
	delete(data, "size")

	if _, ok := data["resolution"]; !ok {
		if model := strings.ToLower(stringField(data["model"])); strings.HasPrefix(model, "sora") {
			data["resolution"] = "720p"
			data["effective_resolution"] = "720P"
		}
	}

	return data
}

func appendKlingMotionRequestData(data map[string]interface{}, req *relaycommon.TaskSubmitReq) {
	if req == nil || req.Metadata == nil {
		return
	}
	md := req.Metadata
	if v, ok := md["character_orientation"].(string); ok && strings.TrimSpace(v) != "" {
		data["character_orientation"] = strings.TrimSpace(v)
	}
	if v, ok := md["mode"].(string); ok && strings.TrimSpace(v) != "" {
		data["mode"] = strings.TrimSpace(v)
	}
	if v, ok := md["keep_original_sound"].(string); ok && strings.TrimSpace(v) != "" {
		data["keep_original_sound"] = strings.TrimSpace(v)
	}
	if v, ok := md["image_url"].(string); ok && strings.TrimSpace(v) != "" {
		data["image_url"] = strings.TrimSpace(v)
	}
	if v, ok := md["video_url"].(string); ok && strings.TrimSpace(v) != "" {
		data["video_url"] = strings.TrimSpace(v)
	}
}

func appendVideoDerivedFields(data map[string]interface{}, size string) {
	if ar := videoAspectRatioFromSize(size); ar != "" {
		data["aspect_ratio"] = ar
	}
	if res := videoResolutionFromSize(size); res != "" {
		data["resolution"] = res
		data["effective_resolution"] = videoEffectiveResolution(res)
	} else if ratio, ok := data["size_ratio"]; ok {
		if res := videoResolutionFromSizeRatio(ratio); res != "" {
			data["resolution"] = res
			data["effective_resolution"] = videoEffectiveResolution(res)
		}
		delete(data, "size_ratio")
	}
}

func videoActualImageCount(req *relaycommon.TaskSubmitReq) int {
	if req == nil {
		return 1
	}
	if req.HasImage() || strings.TrimSpace(req.Image) != "" || strings.TrimSpace(req.InputReference) != "" {
		return 1
	}
	return 1
}

func normalizedVideoSize(size string) string {
	return strings.TrimSpace(size)
}

func videoAspectRatioFromSize(size string) string {
	w, h, ok := parseVideoDimensions(size)
	if !ok {
		return ""
	}
	return simplifyAspectRatio(w, h)
}

func videoResolutionFromSize(size string) string {
	switch normalizedVideoSize(size) {
	case "1280x720", "720x1280":
		return "720p"
	case "1792x1024", "1024x1792":
		return "1024p"
	case "1920x1080", "1080x1920":
		return "1080p"
	default:
		w, h, ok := parseVideoDimensions(size)
		if !ok {
			return ""
		}
		longEdge := w
		if h > longEdge {
			longEdge = h
		}
		switch {
		case longEdge >= 1900:
			return "1080p"
		case longEdge >= 1700:
			return "1024p"
		default:
			return "720p"
		}
	}
}

func videoResolutionFromSizeRatio(ratio interface{}) string {
	switch typed := ratio.(type) {
	case float64:
		switch {
		case typed >= 2.2:
			return "1080p"
		case typed >= 1.5:
			return "1024p"
		default:
			return "720p"
		}
	case float32:
		return videoResolutionFromSizeRatio(float64(typed))
	case int:
		return videoResolutionFromSizeRatio(float64(typed))
	case int64:
		return videoResolutionFromSizeRatio(float64(typed))
	case string:
		if v, err := strconv.ParseFloat(strings.TrimSpace(typed), 64); err == nil {
			return videoResolutionFromSizeRatio(v)
		}
	}
	return "720p"
}

func videoEffectiveResolution(resolution string) string {
	res := strings.ToUpper(strings.TrimSpace(resolution))
	if res == "" {
		return ""
	}
	if strings.HasSuffix(res, "P") {
		return res
	}
	return res + "P"
}

func parseVideoDimensions(size string) (int, int, bool) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(size)), "x")
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

func simplifyAspectRatio(w, h int) string {
	if w <= 0 || h <= 0 {
		return ""
	}
	g := gcd(w, h)
	return strconv.Itoa(w/g) + ":" + strconv.Itoa(h/g)
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	if a == 0 {
		return 1
	}
	return int(math.Abs(float64(a)))
}

func stringField(value interface{}) string {
	if value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func coerceRequestInt(value interface{}) int {
	switch typed := value.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case uint:
		return int(typed)
	case uint64:
		return int(typed)
	case uint32:
		return int(typed)
	case float64:
		return int(typed)
	case float32:
		return int(typed)
	case json.Number:
		if v, err := typed.Int64(); err == nil {
			return int(v)
		}
	case string:
		if v, err := strconv.Atoi(strings.TrimSpace(typed)); err == nil {
			return v
		}
	}
	return 0
}
