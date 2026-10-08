// Package tokenkit estimates LLM token counts for text and images without
// calling an upstream API.
//
// Text is counted exactly with tiktoken for OpenAI GPT and o-series models and
// estimated with per-tokenizer weights for Claude, Gemini, and other models.
// Image costs follow each provider's published sizing rules. The weights were
// calibrated against upstream usage on real agent traffic (Claude Code and
// Codex sessions).
package tokenkit

import (
	"math"
	"strconv"
	"strings"
	"unicode"
)

// Family is a tokenizer family. Models in one family tokenize text alike.
type Family string

const (
	FamilyOpenAI   Family = "openai"    // GPT and o-series models
	FamilyClaude   Family = "claude"    // Claude models before Claude Opus 4.7
	FamilyClaude47 Family = "claude4.7" // Claude Opus 4.7 and later, including Claude 5, Fable, and Mythos
	FamilyGemini   Family = "gemini"    // Gemini models
	FamilyUnknown  Family = "unknown"   // everything else
)

// ModelFamily classifies a model name, case-insensitively. Vendor prefixes and
// date suffixes are allowed (for example us.anthropic.claude-opus-4-7-v1:0).
func ModelFamily(model string) Family {
	model = strings.ToLower(model)
	switch {
	case strings.Contains(model, "gemini"):
		return FamilyGemini
	case strings.Contains(model, "claude"):
		if claudeUsesOpus47Tokenizer(model) {
			return FamilyClaude47
		}
		return FamilyClaude
	case isOpenAITextModel(model):
		return FamilyOpenAI
	default:
		return FamilyUnknown
	}
}

func isOpenAITextModel(model string) bool {
	for _, marker := range []string{"gpt-", "o1", "o3", "o4", "chatgpt"} {
		if strings.Contains(model, marker) {
			return true
		}
	}
	return false
}

// claudeUsesOpus47Tokenizer reports whether a lower-cased Claude model name uses
// the tokenizer and high-resolution image tier introduced with Claude Opus 4.7.
// Claude 4.7 and later use them; names without a version are treated as new.
func claudeUsesOpus47Tokenizer(model string) bool {
	major, minor, ok := modelVersion(model, "claude-")
	if !ok {
		return true
	}
	return major > 4 || (major == 4 && minor >= 7)
}

// modelVersion reads the first one- or two-digit version numbers after prefix,
// skipping family names (claude-opus-4-7, claude-3-5-sonnet, gemini-3.7-flash).
// A date such as 20250929 ends the version. ok is false when no version is found.
func modelVersion(model, prefix string) (major, minor int, ok bool) {
	_, name, found := strings.Cut(model, prefix)
	if !found {
		return 0, 0, false
	}
	version := make([]int, 0, 2)
	for part := range strings.FieldsFuncSeq(name, func(r rune) bool { return r == '-' || r == '.' }) {
		digits := len(part) - len(strings.TrimLeft(part, "0123456789"))
		if digits == 0 || digits > 2 {
			if len(version) > 0 {
				break
			}
			continue
		}
		n, _ := strconv.Atoi(part[:digits])
		version = append(version, n)
		if len(version) == 2 || digits < len(part) {
			break
		}
	}
	switch len(version) {
	case 0:
		return 0, 0, false
	case 1:
		return version[0], 0, true
	default:
		return version[0], version[1], true
	}
}

// weights are the estimated tokens per text feature.
type weights struct {
	Word       float64 // Latin word (each run of letters)
	Number     float64 // each run of digits
	CJK        float64 // each Chinese, Japanese, or Korean character
	Symbol     float64 // each ordinary punctuation mark
	MathSymbol float64 // each math symbol (∑, ∫, ∂, √, ...)
	URLDelim   float64 // each URL delimiter (/ : ? & = ; # %)
	AtSign     float64 // each @, which splits words
	Emoji      float64 // each emoji
	Newline    float64 // each newline or tab
	Space      float64 // each other whitespace character
}

