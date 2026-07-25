package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionPlanControllerLifecycleTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalUsingMySQL := common.UsingMySQL

	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(5)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	require.NoError(t, model.DB.AutoMigrate(
		&model.User{},
		&model.Log{},
		&model.TopUp{},
		&model.SubscriptionPlan{},
		&model.SubscriptionOrder{},
		&model.UserSubscription{},
		&model.SubscriptionProviderBinding{},
		&model.PaymentWebhookEvent{},
		&model.UserSubscriptionContract{},
		&model.SubscriptionChangeIntent{},
		&model.SubscriptionTierRankReservation{},
	))

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.UsingMySQL = originalUsingMySQL
		require.NoError(t, sqlDB.Close())
	})
}

func confirmSubscriptionPlanPaymentComplianceForTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestAdminUpdateSubscriptionPlanStatusUsesLifecycleValidation(t *testing.T) {
	setupSubscriptionPlanControllerLifecycleTestDB(t)
	confirmSubscriptionPlanPaymentComplianceForTest(t)
	gin.SetMode(gin.TestMode)

	legacy := &model.SubscriptionPlan{
		Title:         "Legacy nil rank",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       false,
		TotalAmount:   1000,
	}
	require.NoError(t, model.DB.Select("*").Create(legacy).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", legacy.Id).Update("enabled", false).Error)

	body, err := json.Marshal(AdminUpdateSubscriptionPlanStatusRequest{Enabled: common.GetPointer(true)})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(legacy.Id)}}
	ctx.Request = httptest.NewRequest(http.MethodPost, "/subscription/plans/"+strconv.Itoa(legacy.Id)+"/status", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	AdminUpdateSubscriptionPlanStatus(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var stored model.SubscriptionPlan
	require.NoError(t, model.DB.First(&stored, "id = ?", legacy.Id).Error)
	require.False(t, stored.Enabled)
	var reservations int64
	require.NoError(t, model.DB.Model(&model.SubscriptionTierRankReservation{}).Count(&reservations).Error)
	require.Zero(t, reservations)
}

func TestAdminCreateSubscriptionPlanValidatesLocalPrices(t *testing.T) {
	setupSubscriptionPlanControllerLifecycleTestDB(t)
	confirmSubscriptionPlanPaymentComplianceForTest(t)
	gin.SetMode(gin.TestMode)

	for _, tt := range []struct {
		name        string
		pixPrice    *float64
		upiPrice    *float64
		wantSuccess bool
	}{
		{name: "blank local prices are unavailable", wantSuccess: true},
		{name: "positive local prices are accepted", pixPrice: common.GetPointer(49.90), upiPrice: common.GetPointer(799.50), wantSuccess: true},
		{name: "zero pix price is rejected", pixPrice: common.GetPointer(0.0), wantSuccess: false},
		{name: "negative upi price is rejected", upiPrice: common.GetPointer(-1.0), wantSuccess: false},
		{name: "over bound pix price is rejected", pixPrice: common.GetPointer(10000.0), wantSuccess: false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := AdminUpsertSubscriptionPlanRequest{Plan: model.SubscriptionPlan{
				Title:         "Local price plan",
				PriceAmount:   9.99,
				Currency:      "USD",
				DurationUnit:  model.SubscriptionDurationMonth,
				DurationValue: 1,
				Enabled:       false,
				TotalAmount:   1000,
				PixPriceBRL:   tt.pixPrice,
				UpiPriceINR:   tt.upiPrice,
			}}
			recorder := performAdminCreateSubscriptionPlan(t, req)
			require.Equal(t, http.StatusOK, recorder.Code)

			var resp struct {
				Success bool                   `json:"success"`
				Data    model.SubscriptionPlan `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
			require.Equal(t, tt.wantSuccess, resp.Success, recorder.Body.String())
			if !tt.wantSuccess {
				return
			}
			require.Equal(t, tt.pixPrice, resp.Data.PixPriceBRL)
			require.Equal(t, tt.upiPrice, resp.Data.UpiPriceINR)
		})
	}
}

func TestAdminUpdateSubscriptionPlanClearsAndValidatesLocalPrices(t *testing.T) {
	setupSubscriptionPlanControllerLifecycleTestDB(t)
	confirmSubscriptionPlanPaymentComplianceForTest(t)
	gin.SetMode(gin.TestMode)

	pixPrice := 49.90
	upiPrice := 799.50
	plan := &model.SubscriptionPlan{
		Title:         "Local price plan",
		PriceAmount:   9.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       false,
		TotalAmount:   1000,
		PixPriceBRL:   &pixPrice,
		UpiPriceINR:   &upiPrice,
	}
	require.NoError(t, model.CreateSubscriptionPlan(plan))

	req := AdminUpsertSubscriptionPlanRequest{Plan: *plan}
	req.Plan.PixPriceBRL = nil
	req.Plan.UpiPriceINR = common.GetPointer(899.25)
	recorder := performAdminUpdateSubscriptionPlan(t, plan.Id, req)
	require.Equal(t, http.StatusOK, recorder.Code)
	var resp struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
	require.True(t, resp.Success, recorder.Body.String())

	var stored model.SubscriptionPlan
	require.NoError(t, model.DB.First(&stored, "id = ?", plan.Id).Error)
	require.Nil(t, stored.PixPriceBRL)
	require.NotNil(t, stored.UpiPriceINR)
	require.InDelta(t, 899.25, *stored.UpiPriceINR, 0.000001)

	req.Plan.UpiPriceINR = common.GetPointer(0.0)
	recorder = performAdminUpdateSubscriptionPlan(t, plan.Id, req)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
	require.False(t, resp.Success, recorder.Body.String())
}

func performAdminCreateSubscriptionPlan(t *testing.T, req AdminUpsertSubscriptionPlanRequest) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(req)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/subscription/plans", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	AdminCreateSubscriptionPlan(ctx)
	return recorder
}

func performAdminUpdateSubscriptionPlan(t *testing.T, id int, req AdminUpsertSubscriptionPlanRequest) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(req)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: strconv.Itoa(id)}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/subscription/plans/"+strconv.Itoa(id), bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	AdminUpdateSubscriptionPlan(ctx)
	return recorder
}
