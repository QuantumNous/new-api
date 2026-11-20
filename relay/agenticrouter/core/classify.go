// Package core —— 学习型路由核心的 Go 移植（与 js/src 参考实现逐行对拍）。
// 本包只依赖标准库，可在原生 Go 环境直接 `go test ./...`。
// 跨语言规范与参考实现：https://github.com/lhwwxy/agentic-router-gateway

package core

import (
	"math"
	"regexp"
	"strings"
)

var (
	qaImperative = regexp.MustCompile(`(请|麻烦|帮我).{0,6}(回答|告诉|说)`)
	codeRe       = regexp.MustCompile("def |function |class |import |require\\(|```|\\.py|\\.ts|\\.js|\\.go|\\.rs\\b|bug|error|exception|traceback|报错|代码|函数|接口|脚本")
	writeRe      = regexp.MustCompile(`(写|创作|起草|润色|翻译|translate|write|blog|article|文案|邮件|报告)`)
	summarizeRe  = regexp.MustCompile(`(总结|概括|summar|摘要|要点)`)
	researchRe   = regexp.MustCompile(`(查|搜索|检索|research|调研|对比|最新|资料|文档)`)
	agenticRe    = regexp.MustCompile(`(帮我|请|做|搭建|构建|部署|实现|写一个|生成|build|setup|deploy|implement|create)`)
	qaRe         = regexp.MustCompile(`[?？]|什么|为什么|怎么|如何|how|what|why|能否|是否`)
	complexRe    = regexp.MustCompile(`(重构|优化|设计|分析|架构|debug|调试|排查|review|方案|复杂|多步|逐步|implement|design|architecture)`)
	simpleRe     = regexp.MustCompile(`(一句|简单|快速|quickly|short|hello|你好|谢谢)`)

	fastRe   = regexp.MustCompile(`flash|lite|mini|small|fast|air|nano|tiny|light`)
	strongRe = regexp.MustCompile(`pro|max|ultra|plus|large|premium|reason|thinking`)
)

// 任务类型基础复杂度先验（实测调参）：代码与 agentic 任务天然更重
var prior = map[string]float64{
	"code": 0.3, "agentic": 0.3, "research": 0.2, "write": 0.15,
	"summarize": 0.05, "qa": 0, "other": 0,
}

var featureTypes = []string{"code", "write", "summarize", "research", "agentic", "qa"}

// Classification 是 classify 的返回值。
type Classification struct {
	Type       string  `json:"type"`
	Complexity float64 `json:"complexity"`
}

// Classify 任务类型 + 复杂度（确定性规则，<1ms）。
func Classify(text string) Classification {
	lower := strings.ToLower(text)
	typ := "other"
	switch {
	case qaImperative.MatchString(lower):
		typ = "qa"
	case codeRe.MatchString(lower):
		typ = "code"
	case writeRe.MatchString(lower):
		typ = "write"
	case summarizeRe.MatchString(lower):
		typ = "summarize"
	case researchRe.MatchString(lower):
		typ = "research"
	case agenticRe.MatchString(lower):
		typ = "agentic"
	case qaRe.MatchString(lower):
		typ = "qa"
	}

	complexKw := complexRe.MatchString(lower)
	simpleKw := simpleRe.MatchString(lower)
	score := prior[typ]
	score += math.Min(float64(len([]rune(text)))/2000, 1) * 0.2
	if strings.Contains(text, "```") {
		score += 0.25
	}
	if complexKw {
		score += 0.25
	}
	// 同时出现"简单"与"复杂"关键词时不做简单惩罚（实测踩过的坑）
	if simpleKw && !complexKw {
		score -= 0.25
	}
	score = math.Max(0, math.Min(1, score))
	return Classification{Type: typ, Complexity: Round2(score)}
}

// Round2 复刻 JS 的 Math.round(x*100)/100（向 +∞ 四舍五入，而非 Go 的银行家舍入）。
func Round2(x float64) float64 {
	return math.Floor(x*100+0.5) / 100
}

// FeaturesOf LinUCB / k-NN 共享的特征向量：[1, 复杂度, 长度归一, 类型 one-hot ×6]。
// 长度按 rune 计（与 JS 的 UTF-16 code unit 在中文/ASCII 场景一致）。
func FeaturesOf(cls Classification, text string) []float64 {
	n := len([]rune(text))
	if n > 4000 {
		n = 4000
	}
	f := []float64{1, cls.Complexity, float64(n) / 4000}
	for _, ty := range featureTypes {
		if cls.Type == ty {
			f = append(f, 1)
		} else {
			f = append(f, 0)
		}
	}
	return f
}

// TierOf 按模型名识别档位（fast/mid/strong/unknown）。
func TierOf(model string) string {
	if model == "" {
		return "unknown"
	}
	if fastRe.MatchString(model) {
		return "fast"
	}
	if strongRe.MatchString(model) {
		return "strong"
	}
	return "mid"
}
