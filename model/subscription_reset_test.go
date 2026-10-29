package model

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func seedSubscriptionResetPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

func TestSubscriptionQuotaBeijingBoundaries(t *testing.T) {
	for _, test := range []struct{ at, day, week, month string }{
		{"2028-02-29T15:59:59Z", "2028-02-29T16:00:00Z", "2028-03-05T16:00:00Z", "2028-02-29T16:00:00Z"},
		{"2026-11-01T15:59:59Z", "2026-11-01T16:00:00Z", "2026-11-01T16:00:00Z", "2026-11-30T16:00:00Z"},
		{"2026-11-01T16:00:00Z", "2026-11-02T16:00:00Z", "2026-11-08T16:00:00Z", "2026-11-30T16:00:00Z"},
	} {
		t.Run(test.at, func(t *testing.T) {
			at, err := time.Parse(time.RFC3339, test.at)
			require.NoError(t, err)
			periods := subscriptionQuotaPeriods(at.Unix(), &SubscriptionPlan{})
			for i, expected := range []string{test.day, test.week, test.month} {
				assert.Equal(t, expected, time.Unix(periods[i].end, 0).UTC().Format(time.RFC3339))
			}
		})
	}
}

func subscriptionQuotaTestDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var database *gorm.DB
	var dbType common.DatabaseType
	var err error
	if dialect == "sqlite" {
		database, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "quota.db")), &gorm.Config{})
		dbType = common.DatabaseTypeSQLite
	} else {
		dsn := os.Getenv("TEST_" + strings.ToUpper(dialect) + "_DSN")
		if dsn == "" {
			t.Skip("test database DSN is not configured")
		}
		t.Setenv("SUBSCRIPTION_QUOTA_TEST_DSN", dsn)
		database, dbType, err = chooseDB("SUBSCRIPTION_QUOTA_TEST_DSN", false)
	}
	require.NoError(t, err)
	database.Config.NamingStrategy = schema.NamingStrategy{TablePrefix: "period_quota_test_"}
	previousDB, previousType := DB, common.MainDatabaseType()
	DB = database
	common.SetMainDatabaseType(dbType)
	initCol()
	sqlDB, err := database.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		for _, model := range []any{&SubscriptionQuotaWindow{}, &SubscriptionPreConsumeRecord{}, &UserSubscription{}, &SubscriptionPlan{}, &Task{}} {
			_ = database.Migrator().DropTable(model)
		}
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		initCol()
		_ = sqlDB.Close()
	})
	require.NoError(t, database.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}, &SubscriptionQuotaWindow{}, &Task{}))
	return database
}

