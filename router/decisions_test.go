package router

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const decisionQuestions = `[
	{"type":"predicate","name":"damage","instructions":"Is it damaged?"},
	{"type":"choice","instructions":"Return a boolean or its spelling","choices":[{"value":false},{"value":"false"}]},
	{"type":"score","instructions":"Severity","levels":[{"label":"Low"},{"label":"High"}]},
	{"type":"predicate","name":"refused","instructions":"Refuse this question"}
]`

const decisionAnswers = `[
	{"type":"predicate","name":"damage","probability":0},
	{"type":"choice","name":null,"choice":false,"confidence":0,"probabilities":[{"value":false,"probability":1},{"value":"false","probability":0}]},
	{"type":"score","name":null,"score":0.5,"confidence":0,"probabilities":[{"value":0,"label":"Low","probability":0.5},{"value":1,"label":"High","probability":0.5}]},
	{"type":"refusal","name":"refused"}
]`

// TestDecisionsValidation checks native question types, text and image inputs,
// request limits, and token-estimation metadata for accepted requests.
func TestDecisionsValidation(t *testing.T) {
	valid := `{"model":"gpt-6-luna","input":"broken screen","questions":` + decisionQuestions + `}`
	for _, tc := range []struct{ name, body, want string }{
		{"three types and typed false", valid, ""},
		{"missing model", strings.Replace(valid, `"gpt-6-luna"`, `""`, 1), "model is required"},
		{"missing input", strings.Replace(valid, `"broken screen"`, `null`, 1), "input must"},
		{"stream", strings.Replace(valid, `"input":`, `"stream":true,"input":`, 1), "streaming"},
		{"missing instructions", strings.Replace(valid, `,"instructions":"Is it damaged?"`, ``, 1), "instructions is required"},
		{"duplicate choices", strings.Replace(valid, `{"value":"false"}`, `{"value":false}`, 1), "unique"},
		{"numeric choice", strings.Replace(valid, `{"value":false}`, `{"value":0}`, 1), "string or boolean"},
		{"wrong role", strings.Replace(valid, `"broken screen"`, `[{"role":"system","content":"text"}]`, 1), "user messages"},
		{"audio", strings.Replace(valid, `"broken screen"`, `[{"role":"user","content":[{"type":"input_audio"}]}]`, 1), "input_text and input_image"},
		{"file id", strings.Replace(valid, `"broken screen"`, `[{"role":"user","content":[{"type":"input_image","file_id":"file-1"}]}]`, 1), "file_id"},
		{"image URL", strings.Replace(valid, `"broken screen"`, `[{"role":"user","type":"message","content":[{"type":"input_image","image_url":"https://example.com/photo.png","detail":"original"}]}]`, 1), ""},
		{"image data URL", strings.Replace(valid, `"broken screen"`, `[{"role":"user","content":[{"type":"input_text","text":"photo"},{"type":"input_image","image_url":"data:image/png;base64,aGVsbG8="}]}]`, 1), ""},
		{"invalid URL", strings.Replace(valid, `"broken screen"`, `[{"role":"user","content":[{"type":"input_image","image_url":"file:///photo.png"}]}]`, 1), "HTTP(S)"},
		{"too many images", strings.Replace(valid, `"broken screen"`, `[{"role":"user","content":[`+strings.Repeat(`{"type":"input_image","image_url":"https://example.com/image"},`, 128)+`{"type":"input_image","image_url":"https://example.com/image"}]}]`, 1), "128 images"},
		{"identifier limit", strings.Replace(valid, `"input":`, `"safety_identifier":"`+strings.Repeat("x", 129)+`","input":`, 1), "128 characters"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request dto.OpenAIDecisionsRequest
			require.NoError(t, common.Unmarshal([]byte(tc.body), &request))
			err := request.Validate()
			if tc.want != "" {
				require.ErrorContains(t, err, tc.want)
				return
			}
			require.NoError(t, err)
			meta := request.GetTokenCountMeta()
			assert.Contains(t, meta.CombineText, "Is it damaged?")
			assert.NotContains(t, meta.CombineText, "aGVsbG8=")
		})
	}
}

