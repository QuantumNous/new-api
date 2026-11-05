package router

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The reserve gate is proven where a customer meets it: over HTTP, through
// token or session authentication and the response mask. The service-level
// parts (window, formula, ceiling, texts) are pinned in
// service/hw_reserve_test.go.

const hwReserveTestSecret = "hw-reserve-router-test-secret"

// hwReserveTestEnv is one isolated gateway with the reserve configuration and
// the customers a test needs.
type hwReserveTestEnv struct {
	t      *testing.T
	engine *gin.Engine
}

func hwReserveTestCase(t *testing.T) *hwReserveTestEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	previousMemoryCache := common.MemoryCacheEnabled
	previousMaster := common.IsMasterNode
	previousSQLitePath := common.SQLitePath
	previousSecret := common.SessionSecret
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()

	common.RedisEnabled = false
	common.MemoryCacheEnabled = false
	common.IsMasterNode = false
	common.SessionSecret = hwReserveTestSecret
	common.SQLitePath = filepath.Join(t.TempDir(), "hw-reserve.db")
	t.Setenv("SQL_DSN", "")
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitDB())
	require.NoError(t, model.InitLogDB())
	sqlDB, err := model.DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, model.DB.AutoMigrate(
		&model.User{}, &model.Token{}, &model.Log{}, &model.Option{},
		&model.UserSession{}, &model.AuditLog{}, &model.UserAccessToken{},
	))
	require.NoError(t, model.EnsureLegacyAccessTokenRetireAt(time.Now().Unix()))

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
		common.MemoryCacheEnabled = previousMemoryCache
		common.IsMasterNode = previousMaster
		common.SQLitePath = previousSQLitePath
		common.SessionSecret = previousSecret
		common.SetDatabaseTypes(previousMainType, previousLogType)
		_ = sqlDB.Close()
	})

	hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "")
	hwReserveTestOption(t, model.HwPhase0MeasurementDoneOption, "false")
	hwReserveTestOption(t, model.HwCustomerWindowCeilingUSDOption, "")
	t.Setenv(model.HwWindowCapacityUSDEnv, "")
	t.Setenv(model.HwBureauUsageURLEnv, "")
	t.Setenv(model.HwBureauUsageTokenEnv, "")
	t.Setenv(model.HwReserveModeEnv, "")
	service.HwSetBureauUsageSource(nil)
	middleware.HwResetReserveGateCache()
	t.Cleanup(func() {
		service.HwSetBureauUsageSource(nil)
		middleware.HwResetReserveGateCache()
	})

	return &hwReserveTestEnv{t: t, engine: gin.New()}
}

func hwReserveTestOption(t *testing.T, key string, value string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	previous, had := common.OptionMap[key]
	common.OptionMap[key] = value
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if had {
			common.OptionMap[key] = previous
		} else {
			delete(common.OptionMap, key)
		}
	})
}

// hwReserveTestCustomer creates one able customer in group and returns its token.
func (env *hwReserveTestEnv) customer(group string) (*model.User, *model.Token) {
	env.t.Helper()
	name := "hw-reserve-" + common.GetRandomString(8)
	user := &model.User{
		Username: name, Password: "unused-password-hash", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: group, AuthVersion: 1, AffCode: "aff-" + name,
	}
	require.NoError(env.t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId: user.Id, Key: "hwreserve" + common.GetRandomString(16), Name: "hw-reserve",
		Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true,
	}
	require.NoError(env.t, model.DB.Create(token).Error)
	return user, token
}

