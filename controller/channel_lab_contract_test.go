package controller

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLegacyChannelDTOKeepsExistingFieldsAndAddsLabFields(t *testing.T) {
	channel := &model.Channel{
		Id:     17,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "legacy-channel",
		Models: "openai/gpt-5",
	}

	data, err := json.Marshal(buildLegacyChannelDTO(channel))
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(data, &payload))

	assert.Equal(t, float64(17), payload["id"])
	assert.Equal(t, "legacy-channel", payload["name"])
	assert.Equal(t, "openai/gpt-5", payload["models"])
	assert.Equal(t, "openai", payload["lab_group_slug"])
	assert.Equal(t, "OpenAI", payload["lab_group_name"])
	assert.NotEmpty(t, payload["lab_catalog_version"])
}

func TestNextAdminChannelDTOKeepsSupplierAndAddsLabFields(t *testing.T) {
	channel := &model.Channel{
		Id:     18,
		Type:   constant.ChannelTypeOpenAI,
		Name:   "next-channel",
		Models: "openai/gpt-5",
	}

	data, err := json.Marshal(buildNextAdminChannelDTO(channel))
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(data, &payload))

	assert.Equal(t, float64(18), payload["id"])
	assert.Equal(t, "OpenAI", payload["supplier"])
	assert.Equal(t, "openai", payload["lab_group_slug"])
	assert.Equal(t, "OpenAI", payload["lab_group_name"])
	assert.NotEmpty(t, payload["lab_models"])
}