func TestSubscriptionQuotaWindows(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			database := subscriptionQuotaTestDB(t, dialect)
			plan := SubscriptionPlan{Title: "Period limits", TotalAmount: 100, DailyLimit: 5, WeeklyLimit: 20, MonthlyLimit: 50, DurationUnit: SubscriptionDurationMonth, DurationValue: 1}
			require.NoError(t, database.Create(&plan).Error)
			now := GetDBTimestamp()
			sub := UserSubscription{UserId: 4201, PlanId: plan.Id, AmountTotal: 100, AmountUsed: 7, StartTime: now - 3600, EndTime: now + 30*86400, Status: "active"}
			require.NoError(t, database.Create(&sub).Error)
			first, err := PreConsumeUserSubscription("period-first", sub.UserId, "model", 0, 4)
			require.NoError(t, err)
			assert.True(t, first.PeriodTracked)
			assert.EqualValues(t, 11, first.AmountUsedAfter, "old total usage is preserved")
			_, err = PreConsumeUserSubscription("period-blocked", sub.UserId, "model", 0, 2)
			var exhausted *SubscriptionQuotaLimitError
			require.ErrorAs(t, err, &exhausted)
			assert.Equal(t, "daily", exhausted.Period)
			_, err = PreConsumeUserSubscription("period-first", sub.UserId, "model", 0, 4)
			require.NoError(t, err)
			_, err = PreConsumeUserSubscription("period-first", sub.UserId+1, "model", 0, 4)
			require.Error(t, err)
			delta, err := SettleSubscriptionPreConsume("period-first", 7)
			require.NoError(t, err)
			assert.EqualValues(t, 3, delta, "actual work is charged above the estimate and daily cap")
			delta, err = SettleSubscriptionPreConsume("period-first", 7)
			require.NoError(t, err)
			assert.Zero(t, delta)
			// Updating the SQL policy must take effect even if an old plan is cached.
			_, err = GetSubscriptionPlanById(plan.Id)
			require.NoError(t, err)
			require.NoError(t, database.Model(&plan).Update("daily_limit", 10).Error)
			_, err = PreConsumeUserSubscription("period-second", sub.UserId, "model", 0, 3)
			require.NoError(t, err)
			subs, err := GetAllUserSubscriptions(sub.UserId)
			require.NoError(t, err)
			require.Len(t, subs, 1)
			assert.EqualValues(t, 10, subs[0].Subscription.QuotaWindows.Daily.Used)
			assert.EqualValues(t, 10, subs[0].Subscription.QuotaWindows.Weekly.Used)
			assert.EqualValues(t, 10, subs[0].Subscription.QuotaWindows.Monthly.Used)
			_, err = AdminResetUserSubscriptionsByPlan(sub.UserId, plan.Id, false)
			require.NoError(t, err)
			_, err = PreConsumeUserSubscription("period-after-reset", sub.UserId, "model", 0, 5)
			require.NoError(t, err)
			require.NoError(t, RefundSubscriptionPreConsume("period-second"))
			require.NoError(t, RefundSubscriptionPreConsume("period-second"))
			require.NoError(t, database.First(&sub, sub.Id).Error)
			assert.EqualValues(t, 5, sub.AmountUsed, "pre-reset refunds cannot restore the new allowance")
			subs, err = GetAllUserSubscriptions(sub.UserId)
			require.NoError(t, err)
			assert.EqualValues(t, 5, subs[0].Subscription.QuotaWindows.Daily.Used)
			// Disabled limits still accumulate usage, so enabling a cap later is safe.
			require.NoError(t, database.Model(&plan).Updates(map[string]any{"daily_limit": 0, "weekly_limit": 0, "monthly_limit": 0}).Error)
			_, err = PreConsumeUserSubscription("period-disabled", sub.UserId, "model", 0, 6)
			require.NoError(t, err)
			require.NoError(t, database.Model(&plan).Update("monthly_limit", 10).Error)
			_, err = PreConsumeUserSubscription("period-new-monthly-cap", sub.UserId, "model", 0, 1)
			require.True(t, errors.Is(err, ErrSubscriptionQuotaInsufficient))
			sqlDB, err := database.DB()
			require.NoError(t, err)
			require.NoError(t, sqlDB.Ping())
		})
	}
}

func seedSubscriptionResetSub(t *testing.T, sub *UserSubscription) {
	t.Helper()
	require.NoError(t, DB.Create(sub).Error)
}

func getSubscriptionResetSub(t *testing.T, id int) UserSubscription {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", id).First(&sub).Error)
	return sub
}

func TestAdminResetUserSubscriptionsByPlanResetsAllActiveMatchesAndAdvancesTime(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9101,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	otherPlan := &SubscriptionPlan{
		Id:               9102,
		Title:            "Basic",
		PriceAmount:      1,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      100,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetPlan(t, otherPlan)

	activeEnd := now + 30*24*3600
	expiredEnd := now - 1
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9201, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 300, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9202, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9203, UserId: 101, PlanId: otherPlan.Id, AmountTotal: 100, AmountUsed: 60, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9204, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 700, StartTime: now - 7200, EndTime: expiredEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9205, UserId: 102, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 800, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9206, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 900, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 120})

	beforeReset := GetDBTimestamp()
	result, err := AdminResetUserSubscriptionsByPlan(101, plan.Id, true)
	afterReset := GetDBTimestamp()

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, plan.Id, result.PlanId)
	assert.Equal(t, 2, result.MatchedCount)
	assert.Equal(t, 2, result.ResetCount)
	assert.Equal(t, 1, result.UserCount)
	assert.Equal(t, []int{101}, result.AffectedUserIds)
	assert.True(t, result.AdvanceResetTime)

	for _, id := range []int{9201, 9202} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.GreaterOrEqual(t, sub.LastResetTime, beforeReset)
		assert.LessOrEqual(t, sub.LastResetTime, afterReset)
		assert.Equal(t, calcNextResetTime(time.Unix(sub.LastResetTime, 0), plan, sub.EndTime), sub.NextResetTime)
	}
	assert.EqualValues(t, 60, getSubscriptionResetSub(t, 9203).AmountUsed)
	assert.EqualValues(t, 700, getSubscriptionResetSub(t, 9204).AmountUsed)
	assert.EqualValues(t, 800, getSubscriptionResetSub(t, 9205).AmountUsed)
	assert.EqualValues(t, 900, getSubscriptionResetSub(t, 9206).AmountUsed)
}

