package model

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useSynchronousQuotaCacheRefresh(t *testing.T) {
	t.Helper()
	previous := scheduleQuotaCacheRefresh
	scheduleQuotaCacheRefresh = func(refresh func()) {
		refresh()
	}
	t.Cleanup(func() {
		scheduleQuotaCacheRefresh = previous
	})
}

func TestUserQuotaMutationKeepsPinnedLedgerButBypassesItForNormalReads(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user := User{Username: "pinned-user-quota", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskUserQuotaPinsKey(user.Id), "task-1").Err())

	require.NoError(t, DecreaseUserQuotaDirect(user.Id, 30))

	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, raw.Quota)
	assert.Equal(t, common.UserStatusEnabled, raw.Status)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))

	read, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, read.Quota)

	require.NoError(t, IncreaseUserQuotaDirect(user.Id, 50))
	raw, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 120, raw.Quota)
	require.NoError(t, prepareImageTaskCacheAdjustment(imageTaskCacheAdjustment{
		taskID:    "task-user-after-credit",
		userID:    user.Id,
		userDelta: -20,
	}, &user, nil))
	raw, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, raw.Quota)
}

func TestTokenQuotaMutationKeepsPinnedLedgerButBypassesItForAuthenticationReads(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	token := Token{
		UserId:      1,
		Key:         "pinned-token-quota",
		Name:        "pinned",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
		UsedQuota:   50,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, cacheSetToken(token))
	tokenHMAC := common.GenerateHMAC(token.Key)
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskTokenQuotaPinsKey(tokenHMAC), "task-1").Err())

	require.NoError(t, DecreaseTokenQuotaDirect(token.Id, token.Key, 30))

	raw, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 70, raw.RemainQuota)
	assert.Equal(t, common.TokenStatusEnabled, raw.Status)
	assert.True(t, redisServer.Exists(imageTaskTokenQuotaInvalidationKey(tokenHMAC)))

	read, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, 70, read.RemainQuota)

	require.NoError(t, IncreaseTokenQuotaDirect(token.Id, token.Key, 50))
	raw, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 120, raw.RemainQuota)
	require.NoError(t, prepareImageTaskCacheAdjustment(imageTaskCacheAdjustment{
		taskID:     "task-token-after-credit",
		tokenKey:   token.Key,
		tokenDelta: -20,
	}, nil, &token))
	raw, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 100, raw.RemainQuota)
}

func TestStaleUserSnapshotCannotOverwriteQuotaAfterDBFirstMutation(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	useSynchronousQuotaCacheRefresh(t)

	user := User{Username: "stale-user-snapshot", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	generation, err := userQuotaCacheGeneration(user.Id)
	require.NoError(t, err)
	stale := user

	require.NoError(t, DecreaseUserQuotaDirect(user.Id, 30))
	populated, err := populateUserCacheAtGeneration(stale, generation)
	require.NoError(t, err)
	assert.False(t, populated)

	read, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, read.Quota)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 70, cachedUser.Quota)
}

func TestStaleTokenSnapshotCannotOverwriteQuotaAfterDBFirstMutation(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	useSynchronousQuotaCacheRefresh(t)

	token := Token{
		UserId:      1,
		Key:         "stale-token-snapshot",
		Name:        "stale",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)
	generation, err := tokenQuotaCacheGeneration(token.Key)
	require.NoError(t, err)
	stale := token

	require.NoError(t, DecreaseTokenQuotaDirect(token.Id, token.Key, 30))
	populated, err := cacheSetTokenAtGeneration(stale, generation)
	require.NoError(t, err)
	assert.False(t, populated)

	read, err := GetTokenByKey(token.Key, false)
	require.NoError(t, err)
	assert.Equal(t, 70, read.RemainQuota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 70, cachedToken.RemainQuota)
}

func TestDBFlagQuotaMutationsAreDBFirstAndInvalidateCache(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "db-flag-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))

	require.NoError(t, IncreaseUserQuota(user.Id, 30, true))
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 130, stored.Quota)
	assert.Zero(t, common.RDB.Exists(context.Background(), getUserCacheKey(user.Id)).Val())
}

