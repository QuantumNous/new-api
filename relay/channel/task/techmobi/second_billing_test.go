package techmobi

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
)

// installTechMobiVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installTechMobiVideoPriceRules(t *testing.T, rulesJSON string) {
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

// newTechMobiBillingRequest walks the real inbound path
// (ValidateRequestAndSetAction -> BindSeedanceRequest) so the request
// EstimateBilling reads is the one production actually stores.
func newTechMobiBillingRequest(t *testing.T, body, originModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c, _ := newJSONCtx(body)
	info := newRelayInfo()
	info.OriginModelName = originModel
	info.UpstreamModelName = "doubao/doubao-seedance-2-0-260128"
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// TechMobi serves the seedance resolution set, all of which the shared
// NormalizeResolution vocabulary classifies. Every tier the legacy ratio table
// prices must classify too, or a configured request would be rejected at submit
// time while the legacy path happily priced it.
func TestTechMobiResolveDimensions(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"480p", "480p"},
		{"720p", "720p"},
		{"1080p", "1080p"},
		{"4k", "4k"},
		{"1080P", "1080p"},
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

// A video input costs materially less upstream — the legacy table prices it at
// a different rate for every tier — so has_video must be able to distinguish it.
func TestTechMobiResolveDimensionsMarksVideoInput(t *testing.T) {
	got, ok := resolveDimensions("1080p", true)
	if !ok {
		t.Fatal("expected dimensions to resolve")
	}
	if got["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true", got["has_video"])
	}
}

func TestTechMobiResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, in := range []string{"", "banana", "999p", "2k", "360p"} {
		if _, ok := resolveDimensions(in, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", in)
		}
	}
}

func TestTechMobiSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
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

func TestTechMobiSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestTechMobiSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
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
// table via SecondBillingRatios, and the legacy video_generation ratio must not
// also apply — it would multiply the reservation a second time.
func TestTechMobiEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"1080p","has_video":"false"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}],
		"resolution":"1080p",
		"duration":8
	}`, "doubao/doubao-seedance-2-0-260128", 0.14)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.5 * 8 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// An omitted resolution renders at the upstream's 720p default, and an omitted
// duration at its 5s default. Naming both lets a rule match the tier and length
// actually produced rather than falling through to no match.
func TestTechMobiEstimateBillingAppliesUpstreamDefaults(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"720p","has_video":"false"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}]
	}`, "doubao/doubao-seedance-2-0-260128", 0.14)

	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.4 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// A video input is a distinct billing dimension the legacy table already
