package service

import (
	"math"
	"math/rand"
	"strings"
	"testing"
	"unicode"
)

// referenceEstimateToken 是【重构前】EstimateToken 的逐字符循环实现的精确副本
// （取自 merge 提交 4f099c54 的 service/token_estimator.go）。
// 它作为独立的参考实现，与重构后基于 streamingEstimator 的 EstimateToken 对拍，
// 用来证明：(1) 重构没有改变计费口径；(2) 测试不是自我循环验证
// （若把 streamingEstimator.feed 改坏，本对拍会失败，因为参考实现不走 feed）。
func referenceEstimateToken(provider Provider, text string) int {
	m := getMultipliers(provider)
	var count float64

	type WordType int
	const (
		None WordType = iota
		Latin
		Number
	)
	currentWordType := None

	for _, r := range text {
		if unicode.IsSpace(r) {
			currentWordType = None
			if r == '\n' || r == '\t' {
				count += m.Newline
			} else {
				count += m.Space
			}
			continue
		}
		if isCJK(r) {
			currentWordType = None
			count += m.CJK
			continue
		}
		if isEmoji(r) {
			currentWordType = None
			count += m.Emoji
			continue
		}
		if isLatinOrNumber(r) {
			isNum := unicode.IsNumber(r)
			newType := Latin
			if isNum {
				newType = Number
			}
			if currentWordType == None || currentWordType != newType {
				if newType == Number {
					count += m.Number
				} else {
					count += m.Word
				}
				currentWordType = newType
			}
			continue
		}
		currentWordType = None
		if isMathSymbol(r) {
			count += m.MathSymbol
		} else if r == '@' {
			count += m.AtSign
		} else if isURLDelim(r) {
			count += m.URLDelim
		} else {
			count += m.Symbol
		}
	}
	return int(math.Ceil(count)) + m.BasePad
}

// 重构后的 EstimateToken 必须与独立的参考实现逐位相同（证明计费口径不变）。
func TestEstimateToken_MatchesReferenceImpl(t *testing.T) {
	corpus := []string{
		"hello", "hello world", "abc 123", "中文测试混合 English",
		"a", "   ", "Hello, World!\nNew line.\ttab",
		"emoji 😀🎉 symbols ©® math ∑∫ url https://x.com/a?b=c user@host",
		"VeryLongWordNoSpace", "123 456 789", "Mixed123Letters456",
		strings.Repeat("word ", 100), strings.Repeat("中", 50), "",
	}
	for _, p := range []Provider{OpenAI, Gemini, Claude} {
		for _, text := range corpus {
			want := referenceEstimateToken(p, text)
			got := EstimateToken(p, text)
			if got != want {
				t.Errorf("provider=%s text=%q: refactored=%d reference=%d", p, text, got, want)
			}
		}
	}
}

// 随机大样本对拍：确保重构在任意输入上都等于参考实现。
func TestEstimateToken_FuzzMatchesReference(t *testing.T) {
	alphabet := []rune(" \n\tabcXYZ012中文😀{}()@∑/.,!?")
	r := rand.New(rand.NewSource(2026))
	for _, p := range []Provider{OpenAI, Gemini, Claude} {
		for trial := 0; trial < 1000; trial++ {
			n := r.Intn(300)
			var b strings.Builder
			for i := 0; i < n; i++ {
				b.WriteRune(alphabet[r.Intn(len(alphabet))])
			}
			text := b.String()
			want := referenceEstimateToken(p, text)
			got := EstimateToken(p, text)
			if got != want {
				t.Fatalf("provider=%s text=%q: refactored=%d reference=%d", p, text, got, want)
			}
		}
	}
}

// 绝对锚点：人工核算的已知值（不依赖任何被测实现，防止参考实现也被一起改坏）。
// OpenAI: Word=1.02 Space=0.42 Number=1.55 Newline=0.5；BasePad=0；结果=ceil(sum)。
func TestEstimateToken_HardcodedAnchors(t *testing.T) {
	cases := []struct {
		provider Provider
		text     string
		want     int
	}{
		{OpenAI, "hello", 2},             // 1 word: ceil(1.02)=2
		{OpenAI, "hello world", 3},       // 1.02+0.42+1.02=2.46 -> 3
		{OpenAI, "", 0},                  // 空
		{OpenAI, "a b", 3},               // 1.02+0.42+1.02=2.46 -> 3
	}
	for _, c := range cases {
		got := EstimateToken(c.provider, c.text)
		if got != c.want {
			t.Errorf("provider=%s text=%q: got=%d want=%d (hardcoded anchor)", c.provider, c.text, got, c.want)
		}
	}
}
