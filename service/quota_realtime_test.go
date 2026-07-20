package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSummarizeWssQuotasKeepsTranscriptionOutOfSettlement(t *testing.T) {
	tests := []struct {
		name               string
		mainQuota          int
		transcriptionQuota int
		expected           wssQuotaSummary
	}{
		{
			name:               "mixed realtime and transcription session",
			mainQuota:          100,
			transcriptionQuota: 25,
			expected: wssQuotaSummary{
				SettlementQuota: 100,
				StatisticsQuota: 125,
			},
		},
		{
			name:               "transcription-only session",
			transcriptionQuota: 25,
			expected: wssQuotaSummary{
				SettlementQuota: 0,
				StatisticsQuota: 25,
			},
		},
		{
			name:      "main realtime session without transcription",
			mainQuota: 100,
			expected: wssQuotaSummary{
				SettlementQuota: 100,
				StatisticsQuota: 100,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, clamp := summarizeWssQuotas(test.mainQuota, test.transcriptionQuota)

			assert.Equal(t, test.expected, actual)
			assert.Nil(t, clamp)
		})
	}
}

func TestSummarizeWssQuotasSaturatesStatisticsOnly(t *testing.T) {
	summary, clamp := summarizeWssQuotas(common.MaxQuota, 1)

	assert.Equal(t, common.MaxQuota, summary.SettlementQuota)
	assert.Equal(t, common.MaxQuota, summary.StatisticsQuota)
	require.NotNil(t, clamp)
	assert.Equal(t, common.QuotaClampOverflow, clamp.Kind)
}
