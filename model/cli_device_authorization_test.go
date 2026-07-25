package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCliDeviceAuthorizationTestDB(t *testing.T) {
	t.Helper()
	previousDB := DB
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/cli-device-authorization.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &CliDeviceAuthorization{}))
	DB = db
	t.Cleanup(func() {
		DB = previousDB
	})
}

func TestApproveCliDeviceAuthorizationWithTokenReusesSameDeviceToken(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	user := User{Username: "cli-user", Password: "password"}
	require.NoError(t, DB.Create(&user).Error)
	auth := CliDeviceAuthorization{
		DeviceCodeHash: "device-code-hash",
		UserCodeHash:   "user-code-hash",
		Status:         CliDeviceAuthorizationStatusPending,
		ClientName:     "flatkey-cli",
		ClientVersion:  "0.1.0",
		DeviceIdHash:   "device-id-hash",
		CreatedTime:    100,
		ExpiresAt:      700,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&auth))

	first, err := ApproveCliDeviceAuthorizationWithToken(
		auth.Id,
		user.Id,
		Token{
			Name:             "Flatkey CLI",
			Key:              "first-key",
			Status:           common.TokenStatusEnabled,
			CreatedTime:      101,
			AccessedTime:     101,
			ExpiredTime:      -1,
			UnlimitedQuota:   true,
			Source:           TokenSourceCLI,
			DeviceIdHash:     "device-id-hash",
			ClientName:       "flatkey-cli",
			ClientVersion:    "0.1.0",
			LastUsedClientAt: 101,
		},
		10,
		InviteRewardTriggerManualTokenCreate,
		101,
	)
	require.NoError(t, err)
	require.True(t, first.AuthorizationUpdated)
	require.True(t, first.TokenCreated)
	require.Equal(t, CliDeviceAuthorizationStatusApproved, first.Authorization.Status)
	require.Equal(t, first.Token.Id, first.Authorization.TokenId)

	secondAuth := CliDeviceAuthorization{
		DeviceCodeHash: "device-code-hash-2",
		UserCodeHash:   "user-code-hash-2",
		Status:         CliDeviceAuthorizationStatusPending,
		ClientName:     "flatkey-cli",
		ClientVersion:  "0.2.0",
		DeviceIdHash:   "device-id-hash",
		CreatedTime:    200,
		ExpiresAt:      800,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&secondAuth))
	second, err := ApproveCliDeviceAuthorizationWithToken(
		secondAuth.Id,
		user.Id,
		Token{
			Name:             "Flatkey CLI",
			Key:              "second-key",
			Status:           common.TokenStatusEnabled,
			CreatedTime:      201,
			AccessedTime:     201,
			ExpiredTime:      -1,
			UnlimitedQuota:   true,
			Source:           TokenSourceCLI,
			DeviceIdHash:     "device-id-hash",
			ClientName:       "flatkey-cli",
			ClientVersion:    "0.2.0",
			LastUsedClientAt: 201,
		},
		10,
		InviteRewardTriggerManualTokenCreate,
		201,
	)
	require.NoError(t, err)
	require.True(t, second.AuthorizationUpdated)
	require.False(t, second.TokenCreated)
	require.Equal(t, first.Token.Id, second.Token.Id)
	require.Equal(t, "first-key", second.Token.Key)
	require.Equal(t, "0.2.0", second.Token.ClientVersion)
	require.Equal(t, int64(201), second.Token.LastUsedClientAt)

	var tokenCount int64
	require.NoError(t, DB.Model(&Token{}).Count(&tokenCount).Error)
	require.Equal(t, int64(1), tokenCount)
}

func TestConsumeCliDeviceAuthorizationReturnsKeyOnlyOnce(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	user := User{Username: "cli-consume-user", Password: "password"}
	require.NoError(t, DB.Create(&user).Error)
	token := Token{
		UserId:         user.Id,
		Name:           "Flatkey CLI",
		Key:            "consume-key",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	require.NoError(t, DB.Create(&token).Error)
	auth := CliDeviceAuthorization{
		DeviceCodeHash: "consume-device-code-hash",
		UserCodeHash:   "consume-user-code-hash",
		Status:         CliDeviceAuthorizationStatusApproved,
		UserId:         user.Id,
		TokenId:        token.Id,
		DeviceIdHash:   "consume-device-id-hash",
		CreatedTime:    100,
		ExpiresAt:      700,
		ApprovedAt:     101,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&auth))

	first, err := ConsumeCliDeviceAuthorization("consume-device-code-hash", 200)
	require.NoError(t, err)
	require.True(t, first.Consumed)
	require.Equal(t, token.Id, first.Token.Id)
	require.Equal(t, int64(200), first.Authorization.ConsumedAt)

	second, err := ConsumeCliDeviceAuthorization("consume-device-code-hash", 201)
	require.NoError(t, err)
	require.False(t, second.Consumed)
	require.Zero(t, second.Token.Id)
	require.Equal(t, int64(200), second.Authorization.ConsumedAt)
}

