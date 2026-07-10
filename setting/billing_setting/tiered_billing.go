package billing_setting

import (
	"fmt"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/samber/lo"
)

const (
	BillingModeRatio      = "ratio"
	BillingModeTieredExpr = "tiered_expr"
	// BillingModePerSecond marks task/video models billed per second (ModelPrice × duration).
	BillingModePerSecond = "per_second"
	BillingModeField              = "billing_mode"
	BillingExprField              = "billing_expr"
	UpstreamCostMultiplierField = "upstream_cost_multiplier"
	// VideoInputRatioField: discount when task request includes video reference (e.g. Seedance video_url).
	// Ratio = with-video price / without-video price; ModelRatio should be the higher no-video rate.
	VideoInputRatioField = "video_input_ratio"
)

// IsPerSecondModel reports whether the model uses per-second fixed pricing (not flat per-call).
func IsPerSecondModel(model string) bool {
	return GetBillingMode(model) == BillingModePerSecond
}

// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
type BillingSetting struct {
	BillingMode                map[string]string                 `json:"billing_mode"`
	BillingExpr                map[string]string                 `json:"billing_expr"`
	UpstreamCostMultiplier     map[string]float64                `json:"upstream_cost_multiplier"`
	VideoInputRatio            map[string]float64                `json:"video_input_ratio"`
	PerSecondResolutionPrice   map[string]PerSecondResolutionPrice `json:"per_second_resolution_price"`
}

var defaultVideoInputRatio = map[string]float64{
	"doubao-seedance-2-0-260128":      28.0 / 46.0,
	"doubao-seedance-2-0-fast-260128": 22.0 / 37.0,
}

var billingSetting = BillingSetting{
	BillingMode:              make(map[string]string),
	BillingExpr:              make(map[string]string),
	UpstreamCostMultiplier:   make(map[string]float64),
	VideoInputRatio:          lo.Assign(defaultVideoInputRatio),
	PerSecondResolutionPrice: make(map[string]PerSecondResolutionPrice),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func ensureBillingSettingMaps() {
	if billingSetting.BillingMode == nil {
		billingSetting.BillingMode = make(map[string]string)
	}
	if billingSetting.BillingExpr == nil {
		billingSetting.BillingExpr = make(map[string]string)
	}
	if billingSetting.UpstreamCostMultiplier == nil {
		billingSetting.UpstreamCostMultiplier = make(map[string]float64)
	}
	if billingSetting.VideoInputRatio == nil {
		billingSetting.VideoInputRatio = make(map[string]float64)
	}
	if billingSetting.PerSecondResolutionPrice == nil {
		billingSetting.PerSecondResolutionPrice = make(map[string]PerSecondResolutionPrice)
	}
}

func GetBillingMode(model string) string {
	ensureBillingSettingMaps()
	if mode, ok := billingSetting.BillingMode[model]; ok {
		return mode
	}
	return BillingModeRatio
}

func GetBillingExpr(model string) (string, bool) {
	expr, ok := billingSetting.BillingExpr[model]
	return expr, ok
}

func GetBillingModeCopy() map[string]string {
	return lo.Assign(billingSetting.BillingMode)
}

func GetBillingExprCopy() map[string]string {
	return lo.Assign(billingSetting.BillingExpr)
}

// GetUpstreamCostMultiplier returns the multiplier applied to upstream data.cost at task settle.
// Second return is false when unset; callers should treat that as 1.0.
func GetUpstreamCostMultiplier(model string) (float64, bool) {
	ensureBillingSettingMaps()
	if model == "" || billingSetting.UpstreamCostMultiplier == nil {
		return 1, false
	}
	m, ok := billingSetting.UpstreamCostMultiplier[model]
	if !ok || m <= 0 {
		return 1, false
	}
	return m, true
}

// ResolveUpstreamCostMultiplier returns multiplier for billing (default 1).
func ResolveUpstreamCostMultiplier(model string) float64 {
	m, ok := GetUpstreamCostMultiplier(model)
	if !ok {
		return 1
	}
	return m
}

func GetUpstreamCostMultiplierCopy() map[string]float64 {
	if billingSetting.UpstreamCostMultiplier == nil {
		return map[string]float64{}
	}
	return lo.Assign(billingSetting.UpstreamCostMultiplier)
}

// GetVideoInputRatio returns the multiplier applied when a video task request includes video reference input.
// Second return is false when unset.
func GetVideoInputRatio(model string) (float64, bool) {
	ensureBillingSettingMaps()
	if model == "" || billingSetting.VideoInputRatio == nil {
		return 1, false
	}
	r, ok := billingSetting.VideoInputRatio[model]
	if !ok || r <= 0 {
		return 1, false
	}
	return r, true
}

func GetVideoInputRatioCopy() map[string]float64 {
	if billingSetting.VideoInputRatio == nil {
		return map[string]float64{}
	}
	return lo.Assign(billingSetting.VideoInputRatio)
}

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 5)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
	}
	if mults := GetUpstreamCostMultiplierCopy(); len(mults) > 0 {
		extra[UpstreamCostMultiplierField] = mults
	}
	if ratios := GetVideoInputRatioCopy(); len(ratios) > 0 {
		extra[VideoInputRatioField] = ratios
	}
	if resPrices := GetPerSecondResolutionPriceCopy(); len(resPrices) > 0 {
		extra[PerSecondResolutionPriceField] = resPrices
	}
	return lo.Assign(base, extra)
}

// ---------------------------------------------------------------------------
// Smoke test (called externally for validation before save)
// ---------------------------------------------------------------------------

func SmokeTestExpr(exprStr string) error {
	return smokeTestExpr(exprStr)
}

func smokeTestExpr(exprStr string) error {
	vectors := []billingexpr.TokenParams{
		{P: 0, C: 0, Len: 0},
		{P: 1000, C: 1000, Len: 1000},
		{P: 100000, C: 100000, Len: 100000},
		{P: 1000000, C: 1000000, Len: 1000000},
	}
	requests := []billingexpr.RequestInput{
		{},
		{
			Headers: map[string]string{
				"anthropic-beta": "fast-mode-2026-02-01",
			},
			Body: []byte(`{"service_tier":"fast","stream_options":{"include_usage":true},"messages":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]}`),
		},
	}

	for _, v := range vectors {
		for _, request := range requests {
			result, _, err := billingexpr.RunExprWithRequest(exprStr, v, request)
			if err != nil {
				return fmt.Errorf("vector {p=%g, c=%g}: run failed: %w", v.P, v.C, err)
			}
			if result < 0 {
				return fmt.Errorf("vector {p=%g, c=%g}: result %f < 0", v.P, v.C, result)
			}
		}
	}
	return nil
}
