package controller

import (
	"fmt"
	"math"
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

type invitationTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Summary struct {
			InviterRewardUSD      float64 `json:"inviter_reward_usd"`
			InviteeRewardUSD      float64 `json:"invitee_reward_usd"`
			InviterRewardMaxCount int     `json:"inviter_reward_max_count"`
			HistoryUSD            float64 `json:"history_usd"`
			PendingRewardUSD      float64 `json:"pending_reward_usd"`
			TransferableUSD       float64 `json:"transferable_usd"`
			GrantedCount          int     `json:"granted_count"`
			PendingCount          int64   `json:"pending_count"`
			TransferEnabled       bool    `json:"transfer_enabled"`
		} `json:"summary"`
		Items    []model.InvitationRecord `json:"items"`
		Page     int                      `json:"page"`
		PageSize int                      `json:"page_size"`
		Total    int64                    `json:"total"`
	} `json:"data"`
}

func setupInvitationControllerTest(t *testing.T) (*gorm.DB, model.User) {
	t.Helper()

	originalGinMode := gin.Mode()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInvitee := common.QuotaForInvitee
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount
	originalQuotaPerUnit := common.QuotaPerUnit
	paymentSetting := operation_setting.GetPaymentSetting()
	originalPaymentSetting := *paymentSetting
	dbPath := t.TempDir() + "/invitation-controller.db"
	var db *gorm.DB
	t.Cleanup(func() {
		if db != nil {
			sqlDB, dbErr := db.DB()
			if dbErr == nil {
				_ = sqlDB.Close()
			}
		}
		gin.SetMode(originalGinMode)
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInvitee = originalQuotaForInvitee
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		common.QuotaPerUnit = originalQuotaPerUnit
		*paymentSetting = originalPaymentSetting
	})

	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.QuotaForInviter = 500
	common.QuotaForInvitee = 250
	common.QuotaForInviterMaxCount = 10
	common.QuotaPerUnit = 100
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	var err error
	db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.InviteRewardEvent{}, &model.InviteSubscriptionReward{}))
	model.DB = db
	model.LOG_DB = db

	inviter := model.User{
		Id:              101,
		Username:        "inviter",
		Password:        "password123",
		AffCode:         "inviter-code",
		AffHistoryQuota: 900,
		AffQuota:        400,
		AffCount:        2,
		CreatedAt:       100,
	}
	require.NoError(t, db.Create(&inviter).Error)
	require.NoError(t, db.Create(&model.User{
		Id:                 201,
		Username:           "pending-user",
		Email:              "invitee@example.com",
		Password:           "password123",
		AffCode:            "pending-code",
		InviterId:          inviter.Id,
		InviteRewardStatus: model.InviteRewardStatusPending,
		CreatedAt:          200,
	}).Error)

	otherInviter := model.User{
		Id:        102,
		Username:  "other-inviter",
		Password:  "password123",
		AffCode:   "other-inviter-code",
		CreatedAt: 100,
	}
	require.NoError(t, db.Create(&otherInviter).Error)
	require.NoError(t, db.Create(&model.User{
		Id:                 202,
		Username:           "other-pending-user",
		Email:              "other@example.com",
		Password:           "password123",
		AffCode:            "other-pending-code",
		InviterId:          otherInviter.Id,
		InviteRewardStatus: model.InviteRewardStatusPending,
		CreatedAt:          300,
	}).Error)

	return db, inviter
}

func performInvitationRequest(t *testing.T, inviterId int, query string) (*httptest.ResponseRecorder, invitationTestResponse) {
	t.Helper()

	recorder := httptest.NewRecorder()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", inviterId)
		c.Next()
	})
	router.GET("/api/user/self/invitations", GetSelfInvitations)
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/user/self/invitations"+query, nil))

	var response invitationTestResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return recorder, response
}

