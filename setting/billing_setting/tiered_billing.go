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
	BillingModeField      = "billing_mode"
	BillingExprField      = "billing_expr"
)

// defaultBillingMode and defaultBillingExpr seed the initial state on a fresh
// database. The DB-loaded values override these at startup. Adding a new model
// here ensures the system recognises it for billing on first install.
//
// Expressions use $/1M-token coefficients (see pkg/billingexpr/expr.md).
// Doubao Seedance video models — per-second output billing.
// https://www.volcengine.com/docs/82379/1543901
var defaultBillingMode = map[string]string{
	"doubao-seedance-1-0-lite-i2v-250428": BillingModeTieredExpr,
	"doubao-seedance-1-0-lite-t2v-250428": BillingModeTieredExpr,
	"doubao-seedance-1-0-pro-250528":      BillingModeTieredExpr,
	"doubao-seedance-1-0-pro-fast-251015": BillingModeTieredExpr,
	"doubao-seedance-1-5-pro-251215":      BillingModeTieredExpr,
	"doubao-seedance-2-0-260128":          BillingModeTieredExpr,
	"doubao-seedance-2-0-fast-260128":     BillingModeTieredExpr,
}

var defaultBillingExpr = map[string]string{
	// lite i2v/t2v: ¥0.10/秒 (c = output seconds); flex = 50% off
	"doubao-seedance-1-0-lite-i2v-250428": `(tier("在线推理", p * 0 + c * 10)) * (param("service_tier") == "flex" ? 0.5 : 1)`,
	"doubao-seedance-1-0-lite-t2v-250428": `(tier("在线推理", p * 0 + c * 10)) * (param("service_tier") == "flex" ? 0.5 : 1)`,
	// pro: ¥0.15/秒; flex = 50% off
	"doubao-seedance-1-0-pro-250528": `(tier("在线推理", p * 0 + c * 15)) * (param("service_tier") == "flex" ? 0.5 : 1)`,
	// pro-fast: ¥0.042/秒; flex = 50% off
	"doubao-seedance-1-0-pro-fast-251015": `(tier("在线推理", p * 0 + c * 4.2)) * (param("service_tier") == "flex" ? 0.5 : 1)`,
	// 1.5 pro: ¥0.08/秒 without audio; ×2 with audio
	"doubao-seedance-1-5-pro-251215": `(tier("无音频", p * 0 + c * 8)) * (param("generate_audio") == true ? 2 : 1)`,
	// 2.0: 480p/720p base; 1080p costs more; video-input costs less
	"doubao-seedance-2-0-260128": `(tier("480p/720p 无视频输入", c* 46 + p * 0)) * (param("resolution") == "1080p" ? 1.108696 : 1) * (param("content.#(type=='video_url')") != nil ? 0.608696 : 1)`,
	// 2.0 fast: ¥0.37/秒 (uses p not c); video-input costs less
	"doubao-seedance-2-0-fast-260128": `(tier("无视频输入", p * 37 + c * 0)) * (param("content.#(type=='video_url')") != nil ? 0.594595 : 1)`,
}


// BillingSetting is managed by config.GlobalConfig.Register.
// DB keys: billing_setting.billing_mode, billing_setting.billing_expr
type BillingSetting struct {
	BillingMode map[string]string `json:"billing_mode"`
	BillingExpr map[string]string `json:"billing_expr"`
}

var billingSetting = BillingSetting{
	BillingMode: make(map[string]string),
	BillingExpr: make(map[string]string),
}

func init() {
	config.GlobalConfig.Register("billing_setting", &billingSetting)
}

// ---------------------------------------------------------------------------
// Read accessors (hot path, must be fast)
// ---------------------------------------------------------------------------

func GetBillingMode(model string) string {
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

func GetPricingSyncData(base map[string]any) map[string]any {
	extra := make(map[string]any, 2)
	if modes := GetBillingModeCopy(); len(modes) > 0 {
		extra[BillingModeField] = modes
	}
	if exprs := GetBillingExprCopy(); len(exprs) > 0 {
		extra[BillingExprField] = exprs
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
