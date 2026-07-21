package common

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/types"
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

func TestRelayInfoTracksFirstResponsePerChannelAttempt(t *testing.T) {
	overallStart := time.Now().Add(-time.Minute)
	info := &RelayInfo{
		StartTime:         overallStart,
		FirstResponseTime: overallStart.Add(-time.Second),
		isFirstResponse:   true,
	}

	firstAttemptStart := info.BeginChannelAttempt()
	require.True(t, info.FirstResponseTimeForAttempt(firstAttemptStart).IsZero())
	info.SetFirstResponseTime()
	firstRequestResponse := info.FirstResponseTime
	firstAttemptResponse := info.FirstResponseTimeForAttempt(firstAttemptStart)
	require.False(t, firstAttemptResponse.IsZero())
	require.Equal(t, firstRequestResponse, firstAttemptResponse)

	info.StreamStatus = &StreamStatus{
		StartedAt:   firstAttemptStart,
		FirstDataAt: firstAttemptResponse,
		EndReason:   StreamEndReasonUpstreamFailed,
	}
	secondAttemptStart := info.BeginChannelAttempt()
	require.Nil(t, info.StreamStatus)
	require.True(t, info.FirstResponseTimeForAttempt(secondAttemptStart).IsZero())

	info.SetFirstResponseTime()
	secondAttemptResponse := info.FirstResponseTimeForAttempt(secondAttemptStart)
	require.False(t, secondAttemptResponse.IsZero())
	require.Equal(t, firstRequestResponse, info.FirstResponseTime,
		"request-level first response must remain anchored to the first attempt")
}
