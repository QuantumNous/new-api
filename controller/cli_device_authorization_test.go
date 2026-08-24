package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	backendI18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type cliDeviceAuthorizationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		VerificationURI         string `json:"verification_uri"`
		VerificationURIComplete string `json:"verification_uri_complete"`
	} `json:"data"`
}

func setupCliDeviceAuthorizationControllerTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/cli-device-authorization-controller.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.CliDeviceAuthorization{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
}

func newCliDeviceAuthorizationRequestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/cli/device_authorizations", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Request.Header.Set("Accept-Language", "en")
	return ctx, recorder
}

func TestCreateCliDeviceAuthorizationRejectsOversizedMetadata(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	setupCliDeviceAuthorizationControllerTestDB(t)

	ctx, recorder := newCliDeviceAuthorizationRequestContext(t, `{"device_id":"device","client_name":"`+strings.Repeat("a", cliDeviceAuthorizationMaxClientName+1)+`"}`)
	CreateCliDeviceAuthorization(ctx)

	var response cliDeviceAuthorizationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.False(t, response.Success)
	require.Equal(t, "CLI device metadata is too long", response.Message)

	var count int64
	require.NoError(t, model.DB.Model(&model.CliDeviceAuthorization{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestCreateCliDeviceAuthorizationUsesConfiguredConsoleOrigin(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	setupCliDeviceAuthorizationControllerTestDB(t)

	originalTheme := common.GetTheme()
	originalServerAddress := system_setting.ServerAddress
	originalAppConsoleOrigin := system_setting.GetAppConsoleSettings().Origin
	t.Cleanup(func() {
		common.SetTheme(originalTheme)
		system_setting.ServerAddress = originalServerAddress
		system_setting.GetAppConsoleSettings().Origin = originalAppConsoleOrigin
	})

	common.SetTheme("default")
	system_setting.ServerAddress = "https://router.flatkey.ai"
	system_setting.GetAppConsoleSettings().Origin = "https://console.flatkey.ai/"

	ctx, recorder := newCliDeviceAuthorizationRequestContext(t, `{"device_id":"device","client_name":"flatkey-cli"}`)
	ctx.Request.Host = "attacker.example"
	ctx.Request.Header.Set("X-Forwarded-Proto", "http")
	CreateCliDeviceAuthorization(ctx)

	var response cliDeviceAuthorizationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
	require.Equal(t, "https://console.flatkey.ai/cli/authorize", response.Data.VerificationURI)
	require.True(t, strings.HasPrefix(response.Data.VerificationURIComplete, "https://console.flatkey.ai/cli/authorize?user_code="))
	require.NotContains(t, response.Data.VerificationURIComplete, "attacker.example")
}

func TestCreateCliDeviceAuthorizationThrottlesCleanup(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	setupCliDeviceAuthorizationControllerTestDB(t)

	originalNextCleanup := nextCliDeviceAuthorizationCleanupAt.Load()
	originalCleanup := cleanupExpiredCliDeviceAuthorizations
	t.Cleanup(func() {
		nextCliDeviceAuthorizationCleanupAt.Store(originalNextCleanup)
		cleanupExpiredCliDeviceAuthorizations = originalCleanup
	})
	nextCliDeviceAuthorizationCleanupAt.Store(0)
	calls := 0
	cleanupExpiredCliDeviceAuthorizations = func(before int64, limit int) (int64, error) {
		calls++
		require.Equal(t, cliDeviceAuthorizationCleanupBatchSize, limit)
		return 0, nil
	}

	ctx, firstRecorder := newCliDeviceAuthorizationRequestContext(t, `{"device_id":"device-1"}`)
	CreateCliDeviceAuthorization(ctx)
	require.Equal(t, http.StatusOK, firstRecorder.Code)

	ctx, secondRecorder := newCliDeviceAuthorizationRequestContext(t, `{"device_id":"device-2"}`)
	CreateCliDeviceAuthorization(ctx)
	require.Equal(t, http.StatusOK, secondRecorder.Code)

	require.Equal(t, 1, calls)
}

func TestCreateCliDeviceAuthorizationContinuesWhenCleanupFails(t *testing.T) {
	require.NoError(t, backendI18n.Init())
	setupCliDeviceAuthorizationControllerTestDB(t)

	originalNextCleanup := nextCliDeviceAuthorizationCleanupAt.Load()
	originalCleanup := cleanupExpiredCliDeviceAuthorizations
	t.Cleanup(func() {
		nextCliDeviceAuthorizationCleanupAt.Store(originalNextCleanup)
		cleanupExpiredCliDeviceAuthorizations = originalCleanup
	})
	nextCliDeviceAuthorizationCleanupAt.Store(0)
	cleanupExpiredCliDeviceAuthorizations = func(before int64, limit int) (int64, error) {
		return 0, errors.New("cleanup failed")
	}

	ctx, recorder := newCliDeviceAuthorizationRequestContext(t, `{"device_id":"device"}`)
	CreateCliDeviceAuthorization(ctx)

	var response cliDeviceAuthorizationResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success, response.Message)
}
