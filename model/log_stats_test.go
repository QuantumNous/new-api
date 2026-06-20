package model

import "testing"

func TestStatsTokenUsage(t *testing.T) {
	cases := []struct {
		name   string
		params RecordConsumeLogParams
		want   int
	}{
		{
			name: "openai prompt_tokens already includes cache read",
			// OpenAI reports cache-read inside prompt_tokens, so it must not be added again.
			params: RecordConsumeLogParams{
				PromptTokens:     1000,
				CompletionTokens: 200,
				Other:            map[string]interface{}{"cache_tokens": 800},
			},
			want: 1200,
		},
		{
			name: "anthropic cache tokens are separate and must be added",
			// Mirrors a real claude-opus-4-8 request: prompt_tokens=2, plus 28097
			// cache-read and 281100 cache-creation tokens reported separately.
			params: RecordConsumeLogParams{
				PromptTokens:     2,
				CompletionTokens: 535,
				Other: map[string]interface{}{
					"usage_semantic":        "anthropic",
					"cache_tokens":          28097,
					"cache_creation_tokens": 281100,
				},
			},
			want: 2 + 535 + 28097 + 281100,
		},
		{
			name: "anthropic without cache tokens",
			params: RecordConsumeLogParams{
				PromptTokens:     340,
				CompletionTokens: 125398,
				Other:            map[string]interface{}{"usage_semantic": "anthropic"},
			},
			want: 340 + 125398,
		},
		{
			name: "float64 values from decoded other payload",
			params: RecordConsumeLogParams{
				PromptTokens:     0,
				CompletionTokens: 10,
				Other: map[string]interface{}{
					"usage_semantic":        "anthropic",
					"cache_tokens":          float64(100),
					"cache_creation_tokens": float64(200),
				},
			},
			want: 310,
		},
		{
			name: "nil other payload",
			params: RecordConsumeLogParams{
				PromptTokens:     5,
				CompletionTokens: 7,
			},
			want: 12,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := statsTokenUsage(tc.params); got != tc.want {
				t.Fatalf("statsTokenUsage() = %d, want %d", got, tc.want)
			}
		})
	}
}
