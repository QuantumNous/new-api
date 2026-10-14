package controller

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"gorm.io/gorm"
)

const (
	seedreamBillingOrderModel       = "doubao-seedream-5-0-pro-260628"
	seedreamBillingOrderExpr        = `tier("per_image", fixed(images_up_to_1_5k * 0.04109589041 + images_above_1_5k * 0.08219178082 + max(input_images - 1, 0) * 0.002739726027))`
	gptImageBillingOrderModel       = "gpt-image-2"
	gptImageBillingOrderExpr        = `tier("request", fixed(0.1))`
	mappedImageBillingOrderModel    = "billing-origin-image"
	mappedImageBillingOrderAlias    = "provider-image-alias"
	mappedImageBillingOrderExpr     = `param("model") == "billing-origin-image" ? tier("origin", fixed(0.01)) : tier("mapped", fixed(0.2))`
	qualityImageBillingOrderModel   = "gpt-image-quality-retry"
	qualityImageBillingOrderExpr    = `param("quality") == "hd" ? tier("hd", fixed(0.2)) : tier("standard", fixed(0.1))`
	tokenImageBillingOrderModel     = "gpt-image-token-retry"
	tokenImageBillingOrderExpr      = `tier("token", p * 100000 + c)`
	multipartImageBillingOrderModel = "gpt-image-multipart-safe-scalars"
	multipartImageBillingOrderExpr  = `param("stream") == true && param("output_compression") == 90 ? tier("safe", fixed(0.2)) : tier("fallback", fixed(0.01))`
	seedreamLayerBillingOrderModel  = "doubao-seedream-5-0-pro"
	seedreamLayerBillingOrderExpr   = `tier("layer", fixed(0.01)) * image_count`
	geminiImageBillingOrderModel    = "imagen-billing-native"
	geminiImageBillingOrderExpr     = `tier("gemini-native", fixed(0.1)) * image_count`
	siliconImageBillingOrderModel   = "silicon-image-billing"
	siliconImageBillingOrderExpr    = `(param("image_size") == "1024x768" ? tier("silicon-native", fixed(0.1)) : tier("silicon-fallback", fixed(0.01))) * image_count`
	unknownImageBillingOrderModel   = "unknown-native-image"
	unknownImageBillingOrderExpr    = `tier("unknown-native", fixed(0.1))`
	seedreamBillingOrderMappedName  = "provider-seedream-alias"
)

type seedreamBillingOrderFixture struct {
	db    *gorm.DB
	user  *model.User
	token *model.Token
}

func newSeedreamBillingOrderFixture(t *testing.T) *seedreamBillingOrderFixture {
	t.Helper()

	db := modelManagementDB(t, "sqlite", "")
	require.NoError(t, db.AutoMigrate(
		&model.Token{},
		&model.Log{},
		&model.UpstreamSource{},
		&model.UpstreamGroup{},
		&model.UpstreamManagedRoute{},
	))

	previousBatch := common.BatchUpdateEnabled
	previousLogs := common.LogConsumeEnabled
	previousCountTokens := constant.CountToken
	previousQuotaPerUnit := common.QuotaPerUnit
	previousRetries := common.RetryTimes
	previousQuotaSetting := *operation_setting.GetQuotaSetting()
	previousOrchestration := *operation_setting.GetUpstreamOrchestrationSetting()
	previousPassThrough := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	previousGinMode := gin.Mode()
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	constant.CountToken = false
	common.QuotaPerUnit = 500_000
	common.RetryTimes = 0
	operation_setting.GetQuotaSetting().TrustQuotaUSD = 0
	operation_setting.GetQuotaSetting().PreConsumeMultiplier = 1
	operation_setting.GetUpstreamOrchestrationSetting().Enabled = false
	model_setting.GetGlobalSettings().PassThroughRequestEnabled = false
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() {
		common.BatchUpdateEnabled = previousBatch
		common.LogConsumeEnabled = previousLogs
		constant.CountToken = previousCountTokens
		common.QuotaPerUnit = previousQuotaPerUnit
		common.RetryTimes = previousRetries
		*operation_setting.GetQuotaSetting() = previousQuotaSetting
		*operation_setting.GetUpstreamOrchestrationSetting() = previousOrchestration
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = previousPassThrough
		gin.SetMode(previousGinMode)
	})

	expressions, err := common.Marshal(map[string]string{
		seedreamBillingOrderModel:       seedreamBillingOrderExpr,
		gptImageBillingOrderModel:       gptImageBillingOrderExpr,
		mappedImageBillingOrderModel:    mappedImageBillingOrderExpr,
		qualityImageBillingOrderModel:   qualityImageBillingOrderExpr,
		tokenImageBillingOrderModel:     tokenImageBillingOrderExpr,
		multipartImageBillingOrderModel: multipartImageBillingOrderExpr,
		seedreamLayerBillingOrderModel:  seedreamLayerBillingOrderExpr,
		geminiImageBillingOrderModel:    geminiImageBillingOrderExpr,
		siliconImageBillingOrderModel:   siliconImageBillingOrderExpr,
		unknownImageBillingOrderModel:   unknownImageBillingOrderExpr,
	})
	require.NoError(t, err)
	billingModes, err := common.Marshal(map[string]string{
		seedreamBillingOrderModel:       "tiered_expr",
		gptImageBillingOrderModel:       "tiered_expr",
		mappedImageBillingOrderModel:    "tiered_expr",
		qualityImageBillingOrderModel:   "tiered_expr",
		tokenImageBillingOrderModel:     "tiered_expr",
		multipartImageBillingOrderModel: "tiered_expr",
		seedreamLayerBillingOrderModel:  "tiered_expr",
		geminiImageBillingOrderModel:    "tiered_expr",
		siliconImageBillingOrderModel:   "tiered_expr",
		unknownImageBillingOrderModel:   "tiered_expr",
	})
	require.NoError(t, err)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": string(billingModes),
		"billing_setting.billing_expr": string(expressions),
	}))

	user := &model.User{
		Id:       7_501,
		Username: "seedream-billing-order",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Setting:  `{"billing_preference":"wallet_only"}`,
		Quota:    500_000,
	}
	require.NoError(t, db.Create(user).Error)
	token := &model.Token{
		Id:          7_502,
		UserId:      user.Id,
		Key:         "seedream-billing-order-token",
		Name:        "seedream-billing-order",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: 500_000,
	}
	require.NoError(t, db.Create(token).Error)
	service.InitHttpClient()

	return &seedreamBillingOrderFixture{db: db, user: user, token: token}
}

func (f *seedreamBillingOrderFixture) resetQuota(t *testing.T, quota int) {
	t.Helper()
	require.NoError(t, f.db.Model(f.user).Updates(map[string]any{
		"quota": quota, "used_quota": 0, "request_count": 0,
	}).Error)
	require.NoError(t, f.db.Model(f.token).Updates(map[string]any{
		"remain_quota": quota, "used_quota": 0,
	}).Error)
	require.NoError(t, model.LOG_DB.Where("user_id = ?", f.user.Id).Delete(&model.Log{}).Error)
}

func (f *seedreamBillingOrderFixture) relay(
	t *testing.T,
	requestID string,
	body string,
	baseURL string,
	passThrough bool,
	paramOverride map[string]any,
) *httptest.ResponseRecorder {
	t.Helper()

	return f.relayWithOptions(t, imageRelayOptions{
		requestID:     requestID,
		model:         seedreamBillingOrderModel,
		path:          "/v1/images/generations",
		contentType:   "application/json",
		body:          []byte(body),
		baseURL:       baseURL,
		usingGroup:    "default",
		tokenGroup:    "default",
		passThrough:   passThrough,
		paramOverride: paramOverride,
	})
}

type imageRelayOptions struct {
	requestID     string
	model         string
	path          string
	contentType   string
	body          []byte
	baseURL       string
	usingGroup    string
	tokenGroup    string
	passThrough   bool
	paramOverride map[string]any
	modelMapping  string
	autoGroups    []string
	crossGroup    bool
	channelType   int
	channelKey    string
}

func (f *seedreamBillingOrderFixture) relayWithOptions(t *testing.T, options imageRelayOptions) *httptest.ResponseRecorder {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, options.path, bytes.NewReader(options.body))
	c.Request.Header.Set("Content-Type", options.contentType)
	c.Set(common.RequestIdKey, options.requestID)
	c.Set("username", f.user.Username)
	c.Set("token_name", f.token.Name)
	common.SetContextKey(c, constant.ContextKeyOriginalModel, options.model)
	common.SetContextKey(c, constant.ContextKeyUserId, f.user.Id)
	common.SetContextKey(c, constant.ContextKeyUserQuota, f.user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, options.usingGroup)
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})
	common.SetContextKey(c, constant.ContextKeyTokenId, f.token.Id)
	common.SetContextKey(c, constant.ContextKeyTokenKey, f.token.Key)
	common.SetContextKey(c, constant.ContextKeyTokenGroup, options.tokenGroup)
	common.SetContextKey(c, constant.ContextKeyTokenUnlimited, false)
	common.SetContextKey(c, constant.ContextKeyTokenCrossGroupRetry, options.crossGroup)
	if options.autoGroups != nil {
		common.SetContextKey(c, constant.ContextKeyTokenAutoGroups, options.autoGroups)
	}
	c.Set("token_quota", f.token.RemainQuota)
	channelType := options.channelType
	if channelType == 0 {
		channelType = constant.ChannelTypeOpenAI
	}
	common.SetContextKey(c, constant.ContextKeyChannelId, 7_503)
	common.SetContextKey(c, constant.ContextKeyChannelName, "seedream-billing-order")
	common.SetContextKey(c, constant.ContextKeyChannelType, channelType)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, options.baseURL)
	channelKey := options.channelKey
	if channelKey == "" {
		channelKey = "local-test-key"
	}
	common.SetContextKey(c, constant.ContextKeyChannelKey, channelKey)
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, false)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{
		PassThroughBodyEnabled: options.passThrough,
	})
	if options.paramOverride != nil {
		common.SetContextKey(c, constant.ContextKeyChannelParamOverride, options.paramOverride)
	}
	if options.modelMapping != "" {
		common.SetContextKey(c, constant.ContextKeyChannelModelMapping, options.modelMapping)
	}

	Relay(c, types.RelayFormatOpenAIImage)
	return recorder
}

func imageBillingMultipartBody(t *testing.T, modelName, n string, prompts ...string) ([]byte, string) {
	t.Helper()

	prompt := "billing fixture"
	if len(prompts) > 0 {
		prompt = prompts[0]
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", modelName))
	require.NoError(t, writer.WriteField("prompt", prompt))
	require.NoError(t, writer.WriteField("size", "1K"))
	require.NoError(t, writer.WriteField("n", n))
	image, err := writer.CreateFormFile("image", "fixture.png")
	require.NoError(t, err)
	_, err = image.Write([]byte("fixture image"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	return body.Bytes(), writer.FormDataContentType()
}

func configureImageBillingGroups(t *testing.T, ratios string, usable string) {
	t.Helper()

	previousRatios := ratio_setting.GroupRatio2JSONString()
	previousUsable := setting.UserUsableGroups2JSONString()
	previousMax := setting.GetMaxTokenAutoGroups()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(ratios))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(usable))
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("2"))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousRatios))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsable))
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(fmt.Sprintf("%d", previousMax)))
	})
}

func (f *seedreamBillingOrderFixture) createRetryChannel(t *testing.T, group, modelName, baseURL string, paramOverrides ...string) {
	t.Helper()

	priority := int64(0)
	weight := uint(100)
	autoBan := 0
	channel := &model.Channel{
		Name: "image-retry-" + group, Key: "local-test-key", Type: constant.ChannelTypeOpenAI,
		Status: common.ChannelStatusEnabled, Group: group, Models: modelName, BaseURL: &baseURL,
		Priority: &priority, Weight: &weight, AutoBan: &autoBan,
	}
	if len(paramOverrides) > 0 {
		channel.ParamOverride = &paramOverrides[0]
	}
	require.NoError(t, f.db.Create(channel).Error)
	require.NoError(t, f.db.Create(&model.Ability{
		Group: group, Model: modelName, ChannelId: channel.Id, Enabled: true,
		Priority: &priority, Weight: weight,
	}).Error)
}

