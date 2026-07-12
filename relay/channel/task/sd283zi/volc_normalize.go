package sd283zi

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// volcNormalized holds fields extracted from VolcEngine official content[] format
// and mapped to 83zi / mingiz-sd2 upstream payload shape.
type volcNormalized struct {
	Prompt        string
	ImageURLs     []imageURLEntry
	VideoURLs     []string
	AudioURLs     []string
	GenerateAudio bool
	Watermark     bool
}

var volcOfficialContentTypes = map[string]struct{}{
	"text":      {},
	"image_url": {},
	"video_url": {},
	"audio_url": {},
}

// isVolcOfficialContent reports whether raw JSON looks like VolcEngine official
// video API format: a content array with at least one official type item.
func isVolcOfficialContent(raw []byte) bool {
	arr := gjson.GetBytes(raw, "content")
	if !arr.Exists() || !arr.IsArray() || len(arr.Array()) == 0 {
		return false
	}
	for _, item := range arr.Array() {
		t := strings.ToLower(strings.TrimSpace(item.Get("type").String()))
		if _, ok := volcOfficialContentTypes[t]; ok {
			return true
		}
	}
	return false
}

// detectAndNormalizeVolcOfficial detects VolcEngine official content[] format and
// maps it into 83zi submit fields. Returns nil when format is not official.
func detectAndNormalizeVolcOfficial(c *gin.Context, req *relaycommon.TaskSubmitReq) *volcNormalized {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil
	}
	raw, err := storage.Bytes()
	if err != nil || len(raw) == 0 {
		return nil
	}
	if !isVolcOfficialContent(raw) {
		return nil
	}

	n := parseVolcOfficialContent(raw, req)
	common.SysLog(fmt.Sprintf(
		"[83zi] detected VolcEngine official content format, converting to 83zi payload; model=%s images=%d videos=%d audios=%d",
		strings.TrimSpace(req.Model),
		len(n.ImageURLs),
		len(n.VideoURLs),
		len(n.AudioURLs),
	))

	// Fill TaskSubmitReq so existing convertCreatePayload paths pick them up.
	if strings.TrimSpace(req.Prompt) == "" && n.Prompt != "" {
		req.Prompt = n.Prompt
	}
	if len(req.Images) == 0 && strings.TrimSpace(req.Image) == "" && strings.TrimSpace(req.InputReference) == "" {
		for _, entry := range n.ImageURLs {
			req.Images = append(req.Images, entry.URL)
		}
	}
	if req.GenerateAudio == nil {
		v := n.GenerateAudio
		req.GenerateAudio = &v
	}
	if req.Watermark == nil {
		v := n.Watermark
		req.Watermark = &v
	}
	return n
}

func parseVolcOfficialContent(raw []byte, req *relaycommon.TaskSubmitReq) *volcNormalized {
	n := &volcNormalized{
		GenerateAudio: true,
		Watermark:     false,
	}

	var textParts []string
	for _, item := range gjson.GetBytes(raw, "content").Array() {
		t := strings.ToLower(strings.TrimSpace(item.Get("type").String()))
		switch t {
		case "text":
			if text := strings.TrimSpace(item.Get("text").String()); text != "" {
				textParts = append(textParts, text)
			}
		case "image_url":
			if u := strings.TrimSpace(item.Get("image_url.url").String()); u != "" {
				n.ImageURLs = append(n.ImageURLs, toImageURLEntry(u))
			}
		case "video_url":
			if u := strings.TrimSpace(item.Get("video_url.url").String()); u != "" {
				n.VideoURLs = append(n.VideoURLs, u)
			}
		case "audio_url":
			if u := strings.TrimSpace(item.Get("audio_url.url").String()); u != "" {
				n.AudioURLs = append(n.AudioURLs, u)
			}
		}
	}
	if len(textParts) > 0 {
		n.Prompt = strings.Join(textParts, "\n")
	}

	// Top-level generate_audio / watermark overrides defaults when present.
	if ga := gjson.GetBytes(raw, "generate_audio"); ga.Exists() {
		n.GenerateAudio = ga.Bool()
	} else if req != nil && req.GenerateAudio != nil {
		n.GenerateAudio = *req.GenerateAudio
	}
	if wm := gjson.GetBytes(raw, "watermark"); wm.Exists() {
		n.Watermark = wm.Bool()
	} else if req != nil && req.Watermark != nil {
		n.Watermark = *req.Watermark
	}

	return n
}

// applyVolcNormalized merges normalized VolcEngine fields into the upstream payload.
// Only called when detectAndNormalizeVolcOfficial returned a non-nil result.
func applyVolcNormalized(payload map[string]interface{}, n *volcNormalized) {
	if n == nil {
		return
	}
	if cur, _ := payload["prompt"].(string); strings.TrimSpace(cur) == "" && n.Prompt != "" {
		payload["prompt"] = n.Prompt
	}
	if _, ok := payload["image_urls"]; !ok && len(n.ImageURLs) > 0 {
		payload["image_urls"] = n.ImageURLs
	}
	if _, ok := payload["reference_video_urls"]; !ok || isEmptySlice(payload["reference_video_urls"]) {
		if len(n.VideoURLs) > 0 {
			payload["reference_video_urls"] = n.VideoURLs
		}
	}
	if _, ok := payload["audio_urls"]; !ok || isEmptySlice(payload["audio_urls"]) {
		if len(n.AudioURLs) > 0 {
			payload["audio_urls"] = n.AudioURLs
		}
	}
	payload["generate_audio"] = n.GenerateAudio
	payload["watermark"] = n.Watermark
}

func isEmptySlice(v interface{}) bool {
	switch s := v.(type) {
	case []any:
		return len(s) == 0
	case []string:
		return len(s) == 0
	default:
		return false
	}
}

// normalize83ziResolution coerces resolution to values accepted by 83zi / 星河
// multi-image API (720p or 1080p only). Volc official clients often send 480p.
// When fromVolc is true and resolution is missing, default to 720p.
func normalize83ziResolution(payload map[string]interface{}, fromVolc bool) {
	raw, _ := payload["resolution"].(string)
	raw = strings.ToLower(strings.TrimSpace(raw))
	normalized := coerce83ziResolution(raw, fromVolc)
	if normalized == "" {
		delete(payload, "resolution")
		return
	}
	if raw != "" && raw != normalized {
		common.SysLog(fmt.Sprintf(
			"[83zi] resolution %q not supported by upstream (720p/1080p only), coerced to %q",
			raw, normalized,
		))
	}
	payload["resolution"] = normalized
}

func coerce83ziResolution(res string, fromVolc bool) string {
	switch res {
	case "720p", "1080p":
		return res
	case "":
		if fromVolc {
			return "720p"
		}
		return ""
	default:
		// 480p / 480P / other volcano values → 720p
		return "720p"
	}
}