// TestDecisionsRelay exercises routing, access checks, model mapping, endpoint
// pricing, retry settlement, and failure refunds against a simulated upstream.
func TestDecisionsRelay(t *testing.T) {
	require.NoError(t, i18n.Init())
	setupRelayRouterTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Channel{}, &model.Log{}))
	previous := config.GlobalConfig.ExportAllConfigs()
	previousRetry, previousMedia := common.RetryTimes, constant.GetMediaToken
	constant.GetMediaToken = false
	previousUnit, previousBatch, previousCache, previousCount := common.QuotaPerUnit, common.BatchUpdateEnabled, common.MemoryCacheEnabled, constant.CountToken
	common.QuotaPerUnit, common.BatchUpdateEnabled, common.MemoryCacheEnabled, constant.CountToken = 500000, false, false, true
	t.Cleanup(func() {
		common.RetryTimes, constant.GetMediaToken = previousRetry, previousMedia
		require.NoError(t, config.GlobalConfig.LoadFromDB(previous))
		common.QuotaPerUnit, common.BatchUpdateEnabled, common.MemoryCacheEnabled, constant.CountToken = previousUnit, previousBatch, previousCache, previousCount
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"quota_setting.trust_quota_usd":   "0",
		"group_ratio_setting.group_ratio": `{"default":1}`,
		"billing_setting.billing_mode":    `{"decision-alias-decisions":"tiered_expr"}`,
		"billing_setting.billing_expr":    `{"decision-alias-decisions":"tier(\"custom\", p * 0.3)"}`,
	}))
	service.InitHttpClient()
	var calls atomic.Int32
	var captured, upstreamResponse atomic.Value
	type testResponse struct {
		status int
		body   string
		retry  bool
	}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		assert.Equal(t, "/v1/decisions", r.URL.Path)
		assert.Equal(t, "Bearer upstream-test-key", r.Header.Get("Authorization"))
		b, err := io.ReadAll(r.Body)
		assert.NoError(t, err)
		captured.Store(string(b))
		response := upstreamResponse.Load().(testResponse)
		w.Header().Set("Content-Type", "application/json")
		if response.retry && calls.Load() == 1 {
			w.WriteHeader(503)
			_, _ = io.WriteString(w, `{"error":{"message":"temporarily unavailable","type":"server_error"}}`)
			return
		}
		w.WriteHeader(response.status)
		_, _ = io.WriteString(w, response.body)
	}))
	t.Cleanup(upstream.Close)
	mapping := `{"decision-alias":"gpt-6-luna","gpt-6-luna":"gpt-6-luna-upstream"}`
	channel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "upstream-test-key", Status: common.ChannelStatusEnabled, Name: "decisions", BaseURL: &upstream.URL, Models: "gpt-6-luna,decision-alias", Group: "default", ModelMapping: &mapping}
	require.NoError(t, channel.Insert())
	engine := gin.New()
	SetRelayRouter(engine)
	const wallet = 1000000
	for i, tc := range []struct {
		name, model, usage, invalid, override, input, answers string
		status, wantStatus, wantQuota, channelType            int
		noAuth, restricted, emptyWallet, retry, customPrice   bool
	}{
		{name: "native answers and input billing", usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 50},
		{name: "long context threshold", usage: `{"input_tokens":272000,"output_tokens":0,"total_tokens":272000}`, wantQuota: 13600},
		{name: "long context multiplier", usage: `{"input_tokens":272010,"output_tokens":0,"total_tokens":272010}`, wantQuota: 27201},
		{name: "free cache and output", usage: `{"input_tokens":1000,"input_tokens_details":{"cached_tokens":200,"cache_write_tokens":100},"output_tokens":100,"output_tokens_details":{"reasoning_tokens":10},"total_tokens":1100}`, wantQuota: 35},
		{name: "alias and administrator price", model: "decision-alias", usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 150},
		{name: "newapi channel", channelType: constant.ChannelTypeNewAPI, usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 50},
		{name: "images survive relay", input: `[{"role":"user","content":[{"type":"input_text","text":"photo"},{"type":"input_image","image_url":"data:image/png;base64,aGVsbG8="},{"type":"input_image","image_url":"https://example.com/image.png","detail":"original"}]}]`, usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 50},
		{name: "retry settles once", retry: true, usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 50},
		{name: "override builtin price", customPrice: true, usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantQuota: 200},
		{name: "invalid answers refund", answers: `[]`, usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantStatus: 502},
		{name: "incomplete predicate refund", answers: strings.Replace(decisionAnswers, `,"probability":0`, "", 1), usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1000}`, wantStatus: 502},
		{name: "zero usage", usage: `{"input_tokens":0,"output_tokens":0,"total_tokens":0}`},
		{name: "missing usage", usage: `null`, wantStatus: 502},
		{name: "negative usage", usage: `{"input_tokens":-1,"output_tokens":0,"total_tokens":-1}`, wantStatus: 502},
		{name: "overflow usage", usage: `{"input_tokens":2147483648,"output_tokens":0,"total_tokens":2147483648}`, wantStatus: 502},
		{name: "fractional usage", usage: `{"input_tokens":0.5,"output_tokens":0,"total_tokens":0.5}`, wantStatus: 502},
		{name: "missing output usage", usage: `{"input_tokens":1000,"total_tokens":1000}`, wantStatus: 502},
		{name: "inconsistent usage", usage: `{"input_tokens":1000,"output_tokens":0,"total_tokens":1}`, wantStatus: 502},
		{name: "invalid cache usage", usage: `{"input_tokens":1000,"input_tokens_details":{"cached_tokens":-1},"output_tokens":0,"total_tokens":1000}`, wantStatus: 502},
		{name: "upstream rejection", status: 400, wantStatus: 400},
		{name: "unauthenticated", noAuth: true, wantStatus: 401},
		{name: "model forbidden", restricted: true, wantStatus: 403},
		{name: "insufficient wallet", emptyWallet: true, wantStatus: 403},
		{name: "invalid question", invalid: `{"type":"unknown","instructions":"test"}`, wantStatus: 400},
		{name: "override cannot enable streaming", override: `{"stream":true}`, wantStatus: 400},
		{name: "override cannot bypass question validation", override: `{"questions":[{"type":"choice","instructions":"test","choices":[{"value":false}]}]}`, wantStatus: 400},
		{name: "unsupported channel", channelType: constant.ChannelTypeAzure, wantStatus: 500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			common.RetryTimes = 0
			if tc.retry {
				common.RetryTimes = 1
			}
			pricing := map[string]string{"decision-alias-decisions": `tier("custom", p * 0.3)`}
			if tc.customPrice {
				pricing["gpt-6-luna-decisions"] = `tier("custom", p * 0.4)`
			}
			pricingJSON, err := common.Marshal(pricing)
			require.NoError(t, err)
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_expr": string(pricingJSON)}))
			calls.Store(0)
			captured.Store("")
			upstreamStatus := tc.status
			if upstreamStatus == 0 {
				upstreamStatus = 200
			}
			answers := decisionAnswers
			if tc.answers != "" {
				answers = tc.answers
			}
			upstreamBody := `{"model":"gpt-6-luna-upstream","answers":` + answers + `,"usage":` + tc.usage + `}`
			if upstreamStatus != 200 {
				upstreamBody = `{"error":{"message":"bad request","type":"invalid_request_error","code":"invalid_request"}}`
			}
			upstreamResponse.Store(testResponse{upstreamStatus, upstreamBody, tc.retry})
			kind := tc.channelType
			if kind == 0 {
				kind = constant.ChannelTypeOpenAI
			}
			require.NoError(t, model.DB.Model(&channel).Updates(map[string]any{"type": kind, "param_override": tc.override}).Error)
			user := model.User{Username: fmt.Sprintf("decisions-%d", i), AffCode: fmt.Sprintf("d%d", i), Status: common.UserStatusEnabled, Group: "default", Quota: wallet, Setting: `{"billing_preference":"wallet_only"}`}
			if tc.emptyWallet {
				user.Quota = 0
			}
			require.NoError(t, model.DB.Create(&user).Error)
			token := model.Token{UserId: user.Id, Key: fmt.Sprintf("decisionstest%d", i), Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: wallet, ModelLimitsEnabled: tc.restricted, ModelLimits: "different-model"}
			require.NoError(t, model.DB.Create(&token).Error)
			modelName := tc.model
			if modelName == "" {
				modelName = "gpt-6-luna"
			}
			questions := decisionQuestions
			if tc.invalid != "" {
				questions = "[" + tc.invalid + "]"
			}
			input := `"` + strings.Repeat("broken screen ", 100) + `"`
			if tc.input != "" {
				input = tc.input
			}
			body := `{"model":"` + modelName + `","input":` + input + `,"safety_identifier":"test-user","questions":` + questions + `}`
			req := httptest.NewRequest(http.MethodPost, "/v1/decisions", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			if !tc.noAuth {
				req.Header.Set("Authorization", "Bearer "+token.Key)
			}
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, req)
			wantStatus := tc.wantStatus
			if wantStatus == 0 {
				wantStatus = 200
			}
			require.Equal(t, wantStatus, recorder.Code, recorder.Body.String())
			if wantStatus == 200 {
				assert.JSONEq(t, upstreamBody, recorder.Body.String())
				var forwarded dto.OpenAIDecisionsRequest
				require.NoError(t, common.Unmarshal([]byte(captured.Load().(string)), &forwarded))
				assert.Equal(t, "gpt-6-luna-upstream", forwarded.Model)
				assert.Equal(t, "false", string(forwarded.Questions[1].Choices[0].Value))
				assert.Equal(t, "test-user", *forwarded.SafetyIdentifier)
				assert.JSONEq(t, input, string(forwarded.Input))
				wantCalls := 1
				if tc.retry {
					wantCalls = 2
				}
				assert.EqualValues(t, wantCalls, calls.Load())
			} else if tc.noAuth || tc.restricted || tc.emptyWallet || tc.invalid != "" || tc.override != "" || tc.channelType == constant.ChannelTypeAzure {
				assert.Zero(t, calls.Load())
			} else {
				assert.GreaterOrEqual(t, calls.Load(), int32(1))
			}
			initial := wallet
			if tc.emptyWallet {
				initial = 0
			}
			// Failed requests return reservations asynchronously through BillingSession.
			require.Eventually(t, func() bool {
				var saved model.User
				var savedToken model.Token
				return model.DB.First(&saved, user.Id).Error == nil && saved.Quota == initial-tc.wantQuota && model.DB.First(&savedToken, token.Id).Error == nil && savedToken.RemainQuota == wallet-tc.wantQuota
			}, time.Second*3, time.Millisecond*10, "wallet must settle or refund")
			require.NoError(t, model.DB.First(&token, token.Id).Error)
			assert.Equal(t, wallet-tc.wantQuota, token.RemainQuota)
			var logs []model.Log
			require.NoError(t, model.LOG_DB.Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).Find(&logs).Error)
			if wantStatus == 200 {
				require.Len(t, logs, 1)
				assert.Equal(t, tc.wantQuota, logs[0].Quota)
				assert.Equal(t, modelName+"-decisions", logs[0].ModelName)
			} else {
				assert.Empty(t, logs)
			}
		})
	}
}