// discounts, so a rule must be able to price it separately.
func TestTechMobiEstimateBillingPricesVideoInputSeparately(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"1080p","has_video":"false"},"price_per_second":0.5,"basis":"output_duration"},
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"1080p","has_video":"true"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"extend this clip"},
			{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4"}}
		],
		"resolution":"1080p",
		"duration":8
	}`, "doubao/doubao-seedance-2-0-260128", 0.14)

	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.3 * 8 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// frames sets the length in frames at a per-model fps the gateway does not
// know, and duration -1 explicitly hands the length to the model. Neither is
// knowable at submit time, so for a model absent from the price table capture
// must be skipped and the request left on the legacy path rather than priced
// off a fabricated length. (A CONFIGURED model has no legacy path left to fall
// back to, so the same shapes are refused instead — see
// TestTechMobiEstimateBillingConfiguredButUnpriceableErrors.)
func TestTechMobiEstimateBillingSkipsCaptureWhenLengthIsUndeterminable(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"1080p","has_video":"false"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	for _, tc := range []struct{ name, field string }{
		{"frames", `"frames":240`},
		{"model-chosen duration", `"duration":-1`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newTechMobiBillingRequest(t, `{
				"model":"doubao/doubao-seedance-2-0-260128",
				"content":[{"type":"text","text":"a cat walking"}],
				"resolution":"1080p",
				`+tc.field+`
			}`, "techmobi-unconfigured", 0.14)

			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an undeterminable length must not fail an unconfigured model: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("priced off a fabricated length: %v", got)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: the
// video_generation ratio still applies and no per-second units appear.
func TestTechMobiEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"extend this clip"},
			{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4"}}
		],
		"resolution":"1080p"
	}`, "doubao/doubao-seedance-2-0-260128", 0.14)

	ratios := a.EstimateBilling(c, info)
	want, _ := GetVideoGenerationRatio("doubao/doubao-seedance-2-0-260128", "1080p", true)
	if ratios["video_generation"] != want {
		t.Fatalf("video_generation ratio = %v, want %v", ratios["video_generation"], want)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// The table and ModelPrice are both keyed on the client-facing name, while the
// legacy video_generation table keys on the upstream name. Keying capture on the
// upstream name would divide one model's per-second rate by another's price.
func TestTechMobiEstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"1080p","has_video":"false"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	// The upstream name IS in the table, behind a client-facing name that is not.
	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}],
		"resolution":"1080p",
		"duration":8
	}`, "unpriced-alias", 0.14)

	ratios := a.EstimateBilling(c, info)
	want, _ := GetVideoGenerationRatio("doubao/doubao-seedance-2-0-260128", "1080p", false)
	if ratios["video_generation"] != want {
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
// upstream call rather than quietly reserved at some other tier's price.
func TestTechMobiEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"doubao/doubao-seedance-2-0-260128","match":{"resolution":"720p"},"price_per_second":0.4,"basis":"output_duration"}
	]`)

	a, c, info := newTechMobiBillingRequest(t, `{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}],
		"resolution":"1080p",
		"duration":8
	}`, "doubao/doubao-seedance-2-0-260128", 0.14)

	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// A configured model returns nil from EstimateBilling, so its legacy
// video_generation ratio never applies -- per-second is the whole price. When
// the request cannot be priced, returning no ratios therefore bills the bare
// ModelPrice with no seconds multiplier, charging a 30-second render as a
// single unit. It has to fail instead, so relay_task rejects before submitting
// upstream and the request costs nothing.
func TestTechMobiEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"public-video","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	for _, tc := range []struct{ name, body string }{
		{"frames", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"}],"resolution":"1080p","frames":240}`},
		{"model-chosen duration", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"}],"resolution":"1080p","duration":-1}`},
		{"unclassifiable resolution", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"}],"resolution":"banana","duration":5}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newTechMobiBillingRequest(t, tc.body, "public-video", 0.14)
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
// GetVideoGenerationRatio ignores the length entirely and falls an unrecognised
// resolution back to the base tier, so it really does still price every shape
// the per-second path refuses -- returning nil would silently drop these
// requests to per-call billing.
func TestTechMobiEstimateBillingUnconfiguredModelKeepsLegacyRatioWhenUnpriceable(t *testing.T) {
	installTechMobiVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	video := `{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4"}}`
	for _, tc := range []struct{ name, body, resolution string }{
		{"frames", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"},` + video + `],"resolution":"1080p","frames":240}`, "1080p"},
		{"model-chosen duration", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"},` + video + `],"resolution":"1080p","duration":-1}`, "1080p"},
		{"unclassifiable resolution", `{"model":"doubao/doubao-seedance-2-0-260128","content":[{"type":"text","text":"a cat"},` + video + `],"resolution":"banana","duration":5}`, "banana"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newTechMobiBillingRequest(t, tc.body, "techmobi-unconfigured", 0.14)
			ratios := a.EstimateBilling(c, info)
			want, ok := GetVideoGenerationRatio("doubao/doubao-seedance-2-0-260128", tc.resolution, true)
			if !ok || want == 1.0 {
				t.Fatal("test premise: the legacy table must price this shape at a non-unit ratio")
			}
			if ratios["video_generation"] != want {
				t.Fatalf("unconfigured model lost its legacy video_generation ratio: %v, want %v", ratios, want)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an unconfigured model must never fail pricing: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("unconfigured model produced per-second units: %v", got)
			}
		})
	}
}
