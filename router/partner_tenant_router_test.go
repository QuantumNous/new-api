package router

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPartnerTenantSubscriptionQuotaRequiresServerSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	engine := gin.New()
	SetPartnerOAuthRouter(engine)

	req := httptest.NewRequest(http.MethodGet, "/api/partner/v1/accounts/customer-7/subscription/quota", nil)
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
	require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
}

func TestPartnerTenantAccountProvisioningRequiresServerSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	engine := gin.New()
	SetPartnerOAuthRouter(engine)

	req := httptest.NewRequest(http.MethodPut, "/api/partner/v1/accounts", strings.NewReader(`{"external_user_id":"customer-7"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
}

func TestPartnerTenantPlanCatalogRequiresServerSecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	engine := gin.New()
	SetPartnerOAuthRouter(engine)

	req := httptest.NewRequest(http.MethodGet, "/api/partner/v1/plans", nil)
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
}

func TestPartnerTenantAccountIsolationAndFixedGroupCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Token{}, &model.PartnerTenant{}, &model.PartnerTenantAccount{},
		&model.PartnerTenantSubscriptionGrant{}, &model.SubscriptionPlan{}, &model.UserSubscription{},
	))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})

	engine := gin.New()
	SetPartnerOAuthRouter(engine)
	tenantA, secretA, err := model.CreatePartnerTenant("Partner A", "partner-a")
	require.NoError(t, err)
	tenantB, secretB, err := model.CreatePartnerTenant("Partner B", "partner-b")
	require.NoError(t, err)

	createReq := httptest.NewRequest(http.MethodPut, "/api/partner/v1/accounts", bytes.NewBufferString(`{"external_user_id":"customer-7","display_name":"Customer 7"}`))
	createReq.Header.Set("Authorization", "Bearer "+secretA)
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Host = "localhost:3000"
	createRec := httptest.NewRecorder()
	engine.ServeHTTP(createRec, createReq)
	require.Equal(t, http.StatusCreated, createRec.Code, createRec.Body.String())
	var created struct {
		ExternalUserID string `json:"external_user_id"`
		APIKey         string `json:"api_key"`
	}
	require.NoError(t, json.Unmarshal(createRec.Body.Bytes(), &created))
	require.Equal(t, "customer-7", created.ExternalUserID)
	require.NotEmpty(t, created.APIKey)
	require.NotContains(t, createRec.Body.String(), `"user_id"`)

	var account model.PartnerTenantAccount
	require.NoError(t, db.Where("tenant_id = ? AND external_user_id = ?", tenantA.Id, "customer-7").First(&account).Error)
	var user model.User
	require.NoError(t, db.First(&user, account.UserId).Error)
	var token model.Token
	require.NoError(t, db.First(&token, account.TokenId).Error)
	require.Equal(t, "partner-a", user.Group)
	require.Zero(t, user.Quota)
	require.Equal(t, "partner-a", token.Group)
	require.False(t, token.CrossGroupRetry)
	require.Empty(t, token.AutoGroups)
	retryProvisionReq := httptest.NewRequest(http.MethodPut, "/api/partner/v1/accounts", bytes.NewBufferString(`{"external_user_id":"customer-7"}`))
	retryProvisionReq.Header.Set("Authorization", "Bearer "+secretA)
	retryProvisionReq.Header.Set("Content-Type", "application/json")
	retryProvisionReq.Host = "localhost:3000"
	retryProvisionRec := httptest.NewRecorder()
	engine.ServeHTTP(retryProvisionRec, retryProvisionReq)
	require.Equal(t, http.StatusOK, retryProvisionRec.Code, retryProvisionRec.Body.String())
	var retriedProvision struct {
		APIKey string `json:"api_key"`
	}
	require.NoError(t, json.Unmarshal(retryProvisionRec.Body.Bytes(), &retriedProvision))
	require.Equal(t, created.APIKey, retriedProvision.APIKey)
	var accountCount int64
	require.NoError(t, db.Model(&model.PartnerTenantAccount{}).Where("tenant_id = ?", tenantA.Id).Count(&accountCount).Error)
	require.EqualValues(t, 1, accountCount)

	otherTenantReq := httptest.NewRequest(http.MethodGet, "/api/partner/v1/accounts/customer-7/subscription/quota", nil)
	otherTenantReq.Header.Set("Authorization", "Bearer "+secretB)
	otherTenantReq.Host = "localhost:3000"
	otherTenantRec := httptest.NewRecorder()
	engine.ServeHTTP(otherTenantRec, otherTenantReq)
	require.Equal(t, http.StatusNotFound, otherTenantRec.Code, otherTenantRec.Body.String())
	require.Contains(t, otherTenantRec.Body.String(), "account_not_found")
	require.NotEqual(t, tenantA.Id, tenantB.Id)
}

func TestPartnerTenantProvisionAccountValidatesExternalIDCharacters(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousRedis, previousDB := common.RedisEnabled, model.DB
	common.RedisEnabled = false
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.PartnerTenant{}, &model.PartnerTenantAccount{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB, common.RedisEnabled = previousDB, previousRedis
		_ = sqlDB.Close()
	})
	_, secret, err := model.CreatePartnerTenant("Unicode Partner", "partner-unicode")
	require.NoError(t, err)
	engine := gin.New()
	SetPartnerTenantRouter(engine)
	for _, tc := range []struct {
		name, id string
		status   int
	}{
		{"43 Chinese characters", strings.Repeat("客", 43), http.StatusCreated},
		{"128 Chinese characters", strings.Repeat("客", 128), http.StatusCreated},
		{"128 emoji", strings.Repeat("😀", 128), http.StatusCreated},
		{"129 Chinese characters", strings.Repeat("客", 129), http.StatusBadRequest},
		{"129 ASCII characters", strings.Repeat("a", 129), http.StatusBadRequest},
		{"control character", "customer\x00id", http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body, err := json.Marshal(map[string]string{"external_user_id": tc.id})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPut, "/api/partner/v1/accounts", bytes.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+secret)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			engine.ServeHTTP(rec, req)
			require.Equal(t, tc.status, rec.Code, rec.Body.String())
			if tc.status == http.StatusBadRequest {
				require.Contains(t, rec.Body.String(), `"code":"invalid_request"`)
			} else {
				var provisioned struct {
					ExternalUserID string `json:"external_user_id"`
				}
				require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &provisioned))
				require.Equal(t, tc.id, provisioned.ExternalUserID)
			}
		})
	}
}

func TestPartnerTenantPlanCatalogOnlyReturnsItsOwnPlans(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.PartnerTenant{}, &model.PartnerTenantAccount{}, &model.SubscriptionPlan{}, &model.UserSubscription{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})
	if !db.Migrator().HasColumn("subscription_plans", "partner_tenant_id") {
		require.NoError(t, db.Exec("ALTER TABLE subscription_plans ADD COLUMN partner_tenant_id integer NOT NULL DEFAULT 0").Error)
	}
	tenantA, secretA, err := model.CreatePartnerTenant("Partner A", "partner-a")
	require.NoError(t, err)
	tenantB, _, err := model.CreatePartnerTenant("Partner B", "partner-b")
	require.NoError(t, err)
	for _, plan := range []struct {
		title    string
		tenantID int64
		group    string
	}{
		{title: "Partner A monthly", tenantID: tenantA.Id, group: "partner-a"},
		{title: "Partner B monthly", tenantID: tenantB.Id, group: "partner-b"},
		{title: "Global monthly", tenantID: 0, group: "default"},
	} {
		require.NoError(t, db.Exec(`INSERT INTO subscription_plans
			(title, price_amount, currency, duration_unit, duration_value, enabled, applicable_group, total_amount, quota_reset_period, partner_tenant_id)
			VALUES (?, 10, 'USD', 'month', 1, 1, ?, 500000, 'monthly', ?)`, plan.title, plan.group, plan.tenantID).Error)
	}

	engine := gin.New()
	SetPartnerOAuthRouter(engine)
	req := httptest.NewRequest(http.MethodGet, "/api/partner/v1/plans", nil)
	req.Header.Set("Authorization", "Bearer "+secretA)
	req.Host = "localhost:3000"
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var result struct {
		Plans []struct {
			Title string `json:"title"`
		} `json:"plans"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
	require.Len(t, result.Plans, 1)
	require.Equal(t, "Partner A monthly", result.Plans[0].Title)
}

func TestPartnerTenantSubscriptionGrantIsScopedAndIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.Token{}, &model.PartnerTenant{}, &model.PartnerTenantAccount{},
		&model.PartnerTenantSubscriptionGrant{}, &model.SubscriptionPlan{}, &model.UserSubscription{},
	))
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})
	engine := gin.New()
	SetPartnerOAuthRouter(engine)
	tenantA, secretA, err := model.CreatePartnerTenant("Partner A", "partner-a")
	require.NoError(t, err)
	tenantB, _, err := model.CreatePartnerTenant("Partner B", "partner-b")
	require.NoError(t, err)
	planA := model.SubscriptionPlan{
		PartnerTenantId: tenantA.Id, Title: "A monthly", PriceAmount: 10, Currency: "USD",
		DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true,
		ApplicableGroup: "partner-a", TotalAmount: 0, QuotaResetPeriod: model.SubscriptionResetMonthly,
		AllowBalancePay: common.GetPointer(false), AllowWalletOverflow: common.GetPointer(false),
	}
	planB := model.SubscriptionPlan{
		PartnerTenantId: tenantB.Id, Title: "B monthly", PriceAmount: 10, Currency: "USD",
		DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true,
		ApplicableGroup: "partner-b", TotalAmount: 900_000, QuotaResetPeriod: model.SubscriptionResetMonthly,
		AllowBalancePay: common.GetPointer(false), AllowWalletOverflow: common.GetPointer(false),
	}
	require.NoError(t, db.Create(&planA).Error)
	require.NoError(t, db.Create(&planB).Error)

	createReq := httptest.NewRequest(http.MethodPut, "/api/partner/v1/accounts", bytes.NewBufferString(`{"external_user_id":"customer-7"}`))
	createReq.Header.Set("Authorization", "Bearer "+secretA)
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Host = "localhost:3000"
	createRec := httptest.NewRecorder()
	engine.ServeHTTP(createRec, createReq)
	require.Equal(t, http.StatusCreated, createRec.Code, createRec.Body.String())
	var account model.PartnerTenantAccount
	require.NoError(t, db.Where("tenant_id = ? AND external_user_id = ?", tenantA.Id, "customer-7").First(&account).Error)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", account.UserId).Update("quota", 5_000_000).Error)
	require.Error(t, model.PurchaseSubscriptionWithBalance(account.UserId, planA.Id), "partner plans must never charge the New API wallet")
	var walletQuota int
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", account.UserId).Select("quota").Scan(&walletQuota).Error)
	require.Equal(t, 5_000_000, walletQuota)

	grantPath := "/api/partner/v1/accounts/customer-7/subscriptions"
	foreignPlanReq := httptest.NewRequest(http.MethodPost, grantPath, bytes.NewBufferString(`{"plan_id":`+strconv.Itoa(planB.Id)+`}`))
	foreignPlanReq.Header.Set("Authorization", "Bearer "+secretA)
	foreignPlanReq.Header.Set("Idempotency-Key", "foreign-plan-key-0001")
	foreignPlanReq.Header.Set("Content-Type", "application/json")
	foreignPlanReq.Host = "localhost:3000"
	foreignPlanRec := httptest.NewRecorder()
	engine.ServeHTTP(foreignPlanRec, foreignPlanReq)
	require.Equal(t, http.StatusNotFound, foreignPlanRec.Code, foreignPlanRec.Body.String())
	require.Contains(t, foreignPlanRec.Body.String(), "plan_not_found")

	grant := func() *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, grantPath, bytes.NewBufferString(`{"plan_id":`+strconv.Itoa(planA.Id)+`}`))
		req.Header.Set("Authorization", "Bearer "+secretA)
		req.Header.Set("Idempotency-Key", "monthly-payment-ref-0001")
		req.Header.Set("Content-Type", "application/json")
		req.Host = "localhost:3000"
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		return rec
	}
	first := grant()
	require.Equal(t, http.StatusCreated, first.Code, first.Body.String())
	require.Contains(t, first.Body.String(), `"quota_unlimited":true`)
	var firstGrant struct {
		SubscriptionID int `json:"subscription_id"`
		PlanID         int `json:"plan_id"`
	}
	require.NoError(t, json.Unmarshal(first.Body.Bytes(), &firstGrant))
	require.Equal(t, planA.Id, firstGrant.PlanID)
	require.Positive(t, firstGrant.SubscriptionID)

	replay := grant()
	require.Equal(t, http.StatusOK, replay.Code, replay.Body.String())
	var replayGrant struct {
		SubscriptionID int `json:"subscription_id"`
	}
	require.NoError(t, json.Unmarshal(replay.Body.Bytes(), &replayGrant))
	require.Equal(t, firstGrant.SubscriptionID, replayGrant.SubscriptionID)
	var subscriptions int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Count(&subscriptions).Error)
	require.EqualValues(t, 1, subscriptions)
	var beforeRenewal model.UserSubscription
	require.NoError(t, db.First(&beforeRenewal, firstGrant.SubscriptionID).Error)
	renewReq := httptest.NewRequest(http.MethodPost, grantPath, bytes.NewBufferString(`{"plan_id":`+strconv.Itoa(planA.Id)+`}`))
	renewReq.Header.Set("Authorization", "Bearer "+secretA)
	renewReq.Header.Set("Idempotency-Key", "monthly-renewal-ref-0001")
	renewReq.Header.Set("Content-Type", "application/json")
	renewReq.Host = "localhost:3000"
	renewRec := httptest.NewRecorder()
	engine.ServeHTTP(renewRec, renewReq)
	require.Equal(t, http.StatusOK, renewRec.Code, renewRec.Body.String())
	var renewed struct {
		SubscriptionID int   `json:"subscription_id"`
		EndTime        int64 `json:"end_time"`
	}
	require.NoError(t, json.Unmarshal(renewRec.Body.Bytes(), &renewed))
	require.Equal(t, firstGrant.SubscriptionID, renewed.SubscriptionID)
	require.GreaterOrEqual(t, renewed.EndTime, beforeRenewal.EndTime+27*24*60*60)
	require.NoError(t, db.Model(&model.UserSubscription{}).Count(&subscriptions).Error)
	require.EqualValues(t, 1, subscriptions)
	var provisionedAccount model.PartnerTenantAccount
	require.NoError(t, db.Where("tenant_id = ? AND external_user_id = ?", tenantA.Id, "customer-7").First(&provisionedAccount).Error)
	require.NoError(t, db.Create(&model.UserSubscription{
		UserId: provisionedAccount.UserId, PlanId: planB.Id, AmountTotal: planB.TotalAmount,
		StartTime: time.Now().Unix(), EndTime: time.Now().Add(time.Hour).Unix(), Status: "active",
	}).Error)

	quotaReq := httptest.NewRequest(http.MethodGet, "/api/partner/v1/accounts/customer-7/subscription/quota", nil)
	quotaReq.Header.Set("Authorization", "Bearer "+secretA)
	quotaReq.Host = "localhost:3000"
	quotaRec := httptest.NewRecorder()
	engine.ServeHTTP(quotaRec, quotaReq)
	require.Equal(t, http.StatusOK, quotaRec.Code, quotaRec.Body.String())
	require.Contains(t, quotaRec.Body.String(), "A monthly")
	require.Contains(t, quotaRec.Body.String(), `"quota_unlimited":true`)
	require.NotContains(t, quotaRec.Body.String(), "B monthly")
}

func TestPartnerTenantManagementRequiresRootAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = redisEnabled })
	engine := gin.New()
	SetApiRouter(engine)

	req := httptest.NewRequest(http.MethodPost, "/api/partner-tenants", nil)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code, rec.Body.String())
}
