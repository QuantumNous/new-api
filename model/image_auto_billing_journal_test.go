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
	cache := startImageAutoBillingRedis(t)
	user := User{Id: 504, Username: "versioned-cache-user", Password: "password", Quota: 900}
	token := Token{Id: 604, UserId: user.Id, Key: "versioned-cache-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)
	require.NoError(t, populateUserCache(user))
	require.NoError(t, cacheSetToken(token))

	userVersion, err := imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	tokenVersion, err := imageAutoTokenQuotaCacheVersion(token.Key)
	require.NoError(t, err)

	require.NoError(t, RefreshImageAutoBillingQuotaCaches(user.Id, token.Id))
	require.False(t, cache.Exists(getUserCacheKey(user.Id)))
	require.False(t, cache.Exists(tokenCacheKey(token.Key)))

	// A debit that races with invalidation sees a cache miss and must not create
	// a partial hash. A stale DB reader from the previous version cannot revive it.
	require.NoError(t, cacheIncrUserQuotaPending(user.Id, -100))
	require.NoError(t, cacheIncrTokenQuotaPending(token.Key, -100))
	require.False(t, cache.Exists(getUserCacheKey(user.Id)))
	require.False(t, cache.Exists(tokenCacheKey(token.Key)))

	written, err := populateUserCacheAtImageAutoQuotaCacheVersion(user, userVersion)
	require.NoError(t, err)
	require.False(t, written)
	written, err = cacheSetTokenAtImageAutoQuotaCacheVersion(token, tokenVersion)
	require.NoError(t, err)
	require.False(t, written)
}

func TestQuotaCacheMissRefillAppliesPendingUserAndTokenDebits(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	startImageAutoBillingRedis(t)
	user := User{Id: 505, Username: "pending-cache-user", Password: "password", Quota: 900}
	token := Token{Id: 605, UserId: user.Id, Key: "pending-cache-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	require.NoError(t, cacheIncrUserQuotaPending(user.Id, -100))
	require.NoError(t, cacheIncrTokenQuotaPending(token.Key, -100))
	userVersion, err := imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	tokenVersion, err := imageAutoTokenQuotaCacheVersion(token.Key)
	require.NoError(t, err)
	written, err := populateUserCacheAtImageAutoQuotaCacheVersion(user, userVersion)
	require.NoError(t, err)
	require.True(t, written)
	written, err = cacheSetTokenAtImageAutoQuotaCacheVersion(token, tokenVersion)
	require.NoError(t, err)
	require.True(t, written)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	require.Equal(t, 800, cachedUser.Quota)
	require.Equal(t, 800, cachedToken.RemainQuota)
}

func TestBatchQuotaFlushAcknowledgesPendingDeltasBeforeCacheRefill(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	startImageAutoBillingRedis(t)
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() { common.BatchUpdateEnabled = oldBatchUpdateEnabled })

	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		batchUpdateStores[i] = make(map[int]int)
		batchUpdatePendingStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	user := User{Id: 506, Username: "batch-pending-user", Password: "password", Quota: 900}
	token := Token{Id: 606, UserId: user.Id, Key: "batch-pending-token", RemainQuota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)

	require.NoError(t, DecreaseUserQuota(user.Id, 100, false))
	require.NoError(t, DecreaseTokenQuota(token.Id, token.Key, 100))
	batchUpdate()

	require.NoError(t, db.First(&user, user.Id).Error)
	require.NoError(t, db.First(&token, token.Id).Error)
	require.Equal(t, 800, user.Quota)
	require.Equal(t, 800, token.RemainQuota)

	userVersion, err := imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	tokenVersion, err := imageAutoTokenQuotaCacheVersion(token.Key)
	require.NoError(t, err)
	written, err := populateUserCacheAtImageAutoQuotaCacheVersion(user, userVersion)
	require.NoError(t, err)
	require.True(t, written)
	written, err = cacheSetTokenAtImageAutoQuotaCacheVersion(token, tokenVersion)
	require.NoError(t, err)
	require.True(t, written)

	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	cachedToken, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	require.Equal(t, 800, cachedUser.Quota)
	require.Equal(t, 800, cachedToken.RemainQuota)
}

func TestBatchQuotaAcknowledgementPreservesNewerPendingDelta(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	cache := startImageAutoBillingRedis(t)
	user := User{Id: 507, Username: "overlap-pending-user", Password: "password", Quota: 900}
	require.NoError(t, db.Create(&user).Error)

	// The first queued debit is visible through a pre-flush refill but remains
	// pending until its database commit is acknowledged.
	require.NoError(t, cacheIncrUserQuotaPending(user.Id, -100))
	version, err := imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	written, err := populateUserCacheAtImageAutoQuotaCacheVersion(user, version)
	require.NoError(t, err)
	require.True(t, written)

	// A newer debit arrives after the first batch snapshot. Acknowledging the
	// old batch must preserve this -50 delta and invalidate the raced cache.
	require.NoError(t, cacheIncrUserQuotaPending(user.Id, -50))
	require.NoError(t, decreaseUserQuota(user.Id, 100))
	require.NoError(t, cacheAcknowledgeUserQuotaPendingDelta(user.Id, -100))
	require.False(t, cache.Exists(getUserCacheKey(user.Id)))

	require.NoError(t, db.First(&user, user.Id).Error)
	version, err = imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	written, err = populateUserCacheAtImageAutoQuotaCacheVersion(user, version)
	require.NoError(t, err)
	require.True(t, written)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	require.Equal(t, 750, cachedUser.Quota)
}

func TestBatchPositiveQuotaCacheMissDoesNotCreateReplayablePendingCredit(t *testing.T) {
	db := setupImageAutoBillingModelTestDB(t)
	startImageAutoBillingRedis(t)
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	common.BatchUpdateEnabled = true
	t.Cleanup(func() { common.BatchUpdateEnabled = oldBatchUpdateEnabled })

	for i := 0; i < BatchUpdateTypeCount; i++ {
		batchUpdateLocks[i].Lock()
		batchUpdateStores[i] = make(map[int]int)
		batchUpdatePendingStores[i] = make(map[int]int)
		batchUpdateLocks[i].Unlock()
	}

	user := User{Id: 508, Username: "positive-pending-user", Password: "password", Quota: 900}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, IncreaseUserQuota(user.Id, 100, false))
	batchUpdate()

	require.NoError(t, db.First(&user, user.Id).Error)
	require.Equal(t, 1000, user.Quota)
	version, err := imageAutoUserQuotaCacheVersion(user.Id)
	require.NoError(t, err)
	written, err := populateUserCacheAtImageAutoQuotaCacheVersion(user, version)
	require.NoError(t, err)
	require.True(t, written)
	cachedUser, err := cacheGetUserBase(user.Id)
	require.NoError(t, err)
	require.Equal(t, 1000, cachedUser.Quota)
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
