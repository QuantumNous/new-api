package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestDesktopV2ConnectCodeRoutesRequireExpectedAuthority(t *testing.T) {
	previousRedis := common.RedisEnabled
	previousClient := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = previousRedis
		common.RDB = previousClient
	})

	router := newDesktopV2TestRouter()

	issue := httptest.NewRecorder()
	issueReq := httptest.NewRequest(http.MethodPost, "/api/desktop/v2/connect-codes", strings.NewReader(`{}`))
	issueReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(issue, issueReq)
	assert.Equal(t, http.StatusUnauthorized, issue.Code)
	assert.Contains(t, issue.Body.String(), "session_required")

	exchange := httptest.NewRecorder()
	exchangeReq := httptest.NewRequest(http.MethodPost, "/api/desktop/v2/connect-codes/exchange", strings.NewReader(`{"code":"`+strings.Repeat("a", 48)+`"}`))
	exchangeReq.Header.Set("Content-Type", "application/json")
	exchangeReq.Host = "yeschoy.com"
	router.ServeHTTP(exchange, exchangeReq)
	assert.Equal(t, http.StatusServiceUnavailable, exchange.Code)
	assert.Contains(t, exchange.Body.String(), "temporarily_unavailable")
}
