package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func resetLogFilterTestData(t *testing.T) {
	t.Helper()
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs").Error)
}

func TestGetAllLogsAdditionalFilters(t *testing.T) {
	resetLogFilterTestData(t)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{
			UserId:            1,
			Username:          "alice",
			CreatedAt:         100,
			Type:              LogTypeConsume,
			Content:           "matched request",
			TokenName:         "token-a",
			ModelName:         "gpt-test",
			IsStream:          true,
			RequestId:         "req-a",
			UpstreamRequestId: "up-req-a",
			Other:             `{"billing_source":"wallet","reasoning_effort":"high","request_path":"/v1/chat/completions","session_id":"sess-a","status_code":200,"user_agent":"codex-cli"}`,
		},
		{
			UserId:    1,
			Username:  "alice",
			CreatedAt: 90,
			Type:      LogTypeError,
			Content:   "other request",
			TokenName: "token-b",
			ModelName: "gpt-test",
			IsStream:  false,
			Other:     `{"billing_source":"subscription","reasoning_effort":"low","request_path":"/v1/responses","session_id":"sess-b","status_code":404,"user_agent":"browser"}`,
		},
	}).Error)

	statusCode := 200
	isStream := true
	logs, total, err := GetAllLogs(LogSearchFilters{
		ModelName:       "gpt-test",
		Content:         "%request",
		Endpoint:        "/v1/chat",
		StatusCode:      &statusCode,
		SessionId:       "sess-a",
		UserAgent:       "codex",
		IsStream:        &isStream,
		ReasoningEffort: "high",
		BillingSource:   "wallet",
	}, 0, 10)

	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, logs, 1)
	require.Equal(t, "req-a", logs[0].RequestId)
}

func TestGetAllLogsStatusCode200IncludesConsumeLogsWithoutOtherStatus(t *testing.T) {
	resetLogFilterTestData(t)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{
			UserId:    1,
			Username:  "alice",
			CreatedAt: 100,
			Type:      LogTypeConsume,
			Content:   "consume without explicit status",
			Other:     `{}`,
		},
		{
			UserId:    1,
			Username:  "alice",
			CreatedAt: 90,
			Type:      LogTypeError,
			Content:   "error",
			Other:     `{"status_code":500}`,
		},
	}).Error)

	statusCode := 200
	logs, total, err := GetAllLogs(LogSearchFilters{StatusCode: &statusCode}, 0, 10)

	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, logs, 1)
	require.Equal(t, LogTypeConsume, logs[0].Type)
}
