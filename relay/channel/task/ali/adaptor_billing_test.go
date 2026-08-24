package ali

import (
	"bytes"
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestEstimateBillingHappyHorseUsesReservedSecondsOnly(t *testing.T) {
	tests := []struct {
		name  string
		model string
		body  string
		want  float64
	}{
		{
			name:  "t2v explicit duration",
			model: "happyhorse-1.1-t2v",
			body:  `{"model":"happyhorse-1.1-t2v","input":{"prompt":"run"},"parameters":{"duration":7,"resolution":"1080P"}}`,
			want:  7,
		},
		{
			name:  "i2v default duration",
			model: "happyhorse-1.1-i2v",
			body:  `{"model":"happyhorse-1.1-i2v","input":{"media":[{"type":"first_frame","url":"https://example.com/frame.png"}]},"parameters":{"resolution":"1080P"}}`,
			want:  5,
		},
		{
			name:  "r2v default duration",
			model: "happyhorse-1.1-r2v",
			body:  `{"model":"happyhorse-1.1-r2v","input":{"prompt":"run","media":[{"type":"reference_image","url":"https://example.com/reference.png"}]},"parameters":{"resolution":"720P"}}`,
			want:  5,
		},
		{
			name:  "video edit fixed duration",
			model: "happyhorse-1.0-video-edit",
			body:  `{"model":"happyhorse-1.0-video-edit","input":{"prompt":"edit","media":[{"type":"video","url":"https://example.com/video.mp4"}]},"parameters":{}}`,
			want:  30,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := newHappyHorseContext(test.body, "application/json")
			got := (&TaskAdaptor{}).EstimateBilling(ctx, &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: test.model},
			})
			if len(got) != 1 || got["seconds"] != test.want {
				t.Fatalf("EstimateBilling() = %#v, want only seconds=%v", got, test.want)
			}
		})
	}
}

func TestEstimateBillingLegacyAliUnchanged(t *testing.T) {
	ctx := newHappyHorseContext(`{}`, "application/json")
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{UpstreamModelName: "wan2.5-i2v-preview"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	relaycommon.StoreTaskRequest(ctx, info, "submit", relaycommon.TaskSubmitReq{
		Model:    "wan2.5-i2v-preview",
		Duration: 5,
		Size:     "720P",
	})

	got := (&TaskAdaptor{}).EstimateBilling(ctx, info)
	if got["seconds"] != 5 || got["resolution-720P"] != 2 {
		t.Fatalf("EstimateBilling() = %#v, want legacy seconds and resolution ratios", got)
	}
}

func TestAliUsageParsesFractionalDuration(t *testing.T) {
	var response AliVideoResponse
	if err := common.Unmarshal([]byte(`{"usage":{"duration":13.24}}`), &response); err != nil {
		t.Fatalf("common.Unmarshal() error = %v", err)
	}
	if response.Usage == nil || response.Usage.Duration != 13.24 {
		t.Fatalf("duration = %#v, want 13.24", response.Usage)
	}
}

func TestAliUsageParsesLegacyQuotedDuration(t *testing.T) {
	var response AliVideoResponse
	if err := common.Unmarshal([]byte(`{"usage":{"duration":"5"}}`), &response); err != nil {
		t.Fatalf("common.Unmarshal() error = %v", err)
	}
	if response.Usage == nil || response.Usage.Duration != 5 {
		t.Fatalf("duration = %#v, want 5", response.Usage)
	}
}

func TestAliDurationDoesNotPopulatePublicTokenUsage(t *testing.T) {
	data := []byte(`{"output":{"task_status":"SUCCEEDED","video_url":"https://example.com/video.mp4"},"usage":{"duration":13.24}}`)
	result, err := (&TaskAdaptor{}).ParseTaskResult(data)
	if err != nil {
		t.Fatalf("ParseTaskResult() error = %v", err)
	}
	if result.CompletionTokens != 0 || result.TotalTokens != 0 {
		t.Fatalf("public token usage = (%d, %d), want zero", result.CompletionTokens, result.TotalTokens)
	}

	output, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(&model.Task{Data: data})
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo() error = %v", err)
	}
	if bytes.Contains(output, []byte(`"usage"`)) {
		t.Fatalf("ConvertToOpenAIVideo() exposed provider duration as public usage: %s", output)
	}
}

func TestAdjustBillingOnCompleteHappyHorseUsesFrozenPriceAndDuration(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500_000
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	task := happyHorseBillingTask([]byte(`{"usage":{"duration":13.24}}`))
	common.QuotaPerUnit = 1_000_000
	got := (&TaskAdaptor{}).AdjustBillingOnComplete(task, &relaycommon.TaskInfo{})
	if got != 66200 {
		t.Fatalf("AdjustBillingOnComplete() = %d, want 66200", got)
	}
}

func TestAdjustBillingOnCompleteHappyHorseKeepsReservationForInvalidSnapshot(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*model.Task)
	}{
		{name: "missing billing context", mutate: func(task *model.Task) { task.PrivateData.BillingContext = nil }},
		{name: "missing reserved seconds", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios = nil }},
		{name: "zero reserved seconds", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios["seconds"] = 0 }},
		{name: "nan reserved seconds", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios["seconds"] = math.NaN() }},
		{name: "infinite reserved seconds", mutate: func(task *model.Task) { task.PrivateData.BillingContext.OtherRatios["seconds"] = math.Inf(1) }},
		{name: "missing reserved quota", mutate: func(task *model.Task) { task.Quota = 0 }},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			task := happyHorseBillingTask([]byte(`{"usage":{"duration":13.24}}`))
			test.mutate(task)
			if got := (&TaskAdaptor{}).AdjustBillingOnComplete(task, &relaycommon.TaskInfo{}); got != 0 {
				t.Fatalf("AdjustBillingOnComplete() = %d, want 0", got)
			}
		})
	}
}

func TestAdjustBillingOnCompleteHappyHorseKeepsReservationForInvalidUsage(t *testing.T) {
	tests := []struct {
		name string
		data []byte
	}{
		{name: "absent usage", data: []byte(`{"output":{"task_status":"SUCCEEDED"}}`)},
		{name: "zero duration", data: []byte(`{"usage":{"duration":0}}`)},
		{name: "negative duration", data: []byte(`{"usage":{"duration":-1}}`)},
		{name: "invalid duration", data: []byte(`{"usage":{"duration":"invalid"}}`)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := (&TaskAdaptor{}).AdjustBillingOnComplete(happyHorseBillingTask(test.data), &relaycommon.TaskInfo{}); got != 0 {
				t.Fatalf("AdjustBillingOnComplete() = %d, want 0", got)
			}
		})
	}
}

func happyHorseBillingTask(data []byte) *model.Task {
	reservedSeconds := 7.0
	baseQuota := int(0.01 * common.QuotaPerUnit)
	return &model.Task{
		Data:       data,
		Quota:      int(float64(baseQuota) * reservedSeconds),
		Properties: model.Properties{UpstreamModelName: "happyhorse-1.1-t2v"},
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			ModelPrice: 0.01,
			GroupRatio: 1,
			OtherRatios: map[string]float64{
				"seconds": reservedSeconds,
			},
		}},
	}
}
