package openai

import (
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestNormalizeImageGenerationsRequestPathApimart(t *testing.T) {
	base := "https://api.apimart.ai"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)
}

func TestNormalizeImageGenerationsRequestPathApib(t *testing.T) {
	base := "https://api.apib.ai"
	model := "gemini-3.1-flash-image-preview"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)
}

func TestNormalizeImageGenerationsRequestPathOtherUpstream(t *testing.T) {
	base := "https://api.romaapi.com"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	// Default (submitPathMode unset) now submits to the sync endpoint for any upstream;
	// async upstreams that reply with a task_id are polled server-side in relay-openai.go.
	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	// Upstreams whose task submit lives only at /async must opt in explicitly.
	got = normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "generations_async")
	require.Equal(t, "/v1/images/generations/async", got)
}

func TestNormalizeImageGenerationsRequestPathPacky(t *testing.T) {
	base := "https://www.packyapi.com"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)
}

func TestNormalizeImageGenerationsRequestPathSubrouter(t *testing.T) {
	base := "https://subrouter.ai"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model, "")
	require.Equal(t, "/v1/images/generations", got)
}

func TestNormalizeImageGenerationsRequestPathExplicitMode(t *testing.T) {
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations/async", "https://unknown.example", mode, "future-image-model", "generations")
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations", "https://api.apib.ai", mode, "future-image-model", "generations_async")
	require.Equal(t, "/v1/images/generations/async", got)
}
