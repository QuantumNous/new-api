package service

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWalletRenewalRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr := miniredis.RunT(t)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
	})
	return mr
}

func cacheUserQuota(t *testing.T, userID int, quota int) {
	t.Helper()
	require.NoError(t, common.RedisHSetObj(
		fmt.Sprintf("user:v2:%d", userID),
		&model.UserBase{Id: userID, Quota: quota, Status: common.UserStatusEnabled, Group: "plg"},
		0,
	))
}

func TestRefundSubscriptionTermSegmentCreditsOnlyNotStartedOneTimeCanonicalValue(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7601, 25)
	plan := insertPurchaseServicePlan(t, 7701, 1, 12, 1200)
	contract := model.UserSubscriptionContract{
		UserId:        7601,
		Status:        model.SubscriptionContractStatusActive,
		PaymentMode:   model.SubscriptionPaymentModePrepaid,
		CurrentPlanId: plan.Id,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{
		UserId:             7601,
		PlanId:             plan.Id,
		Money:              99,
		TradeNo:            "term-refund-local-currency",
		PaymentMethod:      SubscriptionPaymentChoicePix,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusSuccess,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     2,
		UnitPrice:          49.5,
		PaymentCurrency:    "BRL",
		PaymentAmountMinor: 9900,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{
		ContractId:     contract.Id,
		OrderId:        order.Id,
		PlanId:         plan.Id,
		SegmentIndex:   1,
		StartTime:      common.GetTimestamp() + 3600,
		EndTime:        common.GetTimestamp() + 7200,
		AllocatedMoney: plan.PriceAmount,
		Status:         model.SubscriptionTermStatusNotStarted,
	}
	require.NoError(t, model.DB.Create(&term).Error)

	result, err := RefundSubscriptionTermSegment(7601, term.Id)

	require.NoError(t, err)
	require.Equal(t, int64(1200), result.RefundedQuota)
	require.Equal(t, float64(12), result.RefundedMoney)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7601).Error)
	require.Equal(t, 1225, user.Quota)
	var stored model.SubscriptionTermSegment
	require.NoError(t, model.DB.First(&stored, "id = ?", term.Id).Error)
	require.Equal(t, model.SubscriptionTermStatusRefunded, stored.Status)
	require.NotNil(t, stored.RefundKey)
	var ledger model.WalletLedgerEntry
	require.NoError(t, model.DB.Where("entry_key = ?", *stored.RefundKey).First(&ledger).Error)
	require.Equal(t, int64(1200), ledger.QuotaDelta)
	require.Equal(t, float64(12), ledger.MoneyAmount)
	require.Equal(t, model.WalletLedgerEntryTypePrepaidRefund, ledger.EntryType)
}

