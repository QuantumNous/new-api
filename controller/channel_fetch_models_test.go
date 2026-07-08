package controller

import (
	"encoding/json"
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

func TestFetchModelsRequestIgnoresPersistedChannelStateFields(t *testing.T) {
	body := []byte(`{
		"id": 123,
		"type": 1,
		"key": "sk-test",
		"base_url": "https://api.example.com",
		"setting": "{\"proxy\":\"http://proxy.example.com\"}",
		"settings": "{\"vertex_key_type\":\"api_key\"}",
		"header_override": "{\"X-Test\":\"ok\"}",
		"channel_info": {
			"is_multi_key": true,
			"multi_key_mode": "polling",
			"multi_key_status_list": {"0": 1}
		}
	}`)

	var req fetchModelsRequest
	require.NoError(t, json.Unmarshal(body, &req))

	channel := req.channel()

	require.Zero(t, channel.Id)
	require.False(t, channel.ChannelInfo.IsMultiKey)
	require.Equal(t, constant.ChannelTypeOpenAI, channel.Type)
	require.Equal(t, "sk-test", channel.Key)
	require.Equal(t, "https://api.example.com", channel.GetBaseURL())
	require.NotNil(t, channel.Setting)
	require.NotNil(t, channel.HeaderOverride)
	require.Equal(t, `{"vertex_key_type":"api_key"}`, channel.OtherSettings)
}
