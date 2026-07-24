package service

import (
	"math"
	"strings"
	"unicode"
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

// 直接用常量 map，无需锁保护（只读）
var multipliersMap = map[Provider]multipliers{
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

// mathSymbolSet 用 map 做 O(1) 查找，替代每次线性扫描字符串
var mathSymbolSet = func() map[rune]struct{} {
	s := "∑∫∂√∞≤≥≠≈±×÷∈∉∋∌⊂⊃⊆⊇∪∩∧∨¬∀∃∄∅∆∇∝∟∠∡∢°′″‴⁺⁻⁼⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎²³¹⁴⁵⁶⁷⁸⁹⁰"
	m := make(map[rune]struct{}, 64)
	for _, r := range s {
		m[r] = struct{}{}
	}
	return m
}()

// urlDelimSet 用 [128]bool 做 ASCII 快速查找
var urlDelimSet = func() [128]bool {
	var t [128]bool
	for _, r := range "/:?&=;#%" {
		t[r] = true
	}
	return t
}()

// getMultipliers 根据厂商获取权重配置
func getMultipliers(p Provider) multipliers {
	if m, ok := multipliersMap[p]; ok {
		return m
	}
	// 默认兜底 (按 OpenAI 的算)
	return multipliersMap[OpenAI]
}

// EstimateToken 计算 Token 数量
func EstimateToken(provider Provider, text string) int {
	m := getMultipliers(provider)
	var count float64

	// 状态机变量
	const (
		stNone   = 0
		stLatin  = 1
		stNumber = 2
	)
	state := stNone

	for _, r := range text {
		// 快速路径：ASCII 字符 (覆盖绝大多数英文文本)
		if r < 128 {
			if r == ' ' {
				state = stNone
				count += m.Space
				continue
			}
			if r == '\n' || r == '\t' {
				state = stNone
				count += m.Newline
				continue
			}
			// a-z, A-Z
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
				if state != stLatin {
					count += m.Word
					state = stLatin
				}
				continue
			}
			// 0-9
			if r >= '0' && r <= '9' {
				if state != stNumber {
					count += m.Number
					state = stNumber
				}
				continue
			}
			// 其他 ASCII
			state = stNone
			if r == '@' {
				count += m.AtSign
			} else if urlDelimSet[r] {
				count += m.URLDelim
			} else if r == '\r' || r == '\f' || r == '\v' {
				count += m.Space
			} else {
				count += m.Symbol
			}
			continue
		}

		// 非 ASCII 路径

		// CJK (中日韩) - 按字符计费
		if isCJK(r) {
			state = stNone
			count += m.CJK
			continue
		}

		// Emoji
		if isEmoji(r) {
			state = stNone
			count += m.Emoji
			continue
		}

		// 非 ASCII 字母/数字 (如带重音的拉丁字母、西里尔字母等)
		if unicode.IsLetter(r) {
			if state != stLatin {
				count += m.Word
				state = stLatin
			}
			continue
		}
		if unicode.IsNumber(r) {
			if state != stNumber {
				count += m.Number
				state = stNumber
			}
			continue
		}

		// 空白字符 (非 ASCII 空白，如全角空格)
		if unicode.IsSpace(r) {
			state = stNone
			count += m.Space
			continue
		}

		// 标点符号/特殊字符
		state = stNone
		if isMathSymbol(r) {
			count += m.MathSymbol
		} else {
			count += m.Symbol
		}
	}

	// 向上取整并加上基础 padding
	return int(math.Ceil(count)) + m.BasePad
}

// isCJK 判断是否为CJK（中日韩）字符，基本区直接范围判断，扩展区回退到unicode.Han
func isCJK(r rune) bool {
	// CJK统一汉字基本区 (最常见，快速路径)
	if r >= 0x4E00 && r <= 0x9FFF {
		return true
	}
	// 日文平假名+片假名
	if r >= 0x3040 && r <= 0x30FF {
		return true
	}
	// 韩文音节
	if r >= 0xAC00 && r <= 0xD7A3 {
		return true
	}
	// CJK扩展区 (较少见，用 unicode.Han 兜底)
	return unicode.Is(unicode.Han, r)
}

// isEmoji 判断是否为Emoji字符，覆盖常见的Emoji Unicode区块
func isEmoji(r rune) bool {
	return (r >= 0x1F300 && r <= 0x1F9FF) ||
		(r >= 0x2600 && r <= 0x26FF) ||
		(r >= 0x2700 && r <= 0x27BF) ||
		(r >= 0x1F600 && r <= 0x1F64F) ||
		(r >= 0x1F900 && r <= 0x1F9FF) ||
		(r >= 0x1FA00 && r <= 0x1FAFF)
}

// isMathSymbol 判断是否为数学符号，优先检查Unicode数学区块，再查散列符号集合
func isMathSymbol(r rune) bool {
	// 范围检查优先（覆盖大部分数学符号区块）
	if r >= 0x2200 && r <= 0x22FF { // Mathematical Operators
		return true
	}
	if r >= 0x2A00 && r <= 0x2AFF { // Supplemental Mathematical Operators
		return true
	}
	if r >= 0x1D400 && r <= 0x1D7FF { // Mathematical Alphanumeric Symbols
		return true
	}
	// 散落的单个数学符号 (°, ±, ×, ÷, 上下标等)
	_, ok := mathSymbolSet[r]
	return ok
}

// EstimateTokenByModel 根据模型名称自动识别厂商并估算文本的token数量
func EstimateTokenByModel(model, text string) int {
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
