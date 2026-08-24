package xaigrok

import (
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
)

// installXaiVideoPriceRules loads a rule set into the live config and restores
// the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installXaiVideoPriceRules(t *testing.T, rulesJSON string) {
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

// newXaiBillingRequest walks the real inbound path
// (ValidateRequestAndSetAction -> ValidateMultipartDirect) so the duration
// parsing and default under test are the ones production actually applies.
func newXaiBillingRequest(t *testing.T, body, originModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{
		OriginModelName: originModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeXaiGrokVideo,
			ChannelBaseUrl:    "https://api.x.example",
			ApiKey:            "test-key",
			UpstreamModelName: ModelGrokImagineVideo15,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice

	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// Grok Imagine exposes no output resolution parameter at all — the upstream
// submit body carries only model / prompt / image / duration. resolveDimensions
// therefore reports only what the request really varies by, and a rule that
// constrains resolution simply never matches.
func TestXaiResolveDimensions(t *testing.T) {
	got := resolveDimensions()
	if got["has_video"] != "false" {
		t.Fatalf("has_video = %q, want false (grok takes no video input)", got["has_video"])
	}
	if _, ok := got["resolution"]; ok {
		t.Fatalf("grok has no resolution parameter, but one was reported: %v", got)
	}
}

func TestXaiSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"has_video": "false"}
	a.secondBillingSeconds = 6
	a.secondBillingModelPrice = 0.11
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"has_video": "false"},
			PricePerSecond: 0.2, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.2 * 6 / 0.11
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestXaiSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestXaiSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"has_video": "false"}
	a.secondBillingSeconds = 6
	a.secondBillingModelPrice = 0.11
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		// Grok never reports a resolution, so this rule can never match.
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.2, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios, and the legacy seconds ratio must not also
// apply — it would multiply the reservation a second time.
func TestXaiEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"grok-imagine-video-1.5","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantSeconds float64
	}{
		{"duration field", `{"model":"grok-imagine-video-1.5","prompt":"a cat","duration":8}`, 8},
		{"seconds string", `{"model":"grok-imagine-video-1.5","prompt":"a cat","seconds":"12"}`, 12},
		// An omitted length falls back to the documented default the legacy
		// path already reserved against, so the two agree on what was asked for.
		{"omitted length defaults", `{"model":"grok-imagine-video-1.5","prompt":"a cat"}`, defaultBillingSeconds},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newXaiBillingRequest(t, tc.body, "grok-imagine-video-1.5", 0.11)
			if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
				t.Fatalf("configured model still returned legacy ratios: %v", ratios)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := 0.2 * tc.wantSeconds / 0.11
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// An image-to-video request is still billed on generated seconds; the reference
// image is an input, not a video, so has_video stays false and the same rule
// prices it.
//
// The request is stored directly rather than parsed through
// ValidateRequestAndSetAction: that path runs the SSRF policy on the image URL,
// which performs a live DNS lookup and would make this a network-dependent
// test. What is under test here is billing, which reads the stored request.
func TestXaiEstimateBillingImageToVideoPricesTheSame(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"grok-imagine-video-1.5","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(`{}`))
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-video-1.5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: ModelGrokImagineVideo15},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.11
	relaycommon.StoreTaskRequest(c, info, constant.TaskActionGenerate, relaycommon.TaskSubmitReq{
		Model:    ModelGrokImagineVideo15,
		Prompt:   "animate",
		Image:    "https://cdn.example.com/a.png",
		Duration: 6,
	})

	a := &TaskAdaptor{}
	a.EstimateBilling(c, info)
	if a.secondBillingDims["has_video"] != "false" {
		t.Fatalf("has_video = %q, want false (an image input is not a video)", a.secondBillingDims["has_video"])
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.2 * 6 / 0.11
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// A model absent from the table keeps today's behaviour: the seconds ratio
// still applies and no per-second units appear. The ratio is now scaled by
// worst/configured so the reservation covers the most expensive tier the model
// can produce — 0.25 (1080P) against a configured 0.11 here. Settlement refunds
// down to the cost the upstream reports, so the customer never pays this.
func TestXaiEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	const worstTierScale = 0.25 / 0.11
	for _, tc := range []struct {
		name     string
		body     string
		wantSecs float64
	}{
		{"explicit duration", `{"model":"grok-imagine-video-1.5","prompt":"a cat","duration":8}`, 8 * worstTierScale},
		{"omitted length", `{"model":"grok-imagine-video-1.5","prompt":"a cat"}`, defaultBillingSeconds * worstTierScale},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newXaiBillingRequest(t, tc.body, "grok-imagine-video-1.5", 0.11)
			ratios := a.EstimateBilling(c, info)
			if math.Abs(ratios["seconds"]-tc.wantSecs) > 1e-9 {
				t.Fatalf("seconds ratio = %v, want %v", ratios["seconds"], tc.wantSecs)
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
// the upstream name would divide one model's per-second rate by another model's
// price — a real hazard here, where the two Grok models are priced differently
// and either can be mapped onto the other upstream.
func TestXaiEstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"grok-imagine-video-1.5","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// The upstream name IS in the table, behind a client-facing name that is not.
	a, c, info := newXaiBillingRequest(t,
		`{"model":"grok-imagine-video-1.5","prompt":"a cat","duration":8}`,
		"unpriced-alias", 0.11)
	if ratios := a.EstimateBilling(c, info); ratios["seconds"] != 8 {
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

// A configured model whose dimensions match no rule must be rejected before the
// upstream call rather than quietly reserved at some unrelated rate.
func TestXaiEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"grok-imagine-video-1.5","match":{"has_video":"true"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newXaiBillingRequest(t,
		`{"model":"grok-imagine-video-1.5","prompt":"a cat","duration":8}`,
		"grok-imagine-video-1.5", 0.11)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// Grok Imagine has no unpriceable dimension and no unpriceable length:
// resolveDimensions reports only has_video (always "false"), and seconds is
// defaulted to defaultBillingSeconds when the request carries none. The only
// way a request goes unpriced is that there is no stored task_request to read
// at all -- and then the legacy `seconds` ratio is skipped too, so a configured
// model would bill the bare ModelPrice with no seconds multiplier.
//
// That has to fail rather than silently underbill: relay_task rejects before
// submitting upstream and the request costs nothing.
func TestXaiEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"grok-video","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-video",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: ModelGrokImagineVideo15},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.5

	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("no stored request means no legacy ratios either; got %v", ratios)
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured but unpriceable request must return an error")
	}
}

// The mirror image: an UNCONFIGURED model must not start failing. Without a
// stored request it was already getting no ratios, and a request the gateway
// never priced per second has nothing to reject.
func TestXaiEstimateBillingUnconfiguredModelStaysPerCallWhenUnpriceable(t *testing.T) {
	installXaiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"has_video":"false"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-unconfigured",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: ModelGrokImagineVideo15},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.5

	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("no stored request means no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("an unconfigured model must never fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}
