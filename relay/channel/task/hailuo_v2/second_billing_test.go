package hailuov2

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
)

// installHailuoV2VideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installHailuoV2VideoPriceRules(t *testing.T, rulesJSON string) {
	t.Helper()
	saved := map[string]string{}
	if err := config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}); err != nil {
		t.Fatalf("snapshot config: %v", err)
	}
	t.Cleanup(func() {
		if err := config.GlobalConfig.LoadFromDB(saved); err != nil {
			t.Fatalf("restore config: %v", err)
		}
	})
	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": rulesJSON,
	}); err != nil {
		t.Fatalf("install video price rules: %v", err)
	}
	if len(billing_setting.GetVideoPriceRules()) == 0 {
		t.Fatal("video price rules did not load; the config module name or key is wrong")
	}
}

// newHailuoV2BillingRequest walks the real inbound path
// (ValidateRequestAfterModelMapping) so the request EstimateBilling reads is the
// validated one production actually stores.
func newHailuoV2BillingRequest(t *testing.T, req VideoRequest, originModel string, modelPrice float64) (*TaskAdaptor, *relaycommon.RelayInfo, func() map[string]float64) {
	t.Helper()
	body, err := common.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	c, info := newVideoContext(string(body), ModelName)
	info.OriginModelName = originModel
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAfterModelMapping(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAfterModelMapping error: %+v", taskErr)
	}
	return a, info, func() map[string]float64 { return a.EstimateBilling(c, info) }
}

// MiniMax H3 renders exactly two tiers, neither of which the shared
// NormalizeResolution vocabulary classifies (768P is not a tier any other
// channel serves, and "2K" is not the 4K/2160p tier the shared table names).
// The adapter therefore owns this mapping, and every value the inbound
// validator accepts must classify or a configured request would be rejected at
// submit time.
func TestHailuoV2ResolveDimensions(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"768P", "768p"},
		{"2K", "2k"},
	} {
		t.Run(tc.in, func(t *testing.T) {
			got, ok := resolveDimensions(tc.in, false)
			if !ok {
				t.Fatal("expected dimensions to resolve")
			}
			if got["resolution"] != tc.want {
				t.Fatalf("resolution = %q, want %q", got["resolution"], tc.want)
			}
			if got["has_video"] != "false" {
				t.Fatalf("has_video = %q, want false", got["has_video"])
			}
		})
	}
}

// A reference video changes what the upstream bills (input media length is
// added to the output length), so has_video must be able to distinguish it —
// that is the dimension an administrator prices a total_duration rule on.
func TestHailuoV2ResolveDimensionsMarksVideoInput(t *testing.T) {
	got, ok := resolveDimensions("2K", true)
	if !ok {
		t.Fatal("expected dimensions to resolve")
	}
	if got["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true", got["has_video"])
	}
}

func TestHailuoV2ResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, in := range []string{"", "banana", "720p", "4k", "768", "2 K"} {
		if _, ok := resolveDimensions(in, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", in)
		}
	}
}

