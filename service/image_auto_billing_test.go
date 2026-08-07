package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type imageAutoBillingJournalRow struct {
	Id                 int
	RequestId          string
	UserId             int
	TokenId            int
	UserSubscriptionId int
	FundingSource      string
	ReservedQuota      int
	ActualQuota        int
	Status             string
	RetryCount         int
	LastError          string
	CreatedAt          int64
	UpdatedAt          int64
}

func (imageAutoBillingJournalRow) TableName() string {
	return "image_auto_billing_journals"
}

func setupImageAutoBillingDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := model.DB
	oldDatabaseType := common.MainDatabaseType()
	oldSQLitePath := common.SQLitePath
	oldMasterNode := common.IsMasterNode
	oldBatchUpdateEnabled := common.BatchUpdateEnabled
	oldRedisEnabled := common.RedisEnabled
	common.SQLitePath = filepath.Join(t.TempDir(), "image-auto-billing.db")
	common.IsMasterNode = false
	t.Setenv("SQL_DSN", "")
	require.NoError(t, model.InitDB())
	db := model.DB
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.SubscriptionPreConsumeRecord{},
		&model.ImageAutoBillingJournal{},
	))

	common.BatchUpdateEnabled = true
	common.RedisEnabled = false
	t.Cleanup(func() {
		_ = sqlDB.Close()
		model.DB = oldDB
		common.SetMainDatabaseType(oldDatabaseType)
		common.SQLitePath = oldSQLitePath
		common.IsMasterNode = oldMasterNode
		common.BatchUpdateEnabled = oldBatchUpdateEnabled
		common.RedisEnabled = oldRedisEnabled
	})
	return db
}

func newImageAutoBillingRelayInfo(userId, tokenId int, tokenKey, requestId, preference string) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		UserId:          userId,
		TokenId:         tokenId,
		TokenKey:        tokenKey,
		OriginModelName: "image-auto",
		RequestId:       requestId,
		ForcePreConsume: true,
		ImageRouting:    &relaycommon.ImageRoutingState{},
	}
	info.UserSetting.BillingPreference = preference
	return info
}

func TestImageAutoWalletReserveCommitsJournalAndQuotasDespiteBatchUpdates(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 101, Username: "wallet-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 201, UserId: 101, Key: "wallet-token-secret", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	c.Set("token_quota", 1000)
	info := newImageAutoBillingRelayInfo(101, 201, "wallet-token-secret", "202607220001wallet", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NotNil(t, session)

	var user model.User
	require.NoError(t, db.First(&user, 101).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 201).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)

	assert.Equal(t, 600, user.Quota)
	assert.Equal(t, 600, token.RemainQuota)
	assert.Equal(t, 400, token.UsedQuota)
	assert.Equal(t, 101, journal.UserId)
	assert.Equal(t, 201, journal.TokenId)
	assert.Equal(t, BillingSourceWallet, journal.FundingSource)
	assert.Equal(t, 400, journal.ReservedQuota)
	assert.Equal(t, "reserved", journal.Status)
}

