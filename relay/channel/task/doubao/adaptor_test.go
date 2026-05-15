package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestConvertUnifiedRequestToDoubaoPayload(t *testing.T) {
	adaptor := &TaskAdaptor{}

	payload, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-2.0",
		Prompt:   "小猫在城市上空急速飞行",
		Duration: 5,
		Width:    1280,
		Height:   720,
	})

	require.NoError(t, err)
	require.Equal(t, "doubao-seedance-2.0", payload.Model)
	require.Equal(t, "720p", payload.Resolution)
	require.Equal(t, "16:9", payload.Ratio)
	require.NotNil(t, payload.Duration)
	require.Equal(t, 5, int(*payload.Duration))
	require.Len(t, payload.Content, 1)
	require.Equal(t, "text", payload.Content[0].Type)
	require.Equal(t, "小猫在城市上空急速飞行", payload.Content[0].Text)
}

func TestConvertUnifiedRequestSerializesOfficialDoubaoContent(t *testing.T) {
	adaptor := &TaskAdaptor{}

	payload, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:    "doubao-seedance-2.0",
		Prompt:   "小猫在城市上空急速飞行",
		Duration: 5,
		Width:    1280,
		Height:   720,
	})
	require.NoError(t, err)

	data, err := common.Marshal(payload)
	require.NoError(t, err)

	var body map[string]any
	require.NoError(t, common.Unmarshal(data, &body))
	require.Equal(t, "doubao-seedance-2.0", body["model"])
	require.Equal(t, "720p", body["resolution"])
	require.Equal(t, "16:9", body["ratio"])
	require.EqualValues(t, 5, body["duration"])

	content, ok := body["content"].([]any)
	require.True(t, ok)
	require.Len(t, content, 1)
	textItem, ok := content[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "text", textItem["type"])
	require.Equal(t, "小猫在城市上空急速飞行", textItem["text"])
}

func TestConvertUnifiedRequestOverridesMetadataText(t *testing.T) {
	adaptor := &TaskAdaptor{}

	payload, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2.0",
		Prompt: "用户侧统一提示词",
		Metadata: map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{
					"type": "text",
					"text": "metadata 中的旧提示词",
				},
				map[string]interface{}{
					"type": "image_url",
					"image_url": map[string]interface{}{
						"url": "https://example.com/cat.png",
					},
				},
			},
		},
	})

	require.NoError(t, err)
	require.Len(t, payload.Content, 2)
	require.Equal(t, "text", payload.Content[0].Type)
	require.Equal(t, "用户侧统一提示词", payload.Content[0].Text)
	require.Equal(t, "image_url", payload.Content[1].Type)
	require.Equal(t, "https://example.com/cat.png", payload.Content[1].ImageURL.URL)
}

func TestConvertUnifiedRequestPreservesImageRoles(t *testing.T) {
	adaptor := &TaskAdaptor{}

	payload, err := adaptor.convertToRequestPayload(&relaycommon.TaskSubmitReq{
		Model:  "doubao-seedance-2.0",
		Prompt: "hello",
		Images: []string{
			"https://example.com/first.jpeg",
			"https://example.com/last.jpeg",
		},
		ImageInputs: []relaycommon.TaskImageInput{
			{URL: "https://example.com/first.jpeg", Role: "first_frame"},
			{URL: "https://example.com/last.jpeg", Role: "last_frame"},
		},
	})

	require.NoError(t, err)
	require.Len(t, payload.Content, 3)
	require.Equal(t, "text", payload.Content[0].Type)
	require.Equal(t, "https://example.com/first.jpeg", payload.Content[1].ImageURL.URL)
	require.Equal(t, "first_frame", payload.Content[1].Role)
	require.Equal(t, "https://example.com/last.jpeg", payload.Content[2].ImageURL.URL)
	require.Equal(t, "last_frame", payload.Content[2].Role)
}
