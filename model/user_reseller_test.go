package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupResellerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &ResellerModelRule{}))
	DB = db
	return db
}

func TestUpdateUserResellerProfileValidatesHierarchy(t *testing.T) {
	db := setupResellerTestDB(t)
	require.NoError(t, db.Create(&User{Id: 1, Username: "reseller", AffCode: "r1", IsReseller: true}).Error)
	require.NoError(t, db.Create(&User{Id: 2, Username: "downline", AffCode: "d2"}).Error)
	require.NoError(t, db.Create(&User{Id: 3, Username: "normal", AffCode: "n3"}).Error)

	require.NoError(t, UpdateUserResellerProfile(2, false, 1))

	var downline User
	require.NoError(t, db.Select("id, reseller_user_id").Where("id = ?", 2).First(&downline).Error)
	require.Equal(t, 1, downline.ResellerUserId)

	require.Error(t, UpdateUserResellerProfile(1, true, 3))
	require.Error(t, UpdateUserResellerProfile(2, false, 3))
	require.Error(t, UpdateUserResellerProfile(2, false, 2))
}

func TestEnsureResellerDownline(t *testing.T) {
	db := setupResellerTestDB(t)
	require.NoError(t, db.Create(&User{Id: 1, Username: "reseller", AffCode: "r1", IsReseller: true}).Error)
	require.NoError(t, db.Create(&User{Id: 2, Username: "downline", AffCode: "d2", ResellerUserId: 1}).Error)
	require.NoError(t, db.Create(&User{Id: 3, Username: "other", AffCode: "o3"}).Error)

	require.NoError(t, EnsureResellerDownline(1, 2))
	require.Error(t, EnsureResellerDownline(1, 3))
	require.Error(t, EnsureResellerDownline(3, 2))
}