func recordUserQuotaMutations(t *testing.T, db *gorm.DB) *atomic.Int32 {
	t.Helper()

	var count atomic.Int32
	name := fmt.Sprintf("test:seedream_billing_order:%p", &count)
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register(name, func(tx *gorm.DB) {
		table := tx.Statement.Table
		if tx.Statement.Schema != nil {
			table = tx.Statement.Schema.Table
		}
		if table != "users" {
			return
		}
		values, ok := tx.Statement.Dest.(map[string]any)
		if !ok {
			return
		}
		if _, changesQuota := values["quota"]; changesQuota {
			count.Add(1)
		}
	}))
	return &count
}

func TestRelaySeedreamRejectsFinalZeroBeforeBillingAndDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)

	tests := []struct {
		name          string
		body          string
		quota         int
		passThrough   bool
		paramOverride map[string]any
	}{
		{
			name:  "channel override with insufficient balance",
			body:  `{"model":"` + seedreamBillingOrderModel + `","prompt":"test","size":"1K","n":1}`,
			quota: 1,
			paramOverride: map[string]any{"operations": []any{
				map[string]any{"path": "n", "mode": "set", "value": 0},
			}},
		},
		{
			name:        "pass-through with insufficient balance",
			body:        `{"model":"` + seedreamBillingOrderModel + `","prompt":"test","size":"1K","n":0}`,
			quota:       1,
			passThrough: true,
		},
		{
			name:  "channel override with sufficient balance",
			body:  `{"model":"` + seedreamBillingOrderModel + `","prompt":"test","size":"1K","n":1}`,
			quota: 500_000,
			paramOverride: map[string]any{"operations": []any{
				map[string]any{"path": "n", "mode": "set", "value": 0},
			}},
		},
	}

	for index, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture.user.Quota = testCase.quota
			fixture.token.RemainQuota = testCase.quota
			fixture.resetQuota(t, testCase.quota)
			quotaMutations.Store(0)
			dispatches.Store(0)

			recorder := fixture.relay(
				t,
				fmt.Sprintf("seedream-invalid-%d", index),
				testCase.body,
				upstream.URL,
				testCase.passThrough,
				testCase.paramOverride,
			)

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "invalid_request")
			assert.Zero(t, dispatches.Load(), "invalid final request must not reach the provider")
			assert.Zero(t, quotaMutations.Load(), "invalid final request must not reserve or refund quota")

			require.Eventually(t, func() bool {
				var user model.User
				var token model.Token
				if fixture.db.First(&user, fixture.user.Id).Error != nil ||
					fixture.db.First(&token, fixture.token.Id).Error != nil {
					return false
				}
				return user.Quota == testCase.quota && token.RemainQuota == testCase.quota
			}, 3*time.Second, 10*time.Millisecond)
			assert.Zero(t, quotaMutations.Load(), "invalid final request must not reserve or refund quota")
		})
	}
}

func TestRelaySeedreamIngressZeroNormalizesToOneBeforeFinalOutbound(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	expectedQuota := billingexpr.QuotaRound(0.04109589041 * common.QuotaPerUnit)
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		count      int64
		userQuota  int
		tokenQuota int
		err        error
	}
	dispatched := make(chan dispatchSnapshot, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		dispatched <- dispatchSnapshot{
			count:      gjson.GetBytes(body, "n").Int(),
			userQuota:  user.Quota,
			tokenQuota: token.RemainQuota,
			err:        firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relay(
		t,
		"seedream-ingress-zero-normalized",
		`{"model":"`+seedreamBillingOrderModel+`","prompt":"test","size":"1K","n":0}`,
		upstream.URL,
		false,
		nil,
	)

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, dispatched, 1)
	snapshot := <-dispatched
	require.NoError(t, snapshot.err)
	assert.Equal(t, int64(1), snapshot.count)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
	assert.Equal(t, int32(1), quotaMutations.Load(), "normalized request must use one billing session")
}

func TestRelayTencentOpenAIDelegationUsesConfirmedOutboundSchema(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	const expectedQuota = 50_000
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		count      int64
		userQuota  int
		tokenQuota int
		err        error
	}
	dispatched := make(chan dispatchSnapshot, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		dispatched <- dispatchSnapshot{
			count:      gjson.GetBytes(body, "n").Int(),
			userQuota:  user.Quota,
			tokenQuota: token.RemainQuota,
			err:        firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "tencent-openai-delegation",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body:        []byte(`{"model":"` + gptImageBillingOrderModel + `","prompt":"billing fixture","n":1}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		channelType: constant.ChannelTypeTencent,
		channelKey:  "single-tokenhub-key",
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, dispatched, 1)
	snapshot := <-dispatched
	require.NoError(t, snapshot.err)
	assert.Equal(t, int64(1), snapshot.count)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
	assert.Equal(t, int32(1), quotaMutations.Load(), "delegated request must use one billing session")
}

func TestRelayTencentNativeImageRemainsFailClosed(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "tencent-native-fail-closed",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body:        []byte(`{"model":"` + gptImageBillingOrderModel + `","prompt":"billing fixture","n":1}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		channelType: constant.ChannelTypeTencent,
		channelKey:  "secret-id|secret-key|app-id",
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), string(types.ErrorCodeConvertRequestFailed))
	assert.Zero(t, dispatches.Load(), "unsupported native Tencent Images request must not reach the provider")
	assert.Zero(t, quotaMutations.Load(), "unsupported native Tencent Images request must not reserve or refund quota")
}

func TestRelaySeedreamRejectsFinalMultipartZeroBeforeBillingAndDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	const initialQuota = 500_000

	for _, passThrough := range []bool{true, false} {
		name := "converted buffer"
		if passThrough {
			name = "pass-through"
		}
		t.Run(name, func(t *testing.T) {
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations.Store(0)
			var dispatches atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				dispatches.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)
			body, contentType := imageBillingMultipartBody(t, seedreamBillingOrderModel, "0")

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   fmt.Sprintf("seedream-multipart-zero-%t", passThrough),
				model:       seedreamBillingOrderModel,
				path:        "/v1/images/edits",
				contentType: contentType,
				body:        body,
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				passThrough: passThrough,
			})

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "invalid_request")
			assert.Zero(t, dispatches.Load(), "invalid final multipart must not reach the provider")
			assert.Zero(t, quotaMutations.Load(), "invalid final multipart must not reserve or refund quota")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota, user.Quota)
			assert.Equal(t, initialQuota, token.RemainQuota)
		})
	}
}

func TestRelaySeedreamMappedMultipartUsesOriginBillingIdentity(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	const initialQuota = 500_000
	expectedQuota := billingexpr.QuotaRound(0.04109589041 * common.QuotaPerUnit)
	mapping := `{"` + seedreamBillingOrderModel + `":"` + seedreamBillingOrderMappedName + `"}`

	for _, passThrough := range []bool{true, false} {
		name := "converted buffer"
		wantProviderModel := seedreamBillingOrderMappedName
		if passThrough {
			name = "pass-through"
			wantProviderModel = seedreamBillingOrderModel
		}
		t.Run(name, func(t *testing.T) {
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations.Store(0)
			type dispatchSnapshot struct {
				model      string
				userQuota  int
				tokenQuota int
				err        error
			}
			dispatched := make(chan dispatchSnapshot, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				formErr := request.ParseMultipartForm(32 << 20)
				dispatched <- dispatchSnapshot{
					model:      request.FormValue("model"),
					userQuota:  user.Quota,
					tokenQuota: token.RemainQuota,
					err:        firstError(userErr, tokenErr, formErr),
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)
			body, contentType := imageBillingMultipartBody(t, seedreamBillingOrderModel, "1")

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:    fmt.Sprintf("seedream-mapped-multipart-%t", passThrough),
				model:        seedreamBillingOrderModel,
				path:         "/v1/images/edits",
				contentType:  contentType,
				body:         body,
				baseURL:      upstream.URL,
				usingGroup:   "default",
				tokenGroup:   "default",
				passThrough:  passThrough,
				modelMapping: mapping,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, dispatched, 1)
			snapshot := <-dispatched
			require.NoError(t, snapshot.err)
			assert.Equal(t, wantProviderModel, snapshot.model)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
			assert.Equal(t, int32(1), quotaMutations.Load(), "mapped request must use one billing session")
		})
	}
}

func TestRelayOpenAIMultipartUsesFinalSafeScalarsForBilling(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	const initialQuota = 500_000
	const expectedQuota = 100_000

	for _, passThrough := range []bool{true, false} {
		name := "converted buffer"
		if passThrough {
			name = "pass-through"
		}
		t.Run(name, func(t *testing.T) {
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations.Store(0)

			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			for key, value := range map[string]string{
				"model":              multipartImageBillingOrderModel,
				"prompt":             "secret multipart billing prompt",
				"n":                  "1",
				"background":         "transparent",
				"output_format":      "webp",
				"output_compression": "90",
				"input_fidelity":     "high",
				"stream":             "true",
				"image_url":          "https://secret.invalid/input.png",
				"Extra":              "must-not-survive",
			} {
				require.NoError(t, writer.WriteField(key, value))
			}
			image, err := writer.CreateFormFile("image", "secret.png")
			require.NoError(t, err)
			_, err = image.Write([]byte("secret image bytes"))
			require.NoError(t, err)
			require.NoError(t, writer.Close())

			type dispatchSnapshot struct {
				background        string
				outputFormat      string
				outputCompression string
				inputFidelity     string
				userQuota         int
				tokenQuota        int
				err               error
			}
			dispatched := make(chan dispatchSnapshot, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				formErr := request.ParseMultipartForm(32 << 20)
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				dispatched <- dispatchSnapshot{
					background:        request.FormValue("background"),
					outputFormat:      request.FormValue("output_format"),
					outputCompression: request.FormValue("output_compression"),
					inputFidelity:     request.FormValue("input_fidelity"),
					userQuota:         user.Quota,
					tokenQuota:        token.RemainQuota,
					err:               firstError(formErr, userErr, tokenErr),
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   fmt.Sprintf("openai-multipart-scalars-%t", passThrough),
				model:       multipartImageBillingOrderModel,
				path:        "/v1/images/edits",
				contentType: writer.FormDataContentType(),
				body:        body.Bytes(),
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				passThrough: passThrough,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, dispatched, 1)
			snapshot := <-dispatched
			require.NoError(t, snapshot.err)
			assert.Equal(t, "transparent", snapshot.background)
			assert.Equal(t, "webp", snapshot.outputFormat)
			assert.Equal(t, "90", snapshot.outputCompression)
			assert.Equal(t, "high", snapshot.inputFidelity)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
			assert.Equal(t, int32(1), quotaMutations.Load(), "multipart request must use one billing session")
		})
	}
}

func TestRelayOpenAIJSONAndMultipartScalarTypesReserveAndSettleEqually(t *testing.T) {
	var multipartBody bytes.Buffer
	writer := multipart.NewWriter(&multipartBody)
	for key, value := range map[string]string{
		"model":              multipartImageBillingOrderModel,
		"prompt":             "secret multipart billing prompt",
		"n":                  "1",
		"stream":             "true",
		"output_compression": "90",
	} {
		require.NoError(t, writer.WriteField(key, value))
	}
	image, err := writer.CreateFormFile("image", "secret.png")
	require.NoError(t, err)
	_, err = image.Write([]byte("secret image bytes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	tests := []struct {
		name        string
		path        string
		contentType string
		body        []byte
	}{
		{
			name:        "JSON",
			path:        "/v1/images/generations",
			contentType: "application/json",
			body: []byte(`{"model":"` + multipartImageBillingOrderModel +
				`","prompt":"secret JSON billing prompt","n":1,"stream":true,"output_compression":90}`),
		},
		{
			name:        "multipart",
			path:        "/v1/images/edits",
			contentType: writer.FormDataContentType(),
			body:        multipartBody.Bytes(),
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			const initialQuota = 500_000
			const expectedQuota = 100_000
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)

			type dispatchSnapshot struct {
				userQuota   int
				tokenQuota  int
				stream      string
				compression string
				contentType string
				err         error
			}
			dispatched := make(chan dispatchSnapshot, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				snapshot := dispatchSnapshot{
					userQuota: user.Quota, tokenQuota: token.RemainQuota,
					contentType: request.Header.Get("Content-Type"),
					err:         firstError(userErr, tokenErr),
				}
				if strings.Contains(snapshot.contentType, "multipart/form-data") {
					formErr := request.ParseMultipartForm(32 << 20)
					snapshot.err = firstError(snapshot.err, formErr)
					snapshot.stream = request.FormValue("stream")
					snapshot.compression = request.FormValue("output_compression")
				} else {
					body, bodyErr := io.ReadAll(request.Body)
					snapshot.err = firstError(snapshot.err, bodyErr)
					snapshot.stream = gjson.GetBytes(body, "stream").Raw
					snapshot.compression = gjson.GetBytes(body, "output_compression").Raw
				}
				dispatched <- snapshot
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)

			requestID := "openai-scalar-semantics-" + strings.ToLower(testCase.name)
			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID: requestID, model: multipartImageBillingOrderModel,
				path: testCase.path, contentType: testCase.contentType, body: testCase.body,
				baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default",
				passThrough: true,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, dispatched, 1)
			snapshot := <-dispatched
			require.NoError(t, snapshot.err)
			assert.Equal(t, "true", snapshot.stream)
			assert.Equal(t, "90", snapshot.compression)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota-expectedQuota, user.Quota)
			assert.Equal(t, expectedQuota, user.UsedQuota)
			assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
			assert.Equal(t, expectedQuota, token.UsedQuota)
			assert.Equal(t, int32(1), quotaMutations.Load(), "equal reserve and settlement need one quota mutation")

			var logs []model.Log
			require.NoError(t, model.LOG_DB.
				Where("request_id = ? AND type = ?", requestID, model.LogTypeConsume).
				Find(&logs).Error)
			require.Len(t, logs, 1)
			assert.Equal(t, expectedQuota, logs[0].Quota)
		})
	}
}

