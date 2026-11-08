package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminRestoreUserSubscriptionQuotaRequiresAdminAndIsIdempotent(t *testing.T) {
	db := setupManageUserTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}, &model.SubscriptionQuotaOperation{}))
	now := time.Now().Unix()
	admin := &model.User{
		Username: "quota-restore-admin", Password: "unused", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "quota-restore-admin",
	}
	user := &model.User{
		Username: "quota-restore-user", Password: "unused", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "quota-restore-user",
	}
	require.NoError(t, db.Create(admin).Error)
	require.NoError(t, db.Create(user).Error)
	plan := &model.SubscriptionPlan{
		Title: "Rolling", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1,
		TotalAmount: 1000, WindowAmount: 300, QuotaModelVersion: 1,
		QuotaResetPeriod: model.SubscriptionResetWeekly,
	}
	require.NoError(t, db.Create(plan).Error)
	sub := &model.UserSubscription{
		UserId: user.Id, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500,
		TotalAmountUsed: 500, WindowAmount: 300, WindowAmountUsed: 150,
		HistoricalAmountUsed: 900, QuotaModelVersion: 1,
		QuotaResetPeriod: model.SubscriptionResetWeekly, StartTime: now - 3600,
		EndTime: now + 3600, Status: "active",
	}
	require.NoError(t, db.Create(sub).Error)

	adminSession, err := service.CreateLoginSession(admin.Id, "password", "127.0.0.1", "quota-restore-test")
	require.NoError(t, err)
	userSession, err := service.CreateLoginSession(user.Id, "password", "127.0.0.1", "quota-restore-test")
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/subscription/admin/users/:id/subscriptions/:subscription_id/quota/restore", middleware.AdminAuth(), AdminRestoreUserSubscriptionQuota)
	request := func(token, sid, body string) *httptest.ResponseRecorder {
		t.Helper()
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/subscription/admin/users/%d/subscriptions/%d/quota/restore", user.Id, sub.Id), strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("X-Auth-Session", sid)
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(recorder, req)
		return recorder
	}

	body := `{"action":"restore_window","idempotency_key":"admin-window-restore-01","reason":"customer support request"}`
	denied := request(userSession.AccessToken, userSession.Session.SID, body)
	assert.Equal(t, http.StatusForbidden, denied.Code)

	first := request(adminSession.AccessToken, adminSession.Session.SID, body)
	assert.Equal(t, http.StatusOK, first.Code)
	assert.Contains(t, first.Body.String(), `"returned_quota":300`)
	assert.Contains(t, first.Body.String(), `"total_remaining":800`)
	assert.Contains(t, first.Body.String(), `"window_remaining":300`)
	second := request(adminSession.AccessToken, adminSession.Session.SID, body)
	assert.Equal(t, http.StatusOK, second.Code)
	assert.JSONEq(t, first.Body.String(), second.Body.String())

	updated := model.UserSubscription{}
	require.NoError(t, db.First(&updated, sub.Id).Error)
	assert.EqualValues(t, 200, updated.TotalAmountUsed)
	assert.EqualValues(t, 900, updated.HistoricalAmountUsed)

	var operations []model.SubscriptionQuotaOperation
	require.NoError(t, db.Find(&operations).Error)
	require.Len(t, operations, 1)
	assert.Equal(t, admin.Id, operations[0].AdminId)
	assert.Equal(t, "customer support request", operations[0].Reason)
	assert.Greater(t, operations[0].CreatedAt, int64(0))
}

func TestSubscriptionPurchasesRejectUnconfirmedPlanVersion(t *testing.T) {
	db := setupManageUserTestDB(t)
	confirmPaymentComplianceForTest(t)
	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}, &model.SubscriptionPlanVersion{}, &model.SubscriptionOrder{}, &model.UserSubscription{}))
	plan := model.SubscriptionPlan{Title: "confirmed terms", Enabled: true, PriceAmount: 10, DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 400, WindowAmount: 100, QuotaModelVersion: 1}
	require.NoError(t, db.Create(&plan).Error)
	version, err := model.GetOrCreateCurrentSubscriptionPlanVersion(plan.Id)
	require.NoError(t, err)
	require.NoError(t, db.Model(&plan).Updates(map[string]any{"title": "new terms", "price_amount": 20}).Error)
	user := model.User{Username: "version-confirm", Password: "unused", Quota: 10_000_000, AffCode: "version-confirm"}
	require.NoError(t, db.Create(&user).Error)
	for _, handler := range []struct {
		name string
		fn   gin.HandlerFunc
	}{
		{"balance", SubscriptionRequestBalancePay}, {"stripe", SubscriptionRequestStripePay},
		{"creem", SubscriptionRequestCreemPay}, {"epay", SubscriptionRequestEpay},
		{"waffo", SubscriptionRequestWaffoPancakePay},
	} {
		t.Run(handler.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", user.Id)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/purchase", strings.NewReader(fmt.Sprintf(`{"plan_id":%d,"expected_plan_version_id":%d}`, plan.Id, version.Id)))
			ctx.Request.Header.Set("Content-Type", "application/json")
			handler.fn(ctx)
			assert.Contains(t, recorder.Body.String(), "Subscription plan has changed")
			var orders int64
			require.NoError(t, db.Model(&model.SubscriptionOrder{}).Count(&orders).Error)
			assert.Zero(t, orders)
			var unchanged model.User
			require.NoError(t, db.First(&unchanged, user.Id).Error)
			assert.Equal(t, user.Quota, unchanged.Quota)
		})
	}
	// Both listing APIs expose terms belonging to the accompanying version ID.
	for _, handler := range []gin.HandlerFunc{GetSubscriptionPlans, AdminListSubscriptionPlans} {
		recorder := httptest.NewRecorder()
		ctx, _ := gin.CreateTestContext(recorder)
		ctx.Request = httptest.NewRequest(http.MethodGet, "/plans", nil)
		handler(ctx)
		var response struct {
			Data []SubscriptionPlanDTO `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.Len(t, response.Data, 1)
		current, err := model.GetSubscriptionPlanVersionById(response.Data[0].PlanVersionId)
		require.NoError(t, err)
		terms, err := current.PlanTerms()
		require.NoError(t, err)
		assert.Equal(t, terms.Title, response.Data[0].Plan.Title)
		assert.Equal(t, terms.PriceAmount, response.Data[0].Plan.PriceAmount)
	}
}
