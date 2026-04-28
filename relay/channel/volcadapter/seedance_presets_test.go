package volcadapter_test

// Regression tests for doubao-seedance-* billing preset expressions.
//
// These expressions are kept in sync with the PRESET_GROUPS["请求条件"] block in
// web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx.
// If you change one side, change the other.
//
// Expression structure: combineBillingExpr(expr, buildRequestRuleExpr(requestRules))
//   → "(tier("base", c * BASE)) * (rule1) * (rule2) * ..."
//
// Each rule group compiles to: (condition ? multiplier : 1)
// Multiple groups multiply together (multiplicative composition).
//
// For doubao-seedance-2-0, two dimensions (resolution × content-type) are each
// handled by independent multiplicative rules, one for the Volc native body shape
// (top-level fields) and one for the OpenAI-format shape (fields under metadata.*).
// In practice only one shape fires per request, so multipliers don't stack.
// The 1080p+video composed case yields 31.04 instead of exactly 31.00 (~0.13%
// drift); this is accepted because Volc may publish 31 as a rounded display price.
//
// Pricing reference (RMB / 1M output tokens):
//   seedance-2-0:          std+text=46, std+video=28, 1080p+text=51, 1080p+video≈31.04
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
//
// These are the strings produced by:
//   combineBillingExpr(expr, buildRequestRuleExpr(requestRules))
// where combineBillingExpr(base, rules) = "(base) * rules"
// and each rule group = "(condition ? multiplier : 1)"
// and path strings are JSON.stringify'd (e.g. content.#(type=="video_url")
// becomes "content.#(type==\"video_url\")" in the expression string).

const seedance20Expr = `(tier("base", c * 46)) * (param("resolution") == "1080p" ? 1.108696 : 1) * (param("metadata.resolution") == "1080p" ? 1.108696 : 1) * (param("content.#(type==\"video_url\")") != nil ? 0.608696 : 1) * (param("metadata.content.#(type==\"video_url\")") != nil ? 0.608696 : 1)`

const seedance20FastExpr = `(tier("base", c * 37)) * (param("content.#(type==\"video_url\")") != nil ? 0.594595 : 1) * (param("metadata.content.#(type==\"video_url\")") != nil ? 0.594595 : 1)`

const seedance15ProExpr = `(tier("base", c * 16)) * (param("generate_audio") == false ? 0.5 : 1) * (param("metadata.generate_audio") == false ? 0.5 : 1)`

const seedance10ProExpr = `(tier("base", c * 15)) * (param("service_tier") == "flex" ? 0.5 : 1) * (param("metadata.service_tier") == "flex" ? 0.5 : 1)`

const seedance10ProFastExpr = `(tier("base", c * 4.2)) * (param("service_tier") == "flex" ? 0.5 : 1) * (param("metadata.service_tier") == "flex" ? 0.5 : 1)`

const seedance10LiteExpr = `(tier("base", c * 10)) * (param("service_tier") == "flex" ? 0.5 : 1) * (param("metadata.service_tier") == "flex" ? 0.5 : 1)`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// runSD runs exprStr with c=1 token and checks the result against want (in
// quota units, which equals price in RMB/M when c=1).  Tolerance 0.01 covers
// the ~1.6e-5 rounding drift introduced by 6-decimal multipliers.
func runSD(t *testing.T, exprStr, body string, want float64) {
	t.Helper()
	got, _, err := billingexpr.RunExprWithRequest(
		exprStr,
		billingexpr.TokenParams{C: 1},
		billingexpr.RequestInput{Body: []byte(body)},
	)
	if err != nil {
		t.Fatalf("RunExprWithRequest: %v", err)
	}
	if math.Abs(got-want) > 0.01 {
		t.Errorf("got %.6f want %.6f", got, want)
	}
}

