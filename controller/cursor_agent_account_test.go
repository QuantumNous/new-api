package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/cursor_agent"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGetCursorAgentChannelAccountUsesImmutableRuntimeAndRedactsCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	require.NoError(t, db.AutoMigrate(&model.Channel{}))

	var sawAccount bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/account", r.URL.Path)
		require.Equal(t, "Bearer secret-cursor-key", r.Header.Get("Authorization"))
		require.Equal(t, "secret-cursor-key", r.Header.Get("x-api-key"))
		sawAccount = true
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"account":{"api_key_name":"new-api test","email":"owner@example.com"},"catalog":{"model_count":36}}`))
	}))
	defer upstream.Close()
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", upstream.URL)

	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/exchange_user_api_key":
			require.Equal(t, "Bearer secret-cursor-key", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"accessToken":"dashboard-access"}`))
		case "/aiserver.v1.DashboardService/GetCurrentPeriodUsage":
			require.Equal(t, "Bearer dashboard-access", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"planUsage":{"includedSpend":100,"remaining":900,"limit":1000}}`))
		case "/aiserver.v1.DashboardService/GetPlanInfo":
			require.Equal(t, "Bearer dashboard-access", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"planInfo":{"planName":"Pro"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	legacyBase := "http://legacy-sidecar.invalid"
	channel := &model.Channel{
		Type:      constant.ChannelTypeCursorAgent,
		Key:       `{"api_key":"secret-cursor-key","access_token":"legacy-access","refresh_token":"legacy-refresh"}`,
		Name:      "cursor-account",
		Status:    common.ChannelStatusEnabled,
		BaseURL:   &legacyBase,
		UsedQuota: 12345,
	}
	require.NoError(t, db.Create(channel).Error)

	router := gin.New()
	router.GET("/api/channel/:id/cursor-agent/account", GetCursorAgentChannelAccount)
	req := httptest.NewRequest(http.MethodGet, "/api/channel/"+strconv.Itoa(channel.Id)+"/cursor-agent/account", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response map[string]any
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, true, response["success"])
	data := response["data"].(map[string]any)
	require.Equal(t, "owner@example.com", data["account"].(map[string]any)["email"])
	require.Equal(t, float64(12345), data["gateway"].(map[string]any)["used_quota"])
	require.Equal(t, true, data["quota"].(map[string]any)["available"])
	require.InDelta(t, 9, data["quota"].(map[string]any)["remaining_usd"], 0.001)
	require.NotContains(t, recorder.Body.String(), "secret-cursor-key")
	require.NotContains(t, recorder.Body.String(), "dashboard-access")
	require.NotContains(t, recorder.Body.String(), "legacy-access")
	require.NotContains(t, recorder.Body.String(), "legacy-refresh")
	require.True(t, sawAccount)
}

func TestFetchCursorDashboardQuotaReadsPersonalPlanUsage(t *testing.T) {
	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/exchange_user_api_key":
			require.Equal(t, "Bearer sdk-key", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"accessToken":"access"}`))
		case "/aiserver.v1.DashboardService/GetCurrentPeriodUsage":
			require.Equal(t, "Bearer access", r.Header.Get("Authorization"))
			require.Equal(t, "1", r.Header.Get("Connect-Protocol-Version"))
			_, _ = w.Write([]byte(`{"billingCycleStart":"1786520259000","billingCycleEnd":"1789198659000","planUsage":{"totalSpend":1965,"includedSpend":1965,"remaining":38035,"limit":40000,"autoPercentUsed":0.307,"apiPercentUsed":2.702,"totalPercentUsed":0.786}}`))
		case "/aiserver.v1.DashboardService/GetPlanInfo":
			require.Equal(t, "Bearer access", r.Header.Get("Authorization"))
			_, _ = w.Write([]byte(`{"planInfo":{"planName":"Ultra","includedAmountCents":40000,"price":"$200/mo","billingCycleEnd":"1789198659000","planOwner":"PLAN_OWNER_STRIPE"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	quota, err := fetchCursorDashboardQuota(ctx, dashboard.Client(), &cursor_agent.Credential{APIKey: "sdk-key"})
	require.NoError(t, err)
	require.Equal(t, true, quota["available"])
	require.Equal(t, "Ultra", quota["plan_name"])
	require.InDelta(t, 19.65, quota["used_usd"], 0.001)
	require.InDelta(t, 380.35, quota["remaining_usd"], 0.001)
	require.InDelta(t, 400, quota["limit_usd"], 0.001)
	require.InDelta(t, 4.9125, quota["used_percent"], 0.001)
	require.InDelta(t, 2.702, quota["other_models_percent_used"], 0.001)
}

func TestFetchCursorDashboardQuotaReexchangesAPIKeyAfterUnauthorized(t *testing.T) {
	var usageCalls int
	var exchangeCalls int
	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/exchange_user_api_key":
			exchangeCalls++
			require.Equal(t, "Bearer sdk", r.Header.Get("Authorization"))
			if exchangeCalls == 1 {
				_, _ = w.Write([]byte(`{"accessToken":"stale"}`))
				return
			}
			_, _ = w.Write([]byte(`{"accessToken":"fresh"}`))
		case "/aiserver.v1.DashboardService/GetCurrentPeriodUsage":
			usageCalls++
			if r.Header.Get("Authorization") != "Bearer fresh" {
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"expired"}`))
				return
			}
			_, _ = w.Write([]byte(`{"planUsage":{"includedSpend":100,"remaining":900,"limit":1000}}`))
		case "/aiserver.v1.DashboardService/GetPlanInfo":
			_, _ = w.Write([]byte(`{"planInfo":{"planName":"Pro"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	credential := &cursor_agent.Credential{APIKey: "sdk"}
	quota, err := fetchCursorDashboardQuota(context.Background(), dashboard.Client(), credential)
	require.NoError(t, err)
	require.Equal(t, true, quota["available"])
	require.Equal(t, 2, usageCalls)
	require.Equal(t, 2, exchangeCalls)
}

func TestFetchCursorDashboardQuotaExchangeFailureDoesNotLeakAPIKey(t *testing.T) {
	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/auth/exchange_user_api_key", r.URL.Path)
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"rejected secret-sdk-key"}`))
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	quota, err := fetchCursorDashboardQuota(context.Background(), dashboard.Client(), &cursor_agent.Credential{APIKey: "secret-sdk-key"})
	require.Error(t, err)
	require.NotContains(t, err.Error(), "secret-sdk-key")
	require.Equal(t, false, quota["available"])
	require.Equal(t, "api_key_invalid", quota["reason"])
	require.Equal(t, http.StatusUnauthorized, quota["status"])
}

