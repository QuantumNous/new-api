package model

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	stdErrors "errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestCashbackProductionDatabaseIntegration(t *testing.T) {
	tests := []struct {
		name      string
		env       string
		database  common.DatabaseType
		dialector func(string) gorm.Dialector
		useSchema bool
	}{
		{
			name:      "mysql",
			env:       "TEST_MYSQL_DSN",
			database:  common.DatabaseTypeMySQL,
			dialector: func(dsn string) gorm.Dialector { return mysql.Open(dsn) },
		},
		{
			name:     "postgres",
			env:      "TEST_POSTGRES_DSN",
			database: common.DatabaseTypePostgreSQL,
			dialector: func(dsn string) gorm.Dialector {
				return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			},
			useSchema: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			dsn := strings.TrimSpace(os.Getenv(test.env))
			if dsn == "" {
				t.Skip("set " + test.env + " to run cashback production database integration test")
			}
			testCashbackProductionDatabase(t, test.database, test.dialector(dsn), test.useSchema)
		})
	}
}

func testCashbackProductionDatabase(t *testing.T, databaseType common.DatabaseType, dialector gorm.Dialector, useSchema bool) {
	t.Helper()
	namespace := newCashbackIntegrationNamespace(t)
	tablePrefix := namespace + "_"
	if useSchema {
		tablePrefix = namespace + "."
	}
	db, err := gorm.Open(dialector, &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: tablePrefix},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	t.Cleanup(func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			t.Errorf("close cashback integration database: %v", closeErr)
		}
	})

	// Checkin has no explicit TableName: preserve the production default while
	// keeping all integration DDL and cleanup inside this test's namespace.
	require.Equal(t, "checkins", (schema.NamingStrategy{}).TableName("Checkin"))
	require.Equal(t, tablePrefix+"checkins", db.NamingStrategy.TableName("Checkin"))
	models := []any{
		&User{},
		&TopUp{},
		&EpayPaymentEvidence{},
		&AdminQuotaCreditEvidence{},
		&WalletRefundCreditEvent{},
		&Redemption{},
		&Checkin{},
		&Option{},
		&CashbackCampaign{},
		&CashbackOrderContext{},
		&CashbackReward{},
		&CashbackDeviceLink{},
		&CashbackQuotaMutation{},
		&Log{},
		&AuditLog{},
	}
	if useSchema {
		require.NoError(t, db.Exec(fmt.Sprintf(`CREATE SCHEMA "%s"`, namespace)).Error)
		t.Cleanup(func() {
			if dropErr := db.Exec(fmt.Sprintf(`DROP SCHEMA IF EXISTS "%s" CASCADE`, namespace)).Error; dropErr != nil {
				t.Errorf("drop cashback integration schema %s: %v", namespace, dropErr)
			}
		})
	} else {
		t.Cleanup(func() {
			for index := len(models) - 1; index >= 0; index-- {
				if dropErr := db.Migrator().DropTable(models[index]); dropErr != nil {
					t.Errorf("drop cashback integration table for %T: %v", models[index], dropErr)
				}
			}
		})
	}

	oldDB, oldLogDB := DB, LOG_DB
	oldMainType, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
	oldRedisEnabled := common.RedisEnabled
	oldPayment := *operation_setting.GetPaymentSetting()
	oldCashback := *operation_setting.GetCashbackSetting()
	common.OptionMapRWMutex.Lock()
	oldOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(databaseType, databaseType)
	common.RedisEnabled = false
	resetCashbackReconciliationProgress()
	t.Cleanup(func() {
		resetCashbackReconciliationProgress()
		DB, LOG_DB = oldDB, oldLogDB
		common.SetDatabaseTypes(oldMainType, oldLogType)
		common.RedisEnabled = oldRedisEnabled
		*operation_setting.GetPaymentSetting() = oldPayment
		*operation_setting.GetCashbackSetting() = oldCashback
		common.OptionMapRWMutex.Lock()
		common.OptionMap = oldOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	require.NoError(t, db.AutoMigrate(models...))
	require.NoError(t, db.AutoMigrate(models...)) // Fresh and repeated startup.
	require.True(t, db.Migrator().HasTable(&AuditLog{}))
	require.True(t, db.Migrator().HasTable(&Checkin{}))
	require.True(t, db.Migrator().HasIndex(&Checkin{}, "idx_user_checkin_date"))
	for _, cashbackModel := range []interface{}{
		&CashbackCampaign{},
		&CashbackOrderContext{},
		&CashbackReward{},
		&CashbackDeviceLink{},
		&CashbackQuotaMutation{},
		&EpayPaymentEvidence{},
		&WalletRefundCreditEvent{},
	} {
		require.True(t, db.Migrator().HasTable(cashbackModel))
	}
	require.True(t, db.Migrator().HasIndex(&CashbackReward{}, "idx_cashback_settlement_scan"))
	require.True(t, db.Migrator().HasIndex(&CashbackQuotaMutation{}, "idx_cashback_mutation_reward_kind"))
	require.True(t, db.Migrator().HasIndex(&CashbackQuotaMutation{}, "idx_cashback_mutation_topup_kind"))

	now := time.Now().Unix()
	inviter := User{
		Username:  "cashback-integration-inviter",
		Password:  "password",
		AffCode:   "cashback-integration-inviter",
		Status:    common.UserStatusEnabled,
		Role:      common.RoleCommonUser,
		CreatedAt: now - 30*24*60*60,
	}
	require.NoError(t, db.Create(&inviter).Error)
	invitee := User{
		Username:  "cashback-integration-invitee",
		Password:  "password",
		AffCode:   "cashback-integration-invitee",
		InviterId: inviter.Id,
		Status:    common.UserStatusEnabled,
		Role:      common.RoleCommonUser,
		CreatedAt: now - 30*24*60*60,
	}
	require.NoError(t, db.Create(&invitee).Error)
	legacyCheckin := Checkin{UserId: invitee.Id, CheckinDate: "2025-01-01", QuotaAwarded: 7, CreatedAt: now - 30*24*60*60}
	require.NoError(t, db.Create(&legacyCheckin).Error)
	minimumTransfer := common.QuotaFromFloat(common.QuotaPerUnit)
	transferUser := User{Username: "affiliate-integration-" + namespace, Status: common.UserStatusEnabled, Quota: 25, AffQuota: minimumTransfer}
	require.NoError(t, db.Create(&transferUser).Error)
	require.NoError(t, transferUser.TransferAffQuotaToQuota(minimumTransfer))
	var transferred User
	require.NoError(t, db.First(&transferred, transferUser.Id).Error)
	require.Equal(t, 25+minimumTransfer, transferred.Quota)
	require.Zero(t, transferred.AffQuota)
	var transferEvents []WalletRefundCreditEvent
	require.NoError(t, db.Where("user_id = ?", transferUser.Id).Order("id").Find(&transferEvents).Error)
	require.Len(t, transferEvents, 2)
	require.Equal(t, walletRefundOpening, transferEvents[0].Kind)
	require.Equal(t, walletRefundNonrefundable, transferEvents[1].Kind)
	require.EqualValues(t, minimumTransfer, transferEvents[1].Quota)
	// A rejected transfer cannot consume affiliate funds or append an event.
	require.NoError(t, db.Model(&User{}).Where("id = ?", transferUser.Id).Updates(map[string]any{
		"quota": common.MaxWalletQuota - minimumTransfer + 1, "aff_quota": minimumTransfer,
	}).Error)
	require.ErrorContains(t, transferUser.TransferAffQuotaToQuota(minimumTransfer), "钱包额度")
	require.NoError(t, db.First(&transferred, transferUser.Id).Error)
	require.Equal(t, common.MaxWalletQuota-minimumTransfer+1, transferred.Quota)
	require.Equal(t, minimumTransfer, transferred.AffQuota)
	var transferEventCount int64
	require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", transferUser.Id).Count(&transferEventCount).Error)
	require.EqualValues(t, 2, transferEventCount)
	topUp := TopUp{
		UserId:          invitee.Id,
		Amount:          1_000,
		Money:           1,
		TradeNo:         "cashback-integration-order-" + namespace,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      now - 10,
		CompleteTime:    now - 5,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, db.Create(&topUp).Error)
	require.NoError(t, db.Create(&Log{UserId: invitee.Id, Type: LogTypeConsume, CreatedAt: now - 6, Quota: 17}).Error)
	report, err := GetCashbackRecordedSpendReport(invitee.Id, now-30, now)
	require.NoError(t, err)
	require.Equal(t, "manual_reconciliation", report.RefundStatus)
	require.Len(t, report.TopUps, 1)
	require.Equal(t, int64(17), report.Intervals[0].RecordedAllConsumeLogQuota)
	require.Zero(t, report.Intervals[1].RecordedAllConsumeLogQuota)
	orderContext := CashbackOrderContext{
		TopUpID:                  topUp.Id,
		TradeNo:                  topUp.TradeNo,
		UserID:                   invitee.Id,
		PaymentProvider:          topUp.PaymentProvider,
		BaseQuota:                1_000,
		CreditedQuota:            1_000,
		DeviceSignalStatus:       CashbackDeviceSignalMissing,
		EligibleAfterFirstEnable: true,
		CompletionSource:         CashbackCompletionProviderCallback,
		CompletionProvider:       topUp.PaymentProvider,
	}
	require.NoError(t, db.Create(&orderContext).Error)
	require.Zero(t, orderContext.CampaignID) // Legacy rows remain unrelated to new campaigns.
	reward := CashbackReward{
		TopUpID:          topUp.Id,
		TradeNo:          topUp.TradeNo,
		Direction:        CashbackDirectionInviter,
		InviteeID:        invitee.Id,
		InviterID:        inviter.Id,
		BeneficiaryID:    inviter.Id,
		BaseQuota:        1_000,
		RateBPS:          1_000,
		CalculatedQuota:  100,
		RewardQuota:      100,
		SettlementDays:   1,
		ConfigVersion:    1,
		PaidAt:           now - 5,
		AvailableAt:      now - 1,
		ReviewStatus:     CashbackReviewApproved,
		ReviewedBy:       1,
		ReviewedAt:       now - 2,
		ReviewReason:     "production database integration test",
		SettlementStatus: CashbackSettlementFrozen,
		RiskLevel:        CashbackRiskLow,
		RiskSnapshot:     `{}`,
		ConfigSnapshot:   `{}`,
	}
	require.NoError(t, db.Create(&reward).Error)
	require.Empty(t, reward.ReviewSource)
	// Simulate the previous branch's cashback tables, retaining historical rows
	// and unique indexes while adding the campaign and review-source schema.
	require.NoError(t, db.Migrator().DropTable(&EpayPaymentEvidence{}))
	require.NoError(t, db.Migrator().DropTable(&WalletRefundCreditEvent{}))
	require.NoError(t, db.Migrator().DropColumn(&CashbackOrderContext{}, "campaign_id"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackOrderContext{}, "face_amount"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackOrderContext{}, "quota_per_face_unit"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackReward{}, "strategy"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackReward{}, "fixed_per_hundred"))
	require.NoError(t, db.Migrator().DropColumn(&CashbackReward{}, "review_source"))
	require.NoError(t, db.Migrator().DropTable(&CashbackCampaign{}))
	require.NoError(t, db.AutoMigrate(models...))
	require.NoError(t, db.AutoMigrate(models...))
	var upgradedCheckin Checkin
	require.NoError(t, db.First(&upgradedCheckin, legacyCheckin.Id).Error)
	require.Equal(t, legacyCheckin, upgradedCheckin)
	require.Error(t, db.Create(&Checkin{UserId: invitee.Id, CheckinDate: legacyCheckin.CheckinDate, QuotaAwarded: 9}).Error)
	require.True(t, db.Migrator().HasIndex(&Checkin{}, "idx_user_checkin_date"))
	require.True(t, db.Migrator().HasIndex(&CashbackReward{}, "ux_cashback_topup_direction"))
	require.True(t, db.Migrator().HasTable(&EpayPaymentEvidence{}))
	require.True(t, db.Migrator().HasIndex(&WalletRefundCreditEvent{}, "ux_wallet_refund_credit_event_key"))
	require.True(t, db.Migrator().HasIndex(&WalletRefundCreditEvent{}, "idx_wallet_refund_credit_user_id"))
	var historicCredits int64
	require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Count(&historicCredits).Error)
	require.Zero(t, historicCredits) // Upgrade must not invent historical refundable batches.
	var historicEvidence int64
	require.NoError(t, db.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", topUp.Id).Count(&historicEvidence).Error)
	require.Zero(t, historicEvidence)
	var oldReward CashbackReward
	require.NoError(t, db.First(&oldReward, reward.ID).Error)
	require.Equal(t, reward.ReviewStatus, oldReward.ReviewStatus)
	require.Empty(t, oldReward.Strategy) // Historical empty strategy is displayed as rate.
	require.Zero(t, oldReward.FixedPerHundred)
	var upgradedContext CashbackOrderContext
	require.NoError(t, db.First(&upgradedContext, orderContext.ID).Error)
	require.Zero(t, upgradedContext.FaceAmount)
	require.Empty(t, upgradedContext.QuotaPerFaceUnit)
	require.True(t, db.Migrator().HasColumn(&CashbackOrderContext{}, "face_amount"))
	require.True(t, db.Migrator().HasColumn(&CashbackReward{}, "strategy"))

	type issueResult struct {
		outcome CashbackSettlementOutcome
		err     error
	}
	start := make(chan struct{})
	results := make(chan issueResult, 2)
	var waitGroup sync.WaitGroup
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			outcome, issueErr := IssueCashbackReward(reward.ID, now)
			results <- issueResult{outcome: outcome, err: issueErr}
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	issuedCount := 0
	for result := range results {
		if result.err != nil {
			// Concurrent bounded reconciliation can advance the cursor between
			// reads. That is a retryable conflict, not a payout decision.
			require.ErrorIs(t, result.err, errCashbackReconciliationCursorConflict)
			continue
		}
		if result.outcome.Issued {
			issuedCount++
		}
	}
	retry, err := IssueCashbackReward(reward.ID, now)
	require.NoError(t, err)
	if retry.Issued {
		issuedCount++
	}
	require.Equal(t, 1, issuedCount)

	var storedInviter User
	require.NoError(t, db.First(&storedInviter, inviter.Id).Error)
	require.Equal(t, reward.RewardQuota, storedInviter.Quota)
	var storedReward CashbackReward
	require.NoError(t, db.First(&storedReward, reward.ID).Error)
	require.Equal(t, CashbackSettlementIssued, storedReward.SettlementStatus)
	require.Equal(t, now, storedReward.IssuedAt)
	var issueMutations []CashbackQuotaMutation
	require.NoError(t, db.Where("reward_id = ? AND kind = ?", reward.ID, CashbackQuotaMutationIssue).Find(&issueMutations).Error)
	require.Len(t, issueMutations, 1)
	require.Equal(t, fmt.Sprintf("cashback:reward:%d:issue", reward.ID), issueMutations[0].EventKey)
	require.Equal(t, reward.RewardQuota, issueMutations[0].Quota)
	var issuedAudit AuditLog
	require.NoError(t, db.Where("category = ? AND action = ? AND user_id = ?", AuditCategoryOperation, "cashback.reward_issued", inviter.Id).Take(&issuedAudit).Error)
	require.Equal(t, inviter.Id, issuedAudit.UserId)
	require.True(t, issuedAudit.Success)

	// An approved historical payer row keeps its original future hold date but
	// is picked up early on every database dialect when reviewer evidence exists.
	manual := reward
	manual.ID = 0
	manual.Direction = CashbackDirectionInvitee
	manual.BeneficiaryID = invitee.Id
	manual.AvailableAt = now + 7*24*60*60
	manual.IssuedAt = 0
	manual.SettlementStatus = CashbackSettlementFrozen
	require.NoError(t, db.Create(&manual).Error)
	run, err := SettleMaturedCashbackRewards(now, 1)
	require.NoError(t, err)
	require.Equal(t, 1, run.Scanned)
	require.Equal(t, 1, run.Issued)
	var storedManual CashbackReward
	require.NoError(t, db.First(&storedManual, manual.ID).Error)
	require.Equal(t, CashbackSettlementIssued, storedManual.SettlementStatus)
	require.Equal(t, manual.AvailableAt, storedManual.AvailableAt)
	require.Empty(t, storedManual.ReviewSource)
	var manualPayerWallet User
	require.NoError(t, db.First(&manualPayerWallet, invitee.Id).Error)
	require.Equal(t, manual.RewardQuota, manualPayerWallet.Quota)
	run, err = SettleMaturedCashbackRewards(now, 1)
	require.NoError(t, err)
	require.Zero(t, run.Issued)
	var payerMutations int64
	require.NoError(t, db.Model(&CashbackQuotaMutation{}).Where("reward_id = ? AND kind = ?", manual.ID, CashbackQuotaMutationIssue).Count(&payerMutations).Error)
	require.EqualValues(t, 1, payerMutations)

	// A reconciliation page must not combine the pre-issuance reward with
	// post-issuance mutation evidence from a different committed DB state.
	// Pause immediately after reading the reward page, then issue through the
	// scheduler's normal settlement path (the scheduler checks separately).
	snapshotOrder := topUp
	snapshotOrder.Id = 0
	snapshotOrder.TradeNo = namespace + "_snapshot_order"
	require.NoError(t, db.Create(&snapshotOrder).Error)
	snapshotContext := orderContext
	snapshotContext.ID = 0
	snapshotContext.TopUpID = snapshotOrder.Id
	snapshotContext.TradeNo = snapshotOrder.TradeNo
	require.NoError(t, db.Create(&snapshotContext).Error)
	snapshotReward := reward
	snapshotReward.ID = 0
	snapshotReward.TopUpID = snapshotOrder.Id
	snapshotReward.TradeNo = snapshotOrder.TradeNo
	require.NoError(t, db.Create(&snapshotReward).Error)
	resetCashbackReconciliationProgress()
	type pausedReconciliationScan struct{}
	pauseContext := context.WithValue(t.Context(), pausedReconciliationScan{}, true)
	readReward, releaseScan := make(chan struct{}), make(chan struct{})
	var pauseOnce sync.Once
	const snapshotScanCallback = "test:cashback-reconciliation-snapshot"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(snapshotScanCallback, func(query *gorm.DB) {
		if query.Statement.Context.Value(pausedReconciliationScan{}) == nil ||
			!strings.HasSuffix(query.Statement.Table, "cashback_rewards") || query.Error != nil {
			return
		}
		pauseOnce.Do(func() {
			close(readReward)
			<-releaseScan
		})
	}))
	snapshotScanRegistered := true
	t.Cleanup(func() {
		if snapshotScanRegistered {
			_ = db.Callback().Query().Remove(snapshotScanCallback)
		}
	})
	type scanResult struct {
		issues int64
		err    error
	}
	scanDone := make(chan scanResult, 1)
	go func() {
		issues, scanErr := cashbackReconciliationInconsistencyCountTx(db.WithContext(pauseContext), true)
		scanDone <- scanResult{issues, scanErr}
	}()
	select {
	case <-readReward:
	case <-time.After(10 * time.Second):
		close(releaseScan)
		t.Fatal("reconciliation did not read the reward page")
	}
	issued, issueErr := issueCashbackReward(snapshotReward.ID, now, false)
	close(releaseScan)
	reconciliation := <-scanDone
	require.NoError(t, issueErr)
	require.True(t, issued.Issued)
	require.NoError(t, reconciliation.err)
	require.Zero(t, reconciliation.issues)
	require.False(t, cashbackReconciliationProgress.Pinned)
	var issuedSnapshot CashbackReward
	require.NoError(t, db.First(&issuedSnapshot, snapshotReward.ID).Error)
	require.Equal(t, CashbackSettlementIssued, issuedSnapshot.SettlementStatus)
	var snapshotMutationCount int64
	require.NoError(t, db.Model(&CashbackQuotaMutation{}).Where("reward_id = ? AND kind = ?", snapshotReward.ID, CashbackQuotaMutationIssue).Count(&snapshotMutationCount).Error)
	require.EqualValues(t, 1, snapshotMutationCount)
	require.NoError(t, db.First(&storedInviter, inviter.Id).Error)
	require.Equal(t, reward.RewardQuota+snapshotReward.RewardQuota, storedInviter.Quota)
	require.NoError(t, db.Callback().Query().Remove(snapshotScanCallback))
	snapshotScanRegistered = false
	resetCashbackReconciliationProgress()
	// A real committed quota mismatch must still pin the page; the stable
	// snapshot only prevents a false mismatch across a concurrent commit.
	require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(&issueMutations[0]).Update("quota", reward.RewardQuota+1).Error)
	issues, scanErr := CashbackReconciliationInconsistencyCount()
	require.NoError(t, scanErr)
	require.Positive(t, issues)
	require.True(t, cashbackReconciliationProgress.Pinned)
	require.NoError(t, db.Session(&gorm.Session{SkipHooks: true}).Model(&issueMutations[0]).Update("quota", reward.RewardQuota).Error)
	issues, scanErr = CashbackReconciliationInconsistencyCount()
	require.NoError(t, scanErr)
	require.Zero(t, issues)
	require.False(t, cashbackReconciliationProgress.Pinned)
	resetCashbackReconciliationProgress()

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 1_000
	t.Cleanup(func() { common.QuotaPerUnit = oldQuotaPerUnit })
	for _, provider := range []struct {
		name   string
		method string
		amount int64
		settle func(string) error
	}{
		{"epay", "alipay", 1, func(tradeNo string) error {
			_, err := RechargeEpay(tradeNo, "alipay", "1.00", "127.0.0.1", EpayVerifiedDetails{GatewayTradeNo: "gateway-" + tradeNo, MerchantID: "merchant"})
			return err
		}},
		{"stripe", PaymentMethodStripe, 1, func(tradeNo string) error {
			return Recharge(tradeNo, "customer", "127.0.0.1")
		}},
		{"creem", PaymentMethodCreem, 1_000, func(tradeNo string) error {
			return RechargeCreem(tradeNo, "", "", "127.0.0.1")
		}},
		{"waffo", PaymentMethodWaffo, 1, func(tradeNo string) error {
			return RechargeWaffo(tradeNo, "127.0.0.1")
		}},
		{"waffo_pancake", PaymentMethodWaffoPancake, 1, func(tradeNo string) error {
			return RechargeWaffoPancake(tradeNo)
		}},
	} {
		t.Run("payment_"+provider.name, func(t *testing.T) {
			payer := User{Username: namespace + "_payer_" + provider.name, AffCode: "cb_pay_" + provider.name, InviterId: inviter.Id, Status: common.UserStatusEnabled}
			require.NoError(t, db.Create(&payer).Error)
			order := TopUp{
				UserId: payer.Id, Amount: provider.amount, Money: 1,
				TradeNo:         namespace + "_payment_" + provider.name,
				PaymentProvider: provider.name, PaymentMethod: provider.method,
				CreateTime: now, Status: common.TopUpStatusPending,
			}
			require.NoError(t, db.Create(&order).Error)
			ctx := CashbackOrderContext{
				TopUpID: order.Id, TradeNo: order.TradeNo, UserID: payer.Id,
				PaymentProvider: "mismatched", BaseQuota: 1_000,
				DeviceSignalStatus: CashbackDeviceSignalMissing,
			}
			require.NoError(t, db.Create(&ctx).Error)
			lockedInOrder := false
			const callbackName = "test:cashback-online-credit-locks"
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
				if !strings.HasSuffix(tx.Statement.Table, "users") {
					return
				}
				users, ok := tx.Statement.Dest.(*[]User)
				_, rowLocked := tx.Statement.Clauses["FOR"]
				if ok && rowLocked && len(*users) == 2 && (*users)[0].Id == inviter.Id && (*users)[1].Id == payer.Id {
					lockedInOrder = true
				}
			}))
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
				if strings.HasSuffix(tx.Statement.Table, "users") && !lockedInOrder {
					tx.AddError(fmt.Errorf("purchase credit preceded ordered row locks"))
				}
			}))
			if provider.name == PaymentProviderEpay {
				_, err := RechargeEpay(order.TradeNo, "alipay", "0.99", "127.0.0.1", EpayVerifiedDetails{GatewayTradeNo: "gateway-" + order.TradeNo, MerchantID: "merchant"})
				require.ErrorIs(t, err, ErrEpayPaymentAmountMismatch)
				var count int64
				require.NoError(t, db.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", order.Id).Count(&count).Error)
				require.Zero(t, count)
			}
			require.Error(t, provider.settle(order.TradeNo))
			require.True(t, lockedInOrder)
			require.NoError(t, db.Callback().Query().Remove(callbackName))
			require.NoError(t, db.Callback().Update().Remove(callbackName))
			var stored TopUp
			require.NoError(t, db.First(&stored, order.Id).Error)
			require.Equal(t, common.TopUpStatusPending, stored.Status)
			var wallet User
			require.NoError(t, db.First(&wallet, payer.Id).Error)
			require.Zero(t, wallet.Quota)
			var rolledBackEvents int64
			require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", payer.Id).Count(&rolledBackEvents).Error)
			require.Zero(t, rolledBackEvents)

			require.NoError(t, db.Model(&ctx).Update("payment_provider", provider.name).Error)
			require.NoError(t, provider.settle(order.TradeNo))
			require.NoError(t, provider.settle(order.TradeNo))
			require.NoError(t, db.First(&stored, order.Id).Error)
			require.Equal(t, common.TopUpStatusSuccess, stored.Status)
			require.NoError(t, db.First(&wallet, payer.Id).Error)
			require.Equal(t, 1_000, wallet.Quota)
			var credits []WalletRefundCreditEvent
			require.NoError(t, db.Where("user_id = ?", payer.Id).Order("id").Find(&credits).Error)
			require.Len(t, credits, 2)
			require.Equal(t, walletRefundOpening, credits[0].Kind)
			require.EqualValues(t, 0, credits[0].Quota)
			require.Equal(t, walletRefundPurchase, credits[1].Kind)
			require.Equal(t, int64(order.Id), credits[1].SourceID)
			require.EqualValues(t, 1_000, credits[1].Quota)
			require.NoError(t, db.First(&ctx, ctx.ID).Error)
			require.Equal(t, 1_000, ctx.CreditedQuota)
			var evidence []EpayPaymentEvidence
			require.NoError(t, db.Where("top_up_id = ?", order.Id).Find(&evidence).Error)
			if provider.name == PaymentProviderEpay {
				require.Len(t, evidence, 1)
				require.Equal(t, int64(100), evidence[0].PaidCents)
				require.Equal(t, "gateway-"+order.TradeNo, evidence[0].GatewayTradeNo)
			} else {
				require.Empty(t, evidence)
			}
		})
	}

	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	setting := operation_setting.DefaultCashbackSetting()
	setting.InviteeEnabled, setting.InviteeRateBPS = true, 500
	setting.MaxRewardQuota, setting.DailyRewardQuota = 10_000, 10_000
	setting.FirstEnabledAt, setting.Version = now-20, 1
	setting.AutoReviewEnabled = true
	require.NoError(t, SaveCashbackSetting(setting))
	policyKey := operation_setting.CashbackSettingName + ".auto_review_risk_flags"
	loadedPolicy, err := GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.Nil(t, loadedPolicy.AutoReviewRiskFlags)
	// A legacy replacement updates the version without activating the absent policy.
	_, setting, err = UpdateCashbackSettingAtomic(setting, true, now)
	require.NoError(t, err)
	var policyRows int64
	require.NoError(t, db.Model(&Option{}).Where(map[string]any{"key": policyKey}).Count(&policyRows).Error)
	require.Zero(t, policyRows)
	emptyPolicy := []string{}
	_, setting, err = UpdateCashbackSettingAtomic(setting, true, now, operation_setting.CashbackReviewPolicyUpdate{
		AutoReviewRiskFlags: &emptyPolicy,
	})
	require.NoError(t, err)
	require.NotNil(t, setting.AutoReviewRiskFlags)
	require.Empty(t, setting.AutoReviewRiskFlags)
	loadedPolicy, err = GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.NotNil(t, loadedPolicy.AutoReviewRiskFlags)
	require.Empty(t, loadedPolicy.AutoReviewRiskFlags)
	campaign := CashbackCampaign{StartAt: now - 10, EndAt: now + 3600, MaxRewardsPerUser: 1, CreatedBy: 1}
	require.NoError(t, db.Create(&campaign).Error)
	payer := User{Username: namespace + "_campaign_payer", AffCode: "payer_" + namespace[len(namespace)-8:], Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&payer).Error)
	preview, err := PreviewPayerCashback(payer.Id, 1_000, 1, "1000")
	require.NoError(t, err)
	require.Equal(t, "estimated", preview.Status)
	require.Equal(t, 50, preview.RewardQuota)
	var previewWrites int64
	require.NoError(t, db.Model(&CashbackReward{}).Where("beneficiary_id = ?", payer.Id).Count(&previewWrites).Error)
	require.Zero(t, previewWrites)
	orders := make([]TopUp, 2)
	for i := range orders {
		orders[i] = TopUp{UserId: payer.Id, Amount: 1, Money: 1, TradeNo: fmt.Sprintf("%s_campaign_%d", namespace, i),
			PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
		require.NoError(t, insertCashbackTestTopUp(&orders[i], 1_000, CashbackRequestMetadata{}))
		var ctx CashbackOrderContext
		require.NoError(t, db.Where("top_up_id = ?", orders[i].Id).First(&ctx).Error)
		require.Equal(t, campaign.ID, ctx.CampaignID)
	}
	start = make(chan struct{})
	errors := make(chan error, 2)
	for i := range orders {
		waitGroup.Add(1)
		go func(tradeNo string) {
			defer waitGroup.Done()
			<-start
			_, err := RechargeEpay(tradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tradeNo))
			errors <- err
		}(orders[i].TradeNo)
	}
	close(start)
	waitGroup.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	var payerRewards []CashbackReward
	require.NoError(t, db.Where("beneficiary_id = ? AND direction = ?", payer.Id, CashbackDirectionInvitee).Find(&payerRewards).Error)
	require.Len(t, payerRewards, 1)
	require.Equal(t, preview.RewardQuota, payerRewards[0].RewardQuota)
	preview, err = PreviewPayerCashback(payer.Id, 1_000, 1, "1000")
	require.NoError(t, err)
	require.Equal(t, "limit_reached", preview.Status)
	require.Zero(t, preview.RewardQuota)
	require.Equal(t, CashbackReviewAutomatic, payerRewards[0].ReviewSource)
	require.Equal(t, CashbackSettlementIssued, payerRewards[0].SettlementStatus)
	var payerWallet User
	require.NoError(t, db.First(&payerWallet, payer.Id).Error)
	require.Equal(t, 2_000+payerRewards[0].RewardQuota, payerWallet.Quota)
	var ordered []WalletRefundCreditEvent
	require.NoError(t, db.Where("user_id = ?", payer.Id).Order("id").Find(&ordered).Error)
	require.Len(t, ordered, 4)
	require.Equal(t, []string{walletRefundOpening, walletRefundPurchase, walletRefundGift, walletRefundPurchase},
		[]string{ordered[0].Kind, ordered[1].Kind, ordered[2].Kind, ordered[3].Kind})
	require.Equal(t, payerRewards[0].ID, ordered[2].SourceID)
	require.EqualValues(t, payerRewards[0].RewardQuota, ordered[2].Quota)

	// Under a first-top-up campaign, concurrent completions for one payer
	// serialize on the payer row: exactly one is first, the other is recorded
	// as a canceled not_first_top_up reward.
	require.NoError(t, db.Model(&campaign).Update("payer_scope", CashbackPayerScopeFirstTopUp).Error)
	firstPayer := User{Username: namespace + "_first_payer", AffCode: "first_" + namespace[len(namespace)-8:], Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&firstPayer).Error)
	firstOrders := make([]TopUp, 2)
	for i := range firstOrders {
		firstOrders[i] = TopUp{UserId: firstPayer.Id, Amount: 1, Money: 1, TradeNo: fmt.Sprintf("%s_first_%d", namespace, i),
			PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
		require.NoError(t, insertCashbackTestTopUp(&firstOrders[i], 1_000, CashbackRequestMetadata{}))
	}
	start = make(chan struct{})
	firstResults := make(chan error, 2)
	for i := range firstOrders {
		waitGroup.Add(1)
		go func(tradeNo string) {
			defer waitGroup.Done()
			<-start
			_, err := RechargeEpay(tradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tradeNo))
			firstResults <- err
		}(firstOrders[i].TradeNo)
	}
	close(start)
	waitGroup.Wait()
	close(firstResults)
	for err := range firstResults {
		require.NoError(t, err)
	}
	var firstRewards []CashbackReward
	require.NoError(t, db.Where("beneficiary_id = ? AND direction = ?", firstPayer.Id, CashbackDirectionInvitee).Order("reward_quota desc").Find(&firstRewards).Error)
	require.Len(t, firstRewards, 2)
	require.Positive(t, firstRewards[0].RewardQuota)
	require.Zero(t, firstRewards[1].RewardQuota)
	require.Equal(t, "not_first_top_up", firstRewards[1].CapReason)
	require.Equal(t, CashbackSettlementCanceled, firstRewards[1].SettlementStatus)
	preview, err = PreviewPayerCashback(firstPayer.Id, 1_000, 1, "1000")
	require.NoError(t, err)
	require.Equal(t, "not_first_top_up", preview.Status)
	require.NoError(t, db.Model(&campaign).Update("payer_scope", CashbackPayerScopeEveryOrder).Error)

	selectedPolicy := []string{"device_missing"}
	_, setting, err = UpdateCashbackSettingAtomic(setting, true, now, operation_setting.CashbackReviewPolicyUpdate{
		AutoReviewRiskFlags: &selectedPolicy,
	})
	require.NoError(t, err)
	invalidPolicy := []string{"device_missing", "device_missing"}
	_, _, err = UpdateCashbackSettingAtomic(setting, true, now, operation_setting.CashbackReviewPolicyUpdate{
		AutoReviewRiskFlags: &invalidPolicy,
	})
	require.Error(t, err)
	loadedPolicy, err = GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.Equal(t, setting.Version, loadedPolicy.Version)
	require.Equal(t, selectedPolicy, loadedPolicy.AutoReviewRiskFlags)
	policyPayer := User{Username: namespace + "_policy_payer", AffCode: "policy_" + namespace[len(namespace)-8:],
		Status: common.UserStatusEnabled, CreatedAt: now - 30*24*60*60}
	require.NoError(t, db.Create(&policyPayer).Error)
	policyOrder := TopUp{UserId: policyPayer.Id, Amount: 1, Money: 1, TradeNo: namespace + "_policy_order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&policyOrder, 1_000, CashbackRequestMetadata{}))
	_, err = RechargeEpay(policyOrder.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(policyOrder.TradeNo))
	require.NoError(t, err)
	var policyReward CashbackReward
	require.NoError(t, db.Where("top_up_id = ? AND direction = ?", policyOrder.Id, CashbackDirectionInvitee).First(&policyReward).Error)
	require.Equal(t, CashbackReviewPending, policyReward.ReviewStatus)
	require.Equal(t, CashbackSettlementFrozen, policyReward.SettlementStatus)
	var policySnapshot CashbackRiskSnapshot
	require.NoError(t, common.Unmarshal([]byte(policyReward.RiskSnapshot), &policySnapshot))
	require.Equal(t, "selected_flags", policySnapshot.AutoReviewDecision)
	require.Equal(t, selectedPolicy, policySnapshot.AutoReviewMatchedFlags)
	require.Contains(t, policyReward.ConfigSnapshot, `"auto_review_risk_flags":["device_missing"]`)
	var policyWallet User
	require.NoError(t, db.First(&policyWallet, policyPayer.Id).Error)
	require.Equal(t, 1_000, policyWallet.Quota) // The signed purchase succeeds; only cashback waits for review.
	_, err = RechargeEpay(policyOrder.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(policyOrder.TradeNo))
	require.NoError(t, err)
	require.NoError(t, db.Model(&CashbackReward{}).Where("top_up_id = ?", policyOrder.Id).Count(&policyRows).Error)
	require.EqualValues(t, 1, policyRows)
	setting.AutoReviewRiskFlags = []string{}
	require.NoError(t, SaveCashbackSetting(setting))
	var unchanged CashbackReward
	require.NoError(t, db.First(&unchanged, policyReward.ID).Error)
	require.Equal(t, policyReward.RiskSnapshot, unchanged.RiskSnapshot)
	require.Equal(t, policyReward.ConfigSnapshot, unchanged.ConfigSnapshot)
	require.Equal(t, CashbackReviewPending, unchanged.ReviewStatus)

	// Real dialect read path: source joins, ordered grants, paid-cents
	// proration and the optional log database stay independent.
	t.Setenv("CASHBACK_REFUND_REFERENCE_ENABLED", "true")
	report, err = GetCashbackRecordedSpendReport(payer.Id, now-10, time.Now().Unix()+1, orders[0].Id, orders[1].Id)
	require.NoError(t, err)
	require.Equal(t, "reference", report.RefundStatus)
	require.NotNil(t, report.TotalReferenceCNYCents)
	require.EqualValues(t, 200, *report.TotalReferenceCNYCents)
	require.Len(t, report.Credits, 4)

	// Commit a concurrent balance/source change after the first wallet read.
	// The following report must read both the old balance and old proof from
	// the same repeatable-read snapshot on MySQL and PostgreSQL.
	const snapshotCallback = "test:cashback-report-snapshot"
	changed := false
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(snapshotCallback, func(query *gorm.DB) {
		if changed || !strings.HasSuffix(query.Statement.Table, "users") || query.Error != nil {
			return
		}
		changed = true
		if err := db.Transaction(func(writer *gorm.DB) error {
			if err := writer.Model(&User{}).Where("id = ?", payer.Id).Update("quota", payerWallet.Quota-10).Error; err != nil {
				return err
			}
			return writer.Model(&EpayPaymentEvidence{}).Where("top_up_id = ?", orders[0].Id).Update("paid_cents", 90).Error
		}); err != nil {
			query.AddError(err)
		}
	}))
	callbackRegistered := true
	t.Cleanup(func() {
		if callbackRegistered {
			_ = db.Callback().Query().Remove(snapshotCallback)
		}
	})
	snapshot, err := GetCashbackRecordedSpendReport(payer.Id, now-10, time.Now().Unix()+1, orders[0].Id, orders[1].Id)
	require.NoError(t, err)
	require.True(t, changed)
	require.NotNil(t, snapshot.TotalReferenceCNYCents)
	require.EqualValues(t, 200, *snapshot.TotalReferenceCNYCents)
	require.NotNil(t, snapshot.WalletQuota)
	require.EqualValues(t, payerWallet.Quota, *snapshot.WalletQuota)
	require.NoError(t, db.Callback().Query().Remove(snapshotCallback))
	callbackRegistered = false

	// Exercise the real payment and report paths on each dialect: the new
	// registration opening is nonrefundable, the signed 90 CNY payment buys
	// 100 quota, and only half the purchased quota survives ordinary spending.
	common.QuotaPerUnit = 1
	previousWelcome := common.QuotaForNewUser
	common.QuotaForNewUser = 4
	t.Cleanup(func() { common.QuotaForNewUser = previousWelcome })
	referencePayer := User{Username: namespace + "_refund_reference", Status: common.UserStatusEnabled}
	require.NoError(t, db.Transaction(func(tx *gorm.DB) error { return referencePayer.InsertWithTx(tx, 0) }))
	referenceOrder := TopUp{UserId: referencePayer.Id, Amount: 100, Money: 90, TradeNo: namespace + "_refund_reference_order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, insertCashbackTestTopUp(&referenceOrder, 100, CashbackRequestMetadata{}))
	_, err = RechargeEpay(referenceOrder.TradeNo, "alipay", "90.00", "127.0.0.1", epayTestDetails(referenceOrder.TradeNo))
	require.NoError(t, err)
	var referenceRewards []CashbackReward
	require.NoError(t, db.Where("top_up_id = ? AND direction = ?", referenceOrder.Id, CashbackDirectionInvitee).Find(&referenceRewards).Error)
	require.Len(t, referenceRewards, 1)
	require.Equal(t, CashbackSettlementIssued, referenceRewards[0].SettlementStatus)
	require.Equal(t, 5, referenceRewards[0].RewardQuota)
	require.NoError(t, db.Model(&User{}).Where("id = ?", referencePayer.Id).Update("quota", 55).Error) // opening 4 + purchase 100 + gift 5 - net spend 54

	checkinSetting := operation_setting.GetCheckinSetting()
	previousCheckinSetting := *checkinSetting
	t.Cleanup(func() { *checkinSetting = previousCheckinSetting })
	*checkinSetting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 5, MaxQuota: 5}
	checkinBoundUser := User{Username: namespace + "_checkin_bound", AffCode: namespace + "_c", Status: common.UserStatusEnabled, Quota: common.MaxWalletQuota - 4}
	require.NoError(t, db.Create(&checkinBoundUser).Error)
	_, err = UserCheckin(checkinBoundUser.Id)
	require.ErrorContains(t, err, "钱包额度")
	var rejectedCheckins, rejectedEvents int64
	require.NoError(t, db.Model(&Checkin{}).Where("user_id = ?", checkinBoundUser.Id).Count(&rejectedCheckins).Error)
	require.NoError(t, db.Model(&WalletRefundCreditEvent{}).Where("user_id = ?", checkinBoundUser.Id).Count(&rejectedEvents).Error)
	require.Zero(t, rejectedCheckins)
	require.Zero(t, rejectedEvents)
	var checkinBoundWallet User
	require.NoError(t, db.First(&checkinBoundWallet, checkinBoundUser.Id).Error)
	require.Equal(t, common.MaxWalletQuota-4, checkinBoundWallet.Quota)
	*checkinSetting = operation_setting.CheckinSetting{Enabled: true, MinQuota: 0, MaxQuota: 0}
	zeroCheckin, err := UserCheckin(referencePayer.Id)
	require.NoError(t, err)
	require.Zero(t, zeroCheckin.QuotaAwarded)
	var storedCheckin Checkin
	require.NoError(t, db.First(&storedCheckin, zeroCheckin.Id).Error)
	require.Equal(t, referencePayer.Id, storedCheckin.UserId)
	var referenceWallet User
	require.NoError(t, db.First(&referenceWallet, referencePayer.Id).Error)
	require.Equal(t, 55, referenceWallet.Quota)
	referenceReport, err := GetCashbackRecordedSpendReport(referencePayer.Id, now-10, time.Now().Unix()+1, referenceOrder.Id)
	require.NoError(t, err)
	require.Equal(t, "reference", referenceReport.RefundStatus)
	require.Len(t, referenceReport.Credits, 3) // Zero-award checkin did not create a grant.
	require.EqualValues(t, 4, referenceReport.Credits[0].Quota)
	require.Equal(t, walletRefundOpening, referenceReport.Credits[0].Kind)
	require.Equal(t, walletRefundPurchase, referenceReport.Credits[1].Kind)
	require.EqualValues(t, 50, referenceReport.Credits[1].RemainingQuota)
	require.Equal(t, walletRefundGift, referenceReport.Credits[2].Kind)
	require.EqualValues(t, 5, referenceReport.Credits[2].RemainingQuota)
	require.Len(t, referenceReport.TopUps, 1)
	require.EqualValues(t, 50, *referenceReport.TopUps[0].RemainingPurchaseQuota)
	require.EqualValues(t, 5, *referenceReport.TopUps[0].RemainingGiftQuota)
	require.EqualValues(t, 4500, *referenceReport.TopUps[0].ReferenceCNYCents)
	require.EqualValues(t, 4500, *referenceReport.TotalReferenceCNYCents)
	require.True(t, referenceReport.SettlementAssumed) // CNY is confirmed for this read, not signed as a currency.
	unconfirmed, err := GetCashbackRecordedSpendReport(referencePayer.Id, now-10, time.Now().Unix()+1)
	require.NoError(t, err)
	require.Equal(t, "manual_reconciliation", unconfirmed.RefundStatus)
	require.Nil(t, unconfirmed.TotalReferenceCNYCents)
	require.Nil(t, unconfirmed.TopUps[0].ReferenceCNYCents)

	// A wallet redemption is ordered after the gift but cannot itself become
	// refundable cash; refreshing the report leaves the payment reference intact.
	code := Redemption{Key: namespace[len(namespace)-16:] + "_refund_code", Quota: 7, Status: common.RedemptionCodeStatusEnabled}
	require.NoError(t, db.Create(&code).Error)
	_, err = Redeem(code.Key, referencePayer.Id)
	require.NoError(t, err)
	afterRedemption, err := GetCashbackRecordedSpendReport(referencePayer.Id, now-10, time.Now().Unix()+1, referenceOrder.Id)
	require.NoError(t, err)
	require.Equal(t, "reference", afterRedemption.RefundStatus)
	require.Len(t, afterRedemption.Credits, 4)
	require.Equal(t, "redemption", afterRedemption.Credits[3].SourceType)
	require.Equal(t, walletRefundNonrefundable, afterRedemption.Credits[3].Kind)
	require.EqualValues(t, 7, afterRedemption.Credits[3].RemainingQuota)
	require.Nil(t, afterRedemption.Credits[3].ReferenceCNYCents)
	require.EqualValues(t, 4500, *afterRedemption.TotalReferenceCNYCents)
	require.NoError(t, db.First(&referenceWallet, referencePayer.Id).Error)
	require.Equal(t, 62, referenceWallet.Quota)
	common.QuotaPerUnit = 1_000

	// A pre-context order manually completed on this dialect is still a FIFO
	// purchase, but never has a signed CNY price or cashback eligibility.
	manualUser := User{Username: namespace + "_manual", AffCode: "manual_" + namespace[len(namespace)-8:], Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&manualUser).Error)
	manualOrder := TopUp{UserId: manualUser.Id, Amount: 1, Money: 1, TradeNo: namespace + "_manual_order", PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now - 30, Status: common.TopUpStatusPending}
	require.NoError(t, db.Create(&manualOrder).Error)
	require.NoError(t, ManualCompleteTopUp(manualOrder.TradeNo, "127.0.0.1"))
	manualReport, err := GetCashbackRecordedSpendReport(manualUser.Id, now-10, time.Now().Unix()+1)
	require.NoError(t, err)
	require.Equal(t, "cash_amount_or_currency_unconfirmed", manualReport.ManualReason)
	require.Len(t, manualReport.Credits, 2)
	require.Equal(t, "manual_topup", manualReport.Credits[1].SourceType)
	require.EqualValues(t, common.QuotaPerUnit, manualReport.Credits[1].RemainingQuota)

	createStart := make(chan struct{})
	campaignResults := make(chan error, 2)
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-createStart
			_, err := CreateCashbackCampaign(now+7200, now+10800, 1, 1, CashbackPayerScopeEveryOrder)
			campaignResults <- err
		}()
	}
	close(createStart)
	waitGroup.Wait()
	close(campaignResults)
	succeeded, conflicted := 0, 0
	for result := range campaignResults {
		switch {
		case result == nil:
			succeeded++
		case stdErrors.Is(result, ErrCashbackInvalidState):
			conflicted++
		default:
			require.NoError(t, result)
		}
	}
	require.Equal(t, 1, succeeded)
	require.Equal(t, 1, conflicted)

	// A verified payment holding the bound campaign row must finish before
	// early stop. A subsequent pending order belongs to the same campaign but
	// cannot earn payer cashback after stop; inviter cashback remains eligible.
	setting.InviterEnabled, setting.InviterRateBPS = true, 500
	require.NoError(t, SaveCashbackSetting(setting))
	paymentPayer := User{Username: namespace + "_payment_before_stop", AffCode: "before_stop_" + namespace[len(namespace)-8:],
		InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&paymentPayer).Error)
	pendingPayer := User{Username: namespace + "_payment_after_stop", AffCode: "after_stop_" + namespace[len(namespace)-8:],
		InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&pendingPayer).Error)
	before := TopUp{UserId: paymentPayer.Id, Amount: 1, Money: 1, TradeNo: namespace + "_before_stop",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	after := TopUp{UserId: pendingPayer.Id, Amount: 1, Money: 1, TradeNo: namespace + "_after_stop",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	for _, order := range []*TopUp{&before, &after} {
		require.NoError(t, insertCashbackTestTopUp(order, 1_000, CashbackRequestMetadata{}))
		var ctx CashbackOrderContext
		require.NoError(t, db.Where("top_up_id = ?", order.Id).First(&ctx).Error)
		require.Equal(t, campaign.ID, ctx.CampaignID)
	}
	const beforeLockCallback = "test:cashback-payment-stop-before-lock"
	const afterLockCallback = "test:cashback-payment-stop-after-lock"
	paymentLocked := make(chan struct{})
	stopAttempted := make(chan struct{}, 1)
	releasePayment := make(chan struct{})
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register(beforeLockCallback, func(tx *gorm.DB) {
		if !strings.HasSuffix(tx.Statement.Table, "cashback_campaigns") {
			return
		}
		if _, locked := tx.Statement.Clauses["FOR"]; !locked {
			return
		}
		select {
		case <-paymentLocked:
			select {
			case stopAttempted <- struct{}{}:
			default:
			}
		default:
		}
	}))
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(afterLockCallback, func(tx *gorm.DB) {
		if !strings.HasSuffix(tx.Statement.Table, "cashback_campaigns") || tx.Error != nil {
			return
		}
		if _, locked := tx.Statement.Clauses["FOR"]; !locked {
			return
		}
		select {
		case <-paymentLocked:
		default:
			close(paymentLocked)
			<-releasePayment
		}
	}))
	paymentResult := make(chan error, 1)
	go func() {
		_, err := RechargeEpay(before.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(before.TradeNo))
		paymentResult <- err
	}()
	select {
	case <-paymentLocked:
	case <-time.After(10 * time.Second):
		close(releasePayment)
		t.Fatal("payment did not lock the campaign row")
	}
	stopResult := make(chan error, 1)
	go func() {
		_, err := StopCashbackCampaign(campaign.ID, 1)
		stopResult <- err
	}()
	select {
	case <-stopAttempted:
	case <-time.After(10 * time.Second):
		close(releasePayment)
		t.Fatal("early stop did not attempt the campaign row lock")
	}
	close(releasePayment)
	require.NoError(t, <-paymentResult)
	require.NoError(t, <-stopResult)
	require.NoError(t, db.Callback().Query().Remove(beforeLockCallback))
	require.NoError(t, db.Callback().Query().Remove(afterLockCallback))
	var paid TopUp
	require.NoError(t, db.First(&paid, before.Id).Error)
	var stopped CashbackCampaign
	require.NoError(t, db.First(&stopped, campaign.ID).Error)
	require.LessOrEqual(t, paid.CompleteTime, stopped.StoppedAt)
	var paidRewards []CashbackReward
	require.NoError(t, db.Where("top_up_id = ?", before.Id).Find(&paidRewards).Error)
	require.Len(t, paidRewards, 2)
	for _, reward := range paidRewards {
		require.Equal(t, paid.CompleteTime, reward.PaidAt)
	}
	_, err = RechargeEpay(after.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(after.TradeNo))
	require.NoError(t, err)
	var stoppedRewards []CashbackReward
	require.NoError(t, db.Where("top_up_id = ?", after.Id).Find(&stoppedRewards).Error)
	require.Len(t, stoppedRewards, 1)
	require.Equal(t, CashbackDirectionInviter, stoppedRewards[0].Direction)

	// Exercise the fixed rule on both real dialects after upgrading historical rows.
	setting.InviteeEnabled = false
	setting.MaxRewardQuota, setting.DailyRewardQuota = 100_000, 100_000
	setting.InviterStrategy = operation_setting.CashbackStrategyPerHundred
	setting.InviterFixedPerHundred = 20
	require.NoError(t, SaveCashbackSetting(setting))
	fixedPayer := User{Username: namespace + "_fixed_payer", AffCode: "fixed_" + namespace[len(namespace)-8:],
		InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&fixedPayer).Error)
	fixedOrder := TopUp{UserId: fixedPayer.Id, Amount: 250, Money: 1, TradeNo: namespace + "_fixed_order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, InsertOnlineTopUp(&fixedOrder, 250_000,
		CashbackRequestMetadata{FaceAmount: 250, QuotaPerFaceUnit: "1000"}))
	setting.InviterFixedPerHundred = 30
	require.NoError(t, SaveCashbackSetting(setting))
	_, err = RechargeEpay(fixedOrder.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(fixedOrder.TradeNo))
	require.NoError(t, err)
	var fixedReward CashbackReward
	require.NoError(t, db.Where("top_up_id = ? AND direction = ?", fixedOrder.Id, CashbackDirectionInviter).First(&fixedReward).Error)
	require.Equal(t, operation_setting.CashbackStrategyPerHundred, fixedReward.Strategy)
	require.Equal(t, 30, fixedReward.FixedPerHundred)
	require.Equal(t, 60_000, fixedReward.CalculatedQuota)
	require.Equal(t, 60_000, fixedReward.RewardQuota)

	// The Option JSON, cache and reward snapshot round-trip on each real engine.
	setting.InviterStrategy = operation_setting.CashbackStrategyTiered
	tiers := []operation_setting.CashbackTier{{ThresholdCents: 10050, RewardCents: 250}, {ThresholdCents: 20000, RewardCents: 1500}}
	candidate := setting
	_, stored, err := UpdateCashbackSettingAtomic(candidate, true, now, operation_setting.CashbackReviewPolicyUpdate{Strategy: operation_setting.CashbackStrategyUpdate{
		InviterStrategy: &candidate.InviterStrategy, InviterTiers: &tiers,
	}})
	require.NoError(t, err)
	require.Equal(t, tiers, stored.InviterTiers)
	loaded, err := GetCashbackSettingFromDB()
	require.NoError(t, err)
	require.Equal(t, tiers, loaded.InviterTiers)
	require.Equal(t, tiers, operation_setting.GetCashbackSetting().InviterTiers)

	tierPayer := User{Username: namespace + "_tier_payer", AffCode: "tier_" + namespace[len(namespace)-8:], InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&tierPayer).Error)
	tierOrder := TopUp{UserId: tierPayer.Id, Amount: 201, Money: 1, TradeNo: namespace + "_tier_order",
		PaymentProvider: PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: now, Status: common.TopUpStatusPending}
	require.NoError(t, InsertOnlineTopUp(&tierOrder, 201_000, CashbackRequestMetadata{FaceAmount: 201, QuotaPerFaceUnit: "1000"}))
	_, err = RechargeEpay(tierOrder.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tierOrder.TradeNo))
	require.NoError(t, err)
	var tierReward CashbackReward
	require.NoError(t, db.Where("top_up_id = ? AND direction = ?", tierOrder.Id, CashbackDirectionInviter).First(&tierReward).Error)
	require.Equal(t, operation_setting.CashbackStrategyTiered, tierReward.Strategy)
	require.Equal(t, 15_000, tierReward.RewardQuota)
	require.Contains(t, tierReward.ConfigSnapshot, `"threshold_cents":20000`)
	_, err = RechargeEpay(tierOrder.TradeNo, "alipay", "1.00", "127.0.0.1", epayTestDetails(tierOrder.TradeNo))
	require.NoError(t, err)
	var count int64
	require.NoError(t, db.Model(&CashbackReward{}).Where("top_up_id = ?", tierOrder.Id).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func newCashbackIntegrationNamespace(t *testing.T) string {
	t.Helper()
	bytes := make([]byte, 8)
	_, err := rand.Read(bytes)
	require.NoError(t, err)
	return "cashback_it_" + hex.EncodeToString(bytes)
}
