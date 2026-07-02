package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ============================================================
// Test helpers
// ============================================================

func openSubControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dsn := os.Getenv("TEST_SQL_DSN")
	if dsn == "" {
		t.Fatal("TEST_SQL_DSN is required for subscription controller tests; local SQLite fallback is disabled in this workspace")
	}
	common.IsMasterNode = false
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, os.Setenv("SQL_DSN", dsn))

	require.NoError(t, model.InitDB())
	db := model.DB

	err := db.AutoMigrate(&model.User{}, &model.UserSubscription{}, &model.SubscriptionPlan{})
	require.NoError(t, err)
	cleanSubControllerTestDB(db)

	t.Cleanup(func() {
		cleanSubControllerTestDB(db)
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	})
	return db
}

func cleanSubControllerTestDB(db *gorm.DB) {
	db.Exec("DELETE FROM user_subscriptions")
	db.Exec("DELETE FROM subscription_plans")
	db.Exec("DELETE FROM users")
}

type subAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func newAuthContext(t *testing.T, method, path string, body any, userId int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = common.Marshal(body)
		require.NoError(t, err)
	}
	ctx.Request = httptest.NewRequest(method, path, nil)
	if bodyBytes != nil {
		ctx.Request.Body = nil // httptest requests need body set differently
	}
	// Set request body manually for gin binding
	ctx.Request = httptest.NewRequest(method, path, nil)
	if body != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
		b, _ := common.Marshal(body)
		ctx.Request.Body = nil
		ctx.Request = httptest.NewRequest(method, path, bytesToReader(b))
		ctx.Request.Header.Set("Content-Type", "application/json")
	}

	ctx.Set("id", userId)
	return ctx, recorder
}

func bytesToReader(b []byte) *bytesReadCloser {
	return &bytesReadCloser{bytes: b}
}

type bytesReadCloser struct {
	bytes []byte
	pos   int
}

func (b *bytesReadCloser) Read(p []byte) (n int, err error) {
	if b.pos >= len(b.bytes) {
		return 0, nil
	}
	n = copy(p, b.bytes[b.pos:])
	b.pos += n
	return n, nil
}

func (b *bytesReadCloser) Close() error { return nil }

func decodeResponse(t *testing.T, recorder *httptest.ResponseRecorder) subAPIResponse {
	t.Helper()
	var resp subAPIResponse
	err := json.Unmarshal(recorder.Body.Bytes(), &resp)
	require.NoError(t, err)
	return resp
}

func createTestUserInDB(t *testing.T, db *gorm.DB) int {
	t.Helper()
	user := &model.User{
		Username: "test_user_" + common.GetRandomString(6),
		Password: "test_pass",
		Group:    "default",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		AffCode:  common.GetRandomString(8),
	}
	require.NoError(t, db.Create(user).Error)
	db.Model(user).Update("base_level", "default")
	return user.Id
}

func createTestPlanInDB(t *testing.T, db *gorm.DB, title string, activationMode string, totalAmount int64) int {
	t.Helper()
	plan := &model.SubscriptionPlan{
		Title:                   title,
		DurationUnit:            model.SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             totalAmount,
		ActivationMode:          activationMode,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, db.Create(plan).Error)
	return plan.Id
}

// ============================================================
// T_CTRL_01: UpdateSubscriptionPriority
// ============================================================
func TestUpdateSubscriptionPriority(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub1 := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Priority: 0,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	sub2 := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Priority: 0,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub1).Error)
	require.NoError(t, db.Create(sub2).Error)

	ctx, recorder := newAuthContext(t, http.MethodPut, "/api/subscription/self/priority",
		map[string]any{"subscription_ids": []int{sub1.Id, sub2.Id}}, userId)

	UpdateSubscriptionPriority(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	// Verify priorities were set
	var updated1, updated2 model.UserSubscription
	db.First(&updated1, sub1.Id)
	db.First(&updated2, sub2.Id)
	assert.Equal(t, 2, updated1.Priority)
	assert.Equal(t, 1, updated2.Priority)
}

