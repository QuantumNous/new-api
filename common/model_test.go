package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsOpenAIGPTModel(t *testing.T) {
	t.Parallel()

	for _, model := range []string{"gpt", "gpt-4o", "OpenAI/GPT-5.6-sol", " vendor/gpt-5 "} {
		assert.True(t, IsOpenAIGPTModel(model), model)
	}
	for _, model := range []string{"", "chatgpt-4o-latest", "my-gpt-5", "glm-5.2", "gptimage-1"} {
		assert.False(t, IsOpenAIGPTModel(model), model)
	}
}

func TestIsOpenAIResponseOnlyModelUsesMappedModelBaseName(t *testing.T) {
	t.Parallel()

	assert.True(t, IsOpenAIResponseOnlyModel("openai/o3-pro"))
	assert.True(t, IsOpenAIResponseOnlyModel("O3-PRO"))
	assert.True(t, IsOpenAIResponseOnlyModel("o3-pro-2025-06-10"))
	assert.False(t, IsOpenAIResponseOnlyModel("my-o3-pro"))
}
