package service

import (
	"encoding/json"
	"math"
	"testing"
	"unicode"
)

// 同一段内容，仅因客户端 JSON 编码方式不同（ensure_ascii 开关），
// 估算值不应出现数量级差异。
//
// 修复前：Python json.dumps 默认的 ensure_ascii=True 会把汉字写成 \uXXXX，
// 而逐字符扫描把 "\u4e2d" 算成 反斜杠+字母+数字+字母+数字+字母 ≈ 6.56，
// 远高于直接写 "中" 时的 CJK 权重 0.85，整体高估 5 倍以上。
func TestEstimateToken_UnicodeEscapeMatchesRawCJK(t *testing.T) {
	const raw = "这是一段用于测试的中文内容，包含标点符号和一些常见的表达方式。"

	escaped, err := json.Marshal(raw) // encoding/json 默认不转义 CJK
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	_ = escaped

	// 手工构造 ensure_ascii=True 的等价形式
	var asciiEscaped []byte
	for _, r := range raw {
		if r < 0x80 {
			asciiEscaped = append(asciiEscaped, byte(r))
			continue
		}
		asciiEscaped = append(asciiEscaped, []byte(`\u`)...)
		const hexdigits = "0123456789abcdef"
		asciiEscaped = append(asciiEscaped,
			hexdigits[(r>>12)&0xF], hexdigits[(r>>8)&0xF],
			hexdigits[(r>>4)&0xF], hexdigits[r&0xF])
	}

	for _, p := range []Provider{OpenAI, Claude, Gemini} {
		gotRaw := EstimateToken(p, raw)
		gotEsc := EstimateToken(p, string(asciiEscaped))
		ratio := float64(gotEsc) / float64(gotRaw)

		// 两种编码承载同样的语义内容，估算值应当接近。
		// 留 15% 容差以容纳取整与 ASCII 标点的差异。
		if ratio > 1.15 || ratio < 0.85 {
			t.Errorf("provider=%s: 直出 CJK=%d，\\uXXXX 转义=%d，比值=%.2f；"+
				"同一内容两种编码的估算差异过大", p, gotRaw, gotEsc, ratio)
		}
	}
}

// \uXXXX 解码后应按其真实字符类别计费：CJK 走 CJK 权重，ASCII 字母走 Word 权重。
func TestDecodeUnicodeEscape(t *testing.T) {
	cases := []struct {
		name  string
		in    string
		want  rune
		width int
		ok    bool
	}{
		{"CJK", `\u4e2d`, '中', 6, true},
		{"大写十六进制", `\u4E2D`, '中', 6, true},
		{"ASCII 字母", `\u0041`, 'A', 6, true},
		{"大写 U 前缀", `\U4e2d`, '中', 6, true},
		{"非十六进制", `\u4e2g`, 0, 0, false},
		{"长度不足", `\u4e2`, 0, 0, false},
		{"不是转义", `au4e2d`, 0, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, w, ok := decodeUnicodeEscape([]rune(c.in), 0)
			if ok != c.ok || (c.ok && (got != c.want || w != c.width)) {
				t.Errorf("decodeUnicodeEscape(%q) = (%q,%d,%v)，期望 (%q,%d,%v)",
					c.in, got, w, ok, c.want, c.width, c.ok)
			}
		})
	}
}

// 修复不应改变不含转义序列的普通文本的估算结果。
func TestEstimateToken_PlainTextUnchanged(t *testing.T) {
	cases := []string{
		"hello world",
		"这是中文内容",
		"mixed 中英文 123 content",
		"https://example.com/path?a=1&b=2",
		"user@example.com",
		"",
		`C:\path\to\file`,    // 反斜杠但不是转义
		`\unicode is a word`, // \u 后面不是十六进制
	}
	for _, s := range cases {
		before := estimateTokenLegacy(OpenAI, s)
		after := EstimateToken(OpenAI, s)
		if before != after {
			t.Errorf("普通文本估算被改变：%q 修复前=%d 修复后=%d", s, before, after)
		}
	}
}

// estimateTokenLegacy 是修复前的实现，仅用于证明改动只影响 \uXXXX 这一类输入。
func estimateTokenLegacy(provider Provider, text string) int {
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
