package relay

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/task/byteplus"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func TestBytePlusFixedModelPricesApplyTierRatios(t *testing.T) {
	originalPrices := ratio_setting.ModelPrice2JSONString()
	originalRatios := ratio_setting.ModelRatio2JSONString()
	originalGroups := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateModelPriceByJSONString(originalPrices); err != nil {
			t.Errorf("restore model prices: %v", err)
		}
		if err := ratio_setting.UpdateModelRatioByJSONString(originalRatios); err != nil {
			t.Errorf("restore model ratios: %v", err)
		}
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroups); err != nil {
			t.Errorf("restore group ratios: %v", err)
		}
	})

	if err := ratio_setting.UpdateModelPriceByJSONString(`{
		"seedance-2.0": 0.782,
		"seedance-2.0-fast": 0.629,
		"seedance-2.0-mini": 0.391
	}`); err != nil {
		t.Fatalf("configure model prices: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(`{}`); err != nil {
		t.Fatalf("clear model ratios: %v", err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`); err != nil {
		t.Fatalf("configure group ratio: %v", err)
	}

	tests := []struct {
		model         string
		modelPrice    float64
		wantBaseQuota int
		wantTierQuota int
	}{
		{model: "seedance-2.0", modelPrice: 0.782, wantBaseQuota: 391000, wantTierQuota: 238000},
		{model: "seedance-2.0-fast", modelPrice: 0.629, wantBaseQuota: 314500, wantTierQuota: 187000},
		{model: "seedance-2.0-mini", modelPrice: 0.391, wantBaseQuota: 195500, wantTierQuota: 119000},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(
				`{"model":"`+tt.model+`","resolution":"720p","content":[`+
					`{"type":"text","text":"hello"},`+
					`{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"}}]}`,
			))
			c.Request.Header.Set("Content-Type", "application/json")

			info := &relaycommon.RelayInfo{
				OriginModelName: tt.model,
				UserGroup:       "default",
				UsingGroup:      "default",
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: "ep-private-endpoint",
				},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}
			adaptor := &byteplus.TaskAdaptor{}
			if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("validate request: %+v", taskErr)
			}

			priceData, err := helper.ModelPriceHelperPerCall(c, info)
			if err != nil {
				t.Fatalf("calculate fixed model price: %v", err)
			}
			if !priceData.UsePrice {
				t.Fatal("UsePrice = false, want fixed per-call billing")
			}
			if priceData.ModelPrice != tt.modelPrice {
				t.Fatalf("model price = %v, want %v", priceData.ModelPrice, tt.modelPrice)
			}
			if priceData.Quota != tt.wantBaseQuota {
				t.Fatalf("base quota = %d, want %d", priceData.Quota, tt.wantBaseQuota)
			}

			for name, ratio := range adaptor.EstimateBilling(c, info) {
				priceData.AddOtherRatio(name, ratio)
			}
			applyTaskOtherRatios(&priceData)
			if priceData.Quota != tt.wantTierQuota {
				t.Fatalf("tier quota = %d, want %d", priceData.Quota, tt.wantTierQuota)
			}
		})
	}
}
