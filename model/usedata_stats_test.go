package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestGetUserModelStatsByModel_AggregatesAcrossGroups(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&User{}, &QuotaData{}))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()

	t.Cleanup(func() {
		DB.Exec("DELETE FROM quota_data")
		DB.Exec("DELETE FROM users")
	})

	u1 := &User{Username: "u1", Password: "password123", Group: "default", Role: 1, Status: 1, AffCode: "aff_u1"}
	u2 := &User{Username: "u2", Password: "password123", Group: "vip", Role: 1, Status: 1, AffCode: "aff_u2"}
	require.NoError(t, DB.Create(u1).Error)
	require.NoError(t, DB.Create(u2).Error)

	require.NoError(t, DB.Create(&QuotaData{UserID: u1.Id, Username: u1.Username, ModelName: "gpt-4o", CreatedAt: 1000, Count: 2, TokenUsed: 200, Quota: 20}).Error)
	require.NoError(t, DB.Create(&QuotaData{UserID: u2.Id, Username: u2.Username, ModelName: "gpt-4o", CreatedAt: 1000, Count: 3, TokenUsed: 300, Quota: 30}).Error)

	items, total, err := GetUserModelStatsByModel(0, 2000, nil, nil, "", nil, 1, 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, items, 1)
	require.Equal(t, "gpt-4o", items[0].ModelName)
	require.Equal(t, 5, items[0].Count)
	require.Equal(t, 500, items[0].TokenUsed)
	require.Equal(t, 50, items[0].Quota)
}

func TestGetUserModelStatsByModel_FilterByGroup(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&User{}, &QuotaData{}))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()

	t.Cleanup(func() {
		DB.Exec("DELETE FROM quota_data")
		DB.Exec("DELETE FROM users")
	})

	u1 := &User{Username: "u1g", Password: "password123", Group: "default", Role: 1, Status: 1, AffCode: "aff_u1g"}
	u2 := &User{Username: "u2g", Password: "password123", Group: "vip", Role: 1, Status: 1, AffCode: "aff_u2g"}
	require.NoError(t, DB.Create(u1).Error)
	require.NoError(t, DB.Create(u2).Error)

	require.NoError(t, DB.Create(&QuotaData{UserID: u1.Id, Username: u1.Username, ModelName: "claude-3-5-sonnet", CreatedAt: 1000, Count: 1, TokenUsed: 100, Quota: 10}).Error)
	require.NoError(t, DB.Create(&QuotaData{UserID: u2.Id, Username: u2.Username, ModelName: "claude-3-5-sonnet", CreatedAt: 1000, Count: 4, TokenUsed: 400, Quota: 40}).Error)

	items, total, err := GetUserModelStatsByModel(0, 2000, nil, nil, "vip", nil, 1, 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, items, 1)
	require.Equal(t, "claude-3-5-sonnet", items[0].ModelName)
	require.Equal(t, 4, items[0].Count)
	require.Equal(t, 400, items[0].TokenUsed)
	require.Equal(t, 40, items[0].Quota)
}

func TestGetUserModelStats_ExcludesDeletedUsers(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&User{}, &QuotaData{}))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	initCol()

	t.Cleanup(func() {
		DB.Exec("DELETE FROM quota_data")
		DB.Exec("DELETE FROM users")
	})

	activeUser := &User{Username: "active_stats", Password: "password123", Group: "default", Role: 1, Status: common.UserStatusEnabled, AffCode: "aff_active_stats"}
	deletedUser := &User{Username: "deleted_stats", Password: "password123", Group: "default", Role: 1, Status: common.UserStatusEnabled, AffCode: "aff_deleted_stats"}
	require.NoError(t, DB.Create(activeUser).Error)
	require.NoError(t, DB.Create(deletedUser).Error)
	require.NoError(t, DB.Delete(deletedUser).Error)

	require.NoError(t, DB.Create(&QuotaData{UserID: activeUser.Id, Username: activeUser.Username, ModelName: "gpt-4o", CreatedAt: 1000, Count: 2, TokenUsed: 200, Quota: 20}).Error)
	require.NoError(t, DB.Create(&QuotaData{UserID: deletedUser.Id, Username: deletedUser.Username, ModelName: "gpt-4o", CreatedAt: 1000, Count: 3, TokenUsed: 300, Quota: 30}).Error)

	userItems, userTotal, err := GetUserModelStatsByUser(0, 2000, nil, nil, "", nil, 1, 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, userTotal)
	require.Len(t, userItems, 1)
	require.Equal(t, activeUser.Username, userItems[0].Username)
	require.Equal(t, 2, userItems[0].Count)

	modelItems, modelTotal, err := GetUserModelStatsByModel(0, 2000, nil, nil, "", nil, 1, 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, modelTotal)
	require.Len(t, modelItems, 1)
	require.Equal(t, 2, modelItems[0].Count)
	require.Equal(t, 200, modelItems[0].TokenUsed)
	require.Equal(t, 20, modelItems[0].Quota)

	detailItems, detailTotal, err := GetUserModelStatsByDetail(0, 2000, nil, nil, "", nil, 1, 20)
	require.NoError(t, err)
	require.EqualValues(t, 1, detailTotal)
	require.Len(t, detailItems, 1)
	require.Equal(t, activeUser.Username, detailItems[0].Username)
	require.Equal(t, 2, detailItems[0].Count)
}
