package router

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type requestEstimateTransport func(*http.Request) (*http.Response, error)

func (transport requestEstimateTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

// This is the public acceptance seam shared by the estimate tickets. The
// optional DSN points only at a disposable integration-test database.
func setupRequestEstimateDB(t *testing.T) {
	t.Helper()
	i18n.Init()
	setupRelayRouterTestDB(t)
	if dsn := os.Getenv("REQUEST_ESTIMATE_TEST_DSN"); dsn != "" {
		// Refuse an accidental production DSN before any destructive fixture setup.
		if strings.HasPrefix(dsn, "postgres://") {
			target, err := url.Parse(dsn)
			require.NoError(t, err)
			require.Equal(t, "127.0.0.1", target.Hostname())
			require.Equal(t, "/estimate01", target.Path)
		} else {
			target, err := mysql.ParseDSN(dsn)
			require.NoError(t, err)
			require.Equal(t, "estimate01", target.DBName)
			require.True(t, strings.HasPrefix(target.Addr, "127.0.0.1:"))
		}
		db, err := model.DB.DB()
		require.NoError(t, err)
		require.NoError(t, db.Close())
		t.Setenv("SQL_DSN", dsn)
		require.NoError(t, model.InitDB())
		model.LOG_DB = model.DB
		// Each run owns the entire disposable database; start from empty fixtures.
		for _, table := range []any{&model.Ability{}, &model.Token{}, &model.User{}, &model.Channel{}, &model.Log{}, &model.Task{}, &model.Midjourney{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}} {
			require.NoError(t, model.DB.Migrator().DropTable(table))
		}
	}
	require.NoError(t, model.DB.AutoMigrate(&model.User{}, &model.Token{}, &model.Ability{}, &model.Channel{}, &model.Log{}, &model.Task{}, &model.Midjourney{}, &model.UserSubscription{}, &model.SubscriptionPreConsumeRecord{}))
	var version string
	query := "SELECT version()"
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		query = "SELECT sqlite_version()"
	}
	require.NoError(t, model.DB.Raw(query).Scan(&version).Error)
	t.Logf("estimate database: %s %s", common.MainDatabaseType(), version)
}

func requestEstimateBusinessSnapshot(t *testing.T) map[string]string {
	t.Helper()
	state := map[string]string{}
	for _, table := range []string{"users", "tokens", "channels", "abilities", "logs", "tasks", "midjourneys", "user_subscriptions", "subscription_pre_consume_records"} {
		var rows []map[string]any
		require.NoError(t, model.DB.Table(table).Find(&rows).Error)
		data, err := common.Marshal(rows)
		require.NoError(t, err)
		state[table] = string(data)
	}
	return state
}

