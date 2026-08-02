package sora

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/tidwall/gjson"
)

// volcNormalized holds fields extracted from VolcEngine official content[] format
// and mapped to OpenAI Videos–style upstream payload fields.
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

// normalizeVolcOfficialInBodyMap detects VolcEngine official content[] and rewrites
// bodyMap into OpenAI Videos fields. Returns true when conversion happened.
func normalizeVolcOfficialInBodyMap(bodyMap map[string]interface{}, raw []byte) bool {
	if bodyMap == nil || !isVolcOfficialContent(raw) {
		return false
	}
	n := parseVolcOfficialContent(raw, bodyMap)
	common.SysLog(fmt.Sprintf(
		"[sora] detected VolcEngine official content format, converting to OpenAI videos payload; model=%v images=%d videos=%d audios=%d",
		bodyMap["model"],
		len(n.ImageURLs),
		len(n.VideoURLs),
		len(n.AudioURLs),
	))
	applyVolcNormalized(bodyMap, n)
	return true
}

func parseVolcOfficialContent(raw []byte, bodyMap map[string]interface{}) *volcNormalized {
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
	} else if v, ok := bodyMap["generate_audio"].(bool); ok {
		n.GenerateAudio = v
	}
	if wm := gjson.GetBytes(raw, "watermark"); wm.Exists() {
		n.HasWatermark = true
		n.Watermark = wm.Bool()
	} else if v, ok := bodyMap["watermark"].(bool); ok {
		n.HasWatermark = true
		n.Watermark = v
	}

	return n
}

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

// applyVolcNormalized merges normalized VolcEngine fields into an OpenAI Videos payload.
func applyVolcNormalized(payload map[string]interface{}, n *volcNormalized) {
	if n == nil || payload == nil {
		return
	}
	if cur, _ := payload["prompt"].(string); strings.TrimSpace(cur) == "" && n.Prompt != "" {
		payload["prompt"] = n.Prompt
	}
	if len(n.ImageURLs) > 0 {
		images := append([]string(nil), n.ImageURLs...)
		payload["images"] = images
		payload["image"] = images[0]
	}
	if len(n.VideoURLs) > 0 {
		videos := append([]string(nil), n.VideoURLs...)
		payload["videos"] = videos
		payload["video_url"] = videos[0]
	}
	if len(n.AudioURLs) > 0 {
		audios := append([]string(nil), n.AudioURLs...)
		payload["audios"] = audios
		payload["audio_url"] = audios[0]
	}
	payload["generate_audio"] = n.GenerateAudio
	if n.HasWatermark {
		payload["watermark"] = n.Watermark
	} else if _, ok := payload["watermark"]; !ok {
		payload["watermark"] = false
	}
	delete(payload, "content")
}
