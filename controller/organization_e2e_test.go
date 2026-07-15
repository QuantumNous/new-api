package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type organizationE2EFixture struct {
	Organization organizationE2EOrganization `json:"organization"`
	Users        []organizationE2EUser       `json:"users"`
	Members      []organizationE2EMember     `json:"members"`
	Tokens       []organizationE2EToken      `json:"tokens"`
	Channels     []organizationE2EChannel    `json:"channels"`
	Logs         []organizationE2ELog        `json:"logs"`
}

type organizationE2EOrganization struct {
	Id     int    `json:"id"`
	Name   string `json:"name"`
	Status int    `json:"status"`
}

type organizationE2EUser struct {
	Id                int    `json:"id"`
	Username          string `json:"username"`
	Role              int    `json:"role"`
	Status            int    `json:"status"`
	Quota             int    `json:"quota"`
	UsedQuota         int    `json:"used_quota"`
	RequestCount      int    `json:"request_count"`
	BillingPreference string `json:"billing_preference"`
	AccessToken       string `json:"access_token"`
}

type organizationE2EMember struct {
	UserId   int    `json:"user_id"`
	Role     string `json:"role"`
	JoinedAt int64  `json:"joined_at"`
}

type organizationE2EToken struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id"`
	Name        string `json:"name"`
	Key         string `json:"key"`
	RemainQuota int    `json:"remain_quota"`
	UsedQuota   int    `json:"used_quota"`
}

type organizationE2EChannel struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

