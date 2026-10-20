package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListModelsSupportsOpenAIAndGeminiAuthentication(t *testing.T) {
	setupRelayRouterTestDB(t)

	user := model.User{
		Username: "models-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    100,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:         user.Id,
		Key:            "modelstestkey",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)

	engine := gin.New()
	SetRelayRouter(engine)

	tests := []struct {
		name           string
		path           string
		headerName     string
		expectedObject string
		expectedField  string
	}{
		{
			name:           "OpenAI bearer token",
			path:           "/v1/models",
			headerName:     "Authorization",
			expectedObject: "list",
			expectedField:  "data",
		},
		{
			name:          "Gemini API key header",
			path:          "/v1/models",
			headerName:    "x-goog-api-key",
			expectedField: "models",
		},
		{
			name:          "Gemini API key query",
			path:          "/v1/models?key=modelstestkey",
			expectedField: "models",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			if test.headerName != "" {
				value := "modelstestkey"
				if test.headerName == "Authorization" {
					value = "Bearer " + value
				}
				request.Header.Set(test.headerName, value)
			}

			engine.ServeHTTP(recorder, request)

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.Contains(t, payload, test.expectedField)
			assert.NotContains(t, payload, "error")
			if test.expectedObject != "" {
				assert.Equal(t, test.expectedObject, payload["object"])
			}
		})
	}
}

func TestCreditsEndpointWithAPIKey(t *testing.T) {
	require.NoError(t, i18n.Init())
	setupRelayRouterTestDB(t)
	originalDisplayType := operation_setting.GetGeneralSetting().QuotaDisplayType
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD
	t.Cleanup(func() { operation_setting.GetGeneralSetting().QuotaDisplayType = originalDisplayType })

	user := model.User{
		Username: "credits-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    int(common.QuotaPerUnit * 5),
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:              user.Id,
		Key:                 "creditstestkey",
		Status:              common.TokenStatusEnabled,
		ExpiredTime:         -1,
		RemainQuota:         int(common.QuotaPerUnit),
		AllowUserQuotaQuery: true,
	}).Error)

	engine := gin.New()
	SetDashboardRouter(engine)
	SetRelayRouter(engine)

	paths := []struct {
		name       string
		path       string
		headerName string
		headerAuth string
	}{
		{
			name:       "GET /v1/credits with Bearer header",
			path:       "/v1/credits",
			headerAuth: "Bearer creditstestkey",
		},
		{
			name:       "GET /credits with Bearer header",
			path:       "/credits",
			headerAuth: "Bearer creditstestkey",
		},
		{
			name: "GET /v1/credits with query key",
			path: "/v1/credits?key=creditstestkey",
		},
		{
			name: "GET /credits with query key",
			path: "/credits?key=creditstestkey",
		},
		{
			name: "GET /v1/credits with query api_key",
			path: "/v1/credits?api_key=creditstestkey",
		},
		{
			name: "GET /credits with query apiKey",
			path: "/credits?apiKey=creditstestkey",
		},
		{
			name:       "GET /v1/credits/ with trailing slash",
			path:       "/v1/credits/",
			headerAuth: "Bearer creditstestkey",
		},
		{
			name:       "GET /credits/ with trailing slash",
			path:       "/credits/",
			headerAuth: "Bearer creditstestkey",
		},
		{
			name:       "Claude API key without anthropic-version",
			path:       "/v1/credits",
			headerName: "x-api-key",
			headerAuth: "sk-creditstestkey",
		},
		{
			name:       "Claude API key with unversioned trailing slash",
			path:       "/credits/",
			headerName: "x-api-key",
			headerAuth: "creditstestkey",
		},
		{
			name:       "Gemini API key on v1",
			path:       "/v1/credits",
			headerName: "x-goog-api-key",
			headerAuth: "creditstestkey",
		},
		{
			name:       "Gemini API key on v1beta",
			path:       "/v1beta/credits",
			headerName: "x-goog-api-key",
			headerAuth: "sk-creditstestkey",
		},
		{
			name:       "Gemini API key with trailing slash",
			path:       "/v1beta/credits/",
			headerName: "x-goog-api-key",
			headerAuth: "creditstestkey",
		},
		{
			name:       "Bearer token on v1beta",
			path:       "/v1beta/credits",
			headerAuth: "Bearer creditstestkey",
		},
		{
			name:       "Gemini query cannot choose a different account",
			path:       "/v1beta/credits?user_id=999999&id=999999",
			headerName: "x-goog-api-key",
			headerAuth: "creditstestkey",
		},
	}

	for _, tc := range paths {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			if tc.headerAuth != "" {
				headerName := tc.headerName
				if headerName == "" {
					headerName = "Authorization"
				}
				req.Header.Set(headerName, tc.headerAuth)
			}
			engine.ServeHTTP(recorder, req)

			require.Equal(t, http.StatusOK, recorder.Code)
			assert.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")
			var payload map[string]any
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
			assert.Equal(t, "credit_summary", payload["object"])
			data, ok := payload["data"].(map[string]any)
			require.True(t, ok)
			assert.Equal(t, float64(5), data["total_usage"])
		})
	}

	for _, queryName := range []string{"key", "api_key", "apiKey"} {
		t.Run("Gemini credentials are not accepted in URL/"+queryName, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/v1beta/credits?"+queryName+"=creditstestkey", nil)
			engine.ServeHTTP(recorder, request)
			assert.Equal(t, http.StatusUnauthorized, recorder.Code)
			assert.NotContains(t, recorder.Body.String(), "creditstestkey")
		})
	}

	t.Run("GET /v1/credits with unlimited token returns user quota instead of 100000000", func(t *testing.T) {
		unlimitedToken := model.Token{
			UserId:              user.Id,
			Key:                 "unlimitedcredittestkey",
			Status:              common.TokenStatusEnabled,
			ExpiredTime:         -1,
			UnlimitedQuota:      true,
			AllowUserQuotaQuery: true,
		}
		require.NoError(t, model.DB.Create(&unlimitedToken).Error)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/v1/credits", nil)
		req.Header.Set("Authorization", "Bearer unlimitedcredittestkey")
		engine.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		var payload map[string]any
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
		data, ok := payload["data"].(map[string]any)
		require.True(t, ok)
		assert.Equal(t, float64(5), data["total_usage"])
		assert.Equal(t, float64(5), payload["total_available"])
	})

	t.Run("all formats enforce revoked user quota permission", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.Token{}).Where("key = ?", "creditstestkey").Update("allow_user_quota_query", false).Error)
		for _, tc := range []struct{ path, header, value string }{
			{"/v1/credits", "Authorization", "Bearer creditstestkey"},
			{"/v1/credits", "x-api-key", "creditstestkey"},
			{"/v1beta/credits", "x-goog-api-key", "creditstestkey"},
		} {
			t.Run(tc.header, func(t *testing.T) {
				recorder := httptest.NewRecorder()
				request := httptest.NewRequest(http.MethodGet, tc.path, nil)
				request.Header.Set(tc.header, tc.value)
				engine.ServeHTTP(recorder, request)
				assert.Equal(t, http.StatusForbidden, recorder.Code)
				var payload map[string]any
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
				assert.Contains(t, payload, "error")
				assert.NotContains(t, payload, "data")
			})
		}
	})
}