func TestImageAutoSessionWalletReserveDoesNotRequireOrCreateToken(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 111, Username: "session-user", Password: "password", Quota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(111, 0, "", "202607240001session", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NotNil(t, session)

	var user model.User
	require.NoError(t, db.First(&user, 111).Error)
	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", 111).Count(&tokenCount).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)

	assert.Equal(t, 600, user.Quota)
	assert.Equal(t, int64(0), tokenCount)
	assert.Equal(t, 0, journal.TokenId)
	assert.Equal(t, BillingSourceWallet, journal.FundingSource)
}

func TestImageAutoSubscriptionReserveCommitsJournalAndQuotas(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 102, Username: "subscription-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 202, UserId: 102, Key: "subscription-token-secret", RemainQuota: 1000}).Error)
	require.NoError(t, db.Create(&model.SubscriptionPlan{
		Id: 302, Title: "image plan", PriceAmount: 1, Enabled: true, TotalAmount: 2000,
	}).Error)
	require.NoError(t, db.Create(&model.UserSubscription{
		Id: 402, UserId: 102, PlanId: 302, AmountTotal: 2000, AmountUsed: 100,
		StartTime: time.Now().Add(-time.Hour).Unix(), EndTime: time.Now().Add(time.Hour).Unix(),
		Status: "active", AllowWalletOverflow: true,
	}).Error)

	c, _ := gin.CreateTestContext(nil)
	c.Set("token_quota", 1000)
	info := newImageAutoBillingRelayInfo(102, 202, "subscription-token-secret", "202607220002subscription", "subscription_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NotNil(t, session)

	var user model.User
	require.NoError(t, db.First(&user, 102).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 202).Error)
	var subscription model.UserSubscription
	require.NoError(t, db.First(&subscription, 402).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)

	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, int64(500), subscription.AmountUsed)
	assert.Equal(t, 600, token.RemainQuota)
	assert.Equal(t, 400, token.UsedQuota)
	assert.Equal(t, BillingSourceSubscription, journal.FundingSource)
	assert.Equal(t, 402, journal.UserSubscriptionId)
	assert.Equal(t, 400, journal.ReservedQuota)
	assert.Equal(t, "reserved", journal.Status)
}

func TestImageAutoBillingPreservesFundingPreferenceFallbacks(t *testing.T) {
	t.Run("subscription first uses wallet without an active subscription", func(t *testing.T) {
		db := setupImageAutoBillingDB(t)
		require.NoError(t, db.Create(&model.User{Id: 111, Username: "no-sub-user", Password: "password", Quota: 1000}).Error)
		require.NoError(t, db.Create(&model.Token{Id: 211, UserId: 111, Key: "no-sub-token", RemainQuota: 1000}).Error)

		c, _ := gin.CreateTestContext(nil)
		info := newImageAutoBillingRelayInfo(111, 211, "no-sub-token", "202607220011fallback", "subscription_first")
		session, apiErr := NewBillingSession(c, info, 400)
		require.Nil(t, apiErr)
		require.NotNil(t, session)

		var journal imageAutoBillingJournalRow
		require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
		assert.Equal(t, BillingSourceWallet, journal.FundingSource)
	})

	t.Run("subscription first respects disabled wallet overflow", func(t *testing.T) {
		db := setupImageAutoBillingDB(t)
		require.NoError(t, db.Create(&model.User{Id: 112, Username: "strict-sub-user", Password: "password", Quota: 1000}).Error)
		require.NoError(t, db.Create(&model.Token{Id: 212, UserId: 112, Key: "strict-sub-token", RemainQuota: 1000}).Error)
		require.NoError(t, db.Create(&model.SubscriptionPlan{Id: 312, Title: "strict plan", PriceAmount: 1, Enabled: true, TotalAmount: 300}).Error)
		require.NoError(t, db.Create(&model.UserSubscription{
			Id: 412, UserId: 112, PlanId: 312, AmountTotal: 300, AmountUsed: 100,
			StartTime: time.Now().Add(-time.Hour).Unix(), EndTime: time.Now().Add(time.Hour).Unix(),
			Status: "active", AllowWalletOverflow: false,
		}).Error)

		c, _ := gin.CreateTestContext(nil)
		info := newImageAutoBillingRelayInfo(112, 212, "strict-sub-token", "202607220012strict", "subscription_first")
		session, apiErr := NewBillingSession(c, info, 400)
		require.Nil(t, session)
		require.NotNil(t, apiErr)

		var user model.User
		require.NoError(t, db.First(&user, 112).Error)
		var token model.Token
		require.NoError(t, db.First(&token, 212).Error)
		var journalCount int64
		require.NoError(t, db.Model(&model.ImageAutoBillingJournal{}).Where("request_id = ?", info.RequestId).Count(&journalCount).Error)
		assert.Equal(t, 1000, user.Quota)
		assert.Equal(t, 1000, token.RemainQuota)
		assert.Zero(t, journalCount)
	})

	t.Run("wallet first falls back to subscription", func(t *testing.T) {
		db := setupImageAutoBillingDB(t)
		require.NoError(t, db.Create(&model.User{Id: 113, Username: "wallet-first-user", Password: "password", Quota: 100}).Error)
		require.NoError(t, db.Create(&model.Token{Id: 213, UserId: 113, Key: "wallet-first-token", RemainQuota: 1000}).Error)
		require.NoError(t, db.Create(&model.SubscriptionPlan{Id: 313, Title: "fallback plan", PriceAmount: 1, Enabled: true, TotalAmount: 2000}).Error)
		require.NoError(t, db.Create(&model.UserSubscription{
			Id: 413, UserId: 113, PlanId: 313, AmountTotal: 2000,
			StartTime: time.Now().Add(-time.Hour).Unix(), EndTime: time.Now().Add(time.Hour).Unix(),
			Status: "active", AllowWalletOverflow: true,
		}).Error)

		c, _ := gin.CreateTestContext(nil)
		info := newImageAutoBillingRelayInfo(113, 213, "wallet-first-token", "202607220013walletfirst", "wallet_first")
		session, apiErr := NewBillingSession(c, info, 400)
		require.Nil(t, apiErr)
		require.NotNil(t, session)

		var journal imageAutoBillingJournalRow
		require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
		assert.Equal(t, BillingSourceSubscription, journal.FundingSource)
	})
}