func TestRelayOpenAIRejectsSensitiveAllowedScalarBeforeBillingAndDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID: "openai-sensitive-scalar", model: multipartImageBillingOrderModel,
		path: "/v1/images/generations", contentType: "application/json",
		body: []byte(`{"model":"` + multipartImageBillingOrderModel +
			`","prompt":"billing fixture","n":1,"output_compression":"data:image/png;base64,c2VjcmV0"}`),
		baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default", passThrough: true,
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), "output_compression")
	assert.NotContains(t, recorder.Body.String(), "c2VjcmV0")
	assert.Zero(t, dispatches.Load(), "sensitive scalar must be rejected locally")
	assert.Zero(t, quotaMutations.Load(), "sensitive scalar must not reserve or refund quota")
}

func TestRelayRejectsAmbiguousRawMultipartImageFieldsBeforeConversion(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(upstream.Close)

	buildBody := func(t *testing.T, imageFields ...string) ([]byte, string) {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", seedreamBillingOrderModel))
		require.NoError(t, writer.WriteField("prompt", "secret multipart prompt"))
		require.NoError(t, writer.WriteField("n", "1"))
		for index, field := range imageFields {
			image, err := writer.CreateFormFile(field, fmt.Sprintf("secret-%d.png", index))
			require.NoError(t, err)
			_, err = image.Write([]byte("secret image bytes"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		return body.Bytes(), writer.FormDataContentType()
	}

	for _, imageFields := range [][]string{
		{"image[bad]"},
		{"image[01]"},
		{"image[1]"},
		{"image[0]", "image[0]"},
		{"image[0]", "image[2]"},
		{"image", "image[]"},
		{"image", "image[0]"},
		{"image[]", "image[0]"},
	} {
		name := strings.Join(imageFields, "+")
		t.Run(name, func(t *testing.T) {
			const initialQuota = 500_000
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations.Store(0)
			dispatches.Store(0)
			body, contentType := buildBody(t, imageFields...)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID: "raw-multipart-image-fields-" + name,
				model:     seedreamBillingOrderModel,
				path:      "/v1/images/edits", contentType: contentType, body: body,
				baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default",
				passThrough: false,
			})

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "image")
			assert.Zero(t, dispatches.Load(), "invalid raw image fields must not dispatch")
			assert.Zero(t, quotaMutations.Load(), "invalid raw image fields must not reserve or refund quota")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota, user.Quota)
			assert.Equal(t, initialQuota, token.RemainQuota)
		})
	}

}

func TestRelaySeedreamIndexedReferencesAffectBillingAndLayerCardinality(t *testing.T) {
	buildBody := func(t *testing.T, layered bool, imageFields ...string) ([]byte, string) {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", seedreamBillingOrderModel))
		require.NoError(t, writer.WriteField("prompt", "secret multipart prompt"))
		require.NoError(t, writer.WriteField("n", "1"))
		require.NoError(t, writer.WriteField("size", "1K"))
		if layered {
			require.NoError(t, writer.WriteField("layer_decomposition", "true"))
		}
		for index, field := range imageFields {
			image, err := writer.CreateFormFile(field, fmt.Sprintf("secret-%d.png", index))
			require.NoError(t, err)
			_, err = image.Write([]byte("secret image bytes"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		return body.Bytes(), writer.FormDataContentType()
	}

	t.Run("two references include the extra input price", func(t *testing.T) {
		fixture := newSeedreamBillingOrderFixture(t)
		const initialQuota = 500_000
		expectedQuota := billingexpr.QuotaRound((0.04109589041 + 0.002739726027) * common.QuotaPerUnit)
		fixture.user.Quota = initialQuota
		fixture.token.RemainQuota = initialQuota
		fixture.resetQuota(t, initialQuota)
		quotaMutations := recordUserQuotaMutations(t, fixture.db)
		quotaMutations.Store(0)

		type dispatchSnapshot struct {
			userQuota, tokenQuota int
			err                   error
		}
		dispatched := make(chan dispatchSnapshot, 1)
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			dispatched <- dispatchSnapshot{
				userQuota: user.Quota, tokenQuota: token.RemainQuota,
				err: firstError(userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
		}))
		t.Cleanup(upstream.Close)
		body, contentType := buildBody(t, false, "image[0]", "image[1]")

		recorder := fixture.relayWithOptions(t, imageRelayOptions{
			requestID: "seedream-indexed-references", model: seedreamBillingOrderModel,
			path: "/v1/images/edits", contentType: contentType, body: body,
			baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default", passThrough: true,
		})

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		require.Len(t, dispatched, 1)
		snapshot := <-dispatched
		require.NoError(t, snapshot.err)
		assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
		assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
		var user model.User
		require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
		assert.Equal(t, expectedQuota, user.UsedQuota)
		assert.Equal(t, int32(1), quotaMutations.Load())
	})

	t.Run("two references reject layer decomposition", func(t *testing.T) {
		fixture := newSeedreamBillingOrderFixture(t)
		quotaMutations := recordUserQuotaMutations(t, fixture.db)
		quotaMutations.Store(0)
		var dispatches atomic.Int32
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			dispatches.Add(1)
			w.WriteHeader(http.StatusInternalServerError)
		}))
		t.Cleanup(upstream.Close)
		body, contentType := buildBody(t, true, "image[0]", "image[1]")

		recorder := fixture.relayWithOptions(t, imageRelayOptions{
			requestID: "seedream-indexed-layer-reject", model: seedreamBillingOrderModel,
			path: "/v1/images/edits", contentType: contentType, body: body,
			baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default", passThrough: true,
		})

		assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
		assert.Contains(t, recorder.Body.String(), "exactly one")
		assert.Zero(t, dispatches.Load())
		assert.Zero(t, quotaMutations.Load())
	})
}

func TestRelaySeedreamLayerDecompositionUsesSeventeenForReserveAndFallbackSettlement(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	expectedQuota := billingexpr.QuotaRound(17 * 0.01 * common.QuotaPerUnit)
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		userQuota, tokenQuota int
		err                   error
	}
	dispatched := make(chan dispatchSnapshot, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		dispatched <- dispatchSnapshot{
			userQuota: user.Quota, tokenQuota: token.RemainQuota,
			err: firstError(userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[]}`)
	}))
	t.Cleanup(upstream.Close)
	requestID := "seedream-layer-seventeen"

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID: requestID, model: seedreamLayerBillingOrderModel,
		path: "/v1/images/generations", contentType: "application/json",
		body: []byte(`{"model":"` + seedreamLayerBillingOrderModel +
			`","prompt":"secret prompt","n":1,"size":"1K","image":"https://secret.invalid/reference.png","layer_decomposition":true}`),
		baseURL: upstream.URL, usingGroup: "default", tokenGroup: "default", passThrough: true,
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, dispatched, 1)
	snapshot := <-dispatched
	require.NoError(t, snapshot.err)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

	var user model.User
	var token model.Token
	require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
	require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
	assert.Equal(t, initialQuota-expectedQuota, user.Quota)
	assert.Equal(t, expectedQuota, user.UsedQuota)
	assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
	assert.Equal(t, expectedQuota, token.UsedQuota)
	assert.Equal(t, int32(1), quotaMutations.Load(), "fallback settlement must retain the seventeen-image reservation")

	var logs []model.Log
	require.NoError(t, model.LOG_DB.
		Where("request_id = ? AND type = ?", requestID, model.LogTypeConsume).
		Find(&logs).Error)
	require.Len(t, logs, 1)
	assert.Equal(t, expectedQuota, logs[0].Quota)
	var other map[string]any
	require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
	assert.Equal(t, float64(17), other["image_count"])
	assert.NotContains(t, logs[0].Other, "secret")
}

func TestRelayMappedImageUsesOriginModelInBillingExpression(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	const initialQuota = 500_000
	expectedQuota := billingexpr.QuotaRound(0.01 * common.QuotaPerUnit)
	mapping := `{"` + mappedImageBillingOrderModel + `":"` + mappedImageBillingOrderAlias + `"}`

	tests := []struct {
		name        string
		path        string
		contentType string
		body        []byte
		passThrough bool
	}{
		{
			name:        "JSON converted request",
			path:        "/v1/images/generations",
			contentType: "application/json",
			body:        []byte(`{"model":"` + mappedImageBillingOrderModel + `","prompt":"billing fixture","n":2}`),
		},
	}
	for _, passThrough := range []bool{true, false} {
		body, contentType := imageBillingMultipartBody(t, mappedImageBillingOrderModel, "2")
		name := "multipart converted buffer"
		if passThrough {
			name = "multipart pass-through"
		}
		tests = append(tests, struct {
			name        string
			path        string
			contentType string
			body        []byte
			passThrough bool
		}{
			name:        name,
			path:        "/v1/images/edits",
			contentType: contentType,
			body:        body,
			passThrough: passThrough,
		})
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations.Store(0)
			type dispatchSnapshot struct {
				model      string
				userQuota  int
				tokenQuota int
				err        error
			}
			dispatched := make(chan dispatchSnapshot, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				providerModel := ""
				var bodyErr error
				if strings.Contains(request.Header.Get("Content-Type"), "multipart/form-data") {
					bodyErr = request.ParseMultipartForm(32 << 20)
					providerModel = request.FormValue("model")
				} else {
					var body []byte
					body, bodyErr = io.ReadAll(request.Body)
					providerModel = gjson.GetBytes(body, "model").String()
				}
				dispatched <- dispatchSnapshot{
					model:      providerModel,
					userQuota:  user.Quota,
					tokenQuota: token.RemainQuota,
					err:        firstError(userErr, tokenErr, bodyErr),
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:    "mapped-image-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:        mappedImageBillingOrderModel,
				path:         testCase.path,
				contentType:  testCase.contentType,
				body:         testCase.body,
				baseURL:      upstream.URL,
				usingGroup:   "default",
				tokenGroup:   "default",
				passThrough:  testCase.passThrough,
				modelMapping: mapping,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, dispatched, 1)
			snapshot := <-dispatched
			require.NoError(t, snapshot.err)
			wantProviderModel := mappedImageBillingOrderAlias
			if testCase.passThrough {
				wantProviderModel = mappedImageBillingOrderModel
			}
			assert.Equal(t, wantProviderModel, snapshot.model)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota-expectedQuota, user.Quota)
			assert.Equal(t, expectedQuota, user.UsedQuota)
			assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
			assert.Equal(t, expectedQuota, token.UsedQuota)
			assert.Equal(t, int32(1), quotaMutations.Load(), "mapped request must reserve exactly once")
		})
	}
}

