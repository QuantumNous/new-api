package service

import (
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRedemptionServiceTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled

	dsn := "file:" + filepath.Join(t.TempDir(), "redemption.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.SubscriptionPlan{},
		&model.UserSubscription{},
		&model.AgentAccount{},
		&model.AgentPlanOffer{},
		&model.AgentPurchaseOrder{},
		&model.Redemption{},
	))
	model.DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitLogDB())
	common.RedisEnabled = false
	// Sold codes are deliverable even while the agent workspace is disabled.
	operation_setting.GetAgentSetting().Enabled = false

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		require.NoError(t, sqlDB.Close())
	})
}

func createRedemptionUser(t *testing.T, id int, group string) model.User {
	t.Helper()
	user := model.User{
		Id: id, Username: fmt.Sprintf("redeem-user-%d", id), AffCode: fmt.Sprintf("redeem-aff-%d", id),
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: group,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	return user
}

func validRedemptionSnapshot(planID int) model.SubscriptionEntitlementSnapshot {
	return model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: planID, PlanTitle: "Sold Snapshot Pro",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 3600,
		UpgradeGroup: "pro", DowngradeGroup: "starter", TotalAmount: 5000,
		QuotaResetPeriod: model.SubscriptionResetNever, AllowWalletOverflow: false,
	}
}

func createSubscriptionRedemption(t *testing.T, key string, snapshotRaw string, status int, expiredTime int64) (model.AgentPurchaseOrder, model.Redemption) {
	t.Helper()
	order := model.AgentPurchaseOrder{
		OrderNo: "order-" + key, AgentUserId: 8001, PlanId: 9001, PlanTitle: "Sold Snapshot Pro",
		Quantity: 1, UnitPrice: 6000, TotalPrice: 6000, CodeValidDays: 365,
		RefundFeeBps: 500, EntitlementSnapshot: snapshotRaw, IdempotencyKey: "idem-" + key,
		Status: model.AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	code := model.Redemption{
		UserId: 8001, Key: key, Status: status, Type: common.RedemptionCodeTypeSubscription,
		Name: order.PlanTitle, CreatedTime: common.GetTimestamp(), AgentUserId: order.AgentUserId,
		AgentOrderId: order.Id, SubscriptionPlanId: order.PlanId, ExpiredTime: expiredTime,
	}
	require.NoError(t, model.DB.Create(&code).Error)
	return order, code
}

func TestRedeemCodeQuotaCreditsExactlyOnce(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7001, "starter")
	code := model.Redemption{
		Key: "41000000000000000000000000000001", Name: "quota-code",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota, Quota: 500,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&code).Error)

	result, err := RedeemCode(user.Id, code.Key)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionResultTypeQuota, result.Type)
	require.NotNil(t, result.Quota)
	assert.Equal(t, 500, *result.Quota)
	assert.Zero(t, result.SubscriptionID)

	_, err = RedeemCode(user.Id, code.Key)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRedeemCodeFailed)

	var reloaded model.User
	require.NoError(t, model.DB.First(&reloaded, user.Id).Error)
	assert.Equal(t, 500, reloaded.Quota)
}

func TestRedeemCodeBindsUnboundCustomerAndKeepsFirstAgent(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7005, "starter")
	require.NoError(t, model.DB.Create(&model.AgentAccount{UserId: 8101, Status: model.AgentAccountStatusActive}).Error)
	require.NoError(t, model.DB.Create(&model.AgentAccount{UserId: 8102, Status: model.AgentAccountStatusDisabled}).Error)

	firstCode := model.Redemption{
		Key: "41000000000000000000000000000005", Name: "agent-one-code",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota,
		Quota: 500, AgentUserId: 8101, CreatedTime: common.GetTimestamp(),
	}
	secondCode := model.Redemption{
		Key: "41000000000000000000000000000006", Name: "agent-two-code",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota,
		Quota: 600, AgentUserId: 8102, CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&firstCode).Error)
	require.NoError(t, model.DB.Create(&secondCode).Error)

	result, err := RedeemCode(user.Id, firstCode.Key)
	require.NoError(t, err)
	assert.Equal(t, 8101, result.AgentUserID)

	var customer model.User
	require.NoError(t, model.DB.First(&customer, user.Id).Error)
	assert.Equal(t, 8101, customer.BoundAgentId)

	_, err = RedeemCode(user.Id, secondCode.Key)
	require.NoError(t, err)
	require.NoError(t, model.DB.First(&customer, user.Id).Error)
	assert.Equal(t, 8101, customer.BoundAgentId)
}

