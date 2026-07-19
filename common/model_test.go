package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsImageGenerationModelCoversProviderCatalogFamilies(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{model: "gpt-image-2", want: true},
		{model: "chatgpt-image-latest", want: true},
		{model: "imagen-4.0-generate-001", want: true},
		{model: "gemini-3-pro-image-preview", want: true},
		{model: "gemini-3.1-flash-image", want: true},
		{model: "models/gemini-3.1-flash-image-preview", want: true},
		{model: "gemini-2.0-flash-exp", want: true},
		{model: "gemini-2.0-flash-exp-high", want: true},
		{model: "gemini-2.5-flash-image-preview", want: true},
		{model: "gemini-3.1-flash-lite-image", want: true},
		{model: "nano-banana-2", want: true},
		{model: "black-forest-labs/flux", want: true},
		{model: "black-forest-labs/flux-1.1-pro", want: true},
		{model: "black-forest-labs/FLUX.1-schnell", want: true},
		{model: "grok-imagine-image-pro", want: true},
		{model: "grok-2-image-1212", want: true},
		{model: "image-01-live", want: true},
		{model: "seedream-4-0-250828", want: true},
		{model: "doubao-seedream-4-0-250828", want: true},
		{model: "qwen-image-edit-plus", want: true},
		{model: "z-image", want: true},
		{model: "wanx-v1", want: true},
		{model: "wan2.6-t2i", want: true},
		{model: "jimeng_high_aes_general_v21_L", want: true},
		{model: "InstantX/InstantID", want: true},
		{model: "ByteDance/SDXL-Lightning", want: true},
		{model: "gemini-2.0-flash", want: false},
		{model: "gemini-3.1-flash", want: false},
		{model: "gpt-5", want: false},
	}

	for _, test := range tests {
		t.Run(test.model, func(t *testing.T) {
			assert.Equal(t, test.want, IsImageGenerationModel(test.model))
		})
	}
}
