package model

import (
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

func createPlanVersionTestUser(t *testing.T, username string) *User {
	t.Helper()
	user := &User{
		Username:    username,
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AffCode:     username,
		AuthVersion: 1,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func TestSubscriptionPurchaseRejectsStaleCachedEligibilityMatrix(t *testing.T) {
	runSubscriptionAccountingMatrix(t, func(t *testing.T) {
		for _, field := range []string{"enabled", "allow_balance_pay"} {
			t.Run(field, func(t *testing.T) {
				plan := createPlanVersionTestPlan(t, field)
				_, err := GetSubscriptionPlanById(plan.Id)
				require.NoError(t, err)
				require.NoError(t, DB.Model(plan).Update(field, false).Error)
				err = PurchaseSubscriptionWithBalance(1, plan.Id)
				require.Error(t, err)
				if field == "enabled" {
					assert.Contains(t, err.Error(), "not enabled")
				} else {
					assert.Contains(t, err.Error(), "does not allow balance")
				}
			})
		}
	})
}

func TestSubscriptionPurchaseRejectsChangedConfirmedTermsMatrix(t *testing.T) {
	runSubscriptionAccountingMatrix(t, func(t *testing.T) {
		plan := createPlanVersionTestPlan(t, "confirmed")
		version, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
		require.NoError(t, err)
		require.NoError(t, DB.Model(plan).Update("price_amount", 20).Error)
		err = PurchaseSubscriptionWithBalance(1, plan.Id, version.Id)
		require.ErrorContains(t, err, "Subscription plan has changed")
		_, err = GetOrCreateCurrentSubscriptionPlanVersion(plan.Id, version.Id)
		require.ErrorContains(t, err, "Subscription plan has changed")
		current, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
		require.NoError(t, err)
		confirmed, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id, current.Id)
		require.NoError(t, err)
		assert.Equal(t, current.Id, confirmed.Id)
	})
}

func TestSubscriptionLazyVersionConcurrentPurchasesMatrix(t *testing.T) {
	runSubscriptionAccountingMatrix(t, func(t *testing.T) {
		plan := createPlanVersionTestPlan(t, "concurrent legacy plan")
		start := make(chan struct{})
		versions := make(chan *SubscriptionPlanVersion, 2)
		errors := make(chan error, 2)
		var workers sync.WaitGroup
		for range 2 {
			workers.Go(func() {
				<-start
				version, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
				versions <- version
				errors <- err
			})
		}
		close(start)
		workers.Wait()
		for range 2 {
			require.NoError(t, <-errors)
		}
		first, second := <-versions, <-versions
		require.NotNil(t, first)
		require.NotNil(t, second)
		assert.Equal(t, first.Id, second.Id)
		var count int64
		require.NoError(t, DB.Model(&SubscriptionPlanVersion{}).Where("plan_id = ?", plan.Id).Count(&count).Error)
		assert.EqualValues(t, 1, count)
	})
}

func TestSubscriptionCurrentVersionReconcilesOldNodeEditsMatrix(t *testing.T) {
	runSubscriptionAccountingMatrix(t, func(t *testing.T) {
		plan := createPlanVersionTestPlan(t, "before old-node edit")
		first, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
		require.NoError(t, err)
		require.NoError(t, DB.Model(plan).Updates(map[string]any{"title": "after old-node edit", "price_amount": 0, "allow_balance_pay": false}).Error)
		second, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
		require.NoError(t, err)
		assert.Equal(t, first.Version+1, second.Version)
		terms, err := second.PlanTerms()
		require.NoError(t, err)
		assert.Equal(t, "after old-node edit", terms.Title)
		assert.Zero(t, terms.PriceAmount)
		require.NotNil(t, terms.AllowBalancePay)
		assert.False(t, *terms.AllowBalancePay)
		third, err := GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
		require.NoError(t, err)
		assert.Equal(t, second.Id, third.Id)
		old, err := GetSubscriptionPlanVersionById(first.Id)
		require.NoError(t, err)
		oldTerms, err := old.PlanTerms()
		require.NoError(t, err)
		assert.Equal(t, "before old-node edit", oldTerms.Title)
	})
}

func createPlanVersionTestPlan(t *testing.T, title string) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Title:             title,
		PriceAmount:       10,
		Currency:          "USD",
		DurationUnit:      SubscriptionDurationMonth,
		DurationValue:     1,
		Enabled:           true,
		TotalAmount:       100,
		QuotaModelVersion: 1,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

type legacySubscriptionPlan struct {
	Id                int    `gorm:"primaryKey"`
	Title             string `gorm:"type:varchar(255)"`
	DurationUnit      string `gorm:"type:varchar(16)"`
	DurationValue     int
	Enabled           bool
	TotalAmount       int64 `gorm:"type:bigint"`
	QuotaModelVersion int
	CreatedAt         int64 `gorm:"bigint"`
	UpdatedAt         int64 `gorm:"bigint"`
}

func (legacySubscriptionPlan) TableName() string { return "subscription_plans" }

type legacySubscriptionOrder struct {
	Id            int `gorm:"primaryKey"`
	UserId        int `gorm:"index"`
	PlanId        int `gorm:"index"`
	Money         float64
	TradeNo       string `gorm:"unique;type:varchar(255);index"`
	PaymentMethod string `gorm:"type:varchar(50)"`
	Status        string
	CreateTime    int64
	CompleteTime  int64
}

func (legacySubscriptionOrder) TableName() string { return "subscription_orders" }

type legacyUserSubscription struct {
	Id          int   `gorm:"primaryKey"`
	UserId      int   `gorm:"index"`
	PlanId      int   `gorm:"index"`
	AmountTotal int64 `gorm:"type:bigint"`
	AmountUsed  int64 `gorm:"type:bigint"`
	StartTime   int64
	EndTime     int64
	Status      string `gorm:"type:varchar(32)"`
}

func (legacyUserSubscription) TableName() string { return "user_subscriptions" }

func TestSubscriptionPlanVersionPreservesPurchaseTerms(t *testing.T) {
	truncateTables(t)
	plan := createPlanVersionTestPlan(t, "starter-v1")
	version1, err := CreateSubscriptionPlanVersionTx(DB, plan)
	require.NoError(t, err)

	plan.Title = "starter-v2"
	plan.TotalAmount = 200
	require.NoError(t, DB.Save(plan).Error)
	version2, err := CreateSubscriptionPlanVersionTx(DB, plan)
	require.NoError(t, err)
	require.NotEqual(t, version1.Id, version2.Id)
	require.Equal(t, version1.Version+1, version2.Version)

	oldTerms, err := version1.PlanTerms()
	require.NoError(t, err)
	assert.Equal(t, "starter-v1", oldTerms.Title)
	assert.EqualValues(t, 100, oldTerms.TotalAmount)
	newTerms, err := version2.PlanTerms()
	require.NoError(t, err)
	assert.Equal(t, "starter-v2", newTerms.Title)
	assert.EqualValues(t, 200, newTerms.TotalAmount)

	assert.Error(t, DB.Save(version1).Error)
	assert.Error(t, DB.Delete(version1).Error)
}

func TestEnsureSubscriptionPlanVersionsBackfillsLegacyPlansIdempotently(t *testing.T) {
	truncateTables(t)
	plan := createPlanVersionTestPlan(t, "legacy-plan")

	require.NoError(t, ensureSubscriptionPlanVersions(DB))
	require.NoError(t, ensureSubscriptionPlanVersions(DB))

	var versions []SubscriptionPlanVersion
	require.NoError(t, DB.Where("plan_id = ?", plan.Id).Find(&versions).Error)
	require.Len(t, versions, 1)
	terms, err := versions[0].PlanTerms()
	require.NoError(t, err)
	assert.Equal(t, plan.Title, terms.Title)
}

func TestSubscriptionPlanVersionMigrationMatrix(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{name: "sqlite", dsn: ":memory:", open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{name: "mysql", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")), open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")), open: func(dsn string) gorm.Dialector { return postgres.Open(dsn) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.dsn == "" {
				t.Skipf("TEST_SUBSCRIPTION_%s_DSN is not configured", strings.ToUpper(tc.name))
			}
			db, err := gorm.Open(tc.open(tc.dsn), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { _ = sqlDB.Close() })
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&SubscriptionOrder{}, &UserSubscription{}, &SubscriptionPlanVersion{}, &SubscriptionPlan{}))
			})
			if tc.name != "sqlite" {
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS subscription_orders").Error)
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS user_subscriptions").Error)
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS subscription_plan_versions").Error)
				require.NoError(t, db.Exec("DROP TABLE IF EXISTS subscription_plans").Error)
			}

			// Create a representative pre-version schema first. The current models
			// then upgrade it by adding version fields and the version table.
			require.NoError(t, db.AutoMigrate(&legacySubscriptionPlan{}, &legacySubscriptionOrder{}, &legacyUserSubscription{}))
			legacyPlan := &legacySubscriptionPlan{Title: "legacy", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, TotalAmount: 100, QuotaModelVersion: 1}
			require.NoError(t, db.Create(legacyPlan).Error)
			require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}, &SubscriptionPlanVersion{}, &SubscriptionOrder{}, &UserSubscription{}))
			for _, table := range []string{"subscription_orders", "user_subscriptions"} {
				columns, err := db.Migrator().ColumnTypes(table)
				require.NoError(t, err)
				found := false
				for _, column := range columns {
					if strings.EqualFold(column.Name(), "plan_version_id") {
						found = true
						break
					}
				}
				assert.True(t, found, "%s.plan_version_id should be migrated", table)
			}
			require.NoError(t, ensureSubscriptionPlanVersions(db))
			require.NoError(t, db.AutoMigrate(&SubscriptionPlanVersion{}))
			require.NoError(t, ensureSubscriptionPlanVersions(db))

			var count int64
			require.NoError(t, db.Model(&SubscriptionPlanVersion{}).Where("plan_id = ?", legacyPlan.Id).Count(&count).Error)
			assert.EqualValues(t, 1, count)
			var version SubscriptionPlanVersion
			require.NoError(t, db.Where("plan_id = ?", legacyPlan.Id).First(&version).Error)
			order := &SubscriptionOrder{PlanId: legacyPlan.Id, PlanVersionId: version.Id, TradeNo: "ticket01-" + tc.name, Status: common.TopUpStatusPending}
			require.NoError(t, db.Create(order).Error)
			subscription := &UserSubscription{PlanId: legacyPlan.Id, PlanVersionId: version.Id, Status: "active"}
			require.NoError(t, db.Create(subscription).Error)
			var loadedOrder SubscriptionOrder
			require.NoError(t, db.First(&loadedOrder, order.Id).Error)
			assert.Equal(t, version.Id, loadedOrder.PlanVersionId)
			var loadedSubscription UserSubscription
			require.NoError(t, db.First(&loadedSubscription, subscription.Id).Error)
			assert.Equal(t, version.Id, loadedSubscription.PlanVersionId)
		})
	}
}

