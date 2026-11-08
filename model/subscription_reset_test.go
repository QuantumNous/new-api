package model

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// runSubscriptionAccountingMatrix isolates the real accounting operations in
// fresh databases, without touching application tables or cached plan IDs.
func runSubscriptionAccountingMatrix(t *testing.T, test func(*testing.T)) {
	t.Helper()
	for _, engine := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(engine, func(t *testing.T) {
			dsn := os.Getenv("TEST_SUBSCRIPTION_" + strings.ToUpper(engine) + "_DSN")
			var dialect gorm.Dialector
			switch engine {
			case "sqlite":
				dialect = sqlite.Open(filepath.Join(t.TempDir(), "accounting.db"))
			case "mysql":
				dialect = mysql.Open(dsn)
			case "postgres":
				dialect = postgres.Open(dsn)
			}
			if engine != "sqlite" && dsn == "" {
				t.Skip("database DSN is not configured")
			}
			db, err := gorm.Open(dialect, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("accounting_%x_", time.Now().UnixNano())}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(5)
			if engine == "sqlite" {
				sqlDB.SetMaxOpenConns(1)
			}
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(engine))
			t.Cleanup(func() {
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				require.NoError(t, db.Migrator().DropTable(&SubscriptionPreConsumeRecord{}, &UserSubscription{}, &SubscriptionPlanVersion{}, &SubscriptionPlan{}, &SubscriptionQuotaOperation{}, &User{}))
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}, &SubscriptionPlanVersion{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}, &SubscriptionQuotaOperation{}, &User{}))
			test(t)
		})
	}
}

func TestUnlimitedSubscriptionReservationOverflowMatrix(t *testing.T) {
	runSubscriptionAccountingMatrix(t, func(t *testing.T) {
		now := GetDBTimestamp()
		plan := &SubscriptionPlan{Title: "Unlimited", QuotaResetPeriod: SubscriptionResetNever}
		require.NoError(t, DB.Create(plan).Error)
		sub := &UserSubscription{UserId: 1, PlanId: plan.Id, QuotaModelVersion: 1, TotalAmountUsed: math.MaxInt64 - 2, StartTime: now, EndTime: now + 3600, Status: "active"}
		require.NoError(t, DB.Create(sub).Error)
		_, err := PreConsumeUserSubscription("overflow-initial", sub.UserId, "", 0, 3)
		require.Error(t, err)
		_, err = PreConsumeUserSubscription("overflow-adjust", sub.UserId, "", 0, 1)
		require.NoError(t, err)
		require.Error(t, AdjustUserSubscriptionReservation("overflow-adjust", 2))
		require.NoError(t, SettleUserSubscriptionPreConsume("overflow-adjust", 0))
		updated := getSubscriptionResetSub(t, sub.Id)
		assert.EqualValues(t, math.MaxInt64-1, updated.TotalAmountUsed)
		assert.Zero(t, updated.AmountReserved)
	})
}