func TestHailuoV2SecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "768p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.08
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "768p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.3 * 5 / 0.08
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestHailuoV2SecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestHailuoV2SecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "2k", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.08
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "768p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios, and the legacy billable_units / region /
// resolution markers must not also apply — they would multiply the reservation
// a second time.
func TestHailuoV2EstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"client-alias","match":{"resolution":"768p"},"price_per_second":0.08,"basis":"output_duration"},
		{"model":"client-alias","match":{"resolution":"2k"},"price_per_second":0.13,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name       string
		resolution string
		duration   int
		wantRate   float64
	}{
		{"768P", "768P", 5, 0.08},
		{"2K", "2K", 8, 0.13},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, _, estimate := newHailuoV2BillingRequest(t,
				validTextRequest(tc.resolution, tc.duration), "client-alias", 0.08)
			if ratios := estimate(); len(ratios) != 0 {
				t.Fatalf("configured model still returned legacy ratios: %v", ratios)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantRate * float64(tc.duration) / 0.08
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: the
// three legacy markers still apply and no per-second units appear.
func TestHailuoV2EstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"768p"},"price_per_second":0.08,"basis":"output_duration"}
	]`)

	a, _, estimate := newHailuoV2BillingRequest(t,
		validTextRequest("2K", 5), "client-alias", 0.08)
	ratios := estimate()
	if len(ratios) != 3 {
		t.Fatalf("legacy ratios = %v, want 3 keys", ratios)
	}
	if math.Abs(ratios[billingUnitsKey]-8.125) > 1e-9 {
		t.Fatalf("legacy billable units = %v, want 8.125", ratios[billingUnitsKey])
	}
	if ratios[billingRegionIntlKey] != 1 || ratios[billingResolution2KKey] != 1 {
		t.Fatalf("legacy markers lost: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// The table and ModelPrice are both keyed on the client-facing name. Keying on
// the upstream MiniMax-H3 name would divide one model's per-second rate by
// another model's price.
func TestHailuoV2EstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"MiniMax-H3","match":{"resolution":"768p"},"price_per_second":0.08,"basis":"output_duration"}
	]`)

	// The upstream name IS in the table, behind a client-facing name that is not.
	a, _, estimate := newHailuoV2BillingRequest(t,
		validTextRequest("768P", 5), "client-alias", 0.08)
	if ratios := estimate(); len(ratios) != 3 {
		t.Fatalf("unconfigured alias lost its legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("upstream name must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the upstream model name: %v", got)
	}
}