func TestRequestEstimateLegacyMidjourney(t *testing.T) {
	setupRequestEstimateDB(t)
	savedPrice := ratio_setting.ModelPrice2JSONString()
	savedGroup := ratio_setting.GroupRatio2JSONString()
	savedGroupGroup := ratio_setting.GroupGroupRatio2JSONString()
	savedMemory := common.MemoryCacheEnabled
	savedQuotaUnit, savedStatusCheck := common.QuotaPerUnit, setting.MjActionCheckSuccessEnabled
	common.MemoryCacheEnabled = false
	common.QuotaPerUnit, setting.MjActionCheckSuccessEnabled = 500000, true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = savedMemory
		common.QuotaPerUnit, setting.MjActionCheckSuccessEnabled = savedQuotaUnit, savedStatusCheck
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrice))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(savedGroup))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(savedGroupGroup))
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"mj_imagine":0.01,"swap_face":0.02,"mj_upscale":0.04,"mj_variation":0.08,"mj_inpaint":0.1,"mj_custom_zoom":0.1,"mj_modal":0.12,"mj_describe":0.04,"mj_blend":0.04,"mj_edits":0.04,"mj_shorten":0.04,"mj_video":0.04,"mj_reroll":0.04,"mj_zoom":0.04,"mj_pan":0.04,"mj_low_variation":0.04,"mj_high_variation":0.04}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1.5}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{}`))
	var calls atomic.Int32
	var submitResult atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if code := submitResult.Load(); code != 0 {
			if r.URL.Path == "/mj/submit/simple-change" {
				assert.True(t, strings.HasPrefix(r.Header.Get("mj-api-secret"), "mj-origin-secret-"))
			}
			w.Header().Set("Content-Type", "application/json")
			_, err := fmt.Fprintf(w, `{"code":%d,"result":"submitted-%d"}`, code, calls.Load())
			assert.NoError(t, err)
			return
		}
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(upstream.Close)
	user := model.User{Username: "legacy-estimate", Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "legacyestimatekey", Status: common.TokenStatusExhausted, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(&token).Error)
	channel := model.Channel{Type: constant.ChannelTypeMidjourney, Status: common.ChannelStatusEnabled, Key: "mj-secret-one\nmj-secret-two", BaseURL: &upstream.URL, Group: "default", Models: "mj_imagine,swap_face,mj_upscale,mj_variation,mj_inpaint,mj_custom_zoom,mj_modal,mj_describe,mj_blend,mj_edits,mj_shorten,mj_video,mj_reroll,mj_zoom,mj_pan,mj_low_variation,mj_high_variation", Priority: new(int64(10)), ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}}
	require.NoError(t, model.DB.Create(&channel).Error)
	originChannel := channel
	originChannel.Id, originChannel.Priority = 0, new(int64(1))
	originChannel.Type = constant.ChannelTypeMidjourneyPlus
	originChannel.Key = "mj-origin-secret-one\nmj-origin-secret-two"
	require.NoError(t, model.DB.Create(&originChannel).Error)
	for name := range strings.SplitSeq(channel.Models, ",") {
		require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: name, ChannelId: channel.Id, Enabled: true, Priority: channel.Priority}).Error)
		require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: name, ChannelId: originChannel.Id, Enabled: true, Priority: originChannel.Priority}).Error)
	}
	require.NoError(t, model.DB.Create(&model.Midjourney{UserId: user.Id, MjId: "owned", Status: "SUCCESS", ChannelId: originChannel.Id, Prompt: "original prompt"}).Error)
	require.NoError(t, model.DB.Create(&model.Midjourney{UserId: user.Id + 1, MjId: "foreign", Status: "SUCCESS", ChannelId: originChannel.Id}).Error)
	require.NoError(t, model.DB.Create(&model.Midjourney{UserId: user.Id, MjId: "pending", Status: "IN_PROGRESS", ChannelId: originChannel.Id}).Error)
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetRelayRouter(engine)
	quote := func(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
		t.Helper()
		before := requestEstimateBusinessSnapshot(t)
		data, err := common.Marshal(map[string]any{"method": method, "path": path, "body": common.RawMessage(body), "headers": http.Header{"Mj-Api-Secret": {"forged-secret"}, "Authorization": {"Bearer forged"}}})
		require.NoError(t, err)
		r := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(data))
		r.Header.Set("Authorization", "Bearer "+token.Key)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, r)
		assert.Equal(t, before, requestEstimateBusinessSnapshot(t))
		assert.Zero(t, calls.Load())
		for _, secret := range []string{"mj-secret", "mj-origin-secret", "forged-secret", upstream.URL} {
			assert.NotContains(t, w.Body.String(), secret)
		}
		return w
	}
	for _, tc := range []struct {
		name, path, body, amount, model string
		quota                           int
		origin                          bool
	}{
		{"imagine with zero balance", "/mj/submit/imagine", `{"prompt":"a cat"}`, "0.015", "mj_imagine", 7500, false},
		{"swap does not read URL media", "/mj/insight-face/swap", fmt.Sprintf(`{"sourceBase64":%q,"targetBase64":%q}`, upstream.URL+"/source", upstream.URL+"/target"), "0.03", "swap_face", 15000, false},
		{"simple change binds origin", "/fast/mj/submit/simple-change", `{"content":"owned u2"}`, "0.06", "mj_upscale", 30000, true},
		{"ordinary variation", "/mj/submit/change", `{"taskId":"owned","action":"VARIATION","index":3}`, "0.12", "mj_variation", 60000, true},
		{"plus action", "/mj/submit/action", `{"taskId":"owned","customId":"MJ::JOB::upsample::2::job"}`, "0.06", "mj_upscale", 30000, true},
		{"free inpaint", "/mj/submit/action", `{"taskId":"owned","customId":"MJ::Inpaint::job"}`, "0", "mj_inpaint", 0, true},
		{"free custom zoom", "/mj/submit/action", `{"taskId":"owned","customId":"MJ::CustomZoom::job"}`, "0", "mj_custom_zoom", 0, true},
		{"modal permits pending origin", "/mj/submit/modal", `{"taskId":"pending"}`, "0.18", "mj_modal", 90000, true},
		{"video with origin", "/mj/submit/video", `{"taskId":"owned"}`, "0.06", "mj_video", 30000, true},
		{"video without origin", "/mj/submit/video", `{"prompt":"video"}`, "0.06", "mj_video", 30000, false},
		{"describe URL needs no download", "/mj/submit/describe", fmt.Sprintf(`{"base64Array":[%q]}`, upstream.URL+"/image"), "0.06", "mj_describe", 30000, false},
		{"blend", "/mj/submit/blend", `{"base64Array":["a","b"]}`, "0.06", "mj_blend", 30000, false},
		{"edits", "/mj/submit/edits", `{"prompt":"edit"}`, "0.06", "mj_edits", 30000, false},
		{"shorten", "/mj/submit/shorten", `{"prompt":"long prompt"}`, "0.06", "mj_shorten", 30000, false},
		{"reroll", "/mj/submit/simple-change", `{"content":"owned r"}`, "0.06", "mj_reroll", 30000, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := quote(t, "POST", tc.path, tc.body)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			var result struct {
				Quota         int
				Amount, Model string
				Channel       struct{ Id, Type int }
			}
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
			assert.Equal(t, tc.quota, result.Quota)
			assert.Equal(t, tc.amount, result.Amount)
			assert.Equal(t, tc.model, result.Model)
			expectedChannel := channel
			if tc.origin {
				expectedChannel = originChannel
			}
			assert.Equal(t, expectedChannel.Id, result.Channel.Id)
			assert.Equal(t, expectedChannel.Type, result.Channel.Type)
		})
	}
	for _, tc := range []struct {
		name, method, path, body string
		status                   int
	}{
		{"missing prompt", "POST", "/mj/submit/imagine", `{}`, 400},
		{"missing swap source", "POST", "/mj/insight-face/swap", `{"targetBase64":"x"}`, 400},
		{"missing origin", "POST", "/mj/submit/change", `{"action":"UPSCALE","index":1}`, 400},
		{"unknown origin", "POST", "/mj/submit/modal", `{"taskId":"absent"}`, 400},
		{"foreign origin", "POST", "/mj/submit/modal", `{"taskId":"foreign","user_id":1,"metadata":{"taskId":"owned"}}`, 400},
		{"pending origin", "POST", "/mj/submit/change", `{"taskId":"pending","action":"UPSCALE","index":1}`, 400},
		{"missing index", "POST", "/mj/submit/change", `{"taskId":"owned","action":"UPSCALE"}`, 400},
		{"negative index", "POST", "/mj/submit/change", `{"taskId":"owned","action":"UPSCALE","index":-1}`, 400},
		{"malformed plus action", "POST", "/mj/submit/action", `{"taskId":"owned","customId":"MJ"}`, 400},
		{"missing plus index", "POST", "/mj/submit/action", `{"taskId":"owned","customId":"MJ::JOB::upsample"}`, 400},
		{"unknown variation cannot retain injected action", "POST", "/mj/submit/action", `{"taskId":"owned","customId":"MJ::JOB::unknown_variation::1","action":"INPAINT"}`, 400},
		{"malformed simple action", "POST", "/mj/submit/simple-change", `{"content":"owned u"}`, 400},
		{"empty simple action", "POST", "/mj/submit/simple-change", `{"content":"owned "}`, 400},
		{"upload", "POST", "/mj/submit/upload-discord-images", `{}`, 422},
		{"fetch", "GET", "/mj/task/owned/fetch", `{}`, 422},
		{"image seed", "GET", "/mj/task/owned/image-seed", `{}`, 422},
		{"image download", "GET", "/mj/image/owned", `{}`, 422},
		{"list", "POST", "/mj/task/list-by-condition", `{}`, 422},
		{"callback", "POST", "/mj/notify", `{}`, 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := quote(t, tc.method, tc.path, tc.body)
			assert.Equal(t, tc.status, w.Code, w.Body.String())
		})
	}
	t.Run("origin channel remains subject to token permissions", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&token).Updates(map[string]any{"model_limits_enabled": true, "model_limits": "mj_imagine"}).Error)
		w := quote(t, "POST", "/mj/submit/change", `{"taskId":"owned","action":"UPSCALE","index":1}`)
		assert.Equal(t, http.StatusForbidden, w.Code, w.Body.String())
		require.NoError(t, model.DB.Model(&token).Updates(map[string]any{"model_limits_enabled": false, "model_limits": ""}).Error)
	})
	t.Run("origin channel preserves group model availability", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("model = ?", "mj_upscale").Update("enabled", false).Error)
		w := quote(t, "POST", "/mj/submit/change", `{"taskId":"owned","action":"UPSCALE","index":1}`)
		assert.Equal(t, http.StatusServiceUnavailable, w.Code, w.Body.String())
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("model = ?", "mj_upscale").Update("enabled", true).Error)
	})
	t.Run("origin channel must still exist and be enabled", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&originChannel).Update("status", common.ChannelStatusManuallyDisabled).Error)
		w := quote(t, "POST", "/mj/submit/modal", `{"taskId":"owned"}`)
		assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		require.NoError(t, model.DB.Model(&originChannel).Update("status", common.ChannelStatusEnabled).Error)
		for _, id := range []int{0, originChannel.Id + 1000} {
			require.NoError(t, model.DB.Model(&model.Midjourney{}).Where("mj_id = ?", "owned").Update("channel_id", id).Error)
			w = quote(t, "POST", "/mj/submit/modal", `{"taskId":"owned"}`)
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		}
		require.NoError(t, model.DB.Model(&model.Midjourney{}).Where("mj_id = ?", "owned").Update("channel_id", originChannel.Id).Error)
	})
	t.Run("pricing failure does not mutate selected channel", func(t *testing.T) {
		prices := ratio_setting.ModelPrice2JSONString()
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"mj_imagine":-1}`))
		w := quote(t, "POST", "/mj/submit/imagine", `{"prompt":"cat"}`)
		assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
		assert.NotContains(t, w.Body.String(), `"amount"`)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(prices))
	})
	t.Run("real submissions keep charging and post-submit rejection behavior", func(t *testing.T) {
		savedGroups := setting.UserUsableGroups2JSONString()
		t.Cleanup(func() { require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(savedGroups)) })
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1.5,"vip":2,"auto":3}`))
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("group", "vip").Error)
		token.Group, token.AutoGroups = "auto", `["vip","default"]`
		require.NoError(t, model.DB.Save(&token).Error)
		w := quote(t, "POST", "/mj/submit/change", `{"taskId":"owned","action":"UPSCALE","index":1}`)
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		assert.JSONEq(t, fmt.Sprintf(`{"quota":40000,"amount":"0.08","currency":"USD","model":"mj_upscale","group":"vip","channel":{"id":%d,"type":%d}}`, originChannel.Id, originChannel.Type), w.Body.String())
		service.InitHttpClient()
		require.NoError(t, model.DB.Model(&user).Update("quota", 1000000).Error)
		require.NoError(t, model.DB.Model(&token).Updates(map[string]any{"status": common.TokenStatusEnabled, "remain_quota": 1000000}).Error)
		for _, tc := range []struct {
			path, body             string
			code, quota, channelID int
		}{
			{"/mj/submit/imagine", `{"prompt":"cat"}`, 1, 10000, channel.Id},
			{"/mj/insight-face/swap", `{"sourceBase64":"x","targetBase64":"y"}`, 1, 20000, channel.Id},
			{"/fast/mj/submit/simple-change", `{"content":"owned u2"}`, 22, 40000, originChannel.Id},
			{"/mj/submit/action", `{"taskId":"owned","customId":"MJ::Inpaint::job"}`, 1, 0, originChannel.Id},
			{"/mj/submit/imagine", `{"prompt":"rejected"}`, 24, 0, channel.Id},
		} {
			submitResult.Store(int32(tc.code))
			var beforeUser model.User
			var beforeToken model.Token
			require.NoError(t, model.DB.First(&beforeUser, user.Id).Error)
			require.NoError(t, model.DB.First(&beforeToken, token.Id).Error)
			r := httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(tc.body))
			r.Header.Set("Authorization", "Bearer "+token.Key)
			r.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			engine.ServeHTTP(w, r)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			task := model.GetByMJId(user.Id, fmt.Sprintf("submitted-%d", calls.Load()))
			require.NotNil(t, task, w.Body.String())
			assert.Equal(t, tc.quota, task.Quota)
			assert.Equal(t, tc.channelID, task.ChannelId)
			var afterUser model.User
			var afterToken model.Token
			require.NoError(t, model.DB.First(&afterUser, user.Id).Error)
			require.NoError(t, model.DB.First(&afterToken, token.Id).Error)
			assert.Equal(t, beforeUser.Quota-tc.quota, afterUser.Quota)
			assert.Equal(t, beforeToken.RemainQuota-tc.quota, afterToken.RemainQuota)
		}
		assert.EqualValues(t, 5, calls.Load())
	})
}

func TestRequestEstimateContract(t *testing.T) {
	setupRequestEstimateDB(t)
	savedConfig := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(k, v string) error { savedConfig[k] = v; return nil }))
	savedPrice := ratio_setting.ModelPrice2JSONString()
	savedRatio := ratio_setting.ModelRatio2JSONString()
	savedMemory, savedCount := common.MemoryCacheEnabled, constant.CountToken
	common.MemoryCacheEnabled, constant.CountToken = false, false
	t.Cleanup(func() {
		common.MemoryCacheEnabled, constant.CountToken = savedMemory, savedCount
		require.NoError(t, config.GlobalConfig.LoadFromDB(savedConfig))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrice))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatio))
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"estimate-chat":0.01}`))
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1); w.WriteHeader(http.StatusBadGateway) }))
	t.Cleanup(upstream.Close)
	user := model.User{Username: "contract-user", Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "contractkey", Status: common.TokenStatusExhausted, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(&token).Error)
	channel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "secret-one\nsecret-two", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "estimate-chat,estimate-audio,gpt-4o,deepseek-search,deepseek-fetch", Group: "default", ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling}}
	require.NoError(t, model.DB.Create(&channel).Error)
	for _, modelName := range []string{"estimate-chat", "estimate-audio", "gpt-4o", "deepseek-search", "deepseek-fetch"} {
		require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: modelName, ChannelId: channel.Id, Enabled: true}).Error)
	}
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetRelayRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	body := `{"model":"estimate-chat","messages":[{"role":"user","content":"hello"}],"max_tokens":0}`
	envelope := map[string]any{"method": "POST", "path": "/v1/chat/completions", "body": common.RawMessage(body)}
	// Snapshot all persisted business state, including empty accounting tables.
	snapshot := func() map[string]string {
		return requestEstimateBusinessSnapshot(t)
	}
	quoteWithContext := func(auth string, ctx context.Context) *httptest.ResponseRecorder {
		data, err := common.Marshal(envelope)
		require.NoError(t, err)
		before := snapshot()
		r := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", strings.NewReader(string(data))).WithContext(ctx)
		r.Header.Set("Authorization", "Bearer "+auth)
		r.Header.Set("Content-Type", "application/json")
		r.RemoteAddr = "192.0.2.10:1234"
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, r)
		assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
		assert.Equal(t, before, snapshot(), "estimate must not persist business state")
		assert.Zero(t, calls.Load(), "estimate must never call the model")
		assert.NotContains(t, w.Body.String(), "secret-one")
		assert.NotContains(t, w.Body.String(), upstream.URL)
		return w
	}
	quote := func(auth string) *httptest.ResponseRecorder {
		return quoteWithContext(auth, context.Background())
	}
	t.Run("identity restrictions survive inner credentials", func(t *testing.T) {
		unauthorized := httptest.NewRecorder()
		engine.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", strings.NewReader(`{}`)))
		assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)
		assert.Equal(t, "no-store", unauthorized.Header().Get("Cache-Control"))
		envelope["headers"] = http.Header{"Authorization": {"Bearer administrator-1"}, "X-Forwarded-For": {"127.0.0.1"}, "Cookie": {"session=forged"}}
		for _, tc := range []struct {
			name   string
			change func()
			auth   string
			status int
		}{
			{"unknown", func() {}, "unknown", 401},
			{"exhausted", func() {}, token.Key, 200},
			{"expired", func() { token.Status = common.TokenStatusEnabled; token.ExpiredTime = 1 }, token.Key, 401},
			{"disabled", func() { token.Status = common.TokenStatusDisabled }, token.Key, 401},
			{"banned user", func() { user.Status = common.UserStatusDisabled }, token.Key, 403},
			{"model limit", func() { token.ModelLimitsEnabled = true; token.ModelLimits = "other-model" }, token.Key, 403},
			{"group limit", func() { token.Group = "forbidden-group" }, token.Key, 403},
			{"IP spoof", func() { token.AllowIps = new("127.0.0.1") }, token.Key, 403},
			{"nonadmin pin", func() {}, token.Key + "-1", 403},
		} {
			t.Run(tc.name, func(t *testing.T) {
				token.Status, token.ExpiredTime, token.ModelLimitsEnabled, token.ModelLimits, token.Group, token.AllowIps = common.TokenStatusExhausted, -1, false, "", "", nil
				user.Status = common.UserStatusEnabled
				tc.change()
				require.NoError(t, model.DB.Save(&token).Error)
				require.NoError(t, model.DB.Save(&user).Error)
				w := quote(tc.auth)
				assert.Equal(t, tc.status, w.Code, w.Body.String())
			})
		}
		delete(envelope, "headers")
	})
	token.AllowIps = nil
	require.NoError(t, model.DB.Save(&token).Error)
	t.Run("envelope and unsupported requests", func(t *testing.T) {
		for _, tc := range []struct {
			name, path string
			status     int
		}{
			{"absolute", "https://example.com/v1/chat/completions", 400},
			{"authority", "//example.com/v1/chat/completions", 400},
			{"traversal", "/v1/../v1/chat/completions", 400},
			{"encoded traversal", "/v1/%2e%2e/v1/chat/completions", 400},
			{"fragment", "/v1/chat/completions#fragment", 400},
			{"bad query", "/v1/chat/completions?x=%GG", 400},
			{"malformed path", "/v1/%GG", 400},
			{"recursive", "/v1/requests/estimate", 422},
			{"realtime", "/v1/realtime", 422},
			{"unimplemented Gemini countTokens", "/v1beta/models/estimate-chat:countTokens", 422},
			{"query", "/v1/models", 422},
			{"full query", "/v1/chat/completions?x=a%2Fb&x=c&key=forged", 200},
		} {
			t.Run(tc.name, func(t *testing.T) {
				envelope["path"] = tc.path
				w := quote(token.Key)
				assert.Equal(t, tc.status, w.Code, w.Body.String())
			})
		}
		envelope["path"] = "/v1/chat/completions"
		envelope["body_base64"] = "%%%"
		assert.Equal(t, 400, quote(token.Key).Code, "mutually exclusive bodies")
		delete(envelope, "body")
		assert.Equal(t, 400, quote(token.Key).Code, "invalid base64")
		envelope["body_base64"] = base64.StdEncoding.EncodeToString([]byte(body))
		assert.Equal(t, 200, quote(token.Key).Code)
		delete(envelope, "body_base64")
		envelope["body"] = common.RawMessage(strings.Replace(body, `"max_tokens":0`, `"stream":true`, 1))
		assert.Equal(t, 200, quote(token.Key).Code, "streaming targets return a single JSON estimate")
		envelope["body"] = common.RawMessage(strings.Replace(body, `"max_tokens":0`, `"max_tokens":18446744073709551615`, 1))
		assert.Equal(t, 400, quote(token.Key).Code)
		envelope["body"] = common.RawMessage(body)
		envelope["headers"] = http.Header{"Content-Type": {"application/json-invalid"}}
		assert.Equal(t, 422, quote(token.Key).Code, "invalid media type must not be accepted as JSON")
		delete(envelope, "headers")
		envelope["body"] = common.RawMessage(`{"model":"estimate-chat","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"` + upstream.URL + `/image"}}]}]}`)
		assert.Equal(t, 200, quote(token.Key).Code, "multimodal inputs are accepted without fetching while measurement is disabled")
		envelope["body"] = common.RawMessage(body)
		savedMaxBody := constant.MaxRequestBodyMB
		constant.MaxRequestBodyMB = 1
		envelope["padding"] = strings.Repeat("x", 1<<20)
		assert.Equal(t, 413, quote(token.Key).Code)
		delete(envelope, "padding")
		constant.MaxRequestBodyMB = savedMaxBody
	})
	t.Run("ordinary HTTP protocols and streaming", func(t *testing.T) {
		constant.CountToken = false
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"estimate-chat":0.01,"deepseek-search":0.01,"deepseek-fetch":0.01}`))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
		cases := []struct {
			name, path, body string
			headers          http.Header
		}{
			{"completion", "/v1/completions", `{"model":"estimate-chat","prompt":"hello"}`, nil},
			{"messages", "/v1/messages", `{"model":"estimate-chat","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`, http.Header{"Anthropic-Version": {"2023-06-01"}}},
			{"responses", "/v1/responses", `{"model":"estimate-chat","input":"hello","stream":true}`, nil},
			{"responses compact", "/v1/responses/compact", `{"model":"estimate-chat","input":"hello"}`, nil},
			{"embedding", "/v1/embeddings", `{"model":"estimate-chat","input":"hello"}`, nil},
			{"rerank", "/v1/rerank", `{"model":"estimate-chat","query":"hello","documents":["world"]}`, nil},
			{"alpha search", "/v1/alpha/search", `{"model":"estimate-chat"}`, nil},
			{"tool search", "/v1/tools/search", `{"model":"estimate-chat"}`, nil},
			{"tool fetch", "/v1/tools/fetch", `{"model":"estimate-chat"}`, nil},
			{"gemini generate", "/v1beta/models/estimate-chat:generateContent", `{"contents":[{"role":"user","parts":[{"text":"hello"}]}]}`, nil},
			{"gemini streaming", "/v1beta/models/estimate-chat:streamGenerateContent?alt=sse", `{"contents":[{"role":"user","parts":[{"text":"hello"}]}]}`, nil},
			{"gemini embedding", "/v1beta/models/estimate-chat:embedContent", `{"content":{"parts":[{"text":"hello"}]}}`, nil},
			{"gemini batch embedding", "/v1beta/models/estimate-chat:batchEmbedContents", `{"requests":[{"model":"estimate-chat","content":{"parts":[{"text":"hello"}]}}]}`, nil},
			{"streaming chat", "/v1/chat/completions", `{"model":"estimate-chat","messages":[{"role":"user","content":"hello"}],"stream":true}`, nil},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				envelope["method"], envelope["path"] = http.MethodPost, tc.path
				envelope["body"], envelope["headers"] = common.RawMessage(tc.body), tc.headers
				w := quote(token.Key)
				require.Equal(t, http.StatusOK, w.Code, w.Body.String())
				var result map[string]any
				require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
				assert.Equal(t, float64(5000), result["quota"])
				assert.Equal(t, "0.01", result["amount"])
			})
		}
		for _, tc := range []struct {
			name, path, body string
			headers          http.Header
		}{
			{"messages max_tokens", "/v1/messages", `{"model":"estimate-chat","max_tokens":18446744073709551615,"messages":[{"role":"user","content":"hello"}]}`, nil},
			{"responses max_output_tokens", "/v1/responses", `{"model":"estimate-chat","input":"hello","max_output_tokens":18446744073709551615}`, nil},
			{"gemini maxOutputTokens", "/v1beta/models/estimate-chat:generateContent", `{"contents":[{"role":"user","parts":[{"text":"hello"}]}],"generationConfig":{"maxOutputTokens":18446744073709551615}}`, nil},
		} {
			t.Run(tc.name, func(t *testing.T) {
				envelope["method"], envelope["path"] = http.MethodPost, tc.path
				envelope["body"], envelope["headers"] = common.RawMessage(tc.body), tc.headers
				assert.Equal(t, http.StatusBadRequest, quote(token.Key).Code)
			})
		}
		for _, tc := range []struct {
			name, path, body string
		}{
			{"responses image input", "/v1/responses", `{"model":"estimate-chat","input":[{"role":"user","content":[{"type":"input_image","image_url":"https://example.invalid/image.png"}]}]}`},
			{"messages image input", "/v1/messages", `{"model":"estimate-chat","max_tokens":16,"messages":[{"role":"user","content":[{"type":"image","source":{"type":"url","url":"https://example.invalid/image.png"}}]}]}`},
			{"gemini inline image", "/v1beta/models/estimate-chat:generateContent", `{"contents":[{"role":"user","parts":[{"inlineData":{"mimeType":"image/png","data":"aGVsbG8="}}]}]}`},
			{"gemini file input", "/v1beta/models/estimate-chat:embedContent", `{"content":{"parts":[{"fileData":{"mimeType":"text/plain","fileUri":"https://example.invalid/input.txt"}}]}}`},
		} {
			t.Run(tc.name, func(t *testing.T) {
				envelope["method"], envelope["path"] = http.MethodPost, tc.path
				envelope["body"], envelope["headers"] = common.RawMessage(tc.body), nil
				assert.Equal(t, http.StatusOK, quote(token.Key).Code)
			})
		}
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("image pricing uses effective count without submission", func(t *testing.T) {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"gpt-4o":0.01}`))
		envelope["method"], envelope["path"] = http.MethodPost, "/v1/images/generations"
		envelope["body"], envelope["headers"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":1}`), nil
		result := quote(token.Key)
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		assert.Contains(t, result.Body.String(), `"quota":5000`)
		assert.Contains(t, result.Body.String(), `"amount":"0.01"`)

		previousOverride := channel.ParamOverride
		t.Cleanup(func() {
			require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("param_override", previousOverride).Error)
			model.InitChannelCache()
		})
		override := `{"operations":[{"mode":"set","path":"n","value":3}]}`
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("param_override", override).Error)
		model.InitChannelCache()
		result = quote(token.Key)
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		assert.Contains(t, result.Body.String(), `"quota":15000`)
		assert.Contains(t, result.Body.String(), `"amount":"0.03"`)
		delete(envelope, "body")
		envelope["body"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":1,"parameters":{"n":3}}`)
		result = quote(token.Key)
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		assert.Contains(t, result.Body.String(), `"quota":15000`)
		envelope["body"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":1,"parameters":{"n":129}}`)
		assert.Equal(t, http.StatusBadRequest, quote(token.Key).Code, "passthrough image counts must retain the existing upper bound")
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("param_override", previousOverride).Error)
		model.InitChannelCache()
		var form bytes.Buffer
		writer := multipart.NewWriter(&form)
		require.NoError(t, writer.WriteField("model", "gpt-4o"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("n", "2"))
		file, err := writer.CreateFormFile("image", "input.png")
		require.NoError(t, err)
		_, err = file.Write([]byte("image bytes"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		envelope["path"] = "/v1/images/edits"
		delete(envelope, "body")
		envelope["body_base64"] = base64.StdEncoding.EncodeToString(form.Bytes())
		envelope["headers"] = http.Header{"Content-Type": {writer.FormDataContentType()}}
		result = quote(token.Key)
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		assert.Contains(t, result.Body.String(), `"quota":10000`)
		assert.Contains(t, result.Body.String(), `"amount":"0.02"`)
		delete(envelope, "body_base64")
		delete(envelope, "headers")

		imageBillingConfig := map[string]string{}
		require.NoError(t, config.GlobalConfig.SaveToDB(func(k, v string) error {
			if k == "billing_setting.billing_mode" || k == "billing_setting.billing_expr" {
				imageBillingConfig[k] = v
			}
			return nil
		}))
		t.Cleanup(func() {
			require.NoError(t, config.GlobalConfig.LoadFromDB(imageBillingConfig))
		})
		for _, tc := range []struct {
			name, expression      string
			oneQuota, fourQuota   float64
			oneAmount, fourAmount string
		}{
			{"token-only image expression", `tier("input", p * 4)`, 0, 0, "0", "0"},
			{"per-request image expression", `tier("request", fixed(0.02))`, 10000, 10000, "0.02", "0.02"},
			{"per-image expression", `tier("image", fixed(0.02)) * image_count`, 10000, 40000, "0.02", "0.08"},
		} {
			t.Run(tc.name, func(t *testing.T) {
				modes, err := common.Marshal(map[string]string{"gpt-4o": "tiered_expr"})
				require.NoError(t, err)
				expressions, err := common.Marshal(map[string]string{"gpt-4o": tc.expression})
				require.NoError(t, err)
				require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": string(modes), "billing_setting.billing_expr": string(expressions)}))
				envelope["path"] = "/v1/images/generations"
				envelope["body"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":1}`)
				one := quote(token.Key)
				require.Equal(t, http.StatusOK, one.Code, one.Body.String())
				envelope["body"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":4}`)
				four := quote(token.Key)
				require.Equal(t, http.StatusOK, four.Code, four.Body.String())
				var oneResult, fourResult map[string]any
				require.NoError(t, common.Unmarshal(one.Body.Bytes(), &oneResult))
				require.NoError(t, common.Unmarshal(four.Body.Bytes(), &fourResult))
				assert.Equal(t, tc.oneQuota, oneResult["quota"])
				assert.Equal(t, tc.fourQuota, fourResult["quota"])
				assert.Equal(t, tc.oneAmount, oneResult["amount"])
				assert.Equal(t, tc.fourAmount, fourResult["amount"])
			})
		}
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": `{}`, "billing_setting.billing_expr": `{}`}))
		envelope["body"] = common.RawMessage(`{"model":"gpt-4o","prompt":"a red cube","n":1}`)

		originalAbility := model.Ability{}
		require.NoError(t, model.DB.Where("channel_id = ? AND model = ?", channel.Id, "gpt-4o").First(&originalAbility).Error)
		require.True(t, originalAbility.Enabled, "fixture image ability must start enabled")
		t.Cleanup(func() {
			require.NoError(t, model.DB.Model(&model.Ability{}).Where(&model.Ability{ChannelId: channel.Id, Model: "gpt-4o", Group: "default"}).Update("enabled", originalAbility.Enabled).Error)
			model.InitChannelCache()
		})
		require.NoError(t, model.DB.Model(&model.Ability{}).Where(&model.Ability{ChannelId: channel.Id, Model: "gpt-4o", Group: "default"}).Update("enabled", false).Error)
		replicateChannel := model.Channel{Type: constant.ChannelTypeReplicate, Key: "replicate-test-key", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "black-forest-labs/flux-1.1-pro", Group: "default"}
		require.NoError(t, model.DB.Create(&replicateChannel).Error)
		t.Cleanup(func() {
			require.NoError(t, model.DB.Where("channel_id = ?", replicateChannel.Id).Delete(&model.Ability{}).Error)
			require.NoError(t, model.DB.Delete(&replicateChannel).Error)
			model.InitChannelCache()
		})
		require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "black-forest-labs/flux-1.1-pro", ChannelId: replicateChannel.Id, Enabled: true}).Error)
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"black-forest-labs/flux-1.1-pro":0.02}`))
		beforeCalls := calls.Load()
		envelope["path"] = "/v1/images/edits"
		form.Reset()
		writer = multipart.NewWriter(&form)
		require.NoError(t, writer.WriteField("model", "black-forest-labs/flux-1.1-pro"))
		require.NoError(t, writer.WriteField("prompt", "edit this image"))
		require.NoError(t, writer.WriteField("n", "2"))
		file, err = writer.CreateFormFile("image", "input.png")
		require.NoError(t, err)
		_, err = file.Write([]byte("image bytes"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		delete(envelope, "body")
		envelope["body_base64"] = base64.StdEncoding.EncodeToString(form.Bytes())
		envelope["headers"] = http.Header{"Content-Type": {writer.FormDataContentType()}}
		result = quote(token.Key)
		require.Equal(t, http.StatusOK, result.Code, result.Body.String())
		assert.Contains(t, result.Body.String(), `"quota":20000`)
		assert.Contains(t, result.Body.String(), `"amount":"0.04"`)
		assert.Equal(t, beforeCalls, calls.Load(), "Replicate edit estimates must not upload files or submit predictions")
		require.NoError(t, model.DB.Model(&model.Ability{}).Where(&model.Ability{ChannelId: channel.Id, Model: "gpt-4o", Group: "default"}).Update("enabled", originalAbility.Enabled).Error)
		model.InitChannelCache()
		delete(envelope, "body_base64")
		delete(envelope, "headers")
		envelope["body"] = common.RawMessage(body)
		envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body)
	})
	t.Run("plugin-owned Responses model uses plugin channel routing", func(t *testing.T) {
		registry := pluginruntime.NewRegistry()
		_, err := registry.Register(`
			export const meta = {
				apiVersion: 1, key: "estimate-responses-plugin", name: "Estimate responses plugin",
				version: "1.0.0", author: {name: "Test"}, models: ["plugin-responses-model"], fetchMode: "per_task",
				protocols: [{name: "openai_responses", models: ["plugin-responses-model"], supports: ["sync"]}]
			};
			export const protocols = {openai_responses: {
				decodeRequest(request) { return {kind: "submit", model: request.model, requestBody: request.body.value}; },
				renderFinal() { return {}; }
			}};
			export function buildSubmitRequest() { return {}; }
			export function parseSubmitResponse() { return {taskId: "task-1"}; }
			export function parseTaskResult() { return {status: "processing"}; }
			export function buildQueryRequest() { return {}; }
		`, pluginruntime.Options{Key: "estimate-responses-plugin", Version: "1.0.0"})
		require.NoError(t, err)
		previous := pluginruntime.DefaultRegistry
		pluginruntime.DefaultRegistry = registry
		t.Cleanup(func() { pluginruntime.DefaultRegistry = previous })
		envelope["method"], envelope["path"] = http.MethodPost, "/v1/responses"
		envelope["body"], envelope["headers"] = common.RawMessage(`{"model":"plugin-responses-model","input":"hello"}`), nil
		assert.Equal(t, http.StatusServiceUnavailable, quote(token.Key).Code, "an unbound plugin request must not fall through to ordinary channel pricing")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("audio multipart accepts request-scoped duration facts", func(t *testing.T) {
		savedCount, savedRatio := constant.CountToken, ratio_setting.ModelRatio2JSONString()
		constant.CountToken = true
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"estimate-audio":0.01}`))
		t.Cleanup(func() {
			constant.CountToken = savedCount
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatio))
		})
		var multipartBody bytes.Buffer
		writer := multipart.NewWriter(&multipartBody)
		require.NoError(t, writer.WriteField("model", "estimate-audio"))
		file, err := writer.CreateFormFile("file", "audio.wav")
		require.NoError(t, err)
		_, err = file.Write([]byte("audio bytes are not parsed when duration is supplied"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		contentType := writer.FormDataContentType()
		envelope["method"], envelope["path"] = http.MethodPost, "/v1/audio/transcriptions"
		envelope["headers"] = http.Header{"Content-Type": {contentType}}
		delete(envelope, "body")
		envelope["body_base64"] = base64.StdEncoding.EncodeToString(multipartBody.Bytes())
		envelope["media_info"] = []map[string]any{{"field": "file", "index": 0, "type": "audio", "duration_seconds": 60}}
		w := quote(token.Key)
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var result map[string]any
		require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
		assert.Equal(t, "estimate-audio", result["model"])
		assert.Equal(t, float64(10), result["quota"])
		assert.Equal(t, "0.00002", result["amount"])
		delete(envelope, "body_base64")
		delete(envelope, "media_info")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("multimodal image dimensions bind to the original JSON pointer", func(t *testing.T) {
		savedCount, savedRatio := constant.CountToken, ratio_setting.ModelRatio2JSONString()
		savedMediaToken, savedMediaTokenNotStream := constant.GetMediaToken, constant.GetMediaTokenNotStream
		constant.CountToken = true
		constant.GetMediaToken, constant.GetMediaTokenNotStream = true, true
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o":0.01}`))
		t.Cleanup(func() {
			constant.CountToken = savedCount
			constant.GetMediaToken, constant.GetMediaTokenNotStream = savedMediaToken, savedMediaTokenNotStream
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatio))
		})
		imageBody := `{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/png;base64,not-decoded","detail":"high"}}]}]}`
		quoteImage := func(width, height int) int {
			envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(imageBody)
			envelope["headers"] = http.Header{"Content-Type": {"application/json"}}
			envelope["media_info"] = []map[string]any{{"pointer": "/messages/0/content/0/image_url/url", "type": "image", "width": width, "height": height}}
			w := quote(token.Key)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
			return int(result["quota"].(float64))
		}
		low := quoteImage(512, 512)
		high := quoteImage(2048, 2048)
		assert.Equal(t, 2, low)
		assert.Equal(t, 7, high)
		assert.Greater(t, high, low, "the bound image dimensions must affect existing image token estimation")
		delete(envelope, "media_info")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("image URL measurements take precedence and report media failures", func(t *testing.T) {
		savedCount, savedRatio := constant.CountToken, ratio_setting.ModelRatio2JSONString()
		savedMaxFileDownloadMB := constant.MaxFileDownloadMB
		savedMediaToken, savedMediaTokenNotStream := constant.GetMediaToken, constant.GetMediaTokenNotStream
		fetchSetting := system_setting.GetFetchSetting()
		savedFetch := *fetchSetting
		constant.CountToken = true
		constant.MaxFileDownloadMB = 1
		constant.GetMediaToken, constant.GetMediaTokenNotStream = true, true
		fetchSetting.EnableSSRFProtection = true
		fetchSetting.AllowPrivateIp = true
		fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode = false, false
		fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts = nil, nil, nil
		fetchSetting.ApplyIPFilterForDomain = true
		service.InitHttpClient()
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o":0.01}`))
		t.Cleanup(func() {
			constant.CountToken = savedCount
			constant.MaxFileDownloadMB = savedMaxFileDownloadMB
			constant.GetMediaToken, constant.GetMediaTokenNotStream = savedMediaToken, savedMediaTokenNotStream
			*fetchSetting = savedFetch
			require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatio))
		})
		pngBytes := func() []byte {
			var data bytes.Buffer
			img := image.NewRGBA(image.Rect(0, 0, 1, 1))
			img.Set(0, 0, color.White)
			require.NoError(t, png.Encode(&data, img))
			return data.Bytes()
		}()
		var calls atomic.Int32
		mediaServerFails := false
		mediaServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			if mediaServerFails {
				http.Error(w, "media unavailable", http.StatusBadGateway)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(pngBytes)
		}))
		t.Cleanup(mediaServer.Close)
		imageBody := fmt.Sprintf(`{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":%q,"detail":"high"}}]}]}`, mediaServer.URL+"/image.png")
		quoteImage := func(withFacts bool) int {
			envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(imageBody)
			envelope["headers"] = http.Header{"Content-Type": {"application/json"}}
			if withFacts {
				envelope["media_info"] = []map[string]any{{"pointer": "/messages/0/content/0/image_url/url", "type": "image", "width": 4096, "height": 4096}}
			} else {
				delete(envelope, "media_info")
			}
			w := quote(token.Key)
			require.Equal(t, http.StatusOK, w.Code, w.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
			return int(result["quota"].(float64))
		}
		withFacts := quoteImage(true)
		withoutFacts := quoteImage(false)
		assert.Equal(t, 2, withFacts)
		assert.Equal(t, 2, withoutFacts)
		assert.Equal(t, withoutFacts, withFacts, "URL dimensions, not conflicting supplements, determine the measured quote")
		assert.EqualValues(t, 2, calls.Load())
		mediaServerFails = true
		envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(imageBody)
		envelope["headers"] = http.Header{"Content-Type": {"application/json"}}
		envelope["media_info"] = []map[string]any{{"pointer": "/messages/0/content/0/image_url/url", "type": "image", "width": 1, "height": 1}}
		failedQuote := quote(token.Key)
		assert.Equal(t, http.StatusBadRequest, failedQuote.Code, failedQuote.Body.String())
		assert.Contains(t, failedQuote.Body.String(), "media_read_failed")
		assert.EqualValues(t, 3, calls.Load(), "a failed URL read must not fall back to the supplied dimensions")

		previousWorkerURL, previousWorkerKey := system_setting.WorkerUrl, system_setting.WorkerValidKey
		previousAllowWorkerHTTP := system_setting.WorkerAllowHttpImageRequestEnabled
		t.Cleanup(func() {
			system_setting.WorkerUrl, system_setting.WorkerValidKey = previousWorkerURL, previousWorkerKey
			system_setting.WorkerAllowHttpImageRequestEnabled = previousAllowWorkerHTTP
		})
		var workerCalls atomic.Int32
		worker := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			workerCalls.Add(1)
			var request service.WorkerRequest
			require.NoError(t, common.DecodeJson(r.Body, &request))
			assert.Contains(t, request.URL, "http://127.0.0.1:8123/")
			assert.Equal(t, "estimate-worker-key", request.Key)
			if request.URL == "http://127.0.0.1:8123/slow.png" {
				<-r.Context().Done()
				return
			}
			switch request.URL {
			case "http://127.0.0.1:8123/unavailable.png":
				http.Error(w, "media unavailable", http.StatusBadGateway)
			case "http://127.0.0.1:8123/empty.png":
			case "http://127.0.0.1:8123/invalid.png":
				_, _ = w.Write([]byte("not an image"))
			case "http://127.0.0.1:8123/oversized.png":
				_, _ = w.Write(bytes.Repeat([]byte{'x'}, (1<<20)+1))
			default:
				_, _ = w.Write(pngBytes)
			}
		}))
		t.Cleanup(worker.Close)
		system_setting.WorkerUrl = worker.URL
		system_setting.WorkerValidKey = "estimate-worker-key"
		system_setting.WorkerAllowHttpImageRequestEnabled = true
		fetchSetting.EnableSSRFProtection = false
		mediaServerFails = false
		imageBody = `{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"http://127.0.0.1:8123/image.png","detail":"high"}}]}]}`
		envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(imageBody)
		envelope["headers"] = http.Header{"Content-Type": {"application/json"}}
		envelope["media_info"] = []map[string]any{{"pointer": "/messages/0/content/0/image_url/url", "type": "image", "width": 4096, "height": 4096}}
		workerQuote := quote(token.Key)
		require.Equal(t, http.StatusOK, workerQuote.Code, workerQuote.Body.String())
		var workerResult map[string]any
		require.NoError(t, common.Unmarshal(workerQuote.Body.Bytes(), &workerResult))
		assert.Equal(t, float64(2), workerResult["quota"])
		assert.Equal(t, "0.000004", workerResult["amount"])
		assert.EqualValues(t, 1, workerCalls.Load())
		assert.EqualValues(t, 3, calls.Load(), "Worker-backed estimation must not fetch the media URL directly")

		for _, path := range []string{"unavailable.png", "empty.png", "invalid.png", "oversized.png"} {
			imageBody = fmt.Sprintf(`{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":%q,"detail":"high"}}]}]}`, "http://127.0.0.1:8123/"+path)
			envelope["body"] = common.RawMessage(imageBody)
			failedWorkerQuote := quote(token.Key)
			assert.Equal(t, http.StatusBadRequest, failedWorkerQuote.Code, failedWorkerQuote.Body.String())
			assert.Contains(t, failedWorkerQuote.Body.String(), "media_read_failed")
		}
		assert.EqualValues(t, 5, workerCalls.Load())
		assert.EqualValues(t, 3, calls.Load(), "Worker media failures must not fetch the media URL directly")

		imageBody = `{"model":"gpt-4o","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"http://127.0.0.1:8123/slow.png","detail":"high"}}]}]}`
		envelope["body"] = common.RawMessage(imageBody)
		envelope["media_info"] = []map[string]any{{"pointer": "/messages/0/content/0/image_url/url", "type": "image", "width": 1, "height": 1}}
		requestContext, cancelRequest := context.WithTimeout(context.Background(), 500*time.Millisecond)
		timeoutQuote := quoteWithContext(token.Key, requestContext)
		cancelRequest()
		assert.Equal(t, http.StatusGatewayTimeout, timeoutQuote.Code, timeoutQuote.Body.String())
		assert.Contains(t, timeoutQuote.Body.String(), "media_read_failed")
		assert.EqualValues(t, 6, workerCalls.Load())
		assert.EqualValues(t, 3, calls.Load(), "a timed-out URL read must not fall back to supplied dimensions")

		delete(envelope, "media_info")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("audio speech and translation routes are estimable", func(t *testing.T) {
		savedRatio := ratio_setting.ModelRatio2JSONString()
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"estimate-audio":0.01}`))
		t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatio)) })
		envelope["method"], envelope["path"] = http.MethodPost, "/v1/audio/speech"
		envelope["headers"], envelope["body"] = http.Header{"Content-Type": {"application/json"}}, common.RawMessage(`{"model":"estimate-audio","input":"hello","voice":"alloy"}`)
		assert.Equal(t, http.StatusOK, quote(token.Key).Code)

		var multipartBody bytes.Buffer
		writer := multipart.NewWriter(&multipartBody)
		require.NoError(t, writer.WriteField("model", "estimate-audio"))
		file, err := writer.CreateFormFile("file", "audio.wav")
		require.NoError(t, err)
		_, err = file.Write([]byte("audio bytes"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
		envelope["path"], envelope["headers"] = "/v1/audio/translations", http.Header{"Content-Type": {writer.FormDataContentType()}}
		envelope["body_base64"] = base64.StdEncoding.EncodeToString(multipartBody.Bytes())
		delete(envelope, "body")
		assert.Equal(t, http.StatusOK, quote(token.Key).Code)
		delete(envelope, "body_base64")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("malformed or unbound media facts are rejected", func(t *testing.T) {
		envelope["method"], envelope["path"], envelope["body"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body)
		for _, facts := range [][]map[string]any{
			{{"pointer": "/messages/0/content/0/text", "type": "image", "width": 128, "height": 128, "quota": 1}},
			{{"pointer": "/messages/0/content/0/text", "type": "audio", "duration_seconds": -1}},
			{{"pointer": "/messages/0/content/0/text", "type": "image", "width": 32768, "height": 32768}},
			{{"pointer": "/messages/0/content/99/text", "type": "image", "width": 128, "height": 128}},
			{{"pointer": "/messages/0/content/0/text", "field": "file", "index": 0, "type": "image", "width": 128, "height": 128}},
			{{"pointer": "/messages/0/content/0/text", "type": "image", "width": 128, "height": 128}, {"pointer": "/messages/0/content/0/text", "type": "image", "width": 256, "height": 256}},
		} {
			envelope["media_info"] = facts
			assert.Equal(t, http.StatusBadRequest, quote(token.Key).Code)
		}
		delete(envelope, "media_info")
		delete(envelope, "body_base64")
		envelope["method"], envelope["path"], envelope["body"], envelope["headers"] = http.MethodPost, "/v1/chat/completions", common.RawMessage(body), nil
	})
	t.Run("nominal prices ignore funding optimizations", func(t *testing.T) {
		operation_setting.GetQuotaSetting().PreConsumeMultiplier = 3
		// "user\nhello" estimates three text tokens plus six chat framing
		// tokens. At ratio 2 and multiplier 3 this reserves 54 quota; the
		// expression's $4/M input price gives the same independent example.
		for _, tc := range []struct {
			name, price, ratio, expr string
			count                    bool
			quota                    int
			amount                   string
			status                   int
		}{
			{"per request", `{"estimate-chat":0.01}`, `{}`, "", false, 5000, "0.01", 200},
			{"free", `{"estimate-chat":0}`, `{}`, "", false, 0, "0", 200},
			{"overflow", `{"estimate-chat":1e100}`, `{}`, "", false, 0, "", 400},
			{"negative", `{"estimate-chat":-1}`, `{}`, "", false, 0, "", 400},
			{"missing", `{}`, `{}`, "", false, 0, "", 400},
			{"legacy tokens", `{}`, `{"estimate-chat":2}`, "", true, 54, "0.000108", 200},
			{"token expression", `{}`, `{}`, `tier("text", p * 4 + c * 999)`, true, 54, "0.000108", 200},
			{"fixed expression", `{}`, `{}`, `tier("request", fixed(0.02))`, false, 10000, "0.02", 200},
			{"zero expression", `{}`, `{}`, `tier("request", fixed(0))`, false, 0, "0", 200},
			{"raw body and header", `{}`, `{}`, `param("max_tokens") == 0 && header("x-price-tier") == "fast" ? tier("fast", fixed(0.03)) : tier("base", fixed(0.01))`, false, 15000, "0.03", 200},
		} {
			t.Run(tc.name, func(t *testing.T) {
				constant.CountToken = tc.count
				require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(tc.price))
				require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(tc.ratio))
				mode := "ratio"
				if tc.expr != "" {
					mode = "tiered_expr"
				}
				modeJSON, err := common.Marshal(map[string]string{"estimate-chat": mode})
				require.NoError(t, err)
				exprJSON, err := common.Marshal(map[string]string{"estimate-chat": tc.expr})
				require.NoError(t, err)
				require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": string(modeJSON), "billing_setting.billing_expr": string(exprJSON)}))
				envelope["headers"] = http.Header{"X-Price-Tier": {"fast", "slow"}}
				w := quote(token.Key)
				require.Equal(t, tc.status, w.Code, w.Body.String())
				if tc.status == 200 {
					var result map[string]any
					require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
					assert.Equal(t, float64(tc.quota), result["quota"])
					assert.Equal(t, tc.amount, result["amount"])
				}
			})
		}
		constant.CountToken = false
	})
	t.Run("invalid conversion unit", func(t *testing.T) {
		savedUnit := common.QuotaPerUnit
		defer func() { common.QuotaPerUnit = savedUnit }()
		for _, unit := range []float64{-1, math.NaN(), math.Inf(1)} {
			common.QuotaPerUnit = unit
			assert.Equal(t, 400, quote(token.Key).Code)
		}
	})
	t.Run("funding does not change nominal price", func(t *testing.T) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": `{}`, "billing_setting.billing_expr": `{}`}))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"estimate-chat":0.01}`))
		for _, preference := range []string{"wallet_only", "subscription_only"} {
			user.Setting = fmt.Sprintf(`{"billing_preference":%q}`, preference)
			user.Quota, token.RemainQuota = 100_000_000, 100_000_000
			require.NoError(t, model.DB.Save(&user).Error)
			require.NoError(t, model.DB.Save(&token).Error)
			w := quote(token.Key)
			require.Equal(t, 200, w.Code, w.Body.String())
			assert.JSONEq(t, fmt.Sprintf(`{"quota":5000,"amount":"0.01","currency":"USD","model":"estimate-chat","group":"default","channel":{"id":%d,"type":1}}`, channel.Id), w.Body.String())
		}
		user.Quota, token.RemainQuota = 0, 0
		require.NoError(t, model.DB.Save(&user).Error)
		require.NoError(t, model.DB.Save(&token).Error)
	})
	t.Run("estimate and model request limits are independent", func(t *testing.T) {
		savedEnabled, savedCount, savedSuccess, savedDuration := setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount, setting.ModelRequestRateLimitDurationMinutes
		defer func() {
			setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount, setting.ModelRequestRateLimitDurationMinutes = savedEnabled, savedCount, savedSuccess, savedDuration
		}()
		setting.ModelRequestRateLimitEnabled, setting.ModelRequestRateLimitCount, setting.ModelRequestRateLimitSuccessCount, setting.ModelRequestRateLimitDurationMinutes = true, 1, 1, 1
		// A test-only HTTP probe observes the real model limiter without funding
		// or upstream calls. Estimates must neither consume nor obey its bucket.
		engine.GET("/estimate-test/model-limit", func(c *gin.Context) { c.Set("id", user.Id) }, middleware.ModelRequestRateLimit(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
		assert.Equal(t, 200, quote(token.Key).Code)
		assert.Equal(t, 200, quote(token.Key).Code)
		probe := func() int {
			w := httptest.NewRecorder()
			engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/estimate-test/model-limit", nil))
			return w.Code
		}
		assert.Equal(t, http.StatusNoContent, probe())
		assert.Equal(t, http.StatusTooManyRequests, probe())
		assert.Equal(t, 200, quote(token.Key).Code)

		savedCriticalEnabled, savedCriticalNum, savedCriticalDuration := common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration
		defer func() {
			common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = savedCriticalEnabled, savedCriticalNum, savedCriticalDuration
		}()
		common.CriticalRateLimitEnable, common.CriticalRateLimitNum, common.CriticalRateLimitDuration = true, 1, 60
		limited := gin.New()
		require.NoError(t, limited.SetTrustedProxies(nil))
		SetRelayRouter(limited)
		limited.GET("/estimate-test/critical-limit", middleware.CriticalRateLimit(), func(c *gin.Context) { c.Status(http.StatusNoContent) })
		data, err := common.Marshal(envelope)
		require.NoError(t, err)
		for _, status := range []int{200, 429} {
			r := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", strings.NewReader(string(data)))
			r.Header.Set("Authorization", "Bearer "+token.Key)
			r.Header.Set("Content-Type", "application/json")
			r.RemoteAddr = "192.0.2.99:1234"
			w := httptest.NewRecorder()
			limited.ServeHTTP(w, r)
			assert.Equal(t, status, w.Code, w.Body.String())
			assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
		}
		r := httptest.NewRequest(http.MethodGet, "/estimate-test/critical-limit", nil)
		r.RemoteAddr = "192.0.2.99:1234"
		w := httptest.NewRecorder()
		limited.ServeHTTP(w, r)
		assert.Equal(t, http.StatusNoContent, w.Code, "estimate abuse bucket must not consume the shared critical bucket")
	})
	t.Run("channel configuration changes apply", func(t *testing.T) {
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("enabled", false).Error)
		assert.Equal(t, 503, quote(token.Key).Code)
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("enabled", true).Error)
		assert.Equal(t, 200, quote(token.Key).Code)
	})
	t.Run("auto group and billing alias", func(t *testing.T) {
		savedGroups := setting.UserUsableGroups2JSONString()
		savedGroupRatio := ratio_setting.GroupRatio2JSONString()
		defer func() {
			require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(savedGroups))
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(savedGroupRatio))
		}()
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`))
		token.Group, token.AutoGroups = "auto", `["default","vip"]`
		require.NoError(t, model.DB.Save(&token).Error)
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("group", "vip").Error)
		alias := "estimate-chat@effort:high"
		require.NoError(t, model.DB.Create(&model.Ability{Group: "vip", Model: alias, ChannelId: channel.Id, Enabled: true}).Error)
		for _, expr := range []string{"", `tier("request", fixed(0.02))`} {
			mode := "ratio"
			quota, amount := 10000, "0.02"
			if expr != "" {
				mode, quota, amount = "tiered_expr", 20000, "0.04"
			}
			expressions, err := common.Marshal(map[string]string{"estimate-chat": expr})
			require.NoError(t, err)
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": fmt.Sprintf(`{"estimate-chat":%q}`, mode), "billing_setting.billing_expr": string(expressions)}))
			envelope["body"] = common.RawMessage(strings.Replace(body, "estimate-chat", alias, 1))
			w := quote(token.Key)
			require.Equal(t, 200, w.Code, w.Body.String())
			assert.JSONEq(t, fmt.Sprintf(`{"quota":%d,"amount":%q,"currency":"USD","model":"estimate-chat","group":"vip","channel":{"id":%d,"type":1}}`, quota, amount, channel.Id), w.Body.String())
		}
		envelope["body"] = common.RawMessage(body)
		token.Group, token.AutoGroups = "", ""
		require.NoError(t, model.DB.Save(&token).Error)
		require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("group", "default").Error)
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{"billing_setting.billing_mode": `{}`, "billing_setting.billing_expr": `{}`}))
	})
	t.Run("priority pin cache and affinity remain read only", func(t *testing.T) {
		common.MemoryCacheEnabled = true
		defer func() { common.MemoryCacheEnabled = false }()
		newChannel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "never-read-secret", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "estimate-chat", Group: "default", Priority: new(int64(10))}
		require.NoError(t, model.DB.Create(&newChannel).Error)
		require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "estimate-chat", ChannelId: newChannel.Id, Enabled: true, Priority: newChannel.Priority}).Error)
		model.InitChannelCache()
		selectedID := func(w *httptest.ResponseRecorder) int {
			require.Equal(t, 200, w.Code, w.Body.String())
			var result struct {
				Channel struct {
					ID int `json:"id"`
				} `json:"channel"`
			}
			require.NoError(t, common.Unmarshal(w.Body.Bytes(), &result))
			return result.Channel.ID
		}
		assert.Equal(t, newChannel.Id, selectedID(quote(token.Key)), "new higher-priority configuration takes effect after normal cache publication")
		user.Role = common.RoleAdminUser
		require.NoError(t, model.DB.Save(&user).Error)
		assert.Equal(t, channel.Id, selectedID(quote(fmt.Sprintf("%s-%d", token.Key, channel.Id))))
		user.Role = common.RoleCommonUser
		require.NoError(t, model.DB.Save(&user).Error)
		affinity := operation_setting.GetChannelAffinitySetting()
		savedAffinity := *affinity
		defer func() {
			_, err := service.ClearChannelAffinityCacheByRuleName("estimate01")
			require.NoError(t, err)
			*affinity = savedAffinity
		}()
		affinity.Enabled = true
		affinity.KeepOnChannelDisabled = false
		affinity.Rules = []operation_setting.ChannelAffinityRule{{Name: "estimate01", IncludeRuleName: true, ModelRegex: []string{"^estimate-chat$"}, KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Estimate-Session"}}, SessionMode: "prefer"}}
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		ctx.Request.Header.Set("X-Estimate-Session", "existing")
		_, _ = service.GetPreferredChannelByAffinity(ctx, "estimate-chat", "default")
		service.RecordChannelAffinity(ctx, channel.Id)
		beforeAffinity := service.GetChannelAffinityCacheStats()
		envelope["headers"] = http.Header{"X-Estimate-Session": {"existing"}}
		assert.Equal(t, channel.Id, selectedID(quote(token.Key)), "affinity precedes priority")
		cached, err := model.CacheGetChannel(channel.Id)
		require.NoError(t, err)
		assert.Zero(t, cached.ChannelInfo.MultiKeyPollingIndex)
		require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", channel.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
		model.InitChannelCache()
		assert.Equal(t, newChannel.Id, selectedID(quote(token.Key)), "stale affinity falls back without deletion")
		preferred, found := service.GetPreferredChannelByAffinity(ctx, "estimate-chat", "default")
		assert.True(t, found)
		assert.Equal(t, channel.Id, preferred)
		envelope["headers"] = http.Header{"X-Estimate-Session": {"new"}}
		assert.Equal(t, newChannel.Id, selectedID(quote(token.Key)))
		assert.Equal(t, beforeAffinity, service.GetChannelAffinityCacheStats(), "no new affinity on success or removal on stale binding")
		require.NoError(t, model.DB.Delete(&model.Channel{}, newChannel.Id).Error)
		require.NoError(t, model.DB.Where("channel_id = ?", newChannel.Id).Delete(&model.Ability{}).Error)
		model.InitChannelCache()
		assert.Equal(t, 503, quote(token.Key).Code, "deleted channel disappears after cache publication")
	})
}

func TestRequestEstimateGenericTaskPlugin(t *testing.T) {
	setupRequestEstimateDB(t)
	savedConfig := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(k, v string) error { savedConfig[k] = v; return nil }))
	savedPrices := ratio_setting.ModelPrice2JSONString()
	savedPluginRegistry := pluginruntime.DefaultRegistry
	t.Cleanup(func() {
		pluginruntime.DefaultRegistry = savedPluginRegistry
		require.NoError(t, config.GlobalConfig.LoadFromDB(savedConfig))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})

	registry := pluginruntime.NewRegistry()
	plugin, err := registry.Register(`
		export const meta = {
		  apiVersion: 1, key: "estimate-task", name: "Estimate task", version: "1.0.0",
		  author: {name: "Test"}, models: ["task-estimate-model"], fetchMode: "per_task",
		  usageSchema: {seconds: {type: "number", unit: "second"}}
		};
		export function buildSubmitRequest(ctx) {
		  if (ctx.upstreamModel !== "mapped-task-estimate-model") throw new Error("model was not mapped before validation");
		  if (ctx.apiKey !== "channel-secret-b") throw new Error("wrong estimated key");
		  if (ctx.originTasks !== undefined) throw new Error("unresolved origin tasks were exposed");
		  if (ctx.mediaInfo !== undefined) throw new Error("estimate media facts leaked into submit preparation");
		  return {url: ctx.baseUrl + "/submit", method: "POST", body: {model: ctx.model}};
		}
		export function extractUsage(ctx) {
		  if (ctx.mediaInfo) {
		    if (ctx.requestBody.media_reference !== "opaque-audio-reference") throw new Error("media facts changed the request body");
		    if (typeof ctx.mediaInfo[0].durationSeconds !== "number") throw new Error("audio duration was lost");
		    return {seconds: ctx.mediaInfo[0].durationSeconds};
		  }
		  return {seconds: ctx.requestBody.seconds === undefined ? 2 : ctx.requestBody.seconds};
		}
		export function parseSubmitResponse() { return {taskId: "unused"}; }
		export function buildQueryRequest() { return {}; }
		export function parseTaskResult() { return {status: "SUCCESS"}; }
	`, pluginruntime.Options{})
	require.NoError(t, err)
	pluginruntime.DefaultRegistry = registry

	variants, err := common.Marshal(map[string]string{billing_setting.PluginBillingExprKey(plugin.Meta.Key, "task-estimate-model"): `tier("base", u("seconds") * 0.2)`})
	require.NoError(t, err)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: string(variants)}))

	var providerCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(upstream.Close)
	user := model.User{Username: "task-estimate-user", Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "taskestimatekey", Status: common.TokenStatusExhausted, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(&token).Error)
	modelMapping := `{"task-estimate-model":"mapped-task-estimate-model"}`
	channel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "channel-secret-a\nchannel-secret-b", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "task-estimate-model", ModelMapping: &modelMapping, Group: "default", ChannelInfo: model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling, MultiKeyPollingIndex: 1}}
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "task-estimate-model", ChannelId: channel.Id, Enabled: true}).Error)
	model.InitChannelCache()

	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetRelayRouter(engine)
	SetTaskRouter(engine)
	SetTaskPluginProtocolRouter(engine)

	request := func(path, body string) *httptest.ResponseRecorder {
		payload, marshalErr := common.Marshal(map[string]any{"method": http.MethodPost, "path": path, "body": common.RawMessage(body)})
		require.NoError(t, marshalErr)
		response := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(payload))
		r.Header.Set("Authorization", "Bearer "+token.Key)
		r.Header.Set("Content-Type", "application/json")
		engine.ServeHTTP(response, r)
		return response
	}

	snapshot := func() map[string]string {
		return requestEstimateBusinessSnapshot(t)
	}
	before := snapshot()
	quote := request("/v1/tasks/"+plugin.Meta.Key, `{"model":"task-estimate-model","metadata":{"originTaskIds":["forged-task"]}}`)
	require.Equal(t, http.StatusOK, quote.Code, quote.Body.String())
	var result map[string]any
	require.NoError(t, common.Unmarshal(quote.Body.Bytes(), &result))
	assert.Equal(t, float64(200000), result["quota"])
	assert.Equal(t, "0.4", result["amount"])
	assert.Equal(t, plugin.Meta.Key, result["channel"].(map[string]any)["plugin"])
	assert.Zero(t, providerCalls.Load(), "a task estimate must never send the submit descriptor")
	assert.Equal(t, before, snapshot(), "estimate must not persist business state or advance key polling")

	for _, valid := range []struct {
		duration int
		quota    int
		amount   string
	}{{4, 400000, "0.8"}, {0, 0, "0"}} {
		mediaPayload, err := common.Marshal(map[string]any{
			"method": http.MethodPost, "path": "/v1/tasks/" + plugin.Meta.Key,
			"body":       common.RawMessage(`{"model":"task-estimate-model","media_reference":"opaque-audio-reference"}`),
			"media_info": []map[string]any{{"pointer": "/media_reference", "type": "audio", "duration_seconds": valid.duration}},
		})
		require.NoError(t, err)
		mediaRequest := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(mediaPayload))
		mediaRequest.Header.Set("Authorization", "Bearer "+token.Key)
		mediaRequest.Header.Set("Content-Type", "application/json")
		mediaQuote := httptest.NewRecorder()
		engine.ServeHTTP(mediaQuote, mediaRequest)
		require.Equal(t, http.StatusOK, mediaQuote.Code, mediaQuote.Body.String())
		var mediaResult map[string]any
		require.NoError(t, common.Unmarshal(mediaQuote.Body.Bytes(), &mediaResult))
		assert.EqualValues(t, valid.quota, mediaResult["quota"])
		assert.Equal(t, valid.amount, mediaResult["amount"], "request media facts must affect task pre-consume pricing")
		assert.Equal(t, before, snapshot(), "request media facts are estimate-local")
	}
	for _, tc := range []struct{ name, facts string }{
		{"multipart target on JSON", `[{"field":"nonexistent","index":999,"type":"audio","duration_seconds":4}]`},
		{"null duration", `[{"pointer":"/media_reference","type":"audio","duration_seconds":null}]`},
		{"missing target", `[{"pointer":"/missing","type":"audio","duration_seconds":4}]`},
		{"nonstring target", `[{"pointer":"/quantity","type":"audio","duration_seconds":4}]`},
		{"duplicate target", `[{"pointer":"/media_reference","type":"audio","duration_seconds":4},{"pointer":"/media_reference","type":"audio","duration_seconds":5}]`},
		{"oversized duration", `[{"pointer":"/media_reference","type":"audio","duration_seconds":3601}]`},
		{"negative duration", `[{"pointer":"/media_reference","type":"audio","duration_seconds":-1}]`},
		{"oversized width", `[{"pointer":"/media_reference","type":"image","width":32769,"height":1}]`},
		{"mixed units", `[{"pointer":"/media_reference","type":"audio","duration_seconds":4,"width":1}]`},
		{"forged origin context", `[{"pointer":"/media_reference","type":"audio","duration_seconds":4,"originTaskId":"forged-task"}]`},
		{"too many facts", `[` + strings.Repeat(`{"pointer":"/media_reference","type":"audio","duration_seconds":4},`, 64) + `{"pointer":"/media_reference","type":"audio","duration_seconds":4}]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			payload, err := common.Marshal(map[string]any{
				"method": http.MethodPost, "path": "/v1/tasks/" + plugin.Meta.Key,
				"body":       common.RawMessage(`{"model":"task-estimate-model","media_reference":"opaque-audio-reference","quantity":1}`),
				"media_info": common.RawMessage(tc.facts),
			})
			require.NoError(t, err)
			request := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(payload))
			request.Header.Set("Authorization", "Bearer "+token.Key)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.NotContains(t, response.Body.String(), `"amount"`)
			assert.NotContains(t, response.Body.String(), "channel-secret")
			assert.Equal(t, before, snapshot())
			assert.Zero(t, providerCalls.Load())
		})
	}

	legacyPlugin, err := registry.Register(`
		export const meta = {apiVersion:1,key:"estimate-legacy-task",name:"Estimate legacy task",version:"1.0.0",author:{name:"Test"},models:["legacy-task-model"],fetchMode:"per_task",usageSchema:{seconds:{type:"number",unit:"second"}}};
		export function buildSubmitRequest(ctx) { return {url:ctx.baseUrl+"/submit"}; }
		export function extractUsage(ctx) { return {seconds:ctx.requestBody.seconds === undefined ? 2 : ctx.requestBody.seconds}; }
		export function parseSubmitResponse() { return {taskId:"unused"}; }
		export function buildQueryRequest() { return {}; }
		export function parseTaskResult() { return {status:"SUCCESS"}; }
	`, pluginruntime.Options{})
	require.NoError(t, err)
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"legacy-task-model":0.01}`))
	legacyChannel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "legacy-secret", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "legacy-task-model", Group: "default"}
	legacyChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: legacyPlugin.Meta.Key})
	require.NoError(t, model.DB.Create(&legacyChannel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "legacy-task-model", ChannelId: legacyChannel.Id, Enabled: true}).Error)
	model.InitChannelCache()
	legacyQuote := request("/v1/tasks/"+legacyPlugin.Meta.Key, `{"model":"legacy-task-model"}`)
	require.Equal(t, http.StatusOK, legacyQuote.Code, legacyQuote.Body.String())
	var legacyResult map[string]any
	require.NoError(t, common.Unmarshal(legacyQuote.Body.Bytes(), &legacyResult))
	assert.Equal(t, float64(10000), legacyResult["quota"], "legacy per-call pricing applies validated usage ratios once")
	assert.Equal(t, "0.02", legacyResult["amount"])

	t.Run("request usage and billing multipliers", func(t *testing.T) {
		savedGroupRatio := ratio_setting.GroupRatio2JSONString()
		savedQuota := *operation_setting.GetQuotaSetting()
		t.Cleanup(func() {
			require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(savedGroupRatio))
			*operation_setting.GetQuotaSetting() = savedQuota
		})
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1.5}`))
		// This token-only multiplier must not alter task USD expressions or
		// multiply legacy per-call usage a second time.
		operation_setting.GetQuotaSetting().PreConsumeMultiplier = 7
		before := snapshot()
		for _, tc := range []struct {
			name, plugin, body, amount string
			quota                      int
		}{
			{"expression nondefault", plugin.Meta.Key, `{"model":"task-estimate-model","seconds":3}`, "0.9", 450000},
			{"expression upper bound", plugin.Meta.Key, `{"model":"task-estimate-model","seconds":3600}`, "1080", 540000000},
			{"expression zero", plugin.Meta.Key, `{"model":"task-estimate-model","seconds":0}`, "0", 0},
			{"legacy nondefault", legacyPlugin.Meta.Key, `{"model":"legacy-task-model","seconds":3}`, "0.045", 22500},
		} {
			t.Run(tc.name, func(t *testing.T) {
				response := request("/v1/tasks/"+tc.plugin, tc.body)
				require.Equal(t, http.StatusOK, response.Code, response.Body.String())
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				assert.EqualValues(t, tc.quota, result["quota"], "quote returns final nominal quota, including usage and group ratio once")
				assert.Equal(t, tc.amount, result["amount"], "task expressions use USD per task, without token normalization")
				assert.Equal(t, before, snapshot())
				assert.Zero(t, providerCalls.Load())
			})
		}
	})

	invalidPlugin, err := registry.Register(`
		export const meta = {apiVersion:1,key:"estimate-invalid-usage",name:"Estimate invalid usage",version:"1.0.0",author:{name:"Test"},models:["invalid-usage-model"],fetchMode:"per_task",usageSchema:{seconds:{type:"number",unit:"second"}}};
		export function buildSubmitRequest(ctx) { return {url:ctx.baseUrl+"/submit"}; }
		export function extractUsage() { return {seconds:3601}; }
		export function parseSubmitResponse() { return {taskId:"unused"}; }
		export function buildQueryRequest() { return {}; }
		export function parseTaskResult() { return {status:"SUCCESS"}; }
	`, pluginruntime.Options{})
	require.NoError(t, err)
	invalidChannel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "invalid-secret", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "invalid-usage-model", Group: "default"}
	invalidChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: invalidPlugin.Meta.Key})
	require.NoError(t, model.DB.Create(&invalidChannel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "invalid-usage-model", ChannelId: invalidChannel.Id, Enabled: true}).Error)
	model.InitChannelCache()
	invalidQuote := request("/v1/tasks/"+invalidPlugin.Meta.Key, `{"model":"invalid-usage-model"}`)
	assert.Equal(t, http.StatusBadRequest, invalidQuote.Code, invalidQuote.Body.String())

	fetchTrap := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { providerCalls.Add(1) }))
	t.Cleanup(fetchTrap.Close)
	fetchPlugin, err := registry.Register(`
		export const meta = {
		  apiVersion: 1, key: "estimate-fetch-task", name: "Estimate fetch task", version: "1.0.0",
		  author: {name: "Test"}, models: ["fetch-model"], fetchMode: "per_task",
		  usageSchema: {seconds: {type: "number", unit: "second"}}
		};
		export function buildSubmitRequest(ctx) {
		  utils.fetch({url:ctx.baseUrl+ctx.requestBody.target, method:ctx.requestBody.method});
		  return {url:ctx.baseUrl+"/submit"};
		}
		export function extractUsage() { return {seconds: 1}; }
		export function parseSubmitResponse() { return {taskId: "unused"}; }
		export function buildQueryRequest() { return {}; }
		export function parseTaskResult() { return {status: "SUCCESS"}; }
	`, pluginruntime.Options{})
	require.NoError(t, err)
	fetchChannel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "fetch-secret", BaseURL: &fetchTrap.URL, Status: common.ChannelStatusEnabled, Models: "fetch-model", Group: "default"}
	fetchChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: fetchPlugin.Meta.Key})
	require.NoError(t, model.DB.Create(&fetchChannel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "fetch-model", ChannelId: fetchChannel.Id, Enabled: true}).Error)
	model.InitChannelCache()
	beforeFetch := snapshot()
	fetchVariants, err := common.Marshal(map[string]string{billing_setting.PluginBillingExprKey(fetchPlugin.Meta.Key, "fetch-model"): `tier("base", u("seconds") * 0.2)`})
	require.NoError(t, err)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: string(fetchVariants)}))
	for _, target := range []struct{ method, path string }{
		{http.MethodGet, "/inference"},
		{http.MethodGet, "/metadata"},
		{http.MethodHead, "/metadata"},
		{http.MethodPost, "/files/upload"},
		{http.MethodPost, "/generate"},
		{http.MethodPost, "/tasks/submit"},
		{http.MethodPost, "/resources/create"},
	} {
		t.Run(target.method+" "+target.path, func(t *testing.T) {
			body, err := common.Marshal(map[string]string{"model": "fetch-model", "method": target.method, "target": target.path})
			require.NoError(t, err)
			fetchQuote := request("/v1/tasks/"+fetchPlugin.Meta.Key, string(body))
			assert.Equal(t, http.StatusBadRequest, fetchQuote.Code, fetchQuote.Body.String())
			assert.NotContains(t, fetchQuote.Body.String(), `"amount"`)
			assert.Equal(t, beforeFetch, snapshot(), "failed preparation must not persist business state")
			assert.Zero(t, providerCalls.Load(), "HTTP method and matching upstream host do not authorize plugin network access")
			assert.NotContains(t, fetchQuote.Body.String(), "channel-secret")
			assert.NotContains(t, fetchQuote.Body.String(), "fetch-secret")
		})
	}
}

