package gemini

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

func newGeminiTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newGeminiRelayInfo(originModel, upstreamModel string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: originModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://generativelanguage.googleapis.example",
			ApiKey:            "test-key",
			UpstreamModelName: upstreamModel,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newGeminiBillingRequest walks the real inbound path so the duration and
// resolution defaults under test are the ones production actually applies.
func newGeminiBillingRequest(t *testing.T, body, originModel, upstreamModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newGeminiTestContext(body)
	info := newGeminiRelayInfo(originModel, upstreamModel, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installGeminiVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installGeminiVideoPriceRules(t *testing.T, rulesJSON string) {
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

// Veo resolutions arrive as lowercase labels from ResolveVeoResolution. Every
// tier Veo renders must classify, or a configured request would be rejected at
// submit time.
func TestGeminiResolveDimensions(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"720p", "720p"},
		{"1080p", "1080p"},
		{"4k", "4k"},
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

func TestGeminiResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, in := range []string{"banana", "", "480i"} {
		if _, ok := resolveDimensions(in, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", in)
		}
	}
}

func TestGeminiSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
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

func TestGeminiSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestGeminiSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
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
// table via SecondBillingRatios, and the legacy seconds/resolution ratios must
// not also apply — they would multiply the reservation a second time.
func TestGeminiEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"veo-3.1-generate-preview","match":{"resolution":"1080p"},
		 "price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newGeminiBillingRequest(t,
		`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"size":"1920x1080"}`,
		"veo-3.1-generate-preview", "veo-3.1-generate-preview", 0.4)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.4 * 6 / 0.4
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Resolution and duration reach billing through three inbound shapes: the
// metadata object Veo callers use, the standard size/duration fields, and the
// 8-second / 720p defaults. All three must price from the table.
func TestGeminiEstimateBillingCoversEveryResolutionSource(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"veo-3.1-generate-preview","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"},
		{"model":"veo-3.1-generate-preview","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"},
		{"model":"veo-3.1-generate-preview","match":{"resolution":"4k"},"price_per_second":0.6,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"metadata resolution and duration",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","metadata":{"resolution":"4K","durationSeconds":6}}`, 0.6, 6},
		{"size maps to 1080p",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":4,"size":"1920x1080"}`, 0.4, 4},
		{"size maps to 4k",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":4,"size":"3840x2160"}`, 0.6, 4},
		{"seconds string",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","seconds":"10","size":"1280x720"}`, 0.4, 10},
		// Veo defaults an omitted length to 8s and an omitted resolution to 720p.
		{"defaults", `{"model":"veo-3.1-generate-preview","prompt":"a cat"}`, 0.4, 8},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newGeminiBillingRequest(t, tc.body,
				"veo-3.1-generate-preview", "veo-3.1-generate-preview", 0.4)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * tc.wantSeconds / 0.4
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: the
// seconds and resolution ratios still apply and no per-second units appear.
func TestGeminiEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name             string
		body             string
		upstream         string
		wantSecs, wantRR float64
	}{
		{"720p is unit ratio",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"size":"1280x720"}`,
			"veo-3.1-generate-preview", 6, 1.0},
		{"4k on 3.1 keeps its multiplier",
			`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"metadata":{"resolution":"4k"}}`,
			"veo-3.1-generate-preview", 6, 1.5},
		{"4k on 3.1-fast keeps its multiplier",
			`{"model":"veo-3.1-fast-generate-preview","prompt":"a cat","duration":6,"metadata":{"resolution":"4k"}}`,
			"veo-3.1-fast-generate-preview", 6, 2.333333},
		{"defaults", `{"model":"veo-3.0-generate-001","prompt":"a cat"}`,
			"veo-3.0-generate-001", 8, 1.0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newGeminiBillingRequest(t, tc.body,
				"veo-unconfigured", tc.upstream, 0.4)
			ratios := a.EstimateBilling(c, info)
			if ratios["seconds"] != tc.wantSecs {
				t.Fatalf("seconds ratio = %v, want %v", ratios["seconds"], tc.wantSecs)
			}
			if ratios["resolution"] != tc.wantRR {
				t.Fatalf("resolution ratio = %v, want %v", ratios["resolution"], tc.wantRR)
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

// A configured model whose resolution matches no rule must be rejected before
// the upstream call rather than quietly reserved at some other tier's price.
func TestGeminiEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"veo-3.1-generate-preview","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newGeminiBillingRequest(t,
		`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"metadata":{"resolution":"4k"}}`,
		"veo-3.1-generate-preview", "veo-3.1-generate-preview", 0.4)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// metadata["resolution"] is caller-controlled free text. An unclassifiable
// value must leave the request on the legacy path rather than be priced from a
// guessed tier.
func TestGeminiEstimateBillingUnknownResolutionIsNotGuessed(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newGeminiBillingRequest(t,
		`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"metadata":{"resolution":"banana"}}`,
		"veo-unconfigured", "veo-3.1-generate-preview", 0.4)
	ratios := a.EstimateBilling(c, info)
	if ratios["seconds"] != 6 {
		t.Fatalf("legacy ratios lost: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unclassifiable resolution was priced anyway: %v", got)
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Gemini maps that name to an upstream Veo
// model id; keying on the upstream name would divide one model's per-second
// rate by another model's price.
func TestGeminiEstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"veo-3.1-generate-preview","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	// An upstream model that IS in the table, behind a client-facing name that
	// is not.
	a, c, info := newGeminiBillingRequest(t,
		`{"model":"veo-alias","prompt":"a cat","duration":6,"size":"1280x720"}`,
		"veo-alias", "veo-3.1-generate-preview", 0.4)
	ratios := a.EstimateBilling(c, info)
	if ratios["seconds"] != 6 {
		t.Fatalf("unconfigured alias lost its legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("upstream model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the upstream model: %v", got)
	}
}

// A configured model returns nil from EstimateBilling, so its legacy
// seconds/resolution ratios never apply -- per-second is the whole price. When
// the request cannot be priced, returning no ratios therefore bills the bare
// ModelPrice with no seconds multiplier, charging a 30-second render as a
// single unit. It has to fail instead, so relay_task rejects before submitting
// upstream and the request costs nothing.
//
// ResolveVeoDuration always returns a positive length (8s default), so an
// unclassifiable caller-supplied resolution is the only unpriceable shape.
func TestGeminiEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installGeminiVideoPriceRules(t, `[
		{"model":"veo-configured","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newGeminiBillingRequest(t,
		`{"model":"veo-3.1-generate-preview","prompt":"a cat","duration":6,"metadata":{"resolution":"banana"}}`,
		"veo-configured", "veo-3.1-generate-preview", 0.4)
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model must not use legacy ratios: %v", ratios)
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured but unpriceable request must return an error")
	}
}