func TestImagePrepareReloadsAuthoritativeQuotaBeforeCreatingPinnedCache(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "image-prepare-authority", Quota: 70, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	token := Token{
		UserId:      user.Id,
		Key:         "image-prepare-authority-token",
		Name:        "image-prepare",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 70,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, invalidateUserQuotaCache(user.Id))
	require.NoError(t, invalidateTokenQuotaCache(token.Key))
	require.NoError(t, ensureUserQuotaCache(user.Id))
	require.NoError(t, ensureTokenQuotaCache(token.Id, token.Key))

	staleUser := user
	staleUser.Quota = 100
	staleToken := token
	staleToken.RemainQuota = 100
	adjustment := imageTaskCacheAdjustment{
		taskID:     "task-authoritative-prepare",
		userID:     user.Id,
		userDelta:  -10,
		tokenKey:   token.Key,
		tokenDelta: -10,
	}

	require.NoError(t, prepareImageTaskCacheAdjustment(adjustment, &staleUser, &staleToken))
	rawUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 60, rawUser.Quota)
	rawToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 60, rawToken.RemainQuota)
}

func TestValidateUserTokenConfirmsCachedExhaustionWithDatabase(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	useSynchronousQuotaCacheRefresh(t)

	token := Token{
		UserId:      1,
		Key:         "stale-exhausted-token",
		Name:        "stale-exhausted",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)
	stale := token
	stale.Status = common.TokenStatusExhausted
	stale.RemainQuota = 0
	require.NoError(t, cacheSetToken(stale))

	validated, err := ValidateUserToken(token.Key)
	require.NoError(t, err)
	assert.Equal(t, common.TokenStatusEnabled, validated.Status)
	assert.Equal(t, 100, validated.RemainQuota)
}

func TestGetUserCacheConfirmsCachedZeroQuotaWithDatabase(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	useSynchronousQuotaCacheRefresh(t)

	user := User{Username: "stale-zero-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	stale := user
	stale.Quota = 0
	require.NoError(t, populateUserCache(stale))

	read, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, read.Quota)
}

func TestPostCommitUserQuotaCacheHookInvalidatesStaleSnapshot(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)
	useSynchronousQuotaCacheRefresh(t)

	user := User{Username: "legacy-cache-hook", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	stale := user
	stale.Quota = 70
	require.NoError(t, populateUserCache(stale))
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("quota", 130).Error)

	require.NoError(t, cacheIncrUserQuota(user.Id, 30))
	read, err := GetUserCache(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 130, read.Quota)
}

func TestSetUserQuotaDirectUpdatesPinnedLedgerByAuthoritativeDelta(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user := User{Username: "override-pinned-user", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskUserQuotaPinsKey(user.Id), "task-1").Err())

	require.NoError(t, SetUserQuotaDirect(user.Id, 200))
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 200, stored.Quota)
	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 200, raw.Quota)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))
}

