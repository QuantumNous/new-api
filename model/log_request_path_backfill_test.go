package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createHistoricalLog(t *testing.T, log *Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(log).Error)
}

func getOptionValueForTest(t *testing.T, key string) string {
	t.Helper()

	var option Option
	require.NoError(t, DB.Where("key = ?", key).First(&option).Error)
	return option.Value
}

func TestBackfillLogRequestPath_FillsHistoricalLogsAndTracksAudit(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))

	createHistoricalLog(t, &Log{
		UserId:      1,
		CreatedAt:   1_700_000_100,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		RequestPath: "",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})
	createHistoricalLog(t, &Log{
		UserId:      1,
		CreatedAt:   1_700_000_101,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		RequestPath: "",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/responses"}),
	})
	createHistoricalLog(t, &Log{
		UserId:      1,
		CreatedAt:   1_700_000_102,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		RequestPath: "",
		Other:       common.MapToJsonStr(map[string]interface{}{"task_id": "task-missing"}),
	})

	result, err := BackfillLogRequestPath(2)
	require.NoError(t, err)
	assert.Equal(t, int64(3), result.Scanned)
	assert.Equal(t, int64(2), result.Updated)
	assert.Equal(t, int64(1), result.Missing)
	assert.Equal(t, int64(0), result.Failed)

	var logs []Log
	require.NoError(t, LOG_DB.Order("id asc").Find(&logs).Error)
	require.Len(t, logs, 3)
	assert.Equal(t, "/v1/chat/completions", logs[0].RequestPath)
	assert.Equal(t, "/v1/responses", logs[1].RequestPath)
	assert.Empty(t, logs[2].RequestPath)

	assert.Equal(t, "completed", getOptionValueForTest(t, "LogRequestPathBackfillStatus"))
	assert.Equal(t, "3", getOptionValueForTest(t, "LogRequestPathBackfillScanned"))
	assert.Equal(t, "2", getOptionValueForTest(t, "LogRequestPathBackfillUpdated"))
	assert.Equal(t, "1", getOptionValueForTest(t, "LogRequestPathBackfillMissing"))
}

func TestBackfillLogRequestPath_IsIdempotentAfterCompletion(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))

	createHistoricalLog(t, &Log{
		UserId:      1,
		CreatedAt:   1_700_000_100,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		RequestPath: "",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})

	first, err := BackfillLogRequestPath(1)
	require.NoError(t, err)
	second, err := BackfillLogRequestPath(1)
	require.NoError(t, err)

	assert.Equal(t, first.Scanned, second.Scanned)
	assert.Equal(t, first.Updated, second.Updated)
	assert.Equal(t, first.Missing, second.Missing)
	assert.Equal(t, first.Failed, second.Failed)

	var logs []Log
	require.NoError(t, LOG_DB.Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "/v1/chat/completions", logs[0].RequestPath)
}
