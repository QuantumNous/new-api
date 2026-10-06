package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type healthzResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Uptime  int64  `json:"uptime"`
}

type readyzResponse struct {
	Status string            `json:"status"`
	Checks map[string]string `json:"checks"`
}

// setupProbeTestState points the probe at an in-memory database with Redis
// disabled and restores every global it touches, so the probe tests never leak
// state into the rest of the controller package.
func setupProbeTestState(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalRedisEnabled, originalRDB := common.RedisEnabled, common.RDB
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled, common.RDB = false, nil

	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.RedisEnabled, common.RDB = originalRedisEnabled, originalRDB
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

// callProbe invokes a probe handler directly and returns the recorded response.
func callProbe(t *testing.T, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	handler(ctx)
	return recorder
}

func decodeReadyz(t *testing.T, recorder *httptest.ResponseRecorder) readyzResponse {
	t.Helper()

	var body readyzResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	return body
}

func TestHealthzReportsLivenessWithoutDependencies(t *testing.T) {
	setupProbeTestState(t)

	originalVersion := common.Version
	common.Version = "v9.9.9-probe"
	t.Cleanup(func() { common.Version = originalVersion })

	// Liveness must not consult any dependency, so it stays 200 even with the
	// database unreachable.
	model.DB = nil
	recorder := callProbe(t, Healthz)

	require.Equal(t, http.StatusOK, recorder.Code)
	var body healthzResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "ok", body.Status)
	assert.Equal(t, "v9.9.9-probe", body.Version)
	assert.GreaterOrEqual(t, body.Uptime, int64(0))
}

func TestReadyzUnavailableWithoutMainDatabase(t *testing.T) {
	setupProbeTestState(t)
	model.DB = nil

	recorder := callProbe(t, Readyz)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	body := decodeReadyz(t, recorder)
	assert.Equal(t, "unavailable", body.Status)
	assert.Contains(t, body.Checks["database"], "down")
}

func TestReadyzReadyWithReachableDatabase(t *testing.T) {
	setupProbeTestState(t)

	recorder := callProbe(t, Readyz)

	require.Equal(t, http.StatusOK, recorder.Code)
	body := decodeReadyz(t, recorder)
	assert.Equal(t, "ok", body.Status)
	assert.Equal(t, "up", body.Checks["database"])
	assert.Equal(t, "disabled", body.Checks["redis"])
	// The log database shares the main connection here, so it must not be
	// reported as a separate check.
	assert.NotContains(t, body.Checks, "log_database")
}

func TestReadyzUnavailableWhenSeparateLogDatabaseIsDown(t *testing.T) {
	setupProbeTestState(t)

	logDB, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s_log?mode=memory&cache=shared",
		strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	require.NoError(t, err)
	sqlLogDB, err := logDB.DB()
	require.NoError(t, err)
	require.NoError(t, sqlLogDB.Close())
	model.LOG_DB = logDB

	recorder := callProbe(t, Readyz)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	body := decodeReadyz(t, recorder)
	assert.Equal(t, "up", body.Checks["database"])
	assert.Contains(t, body.Checks["log_database"], "down")
}

func TestReadyzTreatsRedisAsSoftDependencyByDefault(t *testing.T) {
	setupProbeTestState(t)
	common.RedisEnabled = true
	common.RDB = nil

	recorder := callProbe(t, Readyz)

	// Redis only degrades caching and rate limiting, so a broken client is
	// reported but must not pull the instance out of rotation.
	require.Equal(t, http.StatusOK, recorder.Code)
	body := decodeReadyz(t, recorder)
	assert.Equal(t, "ok", body.Status)
	assert.Contains(t, body.Checks["redis"], "down")
}

func TestReadyzRequiresRedisWhenOptedIn(t *testing.T) {
	setupProbeTestState(t)
	common.RedisEnabled = true
	common.RDB = nil
	t.Setenv("READYZ_REQUIRE_REDIS", "true")

	recorder := callProbe(t, Readyz)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	body := decodeReadyz(t, recorder)
	assert.Equal(t, "unavailable", body.Status)
	assert.Contains(t, body.Checks["redis"], "down")
	assert.Equal(t, "up", body.Checks["database"])
}