func TestRelayImagesRefreshesTieredGroupBeforeEachDispatch(t *testing.T) {
	for _, testCase := range []struct {
		name             string
		firstGroup       string
		retryGroup       string
		ratios           string
		firstQuota       int
		retryQuota       int
		finalQuota       int
		wantMutations    int32
		wantUsedQuota    int
		wantTokenUsed    int
		wantConsumeQuota int
	}{
		{
			name:       "low multiplier to high multiplier",
			firstGroup: "image-low", retryGroup: "image-high",
			ratios:     `{"default":1,"image-low":0.1,"image-high":0.2}`,
			firstQuota: 495_000, retryQuota: 490_000, finalQuota: 490_000,
			wantMutations: 2, wantUsedQuota: 10_000, wantTokenUsed: 10_000, wantConsumeQuota: 10_000,
		},
		{
			name:       "paid to free",
			firstGroup: "image-paid", retryGroup: "image-free",
			ratios:     `{"default":1,"image-paid":0.2,"image-free":0}`,
			firstQuota: 490_000, retryQuota: 490_000, finalQuota: 500_000,
			wantMutations: 2, wantUsedQuota: 0, wantTokenUsed: 0, wantConsumeQuota: 0,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			configureImageBillingGroups(
				t,
				testCase.ratios,
				`{"default":"Default","`+testCase.firstGroup+`":"First","`+testCase.retryGroup+`":"Retry"}`,
			)
			fixture := newSeedreamBillingOrderFixture(t)
			previousRetries := common.RetryTimes
			common.RetryTimes = 1
			t.Cleanup(func() { common.RetryTimes = previousRetries })
			const initialQuota = 500_000
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)

			type dispatchSnapshot struct {
				userQuota  int
				tokenQuota int
				err        error
			}
			firstDispatch := make(chan dispatchSnapshot, 1)
			firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				firstDispatch <- dispatchSnapshot{userQuota: user.Quota, tokenQuota: token.RemainQuota, err: firstError(userErr, tokenErr)}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = io.WriteString(w, `{"error":{"message":"retry fixture","type":"server_error"}}`)
			}))
			t.Cleanup(firstUpstream.Close)

			retryDispatch := make(chan dispatchSnapshot, 1)
			retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				retryDispatch <- dispatchSnapshot{userQuota: user.Quota, tokenQuota: token.RemainQuota, err: firstError(userErr, tokenErr)}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(retryUpstream.Close)
			fixture.createRetryChannel(t, testCase.retryGroup, gptImageBillingOrderModel, retryUpstream.URL)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   "image-group-retry-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:       gptImageBillingOrderModel,
				path:        "/v1/images/generations",
				contentType: "application/json",
				body:        []byte(`{"model":"` + gptImageBillingOrderModel + `","prompt":"billing fixture","n":1}`),
				baseURL:     firstUpstream.URL,
				usingGroup:  testCase.firstGroup,
				tokenGroup:  "auto",
				autoGroups:  []string{testCase.firstGroup, testCase.retryGroup},
				crossGroup:  true,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, firstDispatch, 1)
			require.Len(t, retryDispatch, 1)
			first := <-firstDispatch
			retry := <-retryDispatch
			require.NoError(t, first.err)
			require.NoError(t, retry.err)
			assert.Equal(t, testCase.firstQuota, first.userQuota)
			assert.Equal(t, testCase.firstQuota, first.tokenQuota)
			assert.Equal(t, testCase.retryQuota, retry.userQuota)
			assert.Equal(t, testCase.retryQuota, retry.tokenQuota)

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, testCase.finalQuota, user.Quota)
			assert.Equal(t, testCase.wantUsedQuota, user.UsedQuota)
			assert.Equal(t, testCase.finalQuota, token.RemainQuota)
			assert.Equal(t, testCase.wantTokenUsed, token.UsedQuota)
			assert.Equal(t, testCase.wantMutations, quotaMutations.Load())

			var logs []model.Log
			require.NoError(t, model.LOG_DB.
				Where("request_id = ? AND type = ?", "image-group-retry-"+strings.ReplaceAll(testCase.name, " ", "-"), model.LogTypeConsume).
				Find(&logs).Error)
			require.Len(t, logs, 1, "one logical request must settle exactly once")
			assert.Equal(t, testCase.wantConsumeQuota, logs[0].Quota)
		})
	}
}

func TestRelayImagesRefundsAllWalletReservesAfterHigherPricedRetryFails(t *testing.T) {
	const firstGroup = "image-failing-low"
	const retryGroup = "image-failing-high"
	configureImageBillingGroups(
		t,
		`{"default":1,"`+firstGroup+`":0.1,"`+retryGroup+`":0.2}`,
		`{"default":"Default","`+firstGroup+`":"Low","`+retryGroup+`":"High"}`,
	)
	fixture := newSeedreamBillingOrderFixture(t)
	previousRetries := common.RetryTimes
	common.RetryTimes = 1
	t.Cleanup(func() { common.RetryTimes = previousRetries })

	const initialQuota = 500_000
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)

	type dispatchSnapshot struct {
		userQuota  int
		tokenQuota int
		err        error
	}
	firstDispatch := make(chan dispatchSnapshot, 1)
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		firstDispatch <- dispatchSnapshot{
			userQuota: user.Quota, tokenQuota: token.RemainQuota,
			err: firstError(userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"error":{"message":"first failure","type":"server_error"}}`)
	}))
	t.Cleanup(firstUpstream.Close)

	retryDispatch := make(chan dispatchSnapshot, 1)
	retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		retryDispatch <- dispatchSnapshot{
			userQuota: user.Quota, tokenQuota: token.RemainQuota,
			err: firstError(userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"error":{"message":"retry failure","type":"server_error"}}`)
	}))
	t.Cleanup(retryUpstream.Close)
	fixture.createRetryChannel(t, retryGroup, gptImageBillingOrderModel, retryUpstream.URL)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "image-group-retry-all-fail",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body:        []byte(`{"model":"` + gptImageBillingOrderModel + `","prompt":"billing fixture","n":1}`),
		baseURL:     firstUpstream.URL,
		usingGroup:  firstGroup,
		tokenGroup:  "auto",
		autoGroups:  []string{firstGroup, retryGroup},
		crossGroup:  true,
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code, recorder.Body.String())
	require.Len(t, firstDispatch, 1)
	require.Len(t, retryDispatch, 1)
	first := <-firstDispatch
	retry := <-retryDispatch
	require.NoError(t, first.err)
	require.NoError(t, retry.err)
	assert.Equal(t, 495_000, first.userQuota)
	assert.Equal(t, 495_000, first.tokenQuota)
	assert.Equal(t, 490_000, retry.userQuota)
	assert.Equal(t, 490_000, retry.tokenQuota)
	require.Eventually(t, func() bool {
		var user model.User
		var token model.Token
		if fixture.db.First(&user, fixture.user.Id).Error != nil ||
			fixture.db.First(&token, fixture.token.Id).Error != nil {
			return false
		}
		return user.Quota == initialQuota && token.RemainQuota == initialQuota
	}, 3*time.Second, 10*time.Millisecond)
}

func TestRelayImagesRejectsFinalSensitivePromptBeforeBillingAndDispatch(t *testing.T) {
	previousCheckSensitive := setting.CheckSensitiveEnabled
	previousCheckPrompt := setting.CheckSensitiveOnPromptEnabled
	previousSensitiveWords := append([]string(nil), setting.SensitiveWords...)
	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWords = []string{"test_sensitive"}
	t.Cleanup(func() {
		setting.CheckSensitiveEnabled = previousCheckSensitive
		setting.CheckSensitiveOnPromptEnabled = previousCheckPrompt
		setting.SensitiveWords = previousSensitiveWords
	})

	multipartBody, multipartContentType := imageBillingMultipartBody(
		t,
		gptImageBillingOrderModel,
		"1",
		"test_sensitive multipart prompt",
	)
	tests := []struct {
		name        string
		path        string
		contentType string
		body        []byte
		passThrough bool
	}{
		{
			name:        "JSON converted request",
			path:        "/v1/images/generations",
			contentType: "application/json",
			body:        []byte(`{"model":"` + gptImageBillingOrderModel + `","prompt":"test_sensitive json prompt","n":1}`),
		},
		{
			name:        "multipart pass-through",
			path:        "/v1/images/edits",
			contentType: multipartContentType,
			body:        multipartBody,
			passThrough: true,
		},
		{
			name:        "multipart converted buffer",
			path:        "/v1/images/edits",
			contentType: multipartContentType,
			body:        multipartBody,
		},
	}

	for index, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)
			var dispatches atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				dispatches.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   fmt.Sprintf("image-sensitive-%d", index),
				model:       gptImageBillingOrderModel,
				path:        testCase.path,
				contentType: testCase.contentType,
				body:        testCase.body,
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				passThrough: testCase.passThrough,
			})

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), string(types.ErrorCodeSensitiveWordsDetected))
			assert.Zero(t, dispatches.Load(), "sensitive final prompt must not reach the provider")
			assert.Zero(t, quotaMutations.Load(), "sensitive final prompt must not reserve or refund quota")
		})
	}
}

