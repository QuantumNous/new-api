package model

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestSubscriptionSummaryWindowReservationsMatrix(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{
			name: "sqlite",
			open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) },
		},
		{
			name: "mysql",
			dsn:  strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")),
			open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) },
		},
		{
			name: "postgres",
			dsn:  strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")),
			open: func(dsn string) gorm.Dialector {
				return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.name != "sqlite" && test.dsn == "" {
				t.Skipf("TEST_SUBSCRIPTION_%s_DSN is not configured", strings.ToUpper(test.name))
			}

			dsn := test.dsn
			if test.name == "sqlite" {
				dsn = filepath.Join(t.TempDir(), "subscription-summary.db")
			}
			db, err := gorm.Open(test.open(dsn), &gorm.Config{
				NamingStrategy: schema.NamingStrategy{
					TablePrefix: fmt.Sprintf("t01_%x_", time.Now().UnixNano()),
				},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&SubscriptionPreConsumeRecord{}, &UserSubscription{}))
			})

			require.NoError(t, db.AutoMigrate(&UserSubscription{}, &SubscriptionPreConsumeRecord{}))
			var version string
			versionQuery := "SELECT VERSION()"
			if test.name == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			now := time.Now().Unix()
			sub := UserSubscription{
				UserId: 1, AmountTotal: 400, TotalAmountUsed: 80, AmountReserved: 70,
				WindowAmount: 100, WindowAmountUsed: 30,
				QuotaModelVersion: 1, ResetGeneration: 2,
				StartTime: now - 86400, EndTime: now + 30*86400, Status: "active",
			}
			require.NoError(t, db.Create(&sub).Error)
			records := []SubscriptionPreConsumeRecord{
				{RequestId: "current-window", UserId: sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 40, ResetGeneration: 2, Status: "reserved"},
				{RequestId: "old-window", UserId: sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 30, ResetGeneration: 1, Status: "reserved"},
				{RequestId: "settled-current-window", UserId: sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 20, ResetGeneration: 2, Status: "settled"},
			}
			require.NoError(t, db.Create(&records).Error)

			var subscriptions []UserSubscription
			require.NoError(t, subscriptionUsageQuery(db).Where("id = ?", sub.Id).Find(&subscriptions).Error)
			// A settlement after the usage SELECT must not change the reservations
			// associated with the already-read usage counters.
			require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Model(&sub).Updates(map[string]any{"total_amount_used": 120, "window_amount_used": 70, "amount_reserved": 30}).Error; err != nil {
					return err
				}
				return tx.Model(&records[0]).Update("status", "settled").Error
			}))
			summaries, err := buildSubscriptionSummaries(db, subscriptions)
			require.NoError(t, err)
			require.Len(t, summaries, 1)
			assert.EqualValues(t, 70, summaries[0].Subscription.AmountReserved)
			assert.EqualValues(t, 40, summaries[0].Subscription.WindowAmountReserved)
		})
	}
}