func TestAdminRestorePlanSubscriptionWindowsMatrix(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{name: "sqlite", open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{name: "mysql", dsn: os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN"), open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", dsn: os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN"), open: func(dsn string) gorm.Dialector { return postgres.Open(dsn) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.name != "sqlite" && tc.dsn == "" {
				t.Skip("database DSN is not configured")
			}
			for _, upgrade := range []bool{false, true} {
				t.Run(fmt.Sprintf("upgrade=%t", upgrade), func(t *testing.T) {
					dsn := tc.dsn
					if tc.name == "sqlite" {
						dsn = filepath.Join(t.TempDir(), "plan-window.db")
					}
					db, err := gorm.Open(tc.open(dsn), &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("pw_%x_", time.Now().UnixNano())}})
					require.NoError(t, err)
					sqlDB, err := db.DB()
					require.NoError(t, err)
					sqlDB.SetMaxOpenConns(1)
					t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
					t.Cleanup(func() {
						require.NoError(t, db.Migrator().DropTable(&SubscriptionPlanQuotaOperation{}, &SubscriptionQuotaOperation{}, &SubscriptionPreConsumeRecord{}, &UserSubscription{}, &SubscriptionPlan{}))
					})
					previousDB, previousType := DB, common.MainDatabaseType()
					DB = db
					common.SetMainDatabaseType(common.DatabaseType(tc.name))
					t.Cleanup(func() { DB = previousDB; common.SetMainDatabaseType(previousType) })
					versionSQL := "SELECT VERSION()"
					if tc.name == "sqlite" {
						versionSQL = "SELECT sqlite_version()"
					}
					var version string
					require.NoError(t, db.Raw(versionSQL).Scan(&version).Error)
					t.Logf("database version: %s", version)

					// The new receipt is additive: upgrading must leave released
					// subscription rows and their primary keys intact.
					if upgrade {
						type releasedSubscription struct {
							Id          int `gorm:"primaryKey"`
							UserId      int
							PlanId      int
							AmountTotal int64
							AmountUsed  int64
							Status      string `gorm:"type:varchar(32)"`
						}
						table := db.NamingStrategy.TableName("UserSubscription")
						require.NoError(t, db.Table(table).AutoMigrate(&releasedSubscription{}))
						legacy := releasedSubscription{Id: 50, UserId: 9, PlanId: 1, AmountTotal: 400, AmountUsed: 120, Status: "expired"}
						require.NoError(t, db.Table(table).Create(&legacy).Error)
						type releasedPlanQuotaOperation struct {
							IdempotencyKey string `gorm:"primaryKey;type:varchar(128)"`
							PlanId         int    `gorm:"index;not null"`
							AdminId        int    `gorm:"index;not null"`
							Reason         string `gorm:"type:text;not null"`
							MatchedCount   int    `gorm:"not null"`
							ResetCount     int    `gorm:"not null"`
							UserCount      int    `gorm:"not null"`
							CreatedAt      int64  `gorm:"bigint;not null"`
						}
						receiptTable := db.NamingStrategy.TableName("SubscriptionPlanQuotaOperation")
						require.NoError(t, db.Table(receiptTable).AutoMigrate(&releasedPlanQuotaOperation{}))
						require.NoError(t, db.Table(receiptTable).Create(&releasedPlanQuotaOperation{IdempotencyKey: "released-window", PlanId: 1, AdminId: 501, Reason: "released receipt", ResetCount: 2}).Error)
					}
					for range 2 {
						require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}, &SubscriptionQuotaOperation{}, &SubscriptionPlanQuotaOperation{}))
					}
					if upgrade {
						var legacy UserSubscription
						require.NoError(t, db.First(&legacy, 50).Error)
						assert.EqualValues(t, 120, legacy.AmountUsed)
						assert.EqualValues(t, 400, legacy.AmountTotal)
						assert.Equal(t, "expired", legacy.Status)
						var receipt SubscriptionPlanQuotaOperation
						require.NoError(t, db.First(&receipt, "idempotency_key = ?", "released-window").Error)
						assert.Equal(t, SubscriptionQuotaActionRestoreWindow, receipt.Action)
						assert.Equal(t, 2, receipt.ResetCount)
						require.NoError(t, db.Delete(&receipt).Error)
					}
					assert.True(t, db.Migrator().HasIndex(&SubscriptionPlanQuotaOperation{}, "PlanId"))
					assert.True(t, db.Migrator().HasIndex(&SubscriptionPlanQuotaOperation{}, "AdminId"))
					plan := &SubscriptionPlan{Id: 1, Title: "Updated plan", TotalAmount: 2000, WindowAmount: 900, QuotaResetPeriod: SubscriptionResetWeekly}
					require.NoError(t, db.Create(plan).Error)
					now := GetDBTimestamp()
					for i := range 8 {
						sub := UserSubscription{Id: 100 + i, UserId: 10 + i, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 850, TotalAmountUsed: 850, WindowAmount: 300, WindowAmountUsed: 200, AmountReserved: 40, HistoricalAmountUsed: 1400, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetWeekly, ResetGeneration: 3, StartTime: now - 3600, EndTime: now + 86400, LastResetTime: now - 100, NextResetTime: now + 1000, Status: "active"}
						switch i {
						case 1:
							sub.UserId, sub.WindowAmount = 10, 100
						case 2:
							sub.QuotaModelVersion, sub.AmountUsed = 0, 600
							sub.LegacyResetPeriod = SubscriptionResetWeekly
						case 3:
							sub.EndTime = now - 1
						case 4:
							sub.Status = "cancelled"
						case 5:
							sub.PlanId = 2
						case 6:
							sub.QuotaResetPeriod = SubscriptionResetNever
						case 7:
							sub.AmountTotal = 0
						}
						require.NoError(t, db.Create(&sub).Error)
					}
					require.NoError(t, db.Create(&SubscriptionPreConsumeRecord{RequestId: "batch-inflight", UserId: 10, UserSubscriptionId: 100, PreConsumed: 40, ResetGeneration: 3, Status: "reserved"}).Error)
					before := getSubscriptionResetSub(t, 100)
					result, err := AdminRestorePlanSubscriptionWindows(1, "batch-1", 501, "support adjustment")
					require.NoError(t, err)
					assert.Equal(t, 5, result.MatchedCount)
					assert.Equal(t, 3, result.ResetCount)
					assert.Equal(t, 2, result.UserCount)
					after := getSubscriptionResetSub(t, 100)
					assert.EqualValues(t, 550, after.TotalAmountUsed)
					assert.Zero(t, after.WindowAmountUsed)
					assert.EqualValues(t, 4, after.ResetGeneration)
					assert.Equal(t, before.AmountReserved, after.AmountReserved)
					assert.Equal(t, before.HistoricalAmountUsed, after.HistoricalAmountUsed)
					assert.Equal(t, before.StartTime, after.StartTime)
					assert.Equal(t, before.EndTime, after.EndTime)
					assert.Equal(t, before.LastResetTime, after.LastResetTime)
					assert.Equal(t, before.NextResetTime, after.NextResetTime)
					assert.EqualValues(t, 750, getSubscriptionResetSub(t, 101).TotalAmountUsed)
					assert.Zero(t, getSubscriptionResetSub(t, 102).AmountUsed)
					for _, id := range []int{103, 104, 105, 106, 107} {
						assert.EqualValues(t, 200, getSubscriptionResetSub(t, id).WindowAmountUsed)
					}
					var receipts []SubscriptionQuotaOperation
					require.NoError(t, db.Find(&receipts).Error)
					require.Len(t, receipts, 3)
					for _, receipt := range receipts {
						assert.Equal(t, 501, receipt.AdminId)
						assert.Equal(t, "support adjustment", receipt.Reason)
					}
					// A retry must not process subscriptions added after the first request.
					added := before
					added.Id, added.UserId = 108, 18
					require.NoError(t, db.Create(&added).Error)
					retry, err := AdminRestorePlanSubscriptionWindows(1, "batch-1", 501, "support adjustment")
					require.NoError(t, err)
					assert.Equal(t, result, retry)
					assert.EqualValues(t, 200, getSubscriptionResetSub(t, 108).WindowAmountUsed)
					_, err = AdminRestorePlanSubscriptionWindows(1, "batch-1", 501, "different reason")
					require.Error(t, err)
					_, err = AdminRestorePlanSubscriptionWindows(1, "batch-1", 502, "support adjustment")
					require.Error(t, err)
					require.Error(t, db.Create(result).Error, "batch receipt keys remain unique after repeated migrations")

					// An invalid later row must roll back earlier grants and their receipts.
					require.NoError(t, db.Model(&UserSubscription{}).Where("id = ?", 108).Update("window_amount_used", -1).Error)
					_, err = AdminRestorePlanSubscriptionWindows(1, "batch-rollback", 501, "rollback test")
					require.Error(t, err)
					assert.Equal(t, after, getSubscriptionResetSub(t, 100))
					var count int64
					require.NoError(t, db.Model(&SubscriptionQuotaOperation{}).Count(&count).Error)
					assert.EqualValues(t, 3, count)
					require.NoError(t, db.Model(&SubscriptionPlanQuotaOperation{}).Count(&count).Error)
					assert.EqualValues(t, 1, count)
					empty, err := AdminRestorePlanSubscriptionWindows(2, "empty-plan", 501, "no matching windows")
					require.Error(t, err, "a nonexistent plan must be rejected")
					assert.Nil(t, empty)
					require.NoError(t, db.Create(&SubscriptionPlan{Id: 3, Title: "Empty"}).Error)
					empty, err = AdminRestorePlanSubscriptionWindows(3, "empty-plan", 501, "no matching windows")
					require.NoError(t, err)
					assert.Zero(t, empty.ResetCount)
					_, err = AdminRestorePlanSubscriptionWindows(1, "missing-reason", 501, " ")
					require.Error(t, err)

					// Initialization covers all active subscriptions, including unlimited
					// and non-resetting snapshots, while preserving history and reservations.
					require.NoError(t, db.Model(&UserSubscription{}).Where("id = ?", 108).Update("window_amount_used", 200).Error)
					_, err = AdminRestorePlanSubscriptionQuota(1, SubscriptionQuotaActionInitialize, "batch-1", 501, "support adjustment")
					require.Error(t, err, "a window receipt cannot be reused for initialization")
					initialized, err := AdminRestorePlanSubscriptionQuota(1, SubscriptionQuotaActionInitialize, "batch-init", 501, "initialize all")
					require.NoError(t, err)
					assert.Equal(t, SubscriptionQuotaActionInitialize, initialized.Action)
					assert.Equal(t, 6, initialized.MatchedCount)
					assert.Equal(t, 6, initialized.ResetCount)
					assert.Equal(t, 5, initialized.UserCount)
					for _, id := range []int{100, 101, 102, 106, 107, 108} {
						updated := getSubscriptionResetSub(t, id)
						assert.Zero(t, updated.AmountUsed)
						assert.Zero(t, updated.WindowAmountUsed)
						if updated.QuotaModelVersion > 0 {
							assert.Zero(t, updated.TotalAmountUsed)
						}
						assert.EqualValues(t, 1400, updated.HistoricalAmountUsed)
						assert.EqualValues(t, 40, updated.AmountReserved)
						assert.Equal(t, before.StartTime, updated.StartTime)
						assert.Equal(t, before.EndTime, updated.EndTime)
						assert.Equal(t, before.LastResetTime, updated.LastResetTime)
						assert.Equal(t, before.NextResetTime, updated.NextResetTime)
						if id == 107 {
							assert.Zero(t, updated.AmountTotal)
						} else {
							assert.EqualValues(t, 1000, updated.AmountTotal)
						}
					}
					for _, id := range []int{103, 104, 105} {
						assert.EqualValues(t, 200, getSubscriptionResetSub(t, id).WindowAmountUsed)
					}
					require.NoError(t, db.Model(&UserSubscription{}).Where("id = ?", 100).Update("total_amount_used", 50).Error)
					retryInit, err := AdminRestorePlanSubscriptionQuota(1, SubscriptionQuotaActionInitialize, "batch-init", 501, "initialize all")
					require.NoError(t, err)
					assert.Equal(t, initialized, retryInit)
					assert.EqualValues(t, 50, getSubscriptionResetSub(t, 100).TotalAmountUsed)
					require.NoError(t, db.Model(&UserSubscription{}).Where("id = ?", 108).Update("window_amount_used", -1).Error)
					_, err = AdminRestorePlanSubscriptionQuota(1, SubscriptionQuotaActionInitialize, "init-rollback", 501, "rollback init")
					require.Error(t, err)
					assert.EqualValues(t, 50, getSubscriptionResetSub(t, 100).TotalAmountUsed)
					require.NoError(t, db.Model(&SubscriptionPlanQuotaOperation{}).Where("idempotency_key = ?", "init-rollback").Count(&count).Error)
					assert.Zero(t, count)
				})
			}
		})
	}
}

func seedSubscriptionResetPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
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

// ticket01: summary availability must exclude reservations from the current window only.
func TestUserSubscriptionSummariesIncludeCurrentWindowReservations(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	seedSubscriptionResetSub(t, &UserSubscription{
		Id: 9291, UserId: 9292, AmountTotal: 400, TotalAmountUsed: 80,
		WindowAmount: 100, WindowAmountUsed: 30, AmountReserved: 70,
		QuotaModelVersion: 1, ResetGeneration: 2,
		StartTime: now - 86400, EndTime: now + 30*86400, Status: "active",
	})
	require.NoError(t, DB.Create(&SubscriptionPreConsumeRecord{
		RequestId: "summary-current-window", UserId: 9292, UserSubscriptionId: 9291,
		PreConsumed: 40, ResetGeneration: 2, Status: "reserved",
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionPreConsumeRecord{
		RequestId: "summary-old-window", UserId: 9292, UserSubscriptionId: 9291,
		PreConsumed: 30, ResetGeneration: 1, Status: "reserved",
	}).Error)

	summaries, err := GetAllUserSubscriptions(9292)
	require.NoError(t, err)
	require.Len(t, summaries, 1)
	assert.EqualValues(t, 40, summaries[0].Subscription.WindowAmountReserved)
	assert.EqualValues(t, 70, summaries[0].Subscription.AmountReserved)
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

func TestSubscriptionPlanValidatesFiniteWindowQuota(t *testing.T) {
	tests := []struct {
		name    string
		plan    SubscriptionPlan
		wantErr bool
	}{
		{
			name: "finite reset requires a positive window quota",
			plan: SubscriptionPlan{
				TotalAmount:       400,
				QuotaModelVersion: 1,
				QuotaResetPeriod:  SubscriptionResetWeekly,
			},
			wantErr: true,
		},
		{
			name: "window quota cannot exceed finite total quota",
			plan: SubscriptionPlan{
				TotalAmount:       400,
				WindowAmount:      500,
				QuotaModelVersion: 1,
				QuotaResetPeriod:  SubscriptionResetWeekly,
			},
			wantErr: true,
		},
		{
			name: "finite plan accepts a valid window quota",
			plan: SubscriptionPlan{
				TotalAmount:       400,
				WindowAmount:      100,
				QuotaModelVersion: 1,
				QuotaResetPeriod:  SubscriptionResetWeekly,
			},
		},
		{
			name: "unlimited total makes window quota non-operative",
			plan: SubscriptionPlan{
				TotalAmount:       0,
				WindowAmount:      100,
				QuotaModelVersion: 1,
				QuotaResetPeriod:  SubscriptionResetWeekly,
			},
		},
		{
			name: "plan without reset does not require a window quota",
			plan: SubscriptionPlan{
				TotalAmount:       400,
				QuotaModelVersion: 1,
				QuotaResetPeriod:  SubscriptionResetNever,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := test.plan.ValidateQuotaConfiguration()
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestAdminRestoreSubscriptionQuotaPreservesHistoryReservationsAndPlan(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9701, Title: "Rolling", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, WindowAmount: 300, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetWeekly}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{Id: 9702, UserId: 9703, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 850, TotalAmountUsed: 850, WindowAmount: 300, WindowAmountUsed: 200, HistoricalAmountUsed: 1400, AmountReserved: 40, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetWeekly, StartTime: now - 86400, EndTime: now + 20*86400, Status: "active", LastResetTime: now - 100, NextResetTime: now + 604700, ResetGeneration: 3, UpgradeGroup: "pro"}
	seedSubscriptionResetSub(t, sub)
	require.NoError(t, DB.Create(&SubscriptionPreConsumeRecord{RequestId: "restore-window-inflight", UserId: sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 40, ResetGeneration: 3, Status: "reserved"}).Error)

	result, err := AdminRestoreUserSubscriptionQuota(sub.UserId, sub.Id, SubscriptionQuotaActionRestoreWindow, "admin-op-window-01", 501, "customer support")
	require.NoError(t, err)
	assert.EqualValues(t, 300, result.ReturnedQuota)
	assert.EqualValues(t, 410, result.TotalRemaining)
	assert.EqualValues(t, 300, result.WindowRemaining)

	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 550, updated.TotalAmountUsed)
	assert.EqualValues(t, 550, updated.AmountUsed)
	assert.Zero(t, updated.WindowAmountUsed)
	assert.EqualValues(t, 1400, updated.HistoricalAmountUsed)
	assert.EqualValues(t, 40, updated.AmountReserved)
	assert.EqualValues(t, 4, updated.ResetGeneration)
	assert.Equal(t, sub.StartTime, updated.StartTime)
	assert.Equal(t, sub.EndTime, updated.EndTime)
	assert.Equal(t, sub.LastResetTime, updated.LastResetTime)
	assert.Equal(t, sub.NextResetTime, updated.NextResetTime)
	assert.Equal(t, "pro", updated.UpgradeGroup)

	retry, err := AdminRestoreUserSubscriptionQuota(sub.UserId, sub.Id, SubscriptionQuotaActionRestoreWindow, "admin-op-window-01", 501, "customer support")
	require.NoError(t, err)
	assert.Equal(t, result, retry)
	assert.EqualValues(t, 550, getSubscriptionResetSub(t, sub.Id).TotalAmountUsed)

	secondRestore, err := AdminRestoreUserSubscriptionQuota(sub.UserId, sub.Id, SubscriptionQuotaActionRestoreWindow, "admin-op-window-02", 501, "second courtesy window")
	require.NoError(t, err)
	assert.EqualValues(t, 300, secondRestore.ReturnedQuota, "a zero-use window may still receive one administrator-granted window")
	assert.EqualValues(t, 710, secondRestore.TotalRemaining)
}

func TestAdminInitializeSubscriptionQuotaAndRestoreWindowBounds(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9711, Title: "Finite", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 400, WindowAmount: 300, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9712, UserId: 9713, PlanId: plan.Id, AmountTotal: 400, AmountUsed: 10, TotalAmountUsed: 10, WindowAmount: 300, WindowAmountUsed: 20, HistoricalAmountUsed: 70, AmountReserved: 5, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})

	window, err := AdminRestoreUserSubscriptionQuota(9713, 9712, SubscriptionQuotaActionRestoreWindow, "admin-op-clamp-01", 501, "restore")
	require.NoError(t, err)
	assert.EqualValues(t, 10, window.ReturnedQuota)
	assert.EqualValues(t, 395, window.TotalRemaining)
	assert.EqualValues(t, 300, window.WindowRemaining)

	init, err := AdminRestoreUserSubscriptionQuota(9713, 9712, SubscriptionQuotaActionInitialize, "admin-op-init-01", 501, "initialize traffic")
	require.NoError(t, err)
	assert.EqualValues(t, 0, init.ReturnedQuota)
	assert.EqualValues(t, 395, init.TotalRemaining)
	updated := getSubscriptionResetSub(t, 9712)
	assert.Zero(t, updated.TotalAmountUsed)
	assert.Zero(t, updated.AmountUsed)
	assert.Zero(t, updated.WindowAmountUsed)
	assert.EqualValues(t, 70, updated.HistoricalAmountUsed)
	assert.EqualValues(t, 5, updated.AmountReserved)
}

func TestAdminRestoreLegacySubscriptionWindowUsesLegacyCycleQuota(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9751, Title: "Legacy weekly", TotalAmount: 1000, QuotaResetPeriod: SubscriptionResetWeekly}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9752, UserId: 9753, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 600,
		LegacyResetPeriod: SubscriptionResetWeekly, ResetPolicySource: SubscriptionResetPolicySourceLegacy,
		StartTime: now - 3600, EndTime: now + 3600, Status: "active",
	}
	seedSubscriptionResetSub(t, sub)
	require.NoError(t, DB.Create(&SubscriptionPreConsumeRecord{
		RequestId: "legacy-restore-inflight", UserId: sub.UserId, UserSubscriptionId: sub.Id,
		PreConsumed: 100, Status: "consumed",
	}).Error)

	result, err := AdminRestoreUserSubscriptionQuota(
		sub.UserId, sub.Id, SubscriptionQuotaActionRestoreWindow,
		"legacy-restore-window", 501, "restore legacy cycle",
	)
	require.NoError(t, err)
	assert.EqualValues(t, 500, result.ReturnedQuota)
	assert.EqualValues(t, 900, result.TotalRemaining)
	assert.EqualValues(t, 900, result.WindowRemaining)

	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 100, updated.AmountUsed, "the in-flight request remains reserved")
	assert.Equal(t, SubscriptionResetWeekly, updated.LegacyResetPeriod)
	assert.Equal(t, sub.StartTime, updated.StartTime)
	assert.Equal(t, sub.EndTime, updated.EndTime)
	assert.Zero(t, updated.NextResetTime)
}

