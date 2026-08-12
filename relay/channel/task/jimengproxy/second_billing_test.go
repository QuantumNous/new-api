package jimengproxy

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
			ChannelBaseUrl:    "https://jimengproxy.example",
			ApiKey:            "test-key",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newBillingRequest walks the real inbound path (ValidateRequestAndSetAction) so
// the duration and resolution under test are the ones production actually
// stores, for both inbound shapes this channel accepts.
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

// The channel forwards `resolution` to the upstream verbatim as a tier label, so
// every label a client can send must classify into the shared vocabulary; pixel
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
// via SecondBillingRatios. This channel has no legacy per-second estimate, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
// Both inbound shapes must reach the same price — they synthesize the same
// stored request.
func TestEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"basic task request", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"1080p"}`},
		{"seedance content", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"duration":8,"resolution":"1080p"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "jimeng-video-3.0", 0.5)
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
		})
	}
}

// The seconds and tier billed must be the ones the upstream body carries, which
// convertToSubmitPayload copies verbatim from the stored request.
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
		{"720p 5s", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":5,"resolution":"720p"}`, 0.2, 5},
		{"1080p 10s", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":10,"resolution":"1080p"}`, 0.4, 10},
		{"case folded label", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":10,"resolution":"720P"}`, 0.2, 10},
		// duration also accepts a JSON string at the top level.
		{"string duration", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":"8","resolution":"720p"}`, 0.2, 8},
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

	a, c, info := newBillingRequest(t,
		`{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"720p"}`,
		"jimeng-video-3.0", 0.5)
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

	a, c, info := newBillingRequest(t,
		`{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"1080p"}`,
		"jimeng-video-3.0", 0.5)
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
	a, c, info := newBillingRequest(t,
		`{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"720p"}`,
		"unpriced-alias", 0.5)
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("body model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the body model: %v", got)
	}
}

// A length or tier that cannot be determined must never be guessed. This channel
// forwards duration only when positive and applies no default of its own, so an
// omitted, zero, or negative duration leaves the length to the upstream —
// unknowable here. Capture is skipped and the request keeps its per-call price.
func TestEstimateBillingUndeterminableRequestIsNotCaptured(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"omitted duration", `{"model":"jimeng-video-3.0","prompt":"a cat","resolution":"720p"}`},
		{"zero duration", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":0,"resolution":"720p"}`},
		{"negative duration", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":-1,"resolution":"720p"}`},
		{"unparseable duration", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":"eight","resolution":"720p"}`},
		// `seconds` is not a field this channel forwards upstream, so it must not
		// be mistaken for a length the upstream will honour.
		{"seconds only", `{"model":"jimeng-video-3.0","prompt":"a cat","seconds":"8","resolution":"720p"}`},
		// A resolution the adapter cannot classify is equally unpriceable.
		{"omitted resolution", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":8}`},
		{"unknown resolution", `{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"8k"}`},
		// Seedance-shaped bodies get the same care: duration -1 hands the length
		// to the model.
		{"seedance model-chosen duration", `{"model":"jimeng-video-3.0","content":[{"type":"text","text":"a cat"}],"duration":-1,"resolution":"720p"}`},
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

// Without a stored task_request there is nothing to price; EstimateBilling must
// return cleanly rather than capture a zero-valued request.
func TestEstimateBillingWithoutTaskRequestCapturesNothing(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng-video-3.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newJSONCtx(`{"model":"jimeng-video-3.0","prompt":"a cat","duration":8,"resolution":"720p"}`)
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