func TestLegacySubscriptionResetSnapshotMatrix(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{name: "sqlite", open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{name: "mysql", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")), open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")), open: func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.name != "sqlite" && test.dsn == "" {
				t.Skipf("TEST_SUBSCRIPTION_%s_DSN is not configured", strings.ToUpper(test.name))
			}
			dsn := test.dsn
			if test.name == "sqlite" {
				dsn = filepath.Join(t.TempDir(), "legacy-reset.db")
			}
			db, err := gorm.Open(test.open(dsn), &gorm.Config{
				NamingStrategy: schema.NamingStrategy{TablePrefix: fmt.Sprintf("t02_%x_", time.Now().UnixNano())},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&SubscriptionPlan{}, &UserSubscription{})) })
			require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
			versionQuery := "SELECT VERSION()"
			if test.name == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			plan := SubscriptionPlan{Title: "Legacy", QuotaResetPeriod: SubscriptionResetDaily}
			require.NoError(t, db.Create(&plan).Error)
			start := GetDBTimestamp() - 48*3600
			type previousSubscription struct {
				Id                int `gorm:"primaryKey"`
				UserId            int
				PlanId            int
				AmountTotal       int64
				AmountUsed        int64
				QuotaModelVersion int
				StartTime         int64
				EndTime           int64
				Status            string
				LastResetTime     int64
				NextResetTime     int64
			}
			subscriptionsTable := db.NamingStrategy.TableName("UserSubscription")
			require.NoError(t, db.Table(subscriptionsTable).AutoMigrate(&previousSubscription{}))
			previous := previousSubscription{
				UserId: 1, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 450,
				StartTime: start, EndTime: start + 30*24*3600, Status: "active",
				LastResetTime: start + 2*3600, NextResetTime: start + 14*3600,
			}
			require.NoError(t, db.Table(subscriptionsTable).Create(&previous).Error)
			plan.QuotaResetPeriod = SubscriptionResetWeekly
			require.NoError(t, db.Save(&plan).Error)
			require.NoError(t, db.AutoMigrate(&UserSubscription{}))
			require.NoError(t, db.AutoMigrate(&UserSubscription{}))
			columns, err := db.Migrator().ColumnTypes(subscriptionsTable)
			require.NoError(t, err)
			for _, expected := range []string{"reset_policy_source", "legacy_reset_baseline_at"} {
				found := false
				for _, column := range columns {
					if strings.EqualFold(column.Name(), expected) {
						found = true
						break
					}
				}
				assert.True(t, found, "%s.%s should be migrated", subscriptionsTable, expected)
			}
			sub := UserSubscription{Id: previous.Id}
			require.NoError(t, db.First(&sub, sub.Id).Error)
			require.NoError(t, snapshotLegacySubscriptionResetPolicies(db))
			firstBaseline := getSubscriptionResetMigrationBaseline(t, db, sub.Id)
			require.NoError(t, snapshotLegacySubscriptionResetPolicies(db))
			secondBaseline := getSubscriptionResetMigrationBaseline(t, db, sub.Id)

			require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
				var locked UserSubscription
				if err := tx.First(&locked, sub.Id).Error; err != nil {
					return err
				}
				return maybeResetUserSubscriptionWithPlanTx(tx, &locked, &plan, start+24*3600+60)
			}))
			var updated UserSubscription
			require.NoError(t, db.First(&updated, sub.Id).Error)
			assert.EqualValues(t, 450, updated.AmountUsed)
			assert.Equal(t, SubscriptionResetWeekly, updated.LegacyResetPeriod)
			assert.Zero(t, updated.LegacyResetCustomSeconds)
			assert.Equal(t, SubscriptionResetPolicySourceMigrationBaseline, updated.ResetPolicySource)
			assert.NotZero(t, updated.LegacyResetBaselineAt)
			assert.Equal(t, updated.LegacyResetBaselineAt, updated.LastResetTime)
			assert.Equal(t, firstBaseline, secondBaseline)
			assert.Greater(t, updated.NextResetTime, start+24*3600+60)
			assert.Equal(t, updated.NextResetTime, calcNextResetTime(time.Unix(updated.LegacyResetBaselineAt, 0), &SubscriptionPlan{QuotaResetPeriod: SubscriptionResetWeekly}, previous.EndTime))
		})
	}
}

func getSubscriptionResetMigrationBaseline(t *testing.T, db *gorm.DB, id int) int64 {
	t.Helper()
	var row struct {
		BaselineAt int64 `gorm:"column:legacy_reset_baseline_at"`
	}
	require.NoError(t, db.Table(db.NamingStrategy.TableName("UserSubscription")).
		Select("legacy_reset_baseline_at").Where("id = ?", id).Scan(&row).Error)
	return row.BaselineAt
}

