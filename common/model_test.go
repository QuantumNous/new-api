package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsImageGenerationModel(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  bool
	}{
		{name: "openai gpt-image-2", model: "gpt-image-2", want: true},
		{name: "openai gpt-image-1", model: "gpt-image-1", want: true},
		{name: "openai dall-e-3", model: "dall-e-3", want: true},
		{name: "openai dall-e-2", model: "dall-e-2", want: true},
		{name: "flux", model: "black-forest-labs/flux-1.1-pro", want: true},
		{name: "imagen", model: "imagen-3.0-generate-002", want: true},
		// 以下厂商图片模型不进入全局模型分类，仅由渠道测试本地识别
		{name: "volc seedream not global", model: "seedream-3.0-250825", want: false},
		{name: "doubao seedream not global", model: "doubao-seedream-1-0-250615", want: false},
		{name: "zhipu cogview not global", model: "cogview-4-250304", want: false},
		{name: "ali wanx not global", model: "wanx2.1-t2i-turbo", want: false},
		{name: "stable diffusion not global", model: "stable-diffusion-xl-1024-v1-0", want: false},
		{name: "ideogram not global", model: "ideogram-v2-turbo", want: false},
		{name: "chat model", model: "gpt-5.4", want: false},
		{name: "embedding model", model: "text-embedding-3-small", want: false},
		{name: "rerank model", model: "bge-large-zh", want: false},
		{name: "code model", model: "kimi-k2.7-code", want: false},
		{name: "video model", model: "doubao-seedance-1-0-pro", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsImageGenerationModel(tt.model))
		})
	}

	assert.False(t, IsImageGenerationModel(""))
	assert.True(t, IsImageGenerationModel("GPT-IMAGE-2"))
}