func TestRequestEstimateNativeAndHostProtocolRoutes(t *testing.T) {
	setupRequestEstimateDB(t)
	savedConfig := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(k, v string) error { savedConfig[k] = v; return nil }))
	savedPrices := ratio_setting.ModelPrice2JSONString()
	savedRegistry := pluginruntime.DefaultRegistry
	savedGroup := ratio_setting.GroupRatio2JSONString()
	savedGroupGroup := ratio_setting.GroupGroupRatio2JSONString()
	savedMemory, savedQuotaUnit := common.MemoryCacheEnabled, common.QuotaPerUnit
	common.MemoryCacheEnabled, common.QuotaPerUnit = true, 500000
	t.Cleanup(func() {
		common.MemoryCacheEnabled, common.QuotaPerUnit = savedMemory, savedQuotaUnit
		pluginruntime.DefaultRegistry = savedRegistry
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(savedGroup))
		require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(savedGroupGroup))
		require.NoError(t, config.GlobalConfig.LoadFromDB(savedConfig))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	require.NoError(t, ratio_setting.UpdateGroupGroupRatioByJSONString(`{}`))

	registry := pluginruntime.NewRegistry()
	var publishDuringHook func()
	source := `
		export const meta = {
		  apiVersion: 1, key: "estimate-dynamic-routes", name: "Estimate dynamic routes", version: "1.0.0",
		  author: {name: "Test"}, models: ["dynamic-route-model"], fetchMode: "per_task",
		  usageSchema: {seconds: {type: "number", unit: "second", description: {en: "Video generation unit price", zh: "视频生成单价"}}},
		  routes: [
		    {method: "POST", path: "/estimate-native/jobs/:task_id", type: "submit", action: "create", decode: "decodeNative", render: "renderNative"},
		    {method: "PUT", path: "/estimate-native/jobs/:task_id", type: "submit", action: "create", decode: "decodeNative", render: "renderNative"},
		    {method: "GET", path: "/estimate-native/jobs/:task_id", type: "query", render: "renderNative"}
		  ],
		  protocols: [{name: "openai_responses", supports: ["stream", "sync", "background"]}, "openai_image", "openai_video"]
		};
		export const native = {
		  decodeNative(ctx) {
		    console.log("generation-checkpoint");
		    if (ctx.path !== "/estimate-native/jobs/task-7" || ctx.params.task_id !== "task-7" || ctx.query.action[0] !== "extend" || !["POST", "PUT"].includes(ctx.method)) throw new Error("native request context was not preserved");
		    if (ctx.body.kind === "multipart") return {kind:"submit", model:ctx.body.fields.model[0], action:"extend", requestBody:{file:ctx.body.files[1].ref}};
		    const intent = {kind: "submit", model: ctx.body.value.model, action: ctx.query.action[0], requestBody: {seconds: ctx.body.value.seconds}};
		    if (ctx.body.value.originTaskIds) {
		      intent.originTaskIds = ctx.body.value.originTaskIds;
		      intent.requestBody.requiresOrigin = true;
		    }
		    return intent;
		  },
		  renderNative(ctx, task) { return task; }
		};
		export const protocols = {
		  openai_image: {decodeRequest: decodeHost, render() { throw new Error("estimate called image presenter"); }},
		  openai_video: {decodeRequest: decodeHost, render() { throw new Error("estimate called video presenter"); }},
		  openai_responses: {decodeRequest: decodeHost, renderEvents() { throw new Error("estimate started streaming"); }, renderFinal() { throw new Error("estimate called Responses presenter"); }}
		};
		function decodeHost(ctx) {
		  console.log("generation-checkpoint");
		  if (ctx.body.value.ordinaryOnly) throw new Error("ordinary relay request entered plugin decoder");
		  return {kind: "submit", model: ctx.model, action: ctx.body.value.action, requestBody: {seconds: ctx.body.value.seconds}};
		}
		export function buildSubmitRequest(ctx) {
		  console.log("generation-checkpoint");
		  if (ctx.mediaInfo !== undefined) throw new Error("media facts leaked to submit preparation");
		  if (ctx.requestHeaders["X-Estimate-Protocol"] !== "test-v1") throw new Error("protocol header was not preserved");
		  if (!ctx.requestBody.model && ctx.requestBody.seconds && ctx.action !== "extend") throw new Error("decoded submit action was not preserved");
		  if (ctx.requestBody.requiresOrigin && (!ctx.originTasks || ctx.originTasks[0].upstreamTaskId !== "private-origin-id")) throw new Error("origin task was not resolved");
		  if (ctx.requestBody.requiresOrigin && ctx.originTasks[0].status !== "SUCCESS") throw new Error("extend requires a successful origin task");
		  return {url: ctx.baseUrl + "/submit", method: "POST", body: ctx.requestBody};
		}
		export function extractUsage(ctx) {
		  if (ctx.requestBody.requiresOrigin) return {seconds:ctx.originTasks[0].data.seconds};
		  if (ctx.requestBody.file) {
		    if (ctx.requestBody.file !== "request_file:audio#1" || ctx.mediaInfo[0].field !== "audio" || ctx.mediaInfo[0].index !== 1) throw new Error("file binding was lost");
		    return {seconds: ctx.mediaInfo[0].durationSeconds};
		  }
		  if (ctx.upstreamModel === "dynamic-route-mapped") return {seconds: ctx.requestBody.seconds * 2};
		  return {seconds: ctx.requestBody.seconds};
		}
		export function listArtifacts() { throw new Error("estimate listed artifacts"); }
		export function buildContentRequest() { throw new Error("estimate downloaded content"); }
		export function parseSubmitResponse() { throw new Error("estimate submitted upstream"); }
		export function buildQueryRequest() { throw new Error("estimate started polling"); }
		export function parseTaskResult() { throw new Error("estimate polled upstream"); }
	`
	plugin, err := registry.Register(source, pluginruntime.Options{Log: func(message string) {
		if strings.Contains(message, "generation-checkpoint") && publishDuringHook != nil {
			publish := publishDuringHook
			publishDuringHook = nil
			publish()
		}
	}})
	require.NoError(t, err)
	require.NoError(t, registry.ReplaceOverrides(nil))
	pluginruntime.DefaultRegistry = registry
	variants, err := common.Marshal(map[string]string{billing_setting.PluginBillingExprKey(plugin.Meta.Key, "dynamic-route-model"): `tier("base", u("seconds") * 0.2)`})
	require.NoError(t, err)
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: string(variants)}))

	var providerCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(upstream.Close)
	user := model.User{Username: "estimate-dynamic-user", Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "dynamicroutetoken", Status: common.TokenStatusExhausted, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(&token).Error)
	channel := model.Channel{Type: constant.ChannelTypeTaskPlugin, Key: "dynamic-route-secret", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "dynamic-route-model", Group: "default"}
	channel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
	require.NoError(t, model.DB.Create(&channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "dynamic-route-model", ChannelId: channel.Id, Enabled: true}).Error)
	model.InitChannelCache()

	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetRelayRouter(engine)
	SetTaskRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	engine.NoRoute(SetPluginRouter(engine))
	require.NoError(t, registry.ReplaceOverrides([]*pluginruntime.LoadedPlugin{plugin}))
	quoteMethodWithBody := func(method, path, body string) *httptest.ResponseRecorder {
		before := requestEstimateBusinessSnapshot(t)
		payload, marshalErr := common.Marshal(map[string]any{"method": method, "path": path, "headers": http.Header{"X-Estimate-Protocol": {"test-v1"}}, "body": common.RawMessage(body)})
		require.NoError(t, marshalErr)
		request := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(payload))
		request.Header.Set("Authorization", "Bearer "+token.Key)
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, request)
		assert.Equal(t, before, requestEstimateBusinessSnapshot(t))
		for _, secret := range []string{"dynamic-route-secret", "ordinary-secret", upstream.URL, "private-origin-id"} {
			assert.NotContains(t, response.Body.String(), secret)
		}
		return response
	}
	quoteWithBody := func(path, body string) *httptest.ResponseRecorder {
		return quoteMethodWithBody(http.MethodPost, path, body)
	}
	quote := func(path string) *httptest.ResponseRecorder {
		return quoteWithBody(path, `{"model":"dynamic-route-model","seconds":2,"action":"extend"}`)
	}
	t.Run("shared host model follows published channel selection", func(t *testing.T) {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"billing_setting.billing_mode": `{"dynamic-route-model":"tiered_expr"}`,
			"billing_setting.billing_expr": `{"dynamic-route-model":"tier(\"request\", fixed(0.03))"}`,
		}))
		priority := int64(10)
		ordinary := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "ordinary-secret", BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "dynamic-route-model", Group: "default", Priority: &priority}
		require.NoError(t, ordinary.Insert())
		model.InitChannelCache()
		for _, enabled := range []bool{true, false, true} {
			ordinary.Status = common.ChannelStatusManuallyDisabled
			if enabled {
				ordinary.Status = common.ChannelStatusEnabled
			}
			require.NoError(t, ordinary.Update())
			model.InitChannelCache()
			for _, path := range []string{"/v1/responses", "/v1/images/generations"} {
				response := quoteWithBody(path, fmt.Sprintf(`{"model":"dynamic-route-model","seconds":2,"action":"extend","input":"test","prompt":"test","n":1,"ordinaryOnly":%t}`, enabled))
				require.Equal(t, http.StatusOK, response.Code, response.Body.String())
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				selected := result["channel"].(map[string]any)
				if enabled {
					assert.EqualValues(t, ordinary.Id, selected["id"])
					assert.NotContains(t, selected, "plugin")
					assert.Equal(t, "0.03", result["amount"])
					assert.EqualValues(t, 15000, result["quota"])
				} else {
					assert.EqualValues(t, channel.Id, selected["id"])
					assert.Equal(t, plugin.Meta.Key, selected["plugin"])
					assert.Equal(t, "0.4", result["amount"])
					assert.EqualValues(t, 200000, result["quota"])
				}
			}
		}
		require.NoError(t, ordinary.Delete())
		model.InitChannelCache()
		response := quote("/v1/responses")
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		var result map[string]any
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.EqualValues(t, channel.Id, result["channel"].(map[string]any)["id"])
		assert.Equal(t, "0.4", result["amount"])
	})
	for _, target := range []string{
		"/v1/tasks/estimate-dynamic-routes",
		"/estimate-native/jobs/task-7?action=extend",
		"/v1/images/generations",
		"/v1/images/edits",
		"/v1/videos",
		"/v1/responses",
	} {
		response := quote(target)
		require.Equal(t, http.StatusOK, response.Code, target+": "+response.Body.String())
		var result map[string]any
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.Equal(t, float64(200000), result["quota"])
		assert.Equal(t, "0.4", result["amount"])
		assert.Equal(t, plugin.Meta.Key, result["channel"].(map[string]any)["plugin"])
	}
	streamingResponse := quoteWithBody("/v1/responses", `{"model":"dynamic-route-model","seconds":2,"action":"extend","stream":true}`)
	require.Equal(t, http.StatusOK, streamingResponse.Code, streamingResponse.Body.String())
	assert.Equal(t, "application/json; charset=utf-8", streamingResponse.Header().Get("Content-Type"))
	var streamingResult map[string]any
	require.NoError(t, common.Unmarshal(streamingResponse.Body.Bytes(), &streamingResult))
	assert.Equal(t, float64(200000), streamingResult["quota"])
	backgroundResponse := quoteWithBody("/v1/responses", `{"model":"dynamic-route-model","seconds":2,"action":"extend","background":true}`)
	require.Equal(t, http.StatusOK, backgroundResponse.Code, backgroundResponse.Body.String())
	var backgroundResult map[string]any
	require.NoError(t, common.Unmarshal(backgroundResponse.Body.Bytes(), &backgroundResult))
	assert.Equal(t, "0.4", backgroundResult["amount"])
	assert.EqualValues(t, 200000, backgroundResult["quota"])
	putQuote := quoteMethodWithBody(http.MethodPut, "/estimate-native/jobs/task-7?action=extend", `{"model":"dynamic-route-model","seconds":2}`)
	require.Equal(t, http.StatusOK, putQuote.Code, putQuote.Body.String())
	t.Run("multipart facts bind to the actual repeated file", func(t *testing.T) {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		require.NoError(t, writer.WriteField("model", "dynamic-route-model"))
		for _, filename := range []string{"first.wav", "second.wav"} {
			file, err := writer.CreateFormFile("audio", filename)
			require.NoError(t, err)
			_, err = file.Write([]byte("opaque-media"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		for _, scenario := range []struct {
			field  string
			index  int
			status int
		}{{"audio", 1, 200}, {"missing", 1, 400}, {"audio", 2, 400}, {"model", 0, 400}} {
			before := requestEstimateBusinessSnapshot(t)
			payload, err := common.Marshal(map[string]any{
				"method": http.MethodPost, "path": "/estimate-native/jobs/task-7?action=extend",
				"headers": http.Header{"Content-Type": {writer.FormDataContentType()}, "X-Estimate-Protocol": {"test-v1"}}, "body_base64": base64.StdEncoding.EncodeToString(body.Bytes()),
				"media_info": []map[string]any{{"field": scenario.field, "index": scenario.index, "type": "audio", "duration_seconds": 4}},
			})
			require.NoError(t, err)
			request := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(payload))
			request.Header.Set("Authorization", "Bearer "+token.Key)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			require.Equal(t, scenario.status, response.Code, response.Body.String())
			if scenario.status == 200 {
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				assert.Equal(t, "0.8", result["amount"])
				assert.EqualValues(t, 400000, result["quota"])
			} else {
				assert.NotContains(t, response.Body.String(), `"amount"`)
			}
			assert.Equal(t, before, requestEstimateBusinessSnapshot(t))
		}
	})
	t.Run("native origin task ownership platform and channel are enforced", func(t *testing.T) {
		for _, scenario := range []struct {
			id           string
			userID       int
			platform     constant.TaskPlatform
			originStatus model.TaskStatus
			status       int
		}{
			{"owned-origin", user.Id, constant.TaskPlatform(plugin.Meta.Key), model.TaskStatusSuccess, 200},
			{"foreign-origin", user.Id + 1, constant.TaskPlatform(plugin.Meta.Key), model.TaskStatusSuccess, 400},
			{"wrong-platform", user.Id, constant.TaskPlatform("other-plugin"), model.TaskStatusSuccess, 400},
			{"pending-origin", user.Id, constant.TaskPlatform(plugin.Meta.Key), model.TaskStatusInProgress, 400},
		} {
			origin := model.Task{TaskID: scenario.id, UserId: scenario.userID, ChannelId: channel.Id, Platform: scenario.platform, Status: scenario.originStatus, Data: common.RawMessage(`{"seconds":4}`), PrivateData: model.TaskPrivateData{UpstreamTaskID: "private-origin-id"}}
			require.NoError(t, model.DB.Create(&origin).Error)
			response := quoteWithBody("/estimate-native/jobs/task-7?action=extend", fmt.Sprintf(`{"model":"dynamic-route-model","seconds":2,"originTaskIds":[%q]}`, scenario.id))
			require.Equal(t, scenario.status, response.Code, response.Body.String())
			assert.NotContains(t, response.Body.String(), "private-origin-id")
			if scenario.status == 200 {
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				assert.Equal(t, "0.8", result["amount"], "the hook receives the resolved origin pricing context instead of the requested two seconds")
				assert.EqualValues(t, 400000, result["quota"])
				assert.EqualValues(t, channel.Id, result["channel"].(map[string]any)["id"])
			} else {
				assert.NotContains(t, response.Body.String(), `"amount"`)
			}
		}
		missing := quoteWithBody("/estimate-native/jobs/task-7?action=extend", `{"model":"dynamic-route-model","seconds":2,"originTaskIds":["missing-origin"],"metadata":{"originTasks":[{"status":"SUCCESS","data":{"seconds":4}}]}}`)
		assert.Equal(t, http.StatusBadRequest, missing.Code, missing.Body.String())
		assert.NotContains(t, missing.Body.String(), `"amount"`)
		require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusManuallyDisabled).Error)
		model.InitChannelCache()
		disabled := quoteWithBody("/estimate-native/jobs/task-7?action=extend", `{"model":"dynamic-route-model","seconds":2,"originTaskIds":["owned-origin"]}`)
		assert.Equal(t, http.StatusBadRequest, disabled.Code, disabled.Body.String())
		require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusEnabled).Error)
		model.InitChannelCache()
	})
	// Different decoder and usage changes make a mixed generation observable:
	// v1 is 2 * $0.2 = $0.4; v2 is (2 + 1) * 3 * $0.2 = $1.8.
	replacement, err := pluginruntime.CompilePlugin(strings.NewReplacer(
		`version: "1.0.0"`, `version: "2.0.0"`,
		`seconds: ctx.body.value.seconds`, `seconds: ctx.body.value.seconds + 1`,
		`seconds: ctx.requestBody.seconds`, `seconds: ctx.requestBody.seconds * 3`,
	).Replace(source), pluginruntime.Options{})
	require.NoError(t, err)
	t.Run("target matching and preparation share one generation", func(t *testing.T) {
		// The resolver is an existing middleware dependency. Publish after its
		// real lookup to deterministically exercise the match/prepare boundary.
		outer := engine
		engine = gin.New()
		t.Cleanup(func() { engine = outer })
		engine.POST("/v1/requests/estimate", middleware.EstimateTokenAuth(), middleware.EstimateTarget(
			func(method, path string, generation *pluginruntime.RoutingGeneration) (types.RelayFormat, bool) {
				format, supported := resolveRequestEstimateRoute(method, path, generation)
				require.NoError(t, registry.ReplaceOverrides(nil))
				return format, supported
			}), middleware.RouteTaskPluginEndpoint(), middleware.PrepareTaskPluginEndpoint(), middleware.PrepareRequestEstimateNativeRoute(), middleware.DistributeForEstimate(), func(c *gin.Context) {
			format := c.MustGet("estimate_relay_format").(types.RelayFormat)
			controller.RequestEstimate(c, format)
		})
		for _, path := range []string{"/estimate-native/jobs/task-7?action=extend", "/v1/tasks/estimate-dynamic-routes", "/v1/responses", "/v1/videos"} {
			require.NoError(t, registry.ReplaceOverrides([]*pluginruntime.LoadedPlugin{plugin}))
			response := quote(path)
			require.Equal(t, http.StatusOK, response.Code, path+": "+response.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, "0.4", result["amount"])
			assert.EqualValues(t, 200000, result["quota"])
		}
	})
	t.Run("publication inside a real hook never mixes generations", func(t *testing.T) {
		for _, path := range []string{"/estimate-native/jobs/task-7?action=extend", "/v1/responses", "/v1/images/generations", "/v1/videos", "/v1/tasks/estimate-dynamic-routes"} {
			require.NoError(t, registry.ReplaceOverrides([]*pluginruntime.LoadedPlugin{plugin}))
			var publishErr error
			publishDuringHook = func() { publishErr = registry.ReplaceOverrides([]*pluginruntime.LoadedPlugin{replacement}) }
			first := quote(path)
			require.Nil(t, publishDuringHook, "the real JS hook must trigger publication")
			require.NoError(t, publishErr)
			for i, response := range []*httptest.ResponseRecorder{first, quote(path)} {
				require.Equal(t, http.StatusOK, response.Code, path+": "+response.Body.String())
				var result map[string]any
				require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
				amount, quota := "0.4", 200000
				if i == 1 {
					amount, quota = "1.8", 900000
					if path == "/v1/tasks/estimate-dynamic-routes" {
						// Generic requests are already normalized and have no decoder.
						amount, quota = "1.2", 600000
					}
				}
				assert.Equal(t, amount, result["amount"], path)
				assert.EqualValues(t, quota, result["quota"], path)
				assert.EqualValues(t, channel.Id, result["channel"].(map[string]any)["id"])
			}
		}
	})
	t.Run("uninstall and reinstall apply to the next request", func(t *testing.T) {
		require.NoError(t, registry.ReplaceOverrides(nil))
		for _, path := range []string{"/estimate-native/jobs/task-7?action=extend", "/v1/tasks/estimate-dynamic-routes", "/v1/responses", "/v1/images/generations", "/v1/videos"} {
			removed := quote(path)
			assert.NotEqual(t, http.StatusOK, removed.Code, path+": "+removed.Body.String())
			assert.NotContains(t, removed.Body.String(), `"amount"`)
		}
		require.NoError(t, registry.ReplaceOverrides([]*pluginruntime.LoadedPlugin{plugin}))
		for _, path := range []string{"/estimate-native/jobs/task-7?action=extend", "/v1/tasks/estimate-dynamic-routes", "/v1/responses", "/v1/images/generations", "/v1/videos"} {
			response := quote(path)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, "0.4", result["amount"])
			assert.EqualValues(t, 200000, result["quota"])
		}
	})
	t.Run("published channel configuration is used without restarting routes", func(t *testing.T) {
		mapping := `{"dynamic-route-model":"dynamic-route-mapped"}`
		channel.ModelMapping = &mapping
		require.NoError(t, channel.Update())
		model.InitChannelCache()
		for _, path := range []string{"/estimate-native/jobs/task-7?action=extend", "/v1/tasks/estimate-dynamic-routes", "/v1/responses"} {
			response := quote(path)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, "0.8", result["amount"])
			assert.EqualValues(t, 400000, result["quota"])
			assert.Equal(t, "dynamic-route-model", result["model"])
		}
		channel.SetSetting(dto.ChannelSettings{TaskPluginKey: "unrelated-plugin"})
		require.NoError(t, channel.Update())
		model.InitChannelCache()
		unbound := quote("/estimate-native/jobs/task-7?action=extend")
		assert.Equal(t, http.StatusServiceUnavailable, unbound.Code, unbound.Body.String())
		assert.NotContains(t, unbound.Body.String(), `"amount"`)
		require.NoError(t, channel.Delete())
		model.InitChannelCache()
		deleted := quote("/v1/tasks/estimate-dynamic-routes")
		assert.Equal(t, http.StatusServiceUnavailable, deleted.Code, deleted.Body.String())
		assert.NotContains(t, deleted.Body.String(), `"amount"`)
		channel.Id, channel.ModelMapping = 0, nil
		channel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
		require.NoError(t, channel.Insert())
		model.InitChannelCache()
		response := quote("/v1/responses")
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		var result map[string]any
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.EqualValues(t, channel.Id, result["channel"].(map[string]any)["id"])
		assert.Equal(t, "0.4", result["amount"])
	})
	t.Run("only submit operations are quotable and the estimate namespace is reserved", func(t *testing.T) {
		for _, target := range []struct{ method, path string }{
			{http.MethodGet, "/estimate-native/jobs/task-7"},
			{http.MethodPost, "/estimate-native/callback"},
			{http.MethodPost, "/estimate-native/upload"},
			{http.MethodGet, "/v1/responses/response-7"},
			{http.MethodGet, "/v1/videos/task-7"},
			{http.MethodGet, "/v1/videos/task-7/content"},
			{http.MethodHead, "/v1/videos/task-7/content"},
		} {
			response := quoteMethodWithBody(target.method, target.path, `{"model":"dynamic-route-model"}`)
			assert.Equal(t, http.StatusUnprocessableEntity, response.Code, response.Body.String())
			assert.NotContains(t, response.Body.String(), `"amount"`)
		}
		_, err := registry.Register(strings.NewReplacer(
			`key: "estimate-dynamic-routes"`, `key: "estimate-namespace-conflict"`,
			`/estimate-native/jobs/:task_id`, `/v1/requests/estimate`,
		).Replace(source), pluginruntime.Options{})
		require.Error(t, err, "a plugin cannot claim the host estimate endpoint")
		response := quote("/estimate-native/jobs/task-7?action=extend")
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	})
	assert.Zero(t, providerCalls.Load(), "estimate must not submit to the provider")
}

