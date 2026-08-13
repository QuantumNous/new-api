package sora

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

func newSoraTestContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newSoraRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.openai.example",
			ApiKey:            "test-key",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
}

// newSoraBillingRequest walks the real inbound path (ValidateMultipartDirect via
// ValidateRequestAndSetAction) so the seconds/size defaults under test are the
// ones production actually applies.
func newSoraBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newSoraTestContext(body)
	info := newSoraRelayInfo(modelName, modelPrice)
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installSoraVideoPriceRules loads a rule set into the live config and restores
// the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installSoraVideoPriceRules(t *testing.T, rulesJSON string) {
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

// Sora sends pixel dimensions, not tier labels. Every size the inbound
// validator accepts must classify, or a configured request would be rejected at
// submit time. Portrait and landscape of one tier share a price.
func TestSoraResolveDimensions(t *testing.T) {
	tests := []struct {
		size string
		want string
	}{
		{"720x1280", "720p"},
		{"1280x720", "720p"},
		{"1792x1024", "1080p"},
		{"1024x1792", "1080p"},
		// Labels are accepted too, so a rule may be written either way.
		{"720p", "720p"},
	}
	for _, tc := range tests {
		t.Run(tc.size, func(t *testing.T) {
			got, ok := resolveDimensions(tc.size, false)
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

func TestSoraResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, size := range []string{"banana", "", "999x999", "1280x"} {
		if _, ok := resolveDimensions(size, false); ok {
			t.Fatalf("unknown size %q must not resolve", size)
		}
	}
}

func TestSoraSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
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

func TestSoraSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestSoraSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
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
// table via SecondBillingRatios, and the legacy seconds/size ratios must not
// also apply — they would multiply the reservation a second time.
func TestSoraEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-2-pro","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newSoraBillingRequest(t,
		`{"model":"sora-2-pro","prompt":"a cat","seconds":"8","size":"1792x1024"}`,
		"sora-2-pro", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
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

// Every size the inbound validator accepts must price from its own tier, and
// the 4s default must apply when the client omits the length.
func TestSoraEstimateBillingCoversEveryAcceptedSize(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-2-pro","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"},
		{"model":"sora-2-pro","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"portrait 720p", `{"model":"sora-2-pro","prompt":"a cat","seconds":"8","size":"720x1280"}`, 0.3, 8},
		{"landscape 720p", `{"model":"sora-2-pro","prompt":"a cat","seconds":"8","size":"1280x720"}`, 0.3, 8},
		{"landscape 1080p", `{"model":"sora-2-pro","prompt":"a cat","seconds":"12","size":"1792x1024"}`, 0.5, 12},
		{"portrait 1080p", `{"model":"sora-2-pro","prompt":"a cat","seconds":"12","size":"1024x1792"}`, 0.5, 12},
		// Omitted size defaults to 720x1280 and omitted length to 4s, both
		// applied by the inbound validator before billing runs.
		{"defaults", `{"model":"sora-2-pro","prompt":"a cat"}`, 0.3, 4},
		// duration is the numeric alias for seconds.
		{"duration alias", `{"model":"sora-2-pro","prompt":"a cat","duration":10,"size":"720x1280"}`, 0.3, 10},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newSoraBillingRequest(t, tc.body, "sora-2-pro", 0.5)
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

// A model absent from the table keeps today's behaviour byte for byte: the
// seconds and size ratios still apply and no per-second units appear.
func TestSoraEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name      string
		body      string
		wantSecs  float64
		wantSizeR float64
	}{
		{"720p portrait", `{"model":"sora-2-pro","prompt":"a cat","seconds":"8","size":"720x1280"}`, 8, 1},
		{"1080p landscape", `{"model":"sora-2-pro","prompt":"a cat","seconds":"12","size":"1792x1024"}`, 12, 1.666667},
		{"1080p portrait", `{"model":"sora-2-pro","prompt":"a cat","seconds":"12","size":"1024x1792"}`, 12, 1.666667},
		{"defaults", `{"model":"sora-2-pro","prompt":"a cat"}`, 4, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newSoraBillingRequest(t, tc.body, "sora-2-pro", 0.5)
			ratios := a.EstimateBilling(c, info)
			if ratios["seconds"] != tc.wantSecs {
				t.Fatalf("seconds ratio = %v, want %v", ratios["seconds"], tc.wantSecs)
			}
			if ratios["size"] != tc.wantSizeR {
				t.Fatalf("size ratio = %v, want %v", ratios["size"], tc.wantSizeR)
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

// A configured model whose size matches no rule must be rejected before the
// upstream call rather than quietly reserved at some other tier's price.
func TestSoraEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-2-pro","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newSoraBillingRequest(t,
		`{"model":"sora-2-pro","prompt":"a cat","seconds":"12","size":"1792x1024"}`,
		"sora-2-pro", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// Remix reservations are resolved from the origin task in ResolveOriginTask,
// which already copies that task's frozen billing context. EstimateBilling has
// no request of its own to price, so it must not capture: the origin task's
// reservation is the authority, whether it was per-second or legacy.
func TestSoraEstimateBillingRemixCapturesNothing(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-2-pro","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	c := newSoraTestContext(`{"model":"sora-2-pro","prompt":"remix it"}`)
	info := newSoraRelayInfo("sora-2-pro", 0.5)
	info.Action = constant.TaskActionRemix
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = 0.5
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("remix returned ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("remix must not fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("remix captured per-second billing: %v", got)
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestSoraEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-2-pro","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newSoraBillingRequest(t,
		`{"model":"sora-2-pro","prompt":"a cat","seconds":"8","size":"720x1280"}`,
		"unpriced-alias", 0.5)
	ratios := a.EstimateBilling(c, info)
	if ratios["seconds"] != 8 {
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

// A configured model returns nil from EstimateBilling, so its legacy
// seconds/size ratios never apply -- per-second is the whole price. When the
// request cannot be priced, returning no ratios therefore bills the bare
// ModelPrice with no seconds multiplier, charging a 12-second render as a
// single unit. It has to fail instead, so relay_task rejects before submitting
// upstream and the request costs nothing.
//
// seconds is defaulted to 4 when absent or non-positive, so an unclassifiable
// size is the only unpriceable shape. It is reachable in production because
// ValidateMultipartDirect's size whitelist is keyed on the literal client-facing
// names "sora-2"/"sora-2-pro": a channel that maps an alias onto Sora skips the
// whitelist entirely, and the per-second table is keyed on exactly that alias.
func TestSoraEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"sora-alias","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct{ name, body string }{
		{"unclassifiable size", `{"model":"sora-alias","prompt":"a cat","seconds":"8","size":"banana"}`},
		// A well-formed WxH the shared vocabulary refuses to tier.
		{"unknown pixel tier", `{"model":"sora-alias","prompt":"a cat","seconds":"8","size":"999x999"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newSoraBillingRequest(t, tc.body, "sora-alias", 0.5)
			if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
				t.Fatalf("configured model must not use legacy ratios: %v", ratios)
			}
			if _, err := a.SecondBillingRatios(); err == nil {
				t.Fatal("a configured but unpriceable request must return an error")
			}
		})
	}
}

// The mirror image: an UNCONFIGURED model must still reach its legacy path.
// Sora's legacy ratios do not consult the resolution vocabulary at all -- the
// size multiplier is a literal string comparison and every other size bills at
// 1 -- so a size the per-second path refuses is still fully priced today.
func TestSoraEstimateBillingUnconfiguredModelKeepsLegacyRatiosWhenUnpriceable(t *testing.T) {
	installSoraVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newSoraBillingRequest(t,
		`{"model":"sora-alias","prompt":"a cat","seconds":"8","size":"banana"}`, "sora-alias", 0.5)
	ratios := a.EstimateBilling(c, info)
	if ratios["seconds"] != 8 || ratios["size"] != 1 {
		t.Fatalf("unconfigured model lost its legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("an unconfigured model must never fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}
