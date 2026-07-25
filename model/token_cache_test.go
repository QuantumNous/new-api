package model

import (
	"context"
	"errors"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupTokenCacheRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr := miniredis.RunT(t)
	previousRDB := common.RDB
	previousRedisEnabled := common.RedisEnabled
	previousSyncFrequency := common.SyncFrequency
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	common.SyncFrequency = 60
	t.Cleanup(func() {
		require.NoError(t, common.RDB.Close())
		common.RDB = previousRDB
		common.RedisEnabled = previousRedisEnabled
		common.SyncFrequency = previousSyncFrequency
	})
	return mr
}

func setupTokenCacheDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := DB
	previousCommonKeyCol := commonKeyCol
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Token{}))
	DB = db
	commonKeyCol = "`key`"
	t.Cleanup(func() {
		DB = previousDB
		commonKeyCol = previousCommonKeyCol
	})
	return db
}

func testCachedToken(key string) Token {
	allowIps := "127.0.0.1\n10.0.0.1"
	return Token{
		Id:                 42,
		UserId:             7,
		Key:                key,
		Status:             common.TokenStatusEnabled,
		Name:               "cache-test",
		CreatedTime:        100,
		AccessedTime:       200,
		ExpiredTime:        -1,
		RemainQuota:        900,
		UnlimitedQuota:     false,
		ModelLimitsEnabled: true,
		ModelLimits:        "gpt-4o,gpt-4o-mini",
		AllowIps:           &allowIps,
		UsedQuota:          123,
		Group:              "paid",
		CrossGroupRetry:    true,
	}
}

func TestTokenCacheGuardedFillWritesCompleteHashWithTTL(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("complete-fill")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	require.NoError(t, cacheSetToken(token, fence))

	redisKey := redisTokenCacheKey(token.Key)
	hash, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	require.Equal(t, "1", hash[tokenCacheCompleteField])
	require.Equal(t, "42", hash["Id"])
	require.Equal(t, "900", hash["RemainQuota"])
	require.Equal(t, "true", hash["CrossGroupRetry"])
	require.Equal(t, "127.0.0.1\n10.0.0.1", hash["AllowIps"])
	require.NotContains(t, hash, "Key")
	require.NotContains(t, hash, "DeletedAt")
	require.Equal(t, 60*time.Second, mr.TTL(redisKey))

	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	require.Equal(t, token.Key, cached.Key)
	require.Equal(t, token.RemainQuota, cached.RemainQuota)
	require.Equal(t, token.Group, cached.Group)
}

func TestTokenCacheGuardedFillRefusesExistingHash(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("existing-hash")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	redisKey := redisTokenCacheKey(token.Key)
	mr.HSet(redisKey, "Name", "existing", tokenCacheCompleteField, "1")

	require.NoError(t, cacheSetToken(token, fence))

	hash, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	require.Equal(t, "existing", hash["Name"])
	require.NotContains(t, hash, "Id")
}

func TestTokenCacheLateFillCannotCrossInvalidation(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("late-fill")
	staleFence, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	// Simulate a DB read paused after capturing the fence. A mutation then
	// rotates the fence and deletes the hash before the read resumes.
	require.NoError(t, cacheDeleteToken(token.Key))
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.NotEqual(t, staleFence, currentFence)
	require.NoError(t, cacheSetToken(token, staleFence))
	require.False(t, mr.Exists(redisTokenCacheKey(token.Key)))
}

func TestTokenCacheInvalidationDeletesEarlierFill(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("fill-before-invalidate")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	require.True(t, mr.Exists(redisTokenCacheKey(token.Key)))

	require.NoError(t, cacheDeleteToken(token.Key))
	require.False(t, mr.Exists(redisTokenCacheKey(token.Key)))
}

func TestTokenCacheFenceMismatchFillIsNoOp(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("wrong-fence")
	_, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	require.NoError(t, cacheSetToken(token, "not-the-current-fence"))
	require.False(t, mr.Exists(redisTokenCacheKey(token.Key)))
}

func TestTokenCacheRejectsUnmarkedPartialHashAndRefills(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("partial-hash")
	redisKey := redisTokenCacheKey(token.Key)
	mr.HSet(redisKey, "RemainQuota", "1")

	_, err := cacheGetTokenByKey(token.Key)
	require.Error(t, err)
	require.False(t, mr.Exists(redisKey))

	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	require.Equal(t, token.RemainQuota, cached.RemainQuota)
}