func TestAdminRestoreUnlimitedAndRejectsInactiveOrConflictingRequests(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9721, Title: "Unlimited", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, WindowAmount: 100, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9722, UserId: 9723, PlanId: plan.Id, AmountTotal: 0, AmountUsed: 50, TotalAmountUsed: 50, WindowAmount: 100, WindowAmountUsed: 40, HistoricalAmountUsed: 80, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})

	unlimited, err := AdminRestoreUserSubscriptionQuota(9723, 9722, SubscriptionQuotaActionRestoreWindow, "admin-op-unlimited-01", 501, "restore")
	require.NoError(t, err)
	assert.True(t, unlimited.Unlimited)
	assert.Zero(t, unlimited.ReturnedQuota)
	assert.EqualValues(t, 50, getSubscriptionResetSub(t, 9722).TotalAmountUsed)
	assert.Zero(t, getSubscriptionResetSub(t, 9722).WindowAmountUsed)

	_, err = AdminRestoreUserSubscriptionQuota(9723, 9722, SubscriptionQuotaActionInitialize, "admin-op-unlimited-01", 501, "restore")
	assert.Error(t, err, "an idempotency key cannot be reused for a different action")

	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", 9722).Update("status", "cancelled").Error)
	_, err = AdminRestoreUserSubscriptionQuota(9723, 9722, SubscriptionQuotaActionInitialize, "admin-op-inactive-01", 501, "restore")
	assert.Error(t, err, "inactive subscriptions cannot be restored")
}

