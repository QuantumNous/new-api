package kling

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

func newKlingTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newKlingRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.kling.example",
			ApiKey:            "access|secret",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newKlingBillingRequest walks the real inbound path (ValidateBasicTaskRequest
// via ValidateRequestAndSetAction) so the duration/mode defaults under test are
// the ones production actually applies.
func newKlingBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newKlingTestContext(body)
	info := newKlingRelayInfo(modelName, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installKlingVideoPriceRules loads a rule set into the live config and restores
// the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installKlingVideoPriceRules(t *testing.T, rulesJSON string) {
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

// Kling exposes no output-resolution parameter — `size` only selects an aspect
// ratio — so `mode` is the request's one quality lever and the dimension the
// price table has to key on. Both tiers must classify, or a configured request
// would silently drop back to per-call pricing.
func TestKlingResolveDimensions(t *testing.T) {
	tests := []struct {
		mode string
		want string
	}{
		{"std", "std"},
		{"pro", "pro"},
		// Case and padding are folded, so a client sending "Pro" is priced as
		// pro rather than dropping off the per-second path.
		{"Pro", "pro"},
		{" STD ", "std"},
	}
	for _, tc := range tests {
		t.Run(tc.mode, func(t *testing.T) {
			got, ok := resolveDimensions(tc.mode, false)
			if !ok {
				t.Fatal("expected dimensions to resolve")
			}
			if got["mode"] != tc.want {
				t.Fatalf("mode = %q, want %q", got["mode"], tc.want)
			}
			if got["has_video"] != "false" {
				t.Fatalf("has_video = %q, want false", got["has_video"])
			}
		})
	}
}

func TestKlingResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, mode := range []string{"", "banana", "standard", "professional", "720p"} {
		if _, ok := resolveDimensions(mode, false); ok {
			t.Fatalf("unknown mode %q must not resolve", mode)
		}
	}
}

func TestKlingSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"mode": "std", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"mode": "std"},
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

func TestKlingSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestKlingSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"mode": "std", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"mode": "pro"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios. Kling has no legacy per-second estimate, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
func TestKlingEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v2-master","match":{"mode":"pro"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newKlingBillingRequest(t,
		`{"model":"kling-v2-master","prompt":"a cat","duration":10,"mode":"pro"}`,
		"kling-v2-master", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("kling has no legacy ratios; got %v", ratios)
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

// The duration and mode actually billed must be the ones the upstream receives,
// which convertToRequestPayload derives: 5s and "std" when omitted, and
// metadata overrides on top of that.
func TestKlingEstimateBillingSecondsAndModeFollowTheUpstreamBody(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v1-6","match":{"mode":"std"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"kling-v1-6","match":{"mode":"pro"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		// Omitted duration defaults to 5 and omitted mode to "std", both applied
		// by convertToRequestPayload before the body is sent upstream.
		{"defaults", `{"model":"kling-v1-6","prompt":"a cat"}`, 0.2, 5},
		{"explicit duration", `{"model":"kling-v1-6","prompt":"a cat","duration":10}`, 0.2, 10},
		{"pro mode", `{"model":"kling-v1-6","prompt":"a cat","duration":10,"mode":"pro"}`, 0.4, 10},
		// duration also accepts a JSON string at the top level.
		{"string duration", `{"model":"kling-v1-6","prompt":"a cat","duration":"10"}`, 0.2, 10},
		// metadata overrides what the top-level fields set, and the upstream
		// duration field is a string, so metadata must carry a string too.
		{"metadata duration override", `{"model":"kling-v1-6","prompt":"a cat","duration":5,"metadata":{"duration":"10"}}`, 0.2, 10},
		{"metadata mode override", `{"model":"kling-v1-6","prompt":"a cat","duration":5,"metadata":{"mode":"pro"}}`, 0.4, 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newKlingBillingRequest(t, tc.body, "kling-v1-6", 0.5)
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
func TestKlingEstimateBillingUnconfiguredModelStaysPerCall(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"mode":"std"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newKlingBillingRequest(t,
		`{"model":"kling-v1-6","prompt":"a cat","duration":10}`,
		"kling-v1-6", 0.5)
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

// A configured model whose mode matches no rule must be rejected before the
// upstream call rather than quietly reserved at the other tier's price.
func TestKlingEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v1-6","match":{"mode":"pro"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newKlingBillingRequest(t,
		`{"model":"kling-v1-6","prompt":"a cat","duration":10}`,
		"kling-v1-6", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestKlingEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v1-6","match":{"mode":"std"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newKlingBillingRequest(t,
		`{"model":"kling-v1-6","prompt":"a cat","duration":10}`,
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

// A length that cannot be determined must never be guessed: capture is skipped
// and the request keeps its per-call price. The upstream duration field is a
// string, so metadata can make it unparseable as well as non-positive.
func TestKlingEstimateBillingUndeterminableDurationIsNotCaptured(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v1-6","match":{"mode":"std"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"unparseable metadata duration", `{"model":"kling-v1-6","prompt":"a cat","metadata":{"duration":"abc"}}`},
		{"empty metadata duration", `{"model":"kling-v1-6","prompt":"a cat","metadata":{"duration":""}}`},
		{"zero metadata duration", `{"model":"kling-v1-6","prompt":"a cat","metadata":{"duration":"0"}}`},
		{"negative metadata duration", `{"model":"kling-v1-6","prompt":"a cat","metadata":{"duration":"-3"}}`},
		// A mode the adapter cannot classify is equally unpriceable.
		{"unknown mode", `{"model":"kling-v1-6","prompt":"a cat","duration":10,"metadata":{"mode":"ultra"}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newKlingBillingRequest(t, tc.body, "kling-v1-6", 0.5)
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
func TestKlingEstimateBillingWithoutTaskRequestCapturesNothing(t *testing.T) {
	installKlingVideoPriceRules(t, `[
		{"model":"kling-v1-6","match":{"mode":"std"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newKlingTestContext(`{"model":"kling-v1-6","prompt":"a cat"}`)
	info := newKlingRelayInfo("kling-v1-6", 0.5)
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