func TestCreditsNativeAuthenticationEnforcesTokenRestrictions(t *testing.T) {
	require.NoError(t, i18n.Init())
	setupRelayRouterTestDB(t)
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetDashboardRouter(engine)

	for _, protocol := range []struct{ name, path, header string }{
		{"Claude", "/v1/credits", "x-api-key"},
		{"Gemini", "/v1beta/credits", "x-goog-api-key"},
	} {
		for i, tc := range []struct {
			name        string
			tokenStatus int
			expired     bool
			exhausted   bool
			banned      bool
			allowIPs    string
			missingKey  bool
			invalidKey  bool
			bearer      bool
			wantStatus  int
		}{
			{name: "missing key", missingKey: true, wantStatus: http.StatusUnauthorized},
			{name: "invalid key", invalidKey: true, wantStatus: http.StatusUnauthorized},
			{name: "disabled token", tokenStatus: common.TokenStatusDisabled, wantStatus: http.StatusUnauthorized},
			{name: "expired token", expired: true, wantStatus: http.StatusUnauthorized},
			{name: "exhausted token", exhausted: true, wantStatus: http.StatusUnauthorized},
			{name: "banned user", banned: true, wantStatus: http.StatusForbidden},
			{name: "IP restriction", allowIPs: "192.0.2.0/24", wantStatus: http.StatusForbidden},
			{name: "invalid native key cannot fall back to bearer", invalidKey: true, bearer: true, wantStatus: http.StatusUnauthorized},
		} {
			t.Run(protocol.name+"/"+tc.name, func(t *testing.T) {
				identity := fmt.Sprintf("creditguard%s%d", protocol.name, i)
				user := model.User{
					Username: identity, AffCode: identity,
					Status: common.UserStatusEnabled, Group: "default", Quota: int(common.QuotaPerUnit * 5),
				}
				if tc.banned {
					user.Status = common.UserStatusDisabled
				}
				require.NoError(t, model.DB.Create(&user).Error)
				token := model.Token{
					UserId: user.Id, Key: identity,
					Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: int(common.QuotaPerUnit),
					AllowUserQuotaQuery: true,
				}
				if tc.tokenStatus != 0 {
					token.Status = tc.tokenStatus
				}
				if tc.expired {
					token.ExpiredTime = time.Now().Add(-time.Minute).Unix()
				}
				if tc.exhausted {
					token.RemainQuota = 0
				}
				if tc.allowIPs != "" {
					token.AllowIps = &tc.allowIPs
				}
				require.NoError(t, model.DB.Create(&token).Error)

				request := httptest.NewRequest(http.MethodGet, protocol.path, nil)
				request.RemoteAddr = "127.0.0.1:12345"
				if !tc.missingKey {
					key := token.Key
					if tc.invalidKey {
						key = "invalidnativekey"
					}
					request.Header.Set(protocol.header, key)
				}
				if tc.bearer {
					request.Header.Set("Authorization", "Bearer "+token.Key)
				}
				recorder := httptest.NewRecorder()
				engine.ServeHTTP(recorder, request)
				require.Equal(t, tc.wantStatus, recorder.Code)
				assert.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")
				var payload map[string]any
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
				assert.Contains(t, payload, "error")
				assert.NotContains(t, payload, "data")
				assert.NotContains(t, recorder.Body.String(), token.Key)
			})
		}
	}
}

