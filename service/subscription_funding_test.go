package service

import (
	"errors"
	"fmt"
	"math"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestSubscriptionSettlementFundingMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector = sqlite.Open(":memory:")
			if dialect != "sqlite" {
				dsn := os.Getenv("TEST_SUBSCRIPTION_" + map[string]string{"mysql": "MYSQL", "postgres": "POSTGRES"}[dialect] + "_DSN")
				if dsn == "" {
					t.Skip("isolated database DSN is not configured")
				}
				if dialect == "mysql" {
					driver = mysql.Open(dsn)
				} else {
					driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
				}
			}
			db, err := gorm.Open(driver, &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB, oldLogDB, oldRedis, oldBatch := model.DB, model.LOG_DB, common.RedisEnabled, common.BatchUpdateEnabled
			oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
			model.DB, model.LOG_DB = db, db
			common.RedisEnabled, common.BatchUpdateEnabled = false, false
			common.SetDatabaseTypes(common.DatabaseType(dialect), common.DatabaseType(dialect))
			t.Cleanup(func() {
				model.DB, model.LOG_DB, common.RedisEnabled, common.BatchUpdateEnabled = oldDB, oldLogDB, oldRedis, oldBatch
				common.SetDatabaseTypes(oldMain, oldLog)
				require.NoError(t, sqlDB.Close())
			})
			for range 2 {
				require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Task{}, &model.Log{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}))
			}
			var version string
			query := "select version()"
			if dialect == "sqlite" {
				query = "select sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database: %s", version)
			t.Run("released schema upgrade", func(t *testing.T) {
				// This fixture matches v1.0.0-rc.47, the latest local release tag.
				upgrade := db.Table("ticket05_upgrade_records")
				require.NoError(t, db.Migrator().DropTable("ticket05_upgrade_records"))
				require.NoError(t, upgrade.AutoMigrate(&subscriptionFundingReleasedRecord{}))
				old := subscriptionFundingReleasedRecord{RequestId: "released-consumed", UserId: 21, UserSubscriptionId: 31, PreConsumed: 50, Status: "consumed", CreatedAt: 1700000000, UpdatedAt: 1700000001}
				require.NoError(t, db.Table("ticket05_upgrade_records").Create(&old).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Table("ticket05_upgrade_records").Where("request_id = ?", old.RequestId).Delete(&subscriptionFundingReleasedRecord{}).Error)
				})
				for range 2 {
					require.NoError(t, db.Table("ticket05_upgrade_records").AutoMigrate(&model.SubscriptionPreConsumeRecord{}))
				}
				var upgraded model.SubscriptionPreConsumeRecord
				require.NoError(t, db.Table("ticket05_upgrade_records").First(&upgraded, old.Id).Error)
				assert.Equal(t, old.RequestId, upgraded.RequestId)
				assert.Equal(t, old.PreConsumed, upgraded.PreConsumed)
				assert.Equal(t, old.Status, upgraded.Status)
				assert.Equal(t, old.CreatedAt, upgraded.CreatedAt)
				assert.Equal(t, old.UpdatedAt, upgraded.UpdatedAt)
				assert.Zero(t, upgraded.PlanVersionId)
				assert.Zero(t, upgraded.SettlementAmount)
				assert.Zero(t, upgraded.WalletSettledAmount)
				duplicate := model.SubscriptionPreConsumeRecord{RequestId: old.RequestId}
				// Savepoints keep PostgreSQL usable after the expected unique violation.
				err := db.Transaction(func(tx *gorm.DB) error { return tx.Table("ticket05_upgrade_records").Create(&duplicate).Error })
				require.Error(t, err)
			})
			runSubscriptionSettlementFundingCases(t, db)
		})
	}
}

func TestSubscriptionLifecycleConcurrencyMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			dsn := ""
			switch dialect {
			case "sqlite":
				dsn = filepath.Join(t.TempDir(), "subscription-concurrency.db")
				driver = sqlite.Open(dsn)
			case "mysql":
				dsn = os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_SUBSCRIPTION_MYSQL_DSN is not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn = os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_SUBSCRIPTION_POSTGRES_DSN is not configured")
				}
				driver = postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true})
			}

			prefix := fmt.Sprintf("ticket03_%s_%d_", dialect, model.GetDBTimestamp())
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: prefix}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			maxOpenConns := 12
			if dialect == "sqlite" {
				maxOpenConns = 1
			}
			sqlDB.SetMaxOpenConns(maxOpenConns)
			oldDB, oldLogDB, oldRedis, oldBatch := model.DB, model.LOG_DB, common.RedisEnabled, common.BatchUpdateEnabled
			oldMain, oldLog := common.MainDatabaseType(), common.LogDatabaseType()
			model.DB, model.LOG_DB = db, db
			common.RedisEnabled, common.BatchUpdateEnabled = false, false
			common.SetDatabaseTypes(common.DatabaseType(dialect), common.DatabaseType(dialect))
			t.Cleanup(func() {
				model.DB, model.LOG_DB, common.RedisEnabled, common.BatchUpdateEnabled = oldDB, oldLogDB, oldRedis, oldBatch
				common.SetDatabaseTypes(oldMain, oldLog)
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}, &model.SubscriptionQuotaOperation{}))
			var version string
			versionQuery := "SELECT VERSION()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)

			t.Run("concurrent admission respects window and total balances", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "concurrent", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 1, PlanId: plan.Id, AmountTotal: 100, TotalAmountUsed: 0,
					WindowAmount: 60, QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					StartTime: now, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				start := make(chan struct{})
				var wait sync.WaitGroup
				results := make(chan error, 8)
				for i := range 8 {
					wait.Go(func() {
						<-start
						_, err := model.PreConsumeUserSubscription(fmt.Sprintf("ticket03-%s-%d", dialect, i), sub.UserId, "", 0, 20)
						results <- err
					})
				}
				close(start)
				wait.Wait()
				close(results)
				successes := 0
				for err := range results {
					if err == nil {
						successes++
					}
				}
				assert.Equal(t, 3, successes)
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, successes*20, updated.AmountReserved)
				assert.LessOrEqual(t, updated.TotalAmountUsed+updated.AmountReserved, updated.AmountTotal)
				var reserved int64
				require.NoError(t, db.Model(&model.SubscriptionPreConsumeRecord{}).
					Where("user_subscription_id = ? AND status = ?", sub.Id, "reserved").
					Select("COALESCE(SUM(pre_consumed), 0)").Scan(&reserved).Error)
				assert.Equal(t, updated.AmountReserved, reserved)
			})

			t.Run("concurrent admission respects total balance independently of window", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "total bound", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 5, PlanId: plan.Id, AmountTotal: 60, WindowAmount: 100,
					QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					StartTime: now, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				start := make(chan struct{})
				var wait sync.WaitGroup
				results := make(chan error, 4)
				for i := range 4 {
					wait.Go(func() {
						<-start
						_, err := model.PreConsumeUserSubscription(fmt.Sprintf("ticket03-total-%s-%d", dialect, i), sub.UserId, "", 0, 20)
						results <- err
					})
				}
				close(start)
				wait.Wait()
				close(results)
				successes := 0
				for err := range results {
					if err == nil {
						successes++
					}
				}
				assert.Equal(t, 3, successes)
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 60, updated.AmountReserved)
				assert.LessOrEqual(t, updated.TotalAmountUsed+updated.AmountReserved, updated.AmountTotal)
			})

			t.Run("concurrent retries reserve a request once", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "retry", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 3, PlanId: plan.Id, AmountTotal: 100, WindowAmount: 60,
					QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					StartTime: now, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				start := make(chan struct{})
				var wait sync.WaitGroup
				results := make(chan error, 4)
				for range 4 {
					wait.Go(func() {
						<-start
						_, err := model.PreConsumeUserSubscription("ticket03-retry-"+dialect, sub.UserId, "", 0, 20)
						results <- err
					})
				}
				close(start)
				wait.Wait()
				close(results)
				for err := range results {
					require.NoError(t, err)
				}
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 20, updated.AmountReserved)
				var records int64
				require.NoError(t, db.Model(&model.SubscriptionPreConsumeRecord{}).
					Where("request_id = ?", "ticket03-retry-"+dialect).Count(&records).Error)
				assert.EqualValues(t, 1, records)
			})

			t.Run("concurrent admin restore preserves in-flight settlement", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "admin restore", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 4, PlanId: plan.Id, AmountTotal: 200, TotalAmountUsed: 50,
					WindowAmount: 100, WindowAmountUsed: 50, AmountReserved: 40,
					QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					ResetGeneration: 1, StartTime: now - 60, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				requestId := "ticket03-restore-inflight-" + dialect
				require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
					RequestId: requestId, UserId: sub.UserId, UserSubscriptionId: sub.Id,
					PreConsumed: 40, ResetGeneration: 1, Status: "reserved",
				}).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				start := make(chan struct{})
				var wait sync.WaitGroup
				results := make(chan *model.SubscriptionQuotaRestoreResult, 2)
				errorsFound := make(chan error, 2)
				for range 2 {
					wait.Go(func() {
						<-start
						result, err := model.AdminRestoreUserSubscriptionQuota(sub.UserId, sub.Id,
							model.SubscriptionQuotaActionRestoreWindow, "ticket03-admin-restore-"+dialect, 501, "concurrency regression")
						results <- result
						errorsFound <- err
					})
				}
				close(start)
				wait.Wait()
				close(results)
				close(errorsFound)
				var first *model.SubscriptionQuotaRestoreResult
				for err := range errorsFound {
					require.NoError(t, err)
				}
				for result := range results {
					require.NotNil(t, result)
					if first == nil {
						first = result
						continue
					}
					assert.Equal(t, first.ReturnedQuota, result.ReturnedQuota)
				}
				assert.EqualValues(t, 50, first.ReturnedQuota)
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 0, updated.TotalAmountUsed)
				assert.EqualValues(t, 40, updated.AmountReserved)
				assert.Zero(t, updated.WindowAmountUsed)

				settlement, err := model.SettleUserSubscriptionFunding(requestId, 20)
				require.NoError(t, err)
				assert.EqualValues(t, 60, settlement.SubscriptionAmount)
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 60, updated.TotalAmountUsed)
				assert.Zero(t, updated.WindowAmountUsed, "pre-restore requests must not consume the restored window")
				assert.Zero(t, updated.AmountReserved)
			})

			t.Run("settlement and refund stay in the originating generation", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "generation", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 2, PlanId: plan.Id, AmountTotal: 200, TotalAmountUsed: 20,
					WindowAmount: 100, WindowAmountUsed: 10, AmountReserved: 50,
					QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					ResetGeneration: 2, StartTime: now - 3600, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				oldRequest := fmt.Sprintf("ticket03-old-%s", dialect)
				newRequest := fmt.Sprintf("ticket03-new-%s", dialect)
				require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
					RequestId: oldRequest, UserId: sub.UserId, UserSubscriptionId: sub.Id,
					PreConsumed: 30, ResetGeneration: 1, Status: "reserved",
				}).Error)
				require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
					RequestId: newRequest, UserId: sub.UserId, UserSubscriptionId: sub.Id,
					PreConsumed: 20, ResetGeneration: 2, Status: "reserved",
				}).Error)
				oldRefund := fmt.Sprintf("ticket03-old-refund-%s", dialect)
				require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
					RequestId: oldRefund, UserId: sub.UserId, UserSubscriptionId: sub.Id,
					PreConsumed: 10, ResetGeneration: 1, Status: "reserved",
				}).Error)
				sub.AmountReserved += 10
				require.NoError(t, db.Save(&sub).Error)
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				result, err := model.SettleUserSubscriptionFunding(oldRequest, 10)
				require.NoError(t, err)
				assert.EqualValues(t, 40, result.SubscriptionAmount)
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 60, updated.TotalAmountUsed)
				assert.EqualValues(t, 10, updated.WindowAmountUsed, "an old-window charge must not affect the current window")
				assert.EqualValues(t, 30, updated.AmountReserved, "settling one request must retain other request reservations")
				require.NoError(t, model.RefundSubscriptionPreConsume(oldRefund))
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 20, updated.AmountReserved, "refunding an old-window request must retain the current-window reservation")
				assert.EqualValues(t, 10, updated.WindowAmountUsed, "refunding an old-window request must not change current-window usage")
				require.NoError(t, model.RefundSubscriptionPreConsume(newRequest))
				require.NoError(t, model.RefundSubscriptionPreConsume(newRequest))
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 0, updated.AmountReserved)
				assert.EqualValues(t, 10, updated.WindowAmountUsed)
			})

			t.Run("concurrent settlements preserve total accounting", func(t *testing.T) {
				plan := model.SubscriptionPlan{Title: "settlement concurrency", QuotaResetPeriod: model.SubscriptionResetDaily}
				require.NoError(t, db.Create(&plan).Error)
				now := model.GetDBTimestamp()
				sub := model.UserSubscription{
					UserId: 6, PlanId: plan.Id, AmountTotal: 100, TotalAmountUsed: 40,
					WindowAmount: 100, WindowAmountUsed: 40, AmountReserved: 60,
					QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily,
					ResetGeneration: 1, StartTime: now - 60, EndTime: now + 86400, Status: "active",
				}
				require.NoError(t, db.Create(&sub).Error)
				for _, requestId := range []string{"a", "b"} {
					require.NoError(t, db.Create(&model.SubscriptionPreConsumeRecord{
						RequestId: "ticket03-settle-" + dialect + "-" + requestId,
						UserId:    sub.UserId, UserSubscriptionId: sub.Id, PreConsumed: 30,
						ResetGeneration: 1, Status: "reserved",
					}).Error)
				}
				t.Cleanup(func() {
					require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
					require.NoError(t, db.Delete(&sub).Error)
					require.NoError(t, db.Delete(&plan).Error)
				})

				start := make(chan struct{})
				var wait sync.WaitGroup
				results := make(chan error, 2)
				for _, requestId := range []string{"a", "b"} {
					requestId := "ticket03-settle-" + dialect + "-" + requestId
					wait.Go(func() {
						<-start
						_, err := model.SettleUserSubscriptionFunding(requestId, 0)
						results <- err
					})
				}
				close(start)
				wait.Wait()
				close(results)
				for err := range results {
					require.NoError(t, err)
				}
				var updated model.UserSubscription
				require.NoError(t, db.First(&updated, sub.Id).Error)
				assert.EqualValues(t, 100, updated.TotalAmountUsed)
				assert.EqualValues(t, 100, updated.WindowAmountUsed)
				assert.Zero(t, updated.AmountReserved)
				assert.LessOrEqual(t, updated.TotalAmountUsed+updated.AmountReserved, updated.AmountTotal)
			})
		})
	}
}

