package tokenkit

import (
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"github.com/tiktoken-go/tokenizer"
	"github.com/tiktoken-go/tokenizer/codec"
)

var (
	o200kBase  = sync.OnceValue(func() tokenizer.Codec { return codec.NewO200kBase() })
	cl100kBase = sync.OnceValue(func() tokenizer.Codec { return codec.NewCl100kBase() })
)

// maxRunBytes bounds a run of letters, whitespace, or symbols passed to the
// encoder in one piece. BPE cost grows with the square of a pre-tokenized
// piece: 100,000 Chinese characters without punctuation take about 20 s in one
// piece. Cutting longer runs keeps counting linear; ordinary text has no such
// runs, and a cut changes the count only inside the run (under 0.5% for CJK).
const maxRunBytes = 1024

// Count returns the token count of text for model. GPT and o-series models
// are counted with their tiktoken encoding; other models use Estimate.
func Count(model, text string) int {
	if text == "" {
		return 0
	}
	model = strings.ToLower(model)
	if ModelFamily(model) != FamilyOpenAI {
		return Estimate(model, text)
	}
	encoder := o200kBase()
	if usesCl100k(model) {
		encoder = cl100kBase()
	}

	total, start := 0, 0
	runClass, runStart := runNone, 0
	for i, r := range text {
		class := runClassOf(r)
		if class != runClass {
			runClass, runStart = class, i
			continue
		}
		if class != runNumber && i-runStart >= maxRunBytes {
			n, _ := encoder.Count(text[start:i])
			total += n
			start, runStart = i, i
		}
	}
	n, _ := encoder.Count(text[start:])
	return total + n
}

type runClass int

const (
	runNone runClass = iota
	runLetter
	runNumber
	runSpace
	runSymbol
)

// runClassOf groups runes the way tiktoken's pre-tokenizer joins them into
// pieces. Digits are split into groups of three by the encoder itself.
func runClassOf(r rune) runClass {
	if r < utf8.RuneSelf {
		switch {
		case 'a' <= r && r <= 'z' || 'A' <= r && r <= 'Z':
			return runLetter
		case '0' <= r && r <= '9':
			return runNumber
		case r == ' ' || '\t' <= r && r <= '\r':
			return runSpace
		default:
			return runSymbol
		}
	}
	switch {
	case unicode.IsLetter(r) || unicode.IsMark(r):
		return runLetter
	case unicode.IsNumber(r):
		return runNumber
	case unicode.IsSpace(r):
		return runSpace
	default:
		return runSymbol
	}
}

// usesCl100k reports whether an OpenAI model predates o200k_base: GPT-4 (but
// not GPT-4o, GPT-4.1, or GPT-4.5) and GPT-3.5. Every later model, including
// GPT-5, GPT-6, and the o-series, uses o200k_base.
func usesCl100k(model string) bool {
	model = strings.TrimPrefix(model, "ft:")
	return model == "gpt-4" || strings.HasPrefix(model, "gpt-4-") ||
		strings.HasPrefix(model, "gpt-3.5") || strings.HasPrefix(model, "gpt-35")
}