func TestRelayTokenPricedImageRejectsInsufficientQuotaBeforeDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	previousCountTokens := constant.CountToken
	constant.CountToken = true
	t.Cleanup(func() { constant.CountToken = previousCountTokens })
	service.InitTokenEncoders()
	fixture.user.Quota = 1
	fixture.token.RemainQuota = 1
	fixture.resetQuota(t, 1)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "image-token-insufficient",
		model:       tokenImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body:        []byte(`{"model":"` + tokenImageBillingOrderModel + `","prompt":"ordinary billing prompt","n":1}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
	})

	assert.Equal(t, http.StatusForbidden, recorder.Code, recorder.Body.String())
	assert.Zero(t, dispatches.Load(), "insufficient token-priced request must not reach the provider")
	assert.Zero(t, quotaMutations.Load(), "failed reservation must not mutate quota")
}

func TestRelayImagesRefreshesFinalOutboundInputBeforeRetryDispatch(t *testing.T) {
	t.Run("quality override", func(t *testing.T) {
		const firstGroup = "image-standard"
		const retryGroup = "image-hd"
		configureImageBillingGroups(
			t,
			`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
			`{"default":"Default","`+firstGroup+`":"Standard","`+retryGroup+`":"HD"}`,
		)
		fixture := newSeedreamBillingOrderFixture(t)
		previousRetries := common.RetryTimes
		common.RetryTimes = 1
		t.Cleanup(func() { common.RetryTimes = previousRetries })
		const initialQuota = 500_000
		const standardQuota = 50_000
		const hdQuota = 100_000
		fixture.user.Quota = initialQuota
		fixture.token.RemainQuota = initialQuota
		fixture.resetQuota(t, initialQuota)

		type dispatchSnapshot struct {
			quality    string
			userQuota  int
			tokenQuota int
			err        error
		}
		firstDispatch := make(chan dispatchSnapshot, 1)
		firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			body, bodyErr := io.ReadAll(request.Body)
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			firstDispatch <- dispatchSnapshot{
				quality:    gjson.GetBytes(body, "quality").String(),
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				err:        firstError(bodyErr, userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = io.WriteString(w, `{"error":{"message":"retry fixture","type":"server_error"}}`)
		}))
		t.Cleanup(firstUpstream.Close)

		retryDispatch := make(chan dispatchSnapshot, 1)
		retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			body, bodyErr := io.ReadAll(request.Body)
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			retryDispatch <- dispatchSnapshot{
				quality:    gjson.GetBytes(body, "quality").String(),
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				err:        firstError(bodyErr, userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
		}))
		t.Cleanup(retryUpstream.Close)
		fixture.createRetryChannel(
			t,
			retryGroup,
			qualityImageBillingOrderModel,
			retryUpstream.URL,
			`{"operations":[{"path":"quality","mode":"set","value":"hd"}]}`,
		)

		recorder := fixture.relayWithOptions(t, imageRelayOptions{
			requestID:   "image-quality-retry",
			model:       qualityImageBillingOrderModel,
			path:        "/v1/images/generations",
			contentType: "application/json",
			body:        []byte(`{"model":"` + qualityImageBillingOrderModel + `","prompt":"billing fixture","quality":"standard","n":1}`),
			baseURL:     firstUpstream.URL,
			usingGroup:  firstGroup,
			tokenGroup:  "auto",
			autoGroups:  []string{firstGroup, retryGroup},
			crossGroup:  true,
		})

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		require.Len(t, firstDispatch, 1)
		require.Len(t, retryDispatch, 1)
		first := <-firstDispatch
		retry := <-retryDispatch
		require.NoError(t, first.err)
		require.NoError(t, retry.err)
		assert.Equal(t, "standard", first.quality)
		assert.Equal(t, initialQuota-standardQuota, first.userQuota)
		assert.Equal(t, initialQuota-standardQuota, first.tokenQuota)
		assert.Equal(t, "hd", retry.quality)
		assert.Equal(t, initialQuota-hdQuota, retry.userQuota)
		assert.Equal(t, initialQuota-hdQuota, retry.tokenQuota)

		var user model.User
		var token model.Token
		require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
		require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
		assert.Equal(t, initialQuota-hdQuota, user.Quota)
		assert.Equal(t, hdQuota, user.UsedQuota)
		assert.Equal(t, initialQuota-hdQuota, token.RemainQuota)
		assert.Equal(t, hdQuota, token.UsedQuota)

		var logs []model.Log
		require.NoError(t, model.LOG_DB.
			Where("request_id = ? AND type = ?", "image-quality-retry", model.LogTypeConsume).
			Find(&logs).Error)
		require.Len(t, logs, 1, "one logical request must settle exactly once")
		assert.Equal(t, hdQuota, logs[0].Quota)
	})

	t.Run("prompt override", func(t *testing.T) {
		const firstGroup = "image-short-prompt"
		const retryGroup = "image-long-prompt"
		const firstPrompt = "short prompt"
		const retryPrompt = "this is a substantially longer image prompt used for retry token billing"
		configureImageBillingGroups(
			t,
			`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
			`{"default":"Default","`+firstGroup+`":"Short","`+retryGroup+`":"Long"}`,
		)
		fixture := newSeedreamBillingOrderFixture(t)
		previousRetries := common.RetryTimes
		previousCountTokens := constant.CountToken
		common.RetryTimes = 1
		constant.CountToken = true
		t.Cleanup(func() {
			common.RetryTimes = previousRetries
			constant.CountToken = previousCountTokens
		})

		service.InitTokenEncoders()
		firstTokens := service.CountTokenInput(firstPrompt, tokenImageBillingOrderModel)
		retryTokens := service.CountTokenInput(retryPrompt, tokenImageBillingOrderModel)
		require.Greater(t, retryTokens, firstTokens)
		firstQuota := billingexpr.QuotaRound(float64(firstTokens) * 100_000 / 1_000_000 * common.QuotaPerUnit)
		retryQuota := billingexpr.QuotaRound(float64(retryTokens) * 100_000 / 1_000_000 * common.QuotaPerUnit)
		initialQuota := retryQuota + 500_000
		fixture.user.Quota = initialQuota
		fixture.token.RemainQuota = initialQuota
		fixture.resetQuota(t, initialQuota)

		type dispatchSnapshot struct {
			prompt     string
			userQuota  int
			tokenQuota int
			err        error
		}
		firstDispatch := make(chan dispatchSnapshot, 1)
		firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			body, bodyErr := io.ReadAll(request.Body)
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			firstDispatch <- dispatchSnapshot{
				prompt:     gjson.GetBytes(body, "prompt").String(),
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				err:        firstError(bodyErr, userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = io.WriteString(w, `{"error":{"message":"retry fixture","type":"server_error"}}`)
		}))
		t.Cleanup(firstUpstream.Close)

		retryDispatch := make(chan dispatchSnapshot, 1)
		retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			body, bodyErr := io.ReadAll(request.Body)
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			retryDispatch <- dispatchSnapshot{
				prompt:     gjson.GetBytes(body, "prompt").String(),
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				err:        firstError(bodyErr, userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
		}))
		t.Cleanup(retryUpstream.Close)
		fixture.createRetryChannel(
			t,
			retryGroup,
			tokenImageBillingOrderModel,
			retryUpstream.URL,
			`{"operations":[{"path":"prompt","mode":"set","value":"`+retryPrompt+`"}]}`,
		)

		recorder := fixture.relayWithOptions(t, imageRelayOptions{
			requestID:   "image-prompt-retry",
			model:       tokenImageBillingOrderModel,
			path:        "/v1/images/generations",
			contentType: "application/json",
			body:        []byte(`{"model":"` + tokenImageBillingOrderModel + `","prompt":"` + firstPrompt + `","n":1}`),
			baseURL:     firstUpstream.URL,
			usingGroup:  firstGroup,
			tokenGroup:  "auto",
			autoGroups:  []string{firstGroup, retryGroup},
			crossGroup:  true,
		})

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		require.Len(t, firstDispatch, 1)
		require.Len(t, retryDispatch, 1)
		first := <-firstDispatch
		retry := <-retryDispatch
		require.NoError(t, first.err)
		require.NoError(t, retry.err)
		assert.Equal(t, firstPrompt, first.prompt)
		assert.Equal(t, initialQuota-firstQuota, first.userQuota)
		assert.Equal(t, initialQuota-firstQuota, first.tokenQuota)
		assert.Equal(t, retryPrompt, retry.prompt)
		assert.Equal(t, initialQuota-retryQuota, retry.userQuota)
		assert.Equal(t, initialQuota-retryQuota, retry.tokenQuota)

		var user model.User
		var token model.Token
		require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
		require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
		assert.Equal(t, initialQuota-retryQuota, user.Quota)
		assert.Equal(t, retryQuota, user.UsedQuota)
		assert.Equal(t, initialQuota-retryQuota, token.RemainQuota)
		assert.Equal(t, retryQuota, token.UsedQuota)

		var logs []model.Log
		require.NoError(t, model.LOG_DB.
			Where("request_id = ? AND type = ?", "image-prompt-retry", model.LogTypeConsume).
			Find(&logs).Error)
		require.Len(t, logs, 1, "one logical request must settle exactly once")
		assert.Equal(t, retryQuota, logs[0].Quota)
	})
}

func TestRelayReplicateNegativePromptIsCheckedBeforeBillingAndDispatch(t *testing.T) {
	previousCheckSensitive := setting.CheckSensitiveEnabled
	previousCheckPrompt := setting.CheckSensitiveOnPromptEnabled
	previousSensitiveWords := append([]string(nil), setting.SensitiveWords...)
	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWords = []string{"test_sensitive"}
	t.Cleanup(func() {
		setting.CheckSensitiveEnabled = previousCheckSensitive
		setting.CheckSensitiveOnPromptEnabled = previousCheckPrompt
		setting.SensitiveWords = previousSensitiveWords
	})

	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "replicate-negative-sensitive",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body: []byte(`{"model":"` + gptImageBillingOrderModel +
			`","prompt":"ordinary positive prompt","n":1,"input":{"negative_prompt":"test_sensitive negative prompt"}}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		channelType: constant.ChannelTypeReplicate,
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), string(types.ErrorCodeSensitiveWordsDetected))
	assert.Zero(t, dispatches.Load(), "sensitive negative prompt must not reach the provider")
	assert.Zero(t, quotaMutations.Load(), "sensitive negative prompt must not reserve or refund quota")
}

func TestRelayReplicateEditValidatesAndReservesBeforeUpload(t *testing.T) {
	previousCheckSensitive := setting.CheckSensitiveEnabled
	previousCheckPrompt := setting.CheckSensitiveOnPromptEnabled
	previousSensitiveWords := append([]string(nil), setting.SensitiveWords...)
	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWords = []string{"test_sensitive"}
	t.Cleanup(func() {
		setting.CheckSensitiveEnabled = previousCheckSensitive
		setting.CheckSensitiveOnPromptEnabled = previousCheckPrompt
		setting.SensitiveWords = previousSensitiveWords
	})

	tests := []struct {
		name          string
		prompt        string
		quota         int
		paramOverride map[string]any
		wantStatus    int
	}{
		{
			name: "invalid final count", prompt: "ordinary edit prompt", quota: 500_000,
			paramOverride: map[string]any{"operations": []any{
				map[string]any{"path": "input.num_outputs", "mode": "set", "value": 0},
			}},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "preexisting image prompt", prompt: "ordinary edit prompt", quota: 500_000,
			paramOverride: map[string]any{"operations": []any{
				map[string]any{"path": "input.image_prompt", "mode": "set", "value": "https://override.invalid/input.png"},
			}},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "sensitive prompt", prompt: "test_sensitive edit prompt", quota: 500_000,
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "insufficient balance", prompt: "ordinary edit prompt", quota: 1,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			fixture.user.Quota = testCase.quota
			fixture.token.RemainQuota = testCase.quota
			fixture.resetQuota(t, testCase.quota)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)
			var uploads atomic.Int32
			var predictions atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				switch {
				case request.URL.Path == "/v1/files":
					uploads.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
				case strings.HasSuffix(request.URL.Path, "/predictions"):
					predictions.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
				default:
					http.NotFound(w, request)
				}
			}))
			t.Cleanup(upstream.Close)

			body, contentType := imageBillingMultipartBody(
				t,
				gptImageBillingOrderModel,
				"1",
				testCase.prompt,
			)
			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:     "replicate-edit-reject-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:         gptImageBillingOrderModel,
				path:          "/v1/images/edits",
				contentType:   contentType,
				body:          body,
				baseURL:       upstream.URL,
				usingGroup:    "default",
				tokenGroup:    "default",
				paramOverride: testCase.paramOverride,
				channelType:   constant.ChannelTypeReplicate,
			})

			assert.Equal(t, testCase.wantStatus, recorder.Code, recorder.Body.String())
			assert.Zero(t, uploads.Load(), "local rejection must happen before file upload")
			assert.Zero(t, predictions.Load(), "local rejection must happen before prediction dispatch")
			assert.Zero(t, quotaMutations.Load(), "rejected request must not mutate quota")
		})
	}

	t.Run("valid request reserves then uploads then predicts", func(t *testing.T) {
		fixture := newSeedreamBillingOrderFixture(t)
		const initialQuota = 500_000
		const expectedQuota = 50_000
		quotaMutations := recordUserQuotaMutations(t, fixture.db)
		quotaMutations.Store(0)

		type providerEvent struct {
			kind       string
			body       []byte
			userQuota  int
			tokenQuota int
			err        error
		}
		events := make(chan providerEvent, 2)
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			body, bodyErr := io.ReadAll(request.Body)
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			event := providerEvent{
				body: body, userQuota: user.Quota, tokenQuota: token.RemainQuota,
				err: firstError(bodyErr, userErr, tokenErr),
			}
			switch {
			case request.URL.Path == "/v1/files":
				event.kind = "upload"
				events <- event
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
			case strings.HasSuffix(request.URL.Path, "/predictions"):
				event.kind = "prediction"
				events <- event
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
			default:
				http.NotFound(w, request)
			}
		}))
		t.Cleanup(upstream.Close)

		body, contentType := imageBillingMultipartBody(t, gptImageBillingOrderModel, "1")
		recorder := fixture.relayWithOptions(t, imageRelayOptions{
			requestID:   "replicate-edit-valid-order",
			model:       gptImageBillingOrderModel,
			path:        "/v1/images/edits",
			contentType: contentType,
			body:        body,
			baseURL:     upstream.URL,
			usingGroup:  "default",
			tokenGroup:  "default",
			channelType: constant.ChannelTypeReplicate,
		})

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		require.Len(t, events, 2)
		upload := <-events
		prediction := <-events
		require.NoError(t, upload.err)
		require.NoError(t, prediction.err)
		assert.Equal(t, "upload", upload.kind)
		assert.Equal(t, "prediction", prediction.kind)
		assert.Equal(t, initialQuota-expectedQuota, upload.userQuota)
		assert.Equal(t, initialQuota-expectedQuota, upload.tokenQuota)
		assert.Equal(t, initialQuota-expectedQuota, prediction.userQuota)
		assert.Equal(t, initialQuota-expectedQuota, prediction.tokenQuota)
		assert.Equal(t, int64(1), gjson.GetBytes(prediction.body, "input.num_outputs").Int())
		assert.Equal(t, "https://files.invalid/input.png", gjson.GetBytes(prediction.body, "input.image_prompt").String())
		assert.Equal(t, int32(1), quotaMutations.Load())
	})
}

func TestRelayReplicateEditRequiresExactlyOneSourceImageBeforeBilling(t *testing.T) {
	buildBody := func(t *testing.T, fileFields ...string) ([]byte, string) {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", gptImageBillingOrderModel))
		require.NoError(t, writer.WriteField("prompt", "ordinary edit prompt"))
		require.NoError(t, writer.WriteField("n", "1"))
		for index, field := range fileFields {
			file, err := writer.CreateFormFile(field, fmt.Sprintf("fixture-%d.png", index))
			require.NoError(t, err)
			_, err = file.Write([]byte("fixture image"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		return body.Bytes(), writer.FormDataContentType()
	}

	for _, testCase := range []struct {
		name       string
		fileFields []string
	}{
		{name: "mask only", fileFields: []string{"mask"}},
		{name: "unknown field", fileFields: []string{"reference_image"}},
		{name: "multiple candidates", fileFields: []string{"image", "image_prompt"}},
		{name: "multiple files in one candidate", fileFields: []string{"image_prompt", "image_prompt"}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			const initialQuota = 500_000
			fixture.user.Quota = initialQuota
			fixture.token.RemainQuota = initialQuota
			fixture.resetQuota(t, initialQuota)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)

			var uploads atomic.Int32
			var predictions atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				switch {
				case request.URL.Path == "/v1/files":
					uploads.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
				case strings.HasSuffix(request.URL.Path, "/predictions"):
					predictions.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
				default:
					http.NotFound(w, request)
				}
			}))
			t.Cleanup(upstream.Close)

			body, contentType := buildBody(t, testCase.fileFields...)
			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   "replicate-edit-source-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:       gptImageBillingOrderModel,
				path:        "/v1/images/edits",
				contentType: contentType,
				body:        body,
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				channelType: constant.ChannelTypeReplicate,
			})

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "invalid_request")
			assert.Zero(t, quotaMutations.Load(), "invalid source image must not reserve or refund quota")
			assert.Zero(t, uploads.Load(), "invalid source image must not upload")
			assert.Zero(t, predictions.Load(), "invalid source image must not predict")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota, user.Quota)
			assert.Equal(t, initialQuota, token.RemainQuota)
		})
	}
}

func TestRelayReplicateEditUploadUnknownDoesNotRetryOrRefund(t *testing.T) {
	const firstGroup = "replicate-edit-unknown"
	const retryGroup = "replicate-edit-retry"
	configureImageBillingGroups(
		t,
		`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
		`{"default":"Default","`+firstGroup+`":"Replicate","`+retryGroup+`":"Retry"}`,
	)
	fixture := newSeedreamBillingOrderFixture(t)
	previousRetries := common.RetryTimes
	common.RetryTimes = 1
	t.Cleanup(func() {
		common.RetryTimes = previousRetries
	})

	const initialQuota = 500_000
	const expectedQuota = 50_000
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var uploads atomic.Int32
	var firstPredictions atomic.Int32
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		switch {
		case request.URL.Path == "/v1/files":
			uploads.Add(1)
			hijacker, ok := w.(http.Hijacker)
			if !ok {
				http.Error(w, "hijacking unavailable", http.StatusInternalServerError)
				return
			}
			connection, _, err := hijacker.Hijack()
			if err != nil {
				return
			}
			_ = connection.Close()
		case strings.HasSuffix(request.URL.Path, "/predictions"):
			firstPredictions.Add(1)
			http.Error(w, "prediction must not run", http.StatusInternalServerError)
		default:
			http.NotFound(w, request)
		}
	}))
	t.Cleanup(firstUpstream.Close)

	var retryDispatches atomic.Int32
	retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		retryDispatches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/retry.png"}]}`)
	}))
	t.Cleanup(retryUpstream.Close)
	fixture.createRetryChannel(t, retryGroup, gptImageBillingOrderModel, retryUpstream.URL)

	body, contentType := imageBillingMultipartBody(t, gptImageBillingOrderModel, "1")
	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "replicate-edit-upload-unknown",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/edits",
		contentType: contentType,
		body:        body,
		baseURL:     firstUpstream.URL,
		usingGroup:  firstGroup,
		tokenGroup:  "auto",
		autoGroups:  []string{firstGroup, retryGroup},
		crossGroup:  true,
		channelType: constant.ChannelTypeReplicate,
	})

	assert.Equal(t, http.StatusBadGateway, recorder.Code, recorder.Body.String())
	assert.Equal(t, int32(1), uploads.Load())
	assert.Zero(t, firstPredictions.Load())
	assert.Zero(t, retryDispatches.Load(), "unknown upload write must not be replayed on another channel")
	require.Never(t, func() bool {
		var user model.User
		var token model.Token
		if fixture.db.First(&user, fixture.user.Id).Error != nil ||
			fixture.db.First(&token, fixture.token.Id).Error != nil {
			return false
		}
		return user.Quota == initialQuota || token.RemainQuota == initialQuota
	}, 300*time.Millisecond, 10*time.Millisecond)
	assert.Equal(t, int32(1), quotaMutations.Load(), "unknown upload write must retain the reservation")
	var user model.User
	var token model.Token
	require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
	require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
	assert.Equal(t, initialQuota-expectedQuota, user.Quota)
	assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
}

