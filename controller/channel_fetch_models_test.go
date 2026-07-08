package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestNormalizeFetchModelsRequestKeyUsesFirstPlaintextKey(t *testing.T) {
	channel := &model.Channel{Key: "  sk-first  \n sk-second \n"}

	normalizeFetchModelsRequestKey(channel)

	require.Equal(t, "sk-first", channel.Key)
}

func TestNormalizeFetchModelsRequestKeyKeepsJSONCredential(t *testing.T) {
	key := "{\n  \"access_token\": \"token\",\n  \"account_id\": \"account\"\n}"
	channel := &model.Channel{Key: key}

	normalizeFetchModelsRequestKey(channel)

	require.Equal(t, key, channel.Key)
}

func TestFetchModelsRequestAllowsOllamaWithoutKey(t *testing.T) {
	require.False(t, fetchModelsRequestRequiresKey(constant.ChannelTypeOllama))
	require.True(t, fetchModelsRequestRequiresKey(constant.ChannelTypeOpenAI))
}
