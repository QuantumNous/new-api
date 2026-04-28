package billingexpr_test

// Regression tests for doubao-seedance-* billing preset expressions.
//
// These expressions are kept in sync with the PRESET_GROUPS["请求条件"] block in
// web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx.
// If you change one side, change the other.
//
// Expression structure: tier("base", c * <base_price>) * <param_multiplier>
// - Tier block comes first; param-based branching is expressed as multipliers.
// - This form is required because the UI evaluator (evalExprLocally) evaluates
//   tier() first and handles param() stubs separately. The old form
//   (param(...) ? tier(...) : tier(...)) caused a ReferenceError in the
//   UI cost-estimator because param is not in the JS eval environment when
//   it appears before tier().
// - Both forms compile and run correctly in the Go billingexpr engine;
//   the constraint is a UI-side evaluation ordering concern.
//
// Pricing reference (RMB / 1M output tokens):
//   seedance-2-0:          std+text=46, std+video=28, 1080p+text=51, 1080p+video=31
//   seedance-2-0-fast:     text=37, video=22
//   seedance-1-5-pro:      with-audio=16, silent=8
//   seedance-1-0-pro:      online=15, flex=7.5
//   seedance-1-0-pro-fast: online=4.2, flex=2.1
//   seedance-1-0-lite:     online=10, flex=5

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/billing_setting"
)

// ---------------------------------------------------------------------------
// Expression constants — keep in sync with TieredPricingEditor.jsx
// ---------------------------------------------------------------------------

const seedance20Expr = `tier("base", c * 46) * ((param("resolution") == "1080p" || param("metadata.resolution") == "1080p") ? ((param("content.#(type==\"video_url\")") != nil || param("metadata.content.#(type==\"video_url\")") != nil) ? 31.0/46.0 : 51.0/46.0) : ((param("content.#(type==\"video_url\")") != nil || param("metadata.content.#(type==\"video_url\")") != nil) ? 28.0/46.0 : 1.0))`

const seedance20FastExpr = `tier("base", c * 37) * ((param("content.#(type==\"video_url\")") != nil || param("metadata.content.#(type==\"video_url\")") != nil) ? 22.0/37.0 : 1.0)`

const seedance15ProExpr = `tier("base", c * 16) * ((param("generate_audio") == false || param("metadata.generate_audio") == false) ? 0.5 : 1.0)`

const seedance10ProExpr = `tier("base", c * 15) * ((param("service_tier") == "flex" || param("metadata.service_tier") == "flex") ? 0.5 : 1.0)`

const seedance10ProFastExpr = `tier("base", c * 4.2) * ((param("service_tier") == "flex" || param("metadata.service_tier") == "flex") ? 0.5 : 1.0)`

const seedance10LiteExpr = `tier("base", c * 10) * ((param("service_tier") == "flex" || param("metadata.service_tier") == "flex") ? 0.5 : 1.0)`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cM = 1_000_000.0 // 1M completion tokens — maps price directly to RMB

func runSD(t *testing.T, exprStr, body string, c, want float64) {
	t.Helper()
	got, _, err := billingexpr.RunExprWithRequest(
		exprStr,
		billingexpr.TokenParams{C: c},
		billingexpr.RequestInput{Body: []byte(body)},
	)
	if err != nil {
		t.Fatalf("RunExprWithRequest: %v", err)
	}
	if math.Abs(got-want) > 1e-4 {
		t.Errorf("got %.6f want %.6f", got, want)
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-2-0
// 2 dimensions: resolution (std / 1080p) × content type (text / video)
// Prices: std+text=46, std+video=28, 1080p+text=51, 1080p+video=31
// ---------------------------------------------------------------------------

func TestSeedance20Pricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		// --- Volc native body ---
		{
			"native std+text (no resolution, no video)",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}]}`,
			46 * cM,
		},
		{
			"native std+video",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"video_url","video_url":{"url":"x"}},{"type":"text","text":"hi"}]}`,
			28 * cM,
		},
		{
			"native 1080p+text",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"resolution":"1080p"}`,
			51 * cM,
		},
		{
			"native 1080p+video",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"video_url","video_url":{"url":"x"}},{"type":"text","text":"hi"}],"resolution":"1080p"}`,
			31 * cM,
		},
		// --- OpenAI-format wrapped body (fields under metadata.*) ---
		{
			"wrapped std+text",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{}}`,
			46 * cM,
		},
		{
			"wrapped std+video",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}]}}`,
			28 * cM,
		},
		{
			"wrapped 1080p+text",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"resolution":"1080p"}}`,
			51 * cM,
		},
		{
			"wrapped 1080p+video",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}],"resolution":"1080p"}}`,
			31 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance20Expr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-2-0-fast
