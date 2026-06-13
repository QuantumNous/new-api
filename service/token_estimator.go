package service

import (
	"math"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"
)

// Provider 定义模型厂商大类
type Provider string

const (
	OpenAI  Provider = "openai"  // 代表 GPT-3.5, GPT-4, GPT-4o
	Gemini  Provider = "gemini"  // 代表 Gemini 1.0, 1.5 Pro/Flash
	Claude  Provider = "claude"  // 代表 Claude 3, 3.5 Sonnet
	Unknown Provider = "unknown" // 兜底默认
)

// multipliers 定义不同厂商的计费权重
type multipliers struct {
	Word       float64 // 英文单词 (每词)
	Number     float64 // 数字 (每连续数字串)
	CJK        float64 // 中日韩字符 (每字)
	Symbol     float64 // 普通标点符号 (每个)
	MathSymbol float64 // 数学符号 (∑,∫,∂,√等，每个)
	URLDelim   float64 // URL分隔符 (/,:,?,&,=,#,%) - tokenizer优化好
	AtSign     float64 // @符号 - 导致单词切分，消耗较高
	Emoji      float64 // Emoji表情 (每个)
	Newline    float64 // 换行符/制表符 (每个)
	Space      float64 // 空格 (每个)
	BasePad    int     // 基础起步消耗 (Start/End tokens)
}

var (
	multipliersMap = map[Provider]multipliers{
		Gemini: {
			Word: 1.15, Number: 2.8, CJK: 0.68, Symbol: 0.38, MathSymbol: 1.05, URLDelim: 1.2, AtSign: 2.5, Emoji: 1.08, Newline: 1.15, Space: 0.2, BasePad: 0,
		},
		Claude: {
			Word: 1.13, Number: 1.63, CJK: 1.21, Symbol: 0.4, MathSymbol: 4.52, URLDelim: 1.26, AtSign: 2.82, Emoji: 2.6, Newline: 0.89, Space: 0.39, BasePad: 0,
		},
		OpenAI: {
			Word: 1.02, Number: 1.55, CJK: 0.85, Symbol: 0.4, MathSymbol: 2.68, URLDelim: 1.0, AtSign: 2.0, Emoji: 2.12, Newline: 0.5, Space: 0.42, BasePad: 0,
		},
	}
	multipliersLock sync.RWMutex
)

// getMultipliers 根据厂商获取权重配置
func getMultipliers(p Provider) multipliers {
	multipliersLock.RLock()
	defer multipliersLock.RUnlock()

	switch p {
	case Gemini:
		return multipliersMap[Gemini]
	case Claude:
		return multipliersMap[Claude]
	case OpenAI:
		return multipliersMap[OpenAI]
	default:
		// 默认兜底 (按 OpenAI 的算)
		return multipliersMap[OpenAI]
	}
}

// EstimateToken 计算 Token 数量
// wordType 是估算状态机里"当前是否处于一个连续单词/数字中"的状态。
type wordType int

const (
	wordNone wordType = iota
	wordLatin
	wordNumber
)

// streamingEstimator 是 EstimateToken 的流式版本：逐 rune 喂入，维护与
// EstimateToken 完全相同的状态机（count + currentWordType）。对任意切分方式，
// 分块喂入的结果与一次性整体估算【逐位相同】（BasePad 仅在 result 时加一次，
// 当前三个 provider 的 BasePad 均为 0）。内存为 O(1)（只有 count/状态/最多
// 数字节的不完整 UTF-8 rune 缓冲），用于替代"用 strings.Builder 累积整个
// 响应文本再 EstimateToken"的旧模式。
type streamingEstimator struct {
	m               multipliers
	count           float64
	currentWordType wordType
	pending         []byte // 缓冲跨 chunk 边界被切断的不完整 UTF-8 rune
}

func newStreamingEstimator(provider Provider) *streamingEstimator {
	return &streamingEstimator{m: getMultipliers(provider)}
}

// feed 喂入一段文本（可以是任意 chunk，包括把一个多字节 rune 切成两半）。
func (e *streamingEstimator) feed(s string) {
	if s == "" {
		return
	}
	var b []byte
	if len(e.pending) > 0 {
		b = append(e.pending, s...)
		e.pending = nil
	} else {
		b = []byte(s)
	}
	for i := 0; i < len(b); {
		if !utf8.FullRune(b[i:]) {
			// 不完整的 UTF-8 rune 被切在 chunk 末尾，缓冲等待下次
			e.pending = append(e.pending[:0], b[i:]...)
			return
		}
		r, size := utf8.DecodeRune(b[i:])
		e.estimateRune(r)
		i += size
	}
}

