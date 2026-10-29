package model

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func useUserCacheMiniRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	server := miniredis.RunT(t)
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	oldSyncFrequency := common.SyncFrequency
	common.RedisEnabled = true
	common.SyncFrequency = 2
	common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		common.SyncFrequency = oldSyncFrequency
	})
	return server
}

func TestUserCacheReadsWithOneConnectionBorrow(t *testing.T) {
	useUserCacheMiniRedis(t)
	user := &UserBase{
		Id: 4301, Group: "default", Email: "cache@example.com", Quota: 1000,
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
		Username: "pipeline-user", Setting: `{"record_ip_log":true}`, AuthVersion: 3,
	}
	require.NoError(t, writeUserCache(user, true))
	before := common.RDB.PoolStats()
	got, err := GetUserCache(user.Id)
	require.NoError(t, err)
	after := common.RDB.PoolStats()
	assert.Equal(t, user, got)
	assert.EqualValues(t, 1, after.Hits+after.Misses-before.Hits-before.Misses)

	// Wallet reads must observe changes after the authentication snapshot.
	require.NoError(t, cacheDecrUserQuota(user.Id, 800))
	before = common.RDB.PoolStats()
	quota, err := GetUserQuota(user.Id, false)
	require.NoError(t, err)
	after = common.RDB.PoolStats()
	assert.Equal(t, 200, quota)
	assert.EqualValues(t, 1, after.Hits+after.Misses-before.Hits-before.Misses)
}

func TestUserCacheInvalidHashFallsBackToDatabase(t *testing.T) {
	for _, tc := range []struct{ name, field, value string }{
		{name: "missing hash"},
		{name: "wrong owner", field: "Id", value: "999999"},
		{name: "old schema", field: "CacheSchema", value: "1"},
		{name: "missing version", field: "AuthVersion", value: "0"},
		{name: "invalid version", field: "AuthVersion", value: "bad"},
		{name: "invalid quota", field: "Quota", value: "bad"},
		{name: "overflow quota", field: "Quota", value: "9223372036854775808"},
		{name: "invalid status", field: "Status", value: "bad"},
		{name: "invalid role", field: "Role", value: "bad"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			truncateTables(t)
			server := useUserCacheMiniRedis(t)
			user := User{Username: "authoritative-user", Group: "default", Quota: 100,
				Status: common.UserStatusEnabled, Role: common.RoleCommonUser, AuthVersion: 1}
			require.NoError(t, DB.Create(&user).Error)
			cached := user.ToBaseUser()
			cached.Username = "cached-user"
			require.NoError(t, writeUserCache(cached, true))
			if tc.field == "" {
				server.Del(getUserCacheKey(user.Id))
			} else {
				server.HSet(getUserCacheKey(user.Id), tc.field, tc.value)
			}
			got, err := GetUserCache(user.Id)
			require.NoError(t, err)
			assert.Equal(t, user.Username, got.Username)
			assert.Equal(t, user.Quota, got.Quota)
		})
	}
}

func TestUserCacheFallbackStillChecksPendingFence(t *testing.T) {
	truncateTables(t)
	server := useUserCacheMiniRedis(t)
	user := User{Username: "pending-fallback-user", Group: "default", Quota: 100,
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser, AuthVersion: 1}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, SetUserAuthVersionFence(user.Id, 2))
	for _, wrongType := range []bool{false, true} {
		if wrongType {
			require.NoError(t, server.Set(getUserCacheKey(user.Id), "not-a-hash"))
		}
		got, err := GetUserCache(user.Id)
		assert.ErrorIs(t, err, ErrUserAuthCachePending)
		assert.Nil(t, got)
	}
}

func TestUserCacheFailuresDoNotReturnSnapshot(t *testing.T) {
	server := useUserCacheMiniRedis(t)
	const userID = 4302
	require.NoError(t, writeUserCache(&UserBase{Id: userID, AuthVersion: 1}, true))
	require.NoError(t, server.Set(getUserAuthVersionKey(userID), "bad-version"))
	got, err := cacheGetUserBase(userID)
	require.Error(t, err)
	assert.Nil(t, got)

	// A failed database fallback must not populate an empty user snapshot.
	tx := DB.Begin()
	require.NoError(t, tx.Error)
	require.NoError(t, tx.Rollback().Error)
	oldDB := DB
	DB = tx
	t.Cleanup(func() { DB = oldDB })
	server.Del(getUserCacheKey(userID))
	got, err = GetUserCache(userID)
	require.Error(t, err)
	assert.Nil(t, got)
	assert.False(t, server.Exists(getUserCacheKey(userID)))
}

func TestUserAuthFenceRollbackExpiresAndRecovers(t *testing.T) {
	truncateTables(t)
	server := useUserCacheMiniRedis(t)

	user := User{
		Username:    "auth-fence-rollback",
		Password:    "password",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	tx := DB.Begin()
	require.NoError(t, tx.Error)
	next, err := IncrementUserAuthVersionWithTx(tx, user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 2, next)

	_, err = cacheGetUserBase(user.Id)
	assert.ErrorIs(t, err, ErrUserAuthCachePending)
	cacheTTL, err := common.RDB.TTL(t.Context(), getUserCacheKey(user.Id)).Result()
	require.NoError(t, err)
	fenceTTL, err := common.RDB.TTL(t.Context(), getUserAuthFenceKey(user.Id)).Result()
	require.NoError(t, err)
	assert.Greater(t, fenceTTL, cacheTTL)
	require.NoError(t, tx.Rollback().Error)

	server.FastForward(time.Duration(userAuthFenceTTLSeconds()+1) * time.Second)
	assert.False(t, server.Exists(getUserAuthFenceKey(user.Id)))
	committed, err := common.RDB.Get(t.Context(), getUserAuthVersionKey(user.Id)).Result()
	require.NoError(t, err)
	assert.Equal(t, "1", committed)

	cached, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 1, cached.AuthVersion)
}