func TestAdminResetUserSubscriptionsByPlanKeepsResetTimes(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9301,
		Title:            "Team",
		PriceAmount:      20,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      2000,
		QuotaResetPeriod: SubscriptionResetMonthly,
	}
	seedSubscriptionResetPlan(t, plan)

	lastReset := now - 86400
	nextReset := now + 86400
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9302, UserId: 201, PlanId: plan.Id, AmountTotal: 2000, AmountUsed: 1200, StartTime: now - 172800, EndTime: now + 30*24*3600, Status: "active", LastResetTime: lastReset, NextResetTime: nextReset})

	result, err := AdminResetUserSubscriptionsByPlan(201, plan.Id, false)

	require.NoError(t, err)
	assert.False(t, result.AdvanceResetTime)
	sub := getSubscriptionResetSub(t, 9302)
	assert.Zero(t, sub.AmountUsed)
	assert.Equal(t, lastReset, sub.LastResetTime)
	assert.Equal(t, nextReset, sub.NextResetTime)
}

func TestAdminResetUserSubscriptionsByPlanNoActiveMatchReturnsError(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:            9401,
		Title:         "Expired",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9402, UserId: 301, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 7200, EndTime: now - 1, Status: "active"})

	result, err := AdminResetUserSubscriptionsByPlan(301, plan.Id, true)

	require.Error(t, err)
	assert.Nil(t, result)
	assert.True(t, strings.Contains(err.Error(), "This user has no active subscription to this plan"))
}

func TestAdminResetPlanSubscriptionsResetsAllActiveUsers(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9501,
		Title:            "Business",
		PriceAmount:      30,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      3000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedSubscriptionResetPlan(t, plan)

	activeEnd := now + 30*24*3600
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9502, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9503, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1100, StartTime: now - 3500, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9504, UserId: 402, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1200, StartTime: now - 3400, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9505, UserId: 403, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1300, StartTime: now - 7200, EndTime: now - 1, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9506, UserId: 404, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1400, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 10})

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 3, result.MatchedCount)
	assert.Equal(t, 3, result.ResetCount)
	assert.Equal(t, 2, result.UserCount)
	assert.Equal(t, []int{401, 402}, result.AffectedUserIds)
	for _, id := range []int{9502, 9503, 9504} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.Zero(t, sub.LastResetTime)
		assert.Zero(t, sub.NextResetTime)
	}
	assert.EqualValues(t, 1300, getSubscriptionResetSub(t, 9505).AmountUsed)
	assert.EqualValues(t, 1400, getSubscriptionResetSub(t, 9506).AmountUsed)
}

func TestAdminResetPlanSubscriptionsNoMatchSucceeds(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9601,
		Title:         "Empty",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Zero(t, result.MatchedCount)
	assert.Zero(t, result.ResetCount)
	assert.Zero(t, result.UserCount)
	assert.Empty(t, result.AffectedUserIds)
}

