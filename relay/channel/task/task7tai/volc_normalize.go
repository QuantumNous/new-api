package task7tai

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// volcNormalized holds fields extracted from VolcEngine official content[] format
// and mapped to 7tai upstream payload shape.
type volcNormalized struct {
	Prompt        string
	ImageURLs     []string
	VideoURLs     []string
	AudioURLs     []string
	GenerateAudio bool
	HasWatermark  bool
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
// maps it into 7tai submit fields. Returns nil when format is not official.
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
		"[7tai] detected VolcEngine official content format, converting to 7tai payload; model=%s images=%d videos=%d audios=%d",
		strings.TrimSpace(req.Model),
		len(n.ImageURLs),
		len(n.VideoURLs),
		len(n.AudioURLs),
	))

	// content[] is authoritative for volcano format — always replace flat image fields
	// so a leftover top-level image/images does not drop the rest of the references.
	if n.Prompt != "" {
		if strings.TrimSpace(req.Prompt) == "" {
			req.Prompt = n.Prompt
		}
	}
	if len(n.ImageURLs) > 0 {
		req.Images = append([]string(nil), n.ImageURLs...)
		req.Image = req.Images[0]
		req.InputReference = ""
	}
	if req.GenerateAudio == nil {
		v := n.GenerateAudio
		req.GenerateAudio = &v
	}
	if n.HasWatermark && req.Watermark == nil {
		v := n.Watermark
		req.Watermark = &v
	}
	return n
}

func parseVolcOfficialContent(raw []byte, req *relaycommon.TaskSubmitReq) *volcNormalized {
	n := &volcNormalized{
		GenerateAudio: true,
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
			if u := extractVolcMediaURL(item, "image_url"); u != "" {
				n.ImageURLs = append(n.ImageURLs, u)
			}
		case "video_url":
			if u := extractVolcMediaURL(item, "video_url"); u != "" {
				n.VideoURLs = append(n.VideoURLs, u)
			}
		case "audio_url":
			if u := extractVolcMediaURL(item, "audio_url"); u != "" {
				n.AudioURLs = append(n.AudioURLs, u)
			}
		}
	}
	if len(textParts) > 0 {
		n.Prompt = strings.Join(textParts, "\n")
	}

	if ga := gjson.GetBytes(raw, "generate_audio"); ga.Exists() {
		n.GenerateAudio = ga.Bool()
	} else if req != nil && req.GenerateAudio != nil {
		n.GenerateAudio = *req.GenerateAudio
	}
	if wm := gjson.GetBytes(raw, "watermark"); wm.Exists() {
		n.HasWatermark = true
		n.Watermark = wm.Bool()
	} else if req != nil && req.Watermark != nil {
		n.HasWatermark = true
		n.Watermark = *req.Watermark
	}

	return n
}

// extractVolcMediaURL reads a media URL from a content item.
// Supports object {"url":"..."}, plain string, and top-level "url".
func extractVolcMediaURL(item gjson.Result, field string) string {
	node := item.Get(field)
	if node.Exists() {
		if node.Type == gjson.String {
			if u := strings.TrimSpace(node.String()); u != "" {
				return u
			}
		}
		if u := strings.TrimSpace(node.Get("url").String()); u != "" {
			return u
		}
	}
	if u := strings.TrimSpace(item.Get("url").String()); u != "" {
		return u
	}
	return ""
}

// applyVolcNormalized merges normalized VolcEngine fields into the 7tai upstream payload.
// Only called when detectAndNormalizeVolcOfficial returned a non-nil result.
func applyVolcNormalized(payload map[string]interface{}, n *volcNormalized) {
	if n == nil {
		return
	}
	if cur, _ := payload["prompt"].(string); strings.TrimSpace(cur) == "" && n.Prompt != "" {
		payload["prompt"] = n.Prompt
	}
	if len(n.ImageURLs) > 0 {
		payload["images"] = append([]string(nil), n.ImageURLs...)
	}
	if len(n.VideoURLs) > 0 {
		payload["videos"] = append([]string(nil), n.VideoURLs...)
	}
	if len(n.AudioURLs) > 0 {
		payload["audios"] = append([]string(nil), n.AudioURLs...)
	}
	payload["generate_audio"] = n.GenerateAudio
	if n.HasWatermark {
		payload["watermark"] = n.Watermark
	}
}

// normalize7taiResolution coerces resolution like 83zi: keep 720p/1080p only;
// other values (e.g. 480p) become 720p. When fromVolc and missing, default 720p.
// Final values are normalized to 7tai style (720P / 1080P).
func normalize7taiResolution(payload map[string]interface{}, fromVolc bool) {
	raw, _ := payload["resolution"].(string)
	rawLower := strings.ToLower(strings.TrimSpace(raw))
	normalized := coerce7taiResolution(rawLower, fromVolc)
	if normalized == "" {
		delete(payload, "resolution")
		return
	}
	if rawLower != "" && rawLower != normalized {
		common.SysLog(fmt.Sprintf(
			"[7tai] resolution %q not supported for VolcEngine-compatible path (720p/1080p only), coerced to %q",
			raw, normalized,
		))
	}
	payload["resolution"] = normalizeResolution(normalized)
}

func coerce7taiResolution(res string, fromVolc bool) string {
	switch res {
	case "720p", "1080p":
		return res
	case "":
		if fromVolc {
			return "720p"
		}
		return ""
	default:
		return "720p"
	}
}