func TestRedeemCodeQuotaZeroResultIncludesQuotaField(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7003, "starter")
	code := model.Redemption{
		Key: "41000000000000000000000000000002", Name: "zero-quota-code",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota, Quota: 1,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, model.DB.Create(&code).Error)
	require.NoError(t, model.DB.Model(&code).UpdateColumn("quota", 0).Error)

	result, err := RedeemCode(user.Id, code.Key)
	require.NoError(t, err)
	raw, err := common.Marshal(result)
	require.NoError(t, err)
	assert.JSONEq(t, `{"type":"quota","quota":0}`, string(raw))
}

func TestRedeemCodeSubscriptionUsesSoldSnapshotAfterPlanChanges(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7002, "starter")
	snapshot := validRedemptionSnapshot(9001)
	raw, err := model.EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)

	// The live plan is disabled and materially different. Delivery must not read it.
	currentPlan := model.SubscriptionPlan{
		Id: snapshot.PlanId, Title: "Changed Plan", Enabled: false, Currency: "CNY",
		DurationUnit: model.SubscriptionDurationMonth, DurationValue: 12,
		TotalAmount: 1, QuotaResetPeriod: model.SubscriptionResetMonthly,
		UpgradeGroup: "enterprise", AllowWalletOverflow: common.GetPointer(true),
	}
	require.NoError(t, model.DB.Create(&currentPlan).Error)
	require.NoError(t, model.DB.Create(&model.AgentAccount{
		UserId: 8001, Status: model.AgentAccountStatusDisabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.AgentPlanOffer{
		PlanId: snapshot.PlanId, Enabled: false, UnitPrice: 1, CodeValidDays: 1,
	}).Error)
	_, code := createSubscriptionRedemption(t, "42000000000000000000000000000001", raw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)

	result, err := RedeemCode(user.Id, code.Key)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionResultTypeSubscription, result.Type)
	assert.Equal(t, snapshot.PlanTitle, result.PlanTitle)
	assert.NotZero(t, result.SubscriptionID)

	var subscription model.UserSubscription
	require.NoError(t, model.DB.First(&subscription, result.SubscriptionID).Error)
	assert.Equal(t, user.Id, subscription.UserId)
	assert.Equal(t, snapshot.PlanId, subscription.PlanId)
	assert.Equal(t, int64(5000), subscription.AmountTotal)
	assert.Equal(t, int64(3600), subscription.EndTime-subscription.StartTime)
	assert.Equal(t, "agent_redemption", subscription.Source)
	assert.Equal(t, result.EndTime, subscription.EndTime)
	assert.Equal(t, "pro", subscription.UpgradeGroup)
	assert.False(t, subscription.AllowWalletOverflow)

	var storedCode model.Redemption
	require.NoError(t, model.DB.First(&storedCode, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, storedCode.Status)
	assert.Equal(t, user.Id, storedCode.UsedUserId)
	assert.NotZero(t, storedCode.RedeemedTime)

	var reloadedUser model.User
	require.NoError(t, model.DB.First(&reloadedUser, user.Id).Error)
	assert.Equal(t, "pro", reloadedUser.Group)
	assert.Equal(t, 8001, reloadedUser.BoundAgentId)

	var logs []model.Log
	require.NoError(t, model.DB.Where("user_id = ?", user.Id).Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.NotContains(t, logs[0].Content, code.Key)
	assert.Contains(t, logs[0].Content, fmt.Sprintf("%d", code.Id))
}

func TestRedeemCodeSubscriptionInvalidatesUserCacheOnlyAfterCommit(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7004, "starter")
	raw, err := model.EncodeSubscriptionEntitlementSnapshot(validRedemptionSnapshot(9001))
	require.NoError(t, err)
	_, validCode := createSubscriptionRedemption(t, "42000000000000000000000000000002", raw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)
	_, invalidCode := createSubscriptionRedemption(t, "42000000000000000000000000000003", "{", common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)

	originalInvalidator := invalidateRedemptionUserCacheAfterCommit
	invalidatedUserIDs := make([]int, 0, 1)
	var observedCodeStatus int
	var observedSubscriptions int64
	var observationErr error
	invalidateRedemptionUserCacheAfterCommit = func(userID int) error {
		invalidatedUserIDs = append(invalidatedUserIDs, userID)
		var storedCode model.Redemption
		if err := model.DB.First(&storedCode, validCode.Id).Error; err != nil {
			observationErr = err
			return err
		}
		observedCodeStatus = storedCode.Status
		if err := model.DB.Model(&model.UserSubscription{}).
			Where("user_id = ?", userID).Count(&observedSubscriptions).Error; err != nil {
			observationErr = err
			return err
		}
		return nil
	}
	t.Cleanup(func() { invalidateRedemptionUserCacheAfterCommit = originalInvalidator })

	_, err = RedeemCode(user.Id, validCode.Key)
	require.NoError(t, err)
	require.NoError(t, observationErr)
	assert.Equal(t, []int{user.Id}, invalidatedUserIDs)
	assert.Equal(t, common.RedemptionCodeStatusUsed, observedCodeStatus)
	assert.Equal(t, int64(1), observedSubscriptions)

	_, err = RedeemCode(user.Id, invalidCode.Key)
	require.Error(t, err)
	assert.Equal(t, []int{user.Id}, invalidatedUserIDs, "rolled-back delivery must not run cache effects")
	var storedInvalidCode model.Redemption
	require.NoError(t, model.DB.First(&storedInvalidCode, invalidCode.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, storedInvalidCode.Status)
}

func TestRedeemCodeSubscriptionRejectsInvalidStatesUniformly(t *testing.T) {
	tests := []struct {
		name        string
		status      int
		expiresAt   func() int64
		snapshotRaw func(t *testing.T) string
		mutate      func(t *testing.T, order *model.AgentPurchaseOrder, code *model.Redemption)
	}{
		{name: "used", status: common.RedemptionCodeStatusUsed},
		{name: "refunded", status: common.RedemptionCodeStatusRefunded},
		{name: "expired in past", status: common.RedemptionCodeStatusEnabled, expiresAt: func() int64 { return common.GetTimestamp() - 1 }},
		{name: "expires now", status: common.RedemptionCodeStatusEnabled, expiresAt: common.GetTimestamp},
		{name: "zero expiry", status: common.RedemptionCodeStatusEnabled, expiresAt: func() int64 { return 0 }},
		{name: "malformed snapshot", status: common.RedemptionCodeStatusEnabled, snapshotRaw: func(t *testing.T) string { return "{" }},
		{name: "invalid UTF-8 snapshot", status: common.RedemptionCodeStatusEnabled, snapshotRaw: func(t *testing.T) string {
			raw := append([]byte(`{"version":1,"plan_id":9001,"plan_title":"`), 0xff)
			raw = append(raw, []byte(`","duration_unit":"custom","custom_seconds":3600,"quota_reset_period":"never"}`)...)
			return string(raw)
		}},
		{name: "unknown snapshot version", status: common.RedemptionCodeStatusEnabled, snapshotRaw: func(t *testing.T) string {
			return `{"version":2,"plan_id":9001,"plan_title":"Sold Snapshot Pro","duration_unit":"custom","custom_seconds":3600,"quota_reset_period":"never"}`
		}},
		{name: "missing order", status: common.RedemptionCodeStatusEnabled, mutate: func(t *testing.T, order *model.AgentPurchaseOrder, code *model.Redemption) {
			require.NoError(t, model.DB.Delete(order).Error)
		}},
		{name: "snapshot plan mismatch", status: common.RedemptionCodeStatusEnabled, mutate: func(t *testing.T, order *model.AgentPurchaseOrder, code *model.Redemption) {
			order.PlanId = 9002
			require.NoError(t, model.DB.Model(order).Update("plan_id", order.PlanId).Error)
		}},
		{name: "refunded order", status: common.RedemptionCodeStatusEnabled, mutate: func(t *testing.T, order *model.AgentPurchaseOrder, code *model.Redemption) {
			order.Status = model.AgentPurchaseOrderStatusRefunded
			require.NoError(t, model.DB.Model(order).Update("status", order.Status).Error)
		}},
	}

	for index, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupRedemptionServiceTest(t)
			user := createRedemptionUser(t, 7100+index, "starter")
			raw, err := model.EncodeSubscriptionEntitlementSnapshot(validRedemptionSnapshot(9001))
			require.NoError(t, err)
			if tt.snapshotRaw != nil {
				raw = tt.snapshotRaw(t)
			}
			expiresAt := common.GetTimestamp() + 3600
			if tt.expiresAt != nil {
				expiresAt = tt.expiresAt()
			}
			key := fmt.Sprintf("43%030d", index+1)
			order, code := createSubscriptionRedemption(t, key, raw, tt.status, expiresAt)
			if tt.mutate != nil {
				tt.mutate(t, &order, &code)
			}

			_, err = RedeemCode(user.Id, code.Key)
			require.Error(t, err)
			assert.ErrorIs(t, err, ErrRedeemCodeFailed)

			var storedCode model.Redemption
			require.NoError(t, model.DB.First(&storedCode, code.Id).Error)
			assert.Equal(t, tt.status, storedCode.Status)
			assert.Zero(t, storedCode.UsedUserId)
			var subscriptionCount int64
			require.NoError(t, model.DB.Model(&model.UserSubscription{}).Count(&subscriptionCount).Error)
			assert.Zero(t, subscriptionCount)
			var logCount int64
			require.NoError(t, model.DB.Model(&model.Log{}).Count(&logCount).Error)
			assert.Zero(t, logCount)
		})
	}
}

