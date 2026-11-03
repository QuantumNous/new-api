package model

import (
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPartnerTenantModelTestDB(t *testing.T) {
	t.Helper()
	previousDB := DB
	partnerTenantMembershipCache.Purge()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&PartnerTenant{}))
	DB = db
	t.Cleanup(func() {
		partnerTenantMembershipCache.Purge()
		DB = previousDB
		_ = sqlDB.Close()
	})
}

func TestOrdinaryUserPlanRateLimitSkipsSubscriptionQueries(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	require.NoError(t, DB.AutoMigrate(&PartnerTenantAccount{}, &SubscriptionPlan{}, &UserSubscription{}))
	recorder := &migrationSQLRecorder{}
	DB = DB.Session(&gorm.Session{Logger: recorder})

	for i := 0; i < 2; i++ {
		recorder.reset()
		limit, err := GetPartnerUserPlanRateLimit(930001, "default")
		require.NoError(t, err)
		require.Zero(t, limit)
		for _, statement := range recorder.statements {
			require.NotContains(t, statement, "user_subscriptions", "ordinary users must not query subscriptions")
			require.NotContains(t, statement, "strftime", "ordinary users must not query the database clock")
		}
		if i > 0 {
			require.Empty(t, recorder.statements, "cached ordinary users must not access the database")
		} else {
			require.Len(t, recorder.statements, 1, "only one indexed membership lookup is needed on a cache miss")
		}
	}
}

func TestProvisionPartnerTenantAccountAcceptsUnicodeExternalID(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	require.NoError(t, DB.AutoMigrate(&User{}, &Token{}, &PartnerTenantAccount{}))
	tenant, _, err := CreatePartnerTenant("Partner", "partner-unicode")
	require.NoError(t, err)
	externalID := strings.Repeat("客", 128)
	account, err := ProvisionPartnerTenantAccount(tenant.Id, externalID, "")
	require.NoError(t, err)
	require.True(t, account.Created)
	stored, err := GetPartnerTenantAccount(tenant.Id, externalID)
	require.NoError(t, err)
	require.Equal(t, externalID, stored.ExternalUserId)
}

func TestProvisionPartnerTenantAccountRefreshesCachedMembership(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	require.NoError(t, DB.AutoMigrate(&User{}, &Token{}, &PartnerTenantAccount{}, &SubscriptionPlan{}, &UserSubscription{}))
	member, err := isPartnerTenantUser(1)
	require.NoError(t, err)
	require.False(t, member)
	tenant, _, err := CreatePartnerTenant("Partner", "partner-cache")
	require.NoError(t, err)
	_, err = ProvisionPartnerTenantAccount(tenant.Id, "customer", "")
	require.NoError(t, err)
	stored, err := GetPartnerTenantAccount(tenant.Id, "customer")
	require.NoError(t, err)
	require.Equal(t, 1, stored.UserId)
	member, err = isPartnerTenantUser(stored.UserId)
	require.NoError(t, err)
	require.True(t, member, "successful provisioning must replace cached non-membership")
}

func TestPartnerTenantExternalUserIDValidation(t *testing.T) {
	for _, tc := range []struct {
		name, id string
		valid    bool
	}{
		{"empty", "", false},
		{"ASCII limit", strings.Repeat("a", 128), true},
		{"Unicode limit", strings.Repeat("客", 128), true},
		{"Unicode too long", strings.Repeat("客", 129), false},
		{"control character", "customer\x00id", false},
		{"invalid UTF-8", string([]byte{0xff}), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.valid, IsValidPartnerTenantExternalUserID(tc.id))
		})
	}
}

