package groksubscription

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/types"
)

func withVideoRules(t *testing.T, rules []billing_setting.VideoPriceRule) {
	t.Helper()
	original := billing_setting.GetVideoPriceRules()
	if err := billing_setting.UpdateVideoPriceSettingFromMap(map[string]string{
		"video_price_rules": marshalGrokVideoRules(t, rules),
	}); err != nil {
		t.Fatalf("set rules: %v", err)
	}
	t.Cleanup(func() {
		if err := billing_setting.UpdateVideoPriceSettingFromMap(map[string]string{
			"video_price_rules": marshalGrokVideoRules(t, original),
		}); err != nil {
			t.Fatalf("restore rules: %v", err)
		}
	})
}

func marshalGrokVideoRules(t *testing.T, rules []billing_setting.VideoPriceRule) string {
	t.Helper()
	data, err := common.Marshal(rules)
	if err != nil {
		t.Fatalf("marshal rules: %v", err)
	}
	return string(data)
}

func TestEstimateBillingGenerateUsesDurationAnd480pDefault(t *testing.T) {
	withVideoRules(t, []billing_setting.VideoPriceRule{
		{Model: ModelGrokImagineVideo15, Match: map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}, PricePerSecond: 0.22, Basis: billing_setting.BasisOutputDuration},
	})
	c, info := newAdaptorTestContext(`{"model":"grok-imagine-video-1.5","prompt":"x"}`)
	info.PriceData = types.PriceData{ModelPrice: 0.11}
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("validate: %v", taskErr)
	}
	if got := a.EstimateBilling(c, info); len(got) != 0 {
		t.Fatalf("EstimateBilling = %#v, want capture only", got)
	}
	ratios, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios: %v", err)
	}
	if got := ratios[taskcommon.BillingUnitsKey]; got != 10 {
		t.Fatalf("units = %v, want 10", got)
	}
}

func TestEstimateBillingCoversSupportedGenerateResolutions(t *testing.T) {
	rules := []billing_setting.VideoPriceRule{}
	for _, modelName := range []string{ModelGrokImagineVideo, ModelGrokImagineVideo15} {
		resolutions := []string{"480p", "720p"}
		if modelName == ModelGrokImagineVideo15 {
			resolutions = append(resolutions, "1080p")
		}
		for _, res := range resolutions {
			rules = append(rules, billing_setting.VideoPriceRule{
				Model: modelName, Match: map[string]string{"action": "generate", "resolution": res, "has_video": "false"},
				PricePerSecond: 0.09, Basis: billing_setting.BasisOutputDuration,
			})
		}
	}
	withVideoRules(t, rules)

	for _, tc := range []struct {
		model string
		res   string
		price float64
	}{
		{ModelGrokImagineVideo, "480p", 0.09},
		{ModelGrokImagineVideo, "720p", 0.09},
		{ModelGrokImagineVideo15, "480p", 0.11},
		{ModelGrokImagineVideo15, "720p", 0.11},
		{ModelGrokImagineVideo15, "1080p", 0.11},
	} {
		t.Run(tc.model+" "+tc.res, func(t *testing.T) {
			c, info := newAdaptorTestContext(`{"model":"` + tc.model + `","prompt":"x","duration":2,"resolution":"` + tc.res + `"}`)
			info.OriginModelName = tc.model
			info.PriceData = types.PriceData{ModelPrice: tc.price}
			a := &TaskAdaptor{}
			if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("validate: %v", taskErr)
			}
			a.EstimateBilling(c, info)
			if _, err := a.SecondBillingRatios(); err != nil {
				t.Fatalf("SecondBillingRatios: %v", err)
			}
		})
	}
}

func TestEstimateBillingEditAndExtendDimensions(t *testing.T) {
	withVideoRules(t, []billing_setting.VideoPriceRule{
		{Model: ModelGrokImagineVideo, Match: map[string]string{"action": "edit", "has_video": "true"}, PricePerSecond: 0.2, Basis: billing_setting.BasisTotalDuration, FallbackSeconds: 8.7},
		{Model: ModelGrokImagineVideo, Match: map[string]string{"action": "extend", "has_video": "true"}, PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	})
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"edit bounded source duration", `{"model":"grok-imagine-video","action":"edit","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`, 8.7 * 0.2 / 0.09},
		{"extend default duration", `{"model":"grok-imagine-video","action":"extend","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`, 6 * 0.3 / 0.09},
		{"extend explicit duration", `{"model":"grok-imagine-video","action":"extend","prompt":"x","duration":10,"video":{"url":"https://example.com/in.mp4"}}`, 10 * 0.3 / 0.09},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, info := newAdaptorTestContext(tt.body)
			info.OriginModelName = ModelGrokImagineVideo
			info.PriceData = types.PriceData{ModelPrice: 0.09}
			a := &TaskAdaptor{}
			if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("validate: %v", taskErr)
			}
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios: %v", err)
			}
			if math.Abs(got[taskcommon.BillingUnitsKey]-tt.want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], tt.want)
			}
		})
	}
}