// 1 dimension: content type (text / video)
// Prices: text=37, video=22
// ---------------------------------------------------------------------------

func TestSeedance20FastPricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		{
			"native text",
			`{"model":"doubao-seedance-2-0-fast-260128","content":[{"type":"text","text":"hi"}]}`,
			37 * cM,
		},
		{
			"native video",
			`{"model":"doubao-seedance-2-0-fast-260128","content":[{"type":"video_url","video_url":{"url":"x"}}]}`,
			22 * cM,
		},
		{
			"wrapped text",
			`{"model":"doubao-seedance-2-0-fast-260128","prompt":"hi","metadata":{}}`,
			37 * cM,
		},
		{
			"wrapped video",
			`{"model":"doubao-seedance-2-0-fast-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}]}}`,
			22 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance20FastExpr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-1-5-pro
// 1 dimension: generate_audio (default true → with audio=16; explicit false → silent=8)
// ---------------------------------------------------------------------------

func TestSeedance15ProPricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		{
			"native with-audio (field absent, defaults true)",
			`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}]}`,
			16 * cM,
		},
		{
			"native silent (generate_audio=false)",
			`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}],"generate_audio":false}`,
			8 * cM,
		},
		{
			"native with-audio explicit (generate_audio=true)",
			`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}],"generate_audio":true}`,
			16 * cM,
		},
		{
			"wrapped with-audio (field absent)",
			`{"model":"doubao-seedance-1-5-pro-251215","prompt":"hi","metadata":{}}`,
			16 * cM,
		},
		{
			"wrapped silent (metadata.generate_audio=false)",
			`{"model":"doubao-seedance-1-5-pro-251215","prompt":"hi","metadata":{"generate_audio":false}}`,
			8 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance15ProExpr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-1-0-pro
// 1 dimension: service_tier (default online=15; "flex"=7.5)
// ---------------------------------------------------------------------------

func TestSeedance10ProPricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		{
			"native online (field absent)",
			`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}]}`,
			15 * cM,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			7.5 * cM,
		},
		{
			"wrapped online (field absent)",
			`{"model":"doubao-seedance-1-0-pro-250528","prompt":"hi","metadata":{}}`,
			15 * cM,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-pro-250528","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			7.5 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10ProExpr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-1-0-pro-fast
// 1 dimension: service_tier (online=4.2, flex=2.1)
// ---------------------------------------------------------------------------

func TestSeedance10ProFastPricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		{
			"native online",
			`{"model":"doubao-seedance-1-0-pro-fast","content":[{"type":"text","text":"hi"}]}`,
			4.2 * cM,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-pro-fast","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			2.1 * cM,
		},
		{
			"wrapped online",
			`{"model":"doubao-seedance-1-0-pro-fast","prompt":"hi","metadata":{}}`,
			4.2 * cM,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-pro-fast","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			2.1 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10ProFastExpr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-1-0-lite
// 1 dimension: service_tier (online=10, flex=5)
// ---------------------------------------------------------------------------

func TestSeedance10LitePricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		wantPrice float64
	}{
		{
			"native online",
			`{"model":"doubao-seedance-1-0-lite","content":[{"type":"text","text":"hi"}]}`,
			10 * cM,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-lite","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			5 * cM,
		},
		{
			"wrapped online",
			`{"model":"doubao-seedance-1-0-lite","prompt":"hi","metadata":{}}`,
			10 * cM,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-lite","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			5 * cM,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10LiteExpr, tt.body, cM, tt.wantPrice)
		})
	}
}

// ---------------------------------------------------------------------------
// Smoke-test gate — mirrors what the admin UI runs at save time
// ---------------------------------------------------------------------------

func TestSeedancePresetsPassSmokeTest(t *testing.T) {
	exprs := map[string]string{
		"doubao-seedance-2-0":          seedance20Expr,
		"doubao-seedance-2-0-fast":     seedance20FastExpr,
		"doubao-seedance-1-5-pro":      seedance15ProExpr,
		"doubao-seedance-1-0-pro":      seedance10ProExpr,
		"doubao-seedance-1-0-pro-fast": seedance10ProFastExpr,
		"doubao-seedance-1-0-lite":     seedance10LiteExpr,
	}
	for name, exprStr := range exprs {
		t.Run(name, func(t *testing.T) {
			if err := billing_setting.SmokeTestExpr(exprStr); err != nil {
				t.Fatalf("smoke test failed: %v", err)
			}
		})
	}
}