// ============================================================
// T_CTRL_02: ToggleSubscriptionDisabled
// ============================================================
func TestToggleSubscriptionDisabled(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Disabled: false,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	ctx, recorder := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/toggle/%d", sub.Id),
		map[string]any{"disabled": true}, userId)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}

	ToggleSubscriptionDisabled(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var updated model.UserSubscription
	db.First(&updated, sub.Id)
	assert.True(t, updated.Disabled)

	// Toggle back
	ctx2, recorder2 := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/toggle/%d", sub.Id),
		map[string]any{"disabled": false}, userId)
	ctx2.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}
	ToggleSubscriptionDisabled(ctx2)
	resp2 := decodeResponse(t, recorder2)
	assert.True(t, resp2.Success)

	db.First(&updated, sub.Id)
	assert.False(t, updated.Disabled)
}

// ============================================================
// T_CTRL_03: ToggleSubscriptionDisabled - wrong user rejected
// ============================================================
func TestToggleSubscriptionDisabled_WrongUser(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	otherId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active",
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	// Other user tries to toggle
	ctx, recorder := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/toggle/%d", sub.Id),
		map[string]any{"disabled": true}, otherId)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}

	ToggleSubscriptionDisabled(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "无权限")
}

// ============================================================
// T_CTRL_04: GetSubscriptionSelf returns progress info
// ============================================================
func TestGetSubscriptionSelf_ReturnsProgress(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId,
		AmountTotal: 100000, AmountUsed: 30000,
		StartTime: now - 3600, EndTime: now + 86400*30,
		Status: "active", Priority: 0,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	ctx, recorder := newAuthContext(t, http.MethodGet, "/api/subscription/self", nil, userId)
	GetSubscriptionSelf(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var data struct {
		BillingPreference   string            `json:"billing_preference"`
		Subscriptions       []json.RawMessage `json:"subscriptions"`
		UsableSubscriptions []json.RawMessage `json:"usable_subscriptions"`
	}
	err := json.Unmarshal(resp.Data, &data)
	require.NoError(t, err)
	assert.Equal(t, "subscription_first", data.BillingPreference)
	assert.Len(t, data.Subscriptions, 1)
	assert.Len(t, data.UsableSubscriptions, 1)
}

// ============================================================
// T_CTRL_05: GetSubscriptionSelf includes pending_activation in usable_subscriptions
// ============================================================
func TestGetSubscriptionSelf_IncludesPendingInUsable(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)

	// Create active sub
	planId1 := createTestPlanInDB(t, db, "额度套餐", model.SubscriptionActivationImmediate, 100000)
	now := common.GetTimestamp()
	activeSub := &model.UserSubscription{
		UserId: userId, PlanId: planId1, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Source: "order",
		CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(activeSub).Error)

	// Create pending sub
	planId2 := createTestPlanInDB(t, db, "5小时套餐", model.SubscriptionActivationOnFirstUse, 50000)
	pendingSub := &model.UserSubscription{
		UserId: userId, PlanId: planId2, AmountTotal: 50000,
		StartTime: now, EndTime: 0,
		Status: model.UserSubscriptionStatusPendingActivation,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(pendingSub).Error)

	ctx, recorder := newAuthContext(t, http.MethodGet, "/api/subscription/self", nil, userId)
	GetSubscriptionSelf(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var data struct {
		Subscriptions       []json.RawMessage `json:"subscriptions"`
		UsableSubscriptions []json.RawMessage `json:"usable_subscriptions"`
	}
	err := json.Unmarshal(resp.Data, &data)
	require.NoError(t, err)
	// Active list: only active (not pending)
	assert.Len(t, data.Subscriptions, 1)
	// Usable list: active + pending
	assert.Len(t, data.UsableSubscriptions, 2)
}

// ============================================================
// T_CTRL_06: UpdateSubscriptionPreference
// ============================================================
func TestUpdateSubscriptionPreference(t *testing.T) {
	openSubControllerTestDB(t)
	userId := createTestUserInDB(t, model.DB)

	ctx, recorder := newAuthContext(t, http.MethodPut, "/api/subscription/self/preference",
		map[string]string{"billing_preference": "wallet_only"}, userId)

	UpdateSubscriptionPreference(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)
}

// ============================================================
// T_CTRL_07: UserCancelSubscription on pending_activation
// ============================================================
func TestUserCancelSubscription_PendingActivation(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "5小时套餐", model.SubscriptionActivationOnFirstUse, 50000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 50000,
		StartTime: now, EndTime: 0,
		Status: model.UserSubscriptionStatusPendingActivation,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	ctx, recorder := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/cancel/%d", sub.Id), nil, userId)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}

	UserCancelSubscription(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var updated model.UserSubscription
	db.First(&updated, sub.Id)
	assert.Equal(t, model.UserSubscriptionStatusCancelled, updated.Status)
}

// ============================================================
// T_CTRL_08: GetSubscriptionSelf with no subscriptions
// ============================================================
func TestGetSubscriptionSelf_Empty(t *testing.T) {
	openSubControllerTestDB(t)
	userId := createTestUserInDB(t, model.DB)

	ctx, recorder := newAuthContext(t, http.MethodGet, "/api/subscription/self", nil, userId)
	GetSubscriptionSelf(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var data struct {
		Subscriptions       []json.RawMessage `json:"subscriptions"`
		UsableSubscriptions []json.RawMessage `json:"usable_subscriptions"`
		AllSubscriptions    []json.RawMessage `json:"all_subscriptions"`
	}
	err := json.Unmarshal(resp.Data, &data)
	require.NoError(t, err)
	assert.Len(t, data.Subscriptions, 0)
	assert.Len(t, data.UsableSubscriptions, 0)
	assert.Len(t, data.AllSubscriptions, 0)
}

// ============================================================
// T_CTRL_09: UpdateSubscriptionPriority with empty list
// ============================================================
func TestUpdateSubscriptionPriority_EmptyList(t *testing.T) {
	openSubControllerTestDB(t)
	userId := createTestUserInDB(t, model.DB)

	ctx, recorder := newAuthContext(t, http.MethodPut, "/api/subscription/self/priority",
		map[string]any{"subscription_ids": []int{}}, userId)

	UpdateSubscriptionPriority(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)
}

// ============================================================
// T_CTRL_10: ToggleSubscriptionDisabled with invalid ID
// ============================================================
func TestToggleSubscriptionDisabled_InvalidID(t *testing.T) {
	openSubControllerTestDB(t)
	userId := createTestUserInDB(t, model.DB)

	ctx, recorder := newAuthContext(t, http.MethodPost, "/api/subscription/self/toggle/99999",
		map[string]any{"disabled": true}, userId)
	ctx.Params = gin.Params{{Key: "id", Value: "99999"}}

	ToggleSubscriptionDisabled(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
}

// ============================================================
// T_CTRL_11: ToggleSubscriptionDisabled rejects non-expired active
// ============================================================
func TestToggleSubscriptionDisabled_ActiveCanBeDisabled(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Disabled: false,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	ctx, recorder := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/toggle/%d", sub.Id),
		map[string]any{"disabled": true}, userId)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}

	ToggleSubscriptionDisabled(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)
}

// ============================================================
// T_CTRL_12: UserCancelSubscription on already cancelled returns error
// ============================================================
func TestUserCancelSubscription_AlreadyCancelled(t *testing.T) {
	db := openSubControllerTestDB(t)
	userId := createTestUserInDB(t, db)
	planId := createTestPlanInDB(t, db, "测试套餐", model.SubscriptionActivationImmediate, 100000)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId: userId, PlanId: planId, AmountTotal: 100000,
		StartTime: now, EndTime: 0,
		Status: model.UserSubscriptionStatusCancelled,
		Source: "order", CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, db.Create(sub).Error)

	ctx, recorder := newAuthContext(t, http.MethodPost, fmt.Sprintf("/api/subscription/self/cancel/%d", sub.Id),
		nil, userId)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", sub.Id)}}

	UserCancelSubscription(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
}

func TestAdminCreateSubscriptionPlan_AllowsWindowDifferentFromTotal(t *testing.T) {
	db := openSubControllerTestDB(t)

	ctx, recorder := newAuthContext(t, http.MethodPost, "/api/subscription/admin/plans", AdminUpsertSubscriptionPlanRequest{
		Plan: model.SubscriptionPlan{
			Title:          "无窗口包月套餐",
			PriceAmount:    9.9,
			DurationUnit:   model.SubscriptionDurationMonth,
			DurationValue:  1,
			TotalAmount:    100000,
			WindowLimit5h:  0,
			WindowLimit24h: 24000,
			WindowLimit7d:  0,
			WindowLimit30d: 0,
			Enabled:        true,
		},
	}, 1)

	AdminCreateSubscriptionPlan(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var plan model.SubscriptionPlan
	require.NoError(t, db.Where("title = ?", "无窗口包月套餐").First(&plan).Error)
	assert.Equal(t, int64(100000), plan.TotalAmount)
	assert.Equal(t, int64(24000), plan.WindowLimit24h)
	assert.Equal(t, int64(0), plan.WindowLimit30d)
}

func TestAdminUpdateSubscriptionPlan_UpdatesWindowLimit24h(t *testing.T) {
	db := openSubControllerTestDB(t)

	plan := &model.SubscriptionPlan{
		Title:         "24h更新前",
		PriceAmount:   9.9,
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   100000,
		Enabled:       true,
	}
	require.NoError(t, db.Create(plan).Error)

	ctx, recorder := newAuthContext(t, http.MethodPut, fmt.Sprintf("/api/subscription/admin/plans/%d", plan.Id), AdminUpsertSubscriptionPlanRequest{
		Plan: model.SubscriptionPlan{
			Title:          "24h更新后",
			PriceAmount:    19.9,
			DurationUnit:   model.SubscriptionDurationMonth,
			DurationValue:  1,
			TotalAmount:    200000,
			WindowLimit24h: 24000,
			Enabled:        true,
		},
	}, 1)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", plan.Id)}}

	AdminUpdateSubscriptionPlan(ctx)
	resp := decodeResponse(t, recorder)
	assert.True(t, resp.Success)

	var updated model.SubscriptionPlan
	require.NoError(t, db.First(&updated, plan.Id).Error)
	assert.Equal(t, int64(24000), updated.WindowLimit24h)
	assert.Equal(t, int64(0), updated.WindowLimit5h)
}

func TestAdminCreateSubscriptionPlan_RejectsNegativeWindowLimit(t *testing.T) {
	openSubControllerTestDB(t)

	ctx, recorder := newAuthContext(t, http.MethodPost, "/api/subscription/admin/plans", AdminUpsertSubscriptionPlanRequest{
		Plan: model.SubscriptionPlan{
			Title:          "负数窗口套餐",
			PriceAmount:    9.9,
			DurationUnit:   model.SubscriptionDurationMonth,
			DurationValue:  1,
			TotalAmount:    100000,
			WindowLimit24h: -1,
			WindowLimit7d:  0,
			WindowLimit30d: 0,
			Enabled:        true,
		},
	}, 1)

	AdminCreateSubscriptionPlan(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "窗口额度不能为负数")
}

func TestAdminCreateSubscriptionPlan_RejectsInvalidDurationUnit(t *testing.T) {
	openSubControllerTestDB(t)

	ctx, recorder := newAuthContext(t, http.MethodPost, "/api/subscription/admin/plans", AdminUpsertSubscriptionPlanRequest{
		Plan: model.SubscriptionPlan{
			Title:         "非法周期套餐",
			PriceAmount:   9.9,
			DurationUnit:  "fortnight",
			DurationValue: 1,
			TotalAmount:   100000,
			Enabled:       true,
		},
	}, 1)

	AdminCreateSubscriptionPlan(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "无效的套餐时长单位")
}

func TestAdminCreateSubscriptionPlan_RejectsInvalidCustomDuration(t *testing.T) {
	openSubControllerTestDB(t)

	ctx, recorder := newAuthContext(t, http.MethodPost, "/api/subscription/admin/plans", AdminUpsertSubscriptionPlanRequest{
		Plan: model.SubscriptionPlan{
			Title:         "非法自定义时长套餐",
			PriceAmount:   9.9,
			DurationUnit:  model.SubscriptionDurationCustom,
			CustomSeconds: 0,
			TotalAmount:   100000,
			Enabled:       true,
		},
	}, 1)

	AdminCreateSubscriptionPlan(ctx)
	resp := decodeResponse(t, recorder)
	assert.False(t, resp.Success)
	assert.Contains(t, resp.Message, "自定义套餐时长需大于0秒")
}