func TestSubscriptionOrderUsesCapturedPlanTermsAfterPlanChanges(t *testing.T) {
	plan := SubscriptionPlan{
		TotalAmount:             400,
		WindowAmount:            100,
		QuotaModelVersion:       1,
		QuotaResetPeriod:        SubscriptionResetWeekly,
		QuotaResetCustomSeconds: 0,
		DurationUnit:            SubscriptionDurationMonth,
		DurationValue:           1,
		CustomSeconds:           0,
	}
	order := SubscriptionOrder{}
	order.CapturePlanTerms(&plan)

	plan.TotalAmount = 900
	plan.WindowAmount = 300
	plan.QuotaResetPeriod = SubscriptionResetMonthly
	plan.DurationValue = 12

	snapshot, err := order.PlanTerms()
	require.NoError(t, err)
	require.NotNil(t, snapshot)
	assert.EqualValues(t, 400, snapshot.TotalAmount)
	assert.EqualValues(t, 100, snapshot.WindowAmount)
	assert.Equal(t, SubscriptionResetWeekly, snapshot.QuotaResetPeriod)
	assert.Equal(t, 1, snapshot.DurationValue)
}

func TestLegacySubscriptionOrderHasNoPlanTermsSnapshot(t *testing.T) {
	order := SubscriptionOrder{PlanId: 1, Money: 5}

	snapshot, err := order.PlanTerms()
	require.NoError(t, err)
	assert.Nil(t, snapshot)
}

func TestRollingSubscriptionResetTimesUseSubscriptionAnchor(t *testing.T) {
	utc := time.UTC
	tests := []struct {
		name   string
		start  time.Time
		period string
		custom int64
		want   time.Time
	}{
		{name: "daily keeps activation time", start: time.Date(2026, 4, 5, 13, 45, 0, 0, utc), period: SubscriptionResetDaily, want: time.Date(2026, 4, 6, 13, 45, 0, 0, utc)},
		{name: "weekly keeps activation time", start: time.Date(2026, 4, 5, 13, 45, 0, 0, utc), period: SubscriptionResetWeekly, want: time.Date(2026, 4, 12, 13, 45, 0, 0, utc)},
		{name: "custom seconds", start: time.Date(2026, 4, 5, 13, 45, 0, 0, utc), period: SubscriptionResetCustom, custom: 90, want: time.Date(2026, 4, 5, 13, 46, 30, 0, utc)},
		{name: "month end clamps without anchor drift", start: time.Date(2026, 1, 31, 10, 20, 0, 0, utc), period: SubscriptionResetMonthly, want: time.Date(2026, 2, 28, 10, 20, 0, 0, utc)},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			plan := &SubscriptionPlan{QuotaResetPeriod: test.period, QuotaResetCustomSeconds: test.custom}
			got := calcRollingSubscriptionResetTime(test.start, test.start, plan, test.start.AddDate(1, 0, 0).Unix())
			assert.Equal(t, test.want.Unix(), got)
		})
	}
}

func TestRollingSubscriptionResetTimeStopsAtExpiryAndFindsCurrentWindow(t *testing.T) {
	anchor := time.Date(2026, 1, 31, 10, 20, 0, 0, time.UTC)
	plan := &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetMonthly}
	assert.Zero(t, calcRollingSubscriptionResetTime(anchor, anchor, plan, time.Date(2026, 2, 28, 10, 20, 0, 0, time.UTC).Unix()))

	// February's clamped boundary is followed by the original 31st-of-month anchor.
	got := calcRollingSubscriptionResetTime(anchor, time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC), plan, 0)
	assert.Equal(t, time.Date(2026, 3, 31, 10, 20, 0, 0, time.UTC).Unix(), got)
}

