package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestMapResponsesTerminalStatusToFinishReason(t *testing.T) {
	tests := []struct {
		name             string
		status           string
		incompleteReason string
		hasToolCalls     bool
		want             string
	}{
		{
			name:         "completed tool call",
			status:       "completed",
			hasToolCalls: true,
			want:         constant.FinishReasonToolCalls,
		},
		{
			name:             "incomplete max output tokens",
			status:           "incomplete",
			incompleteReason: "max_output_tokens",
			hasToolCalls:     true,
			want:             constant.FinishReasonLength,
		},
		{
			name:             "incomplete content filter",
			status:           "incomplete",
			incompleteReason: "content_filter",
			want:             constant.FinishReasonContentFilter,
		},
		{
			name:         "missing status falls back to tool calls",
			hasToolCalls: true,
			want:         constant.FinishReasonToolCalls,
		},
		{
			name:         "failed status does not fall back to tool calls",
			status:       "failed",
			hasToolCalls: true,
			want:         constant.FinishReasonStop,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MapResponsesTerminalStatusToFinishReason(tt.status, tt.incompleteReason, tt.hasToolCalls)
			if got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}
