package blockrunseedance

import (
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"

	"github.com/gin-gonic/gin"
)

func newBillingCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newBillingRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://blockrun.example/api",
			ApiKey:         "0xdeadbeef",
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
	c := newBillingCtx(body)
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
// label validateResolution accepts and the shared vocabulary knows must
// classify; pixel dimensions fold by short side, so portrait and landscape of
// one tier price identically.
func TestResolveDimensions(t *testing.T) {
	tests := []struct {
		resolution string
		want       string
	}{
		{"480p", "480p"},
		{"720p", "720p"},
		{"1080p", "1080p"},
		{"4k", "4k"},
		// validateResolution matches case-insensitively and admits "4K", so the
		// billing vocabulary has to fold case the same way or an accepted request
		// would be unpriceable.
		{"4K", "4k"},
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

// 360p is in this channel's supportedResolutions but NOT in the shared price
// vocabulary, which has no 360p tier. It must refuse rather than be folded into
// a neighbouring tier: a 360p request billed at the 480p rate would overcharge
// silently, whereas refusing keeps it on the per-call path — and once a 360p
// tier is added to the vocabulary this test is the reminder to revisit.
func TestResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, r := range []string{"", "banana", "999x999", "1920x", "8k", "360p"} {
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
		{"model":"seedance-2.0","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"seedance-2.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"1080p",
		"duration":8
	}`, "seedance-2.0", 0.5)

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
// buildBlockrunSeedanceCreateRequest derives from the parsed seedance request.
func TestEstimateBillingFollowsTheUpstreamBody(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"seedance-2.0-fast","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"720p 5s", `{"model":"seedance-2.0-fast","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":5}`, 0.2, 5},
		{"1080p 10s", `{"model":"seedance-2.0-fast","content":[{"type":"text","text":"a cat"}],"resolution":"1080p","duration":10}`, 0.4, 10},
		{"case folded label", `{"model":"seedance-2.0-fast","content":[{"type":"text","text":"a cat"}],"resolution":"720P","duration":10}`, 0.2, 10},
		// An omitted resolution renders as the upstream's documented 720p
		// default (SDK v0.17.0 VideoGenerateOptions), the same default
		// validateResolution already treats "" as.
		{"omitted resolution defaults to 720p", `{"model":"seedance-2.0-fast","content":[{"type":"text","text":"a cat"}],"duration":6}`, 0.2, 6},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "seedance-2.0-fast", 0.5)
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
		"model":"seedance-2.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"720p",
		"duration":8
	}`, "seedance-2.0", 0.5)
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
// the upstream call rather than quietly reserved at another tier's price. That
// matters more here than elsewhere: submitting burns a signed x402 payment.
func TestEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"seedance-2.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"1080p",
		"duration":8
	}`, "seedance-2.0", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price — a real hazard
// here, where the three whitelabel models are priced differently.
func TestEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newBillingRequest(t, `{
		"model":"seedance-2.0",
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

// A length that cannot be determined must never be guessed. The upstream
// documents an absent duration_seconds as "the model's default duration" — a
// per-model number this gateway does not know — so an absent, zero, or negative
// duration leaves the request on the per-call path. In particular the seedance
// family's Ark 5s default must NOT be assumed here: this upstream is not Ark.
func TestEstimateBillingUndeterminableDurationIsNotCaptured(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"absent duration", `{"model":"seedance-2.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p"}`},
		{"zero duration", `{"model":"seedance-2.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":0}`},
		// -1 is the seedance convention for "let the model decide".
		{"model-chosen duration", `{"model":"seedance-2.0","content":[{"type":"text","text":"a cat"}],"resolution":"720p","duration":-1}`},
		// 360p is accepted by this channel but has no tier in the shared price
		// vocabulary, so it is unpriceable rather than folded into 480p.
		{"360p resolution", `{"model":"seedance-2.0","content":[{"type":"text","text":"a cat"}],"resolution":"360p","duration":8}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "seedance-2.0", 0.5)
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

// `frames` is dropped by this channel (droppedSeedanceFields lists it), so it
// can neither set the length nor override an explicit duration. A request
// carrying both is still priced on its explicit duration — which is why
// taskcommon.SeedanceBillableSeconds, whose frames rule is Ark's, is not reused
// here: it would refuse to price a request whose length this channel knows.
func TestEstimateBillingDroppedFramesDoNotDisturbAnExplicitDuration(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"seedance-2.0",
		"content":[{"type":"text","text":"a cat"}],
		"resolution":"720p",
		"duration":8,
		"frames":121
	}`, "seedance-2.0", 0.5)
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

// An image-to-video request is still billed on generated seconds: the reference
// is an image, not a video, so has_video stays false and the same rule prices
// it. validateSeedanceValues rejects video input outright, so has_video can
// never be true on this channel.
func TestEstimateBillingImageToVideoPricesTheSame(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p","has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t, `{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"animate"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/a.png"}}
		],
		"resolution":"720p",
		"duration":6
	}`, "seedance-2.0", 0.5)
	a.EstimateBilling(c, info)
	if a.secondBillingDims["has_video"] != "false" {
		t.Fatalf("has_video = %q, want false (an image input is not a video)", a.secondBillingDims["has_video"])
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.2 * 6 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Without a parseable request body there is nothing to price; EstimateBilling
// must return cleanly rather than capture a zero-valued request.
func TestEstimateBillingWithoutSeedanceRequestCapturesNothing(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"seedance-2.0","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newBillingCtx(`not-json`)
	info := newBillingRelayInfo("seedance-2.0", 0.5)
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