func TestSubscriptionQuotaReceiptLifecycle(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := subscriptionQuotaTestDB(t, dialect)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			if dialect == "sqlite" {
				sqlDB.SetMaxOpenConns(1)
			}
			for i, kind := range []string{"daily", "weekly", "monthly"} {
				t.Run(kind, func(t *testing.T) {
					plan := SubscriptionPlan{Title: kind}
					switch kind {
					case "daily":
						plan.DailyLimit = 5
					case "weekly":
						plan.WeeklyLimit = 5
					case "monthly":
						plan.MonthlyLimit = 5
					}
					require.NoError(t, db.Create(&plan).Error)
					now := GetDBTimestamp()
					sub := UserSubscription{UserId: 5000 + i, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400*60}
					require.NoError(t, db.Create(&sub).Error)
					id := "quota-" + kind
					_, err := PreConsumeUserSubscription(id, sub.UserId, "model", 0, 2)
					require.NoError(t, err)
					require.NoError(t, ReserveSubscriptionPreConsume(id, 5))
					require.NoError(t, ReserveSubscriptionPreConsume(id, 5), "same target does not reserve twice")
					var exhausted *SubscriptionQuotaLimitError
					require.ErrorAs(t, ReserveSubscriptionPreConsume(id, 6), &exhausted)
					assert.Equal(t, kind, exhausted.Period)
					require.NoError(t, RollbackSubscriptionPreConsume(id, 2))
					require.NoError(t, RollbackSubscriptionPreConsume(id, 2))
					require.NoError(t, ReserveSubscriptionPreConsume(id, 5))
					// Repeated purchases have separate windows and are tried in order.
					second := UserSubscription{UserId: sub.UserId, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400*60}
					require.NoError(t, db.Create(&second).Error)
					res, err := PreConsumeUserSubscription(id+"-second", sub.UserId, "model", 0, 5)
					require.NoError(t, err)
					assert.Equal(t, second.Id, res.UserSubscriptionId)
					_, err = FinalizeSubscriptionPreConsume(id+"-second", 5)
					require.NoError(t, err)
					_, err = FinalizeSubscriptionPreConsume(id+"-second", 5)
					require.NoError(t, err)
					_, err = SettleSubscriptionPreConsume(id+"-second", 7)
					require.NoError(t, err)
					_, err = FinalizeSubscriptionPreConsume(id+"-second", 5)
					require.NoError(t, err)
					require.NoError(t, db.First(&second, second.Id).Error)
					assert.EqualValues(t, 7, second.AmountUsed, "late finalization preserves actual charge")
					_, err = PreConsumeUserSubscription(id+"-blocked", sub.UserId, "model", 0, 1)
					require.ErrorIs(t, err, ErrSubscriptionQuotaInsufficient)
					require.NoError(t, RefundSubscriptionPreConsume(id))
					require.NoError(t, RefundSubscriptionPreConsume(id))
					_, err = FinalizeSubscriptionPreConsume(id, 5)
					require.NoError(t, err, "late finalization cannot reopen a refund")
					require.NoError(t, db.First(&sub, sub.Id).Error)
					assert.Zero(t, sub.AmountUsed, "refund includes additional reservations exactly once")
				})
			}
			t.Run("concurrent_last_allowance", func(t *testing.T) {
				plan := SubscriptionPlan{Title: "Last allowance", DailyLimit: 1}
				require.NoError(t, db.Create(&plan).Error)
				now := GetDBTimestamp()
				sub := UserSubscription{UserId: 5100, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400}
				require.NoError(t, db.Create(&sub).Error)
				start := make(chan struct{})
				results := make(chan error, 2)
				for _, id := range []string{"last-a", "last-b"} {
					go func() { <-start; _, err := PreConsumeUserSubscription(id, sub.UserId, "model", 0, 1); results <- err }()
				}
				close(start)
				admitted := 0
				for range 2 {
					if err := <-results; err == nil {
						admitted++
					} else {
						require.ErrorIs(t, err, ErrSubscriptionQuotaInsufficient)
					}
				}
				assert.Equal(t, 1, admitted)
				require.NoError(t, db.First(&sub, sub.Id).Error)
				assert.EqualValues(t, 1, sub.AmountUsed)
			})
			t.Run("period_rollover_and_late_settlement", func(t *testing.T) {
				plan := SubscriptionPlan{Title: "Rollover", DailyLimit: 10, WeeklyLimit: 10, MonthlyLimit: 10}
				require.NoError(t, db.Create(&plan).Error)
				now := GetDBTimestamp()
				sub := UserSubscription{UserId: 5200, PlanId: plan.Id, Status: "active", StartTime: now - 100*86400, EndTime: now + 86400}
				require.NoError(t, db.Create(&sub).Error)
				// A task submitted in a previous day, week and month settles today.
				old := SubscriptionPreConsumeRecord{RequestId: "old-period-task", UserId: sub.UserId, UserSubscriptionId: sub.Id, AccountedAt: now - 40*86400, QuotaGeneration: sub.QuotaGeneration, PeriodGeneration: sub.PeriodGeneration, PreConsumed: 4, Status: "consumed"}
				require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
					if err := applySubscriptionReceiptAmountTx(tx, &sub, &old, &plan, 4, true); err != nil {
						return err
					}
					return tx.Create(&old).Error
				}))
				_, err := PreConsumeUserSubscription("current-period", sub.UserId, "model", 0, 10)
				require.NoError(t, err)
				delta, err := SettleSubscriptionPreConsume(old.RequestId, 7)
				require.NoError(t, err)
				assert.EqualValues(t, 3, delta)
				require.NoError(t, RefundSubscriptionPreConsume(old.RequestId))
				subs := []UserSubscription{sub}
				require.NoError(t, PopulateSubscriptionQuotaWindows(subs))
				assert.EqualValues(t, 10, subs[0].QuotaWindows.Daily.Used)
				assert.EqualValues(t, 10, subs[0].QuotaWindows.Weekly.Used)
				assert.EqualValues(t, 10, subs[0].QuotaWindows.Monthly.Used)
				_, err = AdminResetUserSubscriptionsByPlan(sub.UserId, plan.Id, false)
				require.NoError(t, err)
				_, err = PreConsumeUserSubscription("after-manual-reset", sub.UserId, "model", 0, 5)
				require.NoError(t, err)
				_, err = SettleSubscriptionPreConsume("current-period", 15)
				require.NoError(t, err, "old work is billed even above the limit")
				require.NoError(t, RefundSubscriptionPreConsume("current-period"))
				require.NoError(t, db.First(&sub, sub.Id).Error)
				assert.EqualValues(t, 5, sub.AmountUsed)
				subs[0] = sub
				require.NoError(t, PopulateSubscriptionQuotaWindows(subs))
				assert.EqualValues(t, 5, subs[0].QuotaWindows.Daily.Used)
			})
			t.Run("original_allowance_rollover", func(t *testing.T) {
				plan := SubscriptionPlan{Title: "Original hourly quota", TotalAmount: 5, DailyLimit: 20, QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: 3600}
				require.NoError(t, db.Create(&plan).Error)
				now := GetDBTimestamp()
				sub := UserSubscription{UserId: 5300, PlanId: plan.Id, AmountTotal: 5, Status: "active", StartTime: now, EndTime: now + 86400, NextResetTime: now + 3600}
				require.NoError(t, db.Create(&sub).Error)
				_, err := PreConsumeUserSubscription("base-before-reset", sub.UserId, "model", 0, 5)
				require.NoError(t, err)
				require.NoError(t, db.Model(&sub).Updates(map[string]any{"last_reset_time": now - 3601, "next_reset_time": now - 1}).Error)
				_, err = PreConsumeUserSubscription("base-after-reset", sub.UserId, "model", 0, 4)
				require.NoError(t, err)
				require.NoError(t, RefundSubscriptionPreConsume("base-before-reset"))
				require.NoError(t, db.First(&sub, sub.Id).Error)
				assert.EqualValues(t, 4, sub.AmountUsed, "old base refunds cannot replenish the new allowance")
				subs := []UserSubscription{sub}
				require.NoError(t, PopulateSubscriptionQuotaWindows(subs))
				assert.EqualValues(t, 4, subs[0].QuotaWindows.Daily.Used, "daily usage follows its own cycle")
			})
			t.Run("retention", func(t *testing.T) {
				plan := SubscriptionPlan{Title: "Retention"}
				require.NoError(t, db.Create(&plan).Error)
				now := GetDBTimestamp()
				sub := UserSubscription{UserId: 5400, PlanId: plan.Id, Status: "active", StartTime: now, EndTime: now + 86400}
				require.NoError(t, db.Create(&sub).Error)
				for _, id := range []string{"retention-10-days", "retention-completed", "retention-pending", "retention-task"} {
					_, err := PreConsumeUserSubscription(id, sub.UserId, "model", 0, 1)
					require.NoError(t, err)
					if id != "retention-pending" {
						_, err = SettleSubscriptionPreConsume(id, 1)
						require.NoError(t, err)
					}
					age := int64(91 * 86400)
					if id == "retention-10-days" {
						age = 10 * 86400
					}
					require.NoError(t, db.Model(&SubscriptionPreConsumeRecord{}).Where("request_id = ?", id).UpdateColumn("updated_at", now-age).Error)
				}
				require.NoError(t, db.Create(&Task{TaskID: "retained-task", SubscriptionReceiptID: "retention-task"}).Error)
				_, err := CleanupSubscriptionPreConsumeRecords(7 * 86400)
				require.NoError(t, err)
				for _, id := range []string{"retention-10-days", "retention-pending", "retention-task"} {
					var receipt SubscriptionPreConsumeRecord
					require.NoError(t, db.Where("request_id = ?", id).First(&receipt).Error)
				}
				var count int64
				require.NoError(t, db.Model(&SubscriptionPreConsumeRecord{}).Where("request_id = ?", "retention-completed").Count(&count).Error)
				assert.Zero(t, count)
			})
		})
	}
}

