package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAlipayAutoRenewChargeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	// Preserve package TestMain DB (task_billing_test.go) so cleanup cannot poison later tests.
	prevDB := model.DB
	prevLogDB := model.LOG_DB
	prevRedis := common.RedisEnabled
	prevSQLite := common.UsingSQLite
	prevMySQL := common.UsingMySQL
	prevPG := common.UsingPostgreSQL

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared&_pragma=busy_timeout(5000)", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1) // serialize SQLite writers; production uses MySQL/PG with real row locks

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.SubscriptionPlan{},
		&model.BillingSubscription{},
		&model.RecurringChargeAttempt{},
		&model.UserSubscription{},
		&model.AlipayPendingTask{},
	))
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		_ = sqlDB.Close()
		model.DB = prevDB
		model.LOG_DB = prevLogDB
		common.RedisEnabled = prevRedis
		common.UsingSQLite = prevSQLite
		common.UsingMySQL = prevMySQL
		common.UsingPostgreSQL = prevPG
	})
	return db
}

func TestBuildAlipayAutoRenewOutTradeNo_StableForSamePeriod(t *testing.T) {
	a := BuildAlipayAutoRenewOutTradeNo(12, "agr_1", 100, 200)
	b := BuildAlipayAutoRenewOutTradeNo(12, "agr_1", 100, 200)
	c := BuildAlipayAutoRenewOutTradeNo(12, "agr_1", 100, 201)
	require.Equal(t, a, b)
	require.NotEqual(t, a, c)
	require.True(t, len(a) <= 64)
	require.Contains(t, a, "aliar12")
}

func TestPrepareAlipayAutoRenewFirstPeriod_ReusesOutTradeNoOnRetry(t *testing.T) {
	setupAlipayAutoRenewChargeTestDB(t)

	plan := &model.SubscriptionPlan{
		Id:            1,
		Title:         "AR",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		BillingMode:   model.SubscriptionBillingModeAutoRenew,
		AlipayEnabled: true,
		TotalAmount:   1000,
	}
	require.NoError(t, model.DB.Create(plan).Error)

	createdAt := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC).Unix()
	contract := &model.BillingSubscription{
		UserId:          10,
		PlanId:          plan.Id,
		Provider:        model.PaymentProviderAlipay,
		SignupReference: "signup_stable_1",
		Status:          "pending_signup",
		CreatedAt:       createdAt,
		UpdatedAt:       createdAt,
	}
	require.NoError(t, model.DB.Create(contract).Error)
	// GORM BeforeCreate may overwrite CreatedAt; pin it for stable period keys.
	require.NoError(t, model.DB.Model(contract).Update("created_at", createdAt).Error)
	require.NoError(t, model.DB.First(contract, contract.Id).Error)

	now1 := time.Date(2026, 7, 10, 8, 0, 0, 0, time.UTC)
	now2 := time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)

	out1, ps1, pe1, err := PrepareAlipayAutoRenewFirstPeriod(contract, plan, now1)
	require.NoError(t, err)
	require.NotEmpty(t, out1)
	require.Equal(t, createdAt, ps1)
	require.Greater(t, pe1, ps1)

	// Reload and retry with a different wall-clock time: must reuse same trade no.
	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	out2, ps2, pe2, err := PrepareAlipayAutoRenewFirstPeriod(contract, plan, now2)
	require.NoError(t, err)
	require.Equal(t, out1, out2)
	require.Equal(t, ps1, ps2)
	require.Equal(t, pe1, pe2)

	var attempts []model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("billing_subscription_id = ?", contract.Id).Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, out1, attempts[0].ProviderInvoiceId)
	require.Equal(t, model.RecurringChargeStatusPending, attempts[0].Status)
	require.Greater(t, attempts[0].ClaimedAt, int64(0))

	require.NoError(t, model.DB.First(contract, contract.Id).Error)
	require.Equal(t, out1, contract.LastInvoiceId)
}