type subscriptionFundingReleasedRecord struct {
	Id                 int
	RequestId          string `gorm:"type:varchar(64);uniqueIndex"`
	UserId             int    `gorm:"index"`
	UserSubscriptionId int    `gorm:"index"`
	PreConsumed        int64  `gorm:"type:bigint;not null;default:0"`
	Status             string `gorm:"type:varchar(32);index"`
	CreatedAt          int64  `gorm:"bigint"`
	UpdatedAt          int64  `gorm:"bigint;index"`
}

func runSubscriptionSettlementFundingCases(t *testing.T, db *gorm.DB) {
	t.Helper()
	t.Run("async completion splits the additional charge and retries", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, session.Settle(10))
		task := model.Task{TaskID: info.RequestId, UserId: info.UserId, Quota: 10, PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceSubscription, SubscriptionId: sub.Id,
			Execution: &model.TaskExecutionSnapshot{RequestID: info.RequestId},
		}}
		require.NoError(t, db.Create(&task).Error)
		t.Cleanup(func() {
			require.NoError(t, db.Delete(&task).Error)
			require.NoError(t, db.Where("user_id = ?", info.UserId).Delete(&model.Log{}).Error)
		})
		failWallet := true
		callback := "ticket05_async_wallet_failure"
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
			if record, ok := tx.Statement.Dest.(*model.SubscriptionPreConsumeRecord); ok && record.WalletSettledAmount > 0 && failWallet {
				tx.AddError(errors.New("async wallet marker write failed"))
			}
		}))
		t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove(callback)) })
		RecalculateTaskQuota(ctx, &task, 90, common.NewMessage("async completion"))
		assert.Equal(t, 60, task.Quota)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 200, wallet)
		failWallet = false
		// Reload the persisted task to exercise a retry independent of memory.
		require.NoError(t, db.First(&task, task.ID).Error)
		RecalculateTaskQuota(ctx, &task, 90, common.NewMessage("async retry"))
		RecalculateTaskQuota(ctx, &task, 90, common.NewMessage("async duplicate"))
		wallet, err = model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 170, wallet)
		assert.Equal(t, 90, task.Quota)
		require.NoError(t, db.First(&sub, sub.Id).Error)
		assert.EqualValues(t, 400, sub.TotalAmountUsed)
		assert.EqualValues(t, 100, sub.WindowAmountUsed)
		var logs []model.Log
		require.NoError(t, db.Where("user_id = ?", info.UserId).Order("id").Find(&logs).Error)
		require.Len(t, logs, 2)
		var other map[string]any
		require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
		assert.EqualValues(t, 50, other["subscription_consumed"])
		assert.EqualValues(t, 0, other["wallet_quota_deducted"])
		assert.EqualValues(t, 30, other["unfunded_quota"])
		require.NoError(t, common.UnmarshalJsonStr(logs[1].Other, &other))
		assert.EqualValues(t, 0, other["subscription_consumed"])
		assert.EqualValues(t, 30, other["wallet_quota_deducted"])
	})
	t.Run("wallet underflow retains subscription without crediting the wallet", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, db.Model(&model.User{}).Where("id = ?", info.UserId).Update("quota", int64(math.MinInt64+10)).Error)
		require.Error(t, session.Settle(90))
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.EqualValues(t, math.MinInt64+10, wallet)
		require.NoError(t, db.First(&sub, sub.Id).Error)
		assert.EqualValues(t, 400, sub.TotalAmountUsed)
		assert.EqualValues(t, 30, info.SubscriptionUnfunded)
	})
	for _, tc := range []struct {
		name                                            string
		total, used, window, windowUsed                 int64
		pre, actual                                     int
		pref                                            string
		overflow                                        bool
		wantTotal, wantWindow, wantWallet, wantUnfunded int64
	}{
		{"within shared allowance", 400, 40, 100, 20, 10, 30, "subscription_first", true, 70, 50, 200, 0},
		{"worked example with window then total then wallet", 400, 350, 100, 70, 0, 80, "subscription_first", true, 400, 100, 170, 0},
		{"total fallback without wallet", 400, 200, 100, 80, 10, 70, "subscription_only", false, 270, 100, 200, 0},
		{"overflow disabled retains subscription charge", 400, 340, 100, 60, 10, 90, "subscription_first", false, 400, 100, 200, 30},
		{"subscription only ignores wallet flag", 400, 340, 100, 60, 10, 90, "subscription_only", true, 400, 100, 200, 30},
		{"exact reservation publishes final usage", 400, 40, 100, 20, 10, 10, "subscription_first", false, 50, 30, 200, 0},
		{"zero actual releases reservation", 400, 40, 100, 20, 10, 0, "subscription_first", false, 40, 20, 200, 0},
		{"zero estimate settles zero actual", 400, 40, 100, 20, 0, 0, "subscription_first", false, 40, 20, 200, 0},
		{"unlimited ignores window", 0, 40, 100, 90, 10, 200, "subscription_first", false, 240, 90, 200, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx, info, sub := subscriptionFundingFixture(t, db, tc.total, tc.used, tc.window, tc.windowUsed, tc.overflow)
			info.UserSetting.BillingPreference = tc.pref
			session, apiErr := NewBillingSession(ctx, info, tc.pre)
			require.Nil(t, apiErr)
			err := session.Settle(tc.actual)
			if tc.wantUnfunded > 0 {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			assert.False(t, session.NeedsRefund())
			session.Refund(ctx)
			if tc.wantUnfunded > 0 {
				require.Error(t, session.Settle(tc.actual))
			} else {
				require.NoError(t, session.Settle(tc.actual))
			}
			subs, err := model.GetAllUserSubscriptions(info.UserId)
			require.NoError(t, err)
			require.Len(t, subs, 1)
			assert.Equal(t, tc.wantTotal, subs[0].Subscription.TotalAmountUsed)
			assert.Equal(t, tc.wantTotal, subs[0].Subscription.HistoricalAmountUsed)
			assert.Equal(t, tc.wantWindow, subs[0].Subscription.WindowAmountUsed)
			assert.Zero(t, subs[0].Subscription.AmountReserved)
			wallet, err := model.GetUserQuota(info.UserId, true)
			require.NoError(t, err)
			assert.EqualValues(t, tc.wantWallet, wallet)
			assert.Equal(t, tc.wantUnfunded, info.SubscriptionUnfunded)
			assert.Equal(t, tc.wantTotal-tc.used, info.SubscriptionPreConsumed+info.SubscriptionPostDelta)
			assert.Equal(t, sub.Id, info.SubscriptionId)
		})
	}
	t.Run("wallet transaction failure retains subscription and retries once", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		// Fail the wallet marker write after its debit, so the wallet transaction
		// must roll back while the earlier subscription transaction stays committed.
		failWallet := true
		callback := "ticket05_wallet_failure"
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
			if record, ok := tx.Statement.Dest.(*model.SubscriptionPreConsumeRecord); ok && record.WalletSettledAmount > 0 && failWallet {
				tx.AddError(errors.New("wallet marker write failed"))
			}
		}))
		t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove(callback)) })
		require.ErrorContains(t, session.Settle(90), "wallet marker write failed")
		assert.False(t, session.NeedsRefund())
		session.Refund(ctx)
		subs, err := model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 400, subs[0].Subscription.TotalAmountUsed)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 200, wallet)
		other := model.NewLogOther()
		appendBillingInfo(info, other)
		assert.EqualValues(t, 60, other.Snapshot()["subscription_consumed"])
		assert.EqualValues(t, 30, other.Snapshot()["unfunded_quota"])
		assert.EqualValues(t, 0, other.Snapshot()["wallet_quota_deducted"])
		failWallet = false
		require.NoError(t, session.Settle(90))
		// Recover the split from the durable record, independent of this session.
		result, err := model.SettleUserSubscriptionFunding(info.RequestId, 80)
		require.NoError(t, err)
		assert.EqualValues(t, 60, result.SubscriptionAmount)
		assert.EqualValues(t, 30, result.WalletAmount)
		assert.Zero(t, result.UnfundedAmount)
		_, err = model.SettleUserSubscriptionFunding(info.RequestId, 81)
		require.Error(t, err)
		charged, err := model.SettleSubscriptionWalletOverflow(info.RequestId)
		require.NoError(t, err)
		assert.EqualValues(t, 30, charged)
		wallet, err = model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 170, wallet)
		require.NoError(t, db.First(&sub, sub.Id).Error)
		assert.EqualValues(t, 400, sub.HistoricalAmountUsed)
	})
	t.Run("other requests retain their reservation", func(t *testing.T) {
		ctx, info, _ := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		_, err := model.PreConsumeUserSubscription(info.RequestId+"-other", info.UserId, "", 0, 20)
		require.NoError(t, err)
		require.NoError(t, session.Settle(90))
		subs, err := model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 380, subs[0].Subscription.TotalAmountUsed)
		assert.EqualValues(t, 80, subs[0].Subscription.WindowAmountUsed)
		assert.EqualValues(t, 20, subs[0].Subscription.AmountReserved)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 150, wallet)
		require.NoError(t, model.SettleUserSubscriptionPreConsume(info.RequestId+"-other", 0))
		subs, err = model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 400, subs[0].Subscription.TotalAmountUsed)
		assert.EqualValues(t, 100, subs[0].Subscription.WindowAmountUsed)
		assert.Zero(t, subs[0].Subscription.AmountReserved)
	})
	t.Run("old generation does not charge the new window", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, db.Model(&sub).Updates(map[string]any{"reset_generation": 1, "window_amount_used": 0}).Error)
		require.NoError(t, session.Settle(90))
		subs, err := model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 400, subs[0].Subscription.TotalAmountUsed)
		assert.Zero(t, subs[0].Subscription.WindowAmountUsed)
	})
	t.Run("invalid actual charges leave reservation refundable", func(t *testing.T) {
		ctx, info, _ := subscriptionFundingFixture(t, db, 400, 40, 100, 20, false)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.Error(t, session.Settle(-1))
		_, err := model.SettleUserSubscriptionFunding(info.RequestId, math.MaxInt64)
		require.Error(t, err)
		assert.True(t, session.NeedsRefund())
		require.NoError(t, session.Settle(0))
	})
	t.Run("wallet first fallback retains wallet debit semantics", func(t *testing.T) {
		ctx, info, _ := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		info.UserSetting.BillingPreference = "wallet_first"
		require.NoError(t, db.Model(&model.User{}).Where("id = ?", info.UserId).Update("quota", 5).Error)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		assert.Equal(t, BillingSourceSubscription, info.BillingSource)
		require.NoError(t, session.Settle(90))
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, -25, wallet)
		assert.EqualValues(t, 30, info.SubscriptionWalletConsumed)
	})
	t.Run("no reset uses total allowance", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 0, 0, true)
		require.NoError(t, db.Model(&sub).Updates(map[string]any{"quota_reset_period": model.SubscriptionResetNever, "next_reset_time": 0}).Error)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, session.Settle(90))
		subs, err := model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 400, subs[0].Subscription.TotalAmountUsed)
		assert.Zero(t, subs[0].Subscription.WindowAmountUsed)
		assert.EqualValues(t, 30, info.SubscriptionWalletConsumed)
	})
	t.Run("legacy subscription excess remains an atomic error", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		require.NoError(t, db.Model(&sub).Update("quota_model_version", 0).Error)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.Error(t, session.Settle(90))
		assert.True(t, session.NeedsRefund())
		subs, err := model.GetAllUserSubscriptions(info.UserId)
		require.NoError(t, err)
		assert.EqualValues(t, 350, subs[0].Subscription.AmountUsed)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 200, wallet)
		require.NoError(t, session.Settle(10))
	})
	t.Run("legacy async completion charges the extra usage exactly once", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		require.NoError(t, db.Model(&sub).Update("quota_model_version", 0).Error)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, session.Settle(10))
		task := model.Task{TaskID: info.RequestId, UserId: info.UserId, Quota: 10, PrivateData: model.TaskPrivateData{
			BillingSource: BillingSourceSubscription, SubscriptionId: sub.Id,
			Execution: &model.TaskExecutionSnapshot{RequestID: info.RequestId},
		}}
		require.NoError(t, db.Create(&task).Error)
		t.Cleanup(func() {
			require.NoError(t, db.Delete(&task).Error)
			require.NoError(t, db.Where("user_id = ?", info.UserId).Delete(&model.Log{}).Error)
		})
		RecalculateTaskQuota(ctx, &task, 30, common.NewMessage("legacy completion"))
		RecalculateTaskQuota(ctx, &task, 30, common.NewMessage("legacy completion retry"))
		assert.Equal(t, 30, task.Quota)
		require.NoError(t, db.First(&sub, sub.Id).Error)
		assert.EqualValues(t, 370, sub.AmountUsed)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 200, wallet)
	})
	t.Run("token failure does not refund or duplicate committed funding", func(t *testing.T) {
		ctx, info, _ := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		token := model.Token{UserId: info.UserId, Key: fmt.Sprintf("funding-token-%d", info.UserId), RemainQuota: 200}
		require.NoError(t, db.Create(&token).Error)
		t.Cleanup(func() { require.NoError(t, db.Unscoped().Delete(&token).Error) })
		info.IsPlayground, info.TokenId, info.TokenKey = false, token.Id, token.Key
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		callback := "ticket05_token_failure"
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
			if tx.Statement.Schema != nil && tx.Statement.Schema.Table == "tokens" {
				tx.AddError(errors.New("token adjustment failed"))
			}
		}))
		t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove(callback)) })
		require.ErrorContains(t, session.Settle(90), "token adjustment failed")
		assert.False(t, session.NeedsRefund())
		session.Refund(ctx)
		require.NoError(t, session.Settle(90))
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 170, wallet)
		assert.EqualValues(t, 60, info.SubscriptionPreConsumed+info.SubscriptionPostDelta)
		assert.EqualValues(t, 30, info.SubscriptionWalletConsumed)
	})
	t.Run("shared window then total then wallet", func(t *testing.T) {
		ctx, info, sub := subscriptionFundingFixture(t, db, 400, 340, 100, 60, true)
		session, apiErr := NewBillingSession(ctx, info, 10)
		require.Nil(t, apiErr)
		require.NoError(t, session.Settle(90))
		require.NoError(t, session.Settle(90))
		require.NoError(t, db.First(&sub, sub.Id).Error)
		assert.EqualValues(t, 400, sub.TotalAmountUsed)
		assert.EqualValues(t, 100, sub.WindowAmountUsed)
		assert.EqualValues(t, 400, sub.HistoricalAmountUsed)
		assert.Zero(t, sub.AmountReserved)
		wallet, err := model.GetUserQuota(info.UserId, true)
		require.NoError(t, err)
		assert.Equal(t, 170, wallet)
		other := model.NewLogOther()
		appendBillingInfo(info, other)
		assert.EqualValues(t, 60, other.Snapshot()["subscription_consumed"])
		assert.EqualValues(t, 30, other.Snapshot()["wallet_quota_deducted"])
	})
}