func TestRedeemCodeSubscriptionRollsBackCodeWhenDeliveryFails(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7201, "starter")
	snapshot := validRedemptionSnapshot(9001)
	snapshot.MaxPurchasePerUser = 1
	raw, err := model.EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)
	_, code := createSubscriptionRedemption(t, "44000000000000000000000000000001", raw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)

	existing := model.UserSubscription{
		UserId: user.Id, PlanId: snapshot.PlanId, AmountTotal: 100, StartTime: common.GetTimestamp(),
		EndTime: common.GetTimestamp() + 3600, Status: "active", Source: "order",
	}
	require.NoError(t, model.DB.Create(&existing).Error)

	_, err = RedeemCode(user.Id, code.Key)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRedeemCodeFailed)

	var storedCode model.Redemption
	require.NoError(t, model.DB.First(&storedCode, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, storedCode.Status)
	assert.Zero(t, storedCode.UsedUserId)
	var subscriptions int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptions).Error)
	assert.Equal(t, int64(1), subscriptions)
	var logs int64
	require.NoError(t, model.DB.Model(&model.Log{}).Count(&logs).Error)
	assert.Zero(t, logs)
}

func TestRedeemCodeSubscriptionConcurrentSingleSuccess(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7301, "starter")
	raw, err := model.EncodeSubscriptionEntitlementSnapshot(validRedemptionSnapshot(9001))
	require.NoError(t, err)
	_, code := createSubscriptionRedemption(t, "45000000000000000000000000000001", raw, common.RedemptionCodeStatusEnabled, time.Now().Unix()+3600)

	const goroutines = 5
	errs := make([]error, goroutines)
	results := make([]*RedemptionResult, goroutines)
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for index := 0; index < goroutines; index++ {
		go func(index int) {
			defer wg.Done()
			results[index], errs[index] = RedeemCode(user.Id, code.Key)
		}(index)
	}
	wg.Wait()

	successes := 0
	for index := range errs {
		if errs[index] == nil {
			successes++
			require.NotNil(t, results[index])
			assert.Equal(t, RedemptionResultTypeSubscription, results[index].Type)
			continue
		}
		assert.True(t, errors.Is(errs[index], ErrRedeemCodeFailed))
	}
	assert.Equal(t, 1, successes)

	var subscriptionCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptionCount).Error)
	assert.Equal(t, int64(1), subscriptionCount)
	var storedCode model.Redemption
	require.NoError(t, model.DB.First(&storedCode, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, storedCode.Status)
	assert.Equal(t, user.Id, storedCode.UsedUserId)
	var logCount int64
	require.NoError(t, model.DB.Model(&model.Log{}).Where("user_id = ?", user.Id).Count(&logCount).Error)
	assert.Equal(t, int64(1), logCount)
}