func TestTokenCacheQuotaAndFieldUpdatesDoNotCreatePartialHash(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	key := "no-partial-quota"
	token := testCachedToken(key)
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	require.NoError(t, cacheDeleteToken(key))

	require.NoError(t, cacheIncrTokenQuota(key, 25))
	require.NoError(t, cacheSetTokenField(key, "Status", "2"))
	require.False(t, mr.Exists(redisTokenCacheKey(key)))
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.NotEmpty(t, currentFence)
}

func TestTokenCacheQuotaAndFieldUpdatesLeaveIncompleteAndWrongTypeEntriesUntouched(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	incompleteKey := redisTokenCacheKey("incomplete-mutation")
	wrongTypeKey := redisTokenCacheKey("wrong-type-mutation")
	mr.HSet(incompleteKey, "RemainQuota", "41")
	mr.Set(wrongTypeKey, "stale")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	require.NoError(t, cacheIncrTokenQuota("incomplete-mutation", 1))
	require.NoError(t, cacheSetTokenField("incomplete-mutation", "Status", "2"))
	require.NoError(t, cacheIncrTokenQuota("wrong-type-mutation", 1))
	require.NoError(t, cacheSetTokenField("wrong-type-mutation", "Status", "2"))

	require.Equal(t, "41", mr.HGet(incompleteKey, "RemainQuota"))
	require.Equal(t, "", mr.HGet(incompleteKey, "Status"))
	wrongTypeValue, err := mr.Get(wrongTypeKey)
	require.NoError(t, err)
	require.Equal(t, "stale", wrongTypeValue)
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.Equal(t, fence, currentFence)
}

func TestTokenCacheMissingQuotaUpdateIsNoOp(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("quota-during-miss")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	require.NoError(t, cacheIncrTokenQuota(token.Key, 25))
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.Equal(t, fence, currentFence)
	require.False(t, mr.Exists(redisTokenCacheKey(token.Key)))
	require.NoError(t, cacheSetToken(token, fence))
	require.True(t, mr.Exists(redisTokenCacheKey(token.Key)))
}

func TestTokenCacheQuotaUpdatePreservesCompleteHashAndTTL(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("marked-quota")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	redisKey := redisTokenCacheKey(token.Key)
	ttlBefore := mr.TTL(redisKey)
	fenceBefore, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)

	require.NoError(t, cacheIncrTokenQuota(token.Key, 25))

	hash, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	require.Equal(t, "925", hash["RemainQuota"])
	require.Equal(t, "cache-test", hash["Name"])
	require.Equal(t, "1", hash[tokenCacheCompleteField])
	require.Equal(t, ttlBefore, mr.TTL(redisKey))
	fenceAfter, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.Equal(t, fenceBefore, fenceAfter)
}

func TestTokenUpdateSynchronizesPrewarmedCacheFields(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	db := setupTokenCacheDB(t)
	token := testCachedToken("prewarmed-full-edit")
	require.NoError(t, db.Create(&token).Error)
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	redisKey := redisTokenCacheKey(token.Key)
	mr.HSet(redisKey, "UsedQuota", "777", "FutureField", "preserved")
	mr.SetTTL(redisKey, 41*time.Second)

	allowIps := "192.0.2.1"
	token.Name = "edited"
	token.Status = common.TokenStatusDisabled
	token.ExpiredTime = 999
	token.RemainQuota = 321
	token.UnlimitedQuota = true
	token.ModelLimitsEnabled = false
	token.ModelLimits = ""
	token.AllowIps = &allowIps
	token.Group = "premium"
	token.CrossGroupRetry = false
	require.NoError(t, token.Update())

	hash, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	require.Equal(t, "edited", hash["Name"])
	require.Equal(t, "2", hash["Status"])
	require.Equal(t, "999", hash["ExpiredTime"])
	require.Equal(t, "321", hash["RemainQuota"])
	require.Equal(t, "true", hash["UnlimitedQuota"])
	require.Equal(t, "false", hash["ModelLimitsEnabled"])
	require.Equal(t, "", hash["ModelLimits"])
	require.Equal(t, allowIps, hash["AllowIps"])
	require.Equal(t, "premium", hash["Group"])
	require.Equal(t, "false", hash["CrossGroupRetry"])
	require.Equal(t, "777", hash["UsedQuota"])
	require.Equal(t, "preserved", hash["FutureField"])
	require.Equal(t, "1", hash[tokenCacheCompleteField])
	require.Equal(t, 41*time.Second, mr.TTL(redisKey))
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.NotEqual(t, fence, currentFence)
}

