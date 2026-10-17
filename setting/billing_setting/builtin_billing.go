package billing_setting

// Built-in token prices use actual USD per million tokens. Keep new model
// defaults here instead of splitting them across the legacy ratio tables.
var builtinBillingExpr = map[string]string{
	// https://developers.openai.com/api/docs/pricing (Standard, 2026-09-09).
	// The Images API reports image output in output_tokens, normalized to c.
	"gpt-image-2":            `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	"gpt-image-2.5-sunburst": `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	"gpt-image-2.5-flare":    `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	// https://developers.openai.com/api/docs/models/gpt-6-astra
	// Standard pricing; the long-context rates apply to the whole request.
	// Do not infer service-tier discounts from incoming request parameters:
	// channels filter service_tier by default, so it may not reach the upstream.
	"gpt-6-astra": `len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25)`,
	// https://platform.xiaomimimo.com/docs/zh-CN/price/pay-as-you-go (2026-10-16).
	// Coefficients are the published USD rates; the domestic CNY list prices the
	// same models at an implied rate of roughly 7 CNY/USD, so the two lists do
	// not carry the same numbers. Output costs twice the input price on all
	// three models, and a cache hit costs 1/50 of input for flash and roughly
	// 1/121 for the two pro models.
	// The MiMo audio models are deliberately absent: the TTS series is free only
	// for a limited period, and ASR is published per hour of audio with no
	// documented token rate to turn that into a token price, so neither gets a
	// built-in expression. Until the administrator configures a price or ratio
	// for them, a request is rejected with the standard "model price not
	// configured" error rather than billed against an invented rate.
	"mimo-v2.6-flash":          `tier("standard", p * 0.14 + cr * 0.0028 + c * 0.28)`,
	"mimo-v2.6-pro":            `tier("standard", p * 0.435 + cr * 0.0036 + c * 0.87)`,
	"mimo-v2.6-pro-ultraspeed": `tier("standard", p * 4.35 + cr * 0.036 + c * 8.7)`,
}
