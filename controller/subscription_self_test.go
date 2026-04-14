package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type subscriptionSelfAPIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type subscriptionSelfPlan struct {
	ID                      int    `json:"id"`
	Title                   string `json:"title"`
	QuotaResetPeriod        string `json:"quota_reset_period"`
	QuotaResetCustomSeconds int64  `json:"quota_reset_custom_seconds"`
}

type subscriptionSelfSummary struct {
	Subscription *model.UserSubscription `json:"subscription"`
	Plan         *subscriptionSelfPlan   `json:"plan"`
}

type subscriptionSelfResponseData struct {
	BillingPreference       string                    `json:"billing_preference"`
	Subscriptions           []subscriptionSelfSummary `json:"subscriptions"`
	AllSubscriptions        []subscriptionSelfSummary `json:"all_subscriptions"`
	PrimarySubscription     *subscriptionSelfSummary  `json:"primary_subscription"`
	ActiveSubscriptionCount int                       `json:"active_subscription_count"`
}

func setupSubscriptionSelfControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.SubscriptionPlan{}, &model.UserSubscription{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func seedSubscriptionSelfUser(t *testing.T, db *gorm.DB, id int) *model.User {
	t.Helper()

	user := &model.User{
		Id:       id,
		Username: fmt.Sprintf("user-%d", id),
		Password: "password123",
		Status:   1,
		Role:     common.RoleCommonUser,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func seedSubscriptionSelfPlan(t *testing.T, db *gorm.DB, plan model.SubscriptionPlan) *model.SubscriptionPlan {
	t.Helper()

	require.NoError(t, db.Create(&plan).Error)
	return &plan
}

func seedSubscriptionSelfSubscription(t *testing.T, db *gorm.DB, sub model.UserSubscription) *model.UserSubscription {
	t.Helper()

	require.NoError(t, db.Create(&sub).Error)
	return &sub
}

func newSubscriptionSelfContext(t *testing.T, userID int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", bytes.NewReader(nil))
	ctx.Set("id", userID)
	return ctx, recorder
}

func decodeSubscriptionSelfResponse(t *testing.T, recorder *httptest.ResponseRecorder) subscriptionSelfAPIResponse {
	t.Helper()

	var response subscriptionSelfAPIResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func decodeSubscriptionSelfData(t *testing.T, response subscriptionSelfAPIResponse) subscriptionSelfResponseData {
	t.Helper()

	var data subscriptionSelfResponseData
	require.NoError(t, common.Unmarshal(response.Data, &data))
	return data
}

func TestGetSubscriptionSelfReturnsPrimarySubscriptionCountAndPlanTitle(t *testing.T) {
	db := setupSubscriptionSelfControllerTestDB(t)
	seedSubscriptionSelfUser(t, db, 1)
	now := common.GetTimestamp()

	planMonthly := seedSubscriptionSelfPlan(t, db, model.SubscriptionPlan{
		Id:                      101,
		Title:                   "Max 月订阅",
		TotalAmount:             80000000,
		QuotaResetPeriod:        model.SubscriptionResetMonthly,
		QuotaResetCustomSeconds: 0,
		Enabled:                 true,
	})

	seedSubscriptionSelfSubscription(t, db, model.UserSubscription{
		Id:            201,
		UserId:        1,
		PlanId:        planMonthly.Id,
		AmountTotal:   80000000,
		AmountUsed:    2300000,
		StartTime:     now - 3600,
		EndTime:       now + 86400,
		Status:        "active",
		Source:        "order",
		NextResetTime: now + 3600,
	})

	ctx, recorder := newSubscriptionSelfContext(t, 1)
	GetSubscriptionSelf(ctx)

	response := decodeSubscriptionSelfResponse(t, recorder)
	require.True(t, response.Success)

	data := decodeSubscriptionSelfData(t, response)
	require.Equal(t, 1, data.ActiveSubscriptionCount)
	require.NotNil(t, data.PrimarySubscription)
	require.NotNil(t, data.PrimarySubscription.Plan)
	require.Equal(t, "Max 月订阅", data.PrimarySubscription.Plan.Title)
	require.Equal(t, "Max 月订阅", data.Subscriptions[0].Plan.Title)
	require.Equal(t, "Max 月订阅", data.AllSubscriptions[0].Plan.Title)
}

func TestGetSubscriptionSelfSkipsExhaustedLimitedSubscription(t *testing.T) {
	db := setupSubscriptionSelfControllerTestDB(t)
	seedSubscriptionSelfUser(t, db, 1)
	now := common.GetTimestamp()

	exhaustedPlan := seedSubscriptionSelfPlan(t, db, model.SubscriptionPlan{
		Id:               201,
		Title:            "Daily Exhausted",
		TotalAmount:      1000,
		QuotaResetPeriod: model.SubscriptionResetDaily,
		Enabled:          true,
	})
	activePlan := seedSubscriptionSelfPlan(t, db, model.SubscriptionPlan{
		Id:               202,
		Title:            "Monthly Available",
		TotalAmount:      8000,
		QuotaResetPeriod: model.SubscriptionResetMonthly,
		Enabled:          true,
	})

	seedSubscriptionSelfSubscription(t, db, model.UserSubscription{
		Id:          301,
		UserId:      1,
		PlanId:      exhaustedPlan.Id,
		AmountTotal: 1000,
		AmountUsed:  1000,
		StartTime:   now - 7200,
		EndTime:     now + 3600,
		Status:      "active",
		Source:      "order",
	})
	seedSubscriptionSelfSubscription(t, db, model.UserSubscription{
		Id:          302,
		UserId:      1,
		PlanId:      activePlan.Id,
		AmountTotal: 8000,
		AmountUsed:  2500,
		StartTime:   now - 7200,
		EndTime:     now + 7200,
		Status:      "active",
		Source:      "order",
	})

	ctx, recorder := newSubscriptionSelfContext(t, 1)
	GetSubscriptionSelf(ctx)

	response := decodeSubscriptionSelfResponse(t, recorder)
	require.True(t, response.Success)

	data := decodeSubscriptionSelfData(t, response)
	require.Equal(t, 2, data.ActiveSubscriptionCount)
	require.NotNil(t, data.PrimarySubscription)
	require.NotNil(t, data.PrimarySubscription.Plan)
	require.Equal(t, "Monthly Available", data.PrimarySubscription.Plan.Title)
	require.Equal(t, int64(8000), data.PrimarySubscription.Subscription.AmountTotal)
	require.Equal(t, int64(2500), data.PrimarySubscription.Subscription.AmountUsed)
}
