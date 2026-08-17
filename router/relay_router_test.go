package router

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/origin"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type originModelsControl struct {
	result    origin.OriginModelList
	err       error
	originKey string
	requestID string
}

func (control *originModelsControl) CreateAdmission(
	context.Context, string, origin.AdmissionRequest,
) (origin.AdmissionResult, error) {
	panic("model discovery must not create an admission")
}

func (control *originModelsControl) FetchCatalog(
	context.Context, string, string,
) (origin.CatalogFetchResult, error) {
	panic("model discovery must not fetch the execution catalog")
}

func (control *originModelsControl) ListOriginModels(
	_ context.Context, originKey, requestID, _ string,
) (origin.OriginModelList, error) {
	control.originKey = originKey
	control.requestID = requestID
	return control.result, control.err
}

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

func TestListModelsUsesPlatformAuthorityForOriginKey(t *testing.T) {
	setupRelayRouterTestDB(t)
	const originKey = "sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd"
	control := &originModelsControl{result: origin.OriginModelList{
		RequestID:      "01980000-0000-7000-8000-000000000030",
		TenantID:       "01980000-0000-7000-8000-000000000003",
		ProjectID:      "01980000-0000-7000-8000-000000000004",
		APIKeyID:       "01980000-0000-7000-8000-000000000005",
		CatalogVersion: 42,
		Models:         []string{"origin-agent"},
	}}
	restore := origin.ConfigureForTest(true, origin.NewManager(control, nil, time.Now))
	t.Cleanup(restore)
	engine := gin.New()
	SetRelayRouter(engine)
	request := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	request.Header.Set("Authorization", "Bearer "+originKey)
	recorder := httptest.NewRecorder()

	engine.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, originKey, control.originKey)
	assert.NotEmpty(t, control.requestID)
	assert.Equal(t, control.requestID, recorder.Header().Get("X-Request-Id"))
	assert.NotContains(t, recorder.Body.String(), originKey)
	assert.NotContains(t, recorder.Body.String(), "beenex")
	var payload struct {
		Object string `json:"object"`
		Data   []struct {
			ID      string `json:"id"`
			Object  string `json:"object"`
			OwnedBy string `json:"owned_by"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	assert.Equal(t, "list", payload.Object)
	require.Len(t, payload.Data, 1)
	assert.Equal(t, "origin-agent", payload.Data[0].ID)
	assert.Equal(t, "model", payload.Data[0].Object)
	assert.Equal(t, "origin", payload.Data[0].OwnedBy)
}

func TestListModelsFailsClosedWhenOriginPlatformIsUnavailable(t *testing.T) {
	setupRelayRouterTestDB(t)
	restore := origin.ConfigureForTest(true, nil)
	t.Cleanup(restore)
	engine := gin.New()
	SetRelayRouter(engine)
	request := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
	request.Header.Set("Authorization", "Bearer sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd")
	recorder := httptest.NewRecorder()

	engine.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "platform_unavailable")
	assert.NotContains(t, recorder.Body.String(), "sk-oa-")
}

func TestListModelsMapsPlatformOriginKeyDenialsWithoutLeakingDetails(t *testing.T) {
	setupRelayRouterTestDB(t)
	tests := []struct {
		name       string
		platform   int
		code       string
		wantStatus int
		wantCode   string
	}{
		{name: "invalid key", platform: http.StatusUnauthorized, code: "origin_key_invalid", wantStatus: http.StatusUnauthorized, wantCode: "invalid_api_key"},
		{name: "disabled key", platform: http.StatusForbidden, code: "origin_key_disabled", wantStatus: http.StatusForbidden, wantCode: "access_denied"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			control := &originModelsControl{err: &origin.ControlError{
				Status: test.platform,
				Code:   test.code,
			}}
			restore := origin.ConfigureForTest(true, origin.NewManager(control, nil, time.Now))
			defer restore()
			engine := gin.New()
			SetRelayRouter(engine)
			request := httptest.NewRequest(http.MethodGet, "/v1/models", nil)
			request.Header.Set("Authorization", "Bearer sk-oa-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcd")
			recorder := httptest.NewRecorder()

			engine.ServeHTTP(recorder, request)

			assert.Equal(t, test.wantStatus, recorder.Code)
			assert.Contains(t, recorder.Body.String(), test.wantCode)
			assert.NotContains(t, recorder.Body.String(), test.code)
			assert.NotContains(t, recorder.Body.String(), "sk-oa-")
		})
	}
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
