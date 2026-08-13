package model

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func enableSinglePrimaryAPIKeyMode(t *testing.T) {
	t.Helper()
	previous := common.SinglePrimaryAPIKeyEnabled
	common.SinglePrimaryAPIKeyEnabled = true
	t.Cleanup(func() { common.SinglePrimaryAPIKeyEnabled = previous })
}

func insertSingleKeyTestUser(t *testing.T, role int) *User {
	t.Helper()
	user := &User{
		Username:    "single-key-test",
		Password:    "unused-password",
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func clearSingleKeyTestTables(t *testing.T) {
	t.Helper()
	for _, table := range []string{"auth_flows", "user_sessions", "tokens", "users"} {
		require.NoError(t, DB.Exec("DELETE FROM "+table).Error)
	}
}

func newSingleKeyTestToken(userID int, key string) *Token {
	return &Token{
		UserId:         userID,
		Key:            key,
		Name:           "primary key",
		Status:         common.TokenStatusEnabled,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
}

func TestSinglePrimaryAPIKeyInsertSerializesConcurrentOrdinaryUsers(t *testing.T) {
	truncateTables(t)
	enableSinglePrimaryAPIKeyMode(t)
	user := insertSingleKeyTestUser(t, common.RoleCommonUser)

	const attempts = 8
	errs := make(chan error, attempts)
	var wg sync.WaitGroup
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			errs <- newSingleKeyTestToken(user.Id, "concurrent-key-"+string(rune('a'+index))).Insert()
		}(i)
	}
	wg.Wait()
	close(errs)

	successes := 0
	for err := range errs {
		if err == nil {
			successes++
		}
	}
	assert.Equal(t, 1, successes)
	count, err := CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
}

func TestSinglePrimaryAPIKeyKeepsAdminMultiKeyCompatibility(t *testing.T) {
	truncateTables(t)
	enableSinglePrimaryAPIKeyMode(t)
	user := insertSingleKeyTestUser(t, common.RoleAdminUser)

	require.NoError(t, newSingleKeyTestToken(user.Id, "admin-key-one").Insert())
	require.NoError(t, newSingleKeyTestToken(user.Id, "admin-key-two").Insert())

	count, err := CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 2, count)
	_, err = ValidateUserTokenForLogin("admin-key-one")
	require.NoError(t, err)
	_, err = ValidateUserTokenForLogin("admin-key-two")
	require.NoError(t, err)
	_, err = ValidatePrimaryUserTokenForLogin("admin-key-one")
	require.NoError(t, err)
}

func TestValidatePrimaryUserTokenForLoginRejectsGuestRole(t *testing.T) {
	truncateTables(t)
	enableSinglePrimaryAPIKeyMode(t)
	user := insertSingleKeyTestUser(t, common.RoleGuestUser)
	require.NoError(t, newSingleKeyTestToken(user.Id, "guest-api-key").Insert())

	_, err := ValidatePrimaryUserTokenForLogin("guest-api-key")
	assert.ErrorIs(t, err, ErrTokenInvalid)
}

func TestValidatePrimaryUserTokenForLoginStatusMatrix(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		expiredAt  int64
		wantAccept bool
	}{
		{name: "enabled", status: common.TokenStatusEnabled, expiredAt: -1, wantAccept: true},
		{name: "exhausted", status: common.TokenStatusExhausted, expiredAt: -1, wantAccept: true},
		{name: "disabled", status: common.TokenStatusDisabled, expiredAt: -1},
		{name: "expired status", status: common.TokenStatusExpired, expiredAt: -1},
		{name: "unknown status", status: 99, expiredAt: -1},
		{name: "past expiry", status: common.TokenStatusEnabled, expiredAt: time.Now().Add(-time.Minute).Unix()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clearSingleKeyTestTables(t)
			enableSinglePrimaryAPIKeyMode(t)
			user := insertSingleKeyTestUser(t, common.RoleCommonUser)
			key := "status-key-" + tt.name
			token := newSingleKeyTestToken(user.Id, key)
			token.Status = tt.status
			token.ExpiredTime = tt.expiredAt
			require.NoError(t, DB.Create(token).Error)

			_, err := ValidatePrimaryUserTokenForLogin(key)
			if tt.wantAccept {
				require.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, ErrTokenInvalid)
			}
		})
	}
}

func TestRotatePrimaryTokenPreservesSingleKeyAndBumpsAuthVersion(t *testing.T) {
	truncateTables(t)
	enableSinglePrimaryAPIKeyMode(t)
	user := insertSingleKeyTestUser(t, common.RoleCommonUser)
	oldKey := "rotation-old-key"
	require.NoError(t, newSingleKeyTestToken(user.Id, oldKey).Insert())

	rotated, err := RotatePrimaryTokenByUserID(user.Id)
	require.NoError(t, err)
	require.NotEmpty(t, rotated.Key)
	assert.NotEqual(t, oldKey, rotated.Key)

	count, err := CountUserTokens(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	_, err = ValidateUserTokenForLogin(oldKey)
	assert.ErrorIs(t, err, ErrTokenInvalid)
	_, err = ValidatePrimaryUserTokenForLogin(rotated.Key)
	require.NoError(t, err)

	var updated User
	require.NoError(t, DB.First(&updated, user.Id).Error)
	assert.EqualValues(t, 2, updated.AuthVersion)
}

func TestRotatePrimaryTokenRejectsPrivilegedRoles(t *testing.T) {
	for _, tc := range []struct {
		name string
		role int
	}{
		{name: "admin", role: common.RoleAdminUser},
		{name: "root", role: common.RoleRootUser},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			user := insertSingleKeyTestUser(t, tc.role)
			_, err := RotatePrimaryTokenByUserIDTx(DB, user.Id)
			assert.Error(t, err)
		})
	}
}

func TestFinalizePrimaryTokenRotationReturnsKeyWhenDeliveryFails(t *testing.T) {
	oldPublish, oldRevoke := primaryTokenRotationPublishAuthCache, primaryTokenRotationRevokeSessions
	t.Cleanup(func() {
		primaryTokenRotationPublishAuthCache, primaryTokenRotationRevokeSessions = oldPublish, oldRevoke
	})
	publishCalled, revokeCalled := false, false
	primaryTokenRotationPublishAuthCache = func(int) error {
		publishCalled = true
		return errors.New("cache unavailable")
	}
	primaryTokenRotationRevokeSessions = func(int, string) (int64, error) {
		revokeCalled = true
		return 0, errors.New("session store unavailable")
	}
	token := &Token{Key: "new-primary-key"}
	err := FinalizePrimaryTokenRotation(42, token, "test")
	var deliveryErr *PrimaryTokenRotationDeliveryError
	require.ErrorAs(t, err, &deliveryErr)
	assert.Equal(t, token.GetFullKey(), deliveryErr.FullKey())
	assert.NotEmpty(t, deliveryErr.Warning())
	assert.True(t, publishCalled)
	assert.True(t, revokeCalled)
}