// bearer creates a dashboard session for user and returns the access token.
func (env *hwReserveTestEnv) bearer(user *model.User) string {
	env.t.Helper()
	now := time.Now().Unix()
	session := &model.UserSession{
		SID: "hw-reserve-" + common.GetRandomString(12), UserID: user.Id, Version: 1,
		UserAuthVersion: user.AuthVersion, Status: model.UserSessionStatusActive,
		RefreshHash: "test-only-refresh-hash", LoginMethod: "password",
		LastActiveAt: now, ExpiresAt: now + 3600,
	}
	require.NoError(env.t, model.CreateUserSession(session))
	identity := service.AuthIdentity{
		UserID: user.Id, SessionID: session.SID,
		UserAuthVersion: session.UserAuthVersion, SessionVersion: session.Version,
	}
	bearer, _, err := service.IssueAccessToken(identity)
	require.NoError(env.t, err)
	return bearer
}

func (env *hwReserveTestEnv) insertUsage(group string, userID int, usd float64, at int64) {
	env.t.Helper()
	require.NoError(env.t, model.LOG_DB.Create(&model.Log{
		UserId: userID, CreatedAt: at, Type: model.LogTypeConsume,
		Quota: common.QuotaFromFloat(usd * common.QuotaPerUnit), Group: group,
	}).Error)
}

func (env *hwReserveTestEnv) serve(method string, path string, header map[string]string) *httptest.ResponseRecorder {
	env.t.Helper()
	request := httptest.NewRequest(method, path, bytes.NewReader([]byte(`{"model":"claude-sonnet-5-5","messages":[]}`)))
	request.Header.Set("Content-Type", "application/json")
	for name, value := range header {
		request.Header.Set(name, value)
	}
	recorder := httptest.NewRecorder()
	env.engine.ServeHTTP(recorder, request)
	return recorder
}

// gateEngine builds the customer route stack up to the gate, with a handler
// that records that it was reached.
func gateEngine(reached *bool) *gin.Engine {
	engine := gin.New()
	engine.Use(middleware.RequestId())
	customer := engine.Group("/v1")
	customer.Use(middleware.TokenAuth(), middleware.HwMask(), middleware.HwBureauReserveGate())
	serve := func(c *gin.Context) {
		*reached = true
		c.JSON(http.StatusOK, gin.H{"served": true})
	}
	customer.POST("/chat/completions", serve)
	customer.POST("/messages", serve)
	return engine
}

func hwReserveAssertNoSupplierWord(t *testing.T, body string) {
	t.Helper()
	lower := strings.ToLower(body)
	assert.NotContains(t, lower, "lumia")
	assert.NotContains(t, lower, "openrouter")
}

func hwReserveErrorCode(t *testing.T, body []byte) string {
	t.Helper()
	var payload struct {
		Error struct {
			Code any    `json:"code"`
			Type string `json:"type"`
		} `json:"error"`
	}
	require.NoError(t, common.Unmarshal(body, &payload))
	if code, ok := payload.Error.Code.(string); ok && code != "" {
		return code
	}
	return payload.Error.Type
}