func TestGeminiModelEndpointsOnRouter(t *testing.T) {
	setupRelayRouterTestDB(t)

	originalSelfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = true
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = originalSelfUse
	})

	user := model.User{
		Username: "gemini-models-user",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    100,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NoError(t, model.DB.Create(&model.Token{
		UserId:         user.Id,
		Key:            "geminitestkey",
		Status:         common.TokenStatusEnabled,
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gemini-2.5-flash",
		ChannelId: 1,
		Enabled:   true,
	}).Error)

	engine := gin.New()
	SetRelayRouter(engine)

	// Test GET /v1beta/models
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1beta/models?key=geminitestkey", nil)
	engine.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusOK, recorder.Code)
	var listResp map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &listResp))
	modelsList, ok := listResp["models"].([]any)
	require.True(t, ok)
	require.Len(t, modelsList, 1)
	firstModel := modelsList[0].(map[string]any)
	assert.Equal(t, "models/gemini-2.5-flash", firstModel["name"])
	assert.Equal(t, "gemini-2.5-flash", firstModel["baseModelId"])

	// Test GET /v1beta/models/ (trailing slash)
	recorderSlash := httptest.NewRecorder()
	reqSlash := httptest.NewRequest(http.MethodGet, "/v1beta/models/?key=geminitestkey", nil)
	engine.ServeHTTP(recorderSlash, reqSlash)
	require.Equal(t, http.StatusOK, recorderSlash.Code)

	// Test GET /v1beta/models/:model
	recorder2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/v1beta/models/gemini-2.5-flash?key=geminitestkey", nil)
	engine.ServeHTTP(recorder2, req2)
	require.Equal(t, http.StatusOK, recorder2.Code)
	var singleResp map[string]any
	require.NoError(t, common.Unmarshal(recorder2.Body.Bytes(), &singleResp))
	assert.Equal(t, "models/gemini-2.5-flash", singleResp["name"])

	// Test GET /v1beta/models/models/:model
	recorder3 := httptest.NewRecorder()
	req3 := httptest.NewRequest(http.MethodGet, "/v1beta/models/models/gemini-2.5-flash?key=geminitestkey", nil)
	engine.ServeHTTP(recorder3, req3)
	require.Equal(t, http.StatusOK, recorder3.Code)
	var singleResp3 map[string]any
	require.NoError(t, common.Unmarshal(recorder3.Body.Bytes(), &singleResp3))
	assert.Equal(t, "models/gemini-2.5-flash", singleResp3["name"])

	// Test GET /v1/models/:model with key query (Gemini mode)
	recorderV1 := httptest.NewRecorder()
	reqV1 := httptest.NewRequest(http.MethodGet, "/v1/models/gemini-2.5-flash?key=geminitestkey", nil)
	engine.ServeHTTP(recorderV1, reqV1)
	require.Equal(t, http.StatusOK, recorderV1.Code)
	var singleRespV1 map[string]any
	require.NoError(t, common.Unmarshal(recorderV1.Body.Bytes(), &singleRespV1))
	assert.Equal(t, "models/gemini-2.5-flash", singleRespV1["name"])
}

func setupRelayRouterTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalIsMasterNode := common.IsMasterNode
	originalRedisEnabled := common.RedisEnabled
	originalSQLitePath := common.SQLitePath
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")

	common.IsMasterNode = false
	common.RedisEnabled = false
	common.SQLitePath = fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	require.NoError(t, model.InitDB())
	model.LOG_DB = model.DB
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Token{}, &model.Ability{}))

	t.Cleanup(func() {
		if sqlDB, err := model.DB.DB(); err == nil {
			_ = sqlDB.Close()
		}
		common.IsMasterNode = originalIsMasterNode
		common.RedisEnabled = originalRedisEnabled
		common.SQLitePath = originalSQLitePath
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})
}
