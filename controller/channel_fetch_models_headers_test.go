package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestBuildFetchModelsHeaders_AnthropicIncludesBearerAuth(t *testing.T) {
	t.Parallel()

	ch := &model.Channel{Type: constant.ChannelTypeAnthropic}
	headers, err := buildFetchModelsHeaders(ch, "sk-test")
	require.NoError(t, err)
	require.Equal(t, "sk-test", headers.Get("x-api-key"))
	require.Equal(t, "2023-06-01", headers.Get("anthropic-version"))
	require.Equal(t, "Bearer sk-test", headers.Get("Authorization"))
}

func TestBuildFetchModelsHeaders_AnthropicHeaderOverrideCanReplaceAuthorization(t *testing.T) {
	t.Parallel()

	override := `{"Authorization":"Bearer {api_key}","x-api-key":"{api_key}"}`
	ch := &model.Channel{
		Type:           constant.ChannelTypeAnthropic,
		HeaderOverride: &override,
	}
	headers, err := buildFetchModelsHeaders(ch, "sk-override")
	require.NoError(t, err)
	require.Equal(t, "Bearer sk-override", headers.Get("Authorization"))
	require.Equal(t, "sk-override", headers.Get("x-api-key"))
}