func TestListRefundableSubscriptionTermsOnlyReturnsCurrentUserFutureOneTimeTerms(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7610, 0)
	require.NoError(t, model.DB.Create(&model.User{
		Id:       7611,
		Username: "purchase_user_other_" + t.Name(),
		Status:   common.UserStatusEnabled,
		Group:    "plg",
		AffCode:  "purchase_aff_other_" + t.Name(),
	}).Error)
	plan := insertPurchaseServicePlan(t, 7710, 1, 99, 9900)
	otherPlan := insertPurchaseServicePlan(t, 7711, 2, 7, 700)
	now := common.GetTimestamp()

	contract := model.UserSubscriptionContract{UserId: 7610, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	otherContract := model.UserSubscriptionContract{UserId: 7611, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: otherPlan.Id}
	require.NoError(t, model.DB.Create(&otherContract).Error)

	oneTime := model.SubscriptionOrder{UserId: 7610, PlanId: plan.Id, TradeNo: "refundable-list-one-time", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&oneTime).Error)
	pending := model.SubscriptionOrder{UserId: 7610, PlanId: plan.Id, TradeNo: "refundable-list-pending", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusPending}
	require.NoError(t, model.DB.Create(&pending).Error)
	failed := model.SubscriptionOrder{UserId: 7610, PlanId: plan.Id, TradeNo: "refundable-list-failed", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusFailed}
	require.NoError(t, model.DB.Create(&failed).Error)
	recurring := model.SubscriptionOrder{UserId: 7610, PlanId: plan.Id, TradeNo: "refundable-list-recurring", PaymentMethod: model.PaymentMethodStripe, PaymentProvider: model.PaymentProviderStripe, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&recurring).Error)
	foreign := model.SubscriptionOrder{UserId: 7611, PlanId: otherPlan.Id, TradeNo: "refundable-list-foreign", PaymentMethod: model.PaymentMethodBalance, PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&foreign).Error)

	olderFuture := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: oneTime.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: now + 3600, EndTime: now + 3*86400, AllocatedMoney: 8.50, Status: model.SubscriptionTermStatusNotStarted}
	laterFuture := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: oneTime.Id, PlanId: plan.Id, SegmentIndex: 1, StartTime: now + 7200, EndTime: now + 4*86400, AllocatedMoney: 2.25, Status: model.SubscriptionTermStatusNotStarted}
	startedNotStarted := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: oneTime.Id, PlanId: plan.Id, SegmentIndex: 2, StartTime: now - 3600, EndTime: now + 86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	active := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: oneTime.Id, PlanId: plan.Id, SegmentIndex: 3, StartTime: now - 3600, EndTime: now + 86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusActive}
	refunded := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: oneTime.Id, PlanId: plan.Id, SegmentIndex: 4, StartTime: now + 10800, EndTime: now + 5*86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusRefunded}
	pendingTerm := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: pending.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: now + 14400, EndTime: now + 6*86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	failedTerm := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: failed.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: now + 18000, EndTime: now + 7*86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	recurringTerm := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: recurring.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: now + 14400, EndTime: now + 6*86400, AllocatedMoney: 4, Status: model.SubscriptionTermStatusNotStarted}
	foreignTerm := model.SubscriptionTermSegment{ContractId: otherContract.Id, OrderId: foreign.Id, PlanId: otherPlan.Id, SegmentIndex: 0, StartTime: now + 18000, EndTime: now + 7*86400, AllocatedMoney: 7, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&olderFuture).Error)
	require.NoError(t, model.DB.Create(&laterFuture).Error)
	require.NoError(t, model.DB.Create(&startedNotStarted).Error)
	require.NoError(t, model.DB.Create(&active).Error)
	require.NoError(t, model.DB.Create(&refunded).Error)
	require.NoError(t, model.DB.Create(&pendingTerm).Error)
	require.NoError(t, model.DB.Create(&failedTerm).Error)
	require.NoError(t, model.DB.Create(&recurringTerm).Error)
	require.NoError(t, model.DB.Create(&foreignTerm).Error)

	result, err := ListRefundableSubscriptionTerms(7610)

	require.NoError(t, err)
	require.Len(t, result.Items, 2)
	require.Equal(t, olderFuture.Id, result.Items[0].TermSegmentID)
	require.Equal(t, laterFuture.Id, result.Items[1].TermSegmentID)
	require.Equal(t, int64(oneTime.Id), result.Items[0].OrderID)
	require.Equal(t, int64(plan.Id), result.Items[0].PlanID)
	require.Equal(t, "Purchase Plan", result.Items[0].PlanTitle)
	require.Equal(t, float64(8.50), result.Items[0].RefundMoney)
	require.Equal(t, int64(850), result.Items[0].RefundQuota)
	require.Equal(t, model.SubscriptionTermStatusNotStarted, result.Items[0].Status)
	require.Equal(t, float64(10.75), result.TotalRefundMoney)
	require.Equal(t, int64(1075), result.TotalRefundQuota)
	require.GreaterOrEqual(t, result.Items[0].RemainingDays, int64(1))
}

func TestRefundSubscriptionTermSegmentInvalidatesUserCacheAfterCredit(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	mr := setupWalletRenewalRedis(t)
	insertPurchaseServiceUser(t, 7603, 25)
	plan := insertPurchaseServicePlan(t, 7703, 1, 12, 1200)
	contract := model.UserSubscriptionContract{UserId: 7603, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7603, PlanId: plan.Id, TradeNo: "term-refund-cache", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: common.GetTimestamp() + 3600, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&term).Error)
	cacheUserQuota(t, 7603, 25)
	require.True(t, mr.Exists(fmt.Sprintf("user:v2:%d", 7603)))

	_, err := RefundSubscriptionTermSegment(7603, term.Id)

	require.NoError(t, err)
	require.False(t, mr.Exists(fmt.Sprintf("user:v2:%d", 7603)))
}