// subscriptionFundingFixture creates a real admitted-request billing environment.
func subscriptionFundingFixture(t *testing.T, db *gorm.DB, total, used, window, windowUsed int64, overflow bool) (*gin.Context, *relaycommon.RelayInfo, model.UserSubscription) {
	t.Helper()
	user := model.User{Username: fmt.Sprintf("funding-%d", model.GetDBTimestamp()), Quota: 200}
	require.NoError(t, db.Create(&user).Error)
	plan := model.SubscriptionPlan{Title: "funding", QuotaResetPeriod: model.SubscriptionResetDaily}
	require.NoError(t, db.Create(&plan).Error)
	now := model.GetDBTimestamp()
	sub := model.UserSubscription{UserId: user.Id, PlanId: plan.Id, AmountTotal: total, AmountUsed: used, TotalAmountUsed: used, HistoricalAmountUsed: used, WindowAmount: window, WindowAmountUsed: windowUsed, QuotaModelVersion: 1, QuotaResetPeriod: model.SubscriptionResetDaily, AllowWalletOverflow: overflow, StartTime: now - 60, EndTime: now + 86400, LastResetTime: now - 60, NextResetTime: now + 3600, Status: "active"}
	require.NoError(t, db.Create(&sub).Error)
	requestID := fmt.Sprintf("funding-%d", sub.Id)
	t.Cleanup(func() {
		require.NoError(t, db.Where("user_subscription_id = ?", sub.Id).Delete(&model.SubscriptionPreConsumeRecord{}).Error)
		require.NoError(t, db.Delete(&sub).Error)
		require.NoError(t, db.Delete(&plan).Error)
		require.NoError(t, db.Unscoped().Delete(&user).Error)
	})
	info := &relaycommon.RelayInfo{UserId: user.Id, RequestId: requestID, IsPlayground: true, ForcePreConsume: true, UserSetting: dto.UserSetting{BillingPreference: "subscription_first"}}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	return ctx, info, sub
}