func TestSubscriptionPlanQuotaMigrationMatrix(t *testing.T) {
	cases := []struct {
		name string
		dsn  string
		open func(string) gorm.Dialector
	}{
		{name: "sqlite", dsn: ":memory:", open: func(dsn string) gorm.Dialector { return sqlite.Open(dsn) }},
		{name: "mysql", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_MYSQL_DSN")), open: func(dsn string) gorm.Dialector { return mysql.Open(dsn) }},
		{name: "postgres", dsn: strings.TrimSpace(os.Getenv("TEST_SUBSCRIPTION_POSTGRES_DSN")), open: func(dsn string) gorm.Dialector { return postgres.Open(dsn) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.dsn == "" {
				t.Skipf("TEST_SUBSCRIPTION_%s_DSN is not configured", strings.ToUpper(tc.name))
			}
			for _, existing := range []bool{false, true} {
				name := "fresh"
				if existing {
					name = "upgrade"
				}
				t.Run(name, func(t *testing.T) {
					db, err := gorm.Open(tc.open(tc.dsn), &gorm.Config{})
					require.NoError(t, err)
					sqlDB, err := db.DB()
					require.NoError(t, err)
					sqlDB.SetMaxOpenConns(1)
					t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
					t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&SubscriptionPlanVersion{}, &SubscriptionPlan{})) })
					previousDB, previousType := DB, common.MainDatabaseType()
					DB = db
					common.SetMainDatabaseType(common.DatabaseType(tc.name))
					t.Cleanup(func() {
						DB = previousDB
						common.SetMainDatabaseType(previousType)
					})
					var version string
					versionQuery := "SELECT VERSION()"
					if tc.name == "sqlite" {
						versionQuery = "SELECT sqlite_version()"
					}
					require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
					t.Logf("database version: %s", version)
					var legacyID int
					if existing {
						// Plan schema before quota windows were introduced (origin/main).
						type previousPlan struct {
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
						require.NoError(t, db.Table("subscription_plans").AutoMigrate(&previousPlan{}))
						legacy := previousPlan{Title: "legacy", PriceAmount: 12.345678, TotalAmount: 400, QuotaResetPeriod: SubscriptionResetDaily}
						require.NoError(t, db.Table("subscription_plans").Create(&legacy).Error)
						legacyID = legacy.Id
					}
					for range 2 {
						if tc.name == "sqlite" {
							require.NoError(t, ensureSubscriptionPlanTableSQLite())
						} else {
							require.NoError(t, db.AutoMigrate(&SubscriptionPlan{}))
						}
						require.NoError(t, db.AutoMigrate(&SubscriptionPlanVersion{}))
						require.NoError(t, ensureSubscriptionPlanVersions(db))
					}
					plan := &SubscriptionPlan{
						Title: "new plan", TotalAmount: 400, WindowAmount: 500,
						QuotaModelVersion: 1, QuotaResetPeriod: SubscriptionResetDaily,
					}
					require.ErrorContains(t, plan.ValidateQuotaConfiguration(), "Window quota cannot exceed total quota")
					plan.QuotaResetPeriod = SubscriptionResetNever
					require.NoError(t, plan.ValidateQuotaConfiguration())
					require.NoError(t, db.Create(plan).Error)
					var saved SubscriptionPlan
					require.NoError(t, db.First(&saved, plan.Id).Error)
					assert.EqualValues(t, 500, saved.WindowAmount)
					assert.Equal(t, 1, saved.QuotaModelVersion)
					assert.Equal(t, SubscriptionResetNever, saved.QuotaResetPeriod)
					versioned, err := CreateSubscriptionPlanVersionTx(db, &saved)
					require.NoError(t, err)
					terms, err := versioned.PlanTerms()
					require.NoError(t, err)
					assert.Equal(t, saved.WindowAmount, terms.WindowAmount)
					if existing {
						var legacy SubscriptionPlan
						require.NoError(t, db.First(&legacy, legacyID).Error)
						assert.Equal(t, "legacy", legacy.Title)
						assert.Equal(t, 12.345678, legacy.PriceAmount)
						assert.EqualValues(t, 400, legacy.TotalAmount)
						assert.Zero(t, legacy.WindowAmount)
						assert.Zero(t, legacy.QuotaModelVersion)
						assert.Equal(t, SubscriptionResetDaily, legacy.QuotaResetPeriod)
						var versions int64
						require.NoError(t, db.Model(&SubscriptionPlanVersion{}).Where("plan_id = ?", legacyID).Count(&versions).Error)
						assert.EqualValues(t, 1, versions)
					}
				})
			}
		})
	}
}