// runSDApprox uses a looser tolerance (0.05) for the composed sd2 1080p+video
// case where multiplicative drift introduces ~0.04 error.
func runSDApprox(t *testing.T, exprStr, body string, want float64) {
	t.Helper()
	got, _, err := billingexpr.RunExprWithRequest(
		exprStr,
		billingexpr.TokenParams{C: 1},
		billingexpr.RequestInput{Body: []byte(body)},
	)
	if err != nil {
		t.Fatalf("RunExprWithRequest: %v", err)
	}
	if math.Abs(got-want) > 0.05 {
		t.Errorf("got %.6f want %.6f (tolerance 0.05)", got, want)
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-2-0
// 2 dimensions: resolution (std / 1080p) × content type (text / video)
// Prices: std+text=46, std+video=28, 1080p+text=51, 1080p+video≈31.04
// ---------------------------------------------------------------------------

func TestSeedance20Pricing(t *testing.T) {
	cases := []struct {
		name      string
		body      string
		approx    bool
		wantPrice float64
	}{
		// --- Volc native body ---
		{
			"native std+text (no resolution, no video)",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}]}`,
			false, 46,
		},
		{
			"native std+video",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"video_url","video_url":{"url":"x"}},{"type":"text","text":"hi"}]}`,
			false, 28,
		},
		{
			"native 1080p+text",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}],"resolution":"1080p"}`,
			false, 51,
		},
		{
			// 46 × 1.108696 × 0.608696 ≈ 31.04; accepted (~0.13% over display price 31)
			"native 1080p+video",
			`{"model":"doubao-seedance-2-0-260128","content":[{"type":"video_url","video_url":{"url":"x"}},{"type":"text","text":"hi"}],"resolution":"1080p"}`,
			true, 31,
		},
		// --- OpenAI-format wrapped body (fields under metadata.*) ---
		{
			"wrapped std+text",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{}}`,
			false, 46,
		},
		{
			"wrapped std+video",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}]}}`,
			false, 28,
		},
		{
			"wrapped 1080p+text",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"resolution":"1080p"}}`,
			false, 51,
		},
		{
			// 46 × 1.108696 × 0.608696 ≈ 31.04; accepted
			"wrapped 1080p+video",
			`{"model":"doubao-seedance-2-0-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}],"resolution":"1080p"}}`,
			true, 31,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if tt.approx {
				runSDApprox(t, seedance20Expr, tt.body, tt.wantPrice)
			} else {
				runSD(t, seedance20Expr, tt.body, tt.wantPrice)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// doubao-seedance-2-0-fast
// 1 dimension: content type (text / video)
// Prices: text=37, video≈22 (37 × 0.594595 = 22.000015)
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
			37,
		},
		{
			"native video",
			`{"model":"doubao-seedance-2-0-fast-260128","content":[{"type":"video_url","video_url":{"url":"x"}}]}`,
			22,
		},
		{
			"wrapped text",
			`{"model":"doubao-seedance-2-0-fast-260128","prompt":"hi","metadata":{}}`,
			37,
		},
		{
			"wrapped video",
			`{"model":"doubao-seedance-2-0-fast-260128","prompt":"hi","metadata":{"content":[{"type":"video_url","video_url":{"url":"x"}}]}}`,
			22,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance20FastExpr, tt.body, tt.wantPrice)
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
			16,
		},
		{
			"native silent (generate_audio=false)",
			`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}],"generate_audio":false}`,
			8,
		},
		{
			"native with-audio explicit (generate_audio=true)",
			`{"model":"doubao-seedance-1-5-pro-251215","content":[{"type":"text","text":"hi"}],"generate_audio":true}`,
			16,
		},
		{
			"wrapped with-audio (field absent)",
			`{"model":"doubao-seedance-1-5-pro-251215","prompt":"hi","metadata":{}}`,
			16,
		},
		{
			"wrapped silent (metadata.generate_audio=false)",
			`{"model":"doubao-seedance-1-5-pro-251215","prompt":"hi","metadata":{"generate_audio":false}}`,
			8,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance15ProExpr, tt.body, tt.wantPrice)
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
			15,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-pro-250528","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			7.5,
		},
		{
			"wrapped online (field absent)",
			`{"model":"doubao-seedance-1-0-pro-250528","prompt":"hi","metadata":{}}`,
			15,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-pro-250528","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			7.5,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10ProExpr, tt.body, tt.wantPrice)
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
			4.2,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-pro-fast","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			2.1,
		},
		{
			"wrapped online",
			`{"model":"doubao-seedance-1-0-pro-fast","prompt":"hi","metadata":{}}`,
			4.2,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-pro-fast","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			2.1,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10ProFastExpr, tt.body, tt.wantPrice)
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
			10,
		},
		{
			"native flex",
			`{"model":"doubao-seedance-1-0-lite","content":[{"type":"text","text":"hi"}],"service_tier":"flex"}`,
			5,
		},
		{
			"wrapped online",
			`{"model":"doubao-seedance-1-0-lite","prompt":"hi","metadata":{}}`,
			10,
		},
		{
			"wrapped flex",
			`{"model":"doubao-seedance-1-0-lite","prompt":"hi","metadata":{"service_tier":"flex"}}`,
			5,
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			runSD(t, seedance10LiteExpr, tt.body, tt.wantPrice)
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
