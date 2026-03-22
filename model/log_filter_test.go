package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createLogForFilterTest(t *testing.T, log *Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(log).Error)
}

func TestApplyLogFilters_MatchesRequestPathAndMetadata(t *testing.T) {
	truncateTables(t)

	createLogForFilterTest(t, &Log{
		UserId:           11,
		CreatedAt:        1_700_000_100,
		Type:             LogTypeConsume,
		Username:         "alice",
		TokenName:        "alpha",
		ModelName:        "gpt-4o-mini",
		Group:            "team-a",
		RequestId:        "req-match",
		RequestPath:      "/v1/chat/completions",
		Quota:            10,
		PromptTokens:     100,
		CompletionTokens: 20,
		Other:            common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})
	createLogForFilterTest(t, &Log{
		UserId:      11,
		CreatedAt:   1_700_000_200,
		Type:        LogTypeConsume,
		Username:    "alice",
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-match",
		RequestPath: "/v1/responses",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/responses"}),
	})
	createLogForFilterTest(t, &Log{
		UserId:      22,
		CreatedAt:   1_700_000_300,
		Type:        LogTypeConsume,
		Username:    "bob",
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-match",
		RequestPath: "/v1/chat/completions",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})

	userID := 11
	tx, err := applyLogFilters(LOG_DB.Model(&Log{}), LogFilter{
		UserID:         &userID,
		LogType:        LogTypeConsume,
		StartTimestamp: 1_700_000_000,
		EndTimestamp:   1_700_001_000,
		ModelName:      "gpt-4o%",
		TokenName:      "alpha",
		Group:          "team-a",
		RequestID:      "req-match",
		RequestPath:    "/v1/chat/completions",
	})
	require.NoError(t, err)

	var logs []Log
	require.NoError(t, tx.Order("logs.id asc").Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, 11, logs[0].UserId)
	assert.Equal(t, "/v1/chat/completions", logs[0].RequestPath)
	assert.Equal(t, "req-match", logs[0].RequestId)
}

func TestApplyLogFilters_RequestPathRequiresExactMatch(t *testing.T) {
	truncateTables(t)

	createLogForFilterTest(t, &Log{
		UserId:      11,
		CreatedAt:   1_700_000_100,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-exact",
		RequestPath: "/v1/chat/completions",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions"}),
	})
	createLogForFilterTest(t, &Log{
		UserId:      11,
		CreatedAt:   1_700_000_101,
		Type:        LogTypeConsume,
		TokenName:   "alpha",
		ModelName:   "gpt-4o-mini",
		Group:       "team-a",
		RequestId:   "req-prefix",
		RequestPath: "/v1/chat/completions/extra",
		Other:       common.MapToJsonStr(map[string]interface{}{"request_path": "/v1/chat/completions/extra"}),
	})

	userID := 11
	tx, err := applyLogFilters(LOG_DB.Model(&Log{}), LogFilter{
		UserID:      &userID,
		LogType:     LogTypeConsume,
		RequestPath: "/v1/chat/completions",
	})
	require.NoError(t, err)

	var logs []Log
	require.NoError(t, tx.Order("logs.id asc").Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, "req-exact", logs[0].RequestId)
	assert.Equal(t, "/v1/chat/completions", logs[0].RequestPath)
}
