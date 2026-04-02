package common

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestSafeElapsedSeconds(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)

	testCases := []struct {
		name     string
		start    time.Time
		end      time.Time
		expected int64
	}{
		{
			name:     "positive",
			start:    base,
			end:      base.Add(5 * time.Second),
			expected: 5,
		},
		{
			name:     "negative clamps to zero",
			start:    base.Add(2 * time.Second),
			end:      base,
			expected: 0,
		},
		{
			name:     "zero time clamps to zero",
			start:    time.Time{},
			end:      base,
			expected: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := SafeElapsedSeconds(tc.start, tc.end)
			if got != tc.expected {
				t.Fatalf("expected %d, got %d", tc.expected, got)
			}
		})
	}
}

func TestRelayInfoFirstResponseLatencyMs(t *testing.T) {
	base := time.Unix(1_700_000_000, 0)

	t.Run("missing first response", func(t *testing.T) {
		info := &RelayInfo{StartTime: base}
		latency, ok := info.FirstResponseLatencyMs()
		if ok || latency != 0 {
			t.Fatalf("expected no valid latency, got latency=%d ok=%v", latency, ok)
		}
	})

	t.Run("valid zero latency", func(t *testing.T) {
		info := &RelayInfo{
			StartTime:         base,
			FirstResponseTime: base,
		}
		latency, ok := info.FirstResponseLatencyMs()
		if !ok || latency != 0 {
			t.Fatalf("expected zero latency, got latency=%d ok=%v", latency, ok)
		}
	})

	t.Run("future start invalidates negative latency", func(t *testing.T) {
		info := &RelayInfo{
			StartTime:         base.Add(2 * time.Second),
			FirstResponseTime: base,
		}
		latency, ok := info.FirstResponseLatencyMs()
		if ok || latency != 0 {
			t.Fatalf("expected invalid latency for future start time, got latency=%d ok=%v", latency, ok)
		}
	})
}

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
