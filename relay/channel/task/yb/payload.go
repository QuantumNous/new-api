package yb

import (
	"fmt"
	"strconv"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// buildUpstreamPayload maps client TaskSubmitReq onto yabaoai body:
//
//	{ model, prompt, image?, metadata: { resolution, ratio, duration, ... } }
func buildUpstreamPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) (map[string]interface{}, error) {
	var modelName string
	if info != nil {
		if info.ChannelMeta != nil {
			modelName = strings.TrimSpace(info.UpstreamModelName)
		}
		if modelName == "" {
			modelName = strings.TrimSpace(info.OriginModelName)
		}
	}
	if modelName == "" {
		modelName = strings.TrimSpace(req.Model)
	}
	if modelName == "" {
		return nil, fmt.Errorf("model is empty")
	}

	prompt := strings.TrimSpace(req.Prompt)
	out := map[string]interface{}{
		"model":  modelName,
		"prompt": prompt,
	}

	if img := firstImage(req); img != "" {
		out["image"] = img
	}

	md := cloneMetadata(req.Metadata)

	if res := resolveResolution(req, md); res != "" {
		md["resolution"] = res
	}
	if ratio := resolveRatio(req, md); ratio != "" {
		md["ratio"] = ratio
	}
	if d := durationFromRequest(req); d > 0 {
		md["duration"] = d
	}

	if req.GenerateAudio != nil {
		md["generate_audio"] = *req.GenerateAudio
	}
	if req.Watermark != nil {
		md["watermark"] = *req.Watermark
	}

	if len(md) > 0 {
		out["metadata"] = md
	}
	return out, nil
}

func firstImage(req *relaycommon.TaskSubmitReq) string {
	if img := strings.TrimSpace(req.Image); img != "" {
		return img
	}
	if len(req.Images) > 0 {
		if img := strings.TrimSpace(req.Images[0]); img != "" {
			return img
		}
	}
	if img := strings.TrimSpace(req.InputReference); img != "" {
		return img
	}
	if req.Metadata != nil {
		for _, key := range []string{"image", "first_image", "first_frame"} {
			if img := strings.TrimSpace(asString(req.Metadata[key])); img != "" {
				return img
			}
		}
	}
	return ""
}

func resolveResolution(req *relaycommon.TaskSubmitReq, md map[string]interface{}) string {
	if res := strings.TrimSpace(req.Resolution); res != "" {
		return normalizeResolution(res)
	}
	if res := strings.TrimSpace(asString(md["resolution"])); res != "" {
		return normalizeResolution(res)
	}
	size := strings.TrimSpace(req.Size)
	if size != "" && !strings.Contains(size, ":") {
		return normalizeResolution(size)
	}
	return ""
}

func resolveRatio(req *relaycommon.TaskSubmitReq, md map[string]interface{}) string {
	for _, candidate := range []string{req.Ratio, req.AspectRatio, asString(md["ratio"]), asString(md["aspect_ratio"])} {
		if r := strings.TrimSpace(candidate); r != "" && strings.Contains(r, ":") {
			return r
		}
	}
	size := strings.TrimSpace(req.Size)
	if size != "" && strings.Contains(size, ":") {
		return size
	}
	return ""
}

func normalizeResolution(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.ReplaceAll(s, " ", "")
	switch s {
	case "480", "480p":
		return "480p"
	case "720", "720p":
		return "720p"
	case "1080", "1080p":
		return "1080p"
	case "4k", "2160", "2160p":
		return "4k"
	default:
		if strings.HasSuffix(s, "p") {
			return s
		}
		return strings.TrimSpace(raw)
	}
}

func cloneMetadata(src map[string]interface{}) map[string]interface{} {
	if src == nil {
		return make(map[string]interface{})
	}
	out := make(map[string]interface{}, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}

func asString(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case fmt.Stringer:
		return t.String()
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	default:
		return ""
	}
}

func asInt(v interface{}) (int, error) {
	switch t := v.(type) {
	case int:
		return t, nil
	case int64:
		return int(t), nil
	case float64:
		return int(t), nil
	case string:
		return strconv.Atoi(strings.TrimSpace(t))
	default:
		return 0, fmt.Errorf("unsupported int type %T", v)
	}
}
