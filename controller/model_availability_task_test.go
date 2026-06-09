package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestClassifyModelProbeError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		apiErr     *types.NewAPIError
		wantClass  modelProbeClass
		wantReason string
	}{
		{
			name:       "official unsupported model",
			err:        errors.New("The 'gpt-5.3-codex' model is not supported when using Codex with a ChatGPT account."),
			wantClass:  modelProbeOfficialUnsupported,
			wantReason: "official_model_unsupported",
		},
		{
			name:       "temporary status",
			apiErr:     types.NewOpenAIError(errors.New("upstream overloaded"), types.ErrorCodeBadResponse, http.StatusServiceUnavailable),
			wantClass:  modelProbeTemporaryFailure,
			wantReason: "temporary_upstream_failure",
		},
		{
			name:       "account issue",
			err:        errors.New("invalid api key"),
			wantClass:  modelProbeUnknownFailure,
			wantReason: "channel_account_issue",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyModelProbeError(tt.err, tt.apiErr)
			require.Equal(t, tt.wantClass, got.Class)
			require.Equal(t, tt.wantReason, got.ReasonType)
		})
	}
}

func TestValidatePongTestResponseBody(t *testing.T) {
	require.NoError(t, validatePongTestResponseBody([]byte(`{"choices":[{"message":{"content":"pong"}}]}`)))
	require.NoError(t, validatePongTestResponseBody([]byte(`{"output_text":"PONG!"}`)))
	require.NoError(t, validatePongTestResponseBody([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"pong\"},\"message\":{\"content\":\"pong\"}}]}\n\n")))
	require.Error(t, validatePongTestResponseBody([]byte(`{"choices":[{"message":{"content":"hello"}}]}`)))
}