func TestTokenSelectUpdateSynchronizesPrewarmedCacheFields(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	db := setupTokenCacheDB(t)
	token := testCachedToken("prewarmed-status-edit")
	require.NoError(t, db.Create(&token).Error)
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	redisKey := redisTokenCacheKey(token.Key)
	mr.SetTTL(redisKey, 29*time.Second)
	before, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)

	token.AccessedTime = 808
	token.Status = common.TokenStatusExhausted
	require.NoError(t, token.SelectUpdate())

	after, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	before["AccessedTime"] = "808"
	before["Status"] = "4"
	require.Equal(t, before, after)
	require.Equal(t, 29*time.Second, mr.TTL(redisKey))
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.NotEqual(t, fence, currentFence)
}

func TestTokenUpdateCachePatchDoesNotCrossLaterGroupFence(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("edit-after-group-fence")
	expectedFence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, expectedFence))
	redisKey := redisTokenCacheKey(token.Key)
	mr.SetTTL(redisKey, 33*time.Second)

	require.NoError(t, cachePatchTokenGroups([]string{token.Key}, "premium"))
	groupFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	token.Name = "late-edit"
	token.Group = "paid"
	result, err := cachePatchTokenAfterUpdate(token, expectedFence)
	require.NoError(t, err)
	require.Equal(t, tokenCacheMutationFenceMismatch, result)

	require.False(t, mr.Exists(redisKey))
	_, err = cacheGetTokenByKey(token.Key)
	require.Error(t, err)
	currentFence, err := mr.Get(tokenCacheFillFenceKey)
	require.NoError(t, err)
	require.NotEqual(t, groupFence, currentFence)
}

func TestTokenCacheGroupPatchPreservesCompleteHashQuotaMarkerAndTTL(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("group-patch-complete")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))
	redisKey := redisTokenCacheKey(token.Key)
	mr.HSet(redisKey, "RemainQuota", "777")
	mr.SetTTL(redisKey, 37*time.Second)
	before, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)

	require.NoError(t, cachePatchTokenGroups([]string{token.Key}, "premium"))

	hash, err := common.RDB.HGetAll(context.Background(), redisKey).Result()
	require.NoError(t, err)
	before["Group"] = "premium"
	require.Equal(t, before, hash)
	require.Equal(t, 37*time.Second, mr.TTL(redisKey))
}

func TestTokenCachePLGGroupPatchDisablesCrossGroupRetry(t *testing.T) {
	setupTokenCacheRedis(t)
	token := testCachedToken("plg-group-patch")
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))

	require.NoError(t, cachePatchTokenGroups([]string{token.Key}, plgUserGroup))

	hash, err := common.RDB.HGetAll(context.Background(), redisTokenCacheKey(token.Key)).Result()
	require.NoError(t, err)
	require.Equal(t, plgUserGroup, hash["Group"])
	require.Equal(t, "false", hash["CrossGroupRetry"])
}

func TestTokenCacheDeleteAndPatchHandleUnavailableRedis(t *testing.T) {
	previousRedisEnabled := common.RedisEnabled
	previousRDB := common.RDB
	t.Cleanup(func() {
		common.RedisEnabled = previousRedisEnabled
		common.RDB = previousRDB
	})

	common.RedisEnabled = false
	common.RDB = nil
	require.NoError(t, cacheDeleteTokens([]string{"disabled"}))
	require.NoError(t, cachePatchTokenGroups([]string{"disabled"}, "vip"))

	common.RedisEnabled = true
	require.ErrorContains(t, cacheDeleteTokens([]string{"missing-client"}), "Redis client is nil")
	require.ErrorContains(t, cachePatchTokenGroups([]string{"missing-client"}, "vip"), "Redis client is nil")
}

func TestTokenCacheGroupAndQuotaUpdatesCommute(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		operations func(t *testing.T, key string)
	}{
		{
			name: "group_before_quota",
			operations: func(t *testing.T, key string) {
				require.NoError(t, cachePatchTokenGroups([]string{key}, "premium"))
				require.NoError(t, cacheIncrTokenQuota(key, 25))
			},
		},
		{
			name: "quota_before_group",
			operations: func(t *testing.T, key string) {
				require.NoError(t, cacheIncrTokenQuota(key, 25))
				require.NoError(t, cachePatchTokenGroups([]string{key}, "premium"))
			},
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			setupTokenCacheRedis(t)
			token := testCachedToken("commute-" + testCase.name)
			fence, err := captureTokenCacheFillFence()
			require.NoError(t, err)
			require.NoError(t, cacheSetToken(token, fence))

			testCase.operations(t, token.Key)

			hash, err := common.RDB.HGetAll(context.Background(), redisTokenCacheKey(token.Key)).Result()
			require.NoError(t, err)
			require.Equal(t, "premium", hash["Group"])
			require.Equal(t, "925", hash["RemainQuota"])
			require.Equal(t, "1", hash[tokenCacheCompleteField])
		})
	}
}

