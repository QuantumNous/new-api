package model

import (
	"bufio"
	"io"
	"net"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupImageAutoBillingModelTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := DB
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "image-auto.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &ImageAutoBillingJournal{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = oldDB
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	})
	return db
}

func startImageAutoBillingRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	server, err := miniredis.Run()
	require.NoError(t, err)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	common.RDB = client
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = client.Close()
		server.Close()
	})
	return server
}

// startTTLOnlyRedis provides the single Redis command used before the missing
// token lookup. It keeps this regression test independent of a local service.
func startTTLOnlyRedis(t *testing.T) *redis.Client {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() {
		for {
			conn, acceptErr := listener.Accept()
			if acceptErr != nil {
				return
			}
			go func() {
				defer conn.Close()
				reader := bufio.NewReader(conn)
				for {
					header, readErr := reader.ReadString('\n')
					if readErr != nil {
						return
					}
					count, parseErr := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(header, "*"), "\r\n"))
					if parseErr != nil {
						return
					}
					for i := 0; i < count; i++ {
						lengthLine, readErr := reader.ReadString('\n')
						if readErr != nil {
							return
						}
						length, parseErr := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(lengthLine, "$"), "\r\n"))
						if parseErr != nil {
							return
						}
						if _, readErr = io.ReadFull(reader, make([]byte, length+2)); readErr != nil {
							return
						}
					}
					if _, writeErr := conn.Write([]byte(":-2\r\n")); writeErr != nil {
						return
					}
				}
			}()
		}
	}()

	client := redis.NewClient(&redis.Options{Addr: listener.Addr().String()})
	t.Cleanup(func() {
		_ = client.Close()
		_ = listener.Close()
	})
	return client
}

func TestRefreshOpenImageAutoBillingQuotaCachesSkipsDeletedToken(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	require.NoError(t, db.Create(&User{Id: 501, Username: "cache-user", Password: "password", Quota: 600}).Error)
	require.NoError(t, db.Create(&ImageAutoBillingJournal{
		RequestId: "deleted-token-cache", UserId: 501, TokenId: 601,
		FundingSource: ImageAutoBillingFundingWallet, ReservedQuota: 400,
		Status: ImageAutoBillingStatusRefundPending,
	}).Error)
	common.RDB = startTTLOnlyRedis(t)
	common.RedisEnabled = true

	require.NoError(t, RefreshOpenImageAutoBillingQuotaCaches())
}

func TestRefreshImageAutoBillingQuotaCachesRejectsStaleCacheRefills(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	server := startImageAutoBillingRedis(t)
	user := User{Id: 504, Username: "fenced-cache-user", Password: "image-auto-fence-test", AuthVersion: 1, Quota: 900}
	token := Token{Id: 604, UserId: user.Id, Key: "fenced-cache-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, populateUserCache(user))
	_, err := cacheInitToken(token)
	require.NoError(t, err)

	require.NoError(t, RefreshImageAutoBillingQuotaCaches(user.Id, token.Id))
	require.False(t, server.Exists(getUserCacheKey(user.Id)))
	require.False(t, server.Exists(getTokenCacheKey(token.Key)))

	// A debit that races with invalidation sees a cache miss and must not create
	// a partial hash. A stale DB reader from the previous version cannot revive it.
	result, err := cacheApplyUserQuotaDelta(user.Id, -100)
	require.NoError(t, err)
	require.Equal(t, cacheQuotaMiss, result)
	result, err = cacheApplyTokenQuotaDelta(token.Id, token.Key, -100)
	require.NoError(t, err)
	require.Equal(t, cacheQuotaMiss, result)
	require.False(t, server.Exists(getUserCacheKey(user.Id)))
	require.False(t, server.Exists(getTokenCacheKey(token.Key)))

	// While the quota fence is active, a stale DB snapshot cannot repopulate the cache.
	require.NoError(t, populateUserCache(user))
	require.False(t, server.Exists(getUserCacheKey(user.Id)))
	code, err := cacheInitToken(token)
	require.NoError(t, err)
	assert.Zero(t, code)
	require.False(t, server.Exists(getTokenCacheKey(token.Key)))
}

func TestQuotaDeltaOnCacheMissDoesNotCreatePartialHash(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	server := startImageAutoBillingRedis(t)
	user := User{Id: 505, Username: "delta-cache-user", Password: "image-auto-fence-test", AuthVersion: 1, Quota: 900}
	token := Token{Id: 605, UserId: user.Id, Key: "delta-cache-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	// A delta on a cold cache must return Miss and must not create a partial hash.
	result, err := cacheApplyUserQuotaDelta(user.Id, -100)
	require.NoError(t, err)
	assert.Equal(t, cacheQuotaMiss, result)
	require.False(t, server.Exists(getUserCacheKey(user.Id)))

	result, err = cacheApplyTokenQuotaDelta(token.Id, token.Key, -100)
	require.NoError(t, err)
	assert.Equal(t, cacheQuotaMiss, result)
	require.False(t, server.Exists(getTokenCacheKey(token.Key)))

	// After populating from DB, the cached balance reflects the committed DB state.
	require.NoError(t, populateUserCache(user))
	code, err := cacheInitToken(token)
	require.NoError(t, err)
	assert.Equal(t, 1, code)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 900, cachedToken.RemainQuota)

	// A delta applied after population decrements the cached value.
	result, err = cacheApplyUserQuotaDelta(user.Id, -100)
	require.NoError(t, err)
	assert.Equal(t, cacheQuotaOK, result)
	result, err = cacheApplyTokenQuotaDelta(token.Id, token.Key, -100)
	require.NoError(t, err)
	assert.Equal(t, cacheQuotaOK, result)

	cachedUser, err = cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 800, cachedUser.Quota)
	cachedToken, err = cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 800, cachedToken.RemainQuota)
}

