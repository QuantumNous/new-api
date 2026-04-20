package doubao

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func TestEstimateBillingUsesConfiguredVideoInputRatio(t *testing.T) {
	t.Cleanup(func() {
		if err := ratio_setting.UpdateTaskConditionRatioByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
		if err := ratio_setting.UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	if err := ratio_setting.UpdateTaskConditionRatioByJSONString(`{"video_input":{"doubao-seedance-2-0-260128":0.5}}`); err != nil {
		t.Fatalf("unexpected config error: %v", err)
	}

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
	if ratios["video_input"] != 0.5 {
		t.Fatalf("expected configured ratio 0.5, got %v", ratios["video_input"])
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