func TestSubscriptionResetPreservesLifetimeCountersAndKeepsLegacyBehavior(t *testing.T) {
	truncateTables(t)
	anchor := time.Date(2026, 4, 5, 13, 45, 0, 0, time.UTC).Unix()
	now := anchor + 3*24*3600 + 60
	plan := &SubscriptionPlan{Id: 9701, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)

	rolling := &UserSubscription{
		Id: 9702, UserId: 9701, PlanId: plan.Id, AmountTotal: 400, AmountUsed: 200,
		WindowAmount: 100, QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily,
		TotalAmountUsed: 250, WindowAmountUsed: 70, HistoricalAmountUsed: 150,
		StartTime: anchor, EndTime: now + 10*24*3600, Status: "active", LastResetTime: anchor,
		NextResetTime: anchor + 24*3600,
	}
	legacy := &UserSubscription{
		Id: 9703, UserId: 9701, PlanId: plan.Id, AmountTotal: 400, AmountUsed: 200,
		StartTime: anchor, EndTime: now + 10*24*3600, Status: "active",
		LastResetTime: anchor, NextResetTime: anchor + 24*3600,
	}
	seedSubscriptionResetSub(t, rolling)
	seedSubscriptionResetSub(t, legacy)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var rollingSub UserSubscription
		if err := tx.First(&rollingSub, rolling.Id).Error; err != nil {
			return err
		}
		if err := maybeResetUserSubscriptionWithPlanTx(tx, &rollingSub, plan, now); err != nil {
			return err
		}
		var legacySub UserSubscription
		if err := tx.First(&legacySub, legacy.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &legacySub, plan, now)
	}))

	rolling = &UserSubscription{}
	legacy = &UserSubscription{}
	require.NoError(t, DB.First(rolling, 9702).Error)
	require.NoError(t, DB.First(legacy, 9703).Error)
	assert.EqualValues(t, 200, rolling.AmountUsed)
	assert.Zero(t, rolling.WindowAmountUsed)
	assert.EqualValues(t, 250, rolling.TotalAmountUsed)
	assert.EqualValues(t, 150, rolling.HistoricalAmountUsed)
	assert.Equal(t, anchor+3*24*3600, rolling.LastResetTime)
	assert.Equal(t, anchor+4*24*3600, rolling.NextResetTime)
	assert.Zero(t, legacy.AmountUsed)
	assert.Zero(t, legacy.QuotaResetPeriod)
}

func TestLegacySubscriptionResetMigrationUsesCurrentPlanBaseline(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:               9891,
		Title:            "Legacy",
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	seedSubscriptionResetPlan(t, plan)
	now := GetDBTimestamp()
	start := now - 3600
	end := now + 30*24*3600
	sub := &UserSubscription{
		Id: 9892, UserId: 9893, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 450,
		StartTime: start, EndTime: end, Status: "active",
		LastResetTime: start, NextResetTime: calcNextResetTime(time.Unix(start, 0), plan, end),
	}
	seedSubscriptionResetSub(t, sub)

	plan.QuotaResetPeriod = SubscriptionResetWeekly
	require.NoError(t, DB.Save(plan).Error)
	require.NoError(t, snapshotLegacySubscriptionResetPolicies(DB))

	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 450, updated.AmountUsed, "migration uses the current plan as a labeled baseline instead of guessing purchase history")
	assert.EqualValues(t, 0, updated.WindowAmountUsed)
	assert.Equal(t, SubscriptionResetWeekly, updated.LegacyResetPeriod)
	assert.Equal(t, SubscriptionResetPolicySourceMigrationBaseline, updated.ResetPolicySource)
	assert.NotZero(t, updated.LegacyResetBaselineAt)
	assert.Equal(t, updated.LegacyResetBaselineAt, updated.LastResetTime)
	assert.Equal(t, calcNextResetTime(time.Unix(updated.LegacyResetBaselineAt, 0), &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetWeekly}, end), updated.NextResetTime)
}

func TestLegacySubscriptionMigrationBaselineDoesNotImmediatelyResetCustomWindow(t *testing.T) {
	truncateTables(t)
	plan := &SubscriptionPlan{Id: 9898, QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: 12 * 3600}
	seedSubscriptionResetPlan(t, plan)
	now := GetDBTimestamp()
	sub := &UserSubscription{
		Id: 9899, UserId: 9899, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 450,
		StartTime: now - 30*24*3600, EndTime: now + 30*24*3600, Status: "active",
		LastResetTime: now - 20*24*3600, NextResetTime: now - 24*3600,
	}
	seedSubscriptionResetSub(t, sub)

	require.NoError(t, snapshotLegacySubscriptionResetPolicies(DB))
	migrated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 450, migrated.AmountUsed)
	assert.Equal(t, migrated.LegacyResetBaselineAt, migrated.LastResetTime)
	assert.Equal(t, migrated.LegacyResetBaselineAt+12*3600, migrated.NextResetTime)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked UserSubscription
		if err := tx.First(&locked, sub.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, migrated.LegacyResetBaselineAt+12*3600-1)
	}))
	assert.EqualValues(t, 450, getSubscriptionResetSub(t, sub.Id).AmountUsed)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked UserSubscription
		if err := tx.First(&locked, sub.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, migrated.LegacyResetBaselineAt+12*3600)
	}))
	assert.Zero(t, getSubscriptionResetSub(t, sub.Id).AmountUsed)
}

func TestVersionedSubscriptionResetIgnoresLaterPlanEdits(t *testing.T) {
	truncateTables(t)
	start := time.Date(2026, time.January, 1, 12, 0, 0, 0, time.UTC)
	plan := &SubscriptionPlan{Id: 9893, QuotaResetPeriod: SubscriptionResetDaily, QuotaResetCustomSeconds: 0}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9894, UserId: 9894, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 300,
		QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily,
		StartTime: start.Unix(), EndTime: start.AddDate(0, 1, 0).Unix(), Status: "active",
		LastResetTime: start.Unix(), NextResetTime: start.Add(24 * time.Hour).Unix(),
	}
	seedSubscriptionResetSub(t, sub)
	plan.QuotaResetPeriod = SubscriptionResetWeekly
	require.NoError(t, DB.Save(plan).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked UserSubscription
		if err := tx.First(&locked, sub.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, start.Add(25*time.Hour).Unix())
	}))

	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 300, updated.AmountUsed)
	assert.Zero(t, updated.WindowAmountUsed)
	assert.Equal(t, SubscriptionResetDaily, updated.QuotaResetPeriod)
	assert.Equal(t, start.Add(48*time.Hour).Unix(), updated.NextResetTime)
}