func TestRequestEstimateBuiltInPluginUsageHooks(t *testing.T) {
	setupRequestEstimateDB(t)
	savedConfig := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(k, v string) error { savedConfig[k] = v; return nil }))
	savedPrices := ratio_setting.ModelPrice2JSONString()
	savedRatios := ratio_setting.ModelRatio2JSONString()
	savedRegistry := pluginruntime.DefaultRegistry
	t.Cleanup(func() {
		pluginruntime.DefaultRegistry = savedRegistry
		require.NoError(t, config.GlobalConfig.LoadFromDB(savedConfig))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(savedPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatios))
	})

	cases := []struct {
		pluginKey string
		model     string
		body      string
		usageKey  string
		price     string
		amount    string
	}{
		{"alibaba", "wan2.7-t2v", `{"model":"wan2.7-t2v","input":"a cinematic landscape","seconds":5,"resolution":"720P"}`, "seconds", "0.001", "0.005"},
		{"doubao", "doubao-seedance-1-0-pro-250528", `{"model":"doubao-seedance-1-0-pro-250528","input":"a cinematic landscape","seconds":5,"resolution":"720p"}`, "tokens", "0.000001", "0.108"},
		{"google", "veo-3.0-generate-001", `{"model":"veo-3.0-generate-001","input":"a cinematic landscape","seconds":5}`, "seconds", "0.001", "0.005"},
		{"vertex-ai", "veo-3.0-generate-001", `{"model":"veo-3.0-generate-001","input":"a cinematic landscape","seconds":5}`, "seconds", "0.001", "0.005"},
		{"hailuo", "MiniMax-Hailuo-2.3", `{"model":"MiniMax-Hailuo-2.3","input":"a cinematic landscape","seconds":6}`, "seconds", "0.001", "0.006"},
		{"jimeng", "jimeng_vgfm_t2v_l20", `{"model":"jimeng_vgfm_t2v_l20","input":"a cinematic landscape","seconds":5}`, "seconds", "0.001", "0.005"},
		{"kling", "kling-v2-5-turbo", `{"model":"kling-v2-5-turbo","input":"a cinematic landscape","seconds":5}`, "units", "0.001", "0.0015"},
		{"sora", "sora-2", `{"model":"sora-2","input":"a cinematic landscape","seconds":4,"size":"720x1280"}`, "seconds", "0.001", "0.004"},
		{"sunoapi", "suno_music", `{"model":"suno_music","input":"a cinematic soundtrack"}`, "clips", "0.001", "0.002"},
		{"vidu", "viduq2", `{"model":"viduq2","input":"a cinematic landscape","seconds":5,"size":"720p"}`, "duration", "0.001", "0.005"},
		{"xai", "grok-imagine-video", `{"model":"grok-imagine-video","input":"a cinematic landscape","seconds":8,"resolution":"480p"}`, "seconds", "0.001", "0.008"},
	}

	var providerCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		providerCalls.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(upstream.Close)
	user := model.User{Username: "estimate-builtin-user", Status: common.UserStatusEnabled, Group: "default", Quota: 0}
	require.NoError(t, model.DB.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "estimatebuiltintoken", Status: common.TokenStatusExhausted, ExpiredTime: -1}
	require.NoError(t, model.DB.Create(&token).Error)
	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetRelayRouter(engine)
	SetTaskRouter(engine)
	SetTaskPluginProtocolRouter(engine)

	for _, tc := range cases {
		t.Run(tc.pluginKey, func(t *testing.T) {
			source, err := builtinplugins.Source(tc.pluginKey)
			require.NoError(t, err)
			registry := pluginruntime.NewRegistry()
			plugin, err := registry.RegisterFactory(source, pluginruntime.Options{Key: tc.pluginKey})
			require.NoError(t, err)
			require.NoError(t, registry.ReplaceOverrides(nil))
			pluginruntime.DefaultRegistry = registry

			billingExpressions := map[string]string{
				billing_setting.PluginBillingExprKey(tc.pluginKey, tc.model): `tier("base", u("` + tc.usageKey + `") * ` + tc.price + `)`,
			}
			if tc.pluginKey == "alibaba" {
				billingExpressions[billing_setting.PluginBillingExprKey(tc.pluginKey, "wan2.7-image")] = `tier("base", u("image_count") * 0.001)`
			}
			variants, err := common.Marshal(billingExpressions)
			require.NoError(t, err)
			require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: string(variants)}))

			channelType, channelKey := constant.ChannelTypeTaskPlugin, "builtin-estimate-secret"
			if tc.pluginKey == "vertex-ai" {
				channelType, channelKey = constant.ChannelTypeNewAPI, "sk-estimate-gateway"
			}
			if tc.pluginKey == "jimeng" {
				channelKey = "jimeng-ak|jimeng-sk"
			}
			channel := model.Channel{Type: channelType, Key: channelKey, BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: tc.model, Group: "default"}
			channel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
			require.NoError(t, model.DB.Create(&channel).Error)
			require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: tc.model, ChannelId: channel.Id, Enabled: true}).Error)
			channels := map[string]int{tc.model: channel.Id}
			if tc.pluginKey == "alibaba" {
				imageChannel := model.Channel{Type: channelType, Key: channelKey, BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: "wan2.7-image", Group: "default"}
				imageChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
				require.NoError(t, model.DB.Create(&imageChannel).Error)
				require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "wan2.7-image", ChannelId: imageChannel.Id, Enabled: true}).Error)
				channels["wan2.7-image"] = imageChannel.Id
			}
			model.InitChannelCache()

			quote := func(path, body string) *httptest.ResponseRecorder {
				before := requestEstimateBusinessSnapshot(t)
				payload, marshalErr := common.Marshal(map[string]any{"method": http.MethodPost, "path": path, "body": common.RawMessage(body)})
				require.NoError(t, marshalErr)
				request := httptest.NewRequest(http.MethodPost, "/v1/requests/estimate", bytes.NewReader(payload))
				request.Header.Set("Authorization", "Bearer "+token.Key)
				request.Header.Set("Content-Type", "application/json")
				response := httptest.NewRecorder()
				engine.ServeHTTP(response, request)
				assert.Equal(t, before, requestEstimateBusinessSnapshot(t), "built-in estimate preserves business state")
				return response
			}
			response := quote("/v1/responses", tc.body)
			require.Equal(t, http.StatusOK, response.Code, response.Body.String())
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, tc.amount, result["amount"])
			assert.Equal(t, plugin.Meta.Key, result["channel"].(map[string]any)["plugin"])
			assert.Zero(t, providerCalls.Load(), "built-in plugin estimate must not send the submit descriptor")
			if tc.pluginKey == "vertex-ai" {
				t.Run("OAuth cold cache failure and gateway bypass", func(t *testing.T) {
					client, err := service.GetHttpClientWithProxy("")
					require.NoError(t, err)
					originalTransport := client.Transport
					defer func() { client.Transport = originalTransport }()
					var exchanges, unexpectedRequests atomic.Int32
					var failExchange atomic.Bool
					oauth := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
						exchanges.Add(1)
						assert.Equal(t, "/oauth2/v4/token", request.URL.Path)
						assert.Equal(t, http.MethodPost, request.Method)
						if !assert.NoError(t, request.ParseForm()) {
							w.WriteHeader(http.StatusBadRequest)
							return
						}
						assert.Equal(t, "urn:ietf:params:oauth:grant-type:jwt-bearer", request.Form.Get("grant_type"))
						assert.NotEmpty(t, request.Form.Get("assertion"))
						w.Header().Set("Content-Type", "application/json")
						if failExchange.Load() {
							w.WriteHeader(http.StatusBadRequest)
							_, _ = io.WriteString(w, `{"error":"estimate-oauth-error-secret"}`)
							return
						}
						_, _ = io.WriteString(w, `{"access_token":"estimate-oauth-token-secret","expires_in":3600}`)
					}))
					t.Cleanup(oauth.Close)
					oauthURL, err := url.Parse(oauth.URL)
					require.NoError(t, err)
					client.Transport = requestEstimateTransport(func(request *http.Request) (*http.Response, error) {
						if request.URL.String() != "https://www.googleapis.com/oauth2/v4/token" {
							unexpectedRequests.Add(1)
							return nil, fmt.Errorf("unexpected estimate network request")
						}
						// Keep the real exchange encoding and response parsing; only
						// route the fixed credential recipient to the local TLS server.
						local := request.Clone(request.Context())
						local.URL.Scheme, local.URL.Host = oauthURL.Scheme, oauthURL.Host
						local.Host = oauthURL.Host
						return oauth.Client().Transport.RoundTrip(local)
					})
					var logs bytes.Buffer
					common.LogWriterMu.Lock()
					originalWriter, originalErrorWriter := gin.DefaultWriter, gin.DefaultErrorWriter
					gin.DefaultWriter, gin.DefaultErrorWriter = &logs, &logs
					common.LogWriterMu.Unlock()
					defer func() {
						common.LogWriterMu.Lock()
						gin.DefaultWriter, gin.DefaultErrorWriter = originalWriter, originalErrorWriter
						common.LogWriterMu.Unlock()
					}()
					gateway := quote("/v1/responses", tc.body)
					require.Equal(t, http.StatusOK, gateway.Code, gateway.Body.String())
					assert.Zero(t, exchanges.Load(), "New API gateway credentials need no vendor OAuth")
					privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
					require.NoError(t, err)
					der, err := x509.MarshalPKCS8PrivateKey(privateKey)
					require.NoError(t, err)
					keyPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
					// A PEM line remains literal even when a leaked key is JSON
					// escaped, unlike the full key's embedded newlines.
					secrets := []string{strings.SplitN(keyPEM, "\n", 3)[1], "estimate-oauth-token-secret", "estimate-oauth-error-secret", "sk-estimate-gateway"}
					credentials := map[string]string{"project_id": "estimate-project", "client_email": "estimate@example.com", "private_key": keyPEM, "private_key_id": "estimate-cold"}
					for _, failure := range []bool{false, true} {
						failExchange.Store(failure)
						if failure {
							credentials["private_key_id"] = "estimate-failure"
						}
						encoded, err := common.Marshal(credentials)
						require.NoError(t, err)
						require.NoError(t, model.DB.Model(&channel).Updates(map[string]any{"type": constant.ChannelTypeVertexAi, "key": string(encoded)}).Error)
						model.InitChannelCache()
						for _, target := range []struct{ path, body string }{
							{"/v1/tasks/vertex-ai", `{"model":"veo-3.0-generate-001","prompt":"a cinematic landscape","duration":5}`},
							{"/v1/responses", tc.body},
						} {
							response := quote(target.path, target.body)
							for _, secret := range secrets {
								assert.NotContains(t, response.Body.String(), secret)
							}
							if failure {
								assert.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
								assert.NotContains(t, response.Body.String(), `"amount"`)
								continue
							}
							require.Equal(t, http.StatusOK, response.Code, response.Body.String())
							var result map[string]any
							require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
							assert.Equal(t, "0.005", result["amount"])
							assert.EqualValues(t, 2500, result["quota"])
						}
						assert.EqualValues(t, map[bool]int{false: 1, true: 3}[failure], exchanges.Load(), "success uses the cached token; failed credentials fail closed without caching")
					}
					assert.Zero(t, unexpectedRequests.Load(), "only the fixed OAuth exchange endpoint may be contacted")
					for _, secret := range secrets {
						assert.NotContains(t, logs.String(), secret)
					}
					require.NoError(t, model.DB.Model(&channel).Updates(map[string]any{"type": channelType, "key": channelKey}).Error)
					model.InitChannelCache()
				})
			}
			if tc.pluginKey == "sora" {
				for _, target := range []struct {
					path string
					body string
				}{
					{"/v1/tasks/sora", `{"model":"sora-2","prompt":"a cinematic landscape","seconds":4,"size":"720x1280"}`},
					{"/v1/videos", `{"model":"sora-2","prompt":"a cinematic landscape","seconds":4,"size":"720x1280"}`},
				} {
					extra := quote(target.path, target.body)
					require.Equal(t, http.StatusOK, extra.Code, target.path+": "+extra.Body.String())
					var extraResult map[string]any
					require.NoError(t, common.Unmarshal(extra.Body.Bytes(), &extraResult))
					assert.Equal(t, tc.amount, extraResult["amount"])
				}
				t.Run("remix uses owned origin and its channel", func(t *testing.T) {
					SetVideoRouter(engine)
					channel.Key = "sora-key-one\nsora-key-two"
					channel.ChannelInfo = model.ChannelInfo{IsMultiKey: true, MultiKeySize: 2, MultiKeyMode: constant.MultiKeyModePolling, MultiKeyPollingIndex: 1}
					require.NoError(t, model.DB.Model(&channel).Updates(map[string]any{"key": channel.Key, "channel_info": channel.ChannelInfo}).Error)
					competing := model.Channel{Type: channelType, Key: channelKey, BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: tc.model, Group: "default", Priority: new(int64(100))}
					competing.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
					require.NoError(t, model.DB.Create(&competing).Error)
					require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: tc.model, ChannelId: competing.Id, Enabled: true, Priority: competing.Priority}).Error)
					model.InitChannelCache()
					origin := model.Task{TaskID: "estimate-sora-origin", UserId: user.Id, ChannelId: channel.Id, Platform: constant.TaskPlatform("sora"), Status: model.TaskStatusSuccess, Properties: model.Properties{OriginModelName: tc.model}, Data: common.RawMessage(`{"model":"sora-2","seconds":"8","size":"1792x1024"}`)}
					require.NoError(t, model.DB.Create(&origin).Error)
					foreign := model.Task{TaskID: "estimate-sora-foreign", UserId: user.Id + 1, ChannelId: channel.Id, Platform: constant.TaskPlatform("sora"), Properties: model.Properties{OriginModelName: tc.model}}
					require.NoError(t, model.DB.Create(&foreign).Error)
					// The existing legacy validator replaces the remix action before
					// usage extraction, so pre-consume uses the four-second default.
					require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: `{}`}))
					require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"sora-2":0.001}`))
					ordinary := quote("/v1/videos", `{"model":"sora-2","prompt":"a cat"}`)
					require.Equal(t, http.StatusOK, ordinary.Code, ordinary.Body.String())
					var ordinaryResult map[string]any
					require.NoError(t, common.Unmarshal(ordinary.Body.Bytes(), &ordinaryResult))
					assert.EqualValues(t, competing.Id, ordinaryResult["channel"].(map[string]any)["id"])
					for _, scenario := range []struct {
						id     string
						status int
					}{{origin.TaskID, 200}, {foreign.TaskID, 400}, {"missing-origin", 400}} {
						response := quote("/v1/videos/"+scenario.id+"/remix", `{"prompt":"a cat","model":"forged-model"}`)
						require.Equal(t, scenario.status, response.Code, response.Body.String())
						if scenario.status == 200 {
							var result map[string]any
							require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
							assert.Equal(t, "0.004", result["amount"])
							assert.EqualValues(t, 2000, result["quota"])
							assert.Equal(t, tc.model, result["model"])
							assert.EqualValues(t, channel.Id, result["channel"].(map[string]any)["id"])
						} else {
							assert.NotContains(t, response.Body.String(), `"amount"`)
						}
					}
					require.NoError(t, model.DB.Model(&origin).Update("platform", constant.TaskPlatform(strconv.Itoa(constant.ChannelTypeOpenAI))).Error)
					legacy := quote("/v1/videos/"+origin.TaskID+"/remix", `{"prompt":"a cat"}`)
					require.Equal(t, http.StatusOK, legacy.Code, legacy.Body.String())
					cached, err := model.CacheGetChannel(channel.Id)
					require.NoError(t, err)
					assert.Equal(t, 1, cached.ChannelInfo.MultiKeyPollingIndex, "origin pin must not advance the key cursor")
					require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusManuallyDisabled).Error)
					model.InitChannelCache()
					disabled := quote("/v1/videos/"+origin.TaskID+"/remix", `{"prompt":"a cat"}`)
					assert.Equal(t, 400, disabled.Code, disabled.Body.String())
					require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusEnabled).Error)
					require.NoError(t, model.DB.Model(&competing).Update("status", common.ChannelStatusManuallyDisabled).Error)
					require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", competing.Id).Update("enabled", false).Error)
					model.InitChannelCache()
				})
			}
			if tc.pluginKey == "jimeng" {
				native := quote("/jimeng/api/common/v3/submit_task_v2", `{"req_key":"jimeng_vgfm_t2v_l20","prompt":"a cinematic landscape","duration":5}`)
				require.Equal(t, http.StatusOK, native.Code, native.Body.String())
				var nativeResult map[string]any
				require.NoError(t, common.Unmarshal(native.Body.Bytes(), &nativeResult))
				assert.Equal(t, tc.amount, nativeResult["amount"])
			}
			assert.Zero(t, providerCalls.Load(), "native, generic, and host protocol estimates must not submit descriptors")
			if tc.pluginKey == "alibaba" {
				image := quote("/v1/images/generations", `{"model":"wan2.7-image","prompt":"a red kite","n":2}`)
				require.Equal(t, http.StatusOK, image.Code, image.Body.String())
				var imageResult map[string]any
				require.NoError(t, common.Unmarshal(image.Body.Bytes(), &imageResult))
				assert.Equal(t, "0.002", imageResult["amount"])
				assert.EqualValues(t, 1000, imageResult["quota"])
				assert.Equal(t, plugin.Meta.Key, imageResult["channel"].(map[string]any)["plugin"])
			}

			// These prices make the request-derived quantities observable at the
			// public boundary. Expected amounts and quotas are worked examples,
			// independent of the production usage and quota helpers.
			specialCases := map[string][]struct {
				name, model, path, body, expression, amount string
				quota, status                               int
			}{
				"doubao": {
					{"missing duration reserves twelve seconds", tc.model, "/v1/responses", `{"model":"doubao-seedance-1-0-pro-250528","input":"a cat","resolution":"720p"}`, "", "0.2592", 129600, 200},
					{"smart duration reserves twelve seconds", tc.model, "/v1/responses", `{"model":"doubao-seedance-1-0-pro-250528","input":"a cat","seconds":-1,"resolution":"720p"}`, "", "0.2592", 129600, 200},
					{"new profile reserves thirty seconds", "doubao-seedance-2-5-260628", "/v1/responses", `{"model":"doubao-seedance-2-5-260628","input":"a cat","seconds":-1,"resolution":"720p"}`, "", "0.648", 324000, 200},
					{"endpoint mapping keeps fifteen second profile", "doubao-seedance-2-0-fast-260128", "/v1/responses", `{"model":"doubao-seedance-2-0-fast-260128","input":"a cat","seconds":-1,"resolution":"720p"}`, "", "0.324", 162000, 200},
					{"endpoint mapping keeps resolution limits", "doubao-seedance-2-0-fast-260128", "/v1/responses", `{"model":"doubao-seedance-2-0-fast-260128","input":"a cat","seconds":5,"resolution":"1080p"}`, "", "", 0, 400},
				},
				"alibaba": {
					{"smart duration reserves thirty seconds", "wan3.0-video", "/v1/videos", `{"model":"wan3.0-video","prompt":"a cat","seconds":-1}`, "", "0.03", 15000, 200},
					{"passthrough duration overrides smart duration", "wan3.0-video", "/v1/videos", `{"model":"wan3.0-video","prompt":"a cat","seconds":-1,"metadata":{"parameters":{"duration":8}}}`, "", "0.008", 4000, 200},
					{"passthrough smart duration overrides explicit duration", "wan3.0-video", "/v1/videos", `{"model":"wan3.0-video","prompt":"a cat","seconds":8,"metadata":{"parameters":{"duration":-1}}}`, "", "0.03", 15000, 200},
					{"passthrough duration cannot bypass limits", "wan3.0-video", "/v1/videos", `{"model":"wan3.0-video","prompt":"a cat","metadata":{"parameters":{"duration":3601}}}`, "", "", 0, 400},
					{"image profile counts passthrough quantity", "wan2.7-image", "/v1/images/generations", `{"model":"wan2.7-image","prompt":"a cat","n":1,"parameters":{"n":3}}`, `tier("base", u("image_count") * 0.001)`, "0.003", 1500, 200},
					{"image passthrough quantity cannot bypass limits", "wan2.7-image", "/v1/images/generations", `{"model":"wan2.7-image","prompt":"a cat","parameters":{"n":129}}`, `tier("base", u("image_count") * 0.001)`, "", 0, 400},
				},
				"google": {
					{"missing duration uses eight seconds", tc.model, "/v1/responses", `{"model":"veo-3.0-generate-001","input":"a cat"}`, "", "0.008", 4000, 200},
					{"native model action path", tc.model, "/google/v1beta/models/veo-3.0-generate-001:predictLongRunning", `{"instances":[{"prompt":"a cat"}],"parameters":{"durationSeconds":6,"resolution":"1080p","generateAudio":false}}`, "", "0.006", 3000, 200},
				},
				"vertex-ai": {
					{"missing duration uses eight seconds without OAuth on gateway", tc.model, "/v1/responses", `{"model":"veo-3.0-generate-001","input":"a cat"}`, "", "0.008", 4000, 200},
					{"native project location and model action path", tc.model, "/vertex-ai/v1/projects/estimate-project/locations/us-central1/publishers/google/models/veo-3.0-generate-001:predictLongRunning", `{"instances":[{"prompt":"a cat"}],"parameters":{"durationSeconds":6,"resolution":"1080p","generateAudio":false}}`, "", "0.006", 3000, 200},
					{"query action cannot be estimated as submission", tc.model, "/vertex-ai/v1/projects/estimate-project/locations/us-central1/publishers/google/models/veo-3.0-generate-001:fetchPredictOperation", `{"operationName":"operations/123"}`, "", "", 0, 400},
				},
				"hailuo": {
					{"missing duration uses six seconds", tc.model, "/v1/responses", `{"model":"MiniMax-Hailuo-2.3","input":"a cat"}`, "", "0.006", 3000, 200},
					{"H3 reserves maximum input video seconds without probing", "MiniMax-H3", "/v1/tasks/hailuo", `{"model":"MiniMax-H3","prompt":"a cat","metadata":{"reference_video":["` + upstream.URL + `/reference.mp4"]}}`, `tier("base", u("seconds") * 0.001 + u("input_video_seconds") * 0.002)`, "0.035", 17500, 200},
				},
				"jimeng": {
					{"query route cannot be estimated as submission", tc.model, "/jimeng/api/common/v3/get_result_v2", `{"req_key":"jimeng_vgfm_t2v_l20","task_id":"123"}`, "", "", 0, 400},
				},
				"sora": {
					{"missing duration uses four seconds", tc.model, "/v1/videos", `{"model":"sora-2","prompt":"a cat"}`, "", "0.004", 2000, 200},
				},
				"vidu": {
					{"q2 missing duration uses five seconds", tc.model, "/v1/responses", `{"model":"viduq2","input":"a cat"}`, "", "0.005", 2500, 200},
					{"2.0 image to video missing duration uses four seconds", "vidu2.0", "/v1/tasks/vidu", `{"model":"vidu2.0","prompt":"a cat","images":["` + upstream.URL + `/reference.png"]}`, "", "0.004", 2000, 200},
				},
				"xai": {
					{"mapping alias retains upstream usage profile", "estimate-video-alias", "/v1/tasks/xai", `{"model":"estimate-video-alias","prompt":"a cat","duration":15,"resolution":"1080p"}`, `u("resolution") == "1080p" ? tier("high", u("seconds") * 0.002) : tier("base", u("seconds") * 0.001)`, "0.03", 15000, 200},
					{"extension reserves six output and fifteen input seconds", tc.model, "/xai/v1/videos/extensions", `{"model":"grok-imagine-video","prompt":"continue","video":{"url":"` + upstream.URL + `/reference.mp4"}}`, `tier("base", u("seconds") * 0.001 + u("input_video_seconds") * 0.002)`, "0.036", 18000, 200},
					{"edit reserves nine input and output seconds", tc.model, "/xai/v1/videos/edits", `{"model":"grok-imagine-video","prompt":"edit","video":{"url":"` + upstream.URL + `/reference.mp4"}}`, `tier("base", u("seconds") * 0.001 + u("input_video_seconds") * 0.002)`, "0.027", 13500, 200},
					{"extension duration cannot bypass limits", tc.model, "/xai/v1/videos/extensions", `{"model":"grok-imagine-video","prompt":"continue","video":{"url":"` + upstream.URL + `/reference.mp4"},"duration":11}`, "", "", 0, 400},
					{"1.5 profile permits 1080p", "grok-imagine-video-1.5", "/xai/v1/videos/generations", `{"model":"grok-imagine-video-1.5","prompt":"a cat","duration":15,"resolution":"1080p"}`, `u("resolution") == "1080p" ? tier("high", u("seconds") * 0.002) : tier("base", u("seconds") * 0.001)`, "0.03", 15000, 200},
					{"base profile rejects 1080p", tc.model, "/xai/v1/videos/generations", `{"model":"grok-imagine-video","prompt":"a cat","duration":15,"resolution":"1080p"}`, "", "", 0, 400},
				},
			}
			for _, scenario := range specialCases[tc.pluginKey] {
				t.Run(scenario.name, func(t *testing.T) {
					channelID, exists := channels[scenario.model]
					if !exists {
						extraChannel := model.Channel{Type: channelType, Key: channelKey, BaseURL: &upstream.URL, Status: common.ChannelStatusEnabled, Models: scenario.model, Group: "default"}
						extraChannel.SetSetting(dto.ChannelSettings{TaskPluginKey: plugin.Meta.Key})
						if scenario.model == "doubao-seedance-2-0-fast-260128" {
							mapping := `{"doubao-seedance-2-0-fast-260128":"ep-estimate-seedance"}`
							extraChannel.ModelMapping = &mapping
						}
						if scenario.model == "estimate-video-alias" {
							mapping := `{"estimate-video-alias":"grok-imagine-video-1.5"}`
							extraChannel.ModelMapping = &mapping
						}
						require.NoError(t, model.DB.Create(&extraChannel).Error)
						require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: scenario.model, ChannelId: extraChannel.Id, Enabled: true}).Error)
						channelID = extraChannel.Id
						channels[scenario.model] = channelID
						model.InitChannelCache()
					}
					expression := scenario.expression
					if expression == "" {
						expression = `tier("base", u("` + tc.usageKey + `") * ` + tc.price + `)`
					}
					billingExpressions[billing_setting.PluginBillingExprKey(tc.pluginKey, scenario.model)] = expression
					variants, err := common.Marshal(billingExpressions)
					require.NoError(t, err)
					require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{billing_setting.PluginBillingExprOption: string(variants)}))
					response := quote(scenario.path, scenario.body)
					require.Equal(t, scenario.status, response.Code, response.Body.String())
					if scenario.status == http.StatusOK {
						var result map[string]any
						require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
						assert.Equal(t, scenario.amount, result["amount"])
						assert.EqualValues(t, scenario.quota, result["quota"])
						assert.EqualValues(t, channelID, result["channel"].(map[string]any)["id"])
						assert.Equal(t, tc.pluginKey, result["channel"].(map[string]any)["plugin"])
					}
					assert.Zero(t, providerCalls.Load(), "estimation must preserve reservation defaults without probing unused media or sending descriptors")
					assert.NotContains(t, response.Body.String(), channelKey)
				})
			}
		})
	}
}
