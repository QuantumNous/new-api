package model

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBuildLogContainsConditionEscapesLiterals(t *testing.T) {
	originalLogDatabaseType := common.LogDatabaseType()
	t.Cleanup(func() {
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	for _, databaseType := range []common.DatabaseType{
		common.DatabaseTypeSQLite,
		common.DatabaseTypeMySQL,
		common.DatabaseTypePostgreSQL,
	} {
		common.SetLogDatabaseType(databaseType)
		condition, pattern, err := buildLogContainsCondition("logs.model_name", `gpt_4%!mini\`)
		require.NoError(t, err)

		assert.Equal(t, "logs.model_name LIKE ? ESCAPE '!'", condition)
		assert.Equal(t, `%gpt!_4!%!!mini\%`, pattern)
	}

	common.SetLogDatabaseType(common.DatabaseTypeClickHouse)
	condition, pattern, err := buildLogContainsCondition("logs.model_name", `gpt_4%!mini\`)
	require.NoError(t, err)
	assert.Equal(t, "logs.model_name LIKE ?", condition)
	assert.Equal(t, `%gpt\_4\%!mini\\%`, pattern)

	condition, pattern, err = buildLogContainsCondition("logs.model_name", "   ")
	require.NoError(t, err)
	assert.Empty(t, condition)
	assert.Empty(t, pattern)

	_, _, err = buildLogContainsCondition("logs.model_name", "a")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "at least 2")
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	_, pattern, err = buildLogContainsCondition("logs.model_name", "a_")
	require.NoError(t, err)
	assert.Equal(t, "%a!_%", pattern)

	_, _, err = buildLogContainsCondition(
		"logs.model_name",
		strings.Repeat("a", logModelNameSearchMaxLen+1),
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "limited")
}

func TestLogModelNameFilterModes(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))

	originalLogDB := LOG_DB
	originalLogDatabaseType := common.LogDatabaseType()
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = originalLogDB
		common.SetLogDatabaseType(originalLogDatabaseType)
	})

	createdAt := time.Now().Unix()
	seed := []Log{
		{UserId: 42, CreatedAt: createdAt, Type: LogTypeConsume, ModelName: "gpt-4", Quota: 10, PromptTokens: 2, CompletionTokens: 3},
		{UserId: 42, CreatedAt: createdAt, Type: LogTypeConsume, ModelName: "gpt-4o", Quota: 20, PromptTokens: 4, CompletionTokens: 6},
		{UserId: 42, CreatedAt: createdAt, Type: LogTypeConsume, ModelName: "vendor-gpt-4-mini", Quota: 30, PromptTokens: 8, CompletionTokens: 9},
		{UserId: 42, CreatedAt: createdAt, Type: LogTypeConsume, ModelName: "literal_100%", Quota: 40},
	}
	require.NoError(t, db.Create(&seed).Error)

	containsLogs, containsTotal, err := GetAllLogsWithModelNameMode(
		LogTypeUnknown, 0, 0, "gpt-4", logModelNameModeContains,
		"", "", 0, 100, 0, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(3), containsTotal)
	assert.Len(t, containsLogs, 3)

	exactLogs, exactTotal, err := GetUserLogsWithModelNameMode(
		42, LogTypeUnknown, 0, 0, "gpt-4", logModelNameModeExact,
		"", 0, 100, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), exactTotal)
	require.Len(t, exactLogs, 1)
	assert.Equal(t, "gpt-4", exactLogs[0].ModelName)

	zeroUserLogs, zeroUserTotal, err := GetUserLogsWithModelNameMode(
		0, LogTypeUnknown, 0, 0, "gpt-4", logModelNameModeContains,
		"", 0, 100, "", "", "",
	)
	require.NoError(t, err)
	assert.Zero(t, zeroUserTotal)
	assert.Empty(t, zeroUserLogs)

	// The legacy wrapper keeps exact matching when no mode is supplied.
	legacyLogs, legacyTotal, err := GetAllLogs(
		LogTypeUnknown, 0, 0, "gpt-4", "", "", 0, 100, 0, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), legacyTotal)
	assert.Len(t, legacyLogs, 1)

	// Explicit % remains supported for callers using the legacy API.
	wildcardLogs, wildcardTotal, err := GetAllLogs(
		LogTypeUnknown, 0, 0, "gpt-4%", "", "", 0, 100, 0, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(2), wildcardTotal)
	assert.Len(t, wildcardLogs, 2)

	literalPercentLogs, literalPercentTotal, err := GetUserLogsWithModelNameMode(
		42, LogTypeUnknown, 0, 0, "literal_100%", logModelNameModeExact,
		"", 0, 100, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), literalPercentTotal)
	require.Len(t, literalPercentLogs, 1)
	assert.Equal(t, "literal_100%", literalPercentLogs[0].ModelName)

	_, literalContainsTotal, err := GetUserLogsWithModelNameMode(
		42, LogTypeUnknown, 0, 0, "_100%", logModelNameModeContains,
		"", 0, 100, "", "", "",
	)
	require.NoError(t, err)
	assert.Equal(t, int64(1), literalContainsTotal)

	stat, err := SumUsedQuotaWithModelNameMode(
		LogTypeUnknown, 0, 0, "gpt-4", logModelNameModeContains,
		"", "", 0, "",
	)
	require.NoError(t, err)
	assert.Equal(t, 60, stat.Quota)
	assert.Equal(t, 3, stat.Rpm)
	assert.Equal(t, 32, stat.Tpm)

	_, _, err = GetUserLogsWithModelNameMode(
		42, LogTypeUnknown, 0, 0, "gpt-4", "unsupported",
		"", 0, 100, "", "", "",
	)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "model_name_mode")
}