// TestHwReserveGateRefusesWithoutMeasurement proves that customer requests are
// refused with 503 and a Retry-After while the capacity is unknown or the
// measurement fails, in the error shape of their own route, while a bureau
// request in another group is served.
func TestHwReserveGateRefusesWithoutMeasurement(t *testing.T) {
	env := hwReserveTestCase(t)
	_, paidToken := env.customer(model.HwPaidGroupName)
	_, bureauToken := env.customer("default")
	reached := false
	env.engine = gateEngine(&reached)

	t.Run("openai route", func(t *testing.T) {
		reached = false
		recorder := env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + paidToken.Key})
		require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
		assert.False(t, reached, "the gate must refuse before the handler runs")
		retryAfter, err := strconv.Atoi(recorder.Header().Get("Retry-After"))
		require.NoError(t, err, "Retry-After must be whole seconds")
		assert.Positive(t, retryAfter)
		assert.Equal(t, "service_busy", hwReserveErrorCode(t, recorder.Body.Bytes()))
		hwReserveAssertNoSupplierWord(t, recorder.Body.String())
	})

	t.Run("claude route", func(t *testing.T) {
		reached = false
		recorder := env.serve(http.MethodPost, "/v1/messages", map[string]string{"Authorization": "Bearer " + paidToken.Key})
		require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
		assert.False(t, reached)
		var payload struct {
			Type  string `json:"type"`
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
			} `json:"error"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
		assert.Equal(t, "error", payload.Type)
		assert.Equal(t, "service_busy", payload.Error.Type, "the Claude envelope carries the code as the error type")
		assert.NotEmpty(t, payload.Error.Message)
		hwReserveAssertNoSupplierWord(t, recorder.Body.String())
	})

	t.Run("bureau request is not blocked", func(t *testing.T) {
		reached = false
		recorder := env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + bureauToken.Key})
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		assert.True(t, reached)
	})

	t.Run("failing measurement refuses", func(t *testing.T) {
		hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "30")
		service.HwSetBureauUsageSource(hwReserveFailingSource{})
		t.Cleanup(func() { service.HwSetBureauUsageSource(nil) })
		middleware.HwResetReserveGateCache()
		reached = false
		recorder := env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + paidToken.Key})
		require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
		assert.False(t, reached)
		assert.Equal(t, "service_busy", hwReserveErrorCode(t, recorder.Body.Bytes()))
	})
}

// hwReserveFailingSource stands for an unreachable bureau measurement.
type hwReserveFailingSource struct{}

func (hwReserveFailingSource) UsedUSD(ctx context.Context, windowStart int64, windowEnd int64) (float64, error) {
	return 0, fmt.Errorf("measurement unavailable")
}

// TestHwReserveGateAdmitsBelowTheLimitAndRefusesAtIt proves the window rule on
// the request path, and that usage of an earlier window does not count.
func TestHwReserveGateAdmitsBelowTheLimitAndRefusesAtIt(t *testing.T) {
	env := hwReserveTestCase(t)
	t.Setenv(model.HwReserveModeEnv, service.HwReserveModeThird)
	hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "30")
	// A ceiling far above the window limit, so only the window limit can refuse.
	hwReserveTestOption(t, model.HwCustomerWindowCeilingUSDOption, "1000")
	user, token := env.customer(model.HwPaidGroupName)
	now := time.Now().UTC()
	windowStart, _ := model.HwReserveWindow(now)
	reached := false
	env.engine = gateEngine(&reached)

	// Usage from the previous window does not count for this one.
	env.insertUsage(model.HwPaidGroupName, user.Id, 20, windowStart-1)
	middleware.HwResetReserveGateCache()
	reached = false
	recorder := env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + token.Key})
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.True(t, reached)

	// Nine dollars stays below the one-third limit of ten.
	env.insertUsage(model.HwPaidGroupName, user.Id, 9, windowStart)
	middleware.HwResetReserveGateCache()
	reached = false
	recorder = env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + token.Key})
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.True(t, reached)

	// One dollar more reaches the limit exactly.
	env.insertUsage(model.HwPaidGroupName, user.Id, 1, windowStart)
	middleware.HwResetReserveGateCache()
	reached = false
	recorder = env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + token.Key})
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
	assert.False(t, reached)
	assert.Equal(t, "service_busy", hwReserveErrorCode(t, recorder.Body.Bytes()))
}

// TestHwReserveGateKeepsTheCeilingPerCustomer proves the per-customer ceiling:
// the first customer is refused while the second is served, and free is lower
// than paid. A stream that already started is never cut by either refusal.
func TestHwReserveGateKeepsTheCeilingPerCustomer(t *testing.T) {
	env := hwReserveTestCase(t)
	t.Setenv(model.HwReserveModeEnv, service.HwReserveModeThird)
	hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "100")
	windowStart, _ := model.HwReserveWindow(time.Now().UTC())

	first, firstToken := env.customer(model.HwPaidGroupName)
	_, secondToken := env.customer(model.HwPaidGroupName)
	free, freeToken := env.customer(model.HwFreeGroupName)
	otherFree, otherFreeToken := env.customer(model.HwFreeGroupName)
	env.insertUsage(model.HwPaidGroupName, first.Id, 5, windowStart)
	env.insertUsage(model.HwFreeGroupName, free.Id, 2.5, windowStart)
	env.insertUsage(model.HwFreeGroupName, otherFree.Id, 2.4, windowStart)

	streamStarted := make(chan struct{})
	streamAllowed := make(chan struct{})
	streamDone := make(chan struct{})
	engine := gin.New()
	engine.Use(middleware.RequestId())
	customer := engine.Group("/v1")
	customer.Use(middleware.TokenAuth(), middleware.HwMask(), middleware.HwBureauReserveGate())
	customer.POST("/chat/completions", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Status(http.StatusOK)
		_, _ = c.Writer.WriteString("data: {\"delta\":\"first\"}\n\n")
		c.Writer.Flush()
		close(streamStarted)
		<-streamAllowed
		_, _ = c.Writer.WriteString("data: {\"delta\":\"second\"}\n\n")
		c.Writer.Flush()
		close(streamDone)
	})
	customer.POST("/messages", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"served": true}) })
	env.engine = engine

	server := httptest.NewServer(engine)
	t.Cleanup(server.Close)

	streamRequest, err := http.NewRequest(http.MethodPost, server.URL+"/v1/chat/completions", strings.NewReader(`{}`))
	require.NoError(t, err)
	streamRequest.Header.Set("Authorization", "Bearer "+secondToken.Key)
	streamResponse, err := http.DefaultClient.Do(streamRequest)
	require.NoError(t, err)
	t.Cleanup(func() { _ = streamResponse.Body.Close() })
	require.Equal(t, http.StatusOK, streamResponse.StatusCode)
	<-streamStarted

	// While the stream runs, the first customer is over its ceiling and the
	// gate answers new requests with 429. The running stream still completes.
	middleware.HwResetReserveGateCache()
	refused := httptest.NewRecorder()
	refusedRequest := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{}`))
	refusedRequest.Header.Set("Authorization", "Bearer "+firstToken.Key)
	engine.ServeHTTP(refused, refusedRequest)
	require.Equal(t, http.StatusTooManyRequests, refused.Code, refused.Body.String())
	assert.Equal(t, "window_limit_reached", hwReserveErrorCode(t, refused.Body.Bytes()))
	retryAfter, err := strconv.Atoi(refused.Header().Get("Retry-After"))
	require.NoError(t, err)
	assert.Positive(t, retryAfter)
	hwReserveAssertNoSupplierWord(t, refused.Body.String())

	// The stream of the second customer is untouched.
	close(streamAllowed)
	<-streamDone
	streamBody, err := io.ReadAll(streamResponse.Body)
	require.NoError(t, err)
	assert.Contains(t, string(streamBody), "first")
	assert.Contains(t, string(streamBody), "second")

	// The free ceiling lies lower than the paid one: 2.50 refuses, 2.40 passes.
	freeRecorder := httptest.NewRecorder()
	freeRequest := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(`{}`))
	freeRequest.Header.Set("Authorization", "Bearer "+freeToken.Key)
	engine.ServeHTTP(freeRecorder, freeRequest)
	assert.Equal(t, http.StatusTooManyRequests, freeRecorder.Code)

	otherFreeRecorder := httptest.NewRecorder()
	otherFreeRequest := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(`{}`))
	otherFreeRequest.Header.Set("Authorization", "Bearer "+otherFreeToken.Key)
	engine.ServeHTTP(otherFreeRecorder, otherFreeRequest)
	assert.Equal(t, http.StatusOK, otherFreeRecorder.Code, otherFreeRecorder.Body.String())

	// And the second paid customer never met the first one's ceiling.
	secondRecorder := httptest.NewRecorder()
	secondRequest := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(`{}`))
	secondRequest.Header.Set("Authorization", "Bearer "+secondToken.Key)
	engine.ServeHTTP(secondRecorder, secondRequest)
	assert.Equal(t, http.StatusOK, secondRecorder.Code, secondRecorder.Body.String())
}