func TestClaimAlipayAutoRenewChargeAttempt_OnlyOneWinner(t *testing.T) {
	setupAlipayAutoRenewChargeTestDB(t)

	contract := &model.BillingSubscription{
		UserId:                 20,
		PlanId:                 2,
		Provider:               model.PaymentProviderAlipay,
		ProviderSubscriptionId: "agr_claim_1",
		SignupReference:        "signup_claim_1",
		Status:                 "active",
		CurrentPeriodEnd:       time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC).Unix(),
	}
	require.NoError(t, model.DB.Create(contract).Error)

	periodStart := contract.CurrentPeriodEnd
	periodEnd := periodStart + 30*24*3600
	outTradeNo := BuildAlipayAutoRenewOutTradeNo(contract.Id, "agr_claim_1", periodStart, periodEnd)
	now := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)

	// With MaxOpenConns(1) claims are serialized; still only one winner under the lease.
	var claimedCount int64
	var wg sync.WaitGroup
	const n = 8
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			claimed, attempt, err := ClaimAlipayAutoRenewChargeAttempt(contract, outTradeNo, periodStart, periodEnd, 1999, now)
			if err != nil {
				if errors.Is(err, ErrAlipayAutoRenewChargeNotClaimed) {
					return
				}
				t.Errorf("unexpected claim error: %v", err)
				return
			}
			if claimed && attempt != nil {
				atomic.AddInt64(&claimedCount, 1)
			}
		}()
	}
	wg.Wait()
	require.EqualValues(t, 1, claimedCount)

	var attempts []model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("provider_invoice_id = ?", outTradeNo).Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, model.RecurringChargeStatusPending, attempts[0].Status)
}

func TestClaimAlipayAutoRenewChargeAttempt_LeaseBlocksThenExpires(t *testing.T) {
	setupAlipayAutoRenewChargeTestDB(t)

	contract := &model.BillingSubscription{
		UserId:                 21,
		PlanId:                 3,
		Provider:               model.PaymentProviderAlipay,
		ProviderSubscriptionId: "agr_lease_1",
		Status:                 "active",
		CurrentPeriodEnd:       1000,
	}
	require.NoError(t, model.DB.Create(contract).Error)

	periodStart, periodEnd := int64(1000), int64(2000)
	outTradeNo := BuildAlipayAutoRenewOutTradeNo(contract.Id, "agr_lease_1", periodStart, periodEnd)
	t0 := time.Unix(10_000, 0)

	claimed1, _, err := ClaimAlipayAutoRenewChargeAttempt(contract, outTradeNo, periodStart, periodEnd, 100, t0)
	require.NoError(t, err)
	require.True(t, claimed1)

	// Within lease: second claim must lose.
	claimed2, _, err := ClaimAlipayAutoRenewChargeAttempt(contract, outTradeNo, periodStart, periodEnd, 100, t0.Add(time.Minute))
	require.ErrorIs(t, err, ErrAlipayAutoRenewChargeNotClaimed)
	require.False(t, claimed2)

	// After lease expiry: can reclaim.
	claimed3, attempt3, err := ClaimAlipayAutoRenewChargeAttempt(
		contract, outTradeNo, periodStart, periodEnd, 100, t0.Add(alipayAutoRenewChargeLease+time.Second),
	)
	require.NoError(t, err)
	require.True(t, claimed3)
	require.NotNil(t, attempt3)
	require.Equal(t, model.RecurringChargeStatusPending, attempt3.Status)
}

func TestClaimAlipayAutoRenewChargeAttempt_AlreadyPaid(t *testing.T) {
	setupAlipayAutoRenewChargeTestDB(t)

	contract := &model.BillingSubscription{
		UserId:                 22,
		PlanId:                 4,
		Provider:               model.PaymentProviderAlipay,
		ProviderSubscriptionId: "agr_paid_1",
		Status:                 "active",
	}
	require.NoError(t, model.DB.Create(contract).Error)

	outTradeNo := "aliar_paid_period_1"
	nowUnix := time.Now().Unix()
	require.NoError(t, model.DB.Create(&model.RecurringChargeAttempt{
		BillingSubscriptionId:  contract.Id,
		Provider:               model.PaymentProviderAlipay,
		ProviderInvoiceId:      outTradeNo,
		ProviderSubscriptionId: "agr_paid_1",
		PeriodStart:            1,
		PeriodEnd:              2,
		Amount:                 100,
		Currency:               "CNY",
		Status:                 model.RecurringChargeStatusPaid,
		ClaimedAt:              nowUnix,
	}).Error)

	claimed, _, err := ClaimAlipayAutoRenewChargeAttempt(contract, outTradeNo, 1, 2, 100, time.Now())
	require.ErrorIs(t, err, ErrAlipayAutoRenewChargeAlreadyPaid)
	require.False(t, claimed)
}

func TestNextAlipayAutoRenewPeriod_FirstUsesCreatedAt(t *testing.T) {
	created := int64(1_700_000_000)
	contract := &model.BillingSubscription{
		Status:    "pending_signup",
		CreatedAt: created,
	}
	plan := &model.SubscriptionPlan{
		DurationUnit:  model.SubscriptionDurationDay,
		DurationValue: 30,
	}
	// Wall clock far after created_at should still use created_at for first period.
	start, end, err := nextAlipayAutoRenewPeriod(contract, plan, time.Unix(created+86400, 0))
	require.NoError(t, err)
	require.Equal(t, created, start)
	require.Equal(t, created+30*86400, end)
}