func TestImageAutoWalletSettlementAtomicallyAppliesActualQuota(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 121, Username: "settle-wallet-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 221, UserId: 121, Key: "settle-wallet-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(121, 221, "settle-wallet-token", "202607220021settle", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NoError(t, session.Settle(150))

	var user model.User
	require.NoError(t, db.First(&user, 121).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 221).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)

	assert.Equal(t, 850, user.Quota)
	assert.Equal(t, 850, token.RemainQuota)
	assert.Equal(t, 150, token.UsedQuota)
	assert.Equal(t, 150, journal.ActualQuota)
	assert.Equal(t, "settled", journal.Status)
}

func TestImageAutoWalletRefundAtomicallyRestoresReserve(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 122, Username: "refund-wallet-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 222, UserId: 122, Key: "refund-wallet-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(122, 222, "refund-wallet-token", "202607220022refund", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	session.Refund(c)

	var user model.User
	require.NoError(t, db.First(&user, 122).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 222).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)

	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	assert.Equal(t, "refunded", journal.Status)
}

func TestImageAutoSubscriptionSettlementAndRefund(t *testing.T) {
	t.Run("settlement applies actual quota", func(t *testing.T) {
		db := setupImageAutoBillingDB(t)
		require.NoError(t, db.Create(&model.User{Id: 131, Username: "settle-sub-user", Password: "password", Quota: 1000}).Error)
		require.NoError(t, db.Create(&model.Token{Id: 231, UserId: 131, Key: "settle-sub-token", RemainQuota: 1000}).Error)
		require.NoError(t, db.Create(&model.SubscriptionPlan{Id: 331, Title: "settle sub plan", PriceAmount: 1, Enabled: true, TotalAmount: 2000}).Error)
		require.NoError(t, db.Create(&model.UserSubscription{
			Id: 431, UserId: 131, PlanId: 331, AmountTotal: 2000, AmountUsed: 100,
			StartTime: time.Now().Add(-time.Hour).Unix(), EndTime: time.Now().Add(time.Hour).Unix(),
			Status: "active", AllowWalletOverflow: true,
		}).Error)

		c, _ := gin.CreateTestContext(nil)
		info := newImageAutoBillingRelayInfo(131, 231, "settle-sub-token", "202607220031subsettle", "subscription_only")
		session, apiErr := NewBillingSession(c, info, 400)
		require.Nil(t, apiErr)
		require.NoError(t, session.Settle(150))

		var user model.User
		require.NoError(t, db.First(&user, 131).Error)
		var token model.Token
		require.NoError(t, db.First(&token, 231).Error)
		var subscription model.UserSubscription
		require.NoError(t, db.First(&subscription, 431).Error)
		var journal imageAutoBillingJournalRow
		require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
		assert.Equal(t, 1000, user.Quota)
		assert.Equal(t, int64(250), subscription.AmountUsed)
		assert.Equal(t, 850, token.RemainQuota)
		assert.Equal(t, 150, token.UsedQuota)
		assert.Equal(t, 150, journal.ActualQuota)
		assert.Equal(t, "settled", journal.Status)
	})

	t.Run("refund restores subscription reserve", func(t *testing.T) {
		db := setupImageAutoBillingDB(t)
		require.NoError(t, db.Create(&model.User{Id: 132, Username: "refund-sub-user", Password: "password", Quota: 1000}).Error)
		require.NoError(t, db.Create(&model.Token{Id: 232, UserId: 132, Key: "refund-sub-token", RemainQuota: 1000}).Error)
		require.NoError(t, db.Create(&model.SubscriptionPlan{Id: 332, Title: "refund sub plan", PriceAmount: 1, Enabled: true, TotalAmount: 2000}).Error)
		require.NoError(t, db.Create(&model.UserSubscription{
			Id: 432, UserId: 132, PlanId: 332, AmountTotal: 2000, AmountUsed: 100,
			StartTime: time.Now().Add(-time.Hour).Unix(), EndTime: time.Now().Add(time.Hour).Unix(),
			Status: "active", AllowWalletOverflow: true,
		}).Error)

		c, _ := gin.CreateTestContext(nil)
		info := newImageAutoBillingRelayInfo(132, 232, "refund-sub-token", "202607220032subrefund", "subscription_only")
		session, apiErr := NewBillingSession(c, info, 400)
		require.Nil(t, apiErr)
		session.Refund(c)

		var token model.Token
		require.NoError(t, db.First(&token, 232).Error)
		var subscription model.UserSubscription
		require.NoError(t, db.First(&subscription, 432).Error)
		var record model.SubscriptionPreConsumeRecord
		require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&record).Error)
		var journal imageAutoBillingJournalRow
		require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
		assert.Equal(t, int64(100), subscription.AmountUsed)
		assert.Equal(t, 1000, token.RemainQuota)
		assert.Zero(t, token.UsedQuota)
		assert.Equal(t, "refunded", record.Status)
		assert.Equal(t, "refunded", journal.Status)
	})
}