func TestSetUserQuotaDirectSucceedsWhenOutboxAcknowledgementIsQueued(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "override-queued-ack", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_admin_quota_outbox_ack
		BEFORE UPDATE ON billing_adjustment_outboxes
		BEGIN
			SELECT RAISE(FAIL, 'forced acknowledgement failure');
		END
	`).Error)
	t.Cleanup(func() {
		DB.Exec("DROP TRIGGER IF EXISTS fail_admin_quota_outbox_ack")
	})

	require.NoError(t, SetUserQuotaDirect(user.Id, 200))

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 200, stored.Quota)

	var outbox BillingAdjustmentOutbox
	require.NoError(t, DB.Where("user_id = ? AND phase = ?", user.Id, BillingAdjustmentPhaseAdminOverride).First(&outbox).Error)
	assert.True(t, outbox.DBApplied)
	assert.False(t, outbox.CacheApplied)
}

func TestQuotaDebitFailsClosedWhenRedisLockIsUnavailable(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "redis-lock-fallback-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	token := Token{
		UserId:      user.Id,
		Key:         "redis-lock-fallback-token",
		Name:        "fallback",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, cacheSetToken(token))

	healthyRedis := common.RDB
	common.RDB = nil
	require.Error(t, DecreaseUserQuotaDirect(user.Id, 30))
	require.Error(t, DecreaseTokenQuotaDirect(token.Id, token.Key, 30))
	common.RDB = healthyRedis

	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, 100, storedUser.Quota)
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, 100, storedToken.RemainQuota)
}

func TestQuotaCreditRejectsBalanceOverflow(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	user := User{Username: "overflow-user", Quota: common.MaxQuota - 5, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, IncreaseUserQuotaDirect(user.Id, 10))
	var storedUser User
	require.NoError(t, DB.First(&storedUser, user.Id).Error)
	assert.Equal(t, common.MaxQuota-5, storedUser.Quota)

	token := Token{
		UserId:      user.Id,
		Key:         "overflow-token",
		Name:        "overflow",
		Status:      common.TokenStatusEnabled,
		RemainQuota: common.MaxQuota - 5,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, IncreaseTokenQuotaDirect(token.Id, token.Key, 10))
	var storedToken Token
	require.NoError(t, DB.First(&storedToken, token.Id).Error)
	assert.Equal(t, common.MaxQuota-5, storedToken.RemainQuota)
	var pending int64
	require.NoError(t, DB.Model(&BillingAdjustmentOutbox{}).
		Where("phase = ? AND status = ? AND db_applied = ?", BillingAdjustmentPhaseDirect, billingAdjustmentRetry, false).
		Count(&pending).Error)
	assert.EqualValues(t, 2, pending)
}

func TestTokenQuotaCreditRejectsUsedQuotaUnderflow(t *testing.T) {
	truncateTables(t)
	useImageTaskTestRedis(t)

	token := Token{
		UserId:      1,
		Key:         "underflow-token-credit",
		Name:        "underflow",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 100,
		UsedQuota:   5,
	}
	require.NoError(t, DB.Create(&token).Error)
	require.NoError(t, IncreaseTokenQuotaDirect(token.Id, token.Key, 10))

	var stored Token
	require.NoError(t, DB.First(&stored, token.Id).Error)
	assert.Equal(t, 100, stored.RemainQuota)
	assert.Equal(t, 5, stored.UsedQuota)
}

func TestTopUpCreditUpdatesPinnedUserQuotaLedgerExactlyOnce(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)

	user := User{Username: "topup-pinned-user", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskUserQuotaPinsKey(user.Id), "task-1").Err())

	topUp := TopUp{
		UserId:          user.Id,
		Amount:          1,
		Money:           1,
		TradeNo:         "pinned-topup-credit",
		PaymentMethod:   PaymentMethodWaffoPancake,
		PaymentProvider: PaymentProviderWaffoPancake,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&topUp).Error)
	require.NoError(t, RechargeWaffoPancake(topUp.TradeNo))
	require.NoError(t, RechargeWaffoPancake(topUp.TradeNo))

	credit := common.QuotaFromFloat(common.QuotaPerUnit)
	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 20+credit, stored.Quota)
	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 20+credit, raw.Quota)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))
}

func TestRedemptionCreditUpdatesPinnedUserQuotaLedger(t *testing.T) {
	truncateTables(t)
	redisServer := useImageTaskTestRedis(t)
	require.NoError(t, DB.AutoMigrate(&Redemption{}))

	user := User{Username: "redemption-pinned-user", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, common.RDB.SAdd(context.Background(), imageTaskUserQuotaPinsKey(user.Id), "task-1").Err())

	redemption := Redemption{
		Name:        "pinned-redemption-credit",
		Key:         "20000000000000000000000000000001",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       80,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&redemption).Error)
	credited, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, err)
	assert.Equal(t, 80, credited)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 100, stored.Quota)
	raw, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, raw.Quota)
	assert.True(t, redisServer.Exists(imageTaskUserQuotaInvalidationKey(user.Id)))
}
