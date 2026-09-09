package billing_setting

// Built-in token prices use actual USD per million tokens. Keep new model
// defaults here instead of splitting them across the legacy ratio tables.
var builtinBillingExpr = map[string]string{
	// https://developers.openai.com/api/docs/models/gpt-6-astra
	// Standard pricing; the long-context rates apply to the whole request.
	// Do not infer service-tier discounts from incoming request parameters:
	// channels filter service_tier by default, so it may not reach the upstream.
	"gpt-6-astra": `len <= 272000 ? tier("standard", p * 10 + c * 50 + cr * 1 + cc * 12.5) : tier("long_context", p * 20 + c * 75 + cr * 2 + cc * 25)`,

	// https://ai.google.dev/gemini-api/docs/pricing#veo-3.1
	// Google Veo 3.1 Standard: 720p/1080p $0.40/s, 4k $0.60/s
	"veo-3.1-generate-001":     `u("resolution") == "4k" ? tier("4k", u("seconds") * 0.6) : tier("standard", u("seconds") * 0.4)`,
	"veo-3.1-generate-preview": `u("resolution") == "4k" ? tier("4k", u("seconds") * 0.6) : tier("standard", u("seconds") * 0.4)`,

	// Google Veo 3.1 Fast: 720p $0.10/s, 1080p $0.12/s, 4k $0.30/s
	"veo-3.1-fast-generate-001":     `u("resolution") == "4k" ? tier("4k", u("seconds") * 0.3) : u("resolution") == "1080p" ? tier("1080p", u("seconds") * 0.12) : tier("720p", u("seconds") * 0.1)`,
	"veo-3.1-fast-generate-preview": `u("resolution") == "4k" ? tier("4k", u("seconds") * 0.3) : u("resolution") == "1080p" ? tier("1080p", u("seconds") * 0.12) : tier("720p", u("seconds") * 0.1)`,

	// Google Veo 3.1 Lite: 720p $0.05/s, 1080p $0.08/s (4k output not supported)
	"veo-3.1-lite-generate-001":     `u("resolution") == "1080p" ? tier("1080p", u("seconds") * 0.08) : tier("720p", u("seconds") * 0.05)`,
	"veo-3.1-lite-generate-preview": `u("resolution") == "1080p" ? tier("1080p", u("seconds") * 0.08) : tier("720p", u("seconds") * 0.05)`,
}
