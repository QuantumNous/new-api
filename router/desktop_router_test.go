package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const desktopBootstrapPath = "/api/desktop/v1/bootstrap"

func newDesktopBootstrapTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	registerDesktopRoutes(router.Group("/api"))
	return router
}

func requestDesktopBootstrap(router http.Handler, method string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, desktopBootstrapPath, nil)
	router.ServeHTTP(recorder, request)
	return recorder
}

func desktopBootstrapFixture(t *testing.T) []byte {
	t.Helper()
	fixture, err := os.ReadFile("../docs/contracts/fixtures/desktop-bootstrap/recognized.json")
	require.NoError(t, err)
	return fixture
}

func TestDesktopBootstrapHappyPath(t *testing.T) {
	response := requestDesktopBootstrap(newDesktopBootstrapTestRouter(), http.MethodGet)

	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "application/json; charset=utf-8", response.Header().Get("Content-Type"))
	assert.JSONEq(t, string(desktopBootstrapFixture(t)), response.Body.String())
}

func TestDesktopBootstrapUnsupportedMethod(t *testing.T) {
	response := requestDesktopBootstrap(newDesktopBootstrapTestRouter(), http.MethodPost)

	assert.Equal(t, http.StatusNotFound, response.Code)
	assert.NotContains(t, response.Body.String(), "desktop-bootstrap-v1")
}

func TestDesktopBootstrapReplay(t *testing.T) {
	router := newDesktopBootstrapTestRouter()
	first := requestDesktopBootstrap(router, http.MethodGet)
	require.Equal(t, http.StatusOK, first.Code)

	for range 3 {
		replayed := requestDesktopBootstrap(router, http.MethodGet)
		require.Equal(t, http.StatusOK, replayed.Code)
		assert.Equal(t, first.Body.String(), replayed.Body.String())
	}
}

func TestDesktopBootstrapVersionIsClosed(t *testing.T) {
	response := requestDesktopBootstrap(newDesktopBootstrapTestRouter(), http.MethodGet)
	require.Equal(t, http.StatusOK, response.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			SchemaVersion        int             `json:"schema_version"`
			Service              string          `json:"service"`
			ContractID           string          `json:"contract_id"`
			MinimumClientVersion string          `json:"minimum_client_version"`
			Capabilities         map[string]bool `json:"capabilities"`
		} `json:"data"`
	}
	require.NoError(t, common.DecodeJson(response.Body, &body))
	assert.True(t, body.Success)
	assert.Equal(t, 1, body.Data.SchemaVersion)
	assert.Equal(t, "yeschoy-desktop", body.Data.Service)
	assert.Equal(t, "desktop-bootstrap-v1", body.Data.ContractID)
	assert.Equal(t, "0.1.0", body.Data.MinimumClientVersion)
	require.Len(t, body.Data.Capabilities, 6)
	for capability, enabled := range body.Data.Capabilities {
		assert.False(t, enabled, "capability %s must remain disabled", capability)
	}
}

func TestDesktopBootstrapConcurrentReads(t *testing.T) {
	router := newDesktopBootstrapTestRouter()
	expected := string(desktopBootstrapFixture(t))
	const requestCount = 16

	responses := make(chan *httptest.ResponseRecorder, requestCount)
	var waitGroup sync.WaitGroup
	for range requestCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			responses <- requestDesktopBootstrap(router, http.MethodGet)
		}()
	}
	waitGroup.Wait()
	close(responses)

	for response := range responses {
		require.Equal(t, http.StatusOK, response.Code)
		assert.JSONEq(t, expected, response.Body.String())
	}
}

func TestDesktopBootstrapRecoveryAfterBadMethod(t *testing.T) {
	router := newDesktopBootstrapTestRouter()
	badResponse := requestDesktopBootstrap(router, http.MethodPut)
	require.Equal(t, http.StatusNotFound, badResponse.Code)

	recovered := requestDesktopBootstrap(router, http.MethodGet)
	require.Equal(t, http.StatusOK, recovered.Code)
	assert.JSONEq(t, string(desktopBootstrapFixture(t)), recovered.Body.String())
}