// TestHwReserveGateFollowsTheAccountGroupNotTheTokenGroup proves the gate reads
// the group of the account, not the group the token asks for: a paid customer
// whose token sits in another usable group stays inside its ceiling.
func TestHwReserveGateFollowsTheAccountGroupNotTheTokenGroup(t *testing.T) {
	env := hwReserveTestCase(t)
	t.Setenv(model.HwReserveModeEnv, service.HwReserveModeThird)
	hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "90")
	hwReserveTestOption(t, model.HwCustomerWindowCeilingUSDOption, "5")
	user, token := env.customer(model.HwPaidGroupName)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", token.Id).Update("group", "default").Error)
	windowStart, _ := model.HwReserveWindow(time.Now().UTC())
	env.insertUsage(model.HwPaidGroupName, user.Id, 5, windowStart)
	reached := false
	env.engine = gateEngine(&reached)

	recorder := env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + token.Key})

	require.Equal(t, http.StatusTooManyRequests, recorder.Code, recorder.Body.String())
	assert.False(t, reached, "the gate must refuse before the handler runs")
	assert.Equal(t, "window_limit_reached", hwReserveErrorCode(t, recorder.Body.Bytes()))

	// A bureau account in the same setup is still served: only customers are
	// limited here.
	bureauUser, bureauToken := env.customer("default")
	env.insertUsage("default", bureauUser.Id, 50, windowStart)
	middleware.HwResetReserveGateCache()
	reached = false
	recorder = env.serve(http.MethodPost, "/v1/chat/completions", map[string]string{"Authorization": "Bearer " + bureauToken.Key})
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.True(t, reached)
}