func TestLegacySubscriptionResetMigrationIsIdempotentAndUsesCurrentConfiguration(t *testing.T) {
	truncateTables(t)
	plan := &SubscriptionPlan{Id: 9895, QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: 43200}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9896, UserId: 9897, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 100,
		StartTime: 1_700_000_000, EndTime: 1_800_000_000, Status: "active",
		LastResetTime: 1_700_010_000, NextResetTime: 1_700_020_000,
	}
	seedSubscriptionResetSub(t, sub)

	require.NoError(t, snapshotLegacySubscriptionResetPolicies(DB))
	first := getSubscriptionResetSub(t, sub.Id)
	require.NoError(t, snapshotLegacySubscriptionResetPolicies(DB))
	second := getSubscriptionResetSub(t, sub.Id)

	assert.Equal(t, SubscriptionResetCustom, first.LegacyResetPeriod)
	assert.EqualValues(t, 43200, first.LegacyResetCustomSeconds)
	assert.Equal(t, SubscriptionResetPolicySourceMigrationBaseline, first.ResetPolicySource)
	assert.NotZero(t, first.LegacyResetBaselineAt)
	assert.Equal(t, first.LegacyResetPeriod, second.LegacyResetPeriod)
	assert.Equal(t, first.LegacyResetCustomSeconds, second.LegacyResetCustomSeconds)
	assert.Equal(t, first.LegacyResetBaselineAt, second.LegacyResetBaselineAt)
}

func TestWindowBoundReservationsAdmissionSettlementAndRefund(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9801, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9802, UserId: 9801, PlanId: plan.Id, AmountTotal: 400, WindowAmount: 100,
		QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 3600,
		EndTime: now + 10*24*3600, Status: "active", LastResetTime: now - 60,
		NextResetTime: now + 24*3600 - 60,
	}
	seedSubscriptionResetSub(t, sub)

	first, err := PreConsumeUserSubscription("window-reservation-a", sub.UserId, "", 0, 60)
	require.NoError(t, err)
	assert.Equal(t, sub.Id, first.UserSubscriptionId)
	second, err := PreConsumeUserSubscription("window-reservation-b", sub.UserId, "", 0, 30)
	require.NoError(t, err)
	assert.Equal(t, sub.Id, second.UserSubscriptionId)

	require.NoError(t, RefundSubscriptionPreConsume("window-reservation-a"))
	require.NoError(t, RefundSubscriptionPreConsume("window-reservation-a"))
	assert.EqualValues(t, 30, getSubscriptionResetSub(t, sub.Id).AmountReserved, "refund must leave another request's reservation untouched")
	third, err := PreConsumeUserSubscription("window-reservation-c", sub.UserId, "", 0, 70)
	require.NoError(t, err)
	assert.EqualValues(t, 70, third.PreConsumed)

	require.NoError(t, SettleUserSubscriptionPreConsume("window-reservation-c", -30))
	require.NoError(t, SettleUserSubscriptionPreConsume("window-reservation-c", -30))
	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 30, updated.AmountReserved)
	assert.EqualValues(t, 40, updated.TotalAmountUsed)
	assert.EqualValues(t, 40, updated.WindowAmountUsed)
	assert.EqualValues(t, 40, updated.HistoricalAmountUsed)
}

func TestOldWindowSettlementDoesNotChargeNewWindowOrManualGeneration(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9901, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9902, UserId: 9901, PlanId: plan.Id, AmountTotal: 400, WindowAmount: 100,
		QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 3600,
		EndTime: now + 10*24*3600, Status: "active", LastResetTime: now - 60,
		NextResetTime: now + 24*3600 - 60,
	}
	seedSubscriptionResetSub(t, sub)
	_, err := PreConsumeUserSubscription("window-crossing", sub.UserId, "", 0, 40)
	require.NoError(t, err)

	reset, err := AdminResetUserSubscriptionsByPlan(sub.UserId, plan.Id, true)
	require.NoError(t, err)
	require.Equal(t, 1, reset.ResetCount)
	beforeSettle := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 40, beforeSettle.AmountReserved, "admin window reset must retain the in-flight reservation")
	assert.EqualValues(t, 1, beforeSettle.ResetGeneration)
	assert.Zero(t, beforeSettle.WindowAmountUsed)
	require.NoError(t, SettleUserSubscriptionPreConsume("window-crossing", 5))
	updated := getSubscriptionResetSub(t, sub.Id)
	assert.Zero(t, updated.AmountReserved)
	assert.EqualValues(t, 45, updated.TotalAmountUsed)
	assert.EqualValues(t, 45, updated.HistoricalAmountUsed)
	assert.Zero(t, updated.WindowAmountUsed)
}

func TestSubscriptionReservationRemainsBoundToPlanVersionAcrossEdits(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9921, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	version := &SubscriptionPlanVersion{Id: 9922, PlanId: plan.Id, Version: 1, TermsSnapshot: "v1"}
	require.NoError(t, DB.Create(version).Error)
	sub := &UserSubscription{
		Id: 9923, UserId: 9924, PlanId: plan.Id, PlanVersionId: version.Id,
		AmountTotal: 400, WindowAmount: 100, QuotaModelVersion: 1,
		QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 60,
		EndTime: now + 10*24*3600, Status: "active",
	}
	seedSubscriptionResetSub(t, sub)

	_, err := PreConsumeUserSubscription("plan-version-bound", sub.UserId, "", 0, 40)
	require.NoError(t, err)
	plan.QuotaResetPeriod = SubscriptionResetWeekly
	require.NoError(t, DB.Save(plan).Error)

	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "plan-version-bound").First(&record).Error)
	assert.Equal(t, version.Id, record.PlanVersionId)
	assert.Equal(t, sub.PlanVersionId, record.PlanVersionId)
}

