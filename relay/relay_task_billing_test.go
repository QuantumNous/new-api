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

func TestBytePlusModelRatiosApplyTierRatios(t *testing.T) {
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

	if err := ratio_setting.UpdateModelPriceByJSONString(`{}`); err != nil {
		t.Fatalf("clear model prices: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(`{
		"seedance-2.0": 0.391,
		"seedance-2.0-fast": 0.3145,
		"seedance-2.0-mini": 0.1955
	}`); err != nil {
		t.Fatalf("configure model ratios: %v", err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`); err != nil {
		t.Fatalf("configure group ratio: %v", err)
	}

	tests := []struct {
		model         string
		modelRatio    float64
		wantBaseQuota int
		wantTierQuota int
	}{
		{model: "seedance-2.0", modelRatio: 0.391, wantBaseQuota: 97750, wantTierQuota: 59500},
		{model: "seedance-2.0-fast", modelRatio: 0.3145, wantBaseQuota: 78625, wantTierQuota: 46750},
		{model: "seedance-2.0-mini", modelRatio: 0.1955, wantBaseQuota: 48875, wantTierQuota: 29750},
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
				t.Fatalf("calculate model ratio price: %v", err)
			}
			if priceData.UsePrice {
				t.Fatal("UsePrice = true, want token-ratio billing")
			}
			if priceData.ModelPrice != -1 {
				t.Fatalf("model price = %v, want -1", priceData.ModelPrice)
			}
			if priceData.ModelRatio != tt.modelRatio {
				t.Fatalf("model ratio = %v, want %v", priceData.ModelRatio, tt.modelRatio)
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
