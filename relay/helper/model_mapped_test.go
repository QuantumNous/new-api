package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newModelMappingTestContext(modelMapping string) *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("model_mapping", modelMapping)
	return ctx
}

func TestModelMappedHelperCompactPrefersFullCompactMapping(t *testing.T) {
	ctx := newModelMappingTestContext(`{
		"gpt-5.5-openai-compact": "gpt-5.4",
		"gpt-5.5": "gpt-5.3"
	}`)
	request := &dto.OpenAIResponsesCompactionRequest{
		Model: "gpt-5.5-openai-compact",
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5-openai-compact",
	}

	err := ModelMappedHelper(ctx, info, request)

	require.NoError(t, err)
	require.True(t, info.IsModelMapped)
	require.Equal(t, "gpt-5.4", info.UpstreamModelName)
	require.Equal(t, "gpt-5.4-openai-compact", info.OriginModelName)
	require.Equal(t, "gpt-5.4", request.Model)
}

func TestModelMappedHelperCompactFallsBackToBaseMapping(t *testing.T) {
	ctx := newModelMappingTestContext(`{
		"gpt-5.5": "gpt-5.4"
	}`)
	request := &dto.OpenAIResponsesCompactionRequest{
		Model: "gpt-5.5-openai-compact",
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5-openai-compact",
	}

	err := ModelMappedHelper(ctx, info, request)

	require.NoError(t, err)
	require.True(t, info.IsModelMapped)
	require.Equal(t, "gpt-5.4", info.UpstreamModelName)
	require.Equal(t, "gpt-5.4-openai-compact", info.OriginModelName)
	require.Equal(t, "gpt-5.4", request.Model)
}

func TestModelMappedHelperPlainModelUnaffectedByCompactAliasMapping(t *testing.T) {
	ctx := newModelMappingTestContext(`{
		"gpt-5.5-openai-compact": "gpt-5.4"
	}`)
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-5.5",
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5.5",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5.5",
		},
	}

	err := ModelMappedHelper(ctx, info, request)

	require.NoError(t, err)
	require.False(t, info.IsModelMapped)
	require.Equal(t, "gpt-5.5", info.UpstreamModelName)
	require.Equal(t, "gpt-5.5", info.OriginModelName)
	require.Equal(t, "gpt-5.5", request.Model)
}

func TestModelMappedHelperCompactTrimsMappedCompactTarget(t *testing.T) {
	ctx := newModelMappingTestContext(`{
		"gpt-5.5-openai-compact": "gpt-5.4-openai-compact"
	}`)
	request := &dto.OpenAIResponsesCompactionRequest{
		Model: "gpt-5.5-openai-compact",
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponsesCompact,
		OriginModelName: "gpt-5.5-openai-compact",
	}

	err := ModelMappedHelper(ctx, info, request)

	require.NoError(t, err)
	require.True(t, info.IsModelMapped)
	require.Equal(t, "gpt-5.4", info.UpstreamModelName)
	require.Equal(t, "gpt-5.4-openai-compact", info.OriginModelName)
	require.Equal(t, "gpt-5.4", request.Model)
}
