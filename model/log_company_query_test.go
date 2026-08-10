package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func prepareCompanyLogQueryTest(t *testing.T) {
	t.Helper()
	require.NoError(t, LOG_DB.AutoMigrate(&CompanyLogSchema{}))
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs").Error)
	require.NoError(t, LOG_DB.Exec("DELETE FROM logs_company").Error)
	t.Cleanup(func() {
		LOG_DB.Exec("DELETE FROM logs")
		LOG_DB.Exec("DELETE FROM logs_company")
	})
}

func TestLogQueriesSelectOneTableForListsAndStats(t *testing.T) {
	prepareCompanyLogQueryTest(t)
	createdAt := time.Now().Unix()
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: 1, CreatedAt: createdAt, Type: LogTypeConsume,
		Content: "default", Quota: 11, PromptTokens: 2, CompletionTokens: 3,
	}).Error)
	require.NoError(t, LOG_DB.Create(&CompanyLogSchema{
		UserId: 1, CreatedAt: createdAt, Type: LogTypeConsume,
		Content: "company", Quota: 23, PromptTokens: 5, CompletionTokens: 7,
	}).Error)

	defaultLogs, defaultTotal, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", 0, "", 0, 20, 0, "", "", "", 0, false)
	require.NoError(t, err)
	require.Equal(t, int64(1), defaultTotal)
	require.Len(t, defaultLogs, 1)
	require.Equal(t, "default", defaultLogs[0].Content)

	companyLogs, companyTotal, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", 0, "", 0, 20, 0, "", "", "", 0, true)
	require.NoError(t, err)
	require.Equal(t, int64(1), companyTotal)
	require.Len(t, companyLogs, 1)
	require.Equal(t, "company", companyLogs[0].Content)

	defaultSelfLogs, defaultSelfTotal, err := GetUserLogs(1, LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "", false)
	require.NoError(t, err)
	require.Equal(t, int64(1), defaultSelfTotal)
	require.Len(t, defaultSelfLogs, 1)
	require.Equal(t, "default", defaultSelfLogs[0].Content)

	companySelfLogs, companySelfTotal, err := GetUserLogs(1, LogTypeUnknown, 0, 0, "", "", 0, 20, "", "", "", true)
	require.NoError(t, err)
	require.Equal(t, int64(1), companySelfTotal)
	require.Len(t, companySelfLogs, 1)
	require.Equal(t, "company", companySelfLogs[0].Content)

	defaultStat, err := SumUsedQuota(LogTypeUnknown, 0, 0, "", "", 0, "", 0, "", 0, 0, false)
	require.NoError(t, err)
	require.Equal(t, Stat{Quota: 11, Rpm: 1, Tpm: 5}, defaultStat)

	companyStat, err := SumUsedQuota(LogTypeUnknown, 0, 0, "", "", 0, "", 0, "", 0, 1, true)
	require.NoError(t, err)
	require.Equal(t, Stat{Quota: 23, Rpm: 1, Tpm: 12}, companyStat)
}

func TestGetAllCompanyLogsCapsTotalWithoutResettingSelectedTable(t *testing.T) {
	prepareCompanyLogQueryTest(t)

	defaultLogs := make([]Log, logSearchCountLimit+1)
	companyLogs := make([]CompanyLogSchema, logSearchCountLimit+1)
	for i := range defaultLogs {
		defaultLogs[i] = Log{UserId: 1, Type: LogTypeConsume, CreatedAt: int64(i + 1)}
		companyLogs[i] = CompanyLogSchema{UserId: 1, Type: LogTypeConsume, CreatedAt: int64(i + 1)}
	}
	require.NoError(t, LOG_DB.CreateInBatches(&defaultLogs, 500).Error)
	require.NoError(t, LOG_DB.CreateInBatches(&companyLogs, 500).Error)

	_, defaultTotal, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", 0, "", 0, 1, 0, "", "", "", 0, false)
	require.NoError(t, err)
	require.Equal(t, int64(logSearchCountLimit+1), defaultTotal)

	got, companyTotal, err := GetAllLogs(LogTypeUnknown, 0, 0, "", "", 0, "", 0, 1, 0, "", "", "", 0, true)
	require.NoError(t, err)
	require.Equal(t, int64(logSearchCountLimit), companyTotal)
	require.Len(t, got, 1)
}