func TestRefundSubscriptionTermSegmentReplaysCompletedRefundWithoutCreditingTwice(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7605, 25)
	plan := insertPurchaseServicePlan(t, 7705, 1, 12, 1200)
	contract := model.UserSubscriptionContract{
		UserId:        7605,
		Status:        model.SubscriptionContractStatusActive,
		PaymentMode:   model.SubscriptionPaymentModePrepaid,
		CurrentPlanId: plan.Id,
	}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{
		UserId:          7605,
		PlanId:          plan.Id,
		TradeNo:         "term-refund-replay",
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{
		ContractId:     contract.Id,
		OrderId:        order.Id,
		PlanId:         plan.Id,
		SegmentIndex:   1,
		StartTime:      common.GetTimestamp() + 3600,
		EndTime:        common.GetTimestamp() + 7200,
		AllocatedMoney: plan.PriceAmount,
		Status:         model.SubscriptionTermStatusNotStarted,
	}
	require.NoError(t, model.DB.Create(&term).Error)

	first, err := RefundSubscriptionTermSegment(7605, term.Id)
	require.NoError(t, err)
	second, err := RefundSubscriptionTermSegment(7605, term.Id)

	require.NoError(t, err)
	require.Equal(t, first, second)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7605).Error)
	require.Equal(t, 1225, user.Quota)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("term_segment_id = ?", term.Id).Count(&ledgerCount).Error)
	require.Equal(t, int64(1), ledgerCount)
}

func TestRefundSubscriptionTermSegmentDoesNotLedgerOrCreditWhenStatusCASLoses(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7604, 25)
	plan := insertPurchaseServicePlan(t, 7704, 1, 12, 1200)
	contract := model.UserSubscriptionContract{UserId: 7604, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7604, PlanId: plan.Id, TradeNo: "term-refund-cas", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: common.GetTimestamp() + 3600, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&term).Error)

	callbackName := "test:term_refund_cas_loses"
	fired := false
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "subscription_term_segments" {
			return
		}
		fired = true
		require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).
			Model(&model.SubscriptionTermSegment{}).
			Where("id = ?", term.Id).
			Update("status", model.SubscriptionTermStatusActive).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	_, err := RefundSubscriptionTermSegment(7604, term.Id)

	require.Error(t, err)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("term_segment_id = ?", term.Id).Count(&ledgerCount).Error)
	require.Equal(t, int64(0), ledgerCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7604).Error)
	require.Equal(t, 25, user.Quota)
}

func TestRefundSubscriptionTermSegmentRejectsNotStartedTermsWhoseStartTimeIsNotFuture(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7612, 25)
	plan := insertPurchaseServicePlan(t, 7712, 1, 12, 1200)
	contract := model.UserSubscriptionContract{UserId: 7612, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7612, PlanId: plan.Id, TradeNo: "term-refund-started-not-started", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	now := common.GetTimestamp()
	for index, tc := range []struct {
		name      string
		startTime int64
	}{
		{name: "past", startTime: now - 3600},
		{name: "equal_now", startTime: now},
		{name: "zero", startTime: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: index, StartTime: tc.startTime, EndTime: now + 3600, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
			require.NoError(t, model.DB.Create(&term).Error)

			_, err := RefundSubscriptionTermSegment(7612, term.Id)

			require.Error(t, err)
			require.Contains(t, err.Error(), "already started")
			var stored model.SubscriptionTermSegment
			require.NoError(t, model.DB.First(&stored, "id = ?", term.Id).Error)
			require.Equal(t, model.SubscriptionTermStatusNotStarted, stored.Status)
			var ledgerCount int64
			require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("term_segment_id = ?", term.Id).Count(&ledgerCount).Error)
			require.Equal(t, int64(0), ledgerCount)
		})
	}
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7612).Error)
	require.Equal(t, 25, user.Quota)
}

