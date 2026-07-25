package model

import (
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
)

func setupSubscriptionPlanLifecycleTestDB(t *testing.T) {
	t.Helper()
	setupSubscriptionRecurringTestDB(t)
	migrateSubscriptionContractTestDB(t)
}

func lifecycleRank(rank int) *int {
	return common.GetPointer(rank)
}

func lifecycleTestPlan(rank *int, enabled bool) *SubscriptionPlan {
	titleRank := "nil"
	if rank != nil {
		titleRank = fmt.Sprintf("%d", *rank)
	}
	return &SubscriptionPlan{
		Title:         "Lifecycle Rank " + titleRank,
		Subtitle:      "initial",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       enabled,
		SortOrder:     1,
		TierRank:      rank,
		StripePriceId: "price_" + titleRank,
		UpgradeGroup:  "",
		TotalAmount:   1000,
	}
}

func requireActiveReservation(t *testing.T, rank int, planID int) {
	t.Helper()
	var reservation SubscriptionTierRankReservation
	require.NoError(t, DB.First(&reservation, "tier_rank = ?", rank).Error)
	require.Equal(t, planID, reservation.ActivePlanId)
}

func requireNoActiveReservation(t *testing.T, rank int) {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&SubscriptionTierRankReservation{}).Where("tier_rank = ?", rank).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionPlanCreateReservesOnlyEnabledPositiveRank(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	enabledPlan := lifecycleTestPlan(lifecycleRank(10), true)
	require.NoError(t, CreateSubscriptionPlan(enabledPlan))
	requireActiveReservation(t, 10, enabledPlan.Id)

	disabledSameRank := lifecycleTestPlan(lifecycleRank(10), false)
	require.NoError(t, CreateSubscriptionPlan(disabledSameRank))
	requireActiveReservation(t, 10, enabledPlan.Id)

	disabledNilRank := lifecycleTestPlan(nil, false)
	require.NoError(t, CreateSubscriptionPlan(disabledNilRank))

	var storedRank sql.NullInt64
	require.NoError(t, DB.Raw("SELECT tier_rank FROM subscription_plans WHERE id = ?", disabledNilRank.Id).Scan(&storedRank).Error)
	require.False(t, storedRank.Valid)
}

func TestSubscriptionPlanEnabledCreateRequiresPositiveRank(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	err := CreateSubscriptionPlan(lifecycleTestPlan(nil, true))
	require.ErrorIs(t, err, ErrSubscriptionTierRankRequired)

	err = CreateSubscriptionPlan(lifecycleTestPlan(lifecycleRank(0), true))
	require.ErrorIs(t, err, ErrSubscriptionTierRankRequired)
}

func TestSubscriptionPlanEnableConflictAndReplacementFlow(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	activePlan := lifecycleTestPlan(lifecycleRank(20), true)
	require.NoError(t, CreateSubscriptionPlan(activePlan))
	requireActiveReservation(t, 20, activePlan.Id)

	stagedReplacement := lifecycleTestPlan(lifecycleRank(20), false)
	require.NoError(t, CreateSubscriptionPlan(stagedReplacement))
	requireActiveReservation(t, 20, activePlan.Id)

	err := SetSubscriptionPlanEnabled(stagedReplacement.Id, true)
	require.ErrorIs(t, err, ErrSubscriptionTierRankReserved)
	requireActiveReservation(t, 20, activePlan.Id)

	require.NoError(t, SetSubscriptionPlanEnabled(activePlan.Id, false))
	requireNoActiveReservation(t, 20)

	require.NoError(t, SetSubscriptionPlanEnabled(stagedReplacement.Id, true))
	requireActiveReservation(t, 20, stagedReplacement.Id)
}

func TestSubscriptionPlanDisableReferencedPlanReleasesReservationAndAllowsMetadata(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	plan := lifecycleTestPlan(lifecycleRank(30), true)
	require.NoError(t, CreateSubscriptionPlan(plan))
	require.NoError(t, DB.Create(&UserSubscription{UserId: 5030, PlanId: plan.Id, Status: "active"}).Error)

	metadata := *plan
	metadata.Title = "Renamed"
	metadata.Subtitle = "metadata"
	metadata.PriceAmount = 19.99
	metadata.SortOrder = 99
	require.NoError(t, UpdateSubscriptionPlan(&metadata))
	requireActiveReservation(t, 30, plan.Id)

	require.NoError(t, SetSubscriptionPlanEnabled(plan.Id, false))
	requireNoActiveReservation(t, 30)

	var stored SubscriptionPlan
	require.NoError(t, DB.First(&stored, "id = ?", plan.Id).Error)
	require.False(t, stored.Enabled)
	require.NotNil(t, stored.TierRank)
	require.Equal(t, 30, *stored.TierRank)
}

