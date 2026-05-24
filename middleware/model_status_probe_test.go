package middleware

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	appi18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelStatusProbeTestDB(t *testing.T) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	require.NoError(t, appi18n.Init())
	originalIsMasterNode := common.IsMasterNode
	originalSQLitePath := common.SQLitePath
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalSQLDSN, hadSQLDSN := os.LookupEnv("SQL_DSN")
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMasterNode
		common.SQLitePath = originalSQLitePath
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		if hadSQLDSN {
			require.NoError(t, os.Setenv("SQL_DSN", originalSQLDSN))
		} else {
			require.NoError(t, os.Unsetenv("SQL_DSN"))
		}
	})

	common.IsMasterNode = false
	common.SQLitePath = fmt.Sprintf("file:%s_init?mode=memory&cache=shared", t.Name())
	require.NoError(t, os.Setenv("SQL_DSN", "local"))
	common.UsingSQLite = false
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	require.NoError(t, model.InitDB())
	if model.DB != nil {
		sqlDB, err := model.DB.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	}

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}, &model.Model{}, &model.Vendor{}))
	require.NoError(t, db.Create(&model.User{
		Id:       2001,
		Username: "probe-user",
		Password: "password",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:     8101,
		Type:   constant.ChannelTypeAzure,
		Name:   "Azure image probe",
		Status: common.ChannelStatusEnabled,
		Models: "gpt-image-2",
		Group:  "default",
		Key:    "test-key",
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-image-2",
		ChannelId: 8101,
		Enabled:   true,
	}).Error)
	model.InvalidatePricingCache()
	t.Cleanup(func() {
		model.InvalidatePricingCache()
		resetModelStatusProbeStateForTest()
		modelStatusProbeShouldSampleError = func(count int) bool {
			if count < modelStatusProbeStatusThreshold {
				return true
			}
			return common.GetRandomInt(10) == 0
		}
	})
}

func performProbeDistributeRequest(t *testing.T, body string) (*httptest.ResponseRecorder, bool) {
	t.Helper()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.Use(Distribute())
	reached := false
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		reached = true
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(recorder, req)
	return recorder, reached
}

func TestImageGenerationEndpointIsNotTreatedAsMismatchProbe(t *testing.T) {
	setupModelStatusProbeTestDB(t)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
		c.Next()
	})
	router.Use(Distribute())
	reached := false
	router.POST("/v1/images/generations", func(c *gin.Context) {
		reached = true
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewBufferString(`{"model":"gpt-image-2","prompt":"ping"}`))
	req.Header.Set("Content-Type", "application/json")

	router.ServeHTTP(recorder, req)

	require.True(t, reached)
	require.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestDistributeRejectsFirstImageModelChatProbeAsEndpointMismatch(t *testing.T) {
	setupModelStatusProbeTestDB(t)

	recorder, reached := performProbeDistributeRequest(t, `{"model":"gpt-image-2","messages":[{"role":"user","content":"ping"}]}`)

	require.False(t, reached)
	require.Equal(t, http.StatusBadRequest, recorder.Code)
	require.Contains(t, recorder.Body.String(), "model_endpoint_mismatch")
	require.Contains(t, recorder.Body.String(), "/v1/images/generations")
}

func TestDistributeRoutesRepeatedImageModelChatProbeToStatus(t *testing.T) {
	setupModelStatusProbeTestDB(t)
	modelStatusProbeShouldSampleError = func(count int) bool {
		return count < modelStatusProbeStatusThreshold
	}
	body := `{"model":"gpt-image-2","messages":[{"role":"user","content":"ping"}]}`

	for i := 0; i < modelStatusProbeStatusThreshold-1; i++ {
		recorder, reached := performProbeDistributeRequest(t, body)
		require.False(t, reached)
		require.Equal(t, http.StatusBadRequest, recorder.Code)
	}

	recorder, reached := performProbeDistributeRequest(t, body)

	require.False(t, reached)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"model":"gpt-image-2"`)
	require.Contains(t, recorder.Body.String(), `"available":true`)
	require.Contains(t, recorder.Body.String(), `"request_classification":"repeated_endpoint_mismatch_probe"`)
}

func TestDistributeRandomlyKeepsEndpointMismatchErrorForRepeatedProbe(t *testing.T) {
	setupModelStatusProbeTestDB(t)
	modelStatusProbeShouldSampleError = func(count int) bool {
		return true
	}
	body := `{"model":"gpt-image-2","messages":[{"role":"user","content":"ping"}]}`

	for i := 0; i < modelStatusProbeStatusThreshold; i++ {
		recorder, reached := performProbeDistributeRequest(t, body)
		require.False(t, reached)
		require.Equal(t, http.StatusBadRequest, recorder.Code)
		require.Contains(t, recorder.Body.String(), "model_endpoint_mismatch")
	}
}