func TestSubscriptionQuotaOperationMigrationMatrix(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{name: "sqlite", open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{name: "mysql", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")), open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")), open: func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.name != "sqlite" && test.dsn == "" {
				t.Skipf("TEST_SUBSCRIPTION_%s_DSN is not configured", strings.ToUpper(test.name))
			}
			dsn := test.dsn
			if test.name == "sqlite" {
				dsn = filepath.Join(t.TempDir(), "subscription-quota-operation.db")
			}
			prefix := fmt.Sprintf("t04_%x_", time.Now().UnixNano())
			db, err := gorm.Open(test.open(dsn), &gorm.Config{
				NamingStrategy: schema.NamingStrategy{TablePrefix: prefix},
			})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })

			versionQuery := "SELECT VERSION()"
			if test.name == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			var version string
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			operationTable := prefix + "subscription_quota_operations"
			releasedTable := prefix + "released_user_subscriptions"
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(operationTable, releasedTable))
			})

			t.Run("fresh database and repeated migration", func(t *testing.T) {
				require.False(t, db.Migrator().HasTable(operationTable))
				for range 2 {
					require.NoError(t, db.Table(operationTable).AutoMigrate(&SubscriptionQuotaOperation{}))
				}
				migrator := db.Table(operationTable).Migrator()
				for _, field := range []string{"UserId", "UserSubscriptionId", "AdminId"} {
					assert.True(t, migrator.HasIndex(&SubscriptionQuotaOperation{}, field), "missing index for %s", field)
				}
				receipt := SubscriptionQuotaOperation{
					IdempotencyKey: "ticket04-fresh-" + test.name, UserId: 11, UserSubscriptionId: 12,
					Action: SubscriptionQuotaActionRestoreWindow, AdminId: 13, Reason: "support adjustment",
					ReturnedQuota: 20, TotalRemaining: 80, WindowRemaining: 30, CreatedAt: 1700000000,
				}
				require.NoError(t, db.Table(operationTable).Create(&receipt).Error)
				var stored SubscriptionQuotaOperation
				require.NoError(t, db.Table(operationTable).Where("idempotency_key = ?", receipt.IdempotencyKey).First(&stored).Error)
				assert.Equal(t, receipt, stored)
				duplicateKey := SubscriptionQuotaOperation{
					IdempotencyKey: receipt.IdempotencyKey, UserId: 99, UserSubscriptionId: 98,
					Action: SubscriptionQuotaActionInitialize, AdminId: 97, Reason: "different request",
					ReturnedQuota: 1, CreatedAt: 1700000001,
				}
				require.Error(t, db.Table(operationTable).Create(&duplicateKey).Error, "idempotency key must remain unique")
			})

			t.Run("released schema upgrade preserves subscription data", func(t *testing.T) {
				require.NoError(t, db.Migrator().DropTable(operationTable))
				type releasedSubscription struct {
					Id          int `gorm:"primaryKey"`
					UserId      int
					AmountTotal int64
					AmountUsed  int64
					StartTime   int64
					EndTime     int64
					Status      string `gorm:"type:varchar(32)"`
				}
				released := db.Table(releasedTable)
				require.NoError(t, released.AutoMigrate(&releasedSubscription{}))
				before := releasedSubscription{
					Id: 41, UserId: 42, AmountTotal: 1000, AmountUsed: 250,
					StartTime: 1700000000, EndTime: 1800000000, Status: "active",
				}
				require.NoError(t, released.Create(&before).Error)
				require.False(t, db.Migrator().HasTable(operationTable), "the latest released schema predates this new audit table")
				for range 2 {
					require.NoError(t, db.Table(operationTable).AutoMigrate(&SubscriptionQuotaOperation{}))
				}
				var after releasedSubscription
				require.NoError(t, released.First(&after, before.Id).Error)
				assert.Equal(t, before, after)
				assert.True(t, db.Migrator().HasTable(operationTable))
			})
		})
	}
}
