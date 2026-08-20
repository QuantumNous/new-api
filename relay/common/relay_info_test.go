package common

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
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

func TestGenRelayInfoClaude(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name               string
		target             string
		wantRequestURLPath string
		wantBetaQuery      bool
	}{
		{
			name:               "messages",
			target:             "/v1/messages",
			wantRequestURLPath: "/v1/messages",
			wantBetaQuery:      false,
		},
		{
			name:               "messages with beta query",
			target:             "/v1/messages?beta=true",
			wantRequestURLPath: "/v1/messages?beta=true",
			wantBetaQuery:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, tt.target, nil)

			info := GenRelayInfoClaude(ctx, nil)

			require.Equal(t, types.RelayFormat(types.RelayFormatClaude), info.RelayFormat)
			require.Equal(t, relayconstant.RelayModeChatCompletions, info.RelayMode)
			require.Equal(t, tt.wantRequestURLPath, info.RequestURLPath)
			require.Equal(t, tt.wantBetaQuery, info.IsClaudeBetaQuery)
		})
	}
}

func TestCodexFingerprintSeedDoesNotLeakThroughJSONOrString(t *testing.T) {
	seed := "11111111-1111-4111-8111-111111111111"
	info := &RelayInfo{
		ChannelMeta: &ChannelMeta{
			ChannelType:          112,
			ChannelId:            42,
			CodexFingerprintSeed: seed,
		},
	}

	metaJSON, err := json.Marshal(info.ChannelMeta)
	require.NoError(t, err)
	require.NotContains(t, string(metaJSON), "CodexFingerprintSeed")
	require.NotContains(t, string(metaJSON), "codex_fingerprint_seed")
	require.NotContains(t, string(metaJSON), seed)

	infoJSON, err := json.Marshal(info)
	require.NoError(t, err)
	require.NotContains(t, string(infoJSON), "CodexFingerprintSeed")
	require.NotContains(t, string(infoJSON), "codex_fingerprint_seed")
	require.NotContains(t, string(infoJSON), seed)

	infoString := info.ToString()
	require.NotContains(t, infoString, seed)
	require.False(t, strings.Contains(strings.ToLower(infoString), "fingerprint"))
}