func TestSubscriptionQuotaOppositePlanOrder(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := subscriptionQuotaTestDB(t, dialect)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			if dialect == "sqlite" {
				sqlDB.SetMaxOpenConns(1)
			}
			plans := []SubscriptionPlan{{Title: "Plan A"}, {Title: "Plan B"}}
			require.NoError(t, db.Create(&plans).Error)
			now := GetDBTimestamp()
			// Both users must skip their exhausted first choice, but their
			// expiration order visits the same two plan rows in opposite order.
			subs := []UserSubscription{
				{UserId: 6001, PlanId: plans[0].Id, Status: "active", AmountTotal: 1, AmountUsed: 1, EndTime: now + 86400},
				{UserId: 6001, PlanId: plans[1].Id, Status: "active", AmountTotal: 1, EndTime: now + 2*86400},
				{UserId: 6002, PlanId: plans[1].Id, Status: "active", AmountTotal: 1, AmountUsed: 1, EndTime: now + 86400},
				{UserId: 6002, PlanId: plans[0].Id, Status: "active", AmountTotal: 1, EndTime: now + 2*86400},
			}
			require.NoError(t, db.Create(&subs).Error)
			type admission struct {
				user   int
				result *SubscriptionPreConsumeResult
				err    error
			}
			results := make(chan admission, 2)
			start := make(chan struct{})
			for _, userID := range []int{6001, 6002} {
				go func() {
					<-start
					result, err := PreConsumeUserSubscription(fmt.Sprintf("opposite-%d", userID), userID, "model", 0, 1)
					results <- admission{userID, result, err}
				}()
			}
			close(start)
			for range 2 {
				select {
				case admitted := <-results:
					if assert.NoError(t, admitted.err, "both users must progress without a plan-lock deadlock") {
						want := subs[1].Id
						if admitted.user == 6002 {
							want = subs[3].Id
						}
						assert.Equal(t, want, admitted.result.UserSubscriptionId, "subscription expiration preference is preserved")
					}
				case <-time.After(10 * time.Second):
					t.Fatal("admission blocked on opposite plan order")
				}
			}
		})
	}
}