func TestImageAutoDuplicateConcurrentSettlementAppliesOnce(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 141, Username: "concurrent-settle-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 241, UserId: 141, Key: "concurrent-settle-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info1 := newImageAutoBillingRelayInfo(141, 241, "concurrent-settle-token", "202607220041concurrent", "wallet_only")
	session1, apiErr := NewBillingSession(c, info1, 400)
	require.Nil(t, apiErr)
	info2 := newImageAutoBillingRelayInfo(141, 241, "concurrent-settle-token", info1.RequestId, "wallet_only")
	session2, apiErr := NewBillingSession(c, info2, 400)
	require.Nil(t, apiErr)

	start := make(chan struct{})
	errs := make(chan error, 2)
	for _, session := range []*BillingSession{session1, session2} {
		go func(s *BillingSession) {
			<-start
			errs <- s.Settle(150)
		}(session)
	}
	close(start)
	require.NoError(t, <-errs)
	require.NoError(t, <-errs)

	var user model.User
	require.NoError(t, db.First(&user, 141).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 241).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info1.RequestId).First(&journal).Error)
	assert.Equal(t, 850, user.Quota)
	assert.Equal(t, 850, token.RemainQuota)
	assert.Equal(t, 150, token.UsedQuota)
	assert.Equal(t, "settled", journal.Status)
}

