package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSumUsedQuotaPreservesQuotaWhenLoadingRateStats(t *testing.T) {
	truncateTables(t)

	now := time.Now().Unix()
	username := "log-stat-" + t.Name()
	require.NoError(t, LOG_DB.Create(&Log{
		UserId:           1,
		CreatedAt:        now,
		Type:             LogTypeConsume,
		Username:         username,
		Quota:            12345,
		PromptTokens:     10,
		CompletionTokens: 20,
	}).Error)

	stat, err := SumUsedQuota(LogTypeConsume, now-1, now+1, "", username, "", 0, "")
	require.NoError(t, err)
	assert.Equal(t, 12345, stat.Quota)
	assert.Equal(t, 1, stat.Rpm)
	assert.Equal(t, 30, stat.Tpm)
}