// Word, Number, CJK, Symbol, URLDelim, Newline, and Space are calibrated
// against upstream counts on agent traffic. MathSymbol, AtSign, and Emoji make
// up under 0.3% of that traffic and keep their earlier values. FamilyUnknown
// keeps the earlier OpenAI weights; no other vendor was calibrated.
var familyWeights = map[Family]weights{
	FamilyGemini: {
		Word: 0.89, Number: 2.42, CJK: 0.93, Symbol: 0.65, MathSymbol: 1.05, URLDelim: 1.3, AtSign: 2.5, Emoji: 1.08, Newline: 1.28, Space: 0,
	},
	FamilyClaude: {
		Word: 1.24, Number: 1.53, CJK: 1.38, Symbol: 0.66, MathSymbol: 4.52, URLDelim: 0.74, AtSign: 2.82, Emoji: 2.6, Newline: 1.19, Space: 0.14,
	},
	FamilyClaude47: {
		Word: 1.52, Number: 1.77, CJK: 1.4, Symbol: 0.89, MathSymbol: 4.52, URLDelim: 1.45, AtSign: 2.82, Emoji: 2.6, Newline: 1.38, Space: 0.21,
	},
	FamilyOpenAI: {
		Word: 0.75, Number: 1.86, CJK: 0.96, Symbol: 0.6, MathSymbol: 2.68, URLDelim: 0.77, AtSign: 2.0, Emoji: 2.12, Newline: 0.95, Space: 0.17,
	},
	FamilyUnknown: {
		Word: 1.02, Number: 1.55, CJK: 0.85, Symbol: 0.4, MathSymbol: 2.68, URLDelim: 1.0, AtSign: 2.0, Emoji: 2.12, Newline: 0.5, Space: 0.42,
	},
}

// Estimate returns the estimated token count of text for model, using the
// weights of the model's family. It never runs a tokenizer; use Count for an
// exact count where one is available.
func Estimate(model, text string) int {
	if text == "" {
		return 0
	}
	return EstimateFamily(ModelFamily(model), text)
}

// EstimateFamily returns the estimated token count of text for a tokenizer
// family. Unrecognized families use the FamilyUnknown weights.
func EstimateFamily(family Family, text string) int {
	w, ok := familyWeights[family]
	if !ok {
		w = familyWeights[FamilyUnknown]
	}
	var count float64

	type wordType int
	const (
		none wordType = iota
		latin
		number
	)
	current := none

	for _, r := range text {
		if unicode.IsSpace(r) {
			current = none
			if r == '\n' || r == '\t' {
				count += w.Newline
			} else {
				count += w.Space
			}
			continue
		}

		if isCJK(r) {
			current = none
			count += w.CJK
			continue
		}

		if isEmoji(r) {
			current = none
			count += w.Emoji
			continue
		}

		// A run of letters or digits counts once; switching between letters
		// and digits starts a new run.
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			next := latin
			if unicode.IsNumber(r) {
				next = number
			}
			if current != next {
				if next == number {
					count += w.Number
				} else {
					count += w.Word
				}
				current = next
			}
			continue
		}

		current = none
		switch {
		case isMathSymbol(r):
			count += w.MathSymbol
		case r == '@':
			count += w.AtSign
		case isURLDelim(r):
			count += w.URLDelim
		default:
			count += w.Symbol
		}
	}

	return int(math.Ceil(count))
}

func isCJK(r rune) bool {
	return unicode.Is(unicode.Han, r) ||
		(r >= 0x3040 && r <= 0x30FF) || // Japanese kana
		(r >= 0xAC00 && r <= 0xD7A3) // Korean Hangul syllables
}

func isEmoji(r rune) bool {
	return (r >= 0x1F300 && r <= 0x1F9FF) || // pictographs, emoticons, supplemental symbols
		(r >= 0x2600 && r <= 0x26FF) || // miscellaneous symbols
		(r >= 0x2700 && r <= 0x27BF) || // dingbats
		(r >= 0x1FA00 && r <= 0x1FAFF) // symbols and pictographs extended-A
}

func isMathSymbol(r rune) bool {
	if strings.ContainsRune("∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝∟∠∡∢°′″‴⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎²³¹⁴⁵⁶⁷⁸⁹⁰", r) {
		return true
	}
	return (r >= 0x2200 && r <= 0x22FF) || // mathematical operators
		(r >= 0x2A00 && r <= 0x2AFF) || // supplemental mathematical operators
		(r >= 0x1D400 && r <= 0x1D7FF) // mathematical alphanumeric symbols
}

func isURLDelim(r rune) bool {
	return strings.ContainsRune("/:?&=;#%", r)
}