func TestCompleteSubscriptionOrderUsesPlanVersionAndLegacySnapshot(t *testing.T) {
	truncateTables(t)
	plan := createPlanVersionTestPlan(t, "original")
	version1, err := CreateSubscriptionPlanVersionTx(DB, plan)
	require.NoError(t, err)

	plan.Title = "edited"
	plan.TotalAmount = 250
	require.NoError(t, DB.Save(plan).Error)
	_, err = CreateSubscriptionPlanVersionTx(DB, plan)
	require.NoError(t, err)

	versionedUser := createPlanVersionTestUser(t, "versioned-purchase")
	versionedOrder := &SubscriptionOrder{
		UserId:        versionedUser.Id,
		PlanId:        plan.Id,
		PlanVersionId: version1.Id,
		TradeNo:       "versioned-order",
		Money:         version1Price(t, version1),
		PaymentMethod: PaymentMethodBalance,
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, versionedOrder.Insert())
	require.NoError(t, CompleteSubscriptionOrder(versionedOrder.TradeNo, "", "", ""))

	var versionedSub UserSubscription
	require.NoError(t, DB.Where("user_id = ?", versionedUser.Id).First(&versionedSub).Error)
	assert.Equal(t, version1.Id, versionedSub.PlanVersionId)
	assert.EqualValues(t, 100, versionedSub.AmountTotal)
	info, err := GetSubscriptionPlanInfoByUserSubscriptionId(versionedSub.Id)
	require.NoError(t, err)
	assert.Equal(t, "original", info.PlanTitle)
	assert.Equal(t, version1.Id, info.PlanVersionId)

	legacyUser := createPlanVersionTestUser(t, "legacy-purchase")
	legacyOrder := &SubscriptionOrder{
		UserId:        legacyUser.Id,
		PlanId:        plan.Id,
		TradeNo:       "legacy-order",
		Money:         10,
		PaymentMethod: PaymentMethodBalance,
		Status:        common.TopUpStatusPending,
	}
	legacyOrder.CapturePlanTerms(mustPlanTerms(t, version1))
	require.NoError(t, legacyOrder.Insert())
	require.NoError(t, CompleteSubscriptionOrder(legacyOrder.TradeNo, "", "", ""))

	var legacySub UserSubscription
	require.NoError(t, DB.Where("user_id = ?", legacyUser.Id).First(&legacySub).Error)
	assert.Zero(t, legacySub.PlanVersionId)
	assert.EqualValues(t, 100, legacySub.AmountTotal)
}

func mustPlanTerms(t *testing.T, version *SubscriptionPlanVersion) *SubscriptionPlan {
	t.Helper()
	plan, err := version.PlanTerms()
	require.NoError(t, err)
	return plan
}

func version1Price(t *testing.T, version *SubscriptionPlanVersion) float64 {
	t.Helper()
	plan := mustPlanTerms(t, version)
	return plan.PriceAmount
}
