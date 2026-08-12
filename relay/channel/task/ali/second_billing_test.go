package ali

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
)

// installAliVideoPriceRules loads a rule set into the live config and restores
// the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installAliVideoPriceRules(t *testing.T, rulesJSON string) {
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

func newAliSecondBillingInfo(originModel, upstreamModel string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: originModel,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: upstreamModel},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newAliLegacyRequest stores a legacy (wan*) task request the way
// ValidateMultipartDirect would, so EstimateBilling re-derives resolution and
// duration through the real convertToAliRequest path.
func newAliLegacyRequest(t *testing.T, req relaycommon.TaskSubmitReq, originModel, upstreamModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	ctx := newHappyHorseContext(`{}`, "application/json")
	info := newAliSecondBillingInfo(originModel, upstreamModel, modelPrice)
	relaycommon.StoreTaskRequest(ctx, info, "submit", req)
	return &TaskAdaptor{}, ctx, info
}

// Ali resolutions are upper-case "P"-suffixed labels ("720P") built by
// convertToAliRequest / sizeToResolution. Every tier the adapter can produce
// must classify, or a configured request would be rejected at submit time.
func TestAliResolveDimensions(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"480P", "480p"},
		{"720P", "720p"},
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

// happyhorse-1.0-video-edit takes a reference video, so has_video must be able
// to distinguish it — that is the dimension an administrator prices a
// video-input request on.
func TestAliResolveDimensionsMarksVideoInput(t *testing.T) {
	got, ok := resolveDimensions("1080P", true)
	if !ok {
		t.Fatal("expected dimensions to resolve")
	}
	if got["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true", got["has_video"])
	}
}

func TestAliResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, in := range []string{"banana", "", "P", "999P"} {
		if _, ok := resolveDimensions(in, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", in)
		}
	}
}

func TestAliSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
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

func TestAliSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestAliSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
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