// TestHwReserveGateIsInstalledOnTheCustomerRoutes proves the gate sits on the
// relay routes of the real router: with an unknown capacity each of them answers
// service_busy before channel selection, in its own error shape.
func TestHwReserveGateIsInstalledOnTheCustomerRoutes(t *testing.T) {
	env := hwReserveTestCase(t)
	_, token := env.customer(model.HwPaidGroupName)
	playgroundUser, _ := env.customer(model.HwPaidGroupName)
	bearer := env.bearer(playgroundUser)

	env.engine = gin.New()
	SetRelayRouter(env.engine)

	tests := []struct {
		name   string
		path   string
		header map[string]string
		claude bool
	}{
		{
			name:   "openai chat completions",
			path:   "/v1/chat/completions",
			header: map[string]string{"Authorization": "Bearer " + token.Key},
		},
		{
			name:   "claude messages",
			path:   "/v1/messages",
			header: map[string]string{"Authorization": "Bearer " + token.Key},
			claude: true,
		},
		{
			name:   "gemini generate content",
			path:   "/v1beta/models/gemini-2.0-flash:generateContent",
			header: map[string]string{"Authorization": "Bearer " + token.Key},
		},
		{
			name:   "playground",
			path:   "/pg/chat/completions",
			header: map[string]string{"Authorization": "Bearer " + bearer},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := env.serve(http.MethodPost, test.path, test.header)
			require.Equal(t, http.StatusServiceUnavailable, recorder.Code, recorder.Body.String())
			assert.Equal(t, "service_busy", hwReserveErrorCode(t, recorder.Body.Bytes()))
			assert.NotEmpty(t, recorder.Header().Get("Retry-After"))
			hwReserveAssertNoSupplierWord(t, recorder.Body.String())
			if test.claude {
				var payload map[string]any
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
				assert.Equal(t, "error", payload["type"])
			}
		})
	}
}

