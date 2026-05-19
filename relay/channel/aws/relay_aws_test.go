package aws

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	bedrockruntimeTypes "github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestDoAwsClientRequest_AppliesRuntimeHeaderOverrideToAnthropicBeta(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName:           "claude-3-5-sonnet-20240620",
		IsStream:                  false,
		UseRuntimeHeadersOverride: true,
		RuntimeHeadersOverride: map[string]any{
			"anthropic-beta": "computer-use-2025-01-24",
		},
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	requestBody := bytes.NewBufferString(`{"messages":[{"role":"user","content":"hello"}],"max_tokens":128}`)
	adaptor := &Adaptor{}

	_, err := doAwsClientRequest(ctx, info, adaptor, requestBody)
	require.NoError(t, err)

	awsReq, ok := adaptor.AwsReq.(*bedrockruntime.InvokeModelInput)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(awsReq.Body, &payload))

	anthropicBeta, exists := payload["anthropic_beta"]
	require.True(t, exists)

	values, ok := anthropicBeta.([]any)
	require.True(t, ok)
	require.Equal(t, []any{"computer-use-2025-01-24"}, values)
}

func TestBuildAwsCountTokensInputUsesInvokeModelBody(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-5-sonnet-20240620",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	requestBody := bytes.NewBufferString(`{"model":"claude-3-5-sonnet-20240620","messages":[{"role":"user","content":"hello"}]}`)
	input, _, err := buildAwsCountTokensInput(ctx, info, requestBody)
	require.NoError(t, err)

	require.Equal(t, "anthropic.claude-3-5-sonnet-20240620-v1:0", *input.ModelId)
	invokeModel, ok := input.Input.(*bedrockruntimeTypes.CountTokensInputMemberInvokeModel)
	require.True(t, ok)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(invokeModel.Value.Body, &payload))
	require.Equal(t, "bedrock-2023-05-31", payload["anthropic_version"])
	require.NotContains(t, payload, "model")
	require.NotEmpty(t, payload["messages"])
}

func TestBuildAwsCountTokensInputNormalizesGlobalInferenceProfile(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "global.anthropic.claude-opus-4-6-v1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|ap-northeast-1",
			UpstreamModelName: "global.anthropic.claude-opus-4-6-v1",
		},
	}

	requestBody := bytes.NewBufferString(`{"model":"global.anthropic.claude-opus-4-6-v1","messages":[{"role":"user","content":"hello"}]}`)
	input, _, err := buildAwsCountTokensInput(ctx, info, requestBody)
	require.NoError(t, err)

	require.Equal(t, "anthropic.claude-opus-4-6-v1", *input.ModelId)
	_, ok := input.Input.(*bedrockruntimeTypes.CountTokensInputMemberInvokeModel)
	require.True(t, ok)
}

func TestBuildAwsCountTokensInputRejectsNonClaudeModel(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "nova-micro-v1:0",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "access-key|secret-key|us-east-1",
			UpstreamModelName: "nova-micro-v1:0",
		},
	}

	requestBody := bytes.NewBufferString(`{"model":"nova-micro-v1:0","messages":[{"role":"user","content":"hello"}]}`)
	_, _, err := buildAwsCountTokensInput(ctx, info, requestBody)

	require.Error(t, err)
	require.Contains(t, err.Error(), "only supports Claude")
}

func TestCountClaudeTokensPreservesAwsClientError(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "claude-3-5-sonnet-20240620",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "invalid-secret",
			UpstreamModelName: "claude-3-5-sonnet-20240620",
		},
	}

	_, err := CountClaudeTokens(ctx, info, bytes.NewBufferString(`{"model":"claude-3-5-sonnet-20240620","messages":[{"role":"user","content":"hello"}]}`))

	require.NotNil(t, err)
	require.Equal(t, types.ErrorCodeChannelAwsClientError, err.GetErrorCode())
	require.False(t, types.IsSkipRetryError(err))
	require.Equal(t, http.StatusInternalServerError, err.StatusCode)
}