func TestRedeemCodeConcurrentDifferentCodesRespectSnapshotPurchaseLimit(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7401, "starter")
	snapshot := validRedemptionSnapshot(9001)
	snapshot.MaxPurchasePerUser = 1
	raw, err := model.EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)
	_, firstCode := createSubscriptionRedemption(t, "46000000000000000000000000000001", raw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)
	_, secondCode := createSubscriptionRedemption(t, "46000000000000000000000000000002", raw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)
	codes := []model.Redemption{firstCode, secondCode}

	results := make([]*RedemptionResult, len(codes))
	errs := make([]error, len(codes))
	start := make(chan struct{})
	var ready sync.WaitGroup
	var done sync.WaitGroup
	ready.Add(len(codes))
	done.Add(len(codes))
	for index := range codes {
		go func(index int) {
			defer done.Done()
			ready.Done()
			<-start
			results[index], errs[index] = RedeemCode(user.Id, codes[index].Key)
		}(index)
	}
	ready.Wait()
	close(start)
	done.Wait()

	successes := 0
	for index, redeemErr := range errs {
		var stored model.Redemption
		require.NoError(t, model.DB.First(&stored, codes[index].Id).Error)
		if redeemErr == nil {
			successes++
			require.NotNil(t, results[index])
			assert.Equal(t, common.RedemptionCodeStatusUsed, stored.Status)
			continue
		}
		assert.ErrorIs(t, redeemErr, ErrRedeemCodeFailed)
		assert.Equal(t, common.RedemptionCodeStatusEnabled, stored.Status)
		assert.Zero(t, stored.UsedUserId)
	}
	assert.Equal(t, 1, successes)
	var subscriptions int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", user.Id).Count(&subscriptions).Error)
	assert.Equal(t, int64(1), subscriptions)
	var logs int64
	require.NoError(t, model.DB.Model(&model.Log{}).Where("user_id = ?", user.Id).Count(&logs).Error)
	assert.Equal(t, int64(1), logs)
}

