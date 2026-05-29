package common

import (
	"testing"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestRelayInfoGetFinalRequestRelayFormatPrefersExplicitFinal(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:             types.RelayFormatOpenAI,
		RequestConversionChain:  []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
		FinalRequestRelayFormat: types.RelayFormatOpenAIResponses,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatOpenAIResponses), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToConversionChain(t *testing.T) {
	info := &RelayInfo{
		RelayFormat:            types.RelayFormatOpenAI,
		RequestConversionChain: []types.RelayFormat{types.RelayFormatOpenAI, types.RelayFormatClaude},
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatClaude), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatFallsBackToRelayFormat(t *testing.T) {
	info := &RelayInfo{
		RelayFormat: types.RelayFormatGemini,
	}

	require.Equal(t, types.RelayFormat(types.RelayFormatGemini), info.GetFinalRequestRelayFormat())
}

func TestRelayInfoGetFinalRequestRelayFormatNilReceiver(t *testing.T) {
	var info *RelayInfo
	require.Equal(t, types.RelayFormat(""), info.GetFinalRequestRelayFormat())
}

func TestEnsureUpstreamStreamFieldSetsOnlyStream(t *testing.T) {
	input := []byte(`{"model":"claude","large":9007199254740993,"stream":false,"messages":[{"role":"user","content":"hi"}]}`)

	result, err := EnsureUpstreamStreamField(input, &RelayInfo{UpstreamStream: true})
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(result, "stream").Bool())
	require.Equal(t, "9007199254740993", gjson.GetBytes(result, "large").Raw)
	require.Contains(t, string(result), `"large":9007199254740993`)
	require.Contains(t, string(result), `"messages":[{"role":"user","content":"hi"}]`)
}

func TestEnsureUpstreamStreamFieldSkipsWhenUpstreamStreamDisabled(t *testing.T) {
	input := []byte(`{"model":"claude","stream":false}`)

	result, err := EnsureUpstreamStreamField(input, &RelayInfo{})
	require.NoError(t, err)
	require.Equal(t, input, result)
}
