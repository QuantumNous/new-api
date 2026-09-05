package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/require"
)

func TestBuildTestRequestUsesMaxCompletionTokensForGPT5Plus(t *testing.T) {
	tests := []struct {
		model                string
		wantMaxCompletion    bool
		wantMaxTokensPresent bool
	}{
		{model: "o3-mini", wantMaxCompletion: true},
		{model: "gpt-5.6-luna", wantMaxCompletion: true},
		{model: "gpt-6-astra", wantMaxCompletion: true},
		{model: "gpt-4.1-nano", wantMaxTokensPresent: true},
		{model: "gpt-4o", wantMaxTokensPresent: true},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			req, ok := buildTestRequest(tt.model, "", &model.Channel{}, false).(*dto.GeneralOpenAIRequest)
			require.True(t, ok)
			if tt.wantMaxCompletion {
				require.NotNil(t, req.MaxCompletionTokens)
				require.Equal(t, uint(16), *req.MaxCompletionTokens)
				require.Nil(t, req.MaxTokens)
			}
			if tt.wantMaxTokensPresent {
				require.NotNil(t, req.MaxTokens)
				require.Nil(t, req.MaxCompletionTokens)
			}
		})
	}
}