type organizationE2ELog struct {
	UserId           int    `json:"user_id"`
	CreatedAt        int64  `json:"created_at"`
	Type             int    `json:"type"`
	ModelName        string `json:"model_name"`
	ChannelId        int    `json:"channel_id"`
	Quota            int    `json:"quota"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	RequestId        string `json:"request_id"`
}

type organizationE2EResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type organizationE2EPage[T any] struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
	Items    []T `json:"items"`
}

func loadOrganizationE2EFixture(t *testing.T) organizationE2EFixture {
	t.Helper()
	payload, err := os.ReadFile("testdata/organization_e2e.json")
	require.NoError(t, err)
	var fixture organizationE2EFixture
	require.NoError(t, common.Unmarshal(payload, &fixture))
	return fixture
}

func setupOrganizationE2E(t *testing.T) (organizationE2EFixture, *gin.Engine) {
	t.Helper()
	fixture := loadOrganizationE2EFixture(t)

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousLogConsumeEnabled := common.LogConsumeEnabled

	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.LogConsumeEnabled = true
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Organization{},
		&model.OrganizationMember{},
		&model.Token{},
		&model.Channel{},
		&model.Ability{},
		&model.Model{},
		&model.Vendor{},
		&model.Log{},
	))

	seedOrganizationE2EFixture(t, db, fixture)

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("organization-e2e-session"))))
	registerOrganizationE2ERoutes(router)

	t.Cleanup(func() {
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.LogConsumeEnabled = previousLogConsumeEnabled
	})

	return fixture, router
}

func seedOrganizationE2EFixture(t *testing.T, db *gorm.DB, fixture organizationE2EFixture) {
	t.Helper()

	users := make([]model.User, 0, len(fixture.Users))
	for _, item := range fixture.Users {
		accessToken := item.AccessToken
		users = append(users, model.User{
			Id:           item.Id,
			Username:     item.Username,
			Password:     "organization-e2e-password",
			DisplayName:  item.Username + " display",
			Role:         item.Role,
			Status:       item.Status,
			Email:        item.Username + "@example.com",
			AccessToken:  &accessToken,
			Quota:        item.Quota,
			UsedQuota:    item.UsedQuota,
			RequestCount: item.RequestCount,
			Group:        "default",
			Setting: common.MapToJsonStr(map[string]interface{}{
				"billing_preference": item.BillingPreference,
			}),
			AffCode: fmt.Sprintf("e2e-aff-%d", item.Id),
		})
	}
	require.NoError(t, db.Create(&users).Error)

	require.NoError(t, db.Create(&model.Organization{
		Id:     fixture.Organization.Id,
		Name:   fixture.Organization.Name,
		Status: fixture.Organization.Status,
	}).Error)

	members := make([]model.OrganizationMember, 0, len(fixture.Members))
	for _, item := range fixture.Members {
		currentKey := strconv.Itoa(item.UserId)
		members = append(members, model.OrganizationMember{
			OrganizationId: fixture.Organization.Id,
			UserId:         item.UserId,
			Role:           item.Role,
			JoinedAt:       item.JoinedAt,
			CurrentKey:     &currentKey,
		})
	}
	require.NoError(t, db.Create(&members).Error)

	tokens := make([]model.Token, 0, len(fixture.Tokens))
	for _, item := range fixture.Tokens {
		tokens = append(tokens, model.Token{
			Id:             item.Id,
			UserId:         item.UserId,
			Name:           item.Name,
			Key:            item.Key,
			Status:         common.TokenStatusEnabled,
			CreatedTime:    fixture.Members[0].JoinedAt,
			AccessedTime:   fixture.Members[0].JoinedAt,
			ExpiredTime:    -1,
			RemainQuota:    item.RemainQuota,
			UsedQuota:      item.UsedQuota,
			UnlimitedQuota: false,
			Group:          "default",
		})
	}
	require.NoError(t, db.Create(&tokens).Error)

	channels := make([]model.Channel, 0, len(fixture.Channels))
	for _, item := range fixture.Channels {
		channels = append(channels, model.Channel{
			Id:     item.Id,
			Name:   item.Name,
			Key:    item.Key,
			Status: common.ChannelStatusEnabled,
		})
	}
	require.NoError(t, db.Create(&channels).Error)

	logs := make([]model.Log, 0, len(fixture.Logs))
	for _, item := range fixture.Logs {
		logs = append(logs, model.Log{
			UserId:           item.UserId,
			Username:         fixtureUser(t, fixture, item.UserId).Username,
			CreatedAt:        item.CreatedAt,
			Type:             item.Type,
			ModelName:        item.ModelName,
			ChannelId:        item.ChannelId,
			Quota:            item.Quota,
			PromptTokens:     item.PromptTokens,
			CompletionTokens: item.CompletionTokens,
			RequestId:        item.RequestId,
		})
	}
	require.NoError(t, db.Create(&logs).Error)
}

func registerOrganizationE2ERoutes(router *gin.Engine) {
	organizationRoute := router.Group("/api/organization")
	organizationRoute.Use(middleware.UserAuth())
	{
		organizationRoute.GET("/self", GetOrganizationSelf)
		organizationRoute.PATCH("/current", UpdateCurrentOrganization)
		organizationRoute.GET("/current/members", GetCurrentOrganizationMembers)
		organizationRoute.POST("/current/members", AddCurrentOrganizationMember)
		organizationRoute.PATCH("/current/members/:user_id", UpdateCurrentOrganizationMember)
		organizationRoute.DELETE("/current/members/:user_id", DeleteCurrentOrganizationMember)
		organizationRoute.GET("/current/billing/summary", GetCurrentOrganizationBillingSummary)
		organizationRoute.GET("/current/billing/members", GetCurrentOrganizationBillingMembers)
		organizationRoute.GET("/current/billing/models", GetCurrentOrganizationBillingModels)
		organizationRoute.GET("/current/billing/channels", GetCurrentOrganizationBillingChannels)
		organizationRoute.GET("/current/billing/trend", GetCurrentOrganizationBillingTrend)
		organizationRoute.GET("/current/billing/logs", GetCurrentOrganizationBillingLogs)
	}

	adminOrganizationRoute := router.Group("/api/admin/organizations")
	adminOrganizationRoute.Use(middleware.AdminAuth())
	{
		adminOrganizationRoute.GET("/:id", AdminGetOrganization)
		adminOrganizationRoute.GET("/:id/members", AdminListOrganizationMembers)
		adminOrganizationRoute.DELETE("/:id/members/:user_id", AdminDeleteOrganizationMember)
		adminOrganizationRoute.GET("/:id/billing/summary", AdminGetOrganizationBillingSummary)
	}

	tokenRoute := router.Group("/api/token")
	tokenRoute.Use(middleware.UserAuth())
	tokenRoute.GET("/", GetAllTokens)
}

func fixtureUser(t *testing.T, fixture organizationE2EFixture, userId int) organizationE2EUser {
	t.Helper()
	for _, user := range fixture.Users {
		if user.Id == userId {
			return user
		}
	}
	require.FailNow(t, "fixture user not found", "user_id=%d", userId)
	return organizationE2EUser{}
}

func performOrganizationE2ERequest(
	t *testing.T,
	router *gin.Engine,
	fixture organizationE2EFixture,
	userId int,
	method string,
	target string,
	body any,
) *httptest.ResponseRecorder {
	t.Helper()
	requestBody := bytes.NewReader(nil)
	if body != nil {
		payload, err := common.Marshal(body)
		require.NoError(t, err)
		requestBody = bytes.NewReader(payload)
	}
	request := httptest.NewRequest(method, target, requestBody)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if userId > 0 {
		user := fixtureUser(t, fixture, userId)
		request.Header.Set("Authorization", "Bearer "+user.AccessToken)
		request.Header.Set("New-Api-User", strconv.Itoa(user.Id))
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func decodeOrganizationE2EResponse(t *testing.T, recorder *httptest.ResponseRecorder) organizationE2EResponse {
	t.Helper()
	var response organizationE2EResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func decodeOrganizationE2EData[T any](t *testing.T, response organizationE2EResponse) T {
	t.Helper()
	var data T
	require.NoError(t, common.Unmarshal(response.Data, &data))
	return data
}

func requireOrganizationE2ESuccess(t *testing.T, recorder *httptest.ResponseRecorder) organizationE2EResponse {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeOrganizationE2EResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	return response
}

func TestOrganizationE2EPermissions(t *testing.T) {
	fixture, router := setupOrganizationE2E(t)
	organizationId := fixture.Organization.Id

	unauthenticated := performOrganizationE2ERequest(t, router, fixture, 0, http.MethodGet, "/api/organization/self", nil)
	assert.Equal(t, http.StatusUnauthorized, unauthenticated.Code)

	outsider := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1003, http.MethodGet, "/api/organization/self", nil,
	))
	assert.Equal(t, "null", string(outsider.Data))

	memberUpdate := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodPatch, "/api/organization/current", map[string]any{"name": "member cannot rename"},
	))
	assert.False(t, memberUpdate.Success)
	assert.Contains(t, memberUpdate.Message, "no organization management permission")

	memberAdd := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1003, "role": "member"},
	))
	assert.False(t, memberAdd.Success)

	memberList := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodGet, "/api/organization/current/members", nil,
	))
	memberRows := decodeOrganizationE2EData[[]model.OrganizationMember](t, memberList)
	require.Len(t, memberRows, 1)
	assert.Equal(t, 1002, memberRows[0].UserId)
	assert.Equal(t, model.OrganizationRoleMember, memberRows[0].Role)

	globalAdminView := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1000, http.MethodGet, fmt.Sprintf("/api/admin/organizations/%d/members", organizationId), nil,
	))
	globalAdminRows := decodeOrganizationE2EData[[]model.OrganizationMember](t, globalAdminView)
	require.Len(t, globalAdminRows, 2)

	orgAdminAddSystemAdmin := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1000, "role": "member"},
	))
	assert.False(t, orgAdminAddSystemAdmin.Success)
	assert.Contains(t, orgAdminAddSystemAdmin.Message, "system administrators cannot be added")

	// 兼容旧版本遗留的 Root 组织成员关系：存在其他活动 Admin 时，Root 可以移除自己，
	// 且移除后仍可通过系统级 AdminAuth 管理组织。
	rootCurrentKey := strconv.Itoa(1005)
	require.NoError(t, model.DB.Create(&model.OrganizationMember{
		OrganizationId: organizationId,
		UserId:         1005,
		Role:           model.OrganizationRoleAdmin,
		JoinedAt:       fixture.Members[0].JoinedAt,
		CurrentKey:     &rootCurrentKey,
	}).Error)
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1005, http.MethodDelete, fmt.Sprintf("/api/admin/organizations/%d/members/1005", organizationId), nil,
	))
	var removedRoot model.OrganizationMember
	require.NoError(t, model.DB.Where("organization_id = ? AND user_id = ?", organizationId, 1005).First(&removedRoot).Error)
	assert.NotZero(t, removedRoot.LeftAt)
	assert.Nil(t, removedRoot.CurrentKey)

	memberAdminView := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodGet, fmt.Sprintf("/api/admin/organizations/%d", organizationId), nil,
	))
	assert.False(t, memberAdminView.Success)

	adminRename := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPatch, "/api/organization/current", map[string]any{"name": "Acme AI Platform"},
	))
	renamed := decodeOrganizationE2EData[model.Organization](t, adminRename)
	assert.Equal(t, "Acme AI Platform", renamed.Name)

	lastAdminDemotion := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPatch, "/api/organization/current/members/1001", map[string]any{"role": "member"},
	))
	assert.False(t, lastAdminDemotion.Success)
	assert.Contains(t, lastAdminDemotion.Message, "last organization admin")

	lastAdminRemoval := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodDelete, "/api/organization/current/members/1001", nil,
	))
	assert.False(t, lastAdminRemoval.Success)
	assert.Contains(t, lastAdminRemoval.Message, "last organization admin")

	disabledUser := decodeOrganizationE2EResponse(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1004, "role": "member"},
	))
	assert.False(t, disabledUser.Success)
	assert.Contains(t, disabledUser.Message, "user is disabled")

	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1003, "role": "member"},
	))
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodDelete, "/api/organization/current/members/1003", nil,
	))

	// 当前组织 Admin 在交接给另一位 Admin 后可以退出自己。
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1003, "role": "admin"},
	))
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodDelete, "/api/organization/current/members/1001", nil,
	))
}

func TestOrganizationE2ELeavesPersonalFeaturesUntouched(t *testing.T) {
	fixture, router := setupOrganizationE2E(t)

	var userBefore model.User
	require.NoError(t, model.DB.First(&userBefore, 1002).Error)
	var tokenBefore model.Token
	require.NoError(t, model.DB.First(&tokenBefore, 8002).Error)

	tokensBeforeResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodGet, "/api/token/?p=1&page_size=20", nil,
	))
	tokensBefore := decodeOrganizationE2EData[organizationE2EPage[model.Token]](t, tokensBeforeResponse)
	require.Equal(t, 1, tokensBefore.Total)
	require.Len(t, tokensBefore.Items, 1)
	assert.Equal(t, "member-personal-key", tokensBefore.Items[0].Name)
	assert.Equal(t, 1002, tokensBefore.Items[0].UserId)

	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodPost, "/api/organization/current/members", map[string]any{"user_id": 1003, "role": "member"},
	))
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodDelete, "/api/organization/current/members/1003", nil,
	))
	requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/summary", nil,
	))

	var userAfter model.User
	require.NoError(t, model.DB.First(&userAfter, 1002).Error)
	var tokenAfter model.Token
	require.NoError(t, model.DB.First(&tokenAfter, 8002).Error)

	assert.Equal(t, userBefore.Quota, userAfter.Quota)
	assert.Equal(t, userBefore.UsedQuota, userAfter.UsedQuota)
	assert.Equal(t, userBefore.RequestCount, userAfter.RequestCount)
	assert.Equal(t, userBefore.Group, userAfter.Group)
	assert.Equal(t, userBefore.Setting, userAfter.Setting)
	assert.Equal(t, tokenBefore.UserId, tokenAfter.UserId)
	assert.Equal(t, tokenBefore.RemainQuota, tokenAfter.RemainQuota)
	assert.Equal(t, tokenBefore.UsedQuota, tokenAfter.UsedQuota)
	assert.Equal(t, tokenBefore.Key, tokenAfter.Key)

	tokensAfterResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodGet, "/api/token/?p=1&page_size=20", nil,
	))
	tokensAfter := decodeOrganizationE2EData[organizationE2EPage[model.Token]](t, tokensAfterResponse)
	assert.Equal(t, tokensBefore.Total, tokensAfter.Total)
	require.Len(t, tokensAfter.Items, 1)
	assert.Equal(t, tokensBefore.Items[0].Id, tokensAfter.Items[0].Id)
	assert.Equal(t, tokensBefore.Items[0].UserId, tokensAfter.Items[0].UserId)
	assert.Equal(t, tokensBefore.Items[0].RemainQuota, tokensAfter.Items[0].RemainQuota)
}

func TestOrganizationE2EBillingScopesAndAggregatesSettledLogs(t *testing.T) {
	fixture, router := setupOrganizationE2E(t)
	const billingWindow = "start_timestamp=1782864000&end_timestamp=1783511999"

	adminSummaryResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/summary?"+billingWindow, nil,
	))
	adminSummary := decodeOrganizationE2EData[model.OrganizationBillingSummary](t, adminSummaryResponse)
	assert.Equal(t, 420, adminSummary.TotalQuota)
	assert.Equal(t, 3, adminSummary.RequestCount)
	assert.Equal(t, 360, adminSummary.PromptTokens)
	assert.Equal(t, 60, adminSummary.CompletionTokens)
	assert.Equal(t, 2, adminSummary.MemberCount)
	assert.Equal(t, 2, adminSummary.ActiveMemberCount)

	memberSummaryResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1002, http.MethodGet, "/api/organization/current/billing/summary?"+billingWindow+"&user_id=1001", nil,
	))
	memberSummary := decodeOrganizationE2EData[model.OrganizationBillingSummary](t, memberSummaryResponse)
	assert.Equal(t, 300, memberSummary.TotalQuota)
	assert.Equal(t, 2, memberSummary.RequestCount)
	assert.Equal(t, 1, memberSummary.MemberCount)

	reconciliationResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/summary?"+billingWindow+"&view=reconciliation", nil,
	))
	reconciliation := decodeOrganizationE2EData[model.OrganizationBillingSummary](t, reconciliationResponse)
	assert.Equal(t, 440, reconciliation.TotalQuota)
	assert.Equal(t, 5, reconciliation.RequestCount)

	logsResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/logs?"+billingWindow+"&p=1&page_size=20", nil,
	))
	logs := decodeOrganizationE2EData[organizationE2EPage[model.Log]](t, logsResponse)
	assert.Equal(t, 3, logs.Total)
	require.Len(t, logs.Items, 3)
	assert.Equal(t, "req-member-in-membership-2", logs.Items[0].RequestId)
	assert.Equal(t, "req-member-in-membership-1", logs.Items[1].RequestId)
	assert.Equal(t, "req-admin-in-membership", logs.Items[2].RequestId)

	modelsResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/models?"+billingWindow, nil,
	))
	models := decodeOrganizationE2EData[[]model.OrganizationBillingDimension](t, modelsResponse)
	require.Len(t, models, 2)
	assert.Equal(t, "gpt-lite", models[0].ModelName)
	assert.Equal(t, 300, models[0].TotalQuota)
	assert.Equal(t, "gpt-pro", models[1].ModelName)
	assert.Equal(t, 120, models[1].TotalQuota)

	channelsResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/channels?"+billingWindow, nil,
	))
	channels := decodeOrganizationE2EData[[]model.OrganizationBillingDimension](t, channelsResponse)
	require.Len(t, channels, 2)
	assert.Equal(t, 8, channels[0].ChannelId)
	assert.Equal(t, "fallback-openai", channels[0].ChannelName)
	assert.Equal(t, 300, channels[0].TotalQuota)
	assert.Equal(t, 7, channels[1].ChannelId)
	assert.Equal(t, "primary-openai", channels[1].ChannelName)

	trendResponse := requireOrganizationE2ESuccess(t, performOrganizationE2ERequest(
		t, router, fixture, 1001, http.MethodGet, "/api/organization/current/billing/trend?"+billingWindow, nil,
	))
	trend := decodeOrganizationE2EData[[]model.OrganizationBillingTrendPoint](t, trendResponse)
	require.Len(t, trend, 3)
	assert.Equal(t, "2026-07-02", trend[0].Period)
	assert.Equal(t, 120, trend[0].TotalQuota)
	assert.Equal(t, "2026-07-05", trend[1].Period)
	assert.Equal(t, 230, trend[1].TotalQuota)
	assert.Equal(t, "2026-07-06", trend[2].Period)
	assert.Equal(t, 70, trend[2].TotalQuota)

	var persistedLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Count(&persistedLogs).Error)
	assert.Equal(t, int64(len(fixture.Logs)), persistedLogs)
	var member model.User
	require.NoError(t, model.DB.First(&member, 1002).Error)
	assert.Equal(t, 10000, member.Quota)
	assert.Equal(t, 300, member.UsedQuota)
}