func TestImageAutoDuplicateConcurrentRefundAppliesOnce(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 142, Username: "concurrent-refund-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 242, UserId: 142, Key: "concurrent-refund-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info1 := newImageAutoBillingRelayInfo(142, 242, "concurrent-refund-token", "202607220042concurrent", "wallet_only")
	session1, apiErr := NewBillingSession(c, info1, 400)
	require.Nil(t, apiErr)
	info2 := newImageAutoBillingRelayInfo(142, 242, "concurrent-refund-token", info1.RequestId, "wallet_only")
	session2, apiErr := NewBillingSession(c, info2, 400)
	require.Nil(t, apiErr)

	start := make(chan struct{})
	done := make(chan struct{}, 2)
	for _, session := range []*BillingSession{session1, session2} {
		go func(s *BillingSession) {
			<-start
			s.Refund(c)
			done <- struct{}{}
		}(session)
	}
	close(start)
	<-done
	<-done

	var user model.User
	require.NoError(t, db.First(&user, 142).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 242).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info1.RequestId).First(&journal).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	assert.Equal(t, "refunded", journal.Status)
}

func TestImageAutoSettlementFailureKeepsTargetPendingForReconcile(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 151, Username: "pending-settle-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 251, UserId: 151, Key: "pending-settle-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(151, 251, "pending-settle-token", "202607220051pending", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)

	const callbackName = "test:image_auto_fail_wallet_settlement_once"
	failWalletUpdate := true
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if failWalletUpdate && tx.Statement.Table == "users" {
			failWalletUpdate = false
			tx.AddError(errors.New("injected wallet settlement failure"))
		}
	}))
	settleErr := session.Settle(150)
	require.ErrorContains(t, settleErr, "injected wallet settlement failure")
	require.NoError(t, db.Callback().Update().Remove(callbackName))

	var pending imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&pending).Error)
	assert.Equal(t, "settlement_pending", pending.Status)
	assert.Equal(t, 150, pending.ActualQuota)
	assert.Equal(t, 1, pending.RetryCount)

	require.NoError(t, model.ReconcileImageAutoBilling(info.RequestId))
	var user model.User
	require.NoError(t, db.First(&user, 151).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 251).Error)
	var settled imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&settled).Error)
	assert.Equal(t, 850, user.Quota)
	assert.Equal(t, 850, token.RemainQuota)
	assert.Equal(t, 150, token.UsedQuota)
	assert.Equal(t, "settled", settled.Status)
}