func TestSubscriptionQuotaSharedPlanDoesNotSerializeUsers(t *testing.T) {
	for _, dialect := range []string{"mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := subscriptionQuotaTestDB(t, dialect)
			plan := SubscriptionPlan{Title: "Shared policy", DailyLimit: 20}
			require.NoError(t, db.Create(&plan).Error)
			now := GetDBTimestamp()
			for i, operation := range []string{"admit", "reserve", "settle", "refund"} {
				t.Run(operation, func(t *testing.T) {
					subs := []UserSubscription{
						{UserId: 6500 + 2*i, PlanId: plan.Id, Status: "active", AmountTotal: 100, StartTime: now, EndTime: now + 86400},
						{UserId: 6501 + 2*i, PlanId: plan.Id, Status: "active", AmountTotal: 100, StartTime: now, EndTime: now + 86400},
					}
					require.NoError(t, db.Create(&subs).Error)
					firstID, secondID := operation+"-first", operation+"-second"
					_, err := PreConsumeUserSubscription(firstID, subs[0].UserId, "model", 0, 2)
					require.NoError(t, err)
					_, err = PreConsumeUserSubscription(secondID, subs[1].UserId, "model", 0, 2)
					require.NoError(t, err)
					// Pause a real accounting transaction after policy acquisition.
					// Another user's accounting must finish before this one resumes.
					entered, release := make(chan struct{}), make(chan struct{})
					firstDone, secondDone := make(chan error, 1), make(chan error, 1)
					secondStarted := false
					const callback = "test:hold_subscription_accounting"
					require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
						if sub, ok := tx.Statement.Dest.(*UserSubscription); ok && sub.Id == subs[0].Id {
							close(entered)
							<-release
						}
					}))
					t.Cleanup(func() {
						close(release)
						select {
						case err := <-firstDone:
							assert.NoError(t, err)
						case <-time.After(10 * time.Second):
							t.Error("first user's accounting did not finish")
						}
						if secondStarted {
							select {
							case err := <-secondDone:
								assert.NoError(t, err)
							case <-time.After(10 * time.Second):
								t.Error("second user's accounting did not finish")
							}
						}
						assert.NoError(t, db.Callback().Update().Remove(callback))
					})
					go func() { firstDone <- ReserveSubscriptionPreConsume(firstID, 3) }()
					select {
					case <-entered:
					case <-time.After(10 * time.Second):
						t.Fatal("first user's accounting did not reach the barrier")
					}
					wantUsed := int64(3)
					if operation == "settle" {
						wantUsed = 4
					} else if operation == "refund" {
						wantUsed = 0
					}
					secondStarted = true
					go func() {
						defer close(secondDone)
						var err error
						switch operation {
						case "admit":
							_, err = PreConsumeUserSubscription(operation+"-new", subs[1].UserId, "model", 0, 1)
						case "reserve":
							err = ReserveSubscriptionPreConsume(secondID, 3)
						case "settle":
							_, err = SettleSubscriptionPreConsume(secondID, 4)
						case "refund":
							err = RefundSubscriptionPreConsume(secondID)
						}
						secondDone <- err
					}()
					select {
					case err := <-secondDone:
						require.NoError(t, err)
					case <-time.After(10 * time.Second):
						t.Fatal("second user blocked on a shared plan's accounting")
					}
					require.NoError(t, db.First(&subs[1], subs[1].Id).Error)
					assert.Equal(t, wantUsed, subs[1].AmountUsed)
				})
			}
		})
	}
}