func TestRefundSubscriptionTermSegmentRejectsTermsFromNonSuccessfulOrders(t *testing.T) {
	for index, status := range []string{common.TopUpStatusPending, common.TopUpStatusFailed} {
		t.Run(status, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			userID := 7613 + index
			planID := 7713 + index
			insertPurchaseServiceUser(t, userID, 25)
			plan := insertPurchaseServicePlan(t, planID, 1, 12, 1200)
			contract := model.UserSubscriptionContract{UserId: userID, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
			require.NoError(t, model.DB.Create(&contract).Error)
			order := model.SubscriptionOrder{UserId: userID, PlanId: plan.Id, TradeNo: "term-refund-order-" + status, PaymentProvider: model.PaymentProviderBalance, Status: status}
			require.NoError(t, model.DB.Create(&order).Error)
			term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: common.GetTimestamp() + 3600, EndTime: common.GetTimestamp() + 7200, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
			require.NoError(t, model.DB.Create(&term).Error)

			_, err := RefundSubscriptionTermSegment(userID, term.Id)

			require.Error(t, err)
			require.Contains(t, err.Error(), "successful")
			var stored model.SubscriptionTermSegment
			require.NoError(t, model.DB.First(&stored, "id = ?", term.Id).Error)
			require.Equal(t, model.SubscriptionTermStatusNotStarted, stored.Status)
			var ledgerCount int64
			require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("term_segment_id = ?", term.Id).Count(&ledgerCount).Error)
			require.Equal(t, int64(0), ledgerCount)
			var user model.User
			require.NoError(t, model.DB.First(&user, "id = ?", userID).Error)
			require.Equal(t, 25, user.Quota)
		})
	}
}

func TestRefundSubscriptionTermSegmentDoesNotRefundWhenStartTimeCASLoses(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7615, 25)
	plan := insertPurchaseServicePlan(t, 7715, 1, 12, 1200)
	contract := model.UserSubscriptionContract{UserId: 7615, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7615, PlanId: plan.Id, TradeNo: "term-refund-start-time-cas", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	term := model.SubscriptionTermSegment{ContractId: contract.Id, OrderId: order.Id, PlanId: plan.Id, SegmentIndex: 0, StartTime: common.GetTimestamp() + 3600, EndTime: common.GetTimestamp() + 7200, AllocatedMoney: plan.PriceAmount, Status: model.SubscriptionTermStatusNotStarted}
	require.NoError(t, model.DB.Create(&term).Error)

	callbackName := "test:term_refund_start_time_cas_loses"
	fired := false
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement == nil || tx.Statement.Table != "subscription_term_segments" {
			return
		}
		fired = true
		require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).
			Model(&model.SubscriptionTermSegment{}).
			Where("id = ?", term.Id).
			Update("start_time", int64(1)).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})

	_, err := RefundSubscriptionTermSegment(7615, term.Id)

	require.Error(t, err)
	var stored model.SubscriptionTermSegment
	require.NoError(t, model.DB.First(&stored, "id = ?", term.Id).Error)
	require.Equal(t, model.SubscriptionTermStatusNotStarted, stored.Status)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("term_segment_id = ?", term.Id).Count(&ledgerCount).Error)
	require.Equal(t, int64(0), ledgerCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, "id = ?", 7615).Error)
	require.Equal(t, 25, user.Quota)
}

func TestRefundSubscriptionTermSegmentRejectsNonNotStartedStatuses(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	insertPurchaseServiceUser(t, 7602, 0)
	plan := insertPurchaseServicePlan(t, 7702, 1, 5, 500)
	contract := model.UserSubscriptionContract{UserId: 7602, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModePrepaid, CurrentPlanId: plan.Id}
	require.NoError(t, model.DB.Create(&contract).Error)
	order := model.SubscriptionOrder{UserId: 7602, PlanId: plan.Id, TradeNo: "term-refund-reject", PaymentProvider: model.PaymentProviderBalance, Status: common.TopUpStatusSuccess}
	require.NoError(t, model.DB.Create(&order).Error)
	for index, status := range []string{
		model.SubscriptionTermStatusActive,
		model.SubscriptionTermStatusReplaced,
		"completed",
		"cancelled",
		model.SubscriptionTermStatusRefunded,
	} {
		t.Run(status, func(t *testing.T) {
			term := model.SubscriptionTermSegment{
				ContractId:     contract.Id,
				OrderId:        order.Id,
				PlanId:         plan.Id,
				SegmentIndex:   index,
				AllocatedMoney: plan.PriceAmount,
				Status:         status,
			}
			require.NoError(t, model.DB.Create(&term).Error)

			_, err := RefundSubscriptionTermSegment(7602, term.Id)

			require.Error(t, err)
			require.Contains(t, err.Error(), "not_started")
		})
	}
}
