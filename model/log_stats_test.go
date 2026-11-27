package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSumUsedQuotaIncludesTaskRefunds(t *testing.T) {
	truncateTables(t)

	chargeTime := time.Now().Unix()
	refundTime := chargeTime + 1
	logs := []Log{
		{Type: LogTypeConsume, Quota: 1000, CreatedAt: chargeTime, ModelName: "video-partial", Username: "alice", PromptTokens: 10, CompletionTokens: 20},
		{Type: LogTypeRefund, Quota: 700, CreatedAt: refundTime, ModelName: "video-partial", Username: "alice"},
		{Type: LogTypeConsume, Quota: 1000, CreatedAt: chargeTime, ModelName: "video-full", Username: "alice"},
		{Type: LogTypeRefund, Quota: 1000, CreatedAt: refundTime, ModelName: "video-full", Username: "alice"},
		{Type: LogTypeConsume, Quota: 300, CreatedAt: chargeTime, ModelName: "chat", Username: "alice"},
		{Type: LogTypeTopup, Quota: 2000, CreatedAt: chargeTime, ModelName: "video-partial", Username: "alice"},
		{Type: LogTypeRefund, Quota: 100, CreatedAt: refundTime, ModelName: "video-partial", Username: "bob"},
	}
	for i := range logs {
		require.NoError(t, createLog(&logs[i]))
	}

	cases := []struct {
		name    string
		logType int
		start   int64
		model   string
		wanted  Stat
	}{
		{name: "partial refund", start: chargeTime, model: "video-partial", wanted: Stat{Quota: 300, Rpm: 1, Tpm: 30}},
		{name: "full refund", start: chargeTime, model: "video-full", wanted: Stat{Rpm: 1}},
		{name: "chat final charge", start: chargeTime, model: "chat", wanted: Stat{Quota: 300, Rpm: 1}},
		{name: "only consume", logType: LogTypeConsume, start: chargeTime, model: "video-partial", wanted: Stat{Quota: 1000, Rpm: 1, Tpm: 30}},
		{name: "only refund", logType: LogTypeRefund, start: chargeTime, model: "video-partial", wanted: Stat{Quota: 700, Rpm: 1, Tpm: 30}},
		{name: "refund without matching charge in date range", start: refundTime, model: "video-partial", wanted: Stat{Quota: -700, Rpm: 1, Tpm: 30}},
		{name: "empty date range", start: refundTime + 1, model: "video-partial", wanted: Stat{Rpm: 1, Tpm: 30}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			stat, err := SumUsedQuota(tc.logType, tc.start, refundTime+1, tc.model, "alice", "", 0, "")
			require.NoError(t, err)
			assert.Equal(t, tc.wanted, stat)
		})
	}
}

func TestDashboardTaskRefunds(t *testing.T) {
	truncateTables(t)
	export, consume := common.DataExportEnabled, common.LogConsumeEnabled
	common.DataExportEnabled, common.LogConsumeEnabled = true, true
	t.Cleanup(func() { common.DataExportEnabled, common.LogConsumeEnabled = export, consume })
	require.NoError(t, DB.Create(&User{Id: 41, Username: "alice"}).Error)

	refund := RecordTaskBillingLogParams{UserId: 41, ModelName: "video", LogType: LogTypeRefund, Quota: 700, Group: "vip", ChannelId: 9, NodeName: "source"}
	RecordTaskBillingLog(refund)
	var log Log
	require.NoError(t, LOG_DB.Where("user_id = ? AND type = ?", 41, LogTypeRefund).Take(&log).Error)
	assert.Equal(t, 700, log.Quota)

	// Concurrent exporters can leave two rows for the same hour. Apply the refund once.
	hour := log.CreatedAt - log.CreatedAt%3600
	bucket := QuotaData{CreatedAt: hour, UserID: 41, Username: "alice", ModelName: "video", UseGroup: "vip", ChannelID: 9, NodeName: "source"}
	rows := []QuotaData{bucket, bucket}
	rows[0].Count, rows[0].Quota, rows[0].TokenUsed = 1, 1000, 20
	require.NoError(t, DB.Create(&rows).Error)
	SaveQuotaDataCache()

	stats, err := GetQuotaDataByUserId(41, hour, hour)
	require.NoError(t, err)
	require.Len(t, stats, 1)
	assert.Equal(t, 300, stats[0].Quota)
	assert.Equal(t, 1, stats[0].Count)
	assert.Equal(t, 20, stats[0].TokenUsed)
}