func TestEstimateBillingEditUsesTotalDuration(t *testing.T) {
	withVideoRules(t, []billing_setting.VideoPriceRule{
		{Model: ModelGrokImagineVideo, Match: map[string]string{"action": "edit", "has_video": "true"}, PricePerSecond: 0.2, Basis: billing_setting.BasisTotalDuration, FallbackSeconds: 8.7},
	})
	c, info := newAdaptorTestContext(`{"model":"grok-imagine-video","action":"edit","prompt":"x","video":{"url":"https://example.com/in.mp4"}}`)
	info.OriginModelName = ModelGrokImagineVideo
	info.PriceData = types.PriceData{ModelPrice: 0.09}
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("validate: %v", taskErr)
	}
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios: %v", err)
	}
	if math.Abs(got[taskcommon.BillingUnitsKey]-(8.7*0.2/0.09)) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], 8.7*0.2/0.09)
	}
}

func TestEstimateBillingSnapshotSurvivesConfigEdit(t *testing.T) {
	withVideoRules(t, []billing_setting.VideoPriceRule{
		{Model: ModelGrokImagineVideo15, Match: map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}, PricePerSecond: 0.11, Basis: billing_setting.BasisOutputDuration},
	})
	c, info := newAdaptorTestContext(`{"model":"grok-imagine-video-1.5","prompt":"x","duration":5}`)
	info.PriceData = types.PriceData{ModelPrice: 0.11}
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("validate: %v", taskErr)
	}
	a.EstimateBilling(c, info)
	if err := billing_setting.UpdateVideoPriceSettingFromMap(map[string]string{
		"video_price_rules": marshalGrokVideoRules(t, []billing_setting.VideoPriceRule{
			{Model: ModelGrokImagineVideo15, Match: map[string]string{"action": "generate", "resolution": "480p", "has_video": "false"}, PricePerSecond: 11, Basis: billing_setting.BasisOutputDuration},
		}),
	}); err != nil {
		t.Fatalf("edit rules: %v", err)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios: %v", err)
	}
	if got[taskcommon.BillingUnitsKey] != 5 {
		t.Fatalf("units = %v, want frozen old-price units 5", got[taskcommon.BillingUnitsKey])
	}
}

func TestEstimateBillingConfiguredButUnmatchedFailsClosed(t *testing.T) {
	withVideoRules(t, []billing_setting.VideoPriceRule{
		{Model: ModelGrokImagineVideo15, Match: map[string]string{"action": "generate", "resolution": "720p", "has_video": "false"}, PricePerSecond: 0.11, Basis: billing_setting.BasisOutputDuration},
	})
	c, info := newAdaptorTestContext(`{"model":"grok-imagine-video-1.5","prompt":"x","resolution":"480p"}`)
	info.PriceData = types.PriceData{ModelPrice: 0.11}
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("validate: %v", taskErr)
	}
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("configured model with no matching rule must fail closed")
	}
}

func TestCompletionBillingKeepsFrozenReservation(t *testing.T) {
	task := &model.Task{
		Quota: 123,
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			OtherRatios: map[string]float64{taskcommon.BillingUnitsKey: 9},
		}},
		Data: []byte(`{"usage":{"cost_in_usd_ticks":999999999}}`),
	}
	if got := (&TaskAdaptor{}).AdjustBillingOnComplete(task, &relaycommon.TaskInfo{CompletionTokens: 1, TotalTokens: 2}); got != 0 {
		t.Fatalf("AdjustBillingOnComplete = %d, want 0", got)
	}
	if got := (&TaskAdaptor{}).AdjustPerCallBillingOnComplete(task, &relaycommon.TaskInfo{}); got != 0 {
		t.Fatalf("AdjustPerCallBillingOnComplete = %d, want 0", got)
	}
}
