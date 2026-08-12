package jimeng

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

func newJSONCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newBillingRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://visual.volcengineapi.example",
			ApiKey:            "ak|sk",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newBillingRequest walks the real inbound path (ValidateRequestAndSetAction ->
// ValidateBasicTaskRequest) so the duration under test is the one production
// actually stores.
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

// Jimeng exposes no output resolution parameter at all — the upstream submit
// body is req_key / prompt / images / seed / aspect_ratio / frames.
// resolveDimensions therefore reports only what the request really varies by,
// and a rule that constrains resolution simply never matches. aspect_ratio is a
// shape, not a pixel tier, so it is deliberately not reported as one.
func TestResolveDimensions(t *testing.T) {
	got := resolveDimensions()
	if got["has_video"] != "false" {
		t.Fatalf("has_video = %q, want false (jimeng takes no video input)", got["has_video"])
	}
	if _, ok := got["resolution"]; ok {
		t.Fatalf("jimeng has no resolution parameter, but one was reported: %v", got)
	}
}

// The upstream length is expressed in frames, not seconds. Only the two frame
// counts this channel itself produces carry a documented length (24 fps: 121 =
// 5s, 241 = 10s). Anything else — a metadata-injected frame count — has no
// documented fps behind it and must not be converted from a guessed rate.
func TestBillableSeconds(t *testing.T) {
	for _, tc := range []struct {
		name   string
		frames int
		want   float64
		wantOK bool
	}{
		{"5s", framesFor5Seconds, 5, true},
		{"10s", framesFor10Seconds, 10, true},
		{"zero", 0, 0, false},
		{"negative", -1, 0, false},
		// A metadata override may set any frame count; without a documented fps
		// for it the length is not determinable.
		{"arbitrary metadata frames", 300, 0, false},
		{"off by one", 122, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := billableSeconds(tc.frames)
			if ok != tc.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tc.wantOK)
			}
			if got != tc.want {
				t.Fatalf("seconds = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"has_video": "false"},
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
	a.secondBillingDims = map[string]string{"has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		// Jimeng never reports a resolution, so this rule can never match.
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
		{"model":"jimeng_vgfm_t2v_l20","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t,
		`{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`,
		"jimeng_vgfm_t2v_l20", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("this channel has no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.3 * 10 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// The seconds billed must be the length the upstream will actually render, which
// convertToRequestPayload expresses as a frame count. Only duration 10 selects
// the 241-frame (10s) form; every other value — including an omitted one — takes
// the 121-frame (5s) default branch, so the length is always determinable from
// the top-level field.
func TestEstimateBillingFollowsTheUpstreamFrameCount(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng_vgfm_t2v_l20","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantSeconds float64
	}{
		{"duration 10 renders 241 frames", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`, 10},
		{"duration 5 renders 121 frames", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":5}`, 5},
		// Every non-10 value takes the default branch, so the upstream renders
		// 5s and billing must agree rather than echo what the client asked for.
		{"omitted duration defaults to 5s", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat"}`, 5},
		{"duration 7 still renders 5s", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":7}`, 5},
		{"negative duration still renders 5s", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":-1}`, 5},
		// duration also accepts a JSON string at the top level.
		{"string duration 10", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":"10"}`, 10},
		// A metadata frames override reaches the upstream, so billing follows it
		// when the count is one of the documented ones.
		{"metadata frames override to 10s", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":5,"metadata":{"frames":241}}`, 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "jimeng_vgfm_t2v_l20", 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := 0.3 * tc.wantSeconds / 0.5
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
		{"model":"some-other-model","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t,
		`{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`,
		"jimeng_vgfm_t2v_l20", 0.5)
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

// A configured model whose dimensions match no rule must be rejected before the
// upstream call rather than quietly reserved at some unrelated rate. Writing a
// resolution rule for this channel is the realistic way to get there, since it
// never reports one.
func TestEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng_vgfm_t2v_l20","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newBillingRequest(t,
		`{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`,
		"jimeng_vgfm_t2v_l20", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the upstream req_key would divide
// one model's per-second rate by another model's price — a real hazard here,
// where convertToRequestPayload rewrites req_key per request shape.
func TestEstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng_vgfm_t2v_l20","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	// The upstream name IS in the table, behind a client-facing name that is not.
	a, c, info := newBillingRequest(t,
		`{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`,
		"unpriced-alias", 0.5)
	info.UpstreamModelName = "jimeng_vgfm_t2v_l20"
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("upstream name must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the upstream model name: %v", got)
	}
}

// A metadata frames override with no documented fps behind it makes the rendered
// length unknowable. Capture must be skipped so the request keeps its per-call
// price rather than being billed off a guessed frame rate.
func TestEstimateBillingUndeterminableFrameCountIsNotCaptured(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng_vgfm_t2v_l20","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name string
		body string
	}{
		{"arbitrary frames", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":5,"metadata":{"frames":300}}`},
		{"zero frames", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":5,"metadata":{"frames":0}}`},
		{"negative frames", `{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":5,"metadata":{"frames":-1}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newBillingRequest(t, tc.body, "jimeng_vgfm_t2v_l20", 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an undeterminable request must stay on the per-call path, got error: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("priced off an undeterminable frame count: %v", got)
			}
		})
	}
}

// Without a stored task_request there is nothing to price; EstimateBilling must
// return cleanly rather than capture a zero-valued request.
func TestEstimateBillingWithoutTaskRequestCapturesNothing(t *testing.T) {
	installVideoPriceRules(t, `[
		{"model":"jimeng_vgfm_t2v_l20","match":{"has_video":"false"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	c := newJSONCtx(`{"model":"jimeng_vgfm_t2v_l20","prompt":"a cat","duration":10}`)
	info := newBillingRelayInfo("jimeng_vgfm_t2v_l20", 0.5)
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