func TestPartnerPlanRateLimitUsesHighestApplicableActivePlan(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	require.NoError(t, DB.AutoMigrate(&PartnerTenantAccount{}, &SubscriptionPlan{}, &UserSubscription{}))
	require.NoError(t, DB.Create(&PartnerTenantAccount{TenantId: 1, ExternalUserId: "customer-7", UserId: 7, TokenId: 7}).Error)
	now := time.Now().Unix()
	for _, tc := range []struct {
		id         int
		group      string
		limit      int
		partner    int64
		start, end int64
	}{
		{1, "partner-a", 20, 1, now - 10, now + 600},
		{2, "partner-a", 50, 1, now - 10, now + 600},
		{3, "partner-a", 100, 1, now - 600, now - 1},
		{4, "partner-b", 200, 1, now - 10, now + 600},
		{5, "partner-a", 300, 0, now - 10, now + 600},
		{6, "partner-a", 400, 1, now + 600, now + 1200},
	} {
		plan := SubscriptionPlan{Id: tc.id, Title: "test", PartnerTenantId: tc.partner, ApplicableGroup: tc.group, RequestsPerMinute: tc.limit}
		require.NoError(t, DB.Create(&plan).Error)
		require.NoError(t, DB.Create(&UserSubscription{UserId: 7, PlanId: tc.id, Status: "active", StartTime: tc.start, EndTime: tc.end}).Error)
	}
	limit, err := GetPartnerUserPlanRateLimit(7, "partner-a")
	require.NoError(t, err)
	require.Equal(t, 50, limit)
	limit, err = GetPartnerUserPlanRateLimit(7, "partner-b")
	require.NoError(t, err)
	require.Equal(t, 200, limit)
	limit, err = GetPartnerUserPlanRateLimit(8, "partner-a")
	require.NoError(t, err)
	require.Zero(t, limit)

	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", 2).Update("requests_per_minute", 10).Error)
	limit, err = GetPartnerUserPlanRateLimit(7, "partner-a")
	require.NoError(t, err)
	require.Equal(t, 20, limit, "rate edits must be visible with cached membership")
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", 7, 1).Update("status", "cancelled").Error)
	limit, err = GetPartnerUserPlanRateLimit(7, "partner-a")
	require.NoError(t, err)
	require.Equal(t, 10, limit, "cancellation must be visible with cached membership")
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", 7, 2).Update("end_time", now-1).Error)
	limit, err = GetPartnerUserPlanRateLimit(7, "partner-a")
	require.NoError(t, err)
	require.Zero(t, limit, "expiry must be visible with cached membership")
}

func TestUnlimitedPartnerSubscriptionCanConsumeQuota(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}))
	now := GetDBTimestamp()
	plan := SubscriptionPlan{Title: "unlimited", PartnerTenantId: 1, ApplicableGroup: "partner-a", TotalAmount: 0}
	require.NoError(t, DB.Create(&plan).Error)
	sub := UserSubscription{UserId: 99, PlanId: plan.Id, Status: "active", StartTime: now - 1, EndTime: now + 600, AmountTotal: 0}
	require.NoError(t, DB.Create(&sub).Error)
	result, err := PreConsumeUserSubscription("partner-unlimited-1", 99, "test-model", "partner-a", 0, 1000000)
	require.NoError(t, err)
	require.Equal(t, sub.Id, result.UserSubscriptionId)
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	require.EqualValues(t, 1000000, sub.AmountUsed)
}

func TestPartnerTenantSecretIsHashedAndRotationInvalidatesOldValue(t *testing.T) {
	setupPartnerTenantModelTestDB(t)
	tenant, initialSecret, err := CreatePartnerTenant("Partner A", "partner-a")
	require.NoError(t, err)
	require.NotEmpty(t, initialSecret)
	require.NotContains(t, tenant.SecretHash, initialSecret)
	require.NotEqual(t, initialSecret, tenant.SecretHash)

	found, err := FindPartnerTenantBySecret(initialSecret)
	require.NoError(t, err)
	require.Equal(t, tenant.Id, found.Id)

	rotatedSecret, err := RotatePartnerTenantSecret(tenant.Id)
	require.NoError(t, err)
	require.NotEqual(t, initialSecret, rotatedSecret)
	_, err = FindPartnerTenantBySecret(initialSecret)
	require.ErrorIs(t, err, ErrPartnerTenantNotFound)
	found, err = FindPartnerTenantBySecret(rotatedSecret)
	require.NoError(t, err)
	require.Equal(t, tenant.Id, found.Id)

	_, _, err = CreatePartnerTenant("Partner B", "partner-a")
	require.Error(t, err, "a dedicated group cannot be assigned to two tenants")
}
