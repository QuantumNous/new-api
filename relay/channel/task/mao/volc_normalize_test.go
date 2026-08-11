package mao

import (
	"encoding/json"
	"testing"

	"github.com/tidwall/gjson"
)

func TestIsVolcOfficialContent(t *testing.T) {
	ok := []byte(`{"content":[{"type":"text","text":"hi"}]}`)
	if !isVolcOfficialContent(ok) {
		t.Fatal("expected true")
	}
	bad := []byte(`{"content":[{"type":"other"}]}`)
	if isVolcOfficialContent(bad) {
		t.Fatal("expected false")
	}
	empty := []byte(`{"content":[]}`)
	if isVolcOfficialContent(empty) {
		t.Fatal("expected false for empty content")
	}
	flat := []byte(`{"prompt":"x","image":"https://a.jpg"}`)
	if isVolcOfficialContent(flat) {
		t.Fatal("expected false for flat body")
	}
}

func TestNormalizeVolcOfficialInBodyMap_Roles(t *testing.T) {
	raw := []byte(`{
	  "model":"guanzhuan-seedance2.0",
	  "content":[
	    {"type":"text","text":"run"},
	    {"type":"image_url","role":"first_frame","image_url":{"url":"https://a/first.jpg"}},
	    {"type":"image_url","role":"last_frame","image_url":{"url":"https://a/last.jpg"}},
	    {"type":"image_url","role":"reference_image","image_url":{"url":"https://a/ref.png"}},
	    {"type":"video_url","video_url":{"url":"https://a/v.mp4"}},
	    {"type":"audio_url","audio_url":{"url":"https://a/a.mp3"}}
	  ],
	  "resolution":"1080p"
	}`)
	var body map[string]interface{}
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatal(err)
	}
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	if body["prompt"] != "run" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
	if body["image"] != "https://a/first.jpg" {
		t.Fatalf("image=%v", body["image"])
	}
	if body["last_frame"] != "https://a/last.jpg" {
		t.Fatalf("last_frame=%v", body["last_frame"])
	}
	md, _ := body["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 1 || refs[0] != "https://a/ref.png" {
		t.Fatalf("refs=%v", md["reference_images"])
	}
	vids := asStringSlice(body["videos"])
	if len(vids) != 1 || vids[0] != "https://a/v.mp4" {
		t.Fatalf("videos=%v", body["videos"])
	}
	auds := asStringSlice(body["audios"])
	if len(auds) != 1 || auds[0] != "https://a/a.mp3" {
		t.Fatalf("audios=%v", body["audios"])
	}
	if body["generate_audio"] != true {
		t.Fatalf("generate_audio=%v", body["generate_audio"])
	}
	if body["watermark"] != false {
		t.Fatalf("watermark=%v, want false", body["watermark"])
	}
	if _, ok := body["content"]; ok {
		t.Fatal("content should be deleted")
	}
	if body["resolution"] != "1080p" {
		t.Fatal("resolution must be preserved")
	}
}

func TestNormalizeVolcOfficialInBodyMap_NoRoleImageGoesToReference(t *testing.T) {
	raw := []byte(`{"content":[{"type":"image_url","image_url":{"url":"https://a/x.png"}}]}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	if !normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("expected normalize")
	}
	md, _ := body["metadata"].(map[string]interface{})
	refs := asStringSlice(md["reference_images"])
	if len(refs) != 1 || refs[0] != "https://a/x.png" {
		t.Fatalf("refs=%v", md["reference_images"])
	}
	if _, ok := body["image"]; ok {
		t.Fatalf("image should be unset for no-role, got %v", body["image"])
	}
}

func TestNormalizeVolcOfficialInBodyMap_KeepsExistingPrompt(t *testing.T) {
	raw := []byte(`{"prompt":"keep","content":[{"type":"text","text":"new"}]}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	normalizeVolcOfficialInBodyMap(body, raw)
	if body["prompt"] != "keep" {
		t.Fatalf("prompt=%v", body["prompt"])
	}
}

func TestNormalizeVolcOfficialInBodyMap_NonVolcNoop(t *testing.T) {
	raw := []byte(`{"prompt":"x","image":"https://a.jpg"}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	if normalizeVolcOfficialInBodyMap(body, raw) {
		t.Fatal("should not normalize")
	}
	if body["prompt"] != "x" {
		t.Fatalf("prompt changed: %v", body["prompt"])
	}
}

func TestNormalizeVolcOfficialInBodyMap_GenerateAudioDefaultTrue(t *testing.T) {
	raw := []byte(`{"content":[{"type":"text","text":"hi"}]}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	normalizeVolcOfficialInBodyMap(body, raw)
	if body["generate_audio"] != true {
		t.Fatalf("generate_audio=%v, want true", body["generate_audio"])
	}
}

func TestNormalizeVolcOfficialInBodyMap_BoolOverrides(t *testing.T) {
	raw := []byte(`{
		"content":[{"type":"text","text":"x"}],
		"generate_audio":false,
		"watermark":true
	}`)
	var body map[string]interface{}
	_ = json.Unmarshal(raw, &body)
	normalizeVolcOfficialInBodyMap(body, raw)
	if body["generate_audio"] != false {
		t.Fatalf("generate_audio=%v, want false", body["generate_audio"])
	}
	if body["watermark"] != true {
		t.Fatalf("watermark=%v, want true", body["watermark"])
	}
}

func TestExtractVolcMediaURLVariants(t *testing.T) {
	raw := []byte(`[
		{"type":"image_url","image_url":{"url":"https://a.example/1.jpg"}},
		{"type":"image_url","image_url":"https://a.example/2.jpg"},
		{"type":"image_url","url":"https://a.example/3.jpg"}
	]`)
	arr := gjson.ParseBytes(raw).Array()
	if got := extractVolcMediaURL(arr[0], "image_url"); got != "https://a.example/1.jpg" {
		t.Fatalf("object form = %q", got)
	}
	if got := extractVolcMediaURL(arr[1], "image_url"); got != "https://a.example/2.jpg" {
		t.Fatalf("string form = %q", got)
	}
	if got := extractVolcMediaURL(arr[2], "image_url"); got != "https://a.example/3.jpg" {
		t.Fatalf("top-level url = %q", got)
	}
}

func asStringSlice(v interface{}) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, x := range t {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}
