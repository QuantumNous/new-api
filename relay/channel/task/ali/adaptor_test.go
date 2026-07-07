package ali

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func TestValidateRequestAndSetActionAllowsHappyHorseI2VWithoutPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest("POST", "/v1/videos", strings.NewReader(`{
		"model":"happyhorse-1.1-i2v",
		"images":["https://example.com/first-frame.png"]
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor := &TaskAdaptor{}
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("expected validation to succeed, got error: %v", taskErr)
	}
	if info.Action != relayconstant.TaskActionGenerate {
		t.Fatalf("expected action %q, got %q", relayconstant.TaskActionGenerate, info.Action)
	}
}

func TestConvertToAliRequestBuildsHappyHorse11ReferenceVideoPayload(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-r2v",
		Prompt: "[Image 1] and [Image 2] dancing in the rain",
		Images: []string{
			"https://example.com/ref-1.png",
			"https://example.com/ref-2.png",
		},
		Duration: 8,
		Metadata: map[string]any{
			"ratio":     "9:16",
			"watermark": true,
		},
	}

	body, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest returned error: %v", err)
	}

	if body.Model != "happyhorse-1.1-r2v" {
		t.Fatalf("unexpected model: %q", body.Model)
	}
	if len(body.Input.Media) != 2 {
		t.Fatalf("expected 2 media items, got %d", len(body.Input.Media))
	}
	if body.Input.Media[0].Type != "reference_image" || body.Input.Media[1].Type != "reference_image" {
		t.Fatalf("expected reference_image media items, got %#v", body.Input.Media)
	}
	if body.Parameters == nil || body.Parameters.Ratio == nil || *body.Parameters.Ratio != "9:16" {
		t.Fatalf("expected ratio 9:16, got %#v", body.Parameters)
	}
	if body.Parameters.Watermark == nil || !*body.Parameters.Watermark {
		t.Fatalf("expected watermark true, got %#v", body.Parameters.Watermark)
	}
}

func TestConvertToAliRequestBuildsHappyHorseVideoEditPayload(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.0-video-edit",
		Prompt: "replace the clothes with the reference style",
		Videos: []string{"https://example.com/base.mp4"},
		Images: []string{"https://example.com/ref.webp"},
		Metadata: map[string]any{
			"audio_setting": "origin",
		},
	}

	body, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest returned error: %v", err)
	}

	if len(body.Input.Media) != 2 {
		t.Fatalf("expected video-edit media items, got %#v", body.Input.Media)
	}
	if body.Input.Media[0].Type != "video" {
		t.Fatalf("expected first media item to be video, got %#v", body.Input.Media[0])
	}
	if body.Input.Media[1].Type != "reference_image" {
		t.Fatalf("expected second media item to be reference_image, got %#v", body.Input.Media[1])
	}
	if body.Parameters.AudioSetting == nil || *body.Parameters.AudioSetting != "origin" {
		t.Fatalf("expected audio_setting origin, got %#v", body.Parameters.AudioSetting)
	}
}

func TestConvertToAliRequestBuildsHappyHorseSeedPayload(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "happyhorse-1.1-t2v",
		Prompt: "a dancer under stage lights",
		Metadata: map[string]any{
			"seed": 42,
		},
	}

	body, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest returned error: %v", err)
	}
	if body.Parameters == nil || body.Parameters.Seed != 42 {
		t.Fatalf("expected seed=42, got %#v", body.Parameters)
	}
}

func TestConvertToAliRequestBuildsBailianKlingOmniPayload(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-omni-video-generation",
		Prompt: "Create a cinematic montage",
		Metadata: map[string]any{
			"media": []any{
				map[string]any{
					"type":                "base",
					"url":                 "https://example.com/base.mp4",
					"keep_original_sound": "yes",
				},
				map[string]any{
					"type": "refer",
					"url":  "https://example.com/refer.png",
				},
			},
			"mode":         "pro",
			"aspect_ratio": "16:9",
			"audio":        false,
			"watermark":    true,
			"multi_shot":   true,
			"shot_type":    "customize",
			"multi_prompt": []any{
				map[string]any{"index": 1, "prompt": "Wide establishing shot", "duration": 2},
				map[string]any{"index": 2, "prompt": "Close-up reveal", "duration": 3},
			},
			"element_list": []any{
				map[string]any{"element_id": 101},
				map[string]any{"element_id": 202},
			},
		},
	}

	body, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest returned error: %v", err)
	}

	if body.Model != "kling/kling-v3-omni-video-generation" {
		t.Fatalf("unexpected model: %q", body.Model)
	}
	if len(body.Input.Media) != 2 {
		t.Fatalf("expected 2 kling media items, got %#v", body.Input.Media)
	}
	if body.Input.Media[0].Type != "base" || body.Input.Media[0].KeepOriginalSound == nil || *body.Input.Media[0].KeepOriginalSound != "yes" {
		t.Fatalf("expected base media with keep_original_sound=yes, got %#v", body.Input.Media[0])
	}
	if body.Input.MultiShot == nil || !*body.Input.MultiShot {
		t.Fatalf("expected multi_shot=true, got %#v", body.Input.MultiShot)
	}
	if body.Input.ShotType == nil || *body.Input.ShotType != "customize" {
		t.Fatalf("expected shot_type=customize, got %#v", body.Input.ShotType)
	}
	if len(body.Input.MultiPrompt) != 2 {
		t.Fatalf("expected 2 multi_prompt entries, got %#v", body.Input.MultiPrompt)
	}
	if len(body.Input.ElementList) != 2 {
		t.Fatalf("expected 2 element_list entries, got %#v", body.Input.ElementList)
	}
	if body.Parameters == nil || body.Parameters.Mode == nil || *body.Parameters.Mode != "pro" {
		t.Fatalf("expected mode=pro, got %#v", body.Parameters)
	}
	if body.Parameters.AspectRatio == nil || *body.Parameters.AspectRatio != "16:9" {
		t.Fatalf("expected aspect_ratio=16:9, got %#v", body.Parameters.AspectRatio)
	}
	if body.Parameters.Audio == nil || *body.Parameters.Audio {
		t.Fatalf("expected audio=false, got %#v", body.Parameters.Audio)
	}
	if body.Parameters.Watermark == nil || !*body.Parameters.Watermark {
		t.Fatalf("expected watermark=true, got %#v", body.Parameters.Watermark)
	}
}

func TestValidateRequestAndSetActionAllowsKlingCustomizeWithoutPrompt(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest("POST", "/v1/videos", strings.NewReader(`{
		"model":"kling/kling-v3-omni-video-generation",
		"metadata":{
			"multi_shot":true,
			"shot_type":"customize",
			"multi_prompt":[
				{"index":1,"prompt":"first shot","duration":2},
				{"index":2,"prompt":"second shot","duration":3}
			]
		}
	}`))
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor := &TaskAdaptor{}
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("expected validation to succeed, got error: %v", taskErr)
	}
	if info.Action != relayconstant.TaskActionTextGenerate {
		t.Fatalf("expected action %q, got %q", relayconstant.TaskActionTextGenerate, info.Action)
	}
}

func TestConvertToAliRequestDefaultsKlingAspectRatio(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-video-generation",
		Prompt: "a cat running in moonlight",
	}

	body, err := adaptor.convertToAliRequest(info, req)
	if err != nil {
		t.Fatalf("convertToAliRequest returned error: %v", err)
	}
	if body.Parameters == nil || body.Parameters.AspectRatio == nil || *body.Parameters.AspectRatio != "16:9" {
		t.Fatalf("expected aspect_ratio=16:9, got %#v", body.Parameters)
	}
}

func TestConvertToAliRequestRejectsKlingStandardUnsupportedMedia(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-video-generation",
		Prompt: "edit this video",
		Metadata: map[string]any{
			"media": []any{
				map[string]any{"type": "base", "url": "https://example.com/base.mp4"},
			},
		},
	}

	_, err := adaptor.convertToAliRequest(info, req)
	if err == nil || !strings.Contains(err.Error(), "does not support media type") {
		t.Fatalf("expected unsupported media error, got %v", err)
	}
}

func TestConvertToAliRequestRejectsKlingCustomizeWithoutMultiPrompt(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-omni-video-generation",
		Prompt: "montage",
		Metadata: map[string]any{
			"multi_shot": true,
			"shot_type":  "customize",
		},
	}

	_, err := adaptor.convertToAliRequest(info, req)
	if err == nil || !strings.Contains(err.Error(), "requires multi_prompt") {
		t.Fatalf("expected missing multi_prompt error, got %v", err)
	}
}

func TestConvertToAliRequestRejectsKlingAudioWithBaseVideo(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-omni-video-generation",
		Prompt: "edit this video",
		Metadata: map[string]any{
			"media": []any{
				map[string]any{"type": "base", "url": "https://example.com/base.mp4"},
			},
			"audio": true,
		},
	}

	_, err := adaptor.convertToAliRequest(info, req)
	if err == nil || !strings.Contains(err.Error(), "audio must be false") {
		t.Fatalf("expected audio=false validation error, got %v", err)
	}
}

func TestConvertToAliRequestRejectsKlingElementOverflow(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	req := relaycommon.TaskSubmitReq{
		Model:  "kling/kling-v3-omni-video-generation",
		Prompt: "three characters and a dog",
		Images: []string{"https://example.com/ref-1.png", "https://example.com/ref-2.png"},
		Metadata: map[string]any{
			"media": []any{
				map[string]any{"type": "refer", "url": "https://example.com/ref-1.png"},
				map[string]any{"type": "refer", "url": "https://example.com/ref-2.png"},
			},
			"element_list": []any{
				map[string]any{"element_id": 1},
				map[string]any{"element_id": 2},
				map[string]any{"element_id": 3},
				map[string]any{"element_id": 4},
				map[string]any{"element_id": 5},
				map[string]any{"element_id": 6},
			},
		},
	}

	_, err := adaptor.convertToAliRequest(info, req)
	if err == nil || !strings.Contains(err.Error(), "total must be <= 7") {
		t.Fatalf("expected element_list overflow error, got %v", err)
	}
}

func TestConvertToOpenAIVideoPreservesWatermarkURLMetadata(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := newTestAliModelTask([]byte(`{
		"output": {
			"task_id": "task_123",
			"task_status": "SUCCEEDED",
			"video_url": "https://example.com/video.mp4",
			"watermark_video_url": "https://example.com/video-watermark.mp4"
		}
	}`))

	raw, err := adaptor.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo returned error: %v", err)
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal openai video failed: %v", err)
	}
	metadata, _ := out["metadata"].(map[string]any)
	if metadata["watermark_url"] != "https://example.com/video-watermark.mp4" {
		t.Fatalf("expected watermark_url metadata, got %#v", metadata)
	}
}

func newTestAliModelTask(data []byte) *model.Task {
	return &model.Task{
		TaskID:    "task_public_123",
		CreatedAt: 1,
		UpdatedAt: 2,
		Progress:  "100%",
		Data:      data,
		Properties: model.Properties{
			OriginModelName: "kling/kling-v3-omni-video-generation",
		},
	}
}
