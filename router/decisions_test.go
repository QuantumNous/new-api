package router

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const jevRequest = `{"model":"jev-latest","state":{"ticket":"Payment failed. Help today."},"questions":{"urgent":{"type":"noul","instructions":"Is this urgent?"},"team":{"type":"choice","instructions":{"task":"Choose a team"},"criteria":{"billing":null,"technical":"Software errors"}},"priority":{"type":"score","instructions":["Rate urgency"],"criteria":["Low","Medium","High"]}}}`
const jevResponse = `{"model":"jev-1.13.0","answers":{"urgent":{"type":"noul","noul":0},"team":{"type":"choice","choice":"billing","probabilities":{"billing":0.9,"technical":0.1},"confidence":0.8},"priority":{"type":"score","score":1.8,"legend":{"0":"Low","1":"Medium","2":"High"},"probabilities":{"0":0.05,"1":0.1,"2":0.85},"confidence":0.7}},"usage":{"input_tokens":1000,"output_tokens":500}}`

// Exercise the registered production route, authentication, distribution,
// provider transport, billing reservation/refund, settlement and usage logs.
func TestJevRelay(t *testing.T) {
	cases := []struct {
		name, path, request, response, auth, expression string
		upstreamStatus, expectedStatus, charge          int
		expired, restricted, disabled, passthrough      bool
		wantUpstream                                    bool
	}{
		{name: "three primitives and zero noul", wantUpstream: true, charge: 21},
		{name: "upstream path is not a gateway endpoint", path: "/v1/systemone", expectedStatus: 404},
		{name: "string state", request: strings.Replace(jevRequest, `{"ticket":"Payment failed. Help today."}`, `"Payment failed"`, 1), wantUpstream: true, charge: 21},
		{name: "array state", request: strings.Replace(jevRequest, `{"ticket":"Payment failed. Help today."}`, `["Payment failed"]`, 1), wantUpstream: true, charge: 21},
		{name: "body passthrough keeps mapping", passthrough: true, wantUpstream: true, charge: 21},
		{name: "administrator price wins", expression: `tier("custom", p * 2 + c * 4)`, wantUpstream: true, charge: 2000},
		{name: "missing bearer", auth: "none", expectedStatus: 401},
		{name: "invalid bearer", auth: "invalid", expectedStatus: 401},
		{name: "expired token", expired: true, expectedStatus: 401},
		{name: "disabled token", disabled: true, expectedStatus: 401},
		{name: "model restriction", restricted: true, expectedStatus: 403},
		{name: "null request", request: `null`, expectedStatus: 400},
		{name: "empty questions", request: `{"model":"jev-latest","state":"x","questions":{}}`, expectedStatus: 400},
		{name: "streaming rejected", request: strings.Replace(jevRequest, `"model":`, `"stream":true,"model":`, 1), expectedStatus: 400},
		{name: "boolean state", request: strings.Replace(jevRequest, `{"ticket":"Payment failed. Help today."}`, `false`, 1), expectedStatus: 400},
		{name: "unknown question type", request: strings.Replace(jevRequest, `"type":"noul"`, `"type":"chat"`, 1), expectedStatus: 400},
		{name: "invalid choice criteria", request: strings.Replace(jevRequest, `"billing":null`, `"billing":3`, 1), expectedStatus: 400},
		{name: "single score level", request: strings.Replace(jevRequest, `["Low","Medium","High"]`, `["Low"]`, 1), expectedStatus: 400},
		{name: "duplicate model rejected", request: strings.Replace(jevRequest, `"model":`, `"model":"other","model":`, 1), expectedStatus: 400},
		{name: "upstream authentication", upstreamStatus: 401, response: `{"detail":"Unauthorized"}`, expectedStatus: 401, wantUpstream: true},
		{name: "upstream validation", upstreamStatus: 422, response: `{"detail":"Invalid request"}`, expectedStatus: 422, wantUpstream: true},
		{name: "upstream rate limit", upstreamStatus: 429, response: `{"detail":"Too many requests"}`, expectedStatus: 429, wantUpstream: true},
		{name: "upstream overload", upstreamStatus: 529, response: `{"detail":"Overloaded"}`, expectedStatus: 529, wantUpstream: true},
		{name: "missing usage refunds", response: strings.Replace(jevResponse, `"usage":`, `"unused":`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing output tokens refunds", response: strings.Replace(jevResponse, `,"output_tokens":500`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "negative usage refunds", response: strings.Replace(jevResponse, `"input_tokens":1000`, `"input_tokens":-1`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "fractional usage refunds", response: strings.Replace(jevResponse, `"input_tokens":1000`, `"input_tokens":1.5`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "overflow usage refunds", response: strings.Replace(jevResponse, `"input_tokens":1000`, `"input_tokens":2147483647`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "mismatched answer refunds", response: strings.Replace(jevResponse, `"urgent":`, `"unknown":`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing noul refunds", response: strings.Replace(jevResponse, `,"noul":0`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "unlisted choice refunds", response: strings.Replace(jevResponse, `"choice":"billing"`, `"choice":"sales"`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing choice probabilities refunds", response: strings.Replace(jevResponse, `,"probabilities":{"billing":0.9,"technical":0.1}`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing choice confidence refunds", response: strings.Replace(jevResponse, `,"confidence":0.8`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "invalid confidence refunds", response: strings.Replace(jevResponse, `"confidence":0.8`, `"confidence":2`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "null probability refunds", response: strings.Replace(jevResponse, `"billing":0.9`, `"billing":null`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "negative probability refunds", response: strings.Replace(jevResponse, `"billing":0.9`, `"billing":-0.9`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "wrong probability option refunds", response: strings.Replace(jevResponse, `"technical":0.1`, `"unknown":0.1`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "unnormalized distribution refunds", response: strings.Replace(jevResponse, `"billing":0.9`, `"billing":0.1`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing score probabilities refunds", response: strings.Replace(jevResponse, `,"probabilities":{"0":0.05,"1":0.1,"2":0.85}`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing score confidence refunds", response: strings.Replace(jevResponse, `,"confidence":0.7`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "missing score legend refunds", response: strings.Replace(jevResponse, `,"legend":{"0":"Low","1":"Medium","2":"High"}`, ``, 1), expectedStatus: 502, wantUpstream: true},
		{name: "wrong score legend level refunds", response: strings.Replace(jevResponse, `"2":"High"`, `"3":"High"`, 1), expectedStatus: 502, wantUpstream: true},
		{name: "zero confidence remains valid", response: strings.Replace(jevResponse, `"confidence":0.8`, `"confidence":0`, 1), wantUpstream: true, charge: 21},
		{name: "rounded probabilities remain valid", response: strings.Replace(jevResponse, `"billing":0.9`, `"billing":0.89999999`, 1), wantUpstream: true, charge: 21},
		{name: "out of range score refunds", response: strings.Replace(jevResponse, `"score":1.8`, `"score":9`, 1), expectedStatus: 502, wantUpstream: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			user, token := setupJevRelayTest(t)
			if tc.expired {
				token.ExpiredTime = time.Now().Unix() - 1
			}
			if tc.disabled {
				token.Status = common.TokenStatusDisabled
			}
			if tc.restricted {
				token.ModelLimitsEnabled = true
				token.ModelLimits = "another-model"
			}
			require.NoError(t, model.DB.Save(token).Error)
			if tc.expression != "" {
				expressions, err := common.Marshal(map[string]string{"jev-latest": tc.expression})
				require.NoError(t, err)
				require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_expr": string(expressions)}))
			}
			var calls atomic.Int32
			var reserved atomic.Int64
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assert.Equal(t, "/v1/systemone", r.URL.Path)
				assert.Equal(t, "Bearer upstream-test-key", r.Header.Get("Authorization"))
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
				var received dto.DecisionsRequest
				assert.NoError(t, common.DecodeJson(r.Body, &received))
				assert.Equal(t, "jev-1.13.0", received.Model)
				assert.Len(t, received.Questions, 3)
				assert.Nil(t, received.Stream)
				var current model.Token
				assert.NoError(t, model.DB.First(&current, token.Id).Error)
				reserved.Store(int64(50000 - current.RemainQuota))
				status := tc.upstreamStatus
				if status == 0 {
					status = 200
				}
				response := tc.response
				if response == "" {
					response = jevResponse
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = io.WriteString(w, response)
			}))
			t.Cleanup(upstream.Close)
			channel := createJevChannel(t, upstream.URL, "upstream-test-key", tc.passthrough)
			engine := gin.New()
			SetRelayRouter(engine)
			body := tc.request
			if body == "" {
				body = jevRequest
			}
			path := tc.path
			if path == "" {
				path = "/v1/decisions"
			}
			request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			if tc.auth != "none" {
				key := token.Key
				if tc.auth == "invalid" {
					key = "invalid-key"
				}
				request.Header.Set("Authorization", "Bearer sk-"+key)
			}
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, request)
			status := tc.expectedStatus
			if status == 0 {
				status = 200
			}
			require.Equal(t, status, recorder.Code, recorder.Body.String())
			assert.NotContains(t, recorder.Body.String(), "upstream-test-key")
			if tc.wantUpstream {
				assert.EqualValues(t, 1, calls.Load())
				assert.Positive(t, reserved.Load())
			} else {
				assert.Zero(t, calls.Load())
			}
			if status == 200 {
				expectedResponse := tc.response
				if expectedResponse == "" {
					expectedResponse = jevResponse
				}
				assert.JSONEq(t, expectedResponse, recorder.Body.String())
			}
			assertJevAccounting(t, user, token, channel, tc.charge, status == 200)
		})
	}
}

func setupJevRelayTest(t *testing.T) (*model.User, *model.Token) {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	t.Cleanup(func() { model.DB, model.LOG_DB = previousDB, previousLogDB })
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	database, err := model.DB.DB()
	require.NoError(t, err)
	database.SetMaxOpenConns(1)
	memory, batch, count, retry, quota := common.MemoryCacheEnabled, common.BatchUpdateEnabled, constant.CountToken, common.RetryTimes, common.QuotaPerUnit
	common.MemoryCacheEnabled, common.BatchUpdateEnabled, constant.CountToken, common.RetryTimes, common.QuotaPerUnit = false, false, true, 0, 500000
	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		if key == "billing_setting.billing_mode" || key == "billing_setting.billing_expr" || key == "group_ratio_setting.group_ratio" {
			saved[key] = value
		}
		return nil
	}))
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{}`, "billing_setting.billing_expr": `{}`, "group_ratio_setting.group_ratio": `{"default":1}`,
	}))
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.BatchUpdateEnabled, constant.CountToken, common.RetryTimes, common.QuotaPerUnit = memory, batch, count, retry, quota
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Log{}))
	user := &model.User{Username: "jev-user", Status: common.UserStatusEnabled, Group: "default", Quota: 100000, Setting: `{"billing_preference":"wallet_only"}`}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{UserId: user.Id, Key: "jevrelaytest", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 50000}
	require.NoError(t, model.DB.Create(token).Error)
	t.Cleanup(func() {
		// Refunds can enqueue a cache update after the database writes commit.
		// Drain those workers before restoring global database/cache settings.
		require.Eventually(t, func() bool { return gopool.WorkerCount() == 0 }, 3*time.Second, 10*time.Millisecond)
	})
	return user, token
}

func createJevChannel(t *testing.T, baseURL, key string, passthrough bool) *model.Channel {
	t.Helper()
	mapping := `{"jev-latest":"jev-1.13.0"}`
	channel := &model.Channel{Name: "jev-test", Type: constant.ChannelTypeTypeSafe, Key: key, Status: common.ChannelStatusEnabled, Models: "jev-latest", Group: "default", BaseURL: &baseURL, ModelMapping: &mapping}
	channel.SetSetting(dto.ChannelSettings{PassThroughBodyEnabled: passthrough})
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{ChannelId: channel.Id, Model: "jev-latest", Group: "default", Enabled: true}).Error)
	return channel
}

func TestJevChannelManagement(t *testing.T) {
	cases := []struct {
		name, models, override    string
		modelFailure, testFailure bool
	}{
		{name: "native discovery and test"},
		{name: "missing model name", models: `{"models":[{}]}`, modelFailure: true},
		{name: "blank model name", models: `{"models":[{"name":" "}]}`, modelFailure: true},
		{name: "invalid model name type", models: `{"models":[{"name":7}]}`, modelFailure: true},
		{name: "empty model list", models: `{"models":[]}`, modelFailure: true},
		{name: "final question override", override: `{"questions":{"payment":{"type":"choice","instructions":"Which team?","criteria":{"billing":null,"technical":null}}}}`},
		{name: "invalid final question override", override: `{"questions":{}}`, testFailure: true},
		{name: "stream override rejected", override: `{"stream":true}`, testFailure: true},
		{name: "false stream override omitted", override: `{"stream":false}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			user, _ := setupJevRelayTest(t)
			var evaluations atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "Bearer upstream-test-key", r.Header.Get("Authorization"))
				w.Header().Set("Content-Type", "application/json")
				switch r.URL.Path {
				case "/v1/models":
					body := tc.models
					if body == "" {
						body = `{"models":[{"name":"jev-1.13.0","description":"Jev"},{"name":"jev-latest"}]}`
					}
					_, _ = io.WriteString(w, body)
				case "/v1/systemone":
					evaluations.Add(1)
					var request dto.DecisionsRequest
					if !assert.NoError(t, common.DecodeJson(r.Body, &request)) {
						w.WriteHeader(400)
						return
					}
					assert.NoError(t, request.Validate())
					assert.Nil(t, request.Stream)
					assert.Equal(t, "jev-1.13.0", request.Model)
					answer := `{"type":"noul","noul":0.9}`
					if tc.override != "" && !strings.Contains(tc.override, "stream") {
						assert.Equal(t, "choice", request.Questions["payment"].Type)
						answer = `{"type":"choice","choice":"billing","probabilities":{"billing":0.9,"technical":0.1},"confidence":0.8}`
					}
					_, _ = fmt.Fprintf(w, `{"model":"jev-1.13.0","answers":{"payment":%s},"usage":{"input_tokens":1000,"output_tokens":10}}`, answer)
				default:
					t.Errorf("unexpected upstream path: %s", r.URL.Path)
					w.WriteHeader(404)
				}
			}))
			t.Cleanup(upstream.Close)
			channel := createJevChannel(t, upstream.URL, "upstream-test-key", false)
			if tc.override != "" {
				channel.ParamOverride = &tc.override
				require.NoError(t, model.DB.Save(channel).Error)
			}
			engine := gin.New()
			// Existing admin authentication is unchanged; supply an authenticated user.
			engine.Use(func(c *gin.Context) { c.Set("id", user.Id); c.Next() })
			engine.GET("/models/:id", controller.FetchUpstreamModels)
			engine.GET("/test/:id", controller.TestChannel)
			for _, path := range []string{"/models/", "/test/"} {
				recorder := httptest.NewRecorder()
				engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, fmt.Sprintf("%s%d", path, channel.Id), nil))
				require.Equal(t, 200, recorder.Code)
				var result struct {
					Success bool     `json:"success"`
					Data    []string `json:"data"`
				}
				require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
				if path == "/models/" {
					require.Equal(t, !tc.modelFailure, result.Success, recorder.Body.String())
					if !tc.modelFailure {
						assert.Equal(t, []string{"jev-1.13.0", "jev-latest"}, result.Data)
					}
				} else {
					require.Equal(t, !tc.testFailure, result.Success, recorder.Body.String())
				}
			}
			if tc.testFailure {
				assert.Zero(t, evaluations.Load())
			} else {
				assert.EqualValues(t, 1, evaluations.Load())
				require.Eventually(t, func() bool {
					var saved model.Channel
					return model.DB.First(&saved, channel.Id).Error == nil && saved.TestTime > 0
				}, 3*time.Second, 10*time.Millisecond)
			}
			var saved model.Channel
			require.NoError(t, model.DB.First(&saved, channel.Id).Error)
			assert.Equal(t, "jev-latest", saved.Models)
		})
	}
}