func TestSubscriptionPlanPersistsNullableLocalPrices(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	pixPrice := 49.90
	upiPrice := 799.50
	plan := lifecycleTestPlan(lifecycleRank(35), true)
	plan.PixPriceBRL = &pixPrice
	plan.UpiPriceINR = nil
	require.NoError(t, CreateSubscriptionPlan(plan))

	var stored SubscriptionPlan
	require.NoError(t, DB.First(&stored, "id = ?", plan.Id).Error)
	require.NotNil(t, stored.PixPriceBRL)
	require.InDelta(t, pixPrice, *stored.PixPriceBRL, 0.000001)
	require.Nil(t, stored.UpiPriceINR)

	updated := stored
	updated.PixPriceBRL = nil
	updated.UpiPriceINR = &upiPrice
	require.NoError(t, UpdateSubscriptionPlan(&updated))

	var reloaded SubscriptionPlan
	require.NoError(t, DB.First(&reloaded, "id = ?", plan.Id).Error)
	require.Nil(t, reloaded.PixPriceBRL)
	require.NotNil(t, reloaded.UpiPriceINR)
	require.InDelta(t, upiPrice, *reloaded.UpiPriceINR, 0.000001)
}

func TestEnsureSubscriptionPlanTableSQLiteIncludesNullableLocalPrices(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)

	require.NoError(t, ensureSubscriptionPlanTableSQLite())
	requireSubscriptionPlanColumnNullable(t, "pix_price_brl")
	requireSubscriptionPlanColumnNullable(t, "upi_price_inr")
}

func TestEnsureSubscriptionPlanTableSQLiteAddsLocalPricesToExistingTable(t *testing.T) {
	setupSubscriptionRecurringTestDB(t)

	require.NoError(t, DB.Exec("CREATE TABLE `subscription_plans` (`id` integer PRIMARY KEY, `title` varchar(128) NOT NULL, `price_amount` decimal(10,6) NOT NULL)").Error)
	require.NoError(t, ensureSubscriptionPlanTableSQLite())
	requireSubscriptionPlanColumnNullable(t, "pix_price_brl")
	requireSubscriptionPlanColumnNullable(t, "upi_price_inr")
}

func requireSubscriptionPlanColumnNullable(t *testing.T, name string) {
	t.Helper()
	var cols []struct {
		Name    string `gorm:"column:name"`
		Type    string `gorm:"column:type"`
		NotNull int    `gorm:"column:notnull"`
	}
	require.NoError(t, DB.Raw("PRAGMA table_info(`subscription_plans`)").Scan(&cols).Error)
	for _, col := range cols {
		if col.Name == name {
			require.Equal(t, "decimal(10,6)", col.Type)
			require.Zero(t, col.NotNull)
			return
		}
	}
	t.Fatalf("missing subscription_plans.%s", name)
}

func TestSubscriptionPlanLifecycleFieldsImmutableAfterReference(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	cases := []struct {
		name       string
		reference  func(t *testing.T, planID int)
		mutatePlan func(plan *SubscriptionPlan)
	}{
		{
			name: "contract current plan freezes tier rank",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&UserSubscriptionContract{UserId: 5001, CurrentPlanId: planID}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) { plan.TierRank = lifecycleRank(41) },
		},
		{
			name: "contract pending plan freezes duration",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&UserSubscriptionContract{UserId: 5002, PendingPlanId: planID}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) { plan.DurationUnit = SubscriptionDurationYear },
		},
		{
			name: "entitlement history freezes total amount",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&UserSubscription{UserId: 5003, PlanId: planID, Status: "expired"}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) { plan.TotalAmount++ },
		},
		{
			name: "order freezes stripe price id",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&SubscriptionOrder{UserId: 5004, PlanId: planID, TradeNo: "lifecycle-order", Status: common.TopUpStatusPending}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) { plan.StripePriceId = "price_changed" },
		},
		{
			name: "change intent from plan freezes upgrade group",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&SubscriptionChangeIntent{ContractId: 1, UserId: 5005, RequestId: "from-plan", FromPlanId: planID}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) { plan.UpgradeGroup = "vip" },
		},
		{
			name: "change intent to plan freezes custom seconds",
			reference: func(t *testing.T, planID int) {
				require.NoError(t, DB.Create(&SubscriptionChangeIntent{ContractId: 2, UserId: 5006, RequestId: "to-plan", ToPlanId: planID}).Error)
			},
			mutatePlan: func(plan *SubscriptionPlan) {
				plan.DurationUnit = SubscriptionDurationCustom
				plan.CustomSeconds = 7200
			},
		},
	}

	for i, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			setupSubscriptionPlanLifecycleTestDB(t)

			plan := lifecycleTestPlan(lifecycleRank(40+i), true)
			require.NoError(t, CreateSubscriptionPlan(plan))
			tt.reference(t, plan.Id)

			updated := *plan
			tt.mutatePlan(&updated)
			err := UpdateSubscriptionPlan(&updated)
			require.ErrorIs(t, err, ErrSubscriptionPlanLifecycleFieldsImmutable)
		})
	}
}

