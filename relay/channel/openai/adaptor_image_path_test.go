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

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model)
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model)
	require.Equal(t, "/v1/images/generations", got)
}

func TestNormalizeImageGenerationsRequestPathOtherUpstream(t *testing.T) {
	base := "https://api.romaapi.com"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model)
	require.Equal(t, "/v1/images/generations/async", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model)
	require.Equal(t, "/v1/images/generations/async", got)
}

func TestNormalizeImageGenerationsRequestPathPacky(t *testing.T) {
	base := "https://www.packyapi.com"
	model := "gpt-image-2"
	mode := relayconstant.RelayModeImagesGenerations

	got := normalizeImageGenerationsRequestPath("/v1/images/generations", base, mode, model)
	require.Equal(t, "/v1/images/generations", got)

	got = normalizeImageGenerationsRequestPath("/v1/images/generations/async", base, mode, model)
	require.Equal(t, "/v1/images/generations", got)
}