// TestHwAdminReserveEndpoint proves the admin view: a common user is refused,
// an administrator sees the numbers, the source state and the last measurement,
// and the answer holds no secret.
func TestHwAdminReserveEndpoint(t *testing.T) {
	env := hwReserveTestCase(t)
	admin := &model.User{
		Username: "hw-reserve-admin", Password: "unused-password-hash", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "aff-hw-reserve-admin",
	}
	require.NoError(t, model.DB.Create(admin).Error)
	adminBearer := env.bearer(admin)
	commonUser, _ := env.customer("default")
	userBearer := env.bearer(commonUser)

	env.engine = gin.New()
	SetHwRouter(env.engine.Group("/api"))

	t.Run("common user is refused", func(t *testing.T) {
		recorder := env.serve(http.MethodGet, "/api/hw/admin/reserve", map[string]string{"Authorization": "Bearer " + userBearer})
		assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
	})

	t.Run("administrator sees the window and the measurement state", func(t *testing.T) {
		hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "30")
		service.HwSetBureauUsageSource(hwReserveFixedSource(4))
		t.Cleanup(func() { service.HwSetBureauUsageSource(nil) })
		windowStart, windowEnd := model.HwReserveWindow(time.Now().UTC())
		env.insertUsage(model.HwPaidGroupName, commonUser.Id, 2, windowStart)

		recorder := env.serve(http.MethodGet, "/api/hw/admin/reserve", map[string]string{"Authorization": "Bearer " + adminBearer})
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		var payload struct {
			Success bool `json:"success"`
			Data    struct {
				WindowStart      int64   `json:"window_start"`
				WindowEnd        int64   `json:"window_end"`
				BureauUsedUSD    float64 `json:"bureau_used_usd"`
				CustomerUsedUSD  float64 `json:"customer_used_usd"`
				CustomerLimitUSD float64 `json:"customer_limit_usd"`
				CeilingPaidUSD   float64 `json:"ceiling_paid_usd"`
				CeilingFreeUSD   float64 `json:"ceiling_free_usd"`
				DenyReason       string  `json:"deny_reason"`
				MeasuredAt       int64   `json:"measured_at"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
		assert.True(t, payload.Success)
		assert.Equal(t, windowStart, payload.Data.WindowStart)
		assert.Equal(t, windowEnd, payload.Data.WindowEnd)
		assert.InDelta(t, 4, payload.Data.BureauUsedUSD, 1e-9)
		assert.InDelta(t, 2, payload.Data.CustomerUsedUSD, 1e-9)
		assert.InDelta(t, 10, payload.Data.CustomerLimitUSD, 1e-9)
		assert.Less(t, payload.Data.CeilingFreeUSD, payload.Data.CeilingPaidUSD)
		assert.Empty(t, payload.Data.DenyReason)
		assert.Positive(t, payload.Data.MeasuredAt)

		body := strings.ToLower(recorder.Body.String())
		assert.NotContains(t, body, "hw_bureau_usage_token")
		assert.NotContains(t, body, "hw_bureau_usage_url")
		assert.NotContains(t, body, "test-only")
		hwReserveAssertNoSupplierWord(t, body)
	})

	t.Run("administrator sees the refusal reason", func(t *testing.T) {
		hwReserveTestOption(t, model.HwWindowCapacityUSDOption, "")
		recorder := env.serve(http.MethodGet, "/api/hw/admin/reserve", map[string]string{"Authorization": "Bearer " + adminBearer})
		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		var payload struct {
			Data struct {
				DenyReason string `json:"deny_reason"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
		assert.Equal(t, service.HwReserveDenyCapacityUnknown, payload.Data.DenyReason)
	})
}

type hwReserveFixedSourceValue float64

func (value hwReserveFixedSourceValue) UsedUSD(ctx context.Context, windowStart int64, windowEnd int64) (float64, error) {
	return float64(value), nil
}

func hwReserveFixedSource(used float64) service.HwBureauUsageSource {
	return hwReserveFixedSourceValue(used)
}