// A configured model whose resolution matches no rule must be rejected before
// the upstream call rather than quietly reserved at the other tier's price.
func TestHailuoV2EstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"client-alias","match":{"resolution":"768p"},"price_per_second":0.08,"basis":"output_duration"}
	]`)

	a, _, estimate := newHailuoV2BillingRequest(t,
		validTextRequest("2K", 5), "client-alias", 0.08)
	estimate()
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The legacy path pads the reservation with maxReferenceInputSeconds when a
// reference video is present. The captured length must stay the requested
// OUTPUT length: an output_duration rule prices exactly what was asked for, and
// a total_duration rule substitutes its own bounded FallbackSeconds. Adding the
// pad here would double-count against a total_duration rule and overprice an
// output_duration one.
func TestHailuoV2EstimateBillingReferenceVideoKeepsOutputSeconds(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"client-alias","match":{"has_video":"true"},"price_per_second":0.08,"basis":"output_duration"}
	]`)

	req := validTextRequest("768P", 6)
	req.Ratio = common.GetPointer("adaptive")
	req.Content = append(req.Content, ContentItem{
		Type:     "video_url",
		VideoURL: &URLValue{URL: "https://example.com/ref.mp4"},
		Role:     common.GetPointer("reference_video"),
	})

	a, _, estimate := newHailuoV2BillingRequest(t, req, "client-alias", 0.08)
	estimate()
	if a.secondBillingDims["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true", a.secondBillingDims["has_video"])
	}
	if a.secondBillingSeconds != 6 {
		t.Fatalf("captured seconds = %v, want the requested output length 6", a.secondBillingSeconds)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.08 * 6 / 0.08
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// A reference video makes the upstream bill input length plus output length,
// which is what BasisTotalDuration exists for: the rule's bounded
// FallbackSeconds replaces the requested output length.
func TestHailuoV2EstimateBillingTotalDurationRuleUsesFallbackSeconds(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"client-alias","match":{"has_video":"true"},"price_per_second":0.08,"basis":"total_duration","fallback_seconds":21}
	]`)

	req := validTextRequest("768P", 6)
	req.Ratio = common.GetPointer("adaptive")
	req.Content = append(req.Content, ContentItem{
		Type:     "video_url",
		VideoURL: &URLValue{URL: "https://example.com/ref.mp4"},
		Role:     common.GetPointer("reference_video"),
	})

	a, _, estimate := newHailuoV2BillingRequest(t, req, "client-alias", 0.08)
	estimate()
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.08 * 21 / 0.08
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Extra input images beyond the free allowance carry a hardcoded USD surcharge
// on the legacy path. Under configured pricing the table is the only source of
// truth, so the surcharge must NOT be smuggled into the per-second units — the
// administrator's rate is exactly what is charged.
func TestHailuoV2EstimateBillingConfiguredPricingDropsExtraImageSurcharge(t *testing.T) {
	installHailuoV2VideoPriceRules(t, `[
		{"model":"client-alias","match":{"resolution":"768p"},"price_per_second":0.08,"basis":"output_duration"}
	]`)

	req := validTextRequest("768P", 4)
	req.Ratio = common.GetPointer("adaptive")
	for range 6 {
		req.Content = append(req.Content, ContentItem{
			Type:     "image_url",
			ImageURL: &URLValue{URL: "https://example.com/ref.png"},
			Role:     common.GetPointer("reference_image"),
		})
	}

	a, _, estimate := newHailuoV2BillingRequest(t, req, "client-alias", 0.08)
	estimate()
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	// 4 seconds at the configured rate — NOT 4.5 units, which is what the
	// legacy path charges once the sixth image adds its $0.04.
	want := 0.08 * 4 / 0.08
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v (surcharge must not survive)", got[taskcommon.BillingUnitsKey], want)
	}
}

// perSecondTask is a completed task whose reservation was priced from the
// configured table: the frozen snapshot carries only the per-second units key,
// never the legacy billable_units / region / resolution markers.
func perSecondTask(units float64, quota int) *model.Task {
	data, _ := common.Marshal(QueryResponse{Task: VideoTask{
		Status:     "succeeded",
		Resolution: "768P",
		Usage: &VideoTaskUsage{
			TotalSeconds:    common.GetPointer(8),
			InputImageCount: common.GetPointer(6),
		},
	}})
	return &model.Task{
		TaskID: "task_public",
		Quota:  quota,
		Data:   data,
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			ModelPrice:  0.08,
			OtherRatios: map[string]float64{taskcommon.BillingUnitsKey: units},
		}},
	}
}

// Settlement for a configured model must keep the per-second reservation
// exactly. calculateCompletedQuota reads the legacy billable_units key, which a
// per-second reservation never writes, so it must decline to adjust — silently,
// since this is the designed outcome and not a fault worth an error log.
func TestHailuoV2CompletionKeepsPerSecondReservation(t *testing.T) {
	adaptor := &TaskAdaptor{}
	task := perSecondTask(5, 500)
	if got := adaptor.AdjustPerCallBillingOnComplete(task, nil); got != 0 {
		t.Fatalf("AdjustPerCallBillingOnComplete = %d, want 0 (keep the frozen per-second reservation)", got)
	}
	if got := adaptor.AdjustBillingOnComplete(task, nil); got != 0 {
		t.Fatalf("AdjustBillingOnComplete = %d, want 0 (keep the frozen per-second reservation)", got)
	}
	if !perSecondReservation(task.PrivateData.BillingContext.OtherRatios) {
		t.Fatal("a snapshot carrying the per-second key must be recognised as a per-second reservation")
	}
}

// A legacy reservation is unaffected: it still settles against actual usage.
func TestHailuoV2CompletionStillSettlesLegacyReservations(t *testing.T) {
	adaptor := &TaskAdaptor{}
	legacy := completedTask("768P", 10, 1000, 8, 5)
	if got := adaptor.AdjustPerCallBillingOnComplete(legacy, nil); got != 800 {
		t.Fatalf("legacy settlement = %d, want 800", got)
	}
	if perSecondReservation(legacy.PrivateData.BillingContext.OtherRatios) {
		t.Fatal("a legacy snapshot must not be mistaken for a per-second reservation")
	}
}
