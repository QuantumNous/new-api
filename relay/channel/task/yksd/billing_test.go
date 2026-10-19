package yksd

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TestHasBillableReferenceVideo(t *testing.T) {
	if hasBillableReferenceVideo(map[string]interface{}{
		"content": []interface{}{
			map[string]interface{}{
				"type":      "video_url",
				"role":      "reference_video",
				"video_url": map[string]interface{}{"url": ""},
			},
		},
	}) {
		t.Fatal("empty reference video url must not be billed as reference video")
	}
	if !hasBillableReferenceVideo(map[string]interface{}{
		"content": []interface{}{
			map[string]interface{}{
				"type":      "video_url",
				"role":      "reference_video",
				"video_url": map[string]interface{}{"url": "https://example.com/a.mp4"},
			},
		},
	}) {
		t.Fatal("expected reference video")
	}
	if !hasBillableReferenceVideo(map[string]interface{}{
		"reference_videos": []interface{}{"https://example.com/a.mp4"},
	}) {
		t.Fatal("expected reference_videos")
	}
}

func TestEstimateBillingReferenceVideo720p(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	body := `{
		"model":"seedance2.0-yk-special",
		"duration":15,
		"resolution":"720p",
		"content":[
			{"type":"video_url","video_url":{"url":"https://example.com/a.mp4"},"role":"reference_video"}
		]
	}`
	c.Request = httptest.NewRequest("POST", "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{OriginModelName: "seedance2.0-yk-special"}
	info.PriceData.ModelPrice = 0.5
	ratios := (&TaskAdaptor{}).EstimateBilling(c, info)
	if ratios["seconds"] != 15 {
		t.Fatalf("seconds=%v", ratios["seconds"])
	}
	ratio := ratios["reference_video"]
	if ratio <= 0 {
		t.Fatalf("missing reference_video ratio: %#v", ratios)
	}
	// 0.5 * 15 * ratio = 1.27 * 15 = 19.05
	got := 0.5 * 15 * ratio
	if got < 19.04 || got > 19.06 {
		t.Fatalf("effective price=%v ratio=%v", got, ratio)
	}
}

func TestEstimateBillingSkipsEmptyReferenceVideo(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	body := `{"model":"seedance2.0-yk-special","duration":15,"resolution":"720p","content":[{"type":"video_url","video_url":{"url":""},"role":"reference_video"}]}`
	c.Request = httptest.NewRequest("POST", "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{OriginModelName: "seedance2.0-yk-special"}
	info.PriceData.ModelPrice = 0.5
	ratios := (&TaskAdaptor{}).EstimateBilling(c, info)
	if _, ok := ratios["reference_video"]; ok {
		t.Fatalf("empty url should not add reference_video: %#v", ratios)
	}
}

func TestAdjustBillingTopsUpToUpstreamAmount(t *testing.T) {
	task := &model.Task{
		Quota: 3750000, // 7.5 CNY at QuotaPerUnit
		Properties: model.Properties{
			OriginModelName: "seedance2.0-yk-special",
		},
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				ModelPrice:      0.5,
				GroupRatio:      1,
				OriginModelName: "seedance2.0-yk-special",
				OtherRatios:     map[string]float64{"seconds": 15, "resolution_tier_720p": 1},
			},
		},
	}
	raw, err := common.Marshal(map[string]interface{}{
		"status":         "completed",
		"actualDuration": 15,
		"amount":         19.05,
	})
	if err != nil {
		t.Fatal(err)
	}
	task.Data = raw

	got := (&TaskAdaptor{}).AdjustBillingOnComplete(task, &relaycommon.TaskInfo{Status: model.TaskStatusSuccess})
	want := int(19.05 * common.QuotaPerUnit)
	if got != want {
		t.Fatalf("quota=%d want %d", got, want)
	}
}

func TestAdjustBillingKeepsMarginWhenUpstreamIsCheaper(t *testing.T) {
	task := &model.Task{
		Quota: 3750000,
		PrivateData: model.TaskPrivateData{
			BillingContext: &model.TaskBillingContext{
				ModelPrice:      0.5,
				GroupRatio:      1,
				OriginModelName: "seedance2.0-yk-special",
				OtherRatios:     map[string]float64{"seconds": 15},
			},
		},
	}
	raw, err := common.Marshal(map[string]interface{}{
		"actualDuration": 15,
		"amount":         6,
	})
	if err != nil {
		t.Fatal(err)
	}
	task.Data = raw
	got := adjustYkSdBillingOnComplete(task, &relaycommon.TaskInfo{Status: model.TaskStatusSuccess})
	if got != 3750000 {
		t.Fatalf("quota=%d want 3750000 (do not refund down to upstream 6)", got)
	}
}

func TestEstimateBilling1080pReferenceVideo(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "seedance2.0-yk-special"}
	info.PriceData = types.PriceData{ModelPrice: 0.6}
	body := map[string]interface{}{
		"resolution":       "1080p",
		"reference_videos": []interface{}{"https://example.com/a.mp4"},
	}
	ratio, ok := referenceVideoBillingRatio(info, body)
	if !ok {
		t.Fatal("expected ratio")
	}
	got := 0.6 * 15 * ratio
	if got < 19.49 || got > 19.51 {
		t.Fatalf("effective=%v ratio=%v", got, ratio)
	}
}