func TestTokenCacheGroupPatchRejectsStaleFill(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	token := testCachedToken("group-patch-stale-fill")
	staleFence, err := captureTokenCacheFillFence()
	require.NoError(t, err)

	require.NoError(t, cachePatchTokenGroups([]string{token.Key}, "premium"))
	require.NoError(t, cacheSetToken(token, staleFence))
	require.False(t, mr.Exists(redisTokenCacheKey(token.Key)))
}

func TestTokenCacheMissingHashFillsCommittedGroupAfterPatch(t *testing.T) {
	setupTokenCacheRedis(t)
	token := testCachedToken("group-patch-missing-fill")
	token.Group = "premium"

	require.NoError(t, cachePatchTokenGroups([]string{token.Key}, token.Group))
	fence, err := captureTokenCacheFillFence()
	require.NoError(t, err)
	require.NoError(t, cacheSetToken(token, fence))

	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	require.Equal(t, "premium", cached.Group)
}

func TestTokenCacheGroupPatchDeletesIncompleteAndWrongTypeEntries(t *testing.T) {
	mr := setupTokenCacheRedis(t)
	incompleteKey := "group-patch-incomplete"
	wrongTypeKey := "group-patch-wrong-type"
	mr.HSet(redisTokenCacheKey(incompleteKey), "Group", "stale")
	mr.Set(redisTokenCacheKey(wrongTypeKey), "stale")

	require.NoError(t, cachePatchTokenGroups([]string{incompleteKey, wrongTypeKey}, "premium"))
	require.False(t, mr.Exists(redisTokenCacheKey(incompleteKey)))
	require.False(t, mr.Exists(redisTokenCacheKey(wrongTypeKey)))
}

func TestTokenCacheSchemaCoversEveryRelevantTokenField(t *testing.T) {
	serialized := tokenCacheFields(testCachedToken("schema"))
	require.Zero(t, len(serialized)%2)

	actual := make([]string, 0, len(serialized)/2)
	seen := make(map[string]struct{}, len(serialized)/2)
	for index := 0; index < len(serialized); index += 2 {
		name, ok := serialized[index].(string)
		require.True(t, ok)
		_, duplicate := seen[name]
		require.False(t, duplicate, "duplicate token cache field %q", name)
		seen[name] = struct{}{}
		if name != tokenCacheCompleteField {
			actual = append(actual, name)
		}
	}

	tokenType := reflect.TypeOf(Token{})
	expected := make([]string, 0, tokenType.NumField()-2)
	for index := 0; index < tokenType.NumField(); index++ {
		name := tokenType.Field(index).Name
		if name != "Key" && name != "DeletedAt" {
			expected = append(expected, name)
		}
	}
	sort.Strings(expected)
	sort.Strings(actual)
	require.Equal(t, expected, actual)
}

type rejectRedisCommandsHook struct{}

func (rejectRedisCommandsHook) BeforeProcess(ctx context.Context, _ redis.Cmder) (context.Context, error) {
	return ctx, errors.New("redis unavailable")
}

func (rejectRedisCommandsHook) AfterProcess(context.Context, redis.Cmder) error { return nil }

func (rejectRedisCommandsHook) BeforeProcessPipeline(ctx context.Context, _ []redis.Cmder) (context.Context, error) {
	return ctx, errors.New("redis unavailable")
}

func (rejectRedisCommandsHook) AfterProcessPipeline(context.Context, []redis.Cmder) error { return nil }

func TestGetTokenByKeyFallsBackToDatabaseWhenRedisFails(t *testing.T) {
	setupTokenCacheRedis(t)
	previousDB := DB
	previousCommonKeyCol := commonKeyCol
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Token{}))
	DB = db
	commonKeyCol = "`key`"
	t.Cleanup(func() {
		DB = previousDB
		commonKeyCol = previousCommonKeyCol
	})

	token := testCachedToken("redis-down-fallback")
	require.NoError(t, DB.Create(&token).Error)
	common.RDB.AddHook(rejectRedisCommandsHook{})

	got, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	require.Equal(t, token.Id, got.Id)
	require.Equal(t, token.Group, got.Group)
}
