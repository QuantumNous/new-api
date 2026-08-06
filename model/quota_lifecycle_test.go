package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLifecycleQuotaStateSchemaAndUniqueScope(t *testing.T) {
	setupRecallLifecycleTestDB(t)

	require.True(t, DB.Migrator().HasTable(&QuotaLifecycleState{}))
	require.True(t, DB.Migrator().HasIndex(&QuotaLifecycleState{}, "idx_quota_lifecycle_scope"))
	require.Equal(t, "TEXT", recallLifecycleSQLiteColumnType(t, "quota_lifecycle_states", "source_data"))

	first := QuotaLifecycleState{
		UserId:       99,
		ScopeType:    QuotaLifecycleScopeUser,
		ScopeId:      "99",
		Cycle:        "2026-08",
		Balance:      1000,
		Threshold:    2000,
		Source:       "quota_scan",
		SourceData:   `{"balance":1000}`,
		StateVersion: 1,
	}
	require.NoError(t, DB.Create(&first).Error)

	duplicate := first
	duplicate.Id = 0
	err := DB.Create(&duplicate).Error
	require.Error(t, err)
}
