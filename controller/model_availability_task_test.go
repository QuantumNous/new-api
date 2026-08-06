package controller

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"
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
	// Tolerant contract: a non-pong but non-empty answer means the model is reachable.
	// Real upstream errors are filtered by validateTestResponseBody before this runs,
	// so a chat/reasoning model that does not echo "pong" must not be marked failed.
	require.NoError(t, validatePongTestResponseBody([]byte(`{"choices":[{"message":{"content":"hello"}}]}`)))
	require.NoError(t, validatePongTestResponseBody([]byte(`{"choices":[{"message":{"content":""}}],"usage":{"completion_tokens":64}}`)))
	// An empty body is still a genuine failure.
	require.Error(t, validatePongTestResponseBody([]byte(``)))
}

func TestModelAvailabilityProbeConfigUsesImageEndpointForImageModels(t *testing.T) {
	endpointType, options, testable := modelAvailabilityProbeConfig("gpt-image-2", constant.ChannelTypeOpenAI)

	require.True(t, testable)
	require.Equal(t, string(constant.EndpointTypeImageGeneration), endpointType)
	require.False(t, options.ExpectPong)
	require.Equal(t, "模型可用性检测", options.TokenName)
	require.Equal(t, "模型可用性检测", options.LogContent)
	require.True(t, options.SkipLog)
}

func TestModelAvailabilityProbeConfigKeepsPingPongForTextModels(t *testing.T) {
	endpointType, options, testable := modelAvailabilityProbeConfig("gpt-5.4", constant.ChannelTypeOpenAI)

	require.True(t, testable)
	require.Empty(t, endpointType)
	require.True(t, options.ExpectPong)
	require.Equal(t, modelAvailabilityProbePrompt, options.Prompt)
	require.Equal(t, uint(8), options.MaxTokens)
}

func TestModelAvailabilityProbeConfigMarksMediaModelsUntestable(t *testing.T) {
	// A TTS model on a generic chat channel cannot be probed synchronously.
	_, _, ttsTestable := modelAvailabilityProbeConfig("tts-1-hd", constant.ChannelTypeOpenAI)
	require.False(t, ttsTestable)

	// A video model likewise: no synchronous ping→pong is meaningful.
	_, _, videoTestable := modelAvailabilityProbeConfig("veo-3-video", constant.ChannelTypeOpenAI)
	require.False(t, videoTestable)

	// An async-task channel type is untestable regardless of the model name.
	_, _, taskTestable := modelAvailabilityProbeConfig("some-model", constant.ChannelTypeKling)
	require.False(t, taskTestable)

	_, _, bytePlusTestable := modelAvailabilityProbeConfig("some-model", constant.ChannelTypeBytePlus)
	require.False(t, bytePlusTestable)

	// HappyHorse is served through Ali's general-purpose channel type, but its
	// models use the async video task API and must never receive a chat probe.
	for _, modelName := range []string{
		"happyhorse-1.1-t2v",
		"happyhorse-1.1-i2v",
		"happyhorse-1.1-r2v",
		"happyhorse-1.0-video-edit",
	} {
		_, _, happyHorseTestable := modelAvailabilityProbeConfig(modelName, constant.ChannelTypeAli)
		require.False(t, happyHorseTestable, modelName)
	}

	// Other Ali models still use their normal synchronous availability probe.
	_, _, aliTextTestable := modelAvailabilityProbeConfig("qwen-plus", constant.ChannelTypeAli)
	require.True(t, aliTextTestable)

	// MiniMax-H3 also uses an asynchronous endpoint and cannot be verified by
	// the synchronous chat availability probe.
	_, _, minimaxH3Testable := modelAvailabilityProbeConfig("MiniMax-H3", constant.ChannelTypeOpenAI)
	require.False(t, minimaxH3Testable)
}

func TestModelAvailabilityProbeConfigUsesEmbeddingEndpointForEmbeddingModels(t *testing.T) {
	endpointType, options, testable := modelAvailabilityProbeConfig("text-embedding-3-large", constant.ChannelTypeOpenAI)

	require.True(t, testable)
	require.Equal(t, string(constant.EndpointTypeEmbeddings), endpointType)
	require.False(t, options.ExpectPong)
}

func TestSummarizeModelProbeOutcomesKeepsUntestableProviderAvailable(t *testing.T) {
	outcome := summarizeModelProbeOutcomes([]modelProbeOutcome{
		{Class: modelProbeOfficialUnsupported, ReasonType: "official_model_unsupported"},
	}, true)

	require.Equal(t, modelProbeAvailable, outcome.Class)
}
