package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func sqliteColumnTypeForQuotaTest(t *testing.T, tableName string, columnName string) string {
	t.Helper()
	var rows []struct {
		Name string `gorm:"column:name"`
		Type string `gorm:"column:type"`
	}
	require.NoError(t, DB.Raw(fmt.Sprintf("PRAGMA table_info(`%s`)", tableName)).Scan(&rows).Error)
	for _, row := range rows {
		if row.Name == columnName {
			return strings.ToLower(row.Type)
		}
	}
	t.Fatalf("column %s.%s not found", tableName, columnName)
	return ""
}

func TestQuotaColumnsUseBigint(t *testing.T) {
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "used_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "users", "aff_history"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tokens", "remain_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tokens", "used_quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "logs", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "redemptions", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "quota_data", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "tasks", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "midjourneys", "quota"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "checkins", "quota_awarded"))
	require.Equal(t, "bigint", sqliteColumnTypeForQuotaTest(t, "channels", "used_quota"))
}

func TestUserQuotaStoresAboveInt32(t *testing.T) {
	truncateTables(t)

	const largeQuota int64 = 3_000_000_000
	user := &User{
		Id:       61001,
		Username: "large_quota_user",
		Status:   1,
		Quota:    largeQuota,
	}
	require.NoError(t, DB.Create(user).Error)

	got, err := GetUserQuota(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, largeQuota, got)

	require.NoError(t, IncreaseUserQuota(user.Id, largeQuota, true))
	got, err = GetUserQuota(user.Id, true)
	require.NoError(t, err)
	require.Equal(t, largeQuota*2, got)
}
