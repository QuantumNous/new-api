package gemini

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestApplyVeoMetadataToInstanceSupportsFramesAndReferenceImages(t *testing.T) {
	instance := VeoInstance{Prompt: "make a video"}
	features, err := ApplyVeoMetadataToInstance(map[string]any{
		"image": map[string]any{
			"inlineData": map[string]any{
				"mimeType": "image/png",
				"data":     "first-base64",
			},
		},
		"lastFrame": map[string]any{
			"inlineData": map[string]any{
				"mimeType": "image/png",
				"data":     "last-base64",
			},
		},
		"referenceImages": []any{
			map[string]any{
				"image": map[string]any{
					"inlineData": map[string]any{
						"mimeType": "image/png",
						"data":     "asset-base64",
					},
				},
				"referenceType": "asset",
			},
		},
	}, &instance)

	require.NoError(t, err)
	require.True(t, features.HasImage)
	require.True(t, features.HasLastFrame)
	require.True(t, features.HasReferenceImages)

	data, err := common.Marshal(VeoRequestPayload{Instances: []VeoInstance{instance}})
	require.NoError(t, err)
	require.JSONEq(t, `{
		"instances": [{
			"prompt": "make a video",
			"image": {"inlineData": {"mimeType": "image/png", "data": "first-base64"}},
			"lastFrame": {"inlineData": {"mimeType": "image/png", "data": "last-base64"}},
			"referenceImages": [{
				"image": {"inlineData": {"mimeType": "image/png", "data": "asset-base64"}},
				"referenceType": "asset"
			}]
		}]
	}`, string(data))
}

func TestApplyVeoMetadataToInstanceSupportsAliasesAndStringifiedJSON(t *testing.T) {
	instance := VeoInstance{Prompt: "make a video"}
	features, err := ApplyVeoMetadataToInstance(map[string]any{
		"first_frame":      "data:image/png;base64,Zmlyc3Q=",
		"last_frame":       `{"inlineData":{"mimeType":"image/jpeg","data":"last-base64"}}`,
		"reference_images": `[{"image":{"inlineData":{"mimeType":"image/png","data":"asset-base64"}},"reference_type":"asset"}]`,
	}, &instance)

	require.NoError(t, err)
	require.True(t, features.HasImage)
	require.True(t, features.HasLastFrame)
	require.True(t, features.HasReferenceImages)
	require.Equal(t, "image/png", instance.Image.InlineData.MimeType)
	require.Equal(t, "Zmlyc3Q=", instance.Image.InlineData.Data)
	require.Equal(t, "image/jpeg", instance.LastFrame.InlineData.MimeType)
	require.Len(t, instance.ReferenceImages, 1)
	require.Equal(t, "asset", instance.ReferenceImages[0].ReferenceType)
}

func TestApplyVeoMetadataToInstanceSupportsBareReferenceImageDataURI(t *testing.T) {
	instance := VeoInstance{Prompt: "make a video"}
	features, err := ApplyVeoMetadataToInstance(map[string]any{
		"referenceImages": []any{
			"data:image/png;base64,aVZCTw==",
			map[string]any{
				"inlineData": map[string]any{
					"mimeType": "image/jpeg",
					"data":     "bare-object-base64",
				},
			},
		},
	}, &instance)

	require.NoError(t, err)
	require.True(t, features.HasReferenceImages)
	require.Len(t, instance.ReferenceImages, 2)
	require.Equal(t, "asset", instance.ReferenceImages[0].ReferenceType)
	require.Equal(t, "image/png", instance.ReferenceImages[0].Image.InlineData.MimeType)
	require.Equal(t, "aVZCTw==", instance.ReferenceImages[0].Image.InlineData.Data)
	require.Equal(t, "asset", instance.ReferenceImages[1].ReferenceType)
	require.Equal(t, "image/jpeg", instance.ReferenceImages[1].Image.InlineData.MimeType)
}

func TestApplyVeoMetadataToInstanceReturnsErrorsForInvalidInputs(t *testing.T) {
	tests := []struct {
		name        string
		metadata    map[string]any
		errContains string
	}{
		{
			name: "image missing inline data",
			metadata: map[string]any{
				"image": map[string]any{
					"inlineData": map[string]any{
						"mimeType": "image/png",
					},
				},
			},
			errContains: "inlineData.data is required",
		},
		{
			name: "reference images string is not array",
			metadata: map[string]any{
				"referenceImages": "data:image/png;base64,aVZCTw==",
			},
			errContains: "referenceImages string must contain a JSON array",
		},
		{
			name: "malformed json image string",
			metadata: map[string]any{
				"last_frame": `{"inlineData":{"mimeType":"image/png","data":"broken"`,
			},
			errContains: "invalid metadata lastFrame",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			instance := VeoInstance{Prompt: "make a video"}
			features, err := ApplyVeoMetadataToInstance(tt.metadata, &instance)

			require.Error(t, err)
			require.Contains(t, err.Error(), tt.errContains)
			require.False(t, features.HasImage)
			require.False(t, features.HasLastFrame)
			require.False(t, features.HasReferenceImages)
			require.Nil(t, instance.Image)
			require.Nil(t, instance.LastFrame)
			require.Empty(t, instance.ReferenceImages)
			require.Equal(t, "make a video", instance.Prompt)
		})
	}
}