// The whole point of the conversion: a configured legacy model must be priced
// from the table, and the legacy seconds / resolution-<X>P ratios must not also
// apply — they would multiply the reservation a second time.
func TestAliEstimateBillingConfiguredLegacyModelPricesPerSecond(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"wan-video","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newAliLegacyRequest(t, relaycommon.TaskSubmitReq{
		Model:    "wan2.5-i2v-preview",
		Duration: 5,
		Size:     "720P",
	}, "wan-video", "wan2.5-i2v-preview", 0.14)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("configured model still returned legacy ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.3 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Resolution reaches billing through three legacy shapes: an explicit "720P"
// label, a "W*H" size the adapter maps via sizeToResolution, and the
// per-model-family defaults. All three must price from the table, and an
// omitted duration must fall back to Ali's 5-second default.
func TestAliEstimateBillingCoversEveryLegacyResolutionSource(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"wan-video","match":{"resolution":"480p"},"price_per_second":0.1,"basis":"output_duration"},
		{"model":"wan-video","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"},
		{"model":"wan-video","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		req         relaycommon.TaskSubmitReq
		upstream    string
		wantPrice   float64
		wantSeconds float64
	}{
		{"explicit 480P label",
			relaycommon.TaskSubmitReq{Model: "wan2.5-i2v-preview", Duration: 4, Size: "480P"},
			"wan2.5-i2v-preview", 0.1, 4},
		{"lower-case label is upper-cased",
			relaycommon.TaskSubmitReq{Model: "wan2.5-i2v-preview", Duration: 4, Size: "720p"},
			"wan2.5-i2v-preview", 0.3, 4},
		{"size maps through sizeToResolution",
			relaycommon.TaskSubmitReq{Model: "wan2.5-t2v-preview", Duration: 6, Size: "1920*1080"},
			"wan2.5-t2v-preview", 0.5, 6},
		{"seconds string",
			relaycommon.TaskSubmitReq{Model: "wan2.5-i2v-preview", Seconds: "8", Size: "720P"},
			"wan2.5-i2v-preview", 0.3, 8},
		// wan2.5 i2v defaults to 1080P, and an omitted duration to 5s.
		{"model-family defaults",
			relaycommon.TaskSubmitReq{Model: "wan2.5-i2v-preview"},
			"wan2.5-i2v-preview", 0.5, 5},
		// wan2.2-i2v-flash defaults to 720P instead.
		{"flash family default",
			relaycommon.TaskSubmitReq{Model: "wan2.2-i2v-flash"},
			"wan2.2-i2v-flash", 0.3, 5},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newAliLegacyRequest(t, tc.req, "wan-video", tc.upstream, 0.14)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * tc.wantSeconds / 0.14
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// happyhorse takes a separate inbound format and derives its length from
// ReservationSeconds. Its resolution is an optional "720P"/"1080P" parameter
// that renders at 1080P when omitted, and video-edit carries a reference video.
func TestAliEstimateBillingHappyHorsePricesPerSecond(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"public-video","match":{"resolution":"720p","has_video":"false"},"price_per_second":0.3,"basis":"output_duration"},
		{"model":"public-video","match":{"resolution":"1080p","has_video":"false"},"price_per_second":0.5,"basis":"output_duration"},
		{"model":"public-video","match":{"resolution":"1080p","has_video":"true"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		upstream    string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"t2v explicit duration and resolution", "happyhorse-1.1-t2v",
			`{"model":"happyhorse-1.1-t2v","input":{"prompt":"run"},"parameters":{"duration":7,"resolution":"1080P"}}`,
			0.5, 7},
		{"t2v 720P", "happyhorse-1.1-t2v",
			`{"model":"happyhorse-1.1-t2v","input":{"prompt":"run"},"parameters":{"duration":7,"resolution":"720P"}}`,
			0.3, 7},
		// An omitted duration reserves 5s and an omitted resolution renders at
		// the upstream 1080P default.
		{"i2v defaults", "happyhorse-1.1-i2v",
			`{"model":"happyhorse-1.1-i2v","input":{"media":[{"type":"first_frame","url":"https://example.com/frame.png"}]}}`,
			0.5, 5},
		{"r2v explicit 720P", "happyhorse-1.1-r2v",
			`{"model":"happyhorse-1.1-r2v","input":{"prompt":"run","media":[{"type":"reference_image","url":"https://example.com/reference.png"}]},"parameters":{"resolution":"720P"}}`,
			0.3, 5},
		// video-edit reserves a fixed 30s and always carries a reference video.
		{"video edit is has_video", "happyhorse-1.0-video-edit",
			`{"model":"happyhorse-1.0-video-edit","input":{"prompt":"edit","media":[{"type":"video","url":"https://example.com/video.mp4"}]},"parameters":{}}`,
			0.2, 30},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := newHappyHorseContext(tc.body, "application/json")
			info := newAliSecondBillingInfo("public-video", tc.upstream, 0.14)
			a := &TaskAdaptor{}
			if taskErr := a.ValidateRequestAfterModelMapping(ctx, info); taskErr != nil {
				t.Fatalf("ValidateRequestAfterModelMapping error: %+v", taskErr)
			}
			if ratios := a.EstimateBilling(ctx, info); len(ratios) != 0 {
				t.Fatalf("configured model still returned legacy ratios: %v", ratios)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * tc.wantSeconds / 0.14
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte on both
// inbound paths: the legacy ratios still apply and no per-second units appear.
func TestAliEstimateBillingUnconfiguredModelKeepsLegacyRatios(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	t.Run("legacy wan", func(t *testing.T) {
		a, c, info := newAliLegacyRequest(t, relaycommon.TaskSubmitReq{
			Model:    "wan2.5-i2v-preview",
			Duration: 5,
			Size:     "720P",
		}, "wan-unconfigured", "wan2.5-i2v-preview", 0.14)
		ratios := a.EstimateBilling(c, info)
		if ratios["seconds"] != 5 || ratios["resolution-720P"] != 2 {
			t.Fatalf("EstimateBilling() = %#v, want legacy seconds and resolution ratios", ratios)
		}
		got, err := a.SecondBillingRatios()
		if err != nil {
			t.Fatalf("SecondBillingRatios error: %v", err)
		}
		if len(got) != 0 {
			t.Fatalf("unconfigured model produced per-second units: %v", got)
		}
	})

	t.Run("happyhorse", func(t *testing.T) {
		ctx := newHappyHorseContext(
			`{"model":"happyhorse-1.1-t2v","input":{"prompt":"run"},"parameters":{"duration":7,"resolution":"1080P"}}`,
			"application/json")
		info := newAliSecondBillingInfo("hh-unconfigured", "happyhorse-1.1-t2v", 0.14)
		a := &TaskAdaptor{}
		if taskErr := a.ValidateRequestAfterModelMapping(ctx, info); taskErr != nil {
			t.Fatalf("ValidateRequestAfterModelMapping error: %+v", taskErr)
		}
		ratios := a.EstimateBilling(ctx, info)
		if len(ratios) != 1 || ratios["seconds"] != 7 {
			t.Fatalf("EstimateBilling() = %#v, want only seconds=7", ratios)
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

// A configured model whose resolution matches no rule must be rejected before
// the upstream call rather than quietly reserved at some other tier's price.
func TestAliEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"wan-video","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newAliLegacyRequest(t, relaycommon.TaskSubmitReq{
		Model:    "wan2.5-i2v-preview",
		Duration: 5,
		Size:     "1080P",
	}, "wan-video", "wan2.5-i2v-preview", 0.14)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// A malformed legacy request cannot be converted, so neither its length nor its
// resolution is knowable. Capturing would price the request off a fabricated
// tier; skipping leaves it on the pre-existing (nil ratios) path.
func TestAliEstimateBillingSkipsCaptureWhenRequestIsUnconvertible(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"wan-video","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	// A t2v model with a non-"W*H" size fails convertToAliRequest outright.
	a, c, info := newAliLegacyRequest(t, relaycommon.TaskSubmitReq{
		Model:    "wan2.5-t2v-preview",
		Duration: 5,
		Size:     "720P",
	}, "wan-video", "wan2.5-t2v-preview", 0.14)
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("unconvertible request produced ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unconvertible request must not fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconvertible request was priced anyway: %v", got)
	}
}

// happyhorse-1.1-t2v requires an explicit duration; a request without one is
// rejected at validation, but EstimateBilling is defensive about it too. An
// unknowable length must not be captured and priced off a guess.
func TestAliEstimateBillingSkipsCaptureWhenHappyHorseLengthIsUnknowable(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"public-video","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	ctx := newHappyHorseContext(
		`{"model":"happyhorse-1.1-t2v","input":{"prompt":"run"},"parameters":{"resolution":"1080P"}}`,
		"application/json")
	info := newAliSecondBillingInfo("public-video", "happyhorse-1.1-t2v", 0.14)
	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(ctx, info); len(ratios) != 0 {
		t.Fatalf("unknowable length produced ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unknowable length must not fail pricing: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unknowable length was priced anyway: %v", got)
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Ali maps that name to an upstream wan /
// happyhorse model id; keying on the upstream name would divide one model's
// per-second rate by another model's price.
func TestAliEstimateBillingKeysTableOnOriginModelNameNotUpstream(t *testing.T) {
	installAliVideoPriceRules(t, `[
		{"model":"wan2.5-i2v-preview","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	// An upstream model that IS in the table, behind a client-facing name that
	// is not.
	a, c, info := newAliLegacyRequest(t, relaycommon.TaskSubmitReq{
		Model:    "wan2.5-i2v-preview",
		Duration: 5,
		Size:     "720P",
	}, "wan-alias", "wan2.5-i2v-preview", 0.14)
	ratios := a.EstimateBilling(c, info)
	if ratios["seconds"] != 5 {
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