func TestConsumeCliDeviceAuthorizationExpiresUnconsumedApprovedCode(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	user := User{Username: "cli-expired-user", Password: "password"}
	require.NoError(t, DB.Create(&user).Error)
	token := Token{
		UserId:         user.Id,
		Name:           "Flatkey CLI",
		Key:            "expired-key",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	require.NoError(t, DB.Create(&token).Error)
	auth := CliDeviceAuthorization{
		DeviceCodeHash: "expired-device-code-hash",
		UserCodeHash:   "expired-user-code-hash",
		Status:         CliDeviceAuthorizationStatusApproved,
		UserId:         user.Id,
		TokenId:        token.Id,
		DeviceIdHash:   "expired-device-id-hash",
		CreatedTime:    100,
		ExpiresAt:      200,
		ApprovedAt:     101,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&auth))

	consumption, err := ConsumeCliDeviceAuthorization("expired-device-code-hash", 201)
	require.NoError(t, err)
	require.False(t, consumption.Consumed)
	require.Zero(t, consumption.Token.Id)
	require.Equal(t, CliDeviceAuthorizationStatusExpired, consumption.Authorization.Status)
}

func TestDenyCliDeviceAuthorizationReturnsPersistedApprovedState(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	auth := CliDeviceAuthorization{
		DeviceCodeHash: "approved-device-code-hash",
		UserCodeHash:   "approved-user-code-hash",
		Status:         CliDeviceAuthorizationStatusApproved,
		UserId:         1,
		TokenId:        2,
		DeviceIdHash:   "approved-device-id-hash",
		CreatedTime:    100,
		ExpiresAt:      700,
		ApprovedAt:     101,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&auth))

	denied, err := DenyCliDeviceAuthorization(auth.Id, 200)
	require.NoError(t, err)
	require.Equal(t, CliDeviceAuthorizationStatusApproved, denied.Status)
	require.Equal(t, 2, denied.TokenId)
}

func TestExpireCliDeviceAuthorizationReturnsPersistedApprovedState(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	auth := CliDeviceAuthorization{
		DeviceCodeHash: "expire-approved-device-code-hash",
		UserCodeHash:   "expire-approved-user-code-hash",
		Status:         CliDeviceAuthorizationStatusApproved,
		UserId:         1,
		TokenId:        2,
		DeviceIdHash:   "expire-approved-device-id-hash",
		CreatedTime:    100,
		ExpiresAt:      100,
		ApprovedAt:     101,
	}
	require.NoError(t, CreateCliDeviceAuthorization(&auth))

	expired, err := ExpireCliDeviceAuthorization(auth.Id, 200)
	require.NoError(t, err)
	require.Equal(t, CliDeviceAuthorizationStatusApproved, expired.Status)
	require.Equal(t, 2, expired.TokenId)
}

func TestCleanupExpiredCliDeviceAuthorizationsDeletesOnlyTerminalOldRows(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	rows := []CliDeviceAuthorization{
		{DeviceCodeHash: "old-denied", UserCodeHash: "old-denied-user", Status: CliDeviceAuthorizationStatusDenied, ExpiresAt: 100},
		{DeviceCodeHash: "old-consumed", UserCodeHash: "old-consumed-user", Status: CliDeviceAuthorizationStatusApproved, ExpiresAt: 100, ConsumedAt: 101},
		{DeviceCodeHash: "old-pending", UserCodeHash: "old-pending-user", Status: CliDeviceAuthorizationStatusPending, ExpiresAt: 100},
		{DeviceCodeHash: "new-denied", UserCodeHash: "new-denied-user", Status: CliDeviceAuthorizationStatusDenied, ExpiresAt: 300},
	}
	for i := range rows {
		require.NoError(t, CreateCliDeviceAuthorization(&rows[i]))
	}

	deleted, err := CleanupExpiredCliDeviceAuthorizations(200, 10)
	require.NoError(t, err)
	require.Equal(t, int64(3), deleted)

	var remaining []CliDeviceAuthorization
	require.NoError(t, DB.Order("device_code_hash").Find(&remaining).Error)
	require.Len(t, remaining, 1)
	require.Equal(t, "new-denied", remaining[0].DeviceCodeHash)
}

func TestCleanupExpiredCliDeviceAuthorizationsHonorsBatchLimit(t *testing.T) {
	setupCliDeviceAuthorizationTestDB(t)
	for i := 0; i < 3; i++ {
		require.NoError(t, CreateCliDeviceAuthorization(&CliDeviceAuthorization{
			DeviceCodeHash: "batch-old-device-code-hash-" + string(rune('a'+i)),
			UserCodeHash:   "batch-old-user-code-hash-" + string(rune('a'+i)),
			Status:         CliDeviceAuthorizationStatusDenied,
			ExpiresAt:      100,
		}))
	}

	deleted, err := CleanupExpiredCliDeviceAuthorizations(200, 2)
	require.NoError(t, err)
	require.Equal(t, int64(2), deleted)

	var count int64
	require.NoError(t, DB.Model(&CliDeviceAuthorization{}).Count(&count).Error)
	require.Equal(t, int64(1), count)
}