func TestRedeemCodeConcurrentGroupUpgradesFollowASerialOrder(t *testing.T) {
	setupRedemptionServiceTest(t)
	user := createRedemptionUser(t, 7501, "starter")
	firstSnapshot := validRedemptionSnapshot(9001)
	firstSnapshot.UpgradeGroup = "pro"
	secondSnapshot := validRedemptionSnapshot(9001)
	secondSnapshot.UpgradeGroup = "enterprise"
	firstRaw, err := model.EncodeSubscriptionEntitlementSnapshot(firstSnapshot)
	require.NoError(t, err)
	secondRaw, err := model.EncodeSubscriptionEntitlementSnapshot(secondSnapshot)
	require.NoError(t, err)
	_, firstCode := createSubscriptionRedemption(t, "47000000000000000000000000000001", firstRaw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)
	_, secondCode := createSubscriptionRedemption(t, "47000000000000000000000000000002", secondRaw, common.RedemptionCodeStatusEnabled, common.GetTimestamp()+3600)
	codes := []model.Redemption{firstCode, secondCode}

	errs := make([]error, len(codes))
	start := make(chan struct{})
	var ready sync.WaitGroup
	var done sync.WaitGroup
	ready.Add(len(codes))
	done.Add(len(codes))
	for index := range codes {
		go func(index int) {
			defer done.Done()
			ready.Done()
			<-start
			_, errs[index] = RedeemCode(user.Id, codes[index].Key)
		}(index)
	}
	ready.Wait()
	close(start)
	done.Wait()
	for _, redeemErr := range errs {
		require.NoError(t, redeemErr)
	}

	var subscriptions []model.UserSubscription
	require.NoError(t, model.DB.Where("user_id = ?", user.Id).Order("id ASC").Find(&subscriptions).Error)
	require.Len(t, subscriptions, 2)
	byUpgradeGroup := make(map[string]model.UserSubscription, len(subscriptions))
	for _, subscription := range subscriptions {
		byUpgradeGroup[subscription.UpgradeGroup] = subscription
	}
	pro, hasPro := byUpgradeGroup["pro"]
	enterprise, hasEnterprise := byUpgradeGroup["enterprise"]
	require.True(t, hasPro)
	require.True(t, hasEnterprise)

	var reloadedUser model.User
	require.NoError(t, model.DB.First(&reloadedUser, user.Id).Error)
	switch {
	case pro.PrevUserGroup == "starter":
		assert.Equal(t, "pro", enterprise.PrevUserGroup)
		assert.Equal(t, "enterprise", reloadedUser.Group)
	case enterprise.PrevUserGroup == "starter":
		assert.Equal(t, "enterprise", pro.PrevUserGroup)
		assert.Equal(t, "pro", reloadedUser.Group)
	default:
		t.Fatalf("neither subscription observed the initial group: pro=%q enterprise=%q", pro.PrevUserGroup, enterprise.PrevUserGroup)
	}
	assert.False(t, pro.PrevUserGroup == "starter" && enterprise.PrevUserGroup == "starter")
	var logs int64
	require.NoError(t, model.DB.Model(&model.Log{}).Where("user_id = ?", user.Id).Count(&logs).Error)
	assert.Equal(t, int64(2), logs)
}
