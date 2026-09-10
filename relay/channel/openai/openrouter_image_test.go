package openai

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetRequestURLOpenRouterImageGeneration verifies that image generation
// requests to an OpenRouter channel are sent to OpenRouter's flat
// {base}/v1/images endpoint instead of the OpenAI-style /v1/images/generations.
func TestGetRequestURLOpenRouterImageGeneration(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		RequestURLPath: "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenRouter,
			ChannelBaseUrl: "https://openrouter.ai/api",
		},
	}

	got, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://openrouter.ai/api/v1/images", got)
}

// TestGetRequestURLOpenRouterChatUnchanged guards against the image special
// case leaking into the chat completions path for OpenRouter channels.
func TestGetRequestURLOpenRouterChatUnchanged(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenRouter,
			ChannelBaseUrl: "https://openrouter.ai/api",
		},
	}

	got, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://openrouter.ai/api/v1/chat/completions", got)
}

// TestConvertImageRequestOpenRouterMergesExtra verifies that OpenRouter-specific
// image generation params captured in ImageRequest.Extra (aspect_ratio, seed,
// provider, ...) are merged back into the outbound body for OpenRouter channels,
// alongside the known OpenAI fields.
func TestConvertImageRequestOpenRouterMergesExtra(t *testing.T) {
	t.Parallel()

	body := `{
		"model": "google/gemini-2.5-flash-image",
		"prompt": "a cat wearing a hat",
		"aspect_ratio": "16:9",
		"seed": 42,
		"provider": {"options": {"only": ["google-vertex"]}}
	}`
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(body), &request))
	require.Contains(t, request.Extra, "aspect_ratio")

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		RequestURLPath: "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenRouter,
			ChannelBaseUrl: "https://openrouter.ai/api",
		},
	}

	converted, err := adaptor.ConvertImageRequest(nil, info, request)
	require.NoError(t, err)

	serialized, err := common.Marshal(converted)
	require.NoError(t, err)

	var got map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(serialized, &got))

	assert.JSONEq(t, `"google/gemini-2.5-flash-image"`, string(got["model"]))
	assert.JSONEq(t, `"a cat wearing a hat"`, string(got["prompt"]))
	assert.JSONEq(t, `"16:9"`, string(got["aspect_ratio"]))
	assert.JSONEq(t, `42`, string(got["seed"]))
	assert.JSONEq(t, `{"options": {"only": ["google-vertex"]}}`, string(got["provider"]))
}

// TestConvertImageRequestNonOpenRouterDropsExtra guards the owner's constraint
// that Extra must NOT be merged globally: for non-OpenRouter channels the
// serialized body keeps dropping unknown fields.
func TestConvertImageRequestNonOpenRouterDropsExtra(t *testing.T) {
	t.Parallel()

	body := `{
		"model": "gpt-image-1",
		"prompt": "a cat wearing a hat",
		"aspect_ratio": "16:9",
		"seed": 42
	}`
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(body), &request))
	require.Contains(t, request.Extra, "aspect_ratio")

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		RequestURLPath: "/v1/images/generations",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenAI,
			ChannelBaseUrl: "https://api.openai.com",
		},
	}

	converted, err := adaptor.ConvertImageRequest(nil, info, request)
	require.NoError(t, err)

	serialized, err := common.Marshal(converted)
	require.NoError(t, err)

	var got map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(serialized, &got))

	assert.NotContains(t, got, "aspect_ratio")
	assert.NotContains(t, got, "seed")
	assert.JSONEq(t, `"gpt-image-1"`, string(got["model"]))
	assert.JSONEq(t, `"a cat wearing a hat"`, string(got["prompt"]))
}
