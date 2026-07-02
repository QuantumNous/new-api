package model

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestParseIdentitySyncTablesRejectsUnknown(t *testing.T) {
	_, err := parseIdentitySyncTables("users,channels")
	require.Error(t, err)
}

func TestIdentitySyncerSyncsAndDeletesWhitelistedTables(t *testing.T) {
	remoteDB := newIdentitySyncTestDB(t)
	localDB := newIdentitySyncTestDB(t)

	require.NoError(t, remoteDB.Create(&User{
		Id:          1,
		Username:    "alice",
		Password:    "password",
		DisplayName: "Alice",
		Status:      1,
		Group:       "default",
		Quota:       100,
	}).Error)
	require.NoError(t, remoteDB.Create(&Token{
		Id:             10,
		UserId:         1,
		Key:            "remote-token",
		Status:         1,
		Name:           "remote",
		CreatedTime:    1000,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)
	require.NoError(t, remoteDB.Create(&Setup{
		ID:            1,
		Version:       "test",
		InitializedAt: 100,
	}).Error)

	require.NoError(t, localDB.Create(&Token{
		Id:          20,
		UserId:      1,
		Key:         "stale-token",
		Status:      1,
		Name:        "stale",
		CreatedTime: 900,
		ExpiredTime: -1,
	}).Error)

	syncer := &identitySyncer{
		config: identitySyncConfig{
			Tables: []identitySyncTableSpec{
				identitySyncAllowedTables["users"],
				identitySyncAllowedTables["setups"],
				identitySyncAllowedTables["tokens"],
			},
			BatchSize:       2,
			MaxRowsPerTable: 100,
			DeleteMissing:   true,
		},
		remoteDB: remoteDB,
		localDB:  localDB,
	}

	result, err := syncer.Sync(context.Background())
	require.NoError(t, err)
	require.True(t, result.DidWrite())

	var user User
	require.NoError(t, localDB.First(&user, 1).Error)
	require.Equal(t, "alice", user.Username)
	require.Equal(t, 100, user.Quota)

	var token Token
	require.NoError(t, localDB.First(&token, 10).Error)
	require.Equal(t, "remote-token", token.Key)
	require.True(t, token.UnlimitedQuota)

	var staleCount int64
	require.NoError(t, localDB.Model(&Token{}).Where("id = ?", 20).Count(&staleCount).Error)
	require.EqualValues(t, 0, staleCount)

	var setup Setup
	require.NoError(t, localDB.First(&setup, 1).Error)
	require.Equal(t, "test", setup.Version)
}

func TestIdentitySyncerSkipsOptionalMissingRemoteTable(t *testing.T) {
	remoteDB := newIdentitySyncTestDB(t)
	localDB := newIdentitySyncTestDB(t)
	require.NoError(t, remoteDB.Migrator().DropTable(&PasskeyCredential{}))

	syncer := &identitySyncer{
		config: identitySyncConfig{
			Tables:          []identitySyncTableSpec{identitySyncAllowedTables["passkey_credentials"]},
			BatchSize:       10,
			MaxRowsPerTable: 100,
			DeleteMissing:   true,
		},
		remoteDB: remoteDB,
		localDB:  localDB,
	}

	result, err := syncer.Sync(context.Background())
	require.NoError(t, err)
	require.Len(t, result.Tables, 1)
	require.True(t, result.Tables[0].Skipped)
}

func newIdentitySyncTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&User{},
		&Token{},
		&Setup{},
		&TwoFA{},
		&TwoFABackupCode{},
		&PasskeyCredential{},
		&CustomOAuthProvider{},
		&UserOAuthBinding{},
	))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetConnMaxLifetime(time.Minute)
	return db
}
