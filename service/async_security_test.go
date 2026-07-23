package service

import (
	"bytes"
	"encoding/base64"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAsyncPayloadEncryptionRoundTrip(t *testing.T) {
	key := bytes.Repeat([]byte{0x42}, 32)
	t.Setenv("ASYNC_REQUEST_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))
	plaintext := []byte(`{"model":"test","prompt":"secret prompt"}`)
	encrypted, err := EncryptAsyncPayload(plaintext)
	require.NoError(t, err)
	assert.NotContains(t, string(encrypted), "secret prompt")
	decrypted, err := DecryptAsyncPayload(encrypted)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

func TestHashAsyncRequestCanonicalizesObjectKeys(t *testing.T) {
	first, err := HashAsyncRequest([]byte(`{"model":"m","prompt":"p"}`))
	require.NoError(t, err)
	second, err := HashAsyncRequest([]byte(" { \"prompt\" : \"p\", \"model\": \"m\" } "))
	require.NoError(t, err)
	assert.Equal(t, first, second)
}

func TestValidateAsyncImageRequest(t *testing.T) {
	request := &dto.ImageRequest{Model: "m", Prompt: "hello"}
	require.NoError(t, ValidateAsyncImageRequest(request, []byte(`{"model":"m","prompt":"hello"}`)))

	stream := true
	request.Stream = &stream
	require.ErrorContains(t, ValidateAsyncImageRequest(request, []byte(`{"model":"m","prompt":"hello","stream":true}`)), "streaming")

	stream = false
	count := uint(9)
	request.N = &count
	require.ErrorContains(t, ValidateAsyncImageRequest(request, []byte(`{"model":"m","prompt":"hello","n":9}`)), "image count")

	t.Setenv("ASYNC_MAX_REQUEST_BODY_KB", "1")
	request.N = nil
	require.ErrorContains(t, ValidateAsyncImageRequest(request, bytes.Repeat([]byte{'x'}, 1025)), "request body")
}

func TestValidateAsyncGeminiImageRequest(t *testing.T) {
	count := uint(1)
	request := &dto.ImageRequest{
		Model:   "gemini-3.1-flash-image-preview",
		Prompt:  "draw a square",
		N:       &count,
		Size:    "16:9",
		Quality: "2K",
	}
	require.NoError(t, ValidateAsyncImageRequest(request, []byte(`{"model":"gemini-3.1-flash-image-preview","prompt":"draw a square","n":1,"size":"16:9","quality":"2K"}`)))

	count = 2
	require.ErrorContains(t, ValidateAsyncImageRequest(request, []byte(`{"model":"gemini-3.1-flash-image-preview","prompt":"draw a square","n":2}`)), "exactly one")
	count = 1
	request.Quality = "ultra"
	require.ErrorContains(t, ValidateAsyncImageRequest(request, []byte(`{"model":"gemini-3.1-flash-image-preview","prompt":"draw a square","quality":"ultra"}`)), "use 1K, 2K or 4K")
}

func TestAllowedYunwuBaseURL(t *testing.T) {
	t.Setenv("ASYNC_YUNWU_ALLOWED_BASE_URLS", "")
	assert.True(t, IsAllowedYunwuBaseURL("https://yunwu.ai"))
	assert.False(t, IsAllowedYunwuBaseURL("https://yunwu.ai.attacker.example"))
	assert.False(t, IsAllowedYunwuBaseURL("http://yunwu.ai"))
	assert.False(t, IsAllowedYunwuBaseURL("https://yunwu.ai/unapproved-prefix"))

	t.Setenv("ASYNC_YUNWU_ALLOWED_BASE_URLS", "http://mock-upstream:8080")
	assert.True(t, IsAllowedYunwuBaseURL("http://mock-upstream:8080/v1"))
}

func TestAllowedGRSAIBaseURL(t *testing.T) {
	t.Setenv("ASYNC_GRSAI_ALLOWED_BASE_URLS", "")
	provider, allowed := AsyncImageProviderForBaseURL("https://grsaiapi.com/v1")
	assert.True(t, allowed)
	assert.Equal(t, common.AsyncImageProviderGRSAI, provider)
	assert.True(t, IsAllowedAsyncImageBaseURL("https://grsai.dakka.com.cn"))
	assert.False(t, IsAllowedAsyncImageBaseURL("https://grsai.com"))
	assert.False(t, IsAllowedAsyncImageBaseURL("https://grsaiapi.com.attacker.example"))

	t.Setenv("ASYNC_GRSAI_ALLOWED_BASE_URLS", "http://mock-grsai:8080")
	assert.True(t, IsAllowedAsyncImageBaseURL("http://mock-grsai:8080/v1"))
}

func TestValidateGRSAISynchronousImageRequest(t *testing.T) {
	count := uint(1)
	request := &dto.ImageRequest{Model: "nano-banana-2", Prompt: "draw", N: &count}
	require.NoError(t, ValidateAsyncImageProviderRequest(request, common.AsyncImageProviderGRSAI))

	count = 2
	require.ErrorContains(t, ValidateAsyncImageProviderRequest(request, common.AsyncImageProviderGRSAI), "exactly one")
}