func TestImageAutoStaleReservedJournalRequiresManualReview(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	t.Setenv("IMAGE_AUTO_BILLING_LEASE_SECONDS", "900")
	require.NoError(t, db.Create(&model.User{Id: 152, Username: "stale-reserve-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 252, UserId: 152, Key: "stale-reserve-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(152, 252, "stale-reserve-token", "202607220052stale", "wallet_only")
	_, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	staleAt := common.GetTimestamp() - 901
	require.NoError(t, db.Model(&model.ImageAutoBillingJournal{}).
		Where("request_id = ?", info.RequestId).
		Updates(map[string]interface{}{"reserved_at": staleAt, "updated_at": staleAt}).Error)

	require.NoError(t, model.ReconcileImageAutoBilling(info.RequestId))
	var user model.User
	require.NoError(t, db.First(&user, 152).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 252).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
	assert.Equal(t, 600, user.Quota)
	assert.Equal(t, 600, token.RemainQuota)
	assert.Equal(t, 400, token.UsedQuota)
	assert.Equal(t, "settlement_manual_review", journal.Status)
}

func TestImageAutoReconcileBatchProcessesPendingAndStaleReserved(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	t.Setenv("IMAGE_AUTO_BILLING_LEASE_SECONDS", "900")
	require.NoError(t, db.Create(&model.User{Id: 161, Username: "batch-user-one", Password: "password", Quota: 1000, AffCode: "batch-one"}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 261, UserId: 161, Key: "batch-token-one", RemainQuota: 1000}).Error)
	require.NoError(t, db.Create(&model.User{Id: 162, Username: "batch-user-two", Password: "password", Quota: 1000, AffCode: "batch-two"}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 262, UserId: 162, Key: "batch-token-two", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	pendingInfo := newImageAutoBillingRelayInfo(161, 261, "batch-token-one", "202607220061batchpending", "wallet_only")
	_, apiErr := NewBillingSession(c, pendingInfo, 400)
	require.Nil(t, apiErr)
	require.NoError(t, db.Model(&model.ImageAutoBillingJournal{}).
		Where("request_id = ?", pendingInfo.RequestId).
		Updates(map[string]interface{}{"actual_quota": 150, "status": "settlement_pending"}).Error)

	staleInfo := newImageAutoBillingRelayInfo(162, 262, "batch-token-two", "202607220062batchstale", "wallet_only")
	_, apiErr = NewBillingSession(c, staleInfo, 400)
	require.Nil(t, apiErr)
	staleAt := common.GetTimestamp() - 901
	require.NoError(t, db.Model(&model.ImageAutoBillingJournal{}).
		Where("request_id = ?", staleInfo.RequestId).
		Updates(map[string]interface{}{"reserved_at": staleAt, "updated_at": staleAt}).Error)

	result, err := model.ReconcileImageAutoBillingBatch(100)
	require.NoError(t, err)
	assert.Equal(t, 2, result.Processed)
	assert.Zero(t, result.Failed)

	var pendingJournal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", pendingInfo.RequestId).First(&pendingJournal).Error)
	var staleJournal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", staleInfo.RequestId).First(&staleJournal).Error)
	assert.Equal(t, "settled", pendingJournal.Status)
	assert.Equal(t, "settlement_manual_review", staleJournal.Status)
}

func TestImageAutoUnknownActualRequiresManualReviewWithoutRefundingReserve(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 171, Username: "unknown-actual-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 271, UserId: 171, Key: "unknown-actual-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(171, 271, "unknown-actual-token", "202607220071unknown", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NoError(t, session.MarkSettlementUnknown(errors.New("tiered price calculation failed")))

	var pending imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&pending).Error)
	assert.Equal(t, "settlement_manual_review", pending.Status)
	assert.Zero(t, pending.ActualQuota)

	require.NoError(t, model.ReconcileImageAutoBilling(info.RequestId))
	result, err := model.ReconcileImageAutoBillingBatch(100)
	require.NoError(t, err)
	assert.Zero(t, result.Found)
	var user model.User
	require.NoError(t, db.First(&user, 171).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 271).Error)
	assert.Equal(t, 600, user.Quota)
	assert.Equal(t, 600, token.RemainQuota)
	assert.Equal(t, 400, token.UsedQuota)
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&pending).Error)
	assert.Equal(t, "settlement_manual_review", pending.Status)
}

func TestImageAutoActiveSessionRenewsLeaseBeforeStaleReconcilerCanRefund(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	t.Setenv("IMAGE_AUTO_BILLING_LEASE_SECONDS", "900")
	require.NoError(t, db.Create(&model.User{Id: 172, Username: "heartbeat-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 272, UserId: 172, Key: "heartbeat-token", RemainQuota: 1000}).Error)

	previousInterval := imageAutoBillingLeaseHeartbeatInterval
	imageAutoBillingLeaseHeartbeatInterval = func() time.Duration { return 10 * time.Millisecond }
	t.Cleanup(func() { imageAutoBillingLeaseHeartbeatInterval = previousInterval })

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(172, 272, "heartbeat-token", "202607220072heartbeat", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	t.Cleanup(func() { session.stopLeaseHeartbeat() })

	staleAt := common.GetTimestamp() - 901
	require.NoError(t, db.Model(&model.ImageAutoBillingJournal{}).
		Where("request_id = ?", info.RequestId).
		Updates(map[string]interface{}{"reserved_at": staleAt, "updated_at": staleAt}).Error)

	require.Eventually(t, func() bool {
		var journal model.ImageAutoBillingJournal
		if err := db.Where("request_id = ?", info.RequestId).First(&journal).Error; err != nil {
			return false
		}
		return journal.UpdatedAt > staleAt
	}, time.Second, 10*time.Millisecond)

	require.NoError(t, model.ReconcileImageAutoBilling(info.RequestId))
	var user model.User
	require.NoError(t, db.First(&user, 172).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 272).Error)
	var journal imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&journal).Error)
	assert.Equal(t, 600, user.Quota)
	assert.Equal(t, 600, token.RemainQuota)
	assert.Equal(t, 400, token.UsedQuota)
	assert.Equal(t, "reserved", journal.Status)
}

func TestImageAutoBillingHeartbeatStopsWhenRequestEnds(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 173, Username: "request-bound-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 273, UserId: 173, Key: "request-bound-token", RemainQuota: 1000}).Error)

	requestContext, cancelRequest := context.WithCancel(context.Background())
	c, _ := gin.CreateTestContext(nil)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil).WithContext(requestContext)
	info := newImageAutoBillingRelayInfo(173, 273, "request-bound-token", "202607220073request", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NotNil(t, session.leaseDone)

	cancelRequest()
	select {
	case <-session.leaseDone:
	case <-time.After(time.Second):
		t.Fatal("billing lease heartbeat outlived its request")
	}
}

func TestImageAutoBillingFinalizationFailureStopsHeartbeat(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 174, Username: "failed-finalize-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 274, UserId: 174, Key: "failed-finalize-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(174, 274, "failed-finalize-token", "202607220074finalize", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)
	require.NotNil(t, session.leaseDone)

	const callbackName = "test:image_auto_fail_settlement_handoff"
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "image_auto_billing_journals" {
			tx.AddError(errors.New("injected settlement handoff failure"))
		}
	}))
	require.ErrorContains(t, session.Settle(150), "injected settlement handoff failure")
	require.NoError(t, db.Callback().Update().Remove(callbackName))

	select {
	case <-session.leaseDone:
	case <-time.After(time.Second):
		t.Fatal("billing lease heartbeat continued after finalization failed")
	}
}