func TestFetchCursorDashboardQuotaExchangeUnavailableIsNotReportedAsInvalidKey(t *testing.T) {
	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	quota, err := fetchCursorDashboardQuota(context.Background(), dashboard.Client(), &cursor_agent.Credential{APIKey: "sdk-key"})
	require.Error(t, err)
	require.Equal(t, false, quota["available"])
	require.Equal(t, "exchange_unavailable", quota["reason"])
	require.Equal(t, http.StatusServiceUnavailable, quota["status"])
}

func TestExchangeCursorAPIKeyConcurrentWaiterSurvivesLeaderCancellation(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	var exchangeCalls atomic.Int32
	dashboard := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if exchangeCalls.Add(1) == 1 {
			close(started)
		}
		<-release
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"accessToken":"shared-access"}`))
	}))
	defer dashboard.Close()
	previousBaseURL := cursorDashboardAPIBaseURL
	cursorDashboardAPIBaseURL = dashboard.URL
	t.Cleanup(func() { cursorDashboardAPIBaseURL = previousBaseURL })

	type exchangeResult struct {
		token string
		err   error
	}
	firstCtx, cancelFirst := context.WithCancel(context.Background())
	firstResult := make(chan exchangeResult, 1)
	go func() {
		token, err := exchangeCursorAPIKeyForAccessToken(firstCtx, dashboard.Client(), "shared-key")
		firstResult <- exchangeResult{token: token, err: err}
	}()
	<-started

	secondResult := make(chan exchangeResult, 1)
	go func() {
		token, err := exchangeCursorAPIKeyForAccessToken(context.Background(), dashboard.Client(), "shared-key")
		secondResult <- exchangeResult{token: token, err: err}
	}()
	time.Sleep(20 * time.Millisecond)
	cancelFirst()
	close(release)

	first := <-firstResult
	require.ErrorIs(t, first.err, context.Canceled)
	second := <-secondResult
	require.NoError(t, second.err)
	require.Equal(t, "shared-access", second.token)
	require.Equal(t, int32(1), exchangeCalls.Load())
}
