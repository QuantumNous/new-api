package relay

import (
	"fmt"
	"github.com/QuantumNous/new-api/model"
	hostdto "github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestH3ImageHTTPFailuresDisableReplay(t *testing.T) {
	service.InitHttpClient()
	settings := model_setting.GetGlobalSettings()
	previous := settings.PassThroughRequestEnabled
	t.Cleanup(func() { settings.PassThroughRequestEnabled = previous })
	for _, passthrough := range []bool{false, true} {
		for _, edit := range []bool{false, true} {
			for _, status := range []int{400, 429, 500, 0} {
				t.Run(fmt.Sprintf("pass=%t/edit=%t/status=%d", passthrough, edit, status), func(t *testing.T) {
					settings.PassThroughRequestEnabled = passthrough
					var calls atomic.Int32
					path := "/v1/images/generations"
					mode := relayconstant.RelayModeImagesGenerations
					if edit {
						path = "/v1/images/edits"
						mode = relayconstant.RelayModeImagesEdits
					}
					paths := make(chan string, 1)
					server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						calls.Add(1)
						paths <- r.URL.Path
						io.Copy(io.Discard, r.Body)
						if status == 0 {
							conn, _, err := w.(http.Hijacker).Hijack()
							if err == nil {
								conn.Close()
							}
							return
						}
						w.Header().Set("Content-Type", "application/json")
						w.WriteHeader(status)
						io.WriteString(w, `{"error":{"message":"synthetic failure","type":"server_error"}}`)
					}))
					defer server.Close()
					modelName := "MiniMax-H3-Image"
					if !passthrough {
						modelName = "public-image-alias"
					}
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"model":"`+modelName+`","prompt":"synthetic","images":[{"image_url":"https://example.com/input.png"}]}`))
					c.Request.Header.Set("Content-Type", "application/json")
					t.Cleanup(func() { common.CleanupBodyStorage(c) })
					request, err := helper.GetAndValidOpenAIImageRequest(c, mode)
					require.NoError(t, err)
					common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeMiniMax)
					common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, server.URL)
					common.SetContextKey(c, constant.ContextKeyOriginalModel, modelName)
					if !passthrough {
						c.Set("model_mapping", `{"public-image-alias":"MiniMax-H3-Image-Highspeed"}`)
					}
					info := &relaycommon.RelayInfo{OriginModelName: modelName, Request: request, RelayMode: mode, RelayFormat: types.RelayFormatOpenAI, RequestURLPath: path}
					apiErr := ImageHelper(c, info)
					require.NotNil(t, apiErr)
					assert.True(t, types.IsSkipRetryError(apiErr), "H3 HTTP errors and unknown transport outcomes must not be replayed")
					assert.EqualValues(t, 1, calls.Load())
					assert.Equal(t, path, <-paths)
				})
			}
		}
	}
}

func TestH3ImageSettlementKeepsCompletedImagesBillable(t *testing.T) {
	db := setupRelayChannelDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Log{}))
	previousLogDB := model.LOG_DB
	previousLogType := common.LogDatabaseType()
	previousRedis, previousBatch, previousLog := common.RedisEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled
	previousTimeout := constant.StreamingTimeout
	model.LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled = false, false, true
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		model.LOG_DB = previousLogDB
		common.SetLogDatabaseType(previousLogType)
		common.RedisEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled = previousRedis, previousBatch, previousLog
		constant.StreamingTimeout = previousTimeout
	})
	service.InitHttpClient()
	const success = "data: {\"type\":\"image_generation.partial_succeeded\",\"image_index\":0,\"url\":\"https://example.com/result.png\"}\n\n"
	const completed = "data: {\"type\":\"image_generation.completed\",\"usage\":{\"generated_images\":1,\"input_tokens\":10,\"output_tokens\":20,\"total_tokens\":30}}\n\n"
	for _, tc := range []struct {
		name, body string
		want       int
		failed     bool
	}{
		{"partial success", success + completed, 5000, false},
		{"interrupted after image", success, 10000, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				_, _ = io.WriteString(w, tc.body)
			}))
			defer server.Close()
			user := model.User{Username: tc.name, AffCode: tc.name, Status: common.UserStatusEnabled, Quota: 1000000}
			require.NoError(t, db.Create(&user).Error)
			token := model.Token{UserId: user.Id, Name: "h3-test", Key: tc.name, Status: common.TokenStatusEnabled, RemainQuota: 1000000, ExpiredTime: -1}
			require.NoError(t, db.Create(&token).Error)
			ch := model.Channel{Name: tc.name, Type: constant.ChannelTypeMiniMax}
			require.NoError(t, db.Create(&ch).Error)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"MiniMax-H3-Image","prompt":"synthetic","n":2,"stream":true}`))
			c.Request.Header.Set("Content-Type", "application/json")
			defer common.CleanupBodyStorage(c)
			req, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
			require.NoError(t, err)
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeMiniMax)
			common.SetContextKey(c, constant.ContextKeyChannelId, ch.Id)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, server.URL)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, req.Model)
			info := &relaycommon.RelayInfo{OriginModelName: req.Model, Request: req, IsStream: true, RelayMode: relayconstant.RelayModeImagesGenerations, RelayFormat: types.RelayFormatOpenAI, RequestURLPath: c.Request.URL.Path, StartTime: time.Now(), UserId: user.Id, TokenId: token.Id, TokenKey: token.Key, ForcePreConsume: true, UsingGroup: "default", UserGroup: "default", UserSetting: hostdto.UserSetting{BillingPreference: "wallet_only"}, PriceData: hosttypes.PriceData{UsePrice: true, ModelPrice: 0.01, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1}}}
			info.SetEstimatePromptTokens(1)
			apiErr := ImageHelper(c, info)
			if tc.failed {
				require.NotNil(t, apiErr)
				assert.True(t, types.IsSkipRetryError(apiErr))
			} else {
				require.Nil(t, apiErr)
			}
			require.NotNil(t, info.Billing)
			assert.False(t, info.Billing.NeedsRefund())
			info.Billing.Refund(c)
			var saved model.User
			require.NoError(t, db.First(&saved, user.Id).Error)
			assert.Equal(t, 1000000-tc.want, saved.Quota)
			var logs []model.Log
			require.NoError(t, db.Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).Find(&logs).Error)
			require.Len(t, logs, 1)
			assert.Equal(t, tc.want, logs[0].Quota)
		})
	}
}
