package sonilo

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
)

// installSoniloVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installSoniloVideoPriceRules(t *testing.T, rulesJSON string) {
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

// newSoniloBillingRequest walks the real inbound path
// (ValidateRequestAndSetAction) so the duration floor and variant count under
// test are the ones production actually applies.
func newSoniloBillingRequest(t *testing.T, fields map[string]string, originModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	ctx, _ := multipartContext(t, fields, true)
	info := &relaycommon.RelayInfo{
		OriginModelName: originModel,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(ctx, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, ctx, info
}

// Sonilo scores a customer-supplied video, so a video input is always present
// and never optional. It has no output resolution at all — the result is audio
// — so resolveDimensions reports only what the request really varies by, and a
// rule that constrains resolution simply never matches.
func TestSoniloResolveDimensions(t *testing.T) {
	got := resolveDimensions()
	if got["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true (a video input is mandatory)", got["has_video"])
	}
	if _, ok := got["resolution"]; ok {
		t.Fatalf("sonilo has no output resolution, but one was reported: %v", got)
	}
}

func TestSoniloSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"has_video": "true"}
	a.secondBillingSeconds = 20
	a.secondBillingVariants = 1
	a.secondBillingModelPrice = 0.009
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"has_video": "true"},
			PricePerSecond: 0.01, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.01 * 20 / 0.009
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestSoniloSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestSoniloSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"has_video": "true"}
	a.secondBillingSeconds = 20
	a.secondBillingVariants = 1
	a.secondBillingModelPrice = 0.009
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		// Sonilo never reports a resolution, so this rule can never match.
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.01, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios, and the legacy seconds/variants ratios must not
// also apply — they would multiply the reservation a second time.
func TestSoniloEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"true"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	fields := validFields()
	fields["duration_seconds"] = "40"
	fields["variants_num"] = "1"

	a, c, info := newSoniloBillingRequest(t, fields, ModelVideoToMusic, 0.009)
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.01 * 40 / 0.009
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// variants_num is a quantity, not a price: one request renders that many
// independent tracks. Returning nil from EstimateBilling drops the legacy
// variants multiplier, so the per-second units have to carry it or a 10-variant
// request would be reserved at a single track's price.
func TestSoniloEstimateBillingConfiguredModelScalesByVariants(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"true"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	for _, variants := range []string{"1", "2", "10"} {
		t.Run("variants="+variants, func(t *testing.T) {
			fields := validFields()
			fields["duration_seconds"] = "40"
			fields["variants_num"] = variants
			a, c, info := newSoniloBillingRequest(t, fields, ModelVideoToMusic, 0.009)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			n := map[string]float64{"1": 1, "2": 2, "10": 10}[variants]
			want := 0.01 * 40 / 0.009 * n
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// The variant count must survive a total_duration rule too. That basis replaces
// the seconds ComputeSecondBilling was handed with the rule's FallbackSeconds,
// so folding the count into those seconds would silently discard it.
func TestSoniloEstimateBillingTotalDurationRuleKeepsVariants(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"true"},"price_per_second":0.01,"basis":"total_duration","fallback_seconds":60}
	]`)

	fields := validFields()
	fields["duration_seconds"] = "40"
	fields["variants_num"] = "3"

	a, c, info := newSoniloBillingRequest(t, fields, ModelVideoToMusic, 0.009)
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.01 * 60 / 0.009 * 3
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// The upstream's minimum billable length is a quantity rule, not a price, so it
// survives the move to configured pricing exactly as the legacy path applied it.
// Without it a 5-second clip would reserve half of what the upstream charges.
func TestSoniloEstimateBillingAppliesMinimumBillableLength(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"true"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	fields := validFields()
	fields["duration_seconds"] = "5"
	fields["variants_num"] = "1"

	a, c, info := newSoniloBillingRequest(t, fields, ModelVideoToMusic, 0.009)
	a.EstimateBilling(c, info)
	if a.secondBillingSeconds != 10 {
		t.Fatalf("captured seconds = %v, want the 10s minimum", a.secondBillingSeconds)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.01 * 10 / 0.009
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// A model absent from the table keeps today's behaviour byte for byte: the
// seconds and variants ratios still apply and no per-second units appear.
func TestSoniloEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"has_video":"true"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		duration    string
		variants    string
		wantSeconds float64
		wantVariant float64
	}{
		{"above the floor", "40", "2", 40, 2},
		{"below the floor", "5", "1", 10, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fields := validFields()
			fields["duration_seconds"] = tc.duration
			fields["variants_num"] = tc.variants
			a, c, info := newSoniloBillingRequest(t, fields, ModelVideoToMusic, 0.009)
			ratios := a.EstimateBilling(c, info)
			if ratios["seconds"] != tc.wantSeconds {
				t.Fatalf("seconds ratio = %v, want %v", ratios["seconds"], tc.wantSeconds)
			}
			if ratios["variants"] != tc.wantVariant {
				t.Fatalf("variants ratio = %v, want %v", ratios["variants"], tc.wantVariant)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("unconfigured model produced per-second units: %v", got)
			}
		})
	}
}

// The table and ModelPrice are both keyed on the client-facing name. Keying on
// the request body's model would divide one model's per-second rate by another
// model's price.
func TestSoniloEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"true"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	// The body model IS in the table, behind a client-facing name that is not.
	a, c, info := newSoniloBillingRequest(t, validFields(), "unpriced-alias", 0.009)
	if ratios := a.EstimateBilling(c, info); ratios["seconds"] != 10 {
		t.Fatalf("unconfigured alias lost its legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("body model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the body model: %v", got)
	}
}

// A configured model whose dimensions match no rule must be rejected before the
// upstream call rather than quietly reserved at some unrelated rate.
func TestSoniloEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-video-to-music","match":{"has_video":"false"},"price_per_second":0.01,"basis":"output_duration"}
	]`)

	a, c, info := newSoniloBillingRequest(t, validFields(), ModelVideoToMusic, 0.009)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// Settlement rescales the reservation by actual duration using the legacy
// "seconds" ratio, which a per-second reservation never writes. It must decline
// to adjust so the frozen per-second price stands.
func TestSoniloCompletionKeepsPerSecondReservation(t *testing.T) {
	task := &model.Task{
		Quota: 450,
		PrivateData: model.TaskPrivateData{BillingContext: &model.TaskBillingContext{
			PerCallBilling: true,
			OtherRatios:    map[string]float64{taskcommon.BillingUnitsKey: 11.1},
		}},
		Data: []byte(`{"status":"succeeded","duration_seconds":25,"audio":[{}]}`),
	}
	if got := (&TaskAdaptor{}).AdjustPerCallBillingOnComplete(task, &relaycommon.TaskInfo{}); got != 0 {
		t.Fatalf("AdjustPerCallBillingOnComplete = %d, want 0 (keep the frozen per-second reservation)", got)
	}
}

// Sonilo has no unpriceable dimension and no unpriceable length:
// resolveDimensions reports only has_video (always "true", since a video input
// is mandatory), and the inbound validator rejects a non-positive, NaN or
// infinite duration_seconds before billing runs. The only way a request goes
// unpriced is that there is no validated request in the context to read -- and
// then the legacy seconds/variants ratios are skipped too, so a configured
// model would bill the bare ModelPrice with no seconds multiplier.
//
// That has to fail rather than silently underbill: relay_task rejects before
// submitting upstream and the request costs nothing.
func TestSoniloEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"sonilo-music","match":{"has_video":"true"},"price_per_second":0.02,"basis":"output_duration"}
	]`)

	// A context that never went through ValidateRequestAndSetAction.
	ctx, _ := multipartContext(t, validFields(), true)
	info := &relaycommon.RelayInfo{
		OriginModelName: "sonilo-music",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.5

	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(ctx, info); len(ratios) != 0 {
		t.Fatalf("no validated request means no legacy ratios either; got %v", ratios)
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured but unpriceable request must return an error")
	}
}

// The mirror image: an UNCONFIGURED model must not start failing. Without a
// validated request it was already getting no ratios, and a request the gateway
// never priced per second has nothing to reject.
func TestSoniloEstimateBillingUnconfiguredModelStaysPerCallWhenUnpriceable(t *testing.T) {
	installSoniloVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"has_video":"true"},"price_per_second":0.02,"basis":"output_duration"}
	]`)

	ctx, _ := multipartContext(t, validFields(), true)
	info := &relaycommon.RelayInfo{
		OriginModelName: "sonilo-unconfigured",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.5

	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(ctx, info); len(ratios) != 0 {
		t.Fatalf("no validated request means no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("an unconfigured model must never fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}