func TestRelayReplicateEditUploadRedirectDoesNotReplayOrRefund(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	previousFetchSetting := *fetchSetting
	fetchSetting.EnableSSRFProtection = false
	t.Cleanup(func() { *fetchSetting = previousFetchSetting })

	for _, statusCode := range []int{http.StatusTemporaryRedirect, http.StatusPermanentRedirect} {
		t.Run(fmt.Sprintf("status_%d", statusCode), func(t *testing.T) {
			firstGroup := fmt.Sprintf("replicate-upload-redirect-%d", statusCode)
			retryGroup := fmt.Sprintf("replicate-upload-redirect-retry-%d", statusCode)
			configureImageBillingGroups(
				t,
				`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
				`{"default":"Default","`+firstGroup+`":"Replicate","`+retryGroup+`":"Retry"}`,
			)
			fixture := newSeedreamBillingOrderFixture(t)
			previousRetries := common.RetryTimes
			common.RetryTimes = 1
			t.Cleanup(func() { common.RetryTimes = previousRetries })

			const initialQuota = 500_000
			const expectedQuota = 50_000
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)

			var redirectedUploads atomic.Int32
			redirectTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				redirectedUploads.Add(1)
				assert.Equal(t, http.MethodPost, request.Method)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/redirected.png"}}`)
			}))
			t.Cleanup(redirectTarget.Close)

			var uploads atomic.Int32
			var predictions atomic.Int32
			firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				switch {
				case request.URL.Path == "/v1/files":
					uploads.Add(1)
					w.Header().Set("Location", redirectTarget.URL+"/redirected")
					w.WriteHeader(statusCode)
				case strings.HasSuffix(request.URL.Path, "/predictions"):
					predictions.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
				default:
					http.NotFound(w, request)
				}
			}))
			t.Cleanup(firstUpstream.Close)

			var retryRequests atomic.Int32
			retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				retryRequests.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/retry.png"}]}`)
			}))
			t.Cleanup(retryUpstream.Close)
			fixture.createRetryChannel(t, retryGroup, gptImageBillingOrderModel, retryUpstream.URL)

			body, contentType := imageBillingMultipartBody(t, gptImageBillingOrderModel, "1")
			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   fmt.Sprintf("replicate-upload-redirect-%d", statusCode),
				model:       gptImageBillingOrderModel,
				path:        "/v1/images/edits",
				contentType: contentType,
				body:        body,
				baseURL:     firstUpstream.URL,
				usingGroup:  firstGroup,
				tokenGroup:  "auto",
				autoGroups:  []string{firstGroup, retryGroup},
				crossGroup:  true,
				channelType: constant.ChannelTypeReplicate,
			})

			assert.Equal(t, http.StatusBadGateway, recorder.Code, recorder.Body.String())
			assert.Equal(t, int32(1), uploads.Load())
			assert.Zero(t, redirectedUploads.Load(), "upload POST must not be replayed at the redirect target")
			assert.Zero(t, predictions.Load())
			assert.Zero(t, retryRequests.Load(), "redirected upload must not use another channel")
			require.Never(t, func() bool {
				var user model.User
				var token model.Token
				if fixture.db.First(&user, fixture.user.Id).Error != nil ||
					fixture.db.First(&token, fixture.token.Id).Error != nil {
					return false
				}
				return user.Quota == initialQuota || token.RemainQuota == initialQuota
			}, 300*time.Millisecond, 10*time.Millisecond)
			assert.Equal(t, int32(1), quotaMutations.Load(), "redirected upload must retain the reservation")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota-expectedQuota, user.Quota)
			assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
		})
	}
}

func TestRelayReplicateEditPredictionUnknownDoesNotUploadAgainOrRefund(t *testing.T) {
	const firstGroup = "replicate-prediction-unknown"
	const retryGroup = "replicate-prediction-retry"
	configureImageBillingGroups(
		t,
		`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
		`{"default":"Default","`+firstGroup+`":"Replicate","`+retryGroup+`":"Retry"}`,
	)
	fixture := newSeedreamBillingOrderFixture(t)
	previousRetries := common.RetryTimes
	common.RetryTimes = 1
	t.Cleanup(func() {
		common.RetryTimes = previousRetries
	})

	const initialQuota = 500_000
	const expectedQuota = 50_000
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var uploads atomic.Int32
	var predictions atomic.Int32
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		switch {
		case request.URL.Path == "/v1/files":
			uploads.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
		case strings.HasSuffix(request.URL.Path, "/predictions"):
			predictions.Add(1)
			hijacker, ok := w.(http.Hijacker)
			if !ok {
				http.Error(w, "hijacking unavailable", http.StatusInternalServerError)
				return
			}
			connection, _, err := hijacker.Hijack()
			if err != nil {
				return
			}
			_ = connection.Close()
		default:
			http.NotFound(w, request)
		}
	}))
	t.Cleanup(firstUpstream.Close)

	var retryRequests atomic.Int32
	retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		retryRequests.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/retry.png"}}`)
	}))
	t.Cleanup(retryUpstream.Close)
	priority := int64(0)
	weight := uint(100)
	autoBan := 0
	retryBaseURL := retryUpstream.URL
	channel := &model.Channel{
		Name: "image-retry-" + retryGroup, Key: "local-test-key", Type: constant.ChannelTypeReplicate,
		Status: common.ChannelStatusEnabled, Group: retryGroup, Models: gptImageBillingOrderModel, BaseURL: &retryBaseURL,
		Priority: &priority, Weight: &weight, AutoBan: &autoBan,
	}
	require.NoError(t, fixture.db.Create(channel).Error)
	require.NoError(t, fixture.db.Create(&model.Ability{
		Group: retryGroup, Model: gptImageBillingOrderModel, ChannelId: channel.Id, Enabled: true,
		Priority: &priority, Weight: weight,
	}).Error)

	body, contentType := imageBillingMultipartBody(t, gptImageBillingOrderModel, "1")
	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "replicate-edit-prediction-unknown",
		model:       gptImageBillingOrderModel,
		path:        "/v1/images/edits",
		contentType: contentType,
		body:        body,
		baseURL:     firstUpstream.URL,
		usingGroup:  firstGroup,
		tokenGroup:  "auto",
		autoGroups:  []string{firstGroup, retryGroup},
		crossGroup:  true,
		channelType: constant.ChannelTypeReplicate,
	})

	assert.Equal(t, http.StatusInternalServerError, recorder.Code, recorder.Body.String())
	assert.Equal(t, int32(1), uploads.Load())
	assert.Equal(t, int32(1), predictions.Load())
	assert.Zero(t, retryRequests.Load(), "prediction unknown after upload must not trigger another upload")
	require.Never(t, func() bool {
		var user model.User
		var token model.Token
		if fixture.db.First(&user, fixture.user.Id).Error != nil ||
			fixture.db.First(&token, fixture.token.Id).Error != nil {
			return false
		}
		return user.Quota == initialQuota || token.RemainQuota == initialQuota
	}, 300*time.Millisecond, 10*time.Millisecond)
	assert.Equal(t, int32(1), quotaMutations.Load(), "prediction unknown after upload must retain the reservation")
}

