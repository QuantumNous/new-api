package dto

import (
	"encoding/json"
	"testing"
)

func TestSeedanceVideoRequest_JSONTags(t *testing.T) {
	raw := `{
		"model":"kuaizi-lizhen-pro",
		"content":[
			{"type":"text","text":"hi"},
			{"type":"image_url","image_url":{"url":"https://a/i.jpg"},"role":"first_frame"}
		],
		"resolution":"1080p","ratio":"16:9","duration":5,"seed":42,
		"watermark":false,"camera_fixed":true,"generate_audio":true,
		"return_last_frame":true,"callback_url":"https://cb"
	}`
	var r SeedanceVideoRequest
	if err := json.Unmarshal([]byte(raw), &r); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if r.Model != "kuaizi-lizhen-pro" || len(r.Content) != 2 {
		t.Fatalf("top-level decode mismatch: %+v", r)
	}
	if r.Resolution != "1080p" || r.Ratio != "16:9" {
		t.Errorf("resolution/ratio = %q/%q", r.Resolution, r.Ratio)
	}
	if r.Duration == nil || *r.Duration != 5 || r.Seed == nil || *r.Seed != 42 {
		t.Errorf("duration/seed = %v/%v", r.Duration, r.Seed)
	}
	// explicit false must decode to non-nil pointer (Rule 5 semantics).
	if r.Watermark == nil || *r.Watermark != false {
		t.Errorf("watermark explicit false lost: %v", r.Watermark)
	}
	if r.CameraFixed == nil || *r.CameraFixed != true {
		t.Errorf("camera_fixed = %v", r.CameraFixed)
	}
	if r.Content[1].ImageURL == nil || r.Content[1].ImageURL.URL != "https://a/i.jpg" || r.Content[1].Role != "first_frame" {
		t.Errorf("image content decode mismatch: %+v", r.Content[1])
	}
}

func TestSeedanceVideoRequest_PromptAndMedia(t *testing.T) {
	r := &SeedanceVideoRequest{
		Content: []SeedanceContentItem{
			{Type: SeedanceContentText, Text: "line one"},
			{Type: SeedanceContentText, Text: "line two"},
			{Type: SeedanceContentImage, ImageURL: &SeedanceURLObject{URL: "https://a/i.jpg"}, Role: SeedanceRoleFirstFrame},
			{Type: SeedanceContentVideo, VideoURL: &SeedanceURLObject{URL: "https://a/v.mp4"}, Role: SeedanceRoleReferenceVideo},
			{Type: SeedanceContentAudio, AudioURL: &SeedanceURLObject{URL: "https://a/a.mp3"}},
			{Type: SeedanceContentImage, ImageURL: &SeedanceURLObject{URL: ""}}, // empty URL dropped
		},
	}
	if got := r.PromptText(); got != "line one\nline two" {
		t.Errorf("PromptText = %q", got)
	}
	if imgs := r.Images(); len(imgs) != 1 || imgs[0].URL != "https://a/i.jpg" || imgs[0].Role != "first_frame" {
		t.Errorf("Images = %+v", imgs)
	}
	if vids := r.Videos(); len(vids) != 1 || vids[0].URL != "https://a/v.mp4" {
		t.Errorf("Videos = %+v", vids)
	}
	if auds := r.Audios(); len(auds) != 1 || auds[0].URL != "https://a/a.mp3" {
		t.Errorf("Audios = %+v", auds)
	}
	if !r.HasFirstLastFrame() {
		t.Error("HasFirstLastFrame should be true")
	}
}

func TestSeedanceVideoRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     SeedanceVideoRequest
		wantErr bool
	}{
		{
			name:    "text only ok",
			req:     SeedanceVideoRequest{Content: []SeedanceContentItem{{Type: SeedanceContentText, Text: "hi"}}},
			wantErr: false,
		},
		{
			name:    "image only ok",
			req:     SeedanceVideoRequest{Content: []SeedanceContentItem{{Type: SeedanceContentImage, ImageURL: &SeedanceURLObject{URL: "https://a/i.jpg"}}}},
			wantErr: false,
		},
		{
			name:    "empty fails",
			req:     SeedanceVideoRequest{},
			wantErr: true,
		},
		{
			name:    "blank text fails",
			req:     SeedanceVideoRequest{Content: []SeedanceContentItem{{Type: SeedanceContentText, Text: "   "}}},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.req.Validate(); (err != nil) != tt.wantErr {
				t.Errorf("Validate() err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
