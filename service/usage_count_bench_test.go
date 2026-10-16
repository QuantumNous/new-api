package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

var usageCountBenchSink int

func init() {
	InitTokenEncoders()
	gin.SetMode(gin.TestMode)
}

func benchmarkText(repeat int) string {
	parts := []string{
		"Deterministic accounting validation compares prompt tokens, completion tokens, quota, stream status, and request identifiers.",
		"中文内容用于覆盖 CJK 计数路径，避免只测英文 ASCII 文本。",
		"Numbers 1234567890, URLs https://example.com/a?b=c&d=e, symbols ∑∫√∞, and emoji ✅ are included.",
	}
	return strings.Repeat(strings.Join(parts, "\n"), repeat)
}

func BenchmarkEstimateTokenByModel(b *testing.B) {
	cases := []struct {
		name   string
		model  string
		repeat int
	}{
		{name: "openai_small", model: "gpt-5.5", repeat: 1},
		{name: "openai_large", model: "gpt-5.5", repeat: 400},
		{name: "claude_small", model: "claude-sonnet-4", repeat: 1},
		{name: "claude_large", model: "claude-sonnet-4", repeat: 400},
	}

	for _, tc := range cases {
		text := benchmarkText(tc.repeat)
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				usageCountBenchSink = EstimateTokenByModel(tc.model, text)
			}
		})
	}
}

func BenchmarkCountTextToken(b *testing.B) {
	cases := []struct {
		name   string
		model  string
		repeat int
	}{
		{name: "openai_small", model: "gpt-5.5", repeat: 1},
		{name: "openai_large", model: "gpt-5.5", repeat: 400},
		{name: "claude_small", model: "claude-sonnet-4", repeat: 1},
		{name: "claude_large", model: "claude-sonnet-4", repeat: 400},
	}

	for _, tc := range cases {
		text := benchmarkText(tc.repeat)
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				usageCountBenchSink = CountTextToken(text, tc.model)
			}
		})
	}
}

func BenchmarkResponseText2Usage(b *testing.B) {
	cases := []struct {
		name   string
		model  string
		repeat int
	}{
		{name: "openai_small", model: "gpt-5.5", repeat: 1},
		{name: "openai_large", model: "gpt-5.5", repeat: 400},
		{name: "claude_small", model: "claude-sonnet-4", repeat: 1},
		{name: "claude_large", model: "claude-sonnet-4", repeat: 400},
	}

	for _, tc := range cases {
		text := benchmarkText(tc.repeat)
		b.Run(tc.name, func(b *testing.B) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				usage := ResponseText2Usage(c, text, tc.model, 123)
				usageCountBenchSink = usage.TotalTokens
			}
		})
	}
}

func BenchmarkChatViaResponsesFallbackUsage(b *testing.B) {
	chunks := []string{
		"Reasoning summary 123",
		"\n\nsecond paragraph",
		" Visible output 中文",
		`lookup{"city":"Beijing"}`,
		" with https://example.com/a?b=c&d=e and symbols ∑∫√∞ ✅",
	}
	largeChunks := make([]string, 0, len(chunks)*400)
	for i := 0; i < 400; i++ {
		largeChunks = append(largeChunks, chunks...)
	}

	cases := []struct {
		name   string
		model  string
		chunks []string
	}{
		{name: "old_builder_openai_large", model: "gpt-5.5", chunks: largeChunks},
		{name: "new_streaming_openai_large", model: "gpt-5.5", chunks: largeChunks},
		{name: "old_builder_claude_large", model: "claude-sonnet-4", chunks: largeChunks},
		{name: "new_streaming_claude_large", model: "claude-sonnet-4", chunks: largeChunks},
	}

	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			b.ReportAllocs()
			for i := 0; i < b.N; i++ {
				if strings.HasPrefix(tc.name, "old_builder") {
					var usageText strings.Builder
					for _, chunk := range tc.chunks {
						usageText.WriteString(chunk)
					}
					usage := ResponseText2Usage(c, usageText.String(), tc.model, 123)
					usageCountBenchSink = usage.TotalTokens
					continue
				}

				estimator := NewStreamingEstimateByModel(tc.model)
				for _, chunk := range tc.chunks {
					estimator.WriteString(chunk)
				}
				usage := StreamingEstimate2Usage(c, estimator, 123)
				usageCountBenchSink = usage.TotalTokens
			}
		})
	}
}