func TestRelayReplicateEditPredictionHTTPFailureDoesNotRetryOrRefund(t *testing.T) {
	previousErrorLogEnabled := constant.ErrorLogEnabled
	constant.ErrorLogEnabled = true
	t.Cleanup(func() {
		constant.ErrorLogEnabled = previousErrorLogEnabled
	})

	for _, statusCode := range []int{http.StatusBadGateway, http.StatusUnprocessableEntity} {
		t.Run(fmt.Sprintf("status_%d", statusCode), func(t *testing.T) {
			const firstGroup = "replicate-prediction-http-failure"
			const retryGroup = "replicate-prediction-http-retry"
			configureImageBillingGroups(
				t,
				`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
				`{"default":"Default","`+firstGroup+`":"Replicate","`+retryGroup+`":"Retry"}`,
			)
			fixture := newSeedreamBillingOrderFixture(t)
			previousRetries := common.RetryTimes
			common.RetryTimes = 1
			t.Cleanup(func() {
				common.RetryTimes = previousRetries
			})

			const initialQuota = 500_000
			const expectedQuota = 50_000
			requestID := fmt.Sprintf("replicate-edit-prediction-http-%d", statusCode)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)
			var uploads atomic.Int32
			var predictions atomic.Int32
			firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				switch {
				case request.URL.Path == "/v1/files":
					uploads.Add(1)
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/input.png"}}`)
				case strings.HasSuffix(request.URL.Path, "/predictions"):
					predictions.Add(1)
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(statusCode)
					_, _ = io.WriteString(w, `{"error":{"message":"prediction rejected","type":"upstream_error","code":"prediction_failed"}}`)
				default:
					http.NotFound(w, request)
				}
			}))
			t.Cleanup(firstUpstream.Close)

			var retryRequests atomic.Int32
			retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				retryRequests.Add(1)
				switch {
				case request.URL.Path == "/v1/files":
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"urls":{"get":"https://files.invalid/retry.png"}}`)
				case strings.HasSuffix(request.URL.Path, "/predictions"):
					w.Header().Set("Content-Type", "application/json")
					_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/retry.png"]}`)
				default:
					http.NotFound(w, request)
				}
			}))
			t.Cleanup(retryUpstream.Close)
			priority := int64(0)
			weight := uint(100)
			autoBan := 0
			retryBaseURL := retryUpstream.URL
			channel := &model.Channel{
				Name: "image-retry-" + retryGroup, Key: "local-test-key", Type: constant.ChannelTypeReplicate,
				Status: common.ChannelStatusEnabled, Group: retryGroup, Models: gptImageBillingOrderModel, BaseURL: &retryBaseURL,
				Priority: &priority, Weight: &weight, AutoBan: &autoBan,
			}
			require.NoError(t, fixture.db.Create(channel).Error)
			require.NoError(t, fixture.db.Create(&model.Ability{
				Group: retryGroup, Model: gptImageBillingOrderModel, ChannelId: channel.Id, Enabled: true,
				Priority: &priority, Weight: weight,
			}).Error)

			body, contentType := imageBillingMultipartBody(t, gptImageBillingOrderModel, "1")
			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   requestID,
				model:       gptImageBillingOrderModel,
				path:        "/v1/images/edits",
				contentType: contentType,
				body:        body,
				baseURL:     firstUpstream.URL,
				usingGroup:  firstGroup,
				tokenGroup:  "auto",
				autoGroups:  []string{firstGroup, retryGroup},
				crossGroup:  true,
				channelType: constant.ChannelTypeReplicate,
			})

			assert.Equal(t, statusCode, recorder.Code, recorder.Body.String())
			assert.Equal(t, int32(1), uploads.Load())
			assert.Equal(t, int32(1), predictions.Load())
			assert.Zero(t, retryRequests.Load(), "prediction HTTP failure after upload must not use another channel")
			require.Never(t, func() bool {
				var user model.User
				var token model.Token
				if fixture.db.First(&user, fixture.user.Id).Error != nil ||
					fixture.db.First(&token, fixture.token.Id).Error != nil {
					return false
				}
				return user.Quota == initialQuota || token.RemainQuota == initialQuota
			}, 300*time.Millisecond, 10*time.Millisecond)
			assert.Equal(t, int32(1), quotaMutations.Load(), "prediction HTTP failure after upload must retain the reservation")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota-expectedQuota, user.Quota)
			assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)

			var consumeLogs int64
			require.NoError(t, model.LOG_DB.Model(&model.Log{}).
				Where("request_id = ? AND type = ?", requestID, model.LogTypeConsume).
				Count(&consumeLogs).Error)
			assert.Zero(t, consumeLogs, "failed prediction must not emit a success consume log")
			var errorLogs int64
			require.NoError(t, model.LOG_DB.Model(&model.Log{}).
				Where("request_id = ? AND type = ?", requestID, model.LogTypeError).
				Count(&errorLogs).Error)
			assert.Equal(t, int64(1), errorLogs, "failed prediction must retain an error audit log")
		})
	}
}

func TestRelayReplicateRetryPromptEstimateDoesNotPolluteNextAttempt(t *testing.T) {
	const firstGroup = "replicate-prompt"
	const retryGroup = "openai-prompt"
	const positivePrompt = "short positive prompt"
	negativePrompt := strings.Repeat("long negative billing context ", 20)
	configureImageBillingGroups(
		t,
		`{"default":1,"`+firstGroup+`":1,"`+retryGroup+`":1}`,
		`{"default":"Default","`+firstGroup+`":"Replicate","`+retryGroup+`":"OpenAI"}`,
	)
	fixture := newSeedreamBillingOrderFixture(t)
	previousRetries := common.RetryTimes
	previousCountTokens := constant.CountToken
	common.RetryTimes = 1
	constant.CountToken = true
	t.Cleanup(func() {
		common.RetryTimes = previousRetries
		constant.CountToken = previousCountTokens
	})

	service.InitTokenEncoders()
	firstTokens := service.CountTokenInput(positivePrompt+"\n"+negativePrompt, tokenImageBillingOrderModel)
	retryTokens := service.CountTokenInput(positivePrompt, tokenImageBillingOrderModel)
	require.Greater(t, firstTokens, retryTokens)
	firstQuota := billingexpr.QuotaRound(float64(firstTokens) * 100_000 / 1_000_000 * common.QuotaPerUnit)
	retryQuota := billingexpr.QuotaRound(float64(retryTokens) * 100_000 / 1_000_000 * common.QuotaPerUnit)
	initialQuota := firstQuota + 500_000
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		prompt         string
		negativePrompt string
		userQuota      int
		tokenQuota     int
		err            error
	}
	firstDispatch := make(chan dispatchSnapshot, 1)
	firstUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		firstDispatch <- dispatchSnapshot{
			prompt:         gjson.GetBytes(body, "input.prompt").String(),
			negativePrompt: gjson.GetBytes(body, "input.negative_prompt").String(),
			userQuota:      user.Quota,
			tokenQuota:     token.RemainQuota,
			err:            firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = io.WriteString(w, `{"error":{"message":"retry fixture","type":"server_error"}}`)
	}))
	t.Cleanup(firstUpstream.Close)

	retryDispatch := make(chan dispatchSnapshot, 1)
	retryUpstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		retryDispatch <- dispatchSnapshot{
			prompt:     gjson.GetBytes(body, "prompt").String(),
			userQuota:  user.Quota,
			tokenQuota: token.RemainQuota,
			err:        firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
	}))
	t.Cleanup(retryUpstream.Close)
	fixture.createRetryChannel(t, retryGroup, tokenImageBillingOrderModel, retryUpstream.URL)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "replicate-negative-prompt-retry",
		model:       tokenImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body: []byte(`{"model":"` + tokenImageBillingOrderModel + `","prompt":"` + positivePrompt +
			`","n":1,"input":{"negative_prompt":"` + negativePrompt + `"}}`),
		baseURL:     firstUpstream.URL,
		usingGroup:  firstGroup,
		tokenGroup:  "auto",
		autoGroups:  []string{firstGroup, retryGroup},
		crossGroup:  true,
		channelType: constant.ChannelTypeReplicate,
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, firstDispatch, 1)
	require.Len(t, retryDispatch, 1)
	first := <-firstDispatch
	retry := <-retryDispatch
	require.NoError(t, first.err)
	require.NoError(t, retry.err)
	assert.Equal(t, positivePrompt, first.prompt)
	assert.Equal(t, negativePrompt, first.negativePrompt)
	assert.Equal(t, initialQuota-firstQuota, first.userQuota)
	assert.Equal(t, initialQuota-firstQuota, first.tokenQuota)
	assert.Equal(t, positivePrompt, retry.prompt)
	assert.Equal(t, initialQuota-firstQuota, retry.userQuota, "cheaper retry is refunded only at settlement")
	assert.Equal(t, initialQuota-firstQuota, retry.tokenQuota, "cheaper retry is refunded only at settlement")

	var user model.User
	var token model.Token
	require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
	require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
	assert.Equal(t, initialQuota-retryQuota, user.Quota)
	assert.Equal(t, retryQuota, user.UsedQuota)
	assert.Equal(t, initialQuota-retryQuota, token.RemainQuota)
	assert.Equal(t, retryQuota, token.UsedQuota)
	assert.Equal(t, int32(2), quotaMutations.Load(), "one reserve and one final refund must occur")

	var logs []model.Log
	require.NoError(t, model.LOG_DB.
		Where("request_id = ? AND type = ?", "replicate-negative-prompt-retry", model.LogTypeConsume).
		Find(&logs).Error)
	require.Len(t, logs, 1, "one logical request must settle exactly once")
	assert.Equal(t, retryTokens, logs[0].PromptTokens)
	assert.Equal(t, retryQuota, logs[0].Quota)
}

func TestRelayGeminiNativeBillingViewRejectsBeforeDispatch(t *testing.T) {
	previousCheckSensitive := setting.CheckSensitiveEnabled
	previousCheckPrompt := setting.CheckSensitiveOnPromptEnabled
	previousSensitiveWords := append([]string(nil), setting.SensitiveWords...)
	setting.CheckSensitiveEnabled = true
	setting.CheckSensitiveOnPromptEnabled = true
	setting.SensitiveWords = []string{"test_sensitive"}
	t.Cleanup(func() {
		setting.CheckSensitiveEnabled = previousCheckSensitive
		setting.CheckSensitiveOnPromptEnabled = previousCheckPrompt
		setting.SensitiveWords = previousSensitiveWords
	})

	tests := []struct {
		name       string
		prompt     string
		quota      int
		wantStatus int
		wantCode   string
	}{
		{
			name:   "nested sensitive prompt",
			prompt: "test_sensitive nested gemini prompt",
			quota:  500_000, wantStatus: http.StatusBadRequest,
			wantCode: string(types.ErrorCodeSensitiveWordsDetected),
		},
		{
			name:   "nested count exceeds balance",
			prompt: "ordinary nested gemini prompt",
			quota:  75_000, wantStatus: http.StatusForbidden,
			wantCode: string(types.ErrorCodeInsufficientUserQuota),
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			fixture.user.Quota = testCase.quota
			fixture.token.RemainQuota = testCase.quota
			fixture.resetQuota(t, testCase.quota)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)
			var dispatches atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				dispatches.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"predictions":[{"bytesBase64Encoded":"eA=="}]}`)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   "gemini-native-reject-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:       geminiImageBillingOrderModel,
				path:        "/v1/images/generations",
				contentType: "application/json",
				body: []byte(`{"model":"` + geminiImageBillingOrderModel +
					`","prompt":"` + testCase.prompt + `","n":2,"size":"1536x1024","quality":"high"}`),
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				channelType: constant.ChannelTypeGemini,
			})

			assert.Equal(t, testCase.wantStatus, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), testCase.wantCode)
			assert.Zero(t, dispatches.Load(), "rejected native request must not reach the provider")
			assert.Zero(t, quotaMutations.Load(), "rejected native request must not mutate quota")
		})
	}
}

func TestRelayGeminiRejectsFinalInstanceCardinalityBeforeBillingAndDispatch(t *testing.T) {
	tests := []struct {
		name      string
		instances []any
	}{
		{name: "zero instances", instances: []any{}},
		{name: "multiple instances", instances: []any{
			map[string]any{"prompt": "first"},
			map[string]any{"prompt": "second"},
		}},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)
			var dispatches atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				dispatches.Add(1)
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"predictions":[{"bytesBase64Encoded":"eA=="}]}`)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   "gemini-instance-cardinality-" + strings.ReplaceAll(testCase.name, " ", "-"),
				model:       geminiImageBillingOrderModel,
				path:        "/v1/images/generations",
				contentType: "application/json",
				body: []byte(`{"model":"` + geminiImageBillingOrderModel +
					`","prompt":"ordinary nested gemini prompt","n":1}`),
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				channelType: constant.ChannelTypeGemini,
				paramOverride: map[string]any{"operations": []any{
					map[string]any{"path": "instances", "mode": "set", "value": testCase.instances},
				}},
			})

			assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
			assert.Contains(t, recorder.Body.String(), "exactly one")
			assert.Zero(t, dispatches.Load(), "invalid final instances must not reach the provider")
			assert.Zero(t, quotaMutations.Load(), "invalid final instances must not reserve or refund quota")

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, 500_000, user.Quota)
			assert.Equal(t, 500_000, token.RemainQuota)
		})
	}
}

