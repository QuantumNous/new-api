package helper

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
)

func TestResolveImageOperationForUnifiedEndpoint(t *testing.T) {
	tests := []struct {
		name      string
		relayMode int
		model     string
		request   *dto.ImageRequest
		expected  dto.ImageOperation
	}{
		{name: "prompt generation", relayMode: relayconstant.RelayModeImagesGenerations, model: "gpt-image-2", request: &dto.ImageRequest{}, expected: dto.ImageOperationGeneration},
		{name: "reference image", relayMode: relayconstant.RelayModeImagesGenerations, model: "gpt-image-2", request: &dto.ImageRequest{Images: []byte(`["https://example.com/source.png"]`)}, expected: dto.ImageOperationEdit},
		{name: "mask", relayMode: relayconstant.RelayModeImagesGenerations, model: "gpt-image-2", request: &dto.ImageRequest{Mask: []byte(`"data:image/png;base64,bWFzaw=="`)}, expected: dto.ImageOperationEdit},
		{name: "edit-only model", relayMode: relayconstant.RelayModeImagesGenerations, model: "qwen-image-edit-plus", request: &dto.ImageRequest{}, expected: dto.ImageOperationEdit},
		{name: "legacy edit path", relayMode: relayconstant.RelayModeImagesEdits, model: "gpt-image-2", request: &dto.ImageRequest{}, expected: dto.ImageOperationEdit},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, ResolveImageOperation(test.relayMode, test.model, test.request))
		})
	}

	multipartRequest := &dto.ImageRequest{}
	multipartRequest.SetMultipartImageSelectionMeta(1, false)
	assert.Equal(t, dto.ImageOperationEdit, ResolveImageOperation(
		relayconstant.RelayModeImagesGenerations,
		"gpt-image-2",
		multipartRequest,
	))
}
