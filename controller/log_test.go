package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestValidateHistoryLogDeleteTimestamp(t *testing.T) {
	now := time.Date(2026, 6, 8, 12, 0, 0, 0, time.UTC)
	originalRetentionDays := common.LogRetentionDays
	t.Cleanup(func() {
		common.LogRetentionDays = originalRetentionDays
	})

	t.Run("rejects future timestamp", func(t *testing.T) {
		common.LogRetentionDays = 30
		err := validateHistoryLogDeleteTimestamp(now.Add(time.Second).Unix(), now)
		require.ErrorContains(t, err, "future")
	})

	t.Run("rejects non-positive timestamp", func(t *testing.T) {
		common.LogRetentionDays = 30
		err := validateHistoryLogDeleteTimestamp(0, now)
		require.ErrorContains(t, err, "required")
	})

	t.Run("rejects timestamp inside retention window", func(t *testing.T) {
		common.LogRetentionDays = 30
		err := validateHistoryLogDeleteTimestamp(now.AddDate(0, 0, -7).Unix(), now)
		require.ErrorContains(t, err, "30 days")
	})

	t.Run("allows timestamp at retention cutoff", func(t *testing.T) {
		common.LogRetentionDays = 30
		err := validateHistoryLogDeleteTimestamp(now.AddDate(0, 0, -30).Unix(), now)
		require.NoError(t, err)
	})

	t.Run("allows any past timestamp when retention disabled", func(t *testing.T) {
		common.LogRetentionDays = 0
		err := validateHistoryLogDeleteTimestamp(now.Add(-time.Second).Unix(), now)
		require.NoError(t, err)
	})
}

func TestValidateLogRetentionDaysOption(t *testing.T) {
	for _, value := range []string{"0", "30", " 30 ", "3650"} {
		require.NoError(t, validateLogRetentionDaysOption(value))
	}

	for _, value := range []string{"-1", "3651", "1.5", "abc"} {
		require.Error(t, validateLogRetentionDaysOption(value))
	}
}