func TestRelayGeminiNativeCountReservesAndSettlesBeforeDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	const expectedQuota = 100_000
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		body       []byte
		userQuota  int
		tokenQuota int
		err        error
	}
	dispatched := make(chan dispatchSnapshot, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		dispatched <- dispatchSnapshot{
			body: body, userQuota: user.Quota, tokenQuota: token.RemainQuota,
			err: firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"predictions":[{"bytesBase64Encoded":"eA=="},{"bytesBase64Encoded":"eQ=="}]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "gemini-native-count",
		model:       geminiImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body: []byte(`{"model":"` + geminiImageBillingOrderModel +
			`","prompt":"ordinary nested gemini prompt","n":2,"size":"1536x1024","quality":"high"}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		channelType: constant.ChannelTypeGemini,
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, dispatched, 1)
	snapshot := <-dispatched
	require.NoError(t, snapshot.err)
	assert.Equal(t, "ordinary nested gemini prompt", gjson.GetBytes(snapshot.body, "instances.0.prompt").String())
	assert.Equal(t, int64(2), gjson.GetBytes(snapshot.body, "parameters.sampleCount").Int())
	assert.Equal(t, "3:2", gjson.GetBytes(snapshot.body, "parameters.aspectRatio").String())
	assert.Equal(t, "2K", gjson.GetBytes(snapshot.body, "parameters.imageSize").String())
	assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

	var user model.User
	var token model.Token
	require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
	require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
	assert.Equal(t, initialQuota-expectedQuota, user.Quota)
	assert.Equal(t, expectedQuota, user.UsedQuota)
	assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
	assert.Equal(t, expectedQuota, token.UsedQuota)
	assert.Equal(t, int32(1), quotaMutations.Load(), "native count must be reserved once before dispatch")
}

func TestRelaySiliconFlowNativeBillingParametersReserveAndSettle(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	const expectedQuota = 100_000
	fixture.user.Quota = initialQuota
	fixture.token.RemainQuota = initialQuota
	fixture.resetQuota(t, initialQuota)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)

	type dispatchSnapshot struct {
		body       []byte
		userQuota  int
		tokenQuota int
		err        error
	}
	dispatched := make(chan dispatchSnapshot, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		body, bodyErr := io.ReadAll(request.Body)
		var user model.User
		var token model.Token
		userErr := fixture.db.First(&user, fixture.user.Id).Error
		tokenErr := fixture.db.First(&token, fixture.token.Id).Error
		dispatched <- dispatchSnapshot{
			body: body, userQuota: user.Quota, tokenQuota: token.RemainQuota,
			err: firstError(bodyErr, userErr, tokenErr),
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/one.png"},{"url":"https://output.invalid/two.png"}]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "silicon-native-parameters",
		model:       siliconImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body: []byte(`{"model":"` + siliconImageBillingOrderModel +
			`","prompt":"silicon billing prompt","negative_prompt":"negative billing prompt","batch_size":2,"image_size":"1024x768","seed":42}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		channelType: constant.ChannelTypeSiliconFlow,
	})

	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	require.Len(t, dispatched, 1)
	snapshot := <-dispatched
	require.NoError(t, snapshot.err)
	assert.Equal(t, int64(2), gjson.GetBytes(snapshot.body, "batch_size").Int())
	assert.Equal(t, "1024x768", gjson.GetBytes(snapshot.body, "image_size").String())
	assert.Equal(t, int64(42), gjson.GetBytes(snapshot.body, "seed").Int())
	assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
	assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

	var user model.User
	var token model.Token
	require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
	require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
	assert.Equal(t, initialQuota-expectedQuota, user.Quota)
	assert.Equal(t, expectedQuota, user.UsedQuota)
	assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
	assert.Equal(t, expectedQuota, token.UsedQuota)
	assert.Equal(t, int32(1), quotaMutations.Load(), "native parameters must drive one reservation")
}

func TestRelayConfirmedNativeMissingCountDefaultsToOne(t *testing.T) {
	tests := []struct {
		name         string
		model        string
		body         string
		channelType  int
		countPath    string
		responseBody string
	}{
		{
			name: "Replicate", model: gptImageBillingOrderModel,
			body:         `{"model":"` + gptImageBillingOrderModel + `","prompt":"replicate default count"}`,
			channelType:  constant.ChannelTypeReplicate,
			countPath:    "input.num_outputs",
			responseBody: `{"status":"succeeded","output":["https://output.invalid/image.png"]}`,
		},
		{
			name: "SiliconFlow", model: siliconImageBillingOrderModel,
			body: `{"model":"` + siliconImageBillingOrderModel +
				`","prompt":"silicon default count","image_size":"1024x768"}`,
			channelType:  constant.ChannelTypeSiliconFlow,
			countPath:    "batch_size",
			responseBody: `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newSeedreamBillingOrderFixture(t)
			const initialQuota = 500_000
			const expectedQuota = 50_000
			quotaMutations := recordUserQuotaMutations(t, fixture.db)
			quotaMutations.Store(0)

			type dispatchSnapshot struct {
				body       []byte
				userQuota  int
				tokenQuota int
				err        error
			}
			dispatched := make(chan dispatchSnapshot, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
				body, bodyErr := io.ReadAll(request.Body)
				var user model.User
				var token model.Token
				userErr := fixture.db.First(&user, fixture.user.Id).Error
				tokenErr := fixture.db.First(&token, fixture.token.Id).Error
				dispatched <- dispatchSnapshot{
					body: body, userQuota: user.Quota, tokenQuota: token.RemainQuota,
					err: firstError(bodyErr, userErr, tokenErr),
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, testCase.responseBody)
			}))
			t.Cleanup(upstream.Close)

			recorder := fixture.relayWithOptions(t, imageRelayOptions{
				requestID:   "native-default-one-" + strings.ToLower(testCase.name),
				model:       testCase.model,
				path:        "/v1/images/generations",
				contentType: "application/json",
				body:        []byte(testCase.body),
				baseURL:     upstream.URL,
				usingGroup:  "default",
				tokenGroup:  "default",
				channelType: testCase.channelType,
			})

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			require.Len(t, dispatched, 1)
			snapshot := <-dispatched
			require.NoError(t, snapshot.err)
			assert.Equal(t, int64(1), gjson.GetBytes(snapshot.body, testCase.countPath).Int())
			assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
			assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

			var user model.User
			var token model.Token
			require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
			require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
			assert.Equal(t, initialQuota-expectedQuota, user.Quota)
			assert.Equal(t, expectedQuota, user.UsedQuota)
			assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
			assert.Equal(t, expectedQuota, token.UsedQuota)
			assert.Equal(t, int32(1), quotaMutations.Load(), "default count must reserve and settle once")
		})
	}
}

func TestRelayUnknownNativeImageShapeFailsClosedBeforeBillingAndDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	const initialQuota = 500_000
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	quotaMutations.Store(0)
	var dispatches atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dispatches.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"succeeded","output":["https://output.invalid/image.png"]}`)
	}))
	t.Cleanup(upstream.Close)

	recorder := fixture.relayWithOptions(t, imageRelayOptions{
		requestID:   "unknown-native-shape",
		model:       unknownImageBillingOrderModel,
		path:        "/v1/images/generations",
		contentType: "application/json",
		body: []byte(`{"model":"` + unknownImageBillingOrderModel +
			`","prompt":"openai shape sent to dynamic native API","n":1}`),
		baseURL:     upstream.URL,
		usingGroup:  "default",
		tokenGroup:  "default",
		passThrough: true,
		channelType: constant.ChannelTypeReplicate,
	})

	assert.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), "invalid_request")
	assert.Zero(t, dispatches.Load(), "ambiguous native shape must not reach the provider")
	assert.Zero(t, quotaMutations.Load(), "ambiguous native shape must not reserve or refund quota")
}

func TestRelaySeedreamValidRequestBillsOnceAroundProviderDispatch(t *testing.T) {
	fixture := newSeedreamBillingOrderFixture(t)
	quotaMutations := recordUserQuotaMutations(t, fixture.db)
	const initialQuota = 500_000
	expectedQuota := billingexpr.QuotaRound(2 * 0.04109589041 * common.QuotaPerUnit)
	override := map[string]any{"operations": []any{
		map[string]any{"path": "n", "mode": "set", "value": 2},
	}}

	t.Run("settles once after successful dispatch", func(t *testing.T) {
		fixture.user.Quota = initialQuota
		fixture.token.RemainQuota = initialQuota
		fixture.resetQuota(t, initialQuota)
		quotaMutations.Store(0)
		type dispatchSnapshot struct {
			userQuota  int
			tokenQuota int
			body       []byte
			err        error
		}
		dispatched := make(chan dispatchSnapshot, 1)
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			body, bodyErr := io.ReadAll(request.Body)
			dispatched <- dispatchSnapshot{
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				body:       body,
				err:        firstError(userErr, tokenErr, bodyErr),
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"created":1,"data":[{"url":"https://output.invalid/image.png"}]}`)
		}))
		t.Cleanup(upstream.Close)

		recorder := fixture.relay(
			t,
			"seedream-valid-settle",
			`{"model":"`+seedreamBillingOrderModel+`","prompt":"test","size":"1K","n":1}`,
			upstream.URL,
			false,
			override,
		)

		require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		require.Len(t, dispatched, 1)
		snapshot := <-dispatched
		require.NoError(t, snapshot.err)
		assert.Equal(t, int64(2), gjson.GetBytes(snapshot.body, "n").Int())
		assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
		assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)

		var user model.User
		var token model.Token
		require.NoError(t, fixture.db.First(&user, fixture.user.Id).Error)
		require.NoError(t, fixture.db.First(&token, fixture.token.Id).Error)
		assert.Equal(t, initialQuota-expectedQuota, user.Quota)
		assert.Equal(t, expectedQuota, user.UsedQuota)
		assert.Equal(t, 1, user.RequestCount)
		assert.Equal(t, initialQuota-expectedQuota, token.RemainQuota)
		assert.Equal(t, expectedQuota, token.UsedQuota)
		assert.Equal(t, int32(1), quotaMutations.Load(), "one wallet reservation must cover the request")

		var consumeLogs int64
		require.NoError(t, model.LOG_DB.Model(&model.Log{}).
			Where("request_id = ? AND type = ?", "seedream-valid-settle", model.LogTypeConsume).
			Count(&consumeLogs).Error)
		assert.Equal(t, int64(1), consumeLogs, "successful request must settle and log exactly once")
	})

	t.Run("refunds once after failed dispatch", func(t *testing.T) {
		fixture.user.Quota = initialQuota
		fixture.token.RemainQuota = initialQuota
		fixture.resetQuota(t, initialQuota)
		quotaMutations.Store(0)
		type dispatchSnapshot struct {
			userQuota  int
			tokenQuota int
			err        error
		}
		dispatched := make(chan dispatchSnapshot, 1)
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			var user model.User
			var token model.Token
			userErr := fixture.db.First(&user, fixture.user.Id).Error
			tokenErr := fixture.db.First(&token, fixture.token.Id).Error
			dispatched <- dispatchSnapshot{
				userQuota:  user.Quota,
				tokenQuota: token.RemainQuota,
				err:        firstError(userErr, tokenErr),
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			_, _ = io.WriteString(w, `{"error":{"message":"fixture failure","type":"upstream_error"}}`)
		}))
		t.Cleanup(upstream.Close)

		recorder := fixture.relay(
			t,
			"seedream-valid-refund",
			`{"model":"`+seedreamBillingOrderModel+`","prompt":"test","size":"1K","n":1}`,
			upstream.URL,
			false,
			override,
		)

		require.Equal(t, http.StatusBadGateway, recorder.Code, recorder.Body.String())
		require.Len(t, dispatched, 1)
		snapshot := <-dispatched
		require.NoError(t, snapshot.err)
		assert.Equal(t, initialQuota-expectedQuota, snapshot.userQuota)
		assert.Equal(t, initialQuota-expectedQuota, snapshot.tokenQuota)
		require.Eventually(t, func() bool {
			var user model.User
			var token model.Token
			if fixture.db.First(&user, fixture.user.Id).Error != nil ||
				fixture.db.First(&token, fixture.token.Id).Error != nil {
				return false
			}
			return user.Quota == initialQuota && token.RemainQuota == initialQuota
		}, 3*time.Second, 10*time.Millisecond)
		assert.Equal(t, int32(2), quotaMutations.Load(), "one reservation and one refund must restore the wallet")

		var consumeLogs int64
		require.NoError(t, model.LOG_DB.Model(&model.Log{}).
			Where("request_id = ? AND type = ?", "seedream-valid-refund", model.LogTypeConsume).
			Count(&consumeLogs).Error)
		assert.Zero(t, consumeLogs)
	})
}

func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
