package model

import (
	"errors"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// The matrix uses only task-owned, initially empty databases. Run the Go test runner
// inside the same disposable Docker network as MySQL and PostgreSQL.
func TestSubscriptionApplicableGroupDatabaseMatrix(t *testing.T) {
	for _, dialect := range []struct {
		name, dsn string
		kind      common.DatabaseType
		open      func(string) gorm.Dialector
	}{
		{"sqlite", ":memory:", common.DatabaseTypeSQLite, func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{"mysql", os.Getenv("TEST_MYSQL_DSN"), common.DatabaseTypeMySQL, func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{"postgres", os.Getenv("TEST_POSTGRES_DSN"), common.DatabaseTypePostgreSQL, func(dsn string) gorm.Dialector {
			return postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
		}},
	} {
		t.Run(dialect.name, func(t *testing.T) {
			if strings.TrimSpace(dialect.dsn) == "" {
				t.Skip("task-owned database DSN not configured")
			}
			db, err := gorm.Open(dialect.open(dialect.dsn), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			if dialect.name == "sqlite" {
				sqlDB.SetMaxOpenConns(1)
			} else {
				var name string
				query := "SELECT DATABASE()"
				if dialect.name == "postgres" {
					query = "SELECT current_database()"
				}
				require.NoError(t, db.Raw(query).Scan(&name).Error)
				require.Contains(t, strings.ToLower(name), "test")
			}
			var version string
			versionQuery := "SELECT version()"
			if dialect.name == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("%s: %s", dialect.name, version)
			tables, err := db.Migrator().GetTables()
			require.NoError(t, err)
			require.Empty(t, tables, "database must be isolated and empty")

			oldDB, oldLog := DB, LOG_DB
			oldMain, oldLogType := common.MainDatabaseType(), common.LogDatabaseType()
			DB, LOG_DB = db, db
			common.SetDatabaseTypes(dialect.kind, dialect.kind)
			initCol()
			defer func() {
				DB, LOG_DB = oldDB, oldLog
				common.SetDatabaseTypes(oldMain, oldLogType)
				initCol()
			}()

			// Fresh schema, including the hand-maintained SQLite CREATE TABLE path.
			if dialect.name == "sqlite" {
				require.NoError(t, ensureSubscriptionPlanTableSQLite())
				require.NoError(t, ensureSubscriptionPlanTableSQLite())
			} else {
				for range 2 {
					require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
				}
			}
			require.True(t, db.Migrator().HasColumn(&SubscriptionPlan{}, "applicable_group"))
			require.True(t, db.Migrator().HasColumn(&SubscriptionPlan{}, "partner_tenant_id"))
			require.True(t, db.Migrator().HasColumn(&SubscriptionPlan{}, "requests_per_minute"))
			require.NoError(t, db.Create(&SubscriptionPlan{Title: "fresh", PriceAmount: 2, DurationUnit: SubscriptionDurationMonth, DurationValue: 1}).Error)
			var fresh SubscriptionPlan
			require.NoError(t, db.Where("title = ?", "fresh").First(&fresh).Error)
			assert.Empty(t, fresh.ApplicableGroup)
			require.NoError(t, db.Migrator().DropTable(&SubscriptionPlan{}))

			// Representative released plan layout before applicable_group existed.
			type releasedPlan struct {
				Id                      int
				Title                   string  `gorm:"type:varchar(128);not null"`
				Subtitle                string  `gorm:"type:varchar(255);default:''"`
				PriceAmount             float64 `gorm:"type:decimal(10,6);not null;default:0"`
				Currency                string  `gorm:"type:varchar(8);not null;default:'USD'"`
				DurationUnit            string  `gorm:"type:varchar(16);not null;default:'month'"`
				DurationValue           int     `gorm:"type:int;not null;default:1"`
				CustomSeconds           int64   `gorm:"type:bigint;not null;default:0"`
				Enabled                 bool    `gorm:"default:true"`
				SortOrder               int     `gorm:"type:int;default:0"`
				AllowBalancePay         *bool
				AllowWalletOverflow     *bool
				StripePriceId           string `gorm:"type:varchar(128);default:''"`
				CreemProductId          string `gorm:"type:varchar(128);default:''"`
				WaffoPancakeProductId   string `gorm:"type:varchar(128);default:''"`
				MaxPurchasePerUser      int    `gorm:"type:int;default:0"`
				UpgradeGroup            string `gorm:"type:varchar(64);default:''"`
				DowngradeGroup          string `gorm:"type:varchar(64);default:''"`
				TotalAmount             int64  `gorm:"type:bigint;not null;default:0"`
				QuotaResetPeriod        string `gorm:"type:varchar(16);default:'never'"`
				QuotaResetCustomSeconds int64  `gorm:"type:bigint;default:0"`
				CreatedAt               int64  `gorm:"bigint"`
				UpdatedAt               int64  `gorm:"bigint"`
			}
			if dialect.name == "sqlite" {
				// v1.0.0-rc.40 model/main.go:ensureSubscriptionPlanTableSQLite used
				// hand-written DDL, not GORM AutoMigrate. Preserve its actual defaults.
				const releasedSQLitePlanDDL = `CREATE TABLE subscription_plans (
id integer,
title varchar(128) NOT NULL,
subtitle varchar(255) DEFAULT '',
price_amount decimal(10,6) NOT NULL,
currency varchar(8) NOT NULL DEFAULT 'USD',
duration_unit varchar(16) NOT NULL DEFAULT 'month',
duration_value integer NOT NULL DEFAULT 1,
custom_seconds bigint NOT NULL DEFAULT 0,
enabled numeric DEFAULT 1,
sort_order integer DEFAULT 0,
allow_balance_pay numeric DEFAULT 1,
allow_wallet_overflow numeric DEFAULT 1,
stripe_price_id varchar(128) DEFAULT '',
creem_product_id varchar(128) DEFAULT '',
waffo_pancake_product_id varchar(128) DEFAULT '',
max_purchase_per_user integer DEFAULT 0,
upgrade_group varchar(64) DEFAULT '',
downgrade_group varchar(64) DEFAULT '',
total_amount bigint NOT NULL DEFAULT 0,
quota_reset_period varchar(16) DEFAULT 'never',
quota_reset_custom_seconds bigint DEFAULT 0,
created_at bigint,
updated_at bigint,
PRIMARY KEY (id)
)`
				require.NoError(t, db.Exec(releasedSQLitePlanDDL).Error)
			} else {
				require.NoError(t, db.Table("subscription_plans").AutoMigrate(&releasedPlan{}))
			}
			require.NoError(t, db.Table("subscription_plans").Create(&releasedPlan{Id: 4701, Title: "legacy", PriceAmount: 4.5, DurationUnit: "month", DurationValue: 1, TotalAmount: 900}).Error)
			originalIndexes, err := db.Migrator().GetIndexes("subscription_plans")
			require.NoError(t, err)
			for range 2 {
				if dialect.name == "sqlite" {
					require.NoError(t, ensureSubscriptionPlanTableSQLite())
				} else {
					require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
				}
			}
			var legacy SubscriptionPlan
			require.NoError(t, db.First(&legacy, 4701).Error)
			assert.Equal(t, "legacy", legacy.Title)
			assert.Equal(t, 4.5, legacy.PriceAmount)
			assert.EqualValues(t, 900, legacy.TotalAmount)
			assert.Empty(t, legacy.ApplicableGroup)
			assert.Zero(t, legacy.PartnerTenantId)
			assert.Zero(t, legacy.RequestsPerMinute)
			upgradedIndexes, err := db.Migrator().GetIndexes("subscription_plans")
			require.NoError(t, err)
			assert.Equal(t, len(originalIndexes), len(upgradedIndexes), "upgrade must preserve indexes")
			for i := range originalIndexes {
				assert.Equal(t, originalIndexes[i].Name(), upgradedIndexes[i].Name())
			}
			require.Error(t, db.Table("subscription_plans").Create(&releasedPlan{Id: 4701, Title: "duplicate", DurationUnit: "month", DurationValue: 1}).Error)
			// The released pre-consume table had no group snapshot. Its index and
			// old rows must survive AutoMigrate on all three database engines.
			type releasedPreConsumeRecord struct {
				Id                 int
				RequestId          string `gorm:"type:varchar(64);uniqueIndex"`
				UserId             int    `gorm:"index"`
				UserSubscriptionId int    `gorm:"index"`
				PreConsumed        int64  `gorm:"type:bigint;not null;default:0"`
				Status             string `gorm:"type:varchar(32);index"`
				CreatedAt          int64  `gorm:"bigint"`
				UpdatedAt          int64  `gorm:"bigint;index"`
			}
			require.NoError(t, db.Table("subscription_pre_consume_records").AutoMigrate(&releasedPreConsumeRecord{}))
			require.NoError(t, db.Table("subscription_pre_consume_records").Create(&releasedPreConsumeRecord{
				Id: 4901, RequestId: "legacy-scope", UserId: 51, UserSubscriptionId: 4804, PreConsumed: 20, Status: "consumed",
			}).Error)
			oldRecordIndexes, err := db.Migrator().GetIndexes("subscription_pre_consume_records")
			require.NoError(t, err)
			for range 2 {
				require.NoError(t, db.AutoMigrate(&UserSubscription{}, &SubscriptionPreConsumeRecord{}))
			}
			var oldRecord SubscriptionPreConsumeRecord
			require.NoError(t, db.Where("request_id = ?", "legacy-scope").First(&oldRecord).Error)
			assert.Equal(t, 4901, oldRecord.Id)
			assert.Empty(t, oldRecord.BillingGroup)
			assert.Empty(t, oldRecord.ApplicableGroup)
			upgradedRecordIndexes, err := db.Migrator().GetIndexes("subscription_pre_consume_records")
			require.NoError(t, err)
			beforeNames := make([]string, 0, len(oldRecordIndexes))
			for _, index := range oldRecordIndexes {
				beforeNames = append(beforeNames, index.Name())
			}
			afterNames := make([]string, 0, len(upgradedRecordIndexes))
			for _, index := range upgradedRecordIndexes {
				afterNames = append(afterNames, index.Name())
			}
			assert.ElementsMatch(t, beforeNames, afterNames)
			require.Error(t, db.Table("subscription_pre_consume_records").Create(&releasedPreConsumeRecord{
				RequestId: "legacy-scope", UserId: 51, UserSubscriptionId: 4804, Status: "consumed",
			}).Error, "request ID uniqueness must survive migration")
			now := GetDBTimestamp()
			plans := []SubscriptionPlan{
				{Id: 4702, Title: "deepflash", ApplicableGroup: "deepflash", DurationUnit: "month", DurationValue: 1},
				{Id: 4703, Title: "other", ApplicableGroup: "other", DurationUnit: "month", DurationValue: 1},
				{Id: 4704, Title: "later", ApplicableGroup: "deepflash", DurationUnit: "month", DurationValue: 1},
			}
			require.NoError(t, db.Create(&plans).Error)
			for _, sub := range []UserSubscription{
				{Id: 4801, UserId: 51, PlanId: 4702, Status: "active", StartTime: now - 1, EndTime: now + 1000, AmountTotal: 100, AmountUsed: 90, AllowWalletOverflow: false},
				{Id: 4802, UserId: 51, PlanId: 4703, Status: "active", StartTime: now - 1, EndTime: now + 2000, AmountTotal: 100, AllowWalletOverflow: false},
				{Id: 4803, UserId: 51, PlanId: 4704, Status: "active", StartTime: now - 1, EndTime: now + 3000, AmountTotal: 100},
				{Id: 4804, UserId: 51, PlanId: 4701, Status: "active", StartTime: now - 1, EndTime: now + 4000, AmountTotal: 100, AmountUsed: 20},
			} {
				require.NoError(t, db.Create(&sub).Error)
			}
			oldReplay, err := PreConsumeUserSubscription("legacy-scope", 51, "same-model", "unlisted", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, 4804, oldReplay.UserSubscriptionId)
			assert.Empty(t, oldReplay.ApplicableGroup)
			result, err := PreConsumeUserSubscription("test-group-1", 51, "same-model", "deepflash", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, 4803, result.UserSubscriptionId, "earliest applicable plan that covers the whole reservation")
			assert.Equal(t, "deepflash", result.ApplicableGroup, "reserve the selected plan's scope for retries")
			require.NoError(t, PostConsumeUserSubscriptionDelta(result.UserSubscriptionId, 5))
			result, err = PreConsumeUserSubscription("test-group-2", 51, "same-model", "other", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, 4802, result.UserSubscriptionId)
			require.NoError(t, RefundSubscriptionPreConsume("test-group-2"))
			require.NoError(t, RefundSubscriptionPreConsume("test-group-2"))
			var refunded, settled UserSubscription
			require.NoError(t, db.First(&refunded, 4802).Error)
			require.NoError(t, db.First(&settled, 4803).Error)
			assert.Zero(t, refunded.AmountUsed)
			assert.EqualValues(t, 25, settled.AmountUsed, "refund cannot move settled charges between subscriptions")
			result, err = PreConsumeUserSubscription("test-group-3", 51, "same-model", "unlisted", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, 4804, result.UserSubscriptionId, "legacy unrestricted plan")
			assert.Empty(t, result.ApplicableGroup)
			_, err = GetSubscriptionPlanById(4701) // warm the public plan cache before the edit
			require.NoError(t, err)
			require.NoError(t, db.Model(&SubscriptionPlan{}).Where("id = ?", 4701).Updates(map[string]any{"applicable_group": "deepflash", "enabled": false}).Error)
			result, err = PreConsumeUserSubscription("test-group-4", 51, "same-model", "unlisted", 0, 20)
			require.ErrorIs(t, err, ErrNoApplicableSubscription)
			assert.Nil(t, result)
			_, err = PreConsumeUserSubscription("test-group-1", 51, "same-model", "unlisted", 0, 20)
			require.Error(t, err, "an idempotency replay cannot switch its original billing group")
			_, err = PreConsumeUserSubscription("test-group-1", 52, "same-model", "deepflash", 0, 20)
			require.Error(t, err, "another user cannot reuse an existing subscription reservation")
			_, err = PreConsumeUserSubscription("legacy-scope", 51, "same-model", "unlisted", 0, 20)
			require.Error(t, err, "old records cannot replay after their plan becomes restricted")
			replayed, err := PreConsumeUserSubscription("test-group-1", 51, "same-model", "deepflash", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, 4803, replayed.UserSubscriptionId, "same request retains its original funding source")
			require.NoError(t, db.Model(&SubscriptionPlan{}).Where("id = ?", 4704).Update("applicable_group", "other").Error)
			replayed, err = PreConsumeUserSubscription("test-group-1", 51, "same-model", "deepflash", 0, 20)
			require.NoError(t, err)
			assert.Equal(t, "deepflash", replayed.ApplicableGroup, "plan edits must not change the original reservation scope")
			// Existing subscriptions use the new plan scope immediately, with no snapshot rewrite.
			summaries, err := GetAllActiveUserSubscriptions(51)
			require.NoError(t, err)
			for _, summary := range summaries {
				if summary.Subscription.PlanId == 4701 {
					assert.Equal(t, "deepflash", summary.ApplicableGroup)
				}
			}
			_, err = PreConsumeUserSubscription("test-group-5", 51, "same-model", "auto", 0, 20)
			require.Error(t, err)
			_, err = PreConsumeUserSubscription("test-group-6", 51, "same-model", "other", 0, 200)
			var insufficient *SubscriptionQuotaError
			require.True(t, errors.As(err, &insufficient))
			assert.False(t, insufficient.AllowWalletOverflow)

			if dialect.name != "sqlite" {
				// Two reservations of one server-generated request ID must never
				// charge twice, including MySQL with clientFoundRows enabled.
				require.NoError(t, db.Create(&SubscriptionPlan{Id: 4705, Title: "concurrent", ApplicableGroup: "parallel", DurationUnit: "month", DurationValue: 1}).Error)
				require.NoError(t, db.Create(&UserSubscription{Id: 4805, UserId: 51, PlanId: 4705, Status: "active", StartTime: now - 1, EndTime: now + 5000, AmountTotal: 100}).Error)
				start := make(chan struct{})
				results := make(chan error, 2)
				var wg sync.WaitGroup
				for range 2 {
					wg.Go(func() {
						<-start
						_, reserveErr := PreConsumeUserSubscription("concurrent-group", 51, "same-model", "parallel", 0, 20)
						results <- reserveErr
					})
				}
				close(start)
				wg.Wait()
				close(results)
				for reserveErr := range results {
					require.NoError(t, reserveErr)
				}
				var parallel UserSubscription
				require.NoError(t, db.First(&parallel, 4805).Error)
				assert.EqualValues(t, 20, parallel.AmountUsed)
				var records int64
				require.NoError(t, db.Model(&SubscriptionPreConsumeRecord{}).Where("request_id = ?", "concurrent-group").Count(&records).Error)
				assert.EqualValues(t, 1, records)
			}
			require.NoError(t, db.Migrator().DropTable(&SubscriptionPreConsumeRecord{}, &UserSubscription{}, &SubscriptionPlan{}))
		})
	}
}
