package vidu

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

func newViduTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newViduRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.vidu.example",
			ApiKey:            "test-key",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newViduBillingRequest walks the real inbound path (ValidateBasicTaskRequest via
// ValidateRequestAndSetAction) so the duration/resolution defaults under test
// are the ones production actually applies.
func newViduBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newViduTestContext(body)
	info := newViduRelayInfo(modelName, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installViduVideoPriceRules loads a rule set into the live config and restores
// the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installViduVideoPriceRules(t *testing.T, rulesJSON string) {
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

// Vidu's upstream `resolution` takes tier labels, and clients may also send
// pixel dimensions in `size`; NormalizeResolution folds both into the shared
// vocabulary, so portrait and landscape of one tier price identically.
func TestViduResolveDimensions(t *testing.T) {
	tests := []struct {
		resolution string
		want       string
	}{
		{"720p", "720p"},
		{"1080p", "1080p"},
		{"4k", "4k"},
		{"480p", "480p"},
		// Case is folded, so a client sending "1080P" is priced as 1080p.
		{"1080P", "1080p"},
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

func TestViduResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, r := range []string{"", "banana", "999x999", "1920x", "8k"} {
		if _, ok := resolveDimensions(r, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", r)
		}
	}
}

func TestViduSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
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

func TestViduSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestViduSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
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

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios. Vidu has no legacy per-second estimate, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
func TestViduEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq2","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newViduBillingRequest(t,
		`{"model":"viduq2","prompt":"a cat","duration":8,"size":"1080p"}`,
		"viduq2", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("vidu has no legacy ratios; got %v", ratios)
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

// The duration and resolution actually billed must be the ones the upstream
// receives, which convertToRequestPayload derives: 5s and "1080p" when omitted,
// and metadata overrides on top of that.
func TestViduEstimateBillingSecondsAndResolutionFollowTheUpstreamBody(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq1","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"viduq1","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		// Omitted duration defaults to 5 and omitted size to "1080p", both
		// applied by convertToRequestPayload before the body is sent upstream.
		{"defaults", `{"model":"viduq1","prompt":"a cat"}`, 0.4, 5},
		{"explicit 720p", `{"model":"viduq1","prompt":"a cat","duration":8,"size":"720p"}`, 0.2, 8},
		{"explicit 1080p", `{"model":"viduq1","prompt":"a cat","duration":8,"size":"1080p"}`, 0.4, 8},
		// duration also accepts a JSON string at the top level.
		{"string duration", `{"model":"viduq1","prompt":"a cat","duration":"8","size":"720p"}`, 0.2, 8},
		// metadata overrides what the top-level fields set.
		{"metadata duration override", `{"model":"viduq1","prompt":"a cat","duration":5,"size":"720p","metadata":{"duration":8}}`, 0.2, 8},
		{"metadata resolution override", `{"model":"viduq1","prompt":"a cat","duration":5,"size":"720p","metadata":{"resolution":"1080p"}}`, 0.4, 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newViduBillingRequest(t, tc.body, "viduq1", 0.5)
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
func TestViduEstimateBillingUnconfiguredModelStaysPerCall(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newViduBillingRequest(t,
		`{"model":"viduq1","prompt":"a cat","duration":8,"size":"720p"}`,
		"viduq1", 0.5)
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
func TestViduEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq1","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newViduBillingRequest(t,
		`{"model":"viduq1","prompt":"a cat","duration":8,"size":"1080p"}`,
		"viduq1", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestViduEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq1","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newViduBillingRequest(t,
		`{"model":"viduq1","prompt":"a cat","duration":8,"size":"720p"}`,
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
// and the request keeps its per-call price. Vidu's duration is an int, so only
// metadata can push it non-positive — DefaultInt turns a top-level 0 into 5.
func TestViduEstimateBillingUndeterminableRequestIsNotCaptured(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq1","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"zero metadata duration", `{"model":"viduq1","prompt":"a cat","size":"720p","metadata":{"duration":0}}`},
		{"negative metadata duration", `{"model":"viduq1","prompt":"a cat","size":"720p","metadata":{"duration":-1}}`},
		// A resolution the adapter cannot classify is equally unpriceable.
		{"unknown resolution", `{"model":"viduq1","prompt":"a cat","duration":8,"size":"8k"}`},
		{"empty metadata resolution", `{"model":"viduq1","prompt":"a cat","duration":8,"metadata":{"resolution":""}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newViduBillingRequest(t, tc.body, "viduq1", 0.5)
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
func TestViduEstimateBillingWithoutTaskRequestCapturesNothing(t *testing.T) {
	installViduVideoPriceRules(t, `[
		{"model":"viduq1","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	c := newViduTestContext(`{"model":"viduq1","prompt":"a cat"}`)
	info := newViduRelayInfo("viduq1", 0.5)
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
