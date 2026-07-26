package model

import (
	"errors"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func setupEntitlementTestDB(t *testing.T) {
	t.Helper()
	oldFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	require.NoError(t, DB.AutoMigrate(
		&EntitlementPackage{},
		&UserEntitlement{},
		&TokenEntitlement{},
		&EntitlementDailyUsage{},
	))
	require.NoError(t, DB.Exec("DELETE FROM entitlement_daily_usages").Error)
	require.NoError(t, DB.Exec("DELETE FROM token_entitlements").Error)
	require.NoError(t, DB.Exec("DELETE FROM user_entitlements").Error)
	require.NoError(t, DB.Exec("DELETE FROM entitlement_packages").Error)
	require.NoError(t, DB.Unscoped().Where("id IN ?", []int{201, 202}).Delete(&Token{}).Error)
	require.NoError(t, DB.Unscoped().Where("id IN ?", []int{101, 102}).Delete(&User{}).Error)
	t.Cleanup(func() {
		common.EntitlementFeatureEnabled = oldFeatureEnabled
		DB.Exec("DELETE FROM entitlement_daily_usages")
		DB.Exec("DELETE FROM token_entitlements")
		DB.Exec("DELETE FROM user_entitlements")
		DB.Exec("DELETE FROM entitlement_packages")
		DB.Unscoped().Where("id IN ?", []int{201, 202}).Delete(&Token{})
		DB.Unscoped().Where("id IN ?", []int{101, 102}).Delete(&User{})
	})
}

func TestEntitlementEmergencyFeatureFlagDisablesEnforcement(t *testing.T) {
	setupEntitlementTestDB(t)
	_, user, token := seedEntitlementScenario(t)
	common.EntitlementFeatureEnabled = false

	grant, protected, err := ResolveTokenEntitlement(token.Id, user.Id, "grok-4.5", time.Now())
	require.NoError(t, err)
	require.Nil(t, grant)
	require.False(t, protected)

	tokenPackages, err := GetActiveTokenEntitlementPackages(token.Id, user.Id)
	require.NoError(t, err)
	require.Empty(t, tokenPackages)

	userPackages, err := GetUserEntitlementPackages(user.Id, true)
	require.NoError(t, err)
	require.Empty(t, userPackages)
}

func TestSaveEntitlementPackageUpdatePreservesCreatedTime(t *testing.T) {
	setupEntitlementTestDB(t)
	pkg, _, _ := seedEntitlementScenario(t)
	createdTime := pkg.CreatedTime

	pkg.Description = "updated"
	require.NoError(t, SaveEntitlementPackage(pkg))
	require.Equal(t, createdTime, pkg.CreatedTime)

	stored, err := GetEntitlementPackage(pkg.Id)
	require.NoError(t, err)
	require.Equal(t, createdTime, stored.CreatedTime)
	require.Equal(t, "updated", stored.Description)

	missing := *pkg
	missing.Id = 999999
	require.Error(t, SaveEntitlementPackage(&missing))
}

func seedEntitlementScenario(t *testing.T) (*EntitlementPackage, *User, *Token) {
	t.Helper()
	user := &User{
		Id:       101,
		Username: "entitlement-user",
		AffCode:  "entitlement-user-101",
		Status:   common.UserStatusEnabled,
		Quota:    1_000_000,
	}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		Id:             201,
		UserId:         user.Id,
		Key:            "entitlement-token",
		Name:           "activity-token",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	require.NoError(t, DB.Create(token).Error)
	pkg := &EntitlementPackage{
		Name:                "grok activity",
		Status:              EntitlementStatusEnabled,
		Group:               "grok-private",
		Models:              "grok-4.5,grok-image",
		Priority:            10,
		AllowPublicFallback: false,
		DailyQuota:          100,
		DailyRequestLimit:   2,
		TotalQuota:          150,
		TotalRequestLimit:   3,
	}
	require.NoError(t, SaveEntitlementPackage(pkg))
	require.NoError(t, UpsertUserEntitlement(&UserEntitlement{
		PackageId: pkg.Id,
		UserId:    user.Id,
		Status:    EntitlementStatusEnabled,
	}))
	require.NoError(t, SetTokenEntitlementPackages(token.Id, user.Id, []int{pkg.Id}, false))
	return pkg, user, token
}

func TestResolveTokenEntitlementAndExclusiveProtection(t *testing.T) {
	setupEntitlementTestDB(t)
	pkg, user, token := seedEntitlementScenario(t)

	grant, protected, err := ResolveTokenEntitlement(token.Id, user.Id, "grok-4.5", time.Now())
	require.NoError(t, err)
	require.True(t, protected)
	require.NotNil(t, grant)
	require.Equal(t, pkg.Id, grant.Package.Id)
	require.Equal(t, "grok-private", grant.Package.Group)
	require.Equal(t, 100, grant.DailyQuota)

	otherUser := &User{Id: 102, Username: "other-user", AffCode: "entitlement-user-102", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(otherUser).Error)
	otherToken := &Token{
		Id: 202, UserId: otherUser.Id, Key: "other-token", Name: "other",
		Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true,
	}
	require.NoError(t, DB.Create(otherToken).Error)

	grant, protected, err = ResolveTokenEntitlement(otherToken.Id, otherUser.Id, "grok-4.5", time.Now())
	require.Nil(t, grant)
	require.True(t, protected)
	var accessErr *EntitlementAccessError
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_required", accessErr.Code)

	grant, protected, err = ResolveTokenEntitlement(otherToken.Id, otherUser.Id, "public-model", time.Now())
	require.NoError(t, err)
	require.False(t, protected)
	require.Nil(t, grant)
}

func TestEntitlementClosedOrExpiredDoesNotFallBack(t *testing.T) {
	setupEntitlementTestDB(t)
	pkg, user, token := seedEntitlementScenario(t)
	pkg.EndTime = time.Now().Add(-time.Minute).Unix()
	require.NoError(t, SaveEntitlementPackage(pkg))

	grant, protected, err := ResolveTokenEntitlement(token.Id, user.Id, "grok-image", time.Now())
	require.Nil(t, grant)
	require.True(t, protected)
	var accessErr *EntitlementAccessError
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_inactive", accessErr.Code)
	require.Equal(t, "活动已结束", accessErr.Message)
}

func TestEntitlementRequestLimitsAndDailyReset(t *testing.T) {
	setupEntitlementTestDB(t)
	_, user, token := seedEntitlementScenario(t)
	grant, _, err := ResolveTokenEntitlement(token.Id, user.Id, "grok-4.5", time.Now())
	require.NoError(t, err)

	require.NoError(t, ReserveEntitlementRequest(grant))
	require.NoError(t, ReserveEntitlementRequest(grant))
	err = ReserveEntitlementRequest(grant)
	var accessErr *EntitlementAccessError
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_daily_requests_exhausted", accessErr.Code)

	nextDay := *grant
	nextDay.UsageDate = "2099-01-02"
	require.NoError(t, ReserveEntitlementRequest(&nextDay))
	err = ReserveEntitlementRequest(&nextDay)
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_total_requests_exhausted", accessErr.Code)

	require.NoError(t, AdjustEntitlementRequest(grant.TokenGrant.Id, grant.UsageDate, -1))
	require.NoError(t, ReserveEntitlementRequest(&nextDay))
}

func TestEntitlementQuotaReservationSettlementAndRefund(t *testing.T) {
	setupEntitlementTestDB(t)
	_, user, token := seedEntitlementScenario(t)
	grant, _, err := ResolveTokenEntitlement(token.Id, user.Id, "grok-4.5", time.Now())
	require.NoError(t, err)

	require.NoError(t, AdjustEntitlementQuota(
		grant.TokenGrant.Id, grant.UsageDate, 80, grant.DailyQuota, grant.TotalQuota,
	))
	err = AdjustEntitlementQuota(
		grant.TokenGrant.Id, grant.UsageDate, 21, grant.DailyQuota, grant.TotalQuota,
	)
	var accessErr *EntitlementAccessError
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_daily_quota_exhausted", accessErr.Code)

	require.NoError(t, AdjustEntitlementQuota(
		grant.TokenGrant.Id, "2099-01-02", 70, grant.DailyQuota, grant.TotalQuota,
	))
	err = AdjustEntitlementQuota(
		grant.TokenGrant.Id, "2099-01-03", 1, grant.DailyQuota, grant.TotalQuota,
	)
	require.True(t, errors.As(err, &accessErr))
	require.Equal(t, "entitlement_total_quota_exhausted", accessErr.Code)

	require.NoError(t, AdjustEntitlementQuota(grant.TokenGrant.Id, grant.UsageDate, -50, 0, 0))
	require.NoError(t, AdjustEntitlementQuota(
		grant.TokenGrant.Id, "2099-01-03", 1, grant.DailyQuota, grant.TotalQuota,
	))

	var tokenGrant TokenEntitlement
	require.NoError(t, DB.First(&tokenGrant, grant.TokenGrant.Id).Error)
	require.Equal(t, 101, tokenGrant.UsedQuota)
}

func TestOneTokenCanHoldMultipleEntitlementPackages(t *testing.T) {
	setupEntitlementTestDB(t)
	first, user, token := seedEntitlementScenario(t)
	second := &EntitlementPackage{
		Name: "image activity", Status: EntitlementStatusEnabled, Group: "image-private",
		Models: "new-image-model", AllowPublicFallback: false,
	}
	require.NoError(t, SaveEntitlementPackage(second))
	require.NoError(t, UpsertUserEntitlement(&UserEntitlement{
		PackageId: second.Id, UserId: user.Id, Status: EntitlementStatusEnabled,
	}))
	require.NoError(t, SetTokenEntitlementPackages(token.Id, user.Id, []int{first.Id, second.Id}, false))

	assignments, err := GetTokenEntitlements(token.Id)
	require.NoError(t, err)
	require.Len(t, assignments, 2)
	for _, item := range assignments {
		require.Equal(t, EntitlementStatusEnabled, item.Status)
	}

	grant, protected, err := ResolveTokenEntitlement(token.Id, user.Id, "new-image-model", time.Now())
	require.NoError(t, err)
	require.True(t, protected)
	require.Equal(t, second.Id, grant.Package.Id)
}
