package billing_setting

import "github.com/QuantumNous/new-api/constant"

// deepSeekPeak is DeepSeek's peak window: Monday to Friday, 09:00-12:00 and
// 14:00-18:00 Beijing time. The Chinese public holidays DeepSeek bills
// off-peak are not known in advance and bill at peak here.
const deepSeekPeak = `weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))`

const deepSeekFlashExpr = deepSeekPeak + ` ? tier("peak", p * 0.3 + cr * 0.006 + c * 1.2) : tier("off_peak", p * 0.15 + cr * 0.003 + c * 0.6)`

// Built-in token prices use actual USD per million tokens. Keep new model
// defaults here instead of splitting them across the legacy ratio tables.
var builtinBillingExpr = map[string]string{
	// https://developers.openai.com/api/docs/pricing (Standard, 2026-09-09).
	// The Images API reports image output in output_tokens, normalized to c.
	"gpt-image-2":            `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	"gpt-image-2.5-sunburst": `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	"gpt-image-2.5-flare":    `tier("standard", p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30)`,
	// https://developers.openai.com/api/docs/models/gpt-6-astra
	// https://developers.openai.com/api/docs/pricing (Standard, 2026-10-22):
	// cc is the 30m cache write and cc12h the 12h write. The long-context
	// rates apply to the whole request.
	// Do not infer service-tier discounts from incoming request parameters:
	// channels filter service_tier by default, so it may not reach the upstream.
	"gpt-6-astra": `len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5 + cc12h * 25) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25 + cc12h * 50)`,
	// https://api-docs.deepseek.com/quick_start/pricing (2026-10-17). Off-peak
	// is half the peak price. deepseek-v4-flash and deepseek-v4-flash-vision-exp
	// run on V4.1 Flash and bill at the Flash price. Images bill as input
	// tokens, and there is no cache-write price.
	"deepseek-flash":               deepSeekFlashExpr,
	"deepseek-v4-flash":            deepSeekFlashExpr,
	"deepseek-v4-flash-vision-exp": deepSeekFlashExpr,
	"deepseek-v4-pro":              deepSeekPeak + ` ? tier("peak", p * 1.32 + cr * 0.044 + c * 3.96) : tier("off_peak", p * 0.66 + cr * 0.022 + c * 1.98)`,
	// The Search and Fetch API routing names: $0.75 per 1,000 successful
	// requests each, the same pricing page. The calls carry no tokens.
	constant.DeepSeekSearchModel: `tier("request", fixed(0.00075))`,
	constant.DeepSeekFetchModel:  `tier("request", fixed(0.00075))`,
	// https://docs.voyageai.com/docs/pricing (2026-11-13). Voyage bills text
	// tokens only, except the multimodal models, which also bill image and
	// video pixels at $0.60 per billion. The adaptor reports 560 pixels as one
	// image token, so img is $0.60 / 1e9 * 560 * 1e6 = $0.336 per million.
	"voyage-4-large":        `tier("base", p * 0.12)`,
	"voyage-4":              `tier("base", p * 0.06)`,
	"voyage-4-lite":         `tier("base", p * 0.02)`,
	"voyage-code-4":         `tier("base", p * 0.12)`,
	"voyage-3-large":        `tier("base", p * 0.18)`,
	"voyage-3.5":            `tier("base", p * 0.06)`,
	"voyage-3.5-lite":       `tier("base", p * 0.02)`,
	"voyage-code-3":         `tier("base", p * 0.18)`,
	"voyage-finance-2":      `tier("base", p * 0.12)`,
	"voyage-law-2":          `tier("base", p * 0.12)`,
	"voyage-context-4":      `tier("base", p * 0.12)`,
	"voyage-context-3":      `tier("base", p * 0.18)`,
	"voyage-multimodal-3.5": `tier("base", p * 0.12 + img * 0.336)`,
	"voyage-multimodal-3":   `tier("base", p * 0.12 + img * 0.336)`,
	"rerank-3":              `tier("base", p * 0.05)`,
	"rerank-3-lite":         `tier("base", p * 0.02)`,
	"rerank-2.5":            `tier("base", p * 0.05)`,
	"rerank-2.5-lite":       `tier("base", p * 0.02)`,
}