func assertJevAccounting(t *testing.T, user *model.User, token *model.Token, channel *model.Channel, charge int, success bool) {
	t.Helper()
	// Failure refunds run asynchronously. Wait for both account writes before
	// letting the fixture release its database.
	require.Eventually(t, func() bool {
		var currentUser model.User
		var currentToken model.Token
		if model.DB.First(&currentUser, user.Id).Error != nil || model.DB.First(&currentToken, token.Id).Error != nil {
			return false
		}
		return currentUser.Quota == 100000-charge && currentToken.RemainQuota == 50000-charge && currentToken.UsedQuota == charge
	}, 3*time.Second, 10*time.Millisecond)
	require.NoError(t, model.DB.First(channel, channel.Id).Error)
	assert.EqualValues(t, charge, channel.UsedQuota)
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	if !success {
		assert.Empty(t, logs)
		return
	}
	require.Len(t, logs, 1)
	assert.Equal(t, charge, logs[0].Quota)
	assert.Equal(t, "jev-latest", logs[0].ModelName)
	assert.Equal(t, 1000, logs[0].PromptTokens)
	assert.Equal(t, 500, logs[0].CompletionTokens)
}

// Opt-in paid smoke test. Only synthetic input is sent; credentials stay in
// memory and the isolated in-memory test database, never test output.
func TestJevLive(t *testing.T) {
	keyPath := os.Getenv("JEV_TEST_API_KEY_FILE")
	if keyPath == "" {
		t.Skip("set JEV_TEST_API_KEY_FILE for the live smoke test")
	}
	key, err := os.ReadFile(keyPath)
	require.NoError(t, err)
	user, token := setupJevRelayTest(t)
	createJevChannel(t, "https://api.typesafe.ai", strings.TrimSpace(string(key)), false)
	engine := gin.New()
	SetRelayRouter(engine)
	request := httptest.NewRequest(http.MethodPost, "/v1/decisions", strings.NewReader(jevRequest))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-"+token.Key)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	require.Equal(t, 200, recorder.Code, "live gateway HTTP status")
	var result dto.DecisionsResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	require.Len(t, result.Answers, 3)
	require.NotNil(t, result.Usage)
	require.NotNil(t, result.Usage.InputTokens)
	require.NotNil(t, result.Usage.OutputTokens)
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("type = ?", model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.EqualValues(t, *result.Usage.InputTokens, logs[0].PromptTokens)
	assert.EqualValues(t, *result.Usage.OutputTokens, logs[0].CompletionTokens)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, 100000-logs[0].Quota, user.Quota)
	assert.Equal(t, 50000-logs[0].Quota, token.RemainQuota)
	t.Log(fmt.Sprintf("model=%s input=%d output=%d quota=%d; all three primitives returned", result.Model, *result.Usage.InputTokens, *result.Usage.OutputTokens, logs[0].Quota))
}
