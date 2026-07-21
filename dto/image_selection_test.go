package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResolveImageSelectionRequirementCanonicalizesGPTImageVariant(t *testing.T) {
	request := &ImageRequest{
		Model:   "gpt-image-2",
		Quality: "LOW",
		Extra: map[string]json.RawMessage{
			"resolution":   json.RawMessage(`"4k"`),
			"aspect_ratio": json.RawMessage(`"16:9"`),
		},
	}

	requirement, err := request.NormalizeImageSelectionRequirement("gpt-image-2", ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, ImageSelectionRequirement{
		Operation:   ImageOperationGeneration,
		Resolution:  "4K",
		AspectRatio: "16:9",
		Size:        "3840x2160",
		Quality:     "low",
		N:           1,
	}, *requirement)
	assert.Equal(t, "4K", request.GetTokenCountMeta().ImageResolution)
}

func TestResolveImageSelectionRequirementIncludesOutputContract(t *testing.T) {
	n := uint(2)
	request := &ImageRequest{
		Model:        "gpt-image-2",
		N:            &n,
		OutputFormat: json.RawMessage(`"JPG"`),
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, "jpeg", requirement.OutputFormat)
	assert.Equal(t, uint(2), requirement.N)
}

func TestResolveImageSelectionRequirementIncludesRoutingInputs(t *testing.T) {
	watermark := false
	request := &ImageRequest{
		Model:             "gpt-image-2",
		Images:            json.RawMessage(`["https://example.com/one.png","https://example.com/two.png"]`),
		Image:             json.RawMessage(`"https://example.com/legacy.png"`),
		Mask:              json.RawMessage(`"https://example.com/mask.png"`),
		Watermark:         &watermark,
		OutputCompression: json.RawMessage(`0`),
		Background:        json.RawMessage(`"transparent"`),
		Moderation:        json.RawMessage(`"low"`),
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationEdit)
	require.NoError(t, err)
	assert.Equal(t, 2, requirement.ReferenceImageCount)
	assert.True(t, requirement.HasMask)
	assert.Equal(t, []string{"background", "moderation", "output_compression", "watermark"}, requirement.OptionalParameters)
}

func TestResolveImageSelectionRequirementUsesLegacySingularImageFallback(t *testing.T) {
	request := &ImageRequest{
		Model: "gpt-image-2",
		Image: json.RawMessage(`"https://example.com/legacy.png"`),
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationEdit)
	require.NoError(t, err)
	assert.Equal(t, 1, requirement.ReferenceImageCount)
	assert.False(t, requirement.HasMask)
	assert.Empty(t, requirement.OptionalParameters)
}

func TestResolveImageSelectionRequirementInfersVariantFromLegacySize(t *testing.T) {
	request := &ImageRequest{Model: "gpt-image-2", Size: "2880X2880"}

	requirement, err := ResolveImageSelectionRequirementWithModelDefaults(request, request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, "4K", requirement.Resolution)
	assert.Equal(t, "1:1", requirement.AspectRatio)
	assert.Equal(t, "2880x2880", requirement.Size)
}

func TestResolveImageSelectionRequirementRejectsConflictingAliases(t *testing.T) {
	request := &ImageRequest{
		Model: "gpt-image-2",
		Size:  "1024x1024",
		Extra: map[string]json.RawMessage{
			"resolution": json.RawMessage(`"4K"`),
		},
	}

	_, err := ResolveImageSelectionRequirementWithModelDefaults(request, request.Model, ImageOperationGeneration)
	require.ErrorContains(t, err, "conflicts with resolution")
}

func TestResolveImageSelectionRequirementUsesOneKBillingDefault(t *testing.T) {
	request := &ImageRequest{Model: "gpt-image-2"}

	requirement, err := request.NormalizeImageSelectionRequirement(request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, "1K", requirement.Resolution)
	assert.Empty(t, requirement.AspectRatio)
	assert.Empty(t, requirement.Size)
	assert.Equal(t, "1K", request.GetTokenCountMeta().ImageResolution)
}

func TestResolveImageSelectionRequirementAcceptsFlashHalfKResolution(t *testing.T) {
	request := &ImageRequest{
		Model: "gemini-3.1-flash-image-preview",
		Extra: map[string]json.RawMessage{
			"resolution": json.RawMessage(`"512"`),
		},
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, "512", requirement.Resolution)
}

func TestResolveImageSelectionRequirementLeavesProfileSpecificSizeUntouched(t *testing.T) {
	request := &ImageRequest{
		Model: "gpt-image-2",
		Size:  "1254x1254",
		Extra: map[string]json.RawMessage{
			"resolution": json.RawMessage(`"1K"`),
		},
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, "1K", requirement.Resolution)
	assert.Equal(t, "1254x1254", requirement.Size)
	assert.Empty(t, requirement.AspectRatio)
}

func TestResolveImageSelectionRequirementCapturesProviderCountsAndCanonicalParameters(t *testing.T) {
	request := &ImageRequest{
		Model: "provider-image-model",
		Extra: map[string]json.RawMessage{
			"batch_size":       json.RawMessage(`2`),
			"generationConfig": json.RawMessage(`{"candidateCount":2}`),
			"negativePrompt":   json.RawMessage(`"fog"`),
		},
	}

	requirement, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationGeneration)
	require.NoError(t, err)
	assert.Equal(t, uint(2), requirement.N)
	assert.Contains(t, requirement.OptionalParameters, "batch_size")
	assert.Contains(t, requirement.OptionalParameters, "generation_config")
	assert.Contains(t, requirement.OptionalParameters, "negative_prompt")
	assert.JSONEq(t, `{"candidateCount":2}`, string(requirement.OptionalValues["generation_config"]))
}

func TestResolveImageSelectionRequirementRejectsCollidingProviderParameterAliases(t *testing.T) {
	request := &ImageRequest{
		Model: "provider-image-model",
		Extra: map[string]json.RawMessage{
			"negativePrompt":  json.RawMessage(`"fog"`),
			"negative_prompt": json.RawMessage(`"rain"`),
		},
	}

	_, err := ResolveImageSelectionRequirement(request, request.Model, ImageOperationGeneration)
	require.ErrorContains(t, err, "aliases collide")
}
