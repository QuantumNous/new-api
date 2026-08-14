package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/observability"
	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/store"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestHealthEndpointsReflectProcessAndDatabaseReadiness(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	router := New(db)

	live := httptest.NewRecorder()
	router.ServeHTTP(live, httptest.NewRequest(http.MethodGet, RouteHealthLive, nil))
	assert.Equal(t, http.StatusNoContent, live.Code)

	ready := httptest.NewRecorder()
	router.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, RouteHealthReady, nil))
	assert.Equal(t, http.StatusNoContent, ready.Code)
}

func TestMetricsEndpointRequiresBearer(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, store.Migrate(db))
	router := New(db)
	RegisterMetricsRoute(router, observability.NewMetrics(store.New(db)), "metrics-token-which-is-long-enough-for-tests")

	unauthorized := httptest.NewRecorder()
	router.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, RouteMetrics, nil))
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	authorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, RouteMetrics, nil)
	request.Header.Set("Authorization", "Bearer metrics-token-which-is-long-enough-for-tests")
	router.ServeHTTP(authorized, request)
	assert.Equal(t, http.StatusOK, authorized.Code)
}