func TestEnabledLegacyNilRankRequiresExplicitRankBeforeMutation(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	legacy := lifecycleTestPlan(nil, true)
	require.NoError(t, DB.Select("*").Create(legacy).Error)

	renamed := *legacy
	renamed.Title = "Legacy renamed"
	err := UpdateSubscriptionPlan(&renamed)
	require.ErrorIs(t, err, ErrSubscriptionTierRankRequired)

	require.NoError(t, SetSubscriptionPlanEnabled(legacy.Id, false))
	var stored SubscriptionPlan
	require.NoError(t, DB.First(&stored, "id = ?", legacy.Id).Error)
	require.False(t, stored.Enabled)
	require.Nil(t, stored.TierRank)
}

func TestConcurrentCreateAndEnableSameTierRankReturnsReservedError(t *testing.T) {
	t.Run("create", func(t *testing.T) {
		setupSubscriptionPlanLifecycleTestDB(t)

		const rank = 90
		var wg sync.WaitGroup
		createErrs := make([]error, 2)
		for i := range createErrs {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				plan := lifecycleTestPlan(lifecycleRank(rank), true)
				plan.Title = fmt.Sprintf("Concurrent Create %d", i)
				createErrs[i] = CreateSubscriptionPlan(plan)
			}(i)
		}
		wg.Wait()
		requireOneSuccessOneReserved(t, createErrs)
	})

	t.Run("enable", func(t *testing.T) {
		setupSubscriptionPlanLifecycleTestDB(t)

		const rank = 90
		staged := make([]SubscriptionPlan, 2)
		for i := range staged {
			plan := lifecycleTestPlan(lifecycleRank(rank), false)
			plan.Title = fmt.Sprintf("Concurrent Enable %d", i)
			require.NoError(t, CreateSubscriptionPlan(plan))
			staged[i] = *plan
		}

		var wg sync.WaitGroup
		enableErrs := make([]error, 2)
		for i := range staged {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				enableErrs[i] = SetSubscriptionPlanEnabled(staged[i].Id, true)
			}(i)
		}
		wg.Wait()
		requireOneSuccessOneReserved(t, enableErrs)
	})
}

func requireOneSuccessOneReserved(t *testing.T, errs []error) {
	t.Helper()
	successes := 0
	reserved := 0
	for _, err := range errs {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrSubscriptionTierRankReserved):
			reserved++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, reserved)
}

func TestSubscriptionTierRankDuplicateErrorClassifier(t *testing.T) {
	require.True(t, isSubscriptionTierRankDuplicateError(&pgconn.PgError{Code: "23505"}))
	require.True(t, isSubscriptionTierRankDuplicateError(&mysqlDriver.MySQLError{Number: 1062, Message: "Duplicate entry '90' for key 'PRIMARY'"}))
	require.True(t, isSubscriptionTierRankDuplicateError(errors.New("constraint failed: UNIQUE constraint failed: subscription_tier_rank_reservations.tier_rank")))
	require.True(t, isSubscriptionTierRankDuplicateError(errors.New("UNIQUE constraint failed: subscription_tier_rank_reservations.active_plan_id")))

	require.False(t, isSubscriptionTierRankDuplicateError(&pgconn.PgError{Code: "23503"}))
	require.False(t, isSubscriptionTierRankDuplicateError(&mysqlDriver.MySQLError{Number: 1452, Message: "foreign key constraint fails"}))
	require.False(t, isSubscriptionTierRankDuplicateError(errors.New("database table is locked")))
}

func TestInvalidateSubscriptionPlanCacheOnSuccessOnlyInvalidatesNilTransactionError(t *testing.T) {
	setupSubscriptionPlanLifecycleTestDB(t)

	const planID = 8801
	cache := getSubscriptionPlanCache()
	cached := SubscriptionPlan{Id: planID, Title: "cached"}
	require.NoError(t, cache.SetWithTTL(subscriptionPlanCacheKey(planID), cached, subscriptionPlanCacheTTL()))

	err := invalidateSubscriptionPlanCacheOnSuccess(planID, errors.New("rollback"))
	require.Error(t, err)
	got, found, err := cache.Get(subscriptionPlanCacheKey(planID))
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, "cached", got.Title)

	require.NoError(t, invalidateSubscriptionPlanCacheOnSuccess(planID, nil))
	_, found, err = cache.Get(subscriptionPlanCacheKey(planID))
	require.NoError(t, err)
	require.False(t, found)
}
