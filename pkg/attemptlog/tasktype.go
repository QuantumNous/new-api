package attemptlog

import (
	"strings"
)

// TaskTypeGuessVersion is bumped whenever the classification rules change, so
// training data tagged with an old version can be excluded or re-processed.
const TaskTypeGuessVersion = 1

// Task type labels. Stable strings — renaming invalidates collected data.
const (
	TaskTypeCode      = "code"
	TaskTypeMath      = "math"
	TaskTypeTranslate = "translate"
	TaskTypeSummary   = "summary"
	TaskTypeQA        = "qa"
	TaskTypeCreative  = "creative"
	TaskTypeChat      = "chat"
	TaskTypeUnknown   = "unknown"
)

// GuessTaskType applies simple keyword/pattern heuristics to the last user
// message text. It is a feature, not a target: the rules are deliberately
// explainable and cheap so they can be versioned and re-derived. An empty
// string returns "unknown".
func GuessTaskType(text string) string {
	if text == "" {
		return TaskTypeUnknown
	}
	text = strings.ToLower(text)

	if isCode(text) {
		return TaskTypeCode
	}
	if isMath(text) {
		return TaskTypeMath
	}
	if isTranslate(text) {
		return TaskTypeTranslate
	}
	if isSummary(text) {
		return TaskTypeSummary
	}
	if isCreative(text) {
		return TaskTypeCreative
	}
	if isQA(text) {
		return TaskTypeQA
	}
	return TaskTypeChat
}

func isCode(text string) bool {
	if strings.Contains(text, "```") {
		return true
	}
	needles := []string{
		"traceback", "error:", "exception", "panic:",
		"undefined is not", "null pointer", "segmentation fault",
		"stack overflow", "syntax error", "compile error",
		"function(", "def ", "class ", "import ", "package ",
		"public static", "private void", "return nil",
		"git commit", "npm install", "pip install", "docker build",
	}
	return containsAny(text, needles)
}

func isMath(text string) bool {
	if strings.Contains(text, "\\(") || strings.Contains(text, "\\[") || strings.Contains(text, "$$") {
		return true
	}
	mathOps := []rune{'∫', '∑', '∏', '√', '≠', '≤', '≥', '∞', '∂', '∇', '∀', '∃'}
	count := 0
	for _, r := range text {
		for _, op := range mathOps {
			if r == op {
				count++
				if count >= 2 {
					return true
				}
			}
		}
	}
	needles := []string{
		"证明", "calculate the", "derive the", "integral of",
		"differential equation", "theorem", "lemma", "corollary",
	}
	return containsAny(text, needles)
}

func isTranslate(text string) bool {
	needles := []string{
		"translate", "翻译", "口译", "interpret", "localize", "localise",
		"into english", "into chinese", "译成",
	}
	return containsAny(text, needles)
}

func isSummary(text string) bool {
	needles := []string{
		"summarize", "总结", "tl;dr", "tldr", "abstract",
		"key points", "概述", "摘要",
	}
	return containsAny(text, needles)
}

func isCreative(text string) bool {
	needles := []string{
		"write a story", "write a poem", "写一首诗", "写一篇",
		"compose", "creative writing", "essay about", "虚构",
		"小说", "剧本",
	}
	return containsAny(text, needles)
}

func isQA(text string) bool {
	needles := []string{
		"what is", "what are", "how to", "how do", "why is", "why does",
		"什么是", "怎么", "为什么", "如何", "explain",
		"difference between", "介绍一下",
	}
	if containsAny(text, needles) {
		return true
	}
	// Ends with a question mark.
	return strings.HasSuffix(strings.TrimSpace(text), "?") ||
		strings.HasSuffix(strings.TrimSpace(text), "？")
}
