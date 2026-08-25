package reasoning

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
)

func TestIntentFromChatRequestPriority(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		req  dto.GeneralOpenAIRequest
		want Intent
	}{
		{
			name: "reasoning_effort wins",
			req: dto.GeneralOpenAIRequest{
				ReasoningEffort: LevelLow,
				Reasoning:       json.RawMessage(`{"effort":"high"}`),
				EnableThinking:  json.RawMessage(`true`),
			},
			want: Intent{Level: LevelLow, Include: true},
		},
		{
			name: "reasoning_effort none disables",
			req:  dto.GeneralOpenAIRequest{ReasoningEffort: "none"},
			want: Intent{Disabled: true},
		},
		{
			name: "openrouter effort",
			req:  dto.GeneralOpenAIRequest{Reasoning: json.RawMessage(`{"effort":"xhigh"}`)},
			want: Intent{Level: LevelXHigh, Include: true},
		},
		{
			name: "openrouter enabled",
			req:  dto.GeneralOpenAIRequest{Reasoning: json.RawMessage(`{"enabled":true}`)},
			want: Intent{Include: true},
		},
		{
			name: "openrouter enabled false",
			req:  dto.GeneralOpenAIRequest{Reasoning: json.RawMessage(`{"enabled":false}`)},
			want: Intent{Disabled: true},
		},
		{
			name: "claude thinking object",
			req:  dto.GeneralOpenAIRequest{THINKING: json.RawMessage(`{"type":"enabled","budget_tokens":2048}`)},
			want: Intent{Include: true},
		},
		{
			name: "enable_thinking true",
			req:  dto.GeneralOpenAIRequest{EnableThinking: json.RawMessage(`true`)},
			want: Intent{Include: true},
		},
		{
			name: "think high",
			req:  dto.GeneralOpenAIRequest{Think: json.RawMessage(`"high"`)},
			want: Intent{Level: LevelHigh, Include: true},
		},
		{
			name: "empty",
			req:  dto.GeneralOpenAIRequest{},
			want: Intent{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := IntentFromChatRequest(tt.req)
			if got != tt.want {
				t.Fatalf("got %#v want %#v", got, tt.want)
			}
		})
	}
}