func TestPendingUserAuthFenceRejectsStaleCacheWrite(t *testing.T) {
	server := useUserCacheMiniRedis(t)
	const userID = 4201
	require.NoError(t, SetUserAuthVersionFence(userID, 2))

	err := writeUserCache(&UserBase{
		Id: userID, Group: "default", Username: "stale", AuthVersion: 1,
	}, true)

	assert.ErrorIs(t, err, ErrUserAuthCachePending)
	assert.False(t, server.Exists(getUserCacheKey(userID)))
}

func TestUserAuthFieldUpdateRejectsVersionMismatch(t *testing.T) {
	useUserCacheMiniRedis(t)
	const userID = 4202
	require.NoError(t, writeUserCache(&UserBase{
		Id: userID, Group: "current", Username: "cached", AuthVersion: 3,
	}, true))

	err := updateUserCacheFieldAtVersion(userID, "Group", "stale", 2)

	assert.ErrorIs(t, err, ErrUserAuthCachePending)
	group, err := common.RDB.HGet(t.Context(), getUserCacheKey(userID), "Group").Result()
	require.NoError(t, err)
	assert.Equal(t, "current", group)
}

func TestRefreshUserGroupCacheRepairsDelayedSameVersionWrite(t *testing.T) {
	truncateTables(t)
	useUserCacheMiniRedis(t)

	user := User{
		Username:    "delayed-group-refresh",
		Password:    "password",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	firstSnapshotRead := make(chan struct{})
	releaseDelayedRefresh := make(chan struct{})
	var intercepted atomic.Bool
	const callbackName = "test:block_delayed_group_refresh"
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(*gorm.DB) {
		if intercepted.CompareAndSwap(false, true) {
			close(firstSnapshotRead)
			<-releaseDelayedRefresh
		}
	}))
	t.Cleanup(func() {
		_ = DB.Callback().Query().Remove(callbackName)
	})

	delayedResult := make(chan error, 1)
	go func() {
		delayedResult <- RefreshUserGroupCache(user.Id)
	}()
	<-firstSnapshotRead

	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("group", "pro").Error)
	require.NoError(t, RefreshUserGroupCache(user.Id))
	cached, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "pro", cached.Group)
	assert.EqualValues(t, 1, cached.AuthVersion)

	close(releaseDelayedRefresh)
	require.NoError(t, <-delayedResult)
	cached, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "pro", cached.Group)
	assert.EqualValues(t, 1, cached.AuthVersion)
}

func TestCommittedUserAuthVersionPermanentlyRejectsDelayedCacheFill(t *testing.T) {
	truncateTables(t)
	server := useUserCacheMiniRedis(t)

	user := User{
		Username:    "auth-fence-commit",
		Password:    "password",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	stale := *user.ToBaseUser()

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, err := IncrementUserAuthVersionWithTx(tx, user.Id)
		return err
	}))
	require.NoError(t, PublishUserAuthCache(user.Id))
	assert.False(t, server.Exists(getUserAuthFenceKey(user.Id)))
	committed, err := common.RDB.Get(t.Context(), getUserAuthVersionKey(user.Id)).Result()
	require.NoError(t, err)
	assert.Equal(t, "2", committed)

	server.FastForward(time.Duration(userAuthFenceTTLSeconds()+1) * time.Second)
	require.NoError(t, common.RedisDelKey(getUserCacheKey(user.Id)))
	err = writeUserCache(&stale, true)
	assert.True(t, errors.Is(err, ErrUserAuthCachePending))
	committed, err = common.RDB.Get(t.Context(), getUserAuthVersionKey(user.Id)).Result()
	require.NoError(t, err)
	assert.Equal(t, "2", committed)
}

func TestUserAuthVersionFenceAndCommittedFloorAreMonotonic(t *testing.T) {
	truncateTables(t)
	server := useUserCacheMiniRedis(t)

	const userID = 4101
	require.NoError(t, SetUserAuthVersionFence(userID, 5))
	require.NoError(t, SetUserAuthVersionFence(userID, 3))
	pending, err := common.RDB.Get(t.Context(), getUserAuthFenceKey(userID)).Result()
	require.NoError(t, err)
	assert.Equal(t, "5", pending)
	floor, err := getUserAuthVersionFloor(userID)
	require.NoError(t, err)
	assert.EqualValues(t, 5, floor)

	// Committing an older transaction must neither clear a newer pending fence
	// nor lower the effective deny floor.
	require.NoError(t, publishCommittedUserAuthVersion(userID, 3))
	pending, err = common.RDB.Get(t.Context(), getUserAuthFenceKey(userID)).Result()
	require.NoError(t, err)
	assert.Equal(t, "5", pending)
	floor, err = getUserAuthVersionFloor(userID)
	require.NoError(t, err)
	assert.EqualValues(t, 5, floor)

	require.NoError(t, publishCommittedUserAuthVersion(userID, 5))
	assert.False(t, server.Exists(getUserAuthFenceKey(userID)))
	committed, err := common.RDB.Get(t.Context(), getUserAuthVersionKey(userID)).Result()
	require.NoError(t, err)
	assert.Equal(t, "5", committed)

	require.NoError(t, publishCommittedUserAuthVersion(userID, 4))
	committed, err = common.RDB.Get(t.Context(), getUserAuthVersionKey(userID)).Result()
	require.NoError(t, err)
	assert.Equal(t, "5", committed)
}
