package jimengzhizinan

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"

	"github.com/gin-gonic/gin"
)

func newBillingRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://zhizinan.example",
			ApiKey:            "session-id",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newBillingRequest walks the real inbound path (ValidateRequestAndSetAction ->
// BindSeedanceRequest) so the duration and resolution under test are the ones
// production actually parses.
func newBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newJSONCtx(body)
	info := newBillingRelayInfo(modelName, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installVideoPriceRules loads a rule set into the live config and restores the
// previous configuration afterwards. It exercises the real GetVideoPriceRules
// path rather than hand-setting adapter fields, so a test using it proves
// EstimateBilling actually consults the configured table.
func installVideoPriceRules(t *testing.T, rulesJSON string) {
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

// The channel forwards `resolution` upstream verbatim as a tier label, so every
// label a client can send must classify into the shared vocabulary; pixel
// dimensions fold by short side, so portrait and landscape of one tier price
// identically.
func TestResolveDimensions(t *testing.T) {
	tests := []struct {
		resolution string
		want       string
	}{
		{"480p", "480p"},
		{"720p", "720p"},
		{"1080p", "1080p"},
		{"4k", "4k"},
		// Case and surrounding space are folded, so "1080P" prices as 1080p.
		{"1080P", "1080p"},
		{" 720p ", "720p"},
		// Pixel dimensions classify by short side.
		{"1920x1080", "1080p"},
		{"1080x1920", "1080p"},
	}
	for _, tc := range tests {
		t.Run(tc.resolution, func(t *testing.T) {
			got, ok := resolveDimensions(tc.resolution, false)
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

func TestResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, r := range []string{"", "banana", "999x999", "1920x", "8k"} {
		if _, ok := resolveDimensions(r, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", r)
		}
	}
}

func TestSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "720p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.3 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "4k", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model is priced from the table
// via SecondBillingRatios. This channel bills purely per call today, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
func TestEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-seedance-2.0-pro","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"jimeng-video-seedance-2.0-pro",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"1080p",
		"duration":8
	}`, "jimeng-video-seedance-2.0-pro", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("this channel has no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.5 * 8 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// The seconds and tier billed must be the ones the upstream body carries, which
// buildGenerationPayload copies from the parsed seedance request.
func TestEstimateBillingFollowsTheUpstreamBody(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"jimeng-video-3.0","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"720p 5s", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":5}`, 0.2, 5},
		{"1080p 10s", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"1080p","duration":10}`, 0.4, 10},
		{"case folded label", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"720P","duration":10}`, 0.2, 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "jimeng-video-3.0", 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * tc.wantSeconds / 0.5
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: no
// ratios, no per-second units, pure per-call pricing.
func TestEstimateBillingUnconfiguredModelStaysPerCall(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"jimeng-video-3.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"720p",
		"duration":8
	}`, "jimeng-video-3.0", 0.5)
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("unconfigured model produced ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// A configured model whose resolution matches no rule must be rejected before
// the upstream call rather than quietly reserved at another tier's price.
func TestEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"jimeng-video-3.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"1080p",
		"duration":8
	}`, "jimeng-video-3.0", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newBillingRequest(t, `{
		"model":"jimeng-video-3.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"720p",
		"duration":8
	}`, "unpriced-alias", 0.5)
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("body model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the body model: %v", got)
	}
}

// A length or tier that cannot be determined must never be guessed.
// buildGenerationPayload forwards duration only when positive and applies no
// default of its own, so an absent, zero, or negative duration leaves the length
// to the upstream — unknowable here. This channel is NOT Ark, so the seedance
// family's documented 5s Ark default must not be assumed for it.
func TestEstimateBillingUndeterminableRequestIsNotCaptured(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"absent duration", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p"}`},
		{"zero duration", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":0}`},
		// -1 is the seedance convention for "let the model decide".
		{"model-chosen duration", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":-1}`},
		// A resolution the adapter cannot classify is equally unpriceable, and
		// this channel applies no resolution default either.
		{"absent resolution", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"duration":8}`},
		{"unknown resolution", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"resolution":"8k","duration":8}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "jimeng-video-3.0", 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an undeterminable request must stay on the per-call path, got error: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("priced off an undeterminable request: %v", got)
			}
		})
	}
}

// `frames` is not a field this channel forwards upstream — buildGenerationPayload
// drops it — so it can neither set the length nor override an explicit duration.
// A request carrying both is still priced on its explicit duration.
func TestEstimateBillingFramesDoNotDisturbAnExplicitDuration(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"jimeng-video-3.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"720p",
		"duration":8,
		"frames":121
	}`, "jimeng-video-3.0", 0.5)
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.2 * 8 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Without a parseable request body there is nothing to price; EstimateBilling
// must return cleanly rather than capture a zero-valued request.
func TestEstimateBillingWithoutSeedanceRequestCapturesNothing(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newJSONCtx(`not-json`)
	info := newBillingRelayInfo("jimeng-video-3.0", 0.5)
	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("expected nil ratios, got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("captured without a request: %v", got)
	}
}
