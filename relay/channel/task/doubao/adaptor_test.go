package doubao

import (
	"encoding/json"
	"io"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func TestEstimateBillingUsesConfiguredVideoInputRatio(t *testing.T) {
	t.Cleanup(func() {
		if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Model: "doubao-seedance-2-0-260128",
		Metadata: map[string]any{
			"content": []any{
				map[string]any{
					"type":      "video_url",
					"video_url": map[string]any{"url": "https://example.com/a.mp4"},
				},
			},
		},
	})

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{OriginModelName: "doubao-seedance-2-0-260128"}

	ratios := adaptor.EstimateBilling(c, info)
	if ratios["video_input"] != 28.0/46.0 {
		t.Fatalf("expected built-in ratio %v, got %v", 28.0/46.0, ratios["video_input"])
	}
}

func TestEstimateBillingSetsConfiguredConditionalInputPrice(t *testing.T) {
	t.Cleanup(func() {
		if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{
		"doubao-seedance-2-0-260128": {
			"1080p": {
				"input_text_only": 51,
				"input_with_video": 31
			}
		}
	}`); err != nil {
		t.Fatalf("unexpected config error: %v", err)
	}

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Model: "doubao-seedance-2-0-260128",
		Metadata: map[string]any{
			"resolution": "1080p",
			"content": []any{
				map[string]any{
					"type":      "video_url",
					"video_url": map[string]any{"url": "https://example.com/a.mp4"},
				},
			},
		},
	})

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{OriginModelName: "doubao-seedance-2-0-260128"}

	_ = adaptor.EstimateBilling(c, info)
	if info.PriceData.ConditionalInputPrice != 31 {
		t.Fatalf("expected configured conditional input price 31, got %v", info.PriceData.ConditionalInputPrice)
	}
}

func TestConvertToRequestPayloadFallsBackToDurationField(t *testing.T) {
	adaptor := &TaskAdaptor{}

	body, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-1-0-pro-250528",
		Prompt:   "make a video",
		Duration: 10,
	})
	if err != nil {
		t.Fatalf("convertToRequestPayload returned error: %v", err)
	}

	if body.Duration == nil {
		t.Fatal("expected duration to be set from duration field")
	}
	if got := int(*body.Duration); got != 10 {
		t.Fatalf("expected duration 10, got %d", got)
	}
}

func TestConvertToRequestPayloadPrefersSecondsOverDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}

	body, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-1-0-pro-250528",
		Prompt:   "make a video",
		Duration: 10,
		Seconds:  "5",
	})
	if err != nil {
		t.Fatalf("convertToRequestPayload returned error: %v", err)
	}

	if body.Duration == nil {
		t.Fatal("expected duration to be set")
	}
	if got := int(*body.Duration); got != 5 {
		t.Fatalf("expected seconds to take precedence with duration 5, got %d", got)
	}
}

func TestConvertToRequestPayloadPreservesMetadataDurationWhenMarshaled(t *testing.T) {
	adaptor := &TaskAdaptor{}

	body, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-1-0-pro-250528",
		Prompt:   "make a video",
		Duration: 10,
	})
	if err != nil {
		t.Fatalf("convertToRequestPayload returned error: %v", err)
	}

	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request payload failed: %v", err)
	}

	if string(raw) == "" {
		t.Fatal("expected marshaled request payload to be non-empty")
	}
}

func TestConvertToRequestPayloadPreservesExistingContentAndUnknownFields(t *testing.T) {
	adaptor := &TaskAdaptor{}

	body, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2-0-260128",
		Prompt: "primary prompt",
		Metadata: map[string]any{
			"camera_movement": "pan_left",
			"tools": []any{
				map[string]any{"type": "character_reference", "strength": "high"},
			},
			"content": []any{
				map[string]any{
					"type":  "text",
					"text":  "primary prompt",
					"role":  "system",
					"style": "cinematic",
				},
				map[string]any{
					"type": "text",
					"text": "add heavy rain",
					"role": "user",
				},
				map[string]any{
					"type":      "video_url",
					"video_url": map[string]any{"url": "https://example.com/input.mp4", "fps": 24},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("convertToRequestPayload returned error: %v", err)
	}

	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request payload failed: %v", err)
	}
	rawText := string(raw)

	if !strings.Contains(rawText, `"camera_movement":"pan_left"`) {
		t.Fatalf("expected unknown top-level field to be preserved: %s", rawText)
	}
	if !strings.Contains(rawText, `"style":"cinematic"`) {
		t.Fatalf("expected unknown content field to be preserved: %s", rawText)
	}
	if !strings.Contains(rawText, `"strength":"high"`) {
		t.Fatalf("expected tool field to be preserved: %s", rawText)
	}
	if strings.Count(rawText, `"type":"text"`) != 2 {
		t.Fatalf("expected both text content items to be preserved: %s", rawText)
	}
	if !strings.Contains(rawText, `"fps":24`) {
		t.Fatalf("expected nested media extras to be preserved: %s", rawText)
	}
}

func TestBuildRequestURLUsesSeedanceNativePath(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ark.example.com",
		},
	}
	adaptor.Init(info)

	url, err := adaptor.BuildRequestURL(info)
	if err != nil {
		t.Fatalf("BuildRequestURL returned error: %v", err)
	}

	if url != "https://ark.example.com/api/v3/contents/generations/tasks" {
		t.Fatalf("unexpected request url: %q", url)
	}
}

func TestBuildRequestBodyForTextOnlyVideoGeneration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Model:   "doubao-seedance-2-0-260128",
		Prompt:  "A panda drinking coffee in a neon cafe",
		Seconds: "5",
		Metadata: map[string]any{
			"resolution": "720p",
			"ratio":      "16:9",
		},
	})

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-0-260128",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}

	body, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}

	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}
	rawText := string(raw)

	if !strings.Contains(rawText, `"model":"doubao-seedance-2-0-260128"`) {
		t.Fatalf("expected model in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"duration":5`) {
		t.Fatalf("expected duration in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"resolution":"720p"`) {
		t.Fatalf("expected resolution in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"ratio":"16:9"`) {
		t.Fatalf("expected ratio in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"type":"text"`) || !strings.Contains(rawText, `"text":"A panda drinking coffee in a neon cafe"`) {
		t.Fatalf("expected text content in upstream body: %s", rawText)
	}
}

func TestBuildRequestBodyPreservesVideoInputAndUnknownFields(t *testing.T) {
	t.Cleanup(func() {
		if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})
	if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{
		"doubao-seedance-2-0-260128": {
			"1080p": {
				"input_text_only": 51,
				"input_with_video": 31
			}
		}
	}`); err != nil {
		t.Fatalf("unexpected config error: %v", err)
	}

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Model: "doubao-seedance-2-0-260128",
		Metadata: map[string]any{
			"duration":        5,
			"resolution":      "1080p",
			"camera_movement": "pan_left",
			"content": []any{
				map[string]any{
					"type": "text",
					"text": "Add heavy rain",
				},
				map[string]any{
					"type":      "video_url",
					"video_url": map[string]any{"url": "https://example.com/input.mp4", "fps": 24},
				},
			},
		},
	})

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "doubao-seedance-2-0-260128",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}

	body, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody returned error: %v", err)
	}

	raw, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read request body failed: %v", err)
	}
	rawText := string(raw)

	if !strings.Contains(rawText, `"camera_movement":"pan_left"`) {
		t.Fatalf("expected unknown top-level field in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"type":"video_url"`) {
		t.Fatalf("expected video input content in upstream body: %s", rawText)
	}
	if !strings.Contains(rawText, `"fps":24`) {
		t.Fatalf("expected nested video_url fields in upstream body: %s", rawText)
	}

	ratios := adaptor.EstimateBilling(c, info)
	if ratios["video_input"] != 28.0/46.0 {
		t.Fatalf("expected video_input ratio %v, got %v", 28.0/46.0, ratios["video_input"])
	}
	if info.PriceData.ConditionalInputPrice != 31 {
		t.Fatalf("expected conditional input price 31, got %v", info.PriceData.ConditionalInputPrice)
	}
}
