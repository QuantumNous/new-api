package sora

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
)

func TestIsVolcOfficialContent(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want bool
	}{
		{"empty", `{}`, false},
		{"openai prompt", `{"model":"x","prompt":"hi"}`, false},
		{"content text", `{"content":[{"type":"text","text":"hi"}]}`, true},
		{"content image", `{"content":[{"type":"image_url","image_url":{"url":"https://a.jpg"}}]}`, true},
		{"content other type", `{"content":[{"type":"file"}]}`, false},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := isVolcOfficialContent([]byte(tt.raw)); got != tt.want {
				t.Fatalf("got %v want %v", got, tt.want)
			}
		})
	}
}

func TestNormalizeVolcOfficialInBodyMap(t *testing.T) {
	raw := []byte(`{
		"model":"fd-Seedance 2.0 933",
		"content":[
			{"type":"text","text":"羽毛飘落"},
			{"type":"image_url","image_url":{"url":"https://example.com/a.jpg"},"role":"reference_image"},
			{"type":"video_url","video_url":{"url":"https://example.com/a.mp4"}},
			{"type":"audio_url","audio_url":{"url":"https://example.com/a.mp3"}}
		],
		"duration":14,
		"ratio":"16:9",
		"resolution":"720p"
	}`)
	var bodyMap map[string]interface{}
	if err := common.Unmarshal(raw, &bodyMap); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(bodyMap, raw) {
		t.Fatal("expected normalize to run")
	}
	if _, ok := bodyMap["content"]; ok {
		t.Fatal("content should be removed")
	}
	if bodyMap["prompt"] != "羽毛飘落" {
		t.Fatalf("prompt = %v", bodyMap["prompt"])
	}
	images, ok := bodyMap["images"].([]string)
	if !ok || len(images) != 1 || images[0] != "https://example.com/a.jpg" {
		t.Fatalf("images = %#v", bodyMap["images"])
	}
	if bodyMap["image"] != "https://example.com/a.jpg" {
		t.Fatalf("image = %v", bodyMap["image"])
	}
	videos, ok := bodyMap["videos"].([]string)
	if !ok || len(videos) != 1 || videos[0] != "https://example.com/a.mp4" {
		t.Fatalf("videos = %#v", bodyMap["videos"])
	}
	if bodyMap["video_url"] != "https://example.com/a.mp4" {
		t.Fatalf("video_url = %v", bodyMap["video_url"])
	}
	audios, ok := bodyMap["audios"].([]string)
	if !ok || len(audios) != 1 || audios[0] != "https://example.com/a.mp3" {
		t.Fatalf("audios = %#v", bodyMap["audios"])
	}
	if bodyMap["audio_url"] != "https://example.com/a.mp3" {
		t.Fatalf("audio_url = %v", bodyMap["audio_url"])
	}
	if bodyMap["generate_audio"] != true {
		t.Fatalf("generate_audio = %v", bodyMap["generate_audio"])
	}
	if bodyMap["watermark"] != false {
		t.Fatalf("watermark = %v", bodyMap["watermark"])
	}
	out, err := common.Marshal(bodyMap)
	if err != nil {
		t.Fatal(err)
	}
	if gjson.GetBytes(out, "duration").Int() != 14 {
		t.Fatalf("duration missing: %v", bodyMap["duration"])
	}
}

func TestNormalizeVolcOfficialKeepsExistingPrompt(t *testing.T) {
	raw := []byte(`{
		"prompt":"keep-me",
		"content":[{"type":"text","text":"from-content"}]
	}`)
	bodyMap := map[string]interface{}{
		"prompt":  "keep-me",
		"content": []any{map[string]any{"type": "text", "text": "from-content"}},
	}
	if !normalizeVolcOfficialInBodyMap(bodyMap, raw) {
		t.Fatal("expected normalize")
	}
	if bodyMap["prompt"] != "keep-me" {
		t.Fatalf("prompt overwritten: %v", bodyMap["prompt"])
	}
}

func TestNormalizeVolcOfficialNoopForOpenAI(t *testing.T) {
	raw := []byte(`{"model":"x","prompt":"hi","images":["https://a.jpg"]}`)
	bodyMap := map[string]interface{}{
		"model":  "x",
		"prompt": "hi",
		"images": []string{"https://a.jpg"},
	}
	if normalizeVolcOfficialInBodyMap(bodyMap, raw) {
		t.Fatal("should not normalize openai body")
	}
}
