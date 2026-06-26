package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestEnrichTopupsWithUserInfoPreservesStoredCountry(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	DB = db

	require.NoError(t, db.Create(&User{
		Id:       1,
		Username: "u1",
		Email:    "u1@example.com",
		Country:  "IN",
		Language: "en",
	}).Error)
	require.NoError(t, db.Create(&TopUp{
		UserId:     1,
		TradeNo:    "CLINK-1",
		Country:    "US",
		Status:     "success",
		CreateTime: 1,
	}).Error)

	topups := []*TopUp{{UserId: 1, TradeNo: "CLINK-1"}}
	require.NoError(t, db.Where("trade_no = ?", "CLINK-1").Find(&topups).Error)

	EnrichTopupsWithUserInfo(topups)
	require.Equal(t, "US", topups[0].Country, "stored order country must not be overwritten by user.country")
	require.Equal(t, "u1@example.com", topups[0].Email)
}

func TestEnrichTopupsWithUserInfoLegacyEmptyCountry(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}))
	DB = db

	require.NoError(t, db.Create(&User{Id: 2, Username: "u2", Country: "JP"}).Error)
	require.NoError(t, db.Create(&TopUp{
		UserId:     2,
		TradeNo:    "legacy-1",
		Country:    "",
		Status:     "success",
		CreateTime: 1,
	}).Error)

	topups := []*TopUp{{UserId: 2, TradeNo: "legacy-1"}}
	require.NoError(t, db.Where("trade_no = ?", "legacy-1").Find(&topups).Error)

	EnrichTopupsWithUserInfo(topups)
	require.Empty(t, topups[0].Country, "must not fill country from live user profile")
}
