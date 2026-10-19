package router

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRealtimeRouterTest(t *testing.T) (*model.User, *model.Token) {
	t.Helper()
	require.NoError(t, i18n.Init())
	setupRelayRouterTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.AuthFlow{}, &model.AuditLog{}))
	pat := "realtimeticketpat"
	user := &model.User{
		Username:    "realtime-router-user",
		Password:    "password-placeholder",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		Quota:       1000,
		AffCode:     "realtime-router-aff",
		AccessToken: &pat,
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:                   user.Id,
		Key:                      "realtimerouterkey",
		Name:                     "realtime-router-token",
		Status:                   common.TokenStatusEnabled,
		ExpiredTime:              -1,
		RemainQuota:              100,
		DefaultRoutingStrategy:   "stable",
		AllowedRoutingStrategies: `["stable","latency"]`,
	}
	require.NoError(t, token.Insert())
	return user, token
}

func TestRealtimeTicketIssueRouteRequiresDashboardAuthentication(t *testing.T) {
	_, token := setupRealtimeRouterTest(t)
	engine := gin.New()
	SetApiRouter(engine)
	body := fmt.Sprintf(`{"token_id":%d,"model":"gpt-realtime"}`, token.Id)

	unauthorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/realtime/tickets", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	engine.ServeHTTP(unauthorized, request)
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	authorized := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/api/realtime/tickets", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer realtimeticketpat")
	engine.ServeHTTP(authorized, request)
	require.Equal(t, http.StatusOK, authorized.Code)
	assert.Contains(t, authorized.Body.String(), model.RealtimeTicketPrefix)
	assert.NotContains(t, authorized.Body.String(), token.Key)
}

func TestRealtimeRelayRouteConsumesTicketBeforeDistribution(t *testing.T) {
	user, token := setupRealtimeRouterTest(t)
	raw, _, err := model.CreateRealtimeTicket(model.RealtimeTicketCreate{
		UserId:          user.Id,
		TokenId:         token.Id,
		Model:           "gpt-realtime",
		RoutingStrategy: hosttypes.RoutingStrategyStable,
	})
	require.NoError(t, err)

	engine := gin.New()
	SetRelayRouter(engine)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/v1/realtime?model=gpt-realtime&ticket="+raw,
		nil,
	)
	engine.ServeHTTP(response, request)

	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
	_, err = model.ConsumeRealtimeTicket(raw, "gpt-realtime")
	assert.ErrorIs(t, err, model.ErrAuthFlowConsumed)
}

func TestRealtimeRelayRoutePreservesNativeBearerAuthentication(t *testing.T) {
	_, token := setupRealtimeRouterTest(t)
	engine := gin.New()
	SetRelayRouter(engine)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/realtime?model=gpt-realtime", nil)
	request.Header.Set("Authorization", "Bearer "+token.Key)
	engine.ServeHTTP(response, request)

	assert.Equal(t, http.StatusServiceUnavailable, response.Code)
}

func TestGeminiLiveRelayRouteAuthenticatesBeforeUpgrade(t *testing.T) {
	setupRealtimeRouterTest(t)
	engine := gin.New()
	SetRelayRouter(engine)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, middleware.GeminiLivePath, nil)

	engine.ServeHTTP(response, request)

	assert.Equal(t, http.StatusUnauthorized, response.Code)
}

func TestGeminiLiveRelayRouteReportsDistributionErrorOverWebSocket(t *testing.T) {
	_, token := setupRealtimeRouterTest(t)
	model.InitChannelCache()
	engine := gin.New()
	SetRelayRouter(engine)
	gateway := httptest.NewServer(engine)
	t.Cleanup(gateway.Close)

	header := http.Header{"Authorization": []string{"Bearer " + token.Key}}
	conn, _, err := websocket.DefaultDialer.Dial(
		"ws"+strings.TrimPrefix(gateway.URL, "http")+middleware.GeminiLivePath,
		header,
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	require.NoError(t, conn.WriteJSON(map[string]any{
		"setup": map[string]any{"model": "models/gemini-live-unavailable"},
	}))
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(time.Second)))

	_, message, err := conn.ReadMessage()

	require.NoError(t, err)
	assert.Contains(t, string(message), `"error"`)
	assert.Contains(t, string(message), "gemini-live-unavailable")
	_, _, err = conn.ReadMessage()
	require.Error(t, err)
	assert.True(t, websocket.IsCloseError(err, websocket.CloseInternalServerErr))
}

