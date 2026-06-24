package service

import (
	"math"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
)

type streamingEstimateWordType int

const (
	streamingEstimateNone streamingEstimateWordType = iota
	streamingEstimateLatin
	streamingEstimateNumber
)

type StreamingEstimateByModel struct {
	m               multipliers
	count           float64
	currentWordType streamingEstimateWordType
	pending         []byte
	hasInput        bool
}

func NewStreamingEstimateByModel(model string) *StreamingEstimateByModel {
	model = strings.ToLower(model)
	provider := OpenAI
	if strings.Contains(model, "gemini") {
		provider = Gemini
	} else if strings.Contains(model, "claude") {
		provider = Claude
	}
	return &StreamingEstimateByModel{m: getMultipliers(provider)}
}

func (e *StreamingEstimateByModel) WriteString(text string) {
	if e == nil || text == "" {
		return
	}
	e.hasInput = true
	if len(e.pending) > 0 {
		for len(text) > 0 {
			e.pending = append(e.pending, text[0])
			text = text[1:]
			if utf8.FullRune(e.pending) {
				break
			}
		}
		if !utf8.FullRune(e.pending) {
			return
		}
		r, size := utf8.DecodeRune(e.pending)
		e.writeRune(r)
		if size < len(e.pending) {
			text = string(e.pending[size:]) + text
		}
		e.pending = e.pending[:0]
	}
	prefix, pending := splitTrailingIncompleteUTF8(text)
	for _, r := range prefix {
		e.writeRune(r)
	}
	if pending != "" {
		e.pending = append(e.pending, pending...)
	}
}

func (e *StreamingEstimateByModel) Tokens() int {
	if e == nil {
		return 0
	}
	snapshot := *e
	if len(snapshot.pending) > 0 {
		for _, r := range string(snapshot.pending) {
			snapshot.writeRune(r)
		}
	}
	if !snapshot.hasInput {
		return 0
	}
	return int(math.Ceil(snapshot.count)) + snapshot.m.BasePad
}

func StreamingEstimate2Usage(c *gin.Context, e *StreamingEstimateByModel, promptTokens int) *dto.Usage {
	common.SetContextKey(c, constant.ContextKeyLocalCountTokens, true)
	usage := &dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: e.Tokens(),
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	return usage
}

func (e *StreamingEstimateByModel) writeRune(r rune) {
	if unicode.IsSpace(r) {
		e.currentWordType = streamingEstimateNone
		if r == '\n' || r == '\t' {
			e.count += e.m.Newline
		} else {
			e.count += e.m.Space
		}
		return
	}

	if isCJK(r) {
		e.currentWordType = streamingEstimateNone
		e.count += e.m.CJK
		return
	}

	if isEmoji(r) {
		e.currentWordType = streamingEstimateNone
		e.count += e.m.Emoji
		return
	}

	if isLatinOrNumber(r) {
		newType := streamingEstimateLatin
		if unicode.IsNumber(r) {
			newType = streamingEstimateNumber
		}
		if e.currentWordType == streamingEstimateNone || e.currentWordType != newType {
			if newType == streamingEstimateNumber {
				e.count += e.m.Number
			} else {
				e.count += e.m.Word
			}
			e.currentWordType = newType
		}
		return
	}

	e.currentWordType = streamingEstimateNone
	if isMathSymbol(r) {
		e.count += e.m.MathSymbol
	} else if r == '@' {
		e.count += e.m.AtSign
	} else if isURLDelim(r) {
		e.count += e.m.URLDelim
	} else {
		e.count += e.m.Symbol
	}
}

func splitTrailingIncompleteUTF8(text string) (string, string) {
	if text == "" {
		return "", ""
	}
	start := len(text) - 1
	for start > 0 && isUTF8Continuation(text[start]) {
		start--
	}
	if start < len(text) && !utf8.FullRuneInString(text[start:]) {
		return text[:start], text[start:]
	}
	return text, ""
}

func isUTF8Continuation(b byte) bool {
	return b&0xc0 == 0x80
}