func TestManualWindowRestoreMovesInFlightSettlementToNewGeneration(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9931, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9932, UserId: 9933, PlanId: plan.Id, AmountTotal: 200, TotalAmountUsed: 50,
		WindowAmount: 100, WindowAmountUsed: 50, QuotaModelVersion: 1,
		QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 60,
		EndTime: now + 86400, Status: "active", LastResetTime: now - 60, NextResetTime: now + 86400,
	}
	seedSubscriptionResetSub(t, sub)
	_, err := PreConsumeUserSubscription("manual-generation-bound", sub.UserId, "", 0, 40)
	require.NoError(t, err)

	_, err = AdminRestoreUserSubscriptionQuota(
		sub.UserId, sub.Id, SubscriptionQuotaActionRestoreWindow,
		"manual-generation-restore", 9934, "restore one window",
	)
	require.NoError(t, err)
	restored := getSubscriptionResetSub(t, sub.Id)
	require.EqualValues(t, 1, restored.ResetGeneration)
	require.EqualValues(t, 40, restored.AmountReserved)

	settlement, err := SettleUserSubscriptionFunding("manual-generation-bound", 0)
	require.NoError(t, err)
	assert.EqualValues(t, 40, settlement.SubscriptionAmount)
	updated := getSubscriptionResetSub(t, sub.Id)
	assert.EqualValues(t, 40, updated.TotalAmountUsed)
	assert.EqualValues(t, 40, updated.HistoricalAmountUsed)
	assert.Zero(t, updated.WindowAmountUsed, "an old-generation request must not consume restored window quota")
	assert.Zero(t, updated.AmountReserved)
}

func TestLegacyRefundAfterAutomaticResetDoesNotReduceNewWindowUsage(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9941, QuotaResetPeriod: SubscriptionResetCustom, QuotaResetCustomSeconds: 60}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9942, UserId: 9943, PlanId: plan.Id, AmountTotal: 100,
		LegacyResetPeriod: SubscriptionResetCustom, LegacyResetCustomSeconds: 60,
		ResetPolicySource: SubscriptionResetPolicySourceLegacy,
		StartTime:         now - 3600, EndTime: now + 3600, Status: "active",
		LastResetTime: now - 120, NextResetTime: now + 60,
	}
	seedSubscriptionResetSub(t, sub)
	_, err := PreConsumeUserSubscription("legacy-old-window", sub.UserId, "", 0, 40)
	require.NoError(t, err)
	_, err = PreConsumeUserSubscription("legacy-old-window-settlement", sub.UserId, "", 0, 40)
	require.NoError(t, err)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked UserSubscription
		if err := lockForUpdate(tx).First(&locked, sub.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, now+180)
	}))
	afterReset := getSubscriptionResetSub(t, sub.Id)
	require.EqualValues(t, 1, afterReset.ResetGeneration)

	_, err = PreConsumeUserSubscription("legacy-new-window", sub.UserId, "", 0, 25)
	require.NoError(t, err)
	settlement, err := SettleUserSubscriptionFunding("legacy-old-window-settlement", 15)
	require.NoError(t, err)
	assert.EqualValues(t, 55, settlement.SubscriptionAmount)
	assert.EqualValues(t, 80, getSubscriptionResetSub(t, sub.Id).AmountUsed, "legacy settlement charges the full old-window request after reset")
	require.NoError(t, RefundSubscriptionPreConsume("legacy-old-window"))
	assert.EqualValues(t, 80, getSubscriptionResetSub(t, sub.Id).AmountUsed, "an old-window refund must not reduce current usage")
}

func TestConcurrentWindowReservationsCannotOverbook(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{Id: 9911, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, plan)
	sub := &UserSubscription{
		Id: 9912, UserId: 9911, PlanId: plan.Id, AmountTotal: 400, WindowAmount: 100,
		QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily, StartTime: now - 60,
		EndTime: now + 10*24*3600, Status: "active", LastResetTime: now - 60,
		NextResetTime: now + 24*3600 - 60,
	}
	seedSubscriptionResetSub(t, sub)

	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, requestId := range []string{"concurrent-window-a", "concurrent-window-b"} {
		wg.Go(func() {
			_, err := PreConsumeUserSubscription(requestId, sub.UserId, "", 0, 60)
			results <- err
		})
	}
	wg.Wait()
	close(results)
	succeeded := 0
	failed := 0
	for err := range results {
		if err == nil {
			succeeded++
		} else {
			failed++
		}
	}
	assert.Equal(t, 1, succeeded)
	assert.Equal(t, 1, failed)
	assert.EqualValues(t, 60, getSubscriptionResetSub(t, sub.Id).AmountReserved)
}

func TestSubscriptionOrderRejectsCorruptPlanTermsSnapshot(t *testing.T) {
	order := SubscriptionOrder{PlanTermsSnapshot: "{"}

	snapshot, err := order.PlanTerms()
	require.Error(t, err)
	assert.Nil(t, snapshot)
}

func TestSubscriptionOrderPersistsCapturedPlanTerms(t *testing.T) {
	truncateTables(t)
	plan := &SubscriptionPlan{
		Id:                9601,
		Title:             "Captured plan",
		TotalAmount:       400,
		WindowAmount:      100,
		QuotaModelVersion: 1,
		QuotaResetPeriod:  SubscriptionResetWeekly,
		DurationUnit:      SubscriptionDurationMonth,
		DurationValue:     1,
	}
	order := &SubscriptionOrder{
		UserId:  101,
		PlanId:  plan.Id,
		TradeNo: "captured-plan-terms-persisted",
		Status:  "pending",
	}
	order.CapturePlanTerms(plan)
	require.NoError(t, order.Insert())

	persisted := GetSubscriptionOrderByTradeNo(order.TradeNo)
	require.NotNil(t, persisted)
	snapshot, err := persisted.PlanTerms()
	require.NoError(t, err)
	require.NotNil(t, snapshot)
	assert.EqualValues(t, 400, snapshot.TotalAmount)
	assert.EqualValues(t, 100, snapshot.WindowAmount)
	assert.Equal(t, SubscriptionResetWeekly, snapshot.QuotaResetPeriod)
	assert.Equal(t, 1, snapshot.DurationValue)
}
