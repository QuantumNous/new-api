package mao

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/tidwall/gjson"
)

// volcNormalized holds fields extracted from VolcEngine official content[] format
// and mapped to mao/catertx flat submit fields (role-aware for images).
type volcNormalized struct {
	Prompt          string
	FirstFrame      string
	LastFrame       string
	ReferenceImages []string
	VideoURLs       []string
	AudioURLs       []string
	GenerateAudio   bool
	Watermark       bool
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

func parseVolcOfficialContent(raw []byte) *volcNormalized {
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
			u := extractVolcMediaURL(item, "image_url")
			if u == "" {
				continue
			}
			role := strings.ToLower(strings.TrimSpace(item.Get("role").String()))
			switch role {
			case "first_frame":
				n.FirstFrame = u
			case "last_frame":
				n.LastFrame = u
			default:
				// reference_image, empty, or any other role → reference_images
				n.ReferenceImages = append(n.ReferenceImages, u)
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
	}
	if wm := gjson.GetBytes(raw, "watermark"); wm.Exists() {
		n.Watermark = wm.Bool()
	}

	return n
}

// normalizeVolcOfficialInBodyMap detects VolcEngine official content[] and mutates
// body into mao flat fields. Returns true when normalization was applied.
func normalizeVolcOfficialInBodyMap(body map[string]interface{}, raw []byte) bool {
	if body == nil || len(raw) == 0 {
		return false
	}
	if !isVolcOfficialContent(raw) {
		return false
	}

	n := parseVolcOfficialContent(raw)

	model, _ := body["model"].(string)
	common.SysLog(fmt.Sprintf(
		"[mao] detected VolcEngine official content format; model=%s images=%d videos=%d audios=%d first_frame=%t last_frame=%t",
		strings.TrimSpace(model),
		len(n.ReferenceImages),
		len(n.VideoURLs),
		len(n.AudioURLs),
		n.FirstFrame != "",
		n.LastFrame != "",
	))

	if n.Prompt != "" {
		if cur, _ := body["prompt"].(string); strings.TrimSpace(cur) == "" {
			body["prompt"] = n.Prompt
		}
	}
	if n.FirstFrame != "" {
		body["image"] = n.FirstFrame
	}
	if n.LastFrame != "" {
		body["last_frame"] = n.LastFrame
	}
	if len(n.ReferenceImages) > 0 {
		md := ensureMetadataMap(body)
		md["reference_images"] = append([]string(nil), n.ReferenceImages...)
	}
	if len(n.VideoURLs) > 0 {
		body["videos"] = append([]string(nil), n.VideoURLs...)
	}
	if len(n.AudioURLs) > 0 {
		body["audios"] = append([]string(nil), n.AudioURLs...)
	}

	// Top-level defaults so buildUpstreamPayload can merge into metadata.
	body["generate_audio"] = n.GenerateAudio
	body["watermark"] = n.Watermark

	delete(body, "content")
	return true
}

func ensureMetadataMap(body map[string]interface{}) map[string]interface{} {
	if existing, ok := body["metadata"].(map[string]interface{}); ok && existing != nil {
		return existing
	}
	md := make(map[string]interface{})
	body["metadata"] = md
	return md
}