func TestSubscriptionQuotaCleanupPastRetainedBatch(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := subscriptionQuotaTestDB(t, dialect)
			now := GetDBTimestamp()
			old := now - 91*86400
			plan := SubscriptionPlan{Title: "Retained ledger batch"}
			require.NoError(t, db.Create(&plan).Error)
			sub := UserSubscription{UserId: 8001, PlanId: plan.Id, Status: "active", EndTime: now + 86400}
			require.NoError(t, db.Create(&sub).Error)
			var receipts []SubscriptionPreConsumeRecord
			var windows []SubscriptionQuotaWindow
			var tasks []Task
			// A complete cleanup batch is retained by tasks. The next receipt
			// and its window are expired and unreferenced.
			for i := range 501 {
				id := fmt.Sprintf("retained-batch-%d", i)
				receipts = append(receipts, SubscriptionPreConsumeRecord{RequestId: id, UserId: sub.UserId, UserSubscriptionId: sub.Id, AccountedAt: old, AccountedAmount: 1, SettledAt: old, Status: "consumed", QuotaGeneration: int64(i + 1)})
				windows = append(windows, SubscriptionQuotaWindow{SubscriptionId: sub.Id, Generation: int64(i + 1), Kind: "base", Used: 1, UpdatedAt: old})
				if i < 500 {
					tasks = append(tasks, Task{TaskID: id, SubscriptionReceiptID: id})
				}
			}
			require.NoError(t, db.CreateInBatches(&receipts, 100).Error)
			require.NoError(t, db.Model(&SubscriptionPreConsumeRecord{}).Where("user_subscription_id = ?", sub.Id).UpdateColumn("updated_at", old).Error)
			require.NoError(t, db.CreateInBatches(&windows, 100).Error)
			require.NoError(t, db.CreateInBatches(&tasks, 100).Error)
			removed, err := CleanupSubscriptionPreConsumeRecords(7 * 86400)
			require.NoError(t, err)
			assert.EqualValues(t, 1, removed)
			var remainingReceipts []SubscriptionPreConsumeRecord
			require.NoError(t, db.Order("id").Find(&remainingReceipts).Error)
			for i := range receipts {
				receipts[i].UpdatedAt = old
			}
			require.Len(t, remainingReceipts, 500)
			for i, receipt := range remainingReceipts {
				assert.Equal(t, receipts[i], receipt)
			}
			var remainingWindows []SubscriptionQuotaWindow
			require.NoError(t, db.Order("id").Find(&remainingWindows).Error)
			require.Len(t, remainingWindows, 500)
			for i, window := range remainingWindows {
				assert.Equal(t, windows[i], window)
			}
		})
	}
}