// estimateRune 是从 EstimateToken 抽出的【单 rune】计费逻辑，二者共用，保证一致。
func (e *streamingEstimator) estimateRune(r rune) {
	m := e.m
	// 1. 空格/换行
	if unicode.IsSpace(r) {
		e.currentWordType = wordNone
		if r == '\n' || r == '\t' {
			e.count += m.Newline
		} else {
			e.count += m.Space
		}
		return
	}
	// 2. CJK
	if isCJK(r) {
		e.currentWordType = wordNone
		e.count += m.CJK
		return
	}
	// 3. Emoji
	if isEmoji(r) {
		e.currentWordType = wordNone
		e.count += m.Emoji
		return
	}
	// 4. 拉丁字母/数字（连续单词）
	if isLatinOrNumber(r) {
		newType := wordLatin
		if unicode.IsNumber(r) {
			newType = wordNumber
		}
		if e.currentWordType == wordNone || e.currentWordType != newType {
			if newType == wordNumber {
				e.count += m.Number
			} else {
				e.count += m.Word
			}
			e.currentWordType = newType
		}
		return
	}
	// 5. 标点/特殊字符
	e.currentWordType = wordNone
	if isMathSymbol(r) {
		e.count += m.MathSymbol
	} else if r == '@' {
		e.count += m.AtSign
	} else if isURLDelim(r) {
		e.count += m.URLDelim
	} else {
		e.count += m.Symbol
	}
}

// result 返回当前累计的 token 估算（向上取整 + BasePad）。
// 若仍有缓冲的不完整 UTF-8 尾字节（流在补齐前结束），按与一次性
// EstimateToken（for range over string）一致的语义处理：每个残留字节
// 解码为 utf8.RuneError，逐字节计入，保证流式与一次性结果逐位相同。
func (e *streamingEstimator) result() int {
	if len(e.pending) > 0 {
		for range e.pending {
			e.estimateRune(utf8.RuneError)
		}
		e.pending = nil
	}
	return int(math.Ceil(e.count)) + e.m.BasePad
}

func EstimateToken(provider Provider, text string) int {
	if text == "" {
		return 0
	}
	e := newStreamingEstimator(provider)
	e.feed(text)
	return e.result()
}

// 辅助：判断是否为 CJK 字符
func isCJK(r rune) bool {
	return unicode.Is(unicode.Han, r) ||
		(r >= 0x3040 && r <= 0x30FF) || // 日文
		(r >= 0xAC00 && r <= 0xD7A3) // 韩文
}

// 辅助：判断是否为单词主体 (字母或数字)
func isLatinOrNumber(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsNumber(r)
}

// 辅助：判断是否为Emoji字符
func isEmoji(r rune) bool {
	// Emoji的Unicode范围
	// 基本范围：0x1F300-0x1F9FF (Emoticons, Symbols, Pictographs)
	// 补充范围：0x2600-0x26FF (Misc Symbols), 0x2700-0x27BF (Dingbats)
	// 表情符号：0x1F600-0x1F64F (Emoticons)
	// 其他：0x1F900-0x1F9FF (Supplemental Symbols and Pictographs)
	return (r >= 0x1F300 && r <= 0x1F9FF) ||
		(r >= 0x2600 && r <= 0x26FF) ||
		(r >= 0x2700 && r <= 0x27BF) ||
		(r >= 0x1F600 && r <= 0x1F64F) ||
		(r >= 0x1F900 && r <= 0x1F9FF) ||
		(r >= 0x1FA00 && r <= 0x1FAFF) // Symbols and Pictographs Extended-A
}

// 辅助：判断是否为数学符号
func isMathSymbol(r rune) bool {
	// 数学运算符和符号
	// 基本数学符号：∑ ∫ ∂ √ ∞ ≤ ≥ ≠ ≈ ± × ÷
	// 上下标数字：² ³ ¹ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁰
	// 希腊字母等也常用于数学
	mathSymbols := "∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝∟∠∡∢°′″‴⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎²³¹⁴⁵⁶⁷⁸⁹⁰"
	for _, m := range mathSymbols {
		if r == m {
			return true
		}
	}
	// Mathematical Operators (U+2200–U+22FF)
	if r >= 0x2200 && r <= 0x22FF {
		return true
	}
	// Supplemental Mathematical Operators (U+2A00–U+2AFF)
	if r >= 0x2A00 && r <= 0x2AFF {
		return true
	}
	// Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF)
	if r >= 0x1D400 && r <= 0x1D7FF {
		return true
	}
	return false
}

// 辅助：判断是否为URL分隔符（tokenizer对这些优化较好）
func isURLDelim(r rune) bool {
	// URL中常见的分隔符，tokenizer通常优化处理
	urlDelims := "/:?&=;#%"
	for _, d := range urlDelims {
		if r == d {
			return true
		}
	}
	return false
}

func EstimateTokenByModel(model, text string) int {
	// strings.Contains(model, "gpt-4o")
	if text == "" {
		return 0
	}

	model = strings.ToLower(model)
	if strings.Contains(model, "gemini") {
		return EstimateToken(Gemini, text)
	} else if strings.Contains(model, "claude") {
		return EstimateToken(Claude, text)
	} else {
		return EstimateToken(OpenAI, text)
	}
}