func TestBatchQuotaFlushPersistsDeltasAndCacheRefillReflectsCommittedState(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	startImageAutoBillingRedis(t)
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() { common.BatchUpdateEnabled = oldBatchUpdateEnabled })

	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		batchUpdateStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	user := User{Id: 506, Username: "batch-flush-user", Password: "image-auto-fence-test", AuthVersion: 1, Quota: 900}
	token := Token{Id: 606, UserId: user.Id, Key: "batch-flush-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	addNewRecord(BatchUpdateTypeUserQuota, user.Id, -100)
	addNewRecord(BatchUpdateTypeTokenQuota, token.Id, -100)
	batchUpdate()

	require.NoError(t, db.First(&user, user.Id).Error)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, 800, user.Quota)
	assert.Equal(t, 800, token.RemainQuota)

	// Cache population from DB reflects the committed state.
	require.NoError(t, populateUserCache(user))
	code, err := cacheInitToken(token)
	require.NoError(t, err)
	assert.Equal(t, 1, code)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 800, cachedUser.Quota)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 800, cachedToken.RemainQuota)
}
func TestReconcileImageAutoBillingRefundsWalletAfterTokenDeletion(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	require.NoError(t, db.Create(&User{Id: 502, Username: "refund-user", Password: "password", Quota: 600}).Error)
	token := Token{Id: 602, UserId: 502, Key: "deleted-refund-token", RemainQuota: 600, UsedQuota: 400}
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, db.Delete(&token).Error)
	require.NoError(t, db.Create(&ImageAutoBillingJournal{
		RequestId: "deleted-token-refund", UserId: 502, TokenId: 602,
		FundingSource: ImageAutoBillingFundingWallet, ReservedQuota: 400,
		Status: ImageAutoBillingStatusRefundPending,
	}).Error)

	require.NoError(t, ReconcileImageAutoBilling("deleted-token-refund"))

	var user User
	require.NoError(t, db.First(&user, 502).Error)
	var journal ImageAutoBillingJournal
	require.NoError(t, db.Where("request_id = ?", "deleted-token-refund").First(&journal).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, ImageAutoBillingStatusRefunded, journal.Status)
}

func TestReconcileImageAutoBillingSettlesWalletAfterTokenDeletion(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	require.NoError(t, db.Create(&User{Id: 503, Username: "settle-user", Password: "password", Quota: 600}).Error)
	token := Token{Id: 603, UserId: 503, Key: "deleted-settle-token", RemainQuota: 600, UsedQuota: 400}
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, db.Delete(&token).Error)
	require.NoError(t, db.Create(&ImageAutoBillingJournal{
		RequestId: "deleted-token-settle", UserId: 503, TokenId: 603,
		FundingSource: ImageAutoBillingFundingWallet, ReservedQuota: 400, ActualQuota: 150,
		Status: ImageAutoBillingStatusSettlementPending,
	}).Error)

	require.NoError(t, ReconcileImageAutoBilling("deleted-token-settle"))

	var user User
	require.NoError(t, db.First(&user, 503).Error)
	var journal ImageAutoBillingJournal
	require.NoError(t, db.Where("request_id = ?", "deleted-token-settle").First(&journal).Error)
	assert.Equal(t, 850, user.Quota)
	assert.Equal(t, ImageAutoBillingStatusSettled, journal.Status)
}
