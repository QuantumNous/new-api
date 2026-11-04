package service

import (
	"os"
	"regexp"
	"strings"
)

// hwModelBrand is the family a sold model name starts with: the brand word in
// its official spelling, how the brand joins a version that follows it
// directly ("GPT-6" against "Grok 4"), and the company that makes the family.
type hwModelBrand struct {
	prefix string
	word   string
	joiner string
	maker  string
}

// hwModelBrands covers every family of the catalog. A new model of a known
// family names itself without a code change; a model of a new family fails
// TestHwEverySoldModelHasAnIdentity until its brand is added here.
var hwModelBrands = []hwModelBrand{
	{prefix: "claude-", word: "Claude", joiner: " ", maker: "Anthropic"},
	{prefix: "gpt-", word: "GPT", joiner: "-", maker: "OpenAI"},
	{prefix: "grok-", word: "Grok", joiner: " ", maker: "xAI"},
	{prefix: "gemini-", word: "Gemini", joiner: " ", maker: "Google"},
}

var hwVersionSegment = regexp.MustCompile(`^[0-9]+(\.[0-9]+)*$`)

// HwModelIdentity returns the display name and the maker of a sold model name:
// claude-fable-5-1 is "Claude Fable 5.1" by Anthropic, gpt-6.1-sol is
// "GPT-6.1 Sol" by OpenAI. Consecutive number segments form one version
// (5-1 becomes 5.1). ok is false for a name of an unknown family.
func HwModelIdentity(name string) (display, maker string, ok bool) {
	for _, brand := range hwModelBrands {
		rest, found := strings.CutPrefix(name, brand.prefix)
		if !found || rest == "" {
			continue
		}
		var b strings.Builder
		b.WriteString(brand.word)
		previousNumber := false
		for index, segment := range strings.Split(rest, "-") {
			if segment == "" {
				return "", "", false
			}
			isNumber := hwVersionSegment.MatchString(segment)
			switch {
			case isNumber && previousNumber:
				b.WriteString(".")
			case isNumber && index == 0:
				b.WriteString(brand.joiner)
			default:
				b.WriteString(" ")
			}
			if isNumber {
				b.WriteString(segment)
			} else {
				b.WriteString(strings.ToUpper(segment[:1]) + segment[1:])
			}
			previousNumber = isNumber
		}
		return b.String(), brand.maker, true
	}
	return "", "", false
}

// HwModelIdentityLine is the short system line a request for a sold model
// starts with, so the model names its own sold name and maker instead of
// another model (on 4 Nov 2026 claude-fable-5-1 and claude-opus-5-5 answered
// "ChatGPT by OpenAI" through Lumia). It comes before the customer's own system
// prompt and never replaces it; a role the customer sets keeps its name.
// It is empty for a model we do not sell and for the gateway's own assistant
// and quality keys: the assistant speaks as HisarWeb's assistant and never
// names a model or a supplier.
func HwModelIdentityLine(modelName, tokenKey string) string {
	if !HwIsSoldModel(modelName) || hwIsOwnServiceKey(tokenKey) {
		return ""
	}
	display, maker, ok := HwModelIdentity(modelName)
	if !ok {
		return ""
	}
	return "You are " + display + ", a model made by " + maker + ", served by HisarWeb AI. If asked which model you are, say exactly that. Never claim to be another model."
}

// hwIsOwnServiceKey reports whether tokenKey is the key of the gateway's own
// assistant or quality meter.
func hwIsOwnServiceKey(tokenKey string) bool {
	tokenKey = strings.TrimPrefix(strings.TrimSpace(tokenKey), "sk-")
	if tokenKey == "" {
		return false
	}
	for _, env := range []string{HwAdminAgentAPIKeyEnv, HwQualityAPIKeyEnv} {
		if strings.TrimPrefix(strings.TrimSpace(os.Getenv(env)), "sk-") == tokenKey {
			return true
		}
	}
	return false
}