func TestGetSelfInvitations(t *testing.T) {
	t.Run("returns scoped privacy-safe summary and items", func(t *testing.T) {
		db, inviter := setupInvitationControllerTest(t)

		recorder, response := performInvitationRequest(t, inviter.Id, "")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.True(t, response.Success)
		require.Equal(t, 5.0, response.Data.Summary.InviterRewardUSD)
		require.Equal(t, 2.5, response.Data.Summary.InviteeRewardUSD)
		require.Equal(t, 10, response.Data.Summary.InviterRewardMaxCount)
		require.Equal(t, 9.0, response.Data.Summary.HistoryUSD)
		require.Equal(t, 5.0, response.Data.Summary.PendingRewardUSD)
		require.Zero(t, response.Data.Summary.TransferableUSD)
		require.Equal(t, 2, response.Data.Summary.GrantedCount)
		require.EqualValues(t, 1, response.Data.Summary.PendingCount)
		require.True(t, response.Data.Summary.TransferEnabled)
		require.Equal(t, 1, response.Data.Page)
		require.Equal(t, 10, response.Data.PageSize)
		require.EqualValues(t, 1, response.Data.Total)
		require.Len(t, response.Data.Items, 1)
		require.Equal(t, "i***@example.com", response.Data.Items[0].MaskedIdentity)

		body := recorder.Body.String()
		require.NotContains(t, body, "invitee@example.com")
		require.NotContains(t, body, "pending-user")
		require.NotContains(t, body, "other@example.com")
		require.NotContains(t, body, "other-pending-user")

		var refreshed model.User
		require.NoError(t, db.First(&refreshed, inviter.Id).Error)
		require.Equal(t, 400, refreshed.Quota)
		require.Zero(t, refreshed.AffQuota)
	})

	t.Run("caps pending reward at remaining inviter slots", func(t *testing.T) {
		db, inviter := setupInvitationControllerTest(t)
		common.QuotaForInviterMaxCount = 3
		for i := 0; i < 2; i++ {
			require.NoError(t, db.Create(&model.User{
				Username:           fmt.Sprintf("extra-pending-%d", i),
				Password:           "password123",
				AffCode:            fmt.Sprintf("extra-pending-code-%d", i),
				InviterId:          inviter.Id,
				InviteRewardStatus: model.InviteRewardStatusPending,
				CreatedAt:          int64(400 + i),
			}).Error)
		}

		recorder, response := performInvitationRequest(t, inviter.Id, "")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.EqualValues(t, 3, response.Data.Summary.PendingCount)
		require.Equal(t, 5.0, response.Data.Summary.PendingRewardUSD)
	})

	t.Run("returns no pending reward after inviter reaches the limit", func(t *testing.T) {
		_, inviter := setupInvitationControllerTest(t)
		common.QuotaForInviterMaxCount = inviter.AffCount

		recorder, response := performInvitationRequest(t, inviter.Id, "")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.EqualValues(t, 1, response.Data.Summary.PendingCount)
		require.Zero(t, response.Data.Summary.PendingRewardUSD)
	})

	t.Run("disables transfer when payment compliance is not confirmed", func(t *testing.T) {
		_, inviter := setupInvitationControllerTest(t)
		operation_setting.GetPaymentSetting().ComplianceConfirmed = false

		recorder, response := performInvitationRequest(t, inviter.Id, "")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.True(t, response.Success)
		require.Equal(t, 5.0, response.Data.Summary.InviterRewardUSD)
		require.False(t, response.Data.Summary.TransferEnabled)
	})

	t.Run("accepts a USD amount and transfers the matching balance", func(t *testing.T) {
		db, inviter := setupInvitationControllerTest(t)
		recorder := httptest.NewRecorder()
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("id", inviter.Id)
			c.Next()
		})
		router.POST("/api/user/aff_transfer", TransferAffQuota)
		request := httptest.NewRequest(
			http.MethodPost,
			"/api/user/aff_transfer",
			strings.NewReader(`{"amount_usd":2}`),
		)
		request.Header.Set("Content-Type", "application/json")

		router.ServeHTTP(recorder, request)

		var response struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success, recorder.Body.String())
		var refreshed model.User
		require.NoError(t, db.First(&refreshed, inviter.Id).Error)
		require.Equal(t, 200, refreshed.AffQuota)
		require.Equal(t, 200, refreshed.Quota)
	})

	t.Run("rejects a USD amount below the one dollar minimum", func(t *testing.T) {
		db, inviter := setupInvitationControllerTest(t)
		recorder := httptest.NewRecorder()
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("id", inviter.Id)
			c.Next()
		})
		router.POST("/api/user/aff_transfer", TransferAffQuota)
		request := httptest.NewRequest(
			http.MethodPost,
			"/api/user/aff_transfer",
			strings.NewReader(`{"amount_usd":0.999}`),
		)
		request.Header.Set("Content-Type", "application/json")

		router.ServeHTTP(recorder, request)

		var response struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.False(t, response.Success, recorder.Body.String())
		var refreshed model.User
		require.NoError(t, db.First(&refreshed, inviter.Id).Error)
		require.Equal(t, 400, refreshed.AffQuota)
		require.Zero(t, refreshed.Quota)
	})

	t.Run("keeps the legacy raw quota request compatible", func(t *testing.T) {
		db, inviter := setupInvitationControllerTest(t)
		recorder := httptest.NewRecorder()
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("id", inviter.Id)
			c.Next()
		})
		router.POST("/api/user/aff_transfer", TransferAffQuota)
		request := httptest.NewRequest(
			http.MethodPost,
			"/api/user/aff_transfer",
			strings.NewReader(`{"quota":200}`),
		)
		request.Header.Set("Content-Type", "application/json")

		router.ServeHTTP(recorder, request)

		var response struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
		require.True(t, response.Success, recorder.Body.String())
		var refreshed model.User
		require.NoError(t, db.First(&refreshed, inviter.Id).Error)
		require.Equal(t, 200, refreshed.AffQuota)
		require.Equal(t, 200, refreshed.Quota)
	})

	t.Run("normalizes focused pagination contract", func(t *testing.T) {
		tests := []struct {
			name         string
			query        string
			wantPage     int
			wantPageSize int
		}{
			{name: "canonical page overrides legacy p", query: "?page=2&p=9&page_size=5", wantPage: 2, wantPageSize: 5},
			{name: "legacy p fallback", query: "?p=3&page_size=7", wantPage: 3, wantPageSize: 7},
			{name: "caps page size", query: "?page_size=999", wantPage: 1, wantPageSize: 100},
			{name: "invalid canonical page falls back to legacy p", query: "?page=-2&p=4&page_size=-5", wantPage: 4, wantPageSize: 10},
			{name: "defaults invalid page values", query: "?page=invalid&p=-4", wantPage: 1, wantPageSize: 10},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				_, inviter := setupInvitationControllerTest(t)

				_, response := performInvitationRequest(t, inviter.Id, tt.query)

				require.Equal(t, tt.wantPage, response.Data.Page, fmt.Sprintf("query %s", tt.query))
				require.Equal(t, tt.wantPageSize, response.Data.PageSize, fmt.Sprintf("query %s", tt.query))
			})
		}
	})

	t.Run("normalizes page when offset would overflow", func(t *testing.T) {
		_, inviter := setupInvitationControllerTest(t)
		overflowingPage := math.MaxInt/maxInvitationPageSize + 2

		recorder, response := performInvitationRequest(t, inviter.Id, "?page="+strconv.Itoa(overflowingPage)+"&page_size=100")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.True(t, response.Success)
		require.Equal(t, defaultInvitationPage, response.Data.Page)
		require.Equal(t, maxInvitationPageSize, response.Data.PageSize)
		require.Len(t, response.Data.Items, 1)
	})
}

func TestInvitationRecordsFromModelUsesUSD(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 100
	t.Cleanup(func() { common.QuotaPerUnit = originalQuotaPerUnit })

	records := invitationRecordsFromModel([]model.InvitationRecord{{
		Id:          1,
		RewardQuota: 250,
	}})

	require.Len(t, records, 1)
	require.Equal(t, 2.5, records[0].RewardUSD)
}