func TestImageAutoRefundFailureStaysPendingUntilReconcile(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	require.NoError(t, db.Create(&model.User{Id: 181, Username: "pending-refund-user", Password: "password", Quota: 1000}).Error)
	require.NoError(t, db.Create(&model.Token{Id: 281, UserId: 181, Key: "pending-refund-token", RemainQuota: 1000}).Error)

	c, _ := gin.CreateTestContext(nil)
	info := newImageAutoBillingRelayInfo(181, 281, "pending-refund-token", "202607220081pending", "wallet_only")
	session, apiErr := NewBillingSession(c, info, 400)
	require.Nil(t, apiErr)

	const callbackName = "test:image_auto_fail_wallet_refund_once"
	failWalletUpdate := true
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if failWalletUpdate && tx.Statement.Table == "users" {
			failWalletUpdate = false
			tx.AddError(errors.New("injected wallet refund failure"))
		}
	}))
	session.Refund(c)
	require.NoError(t, db.Callback().Update().Remove(callbackName))

	var pending imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&pending).Error)
	assert.Equal(t, "refund_pending", pending.Status)
	assert.Equal(t, 1, pending.RetryCount)
	var reservedUser model.User
	require.NoError(t, db.First(&reservedUser, 181).Error)
	assert.Equal(t, 600, reservedUser.Quota)

	require.NoError(t, model.ReconcileImageAutoBilling(info.RequestId))
	var user model.User
	require.NoError(t, db.First(&user, 181).Error)
	var token model.Token
	require.NoError(t, db.First(&token, 281).Error)
	var refunded imageAutoBillingJournalRow
	require.NoError(t, db.Where("request_id = ?", info.RequestId).First(&refunded).Error)
	assert.Equal(t, 1000, user.Quota)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
	assert.Equal(t, "refunded", refunded.Status)
}

func TestImageAutoBillingJournalSchemaExcludesSensitiveRequestData(t *testing.T) {
	db := setupImageAutoBillingDB(t)
	columns, err := db.Migrator().ColumnTypes(&model.ImageAutoBillingJournal{})
	require.NoError(t, err)
	names := make(map[string]struct{}, len(columns))
	for _, column := range columns {
		names[column.Name()] = struct{}{}
	}
	for _, forbidden := range []string{
		"token_key", "prompt", "upstream_url", "upstream_key", "api_key",
		"image", "request_body", "response_body",
	} {
		_, exists := names[forbidden]
		assert.False(t, exists, "journal must not contain %s", forbidden)
	}
}
