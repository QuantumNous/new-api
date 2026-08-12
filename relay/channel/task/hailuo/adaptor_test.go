package hailuo

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

func newHailuoTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newHailuoRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.minimax.example",
			ApiKey:            "test-key",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newHailuoBillingRequest walks the real inbound path (ValidateBasicTaskRequest
// via ValidateRequestAndSetAction) so the duration/resolution defaults under
// test are the ones production actually applies.
func newHailuoBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newHailuoTestContext(body)
	info := newHailuoRelayInfo(modelName, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installHailuoVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installHailuoVideoPriceRules(t *testing.T, rulesJSON string) {
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

// Every resolution any model config can produce must classify, or a configured
// request would be rejected at submit time. The upstream's labels are its own
// ("512P"/"768P"), so the mapping is channel-local and exact.
func TestHailuoResolveDimensions(t *testing.T) {
	tests := []struct {
		resolution string
		want       string
	}{
		{Resolution512P, "512p"},
		{Resolution720P, "720p"},
		{Resolution768P, "768p"},
		{Resolution1080P, "1080p"},
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

// Every model's DefaultResolution and SupportedResolutions must classify: those
// are exactly the values convertToRequestPayload can produce, so a gap here
// would reject a request the channel accepts.
func TestHailuoResolveDimensionsCoversEveryModelConfig(t *testing.T) {
	for _, m := range ModelList {
		cfg := GetModelConfig(m)
		t.Run(m, func(t *testing.T) {
			if _, ok := resolveDimensions(cfg.DefaultResolution, false); !ok {
				t.Fatalf("model %s default resolution %q does not classify", m, cfg.DefaultResolution)
			}
			for _, r := range cfg.SupportedResolutions {
				if _, ok := resolveDimensions(r, false); !ok {
					t.Fatalf("model %s supported resolution %q does not classify", m, r)
				}
			}
		})
	}
}

func TestHailuoResolveDimensions_RejectsUnknown(t *testing.T) {
	// Lower-case forms are rejected too: the upstream's own labels are
	// upper-case, so a lower-case value did not come from this channel's
	// vocabulary and must not be guessed at.
	for _, r := range []string{"", "banana", "2K", "4k", "720p", "999x999"} {
		if _, ok := resolveDimensions(r, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", r)
		}
	}
}

func TestHailuoSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "768p", "has_video": "false"}
	a.secondBillingSeconds = 6
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "768p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.3 * 6 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestHailuoSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestHailuoSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "1080p", "has_video": "false"}
	a.secondBillingSeconds = 6
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "768p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios. Hailuo has no legacy per-second estimate, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
func TestHailuoEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newHailuoBillingRequest(t,
		`{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10,"size":"1920x1080"}`,
		"MiniMax-Hailuo-02", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("hailuo has no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.5 * 10 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// The duration and resolution actually billed must be the ones the upstream
// receives, which convertToRequestPayload derives: 6s when omitted, the model
// config's DefaultResolution when size is omitted, parseResolutionFromSize
// otherwise, and metadata overrides on top of all of that.
func TestHailuoEstimateBillingSecondsAndResolutionFollowTheUpstreamBody(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"512p"},"price_per_second":0.1,"basis":"output_duration"},
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"768p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		// Omitted duration defaults to 6 (DefaultDuration) and omitted size to
		// the model config's DefaultResolution (768P for MiniMax-Hailuo-02),
		// both applied by convertToRequestPayload before the body goes upstream.
		{"defaults", `{"model":"MiniMax-Hailuo-02","prompt":"a cat"}`, 0.2, 6},
		{"explicit duration", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10}`, 0.2, 10},
		// size is mapped to a resolution tier by substring, not parsed as pixels.
		{"size 1080", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10,"size":"1920x1080"}`, 0.4, 10},
		{"size 512", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10,"size":"512x512"}`, 0.1, 10},
		// An unmapped size falls back to the model config default, matching
		// parseResolutionFromSize.
		{"unmapped size falls back to model default", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10,"size":"640x360"}`, 0.2, 10},
		// duration also accepts a JSON string at the top level.
		{"string duration", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":"10"}`, 0.2, 10},
		// metadata overrides what the top-level fields set.
		{"metadata duration override", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":6,"metadata":{"duration":10}}`, 0.2, 10},
		{"metadata resolution override", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":6,"metadata":{"resolution":"1080P"}}`, 0.4, 6},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newHailuoBillingRequest(t, tc.body, "MiniMax-Hailuo-02", 0.5)
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

// The default resolution is per model, so two models with an omitted size must
// price from different tiers.
func TestHailuoEstimateBillingUsesPerModelDefaultResolution(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"T2V-01","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"MiniMax-Hailuo-2.3","match":{"resolution":"768p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		model     string
		wantPrice float64
	}{
		// T2V-01 defaults to 720P, MiniMax-Hailuo-2.3 to 768P.
		{"T2V-01", 0.2},
		{"MiniMax-Hailuo-2.3", 0.3},
	} {
		t.Run(tc.model, func(t *testing.T) {
			a, c, info := newHailuoBillingRequest(t,
				`{"model":"`+tc.model+`","prompt":"a cat","duration":6}`, tc.model, 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * 6 / 0.5
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: no
// ratios, no per-second units, pure per-call pricing.
func TestHailuoEstimateBillingUnconfiguredModelStaysPerCall(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"768p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newHailuoBillingRequest(t,
		`{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10}`,
		"MiniMax-Hailuo-02", 0.5)
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
func TestHailuoEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"768p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newHailuoBillingRequest(t,
		`{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10,"size":"1920x1080"}`,
		"MiniMax-Hailuo-02", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestHailuoEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"768p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newHailuoBillingRequest(t,
		`{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":10}`,
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

// A length or tier that cannot be determined must never be guessed: capture is
// skipped and the request keeps its per-call price. The upstream duration is a
// *int, so metadata can null it out as well as push it non-positive.
func TestHailuoEstimateBillingUndeterminableRequestIsNotCaptured(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"768p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"null metadata duration", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","metadata":{"duration":null}}`},
		{"zero metadata duration", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","metadata":{"duration":0}}`},
		{"negative metadata duration", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","metadata":{"duration":-1}}`},
		// A resolution the adapter cannot classify is equally unpriceable.
		{"unknown metadata resolution", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":6,"metadata":{"resolution":"4K"}}`},
		{"empty metadata resolution", `{"model":"MiniMax-Hailuo-02","prompt":"a cat","duration":6,"metadata":{"resolution":""}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newHailuoBillingRequest(t, tc.body, "MiniMax-Hailuo-02", 0.5)
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
func TestHailuoEstimateBillingWithoutTaskRequestCapturesNothing(t *testing.T) {
	installHailuoVideoPriceRules(t, `[
		{"model":"MiniMax-Hailuo-02","match":{"resolution":"768p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newHailuoTestContext(`{"model":"MiniMax-Hailuo-02","prompt":"a cat"}`)
	info := newHailuoRelayInfo("MiniMax-Hailuo-02", 0.5)
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