func TestGeminiLiveRelayRouteForwardsNativeBidiSession(t *testing.T) {
	_, token := setupRealtimeRouterTest(t)
	const (
		modelName         = "gemini-live-router-test"
		upstreamModelName = "gemini-live-upstream-test"
	)
	token.UnlimitedQuota = true
	require.NoError(t, model.DB.Model(token).Update("unlimited_quota", true).Error)

	upstreamResult := make(chan error, 1)
	upgrader := websocket.Upgrader{
		CheckOrigin: func(_ *http.Request) bool {
			return true
		},
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != middleware.GeminiLivePath {
			upstreamResult <- fmt.Errorf("unexpected upstream path: %s", r.URL.Path)
			return
		}
		if got := r.Header.Get("x-goog-api-key"); got != "google-upstream-key" {
			upstreamResult <- fmt.Errorf("unexpected upstream API key: %q", got)
			return
		}
		if got := r.Header.Get("Authorization"); got != "" {
			upstreamResult <- fmt.Errorf("downstream authorization leaked upstream: %q", got)
			return
		}
		if r.URL.RawQuery != "" {
			upstreamResult <- fmt.Errorf("unexpected upstream query: %q", r.URL.RawQuery)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			upstreamResult <- err
			return
		}
		defer conn.Close()

		_, setup, err := conn.ReadMessage()
		if err != nil {
			upstreamResult <- err
			return
		}
		if !strings.Contains(string(setup), `"model":"models/`+upstreamModelName+`"`) {
			upstreamResult <- fmt.Errorf("unexpected setup frame: %s", setup)
			return
		}
		if err = conn.WriteJSON(map[string]any{"setupComplete": map[string]any{}}); err != nil {
			upstreamResult <- err
			return
		}

		_, clientMessage, err := conn.ReadMessage()
		if err != nil {
			upstreamResult <- err
			return
		}
		if !strings.Contains(string(clientMessage), "clientContent") {
			upstreamResult <- fmt.Errorf("unexpected client frame: %s", clientMessage)
			return
		}
		if err = conn.WriteJSON(map[string]any{
			"serverContent": map[string]any{"turnComplete": true},
			"usageMetadata": map[string]any{
				"promptTokenCount":   10,
				"responseTokenCount": 10,
				"totalTokenCount":    20,
			},
		}); err != nil {
			upstreamResult <- err
			return
		}
		upstreamResult <- conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
			time.Now().Add(time.Second),
		)
	}))
	t.Cleanup(upstream.Close)

	previousRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(
		fmt.Sprintf(`{"%s":1}`, modelName),
	))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})

	baseURL := upstream.URL
	modelMapping := fmt.Sprintf(`{"%s":"%s"}`, modelName, upstreamModelName)
	channel := &model.Channel{
		Type:          constant.ChannelTypeGemini,
		Key:           "google-upstream-key",
		Status:        common.ChannelStatusEnabled,
		Name:          "gemini-live-router",
		BaseURL:       &baseURL,
		Models:        modelName,
		Group:         "default",
		ModelMapping:  &modelMapping,
		OtherSettings: "",
	}
	channel.SetOtherSettings(kitdto.ChannelOtherSettings{GeminiLiveEnabled: true})
	require.NoError(t, channel.Insert())
	model.InitChannelCache()

	engine := gin.New()
	SetRelayRouter(engine)
	started, deferredDone := make(chan struct{}), make(chan struct{})
	var admissionMu sync.Mutex
	accepting := true
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		admissionMu.Lock()
		select {
		case <-started:
			admissionMu.Unlock()
			http.Error(w, "handler already started", http.StatusServiceUnavailable)
			return
		default:
		}
		if !accepting {
			admissionMu.Unlock()
			http.Error(w, "test gateway closed", http.StatusServiceUnavailable)
			return
		}
		close(started)
		admissionMu.Unlock()
		defer close(deferredDone)
		engine.ServeHTTP(w, r)
	}))
	var conn *websocket.Conn
	var err error
	t.Cleanup(func() {
		if conn != nil {
			_ = conn.Close()
		}
		// Closing admission under the start lock excludes a late handler after this check.
		admissionMu.Lock()
		accepting = false
		hasStarted := false
		select {
		case <-started:
			hasStarted = true
		default:
		}
		admissionMu.Unlock()
		_ = gateway.Listener.Close()
		gateway.CloseClientConnections()
		if hasStarted {
			select {
			case <-deferredDone:
			case <-time.After(3 * time.Second):
				fmt.Fprintln(os.Stderr, "Gemini Live handler did not finish; refusing ratio/Redis/DB restoration")
				os.Exit(1)
			}
		}
		gateway.Close()
	})

	header := http.Header{"Authorization": []string{"Bearer " + token.Key}}
	conn, _, err = websocket.DefaultDialer.Dial(
		"ws"+strings.TrimPrefix(gateway.URL, "http")+middleware.GeminiLivePath,
		header,
	)
	require.NoError(t, err)
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(3*time.Second)))
	require.NoError(t, conn.WriteJSON(map[string]any{
		"setup": map[string]any{"model": "models/" + modelName},
	}))

	_, setupComplete, err := conn.ReadMessage()
	require.NoError(t, err)
	assert.Contains(t, string(setupComplete), "setupComplete")
	require.NoError(t, conn.WriteJSON(map[string]any{
		"clientContent": map[string]any{"turnComplete": true},
	}))
	_, response, err := conn.ReadMessage()
	require.NoError(t, err)
	assert.Contains(t, string(response), "usageMetadata")
	_, _, err = conn.ReadMessage()
	require.Error(t, err)
	assert.True(t, websocket.IsCloseError(err, websocket.CloseNormalClosure))

	select {
	case upstreamErr := <-upstreamResult:
		require.NoError(t, upstreamErr)
	case <-time.After(3 * time.Second):
		t.Fatal("Gemini Live upstream was not reached")
	}

	var consumeLogs int64
	require.Eventually(t, func() bool {
		err = model.LOG_DB.Model(&model.Log{}).
			Where("token_id = ? AND type = ?", token.Id, model.LogTypeConsume).
			Count(&consumeLogs).Error
		return err == nil && consumeLogs == 1
	}, time.Second, 10*time.Millisecond)
	assert.Equal(t, int64(1), consumeLogs)
	var consumeLog model.Log
	require.NoError(t, model.LOG_DB.
		Where("token_id = ? AND type = ?", token.Id, model.LogTypeConsume).
		First(&consumeLog).Error)
	assert.Equal(t, modelName, consumeLog.ModelName)
	assert.Equal(t, 10, consumeLog.PromptTokens)
	assert.Equal(t, 10, consumeLog.CompletionTokens)
	assert.Contains(t, consumeLog.Content, "gemini_live_usage=authoritative")
}
