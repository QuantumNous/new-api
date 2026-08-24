package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	_ "unsafe"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

//go:linkname registerTaskAdaptorForTest github.com/QuantumNous/new-api/relay.registerTaskAdaptorForTest
func registerTaskAdaptorForTest(platform constant.TaskPlatform, adaptor channel.TaskAdaptor) func()

func TestAssetRelayTaskQueuesBeforeProviderOrMaterializer(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_1234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-secret-queue")
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	model.InitChannelCache()

	body := seedanceTaskBody(publicID)
	c, recorder := newControllerRelayTaskContext(body)
	c.Request.Header.Set("Authorization", "Bearer sk-user-secret")
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenId, 11)
	common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-11")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	c.Set("token_name", "task-token")
	c.Set("token_quota", 10000)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"seedance-2.0": true})
	common.SetContextKey(c, constant.ContextKeyChannelId, 131)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeBytePlus)
	common.SetContextKey(c, constant.ContextKeyTokenSpecificChannelId, "120")
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-provider-secret-queue")
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})

	var req dto.SeedanceVideoRequest
	require.NoError(t, common.Unmarshal([]byte(body), &req))
	refs, apiErr := service.ResolveAssetReferences(c, 7, &req)
	require.Nil(t, apiErr)
	common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, refs)

	RelayTask(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.EqualValues(t, 1, adaptor.validateCalls.Load())
	require.EqualValues(t, 1, adaptor.estimateCalls.Load())
	require.Zero(t, adaptor.providerCalls.Load(), "queued response must not submit upstream")
	require.Zero(t, materializerCalls.Load(), "external RelayTask must not materialize before queue response")

	var response dto.OpenAIVideo
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.NotEmpty(t, response.ID)
	require.Equal(t, response.ID, response.TaskID)
	require.Equal(t, "seedance-2.0", response.Model)
	require.Equal(t, dto.VideoStatusQueued, response.Status)
	require.Equal(t, 0, response.Progress)
	require.NotZero(t, response.CreatedAt)

	var task model.Task
	require.NoError(t, model.DB.Where("task_id = ?", response.TaskID).First(&task).Error)
	require.EqualValues(t, model.TaskStatusQueued, task.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, task.PreparationStatus)
	require.Equal(t, 0, task.ChannelId, "queued asset task is not pinned before provider acceptance")
	require.Empty(t, task.PrivateData.UpstreamTaskID)
	require.Equal(t, response.TaskID, task.TaskID)
	require.Equal(t, 7, task.UserId)
	require.Equal(t, 11, task.PrivateData.TokenId)
	require.Equal(t, 120, task.PrivateData.SpecificChannelId)
	require.NotNil(t, task.PrivateData.BillingContext)
	require.Greater(t, task.Quota, 0)

	var queuedCount int64
	require.NoError(t, model.DB.Model(&model.Task{}).Where("task_id = ?", response.TaskID).Count(&queuedCount).Error)
	require.EqualValues(t, 1, queuedCount)
	var user model.User
	require.NoError(t, model.DB.First(&user, 7).Error)
	require.Equal(t, 10000-task.Quota, user.Quota, "reservation must happen exactly once")
	var token model.Token
	require.NoError(t, model.DB.First(&token, 11).Error)
	require.Equal(t, 10000-task.Quota, token.RemainQuota, "token reservation must happen exactly once")
}

func TestAssetRelayTaskPersistsNoSecretsBeforeAcceptance(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	adaptor := &controllerFakeTaskAdaptor{}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_2234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, `{"api_key":"sk-provider-secret-scan","signed":"https://signed.example/path?X-Goog-Signature=abc","credentials":{"private_key":"provider-secret-json"}}`)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	model.InitChannelCache()

	body := seedanceTaskBody(publicID)
	c, recorder := newControllerRelayTaskContext(body)
	c.Request.Header.Set("Authorization", "Bearer sk-user-authorization-secret")
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenId, 11)
	common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-11")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	c.Set("token_name", "task-token")
	c.Set("token_quota", 10000)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"seedance-2.0": true})
	common.SetContextKey(c, constant.ContextKeyChannelId, 131)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeBytePlus)
	common.SetContextKey(c, constant.ContextKeyChannelKey, `{"api_key":"sk-provider-secret-scan","signed":"https://signed.example/path?X-Goog-Signature=abc","credentials":{"private_key":"provider-secret-json"}}`)
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})
	var req dto.SeedanceVideoRequest
	require.NoError(t, common.Unmarshal([]byte(body), &req))
	refs, apiErr := service.ResolveAssetReferences(c, 7, &req)
	require.Nil(t, apiErr)
	common.SetContextKey(c, constant.ContextKeyAssetReferenceSet, refs)

	RelayTask(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response dto.OpenAIVideo
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	var task model.Task
	require.NoError(t, model.DB.Where("task_id = ?", response.TaskID).First(&task).Error)
	require.EqualValues(t, model.TaskStatusQueued, task.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, task.PreparationStatus)
	require.Equal(t, 0, task.ChannelId)
	require.Empty(t, task.PrivateData.UpstreamTaskID)

	privateData, err := common.Marshal(task.PrivateData)
	require.NoError(t, err)
	scan := string(task.NormalizedRequestPayload) + "\n" + string(privateData) + "\n" + string(task.Data)
	for _, forbidden := range []string{
		"Authorization",
		"sk-user-authorization-secret",
		"sk-provider-secret-scan",
		"provider-secret-json",
		"signed.example",
		"X-Goog-Signature",
		"upstream-task-before-accept",
		"gin.Context",
		"ContextKeyChannelKey",
	} {
		require.NotContains(t, scan, forbidden)
	}
}

func TestNonAssetRelayTaskSubmitsSynchronously(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "upstream-sync"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-sync")
	model.InitChannelCache()

	c, recorder := newControllerRelayTaskContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"plain prompt"}]}`)
	common.SetContextKey(c, constant.ContextKeyUserId, 7)
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenId, 11)
	common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-11")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	c.Set("token_name", "task-token")
	c.Set("token_quota", 10000)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, true)
	common.SetContextKey(c, constant.ContextKeyTokenModelLimit, map[string]bool{"seedance-2.0": true})
	common.SetContextKey(c, constant.ContextKeyChannelId, 131)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeBytePlus)
	common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-provider-sync")
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{BillingPreference: "wallet_only"})

	RelayTask(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
	require.EqualValues(t, 2, adaptor.validateCalls.Load(), "sync path validates in preflight and execution")
	var response dto.OpenAIVideo
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
	require.Equal(t, "upstream-sync", response.ID)
	require.Equal(t, dto.VideoStatusQueued, response.Status)

	var queuedCount int64
	require.NoError(t, model.DB.Model(&model.Task{}).Where("status = ? AND preparation_status = ?", model.TaskStatusQueued, model.TaskPreparationStatusPreparingAssets).Count(&queuedCount).Error)
	require.Zero(t, queuedCount)
	var submitted model.Task
	require.NoError(t, model.DB.Where("json_extract(private_data, '$.upstream_task_id') = ?", "upstream-sync").First(&submitted).Error)
	require.NotEqual(t, model.TaskStatusQueued, submitted.Status)
	require.NotEqual(t, model.TaskPreparationStatusPreparingAssets, submitted.PreparationStatus)
	require.Equal(t, 131, submitted.ChannelId)
	require.Equal(t, "upstream-sync", submitted.PrivateData.UpstreamTaskID)
}

func TestModelAPISeedanceSubmitEstimatedUSDSettlesAndPersistsAdjustedBilling(t *testing.T) {
	const (
		userID       = 57
		tokenID      = 58
		channelID    = 159
		subID        = 60
		planID       = 61
		modelPrice   = 0.14
		estimatedUSD = 1.25
	)
	expectedUnits := estimatedUSD / modelPrice
	// Shared fixed-price task billing recalculates from integer quota units and
	// intentionally preserves truncation at the submit-time adjustment boundary.
	expectedQuota := 624999

	tests := []struct {
		name          string
		userQuota     int
		userSetting   dto.UserSetting
		seedSub       bool
		wantSource    string
		wantUserQuota int
		wantSubUsed   int64
	}{
		{
			name:          "wallet",
			userQuota:     2000000,
			userSetting:   dto.UserSetting{BillingPreference: "wallet_only"},
			wantSource:    service.BillingSourceWallet,
			wantUserQuota: 2000000 - expectedQuota,
		},
		{
			name:          "subscription",
			userQuota:     0,
			userSetting:   dto.UserSetting{},
			seedSub:       true,
			wantSource:    service.BillingSourceSubscription,
			wantUserQuota: 0,
			wantSubUsed:   int64(expectedQuota),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			restoreDB := useControllerAssetTaskDBForTest(t)
			defer restoreDB()
			restorePricing := useControllerAssetTaskPricingForTest(t)
			defer restorePricing()
			require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"seedance-2.0":0.14}`))
			service.InitHttpClient()

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, http.MethodPost, r.Method)
				require.Equal(t, "/v1/tasks", r.URL.Path)
				require.Equal(t, "Bearer sk-modelapi-provider", r.Header.Get("Authorization"))
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"task_id":"upstream-modelapi-` + tt.name + `","status":"pending","usage":{"estimated_usd":1.25}}`))
			}))
			defer server.Close()

			seedControllerRelayUserToken(t, userID, tokenID, tt.userQuota, 2000000)
			seedControllerModelAPISeedanceChannel(t, channelID, server.URL)
			if tt.seedSub {
				require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
					Id:               planID,
					Title:            "ModelAPI Seedance submit billing plan",
					DurationUnit:     "month",
					DurationValue:    1,
					TotalAmount:      2000000,
					Window5hAmount:   2000000,
					WindowWeekAmount: 2000000,
				}).Error)
				require.NoError(t, model.DB.Create(&model.UserSubscription{
					Id:          subID,
					UserId:      userID,
					PlanId:      planID,
					AmountTotal: 2000000,
					AmountUsed:  0,
					Status:      "active",
					StartTime:   time.Now().Add(-time.Hour).Unix(),
					EndTime:     time.Now().Add(time.Hour).Unix(),
				}).Error)
			}
			model.InitChannelCache()

			c, recorder := newControllerRelayTaskContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"cinematic tea ad"}]}`)
			common.SetContextKey(c, constant.ContextKeyUserId, userID)
			common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			common.SetContextKey(c, constant.ContextKeyTokenId, tokenID)
			common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-58")
			common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
			common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
			common.SetContextKey(c, constant.ContextKeyUserSetting, tt.userSetting)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, "seedance-2.0")
			common.SetContextKey(c, constant.ContextKeyChannelId, channelID)
			common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeModelAPISeedance)
			common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, server.URL)
			common.SetContextKey(c, constant.ContextKeyChannelKey, "sk-modelapi-provider")
			c.Set("platform", strconv.Itoa(constant.ChannelTypeModelAPISeedance))
			c.Set("token_name", "task-token")
			c.Set("token_quota", 2000000)

			RelayTask(c)

			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			var response dto.OpenAIVideo
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			require.NotEmpty(t, response.TaskID)

			var task model.Task
			require.NoError(t, model.DB.Where("task_id = ?", response.TaskID).First(&task).Error)
			require.Equal(t, "upstream-modelapi-"+tt.name, task.PrivateData.UpstreamTaskID)
			require.Equal(t, expectedQuota, task.Quota)
			require.Equal(t, tt.wantSource, task.PrivateData.BillingSource)
			require.NotNil(t, task.PrivateData.BillingContext)
			require.True(t, task.PrivateData.BillingContext.PerCallBilling)
			require.InDelta(t, expectedUnits, task.PrivateData.BillingContext.OtherRatios["billable_units"], 1e-9)

			require.Equal(t, tt.wantUserQuota, getControllerUserQuota(t, userID))
			require.Equal(t, 2000000-expectedQuota, getControllerTokenRemain(t, tokenID))
			if tt.seedSub {
				require.Equal(t, tt.wantSubUsed, getControllerSubscriptionUsed(t, subID))
			}
		})
	}
}

func TestAssetTaskWorkerFallbackBeforeAcceptancePinsWinningChannel(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{
		upstreamTaskID:    "upstream-channel-b",
		failHTTPByChannel: map[int]int{131: http.StatusTooManyRequests},
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_3234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-a", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-b", 90, 1)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_worker_fallback", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	require.Equal(t, []int{131, 132}, adaptor.channelsSeen)
	require.EqualValues(t, 2, adaptor.providerCalls.Load())
	require.EqualValues(t, 2, materializerCalls.Load(), "each attempted channel may prepare its own binding before acceptance")
	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_worker_fallback").First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 132, stored.ChannelId)
	require.Equal(t, "upstream-channel-b", stored.PrivateData.UpstreamTaskID)
	require.Contains(t, string(stored.Data), "upstream-channel-b")
	require.NotContains(t, string(stored.Data), "upstream-channel-a")

	var asset model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&asset).Error)
	winnerLastUsed := asset.LastUsedAt
	winnerExpires := asset.SourceExpiresAt

	assetTaskWorkerTestNow = 1100
	lateWon, err := model.MarkQueuedTaskAccepted("task_worker_fallback", "node-late", 1200, 1100, 1100, 131, constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), stored.Quota, "late-upstream-a", []byte(`{"id":"late-upstream-a"}`), []string{publicID}, 1100, winnerExpires+1000)
	require.NoError(t, err)
	require.False(t, lateWon)
	var afterLate model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_worker_fallback").First(&afterLate).Error)
	require.Equal(t, 132, afterLate.ChannelId)
	require.Equal(t, "upstream-channel-b", afterLate.PrivateData.UpstreamTaskID)
	var assetAfterLate model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&assetAfterLate).Error)
	require.Equal(t, winnerLastUsed, assetAfterLate.LastUsedAt)
	require.Equal(t, winnerExpires, assetAfterLate.SourceExpiresAt)
}

func TestTechMobiAssetTaskWorkerPersistsSelectedKeyAfterAcceptance(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, controllerAssetMaterializer{})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "techmobi-upstream-task"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeTechMobiVideo)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_4234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTechMobiTaskChannel(t, 106)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_techmobi_selected_key", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 106, stored.ChannelId)
	require.Equal(t, "techmobi-key-b", stored.PrivateData.Key)
}

func TestModelAPISeedanceAssetTaskWorkerPersistsSelectedKeyAfterAcceptance(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "modelapi-upstream-task"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeModelAPISeedance)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_8234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerModelAPISeedanceMultiKeyChannel(t, 49)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	var asset model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&asset).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       49,
		BindingScope:    "",
		Status:          model.AssetStatusActive,
		UpstreamAssetId: "modelapi-bound-" + publicID,
	}).Error)
	task := seedControllerQueuedAssetTask(t, "task_modelapi_selected_key", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 49, stored.ChannelId)
	require.Equal(t, "modelapi-key-b", stored.PrivateData.Key)
}

func TestGrokAssetTaskWorkerPollingKeyPolicyDoesNotPersistOAuth(t *testing.T) {
	key := taskPollingKey(&model.Channel{
		Id:   113,
		Type: constant.ChannelTypeGrokSubscription,
		Key:  `{"access_token":"oauth-access","refresh_token":"oauth-refresh","expires_at":4102444800}`,
	}, &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeGrokSubscription,
			ApiKey:      `{"access_token":"oauth-access","refresh_token":"oauth-refresh","expires_at":4102444800}`,
		},
	})

	require.Empty(t, key)
}

func TestTechMobiAssetTaskWorkerRequeuesProcessingBindingThenSubmitsWhenActive(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	var getCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, controllerProcessingThenActiveMaterializer{
		getCalls:    &getCalls,
		activeAfter: 3,
	})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "techmobi-upstream-after-assets-ready"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeTechMobiVideo)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_5234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTechMobiTaskChannel(t, 106)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_techmobi_wait_for_binding", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.CreatedAt = 1000
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var waiting model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&waiting).Error)
	require.EqualValues(t, model.TaskStatusQueued, waiting.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, waiting.PreparationStatus)
	require.Empty(t, waiting.PreparationLeaseOwner)
	require.EqualValues(t, 1001, waiting.PreparationLeaseExpiresAt)
	require.Empty(t, waiting.FailReason)
	require.Zero(t, adaptor.providerCalls.Load(), "video generation must not start while the binding is processing")
	require.Equal(t, 10000, getControllerUserQuota(t, 7), "waiting for an asset binding must not refund the task")
	var refundLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	require.Zero(t, refundLogs)

	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 0, processed, "the task must not be polled again before the scheduled check")

	assetTaskWorkerTestNow = 1001
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var submitted model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&submitted).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, submitted.Status)
	require.Equal(t, model.TaskPreparationStatusReady, submitted.PreparationStatus)
	require.Equal(t, "techmobi-upstream-after-assets-ready", submitted.PrivateData.UpstreamTaskID)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
	require.EqualValues(t, 4, getCalls.Load())
}

func TestTechMobiAssetTaskWorkerRequeuesProcessingSourceThenSubmitsWhenActive(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, controllerAssetMaterializer{})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "techmobi-upstream-after-source-ready"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeTechMobiVideo)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_7234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTechMobiTaskChannel(t, 106)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	require.NoError(t, model.DB.Model(&model.Asset{}).Where("public_id = ?", publicID).Update("status", model.AssetStatusProcessing).Error)
	task := seedControllerQueuedAssetTask(t, "task_techmobi_wait_for_source", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.CreatedAt = 1000
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var waiting model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&waiting).Error)
	require.EqualValues(t, model.TaskStatusQueued, waiting.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, waiting.PreparationStatus)
	require.EqualValues(t, 1001, waiting.PreparationLeaseExpiresAt)
	require.Zero(t, adaptor.providerCalls.Load())

	require.NoError(t, model.DB.Model(&model.Asset{}).Where("public_id = ?", publicID).Update("status", model.AssetStatusActive).Error)
	assetTaskWorkerTestNow = 1001
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var submitted model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&submitted).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, submitted.Status)
	require.Equal(t, "techmobi-upstream-after-source-ready", submitted.PrivateData.UpstreamTaskID)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
}

func TestTechMobiAssetTaskWorkerFailsProcessingBindingAtReadyDeadline(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	var getCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, controllerProcessingThenActiveMaterializer{
		getCalls:    &getCalls,
		activeAfter: 100,
	})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "must-not-submit"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeTechMobiVideo)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_6234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTechMobiTaskChannel(t, 106)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_techmobi_binding_deadline", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.CreatedAt = 700
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var failed model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&failed).Error)
	require.EqualValues(t, model.TaskStatusFailure, failed.Status)
	require.Equal(t, model.TaskPreparationStatusFailed, failed.PreparationStatus)
	require.Equal(t, "asset is not ready", failed.FailReason)
	require.Zero(t, adaptor.providerCalls.Load())
}

func TestTechMobiAssetTaskWorkerPersistsSelectedKeyForUnknownSubmission(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeTechMobiVideo, controllerAssetMaterializer{})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{failByChannel: map[int]error{106: assertErr("connection reset after request write")}}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeTechMobiVideo)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_4334567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTechMobiTaskChannel(t, 106)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_techmobi_unknown_key", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, "techmobi-key-b", stored.PrivateData.Key)
}

func TestModelAPISeedanceAssetTaskWorkerPersistsSelectedKeyForUnknownSubmission(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	adaptor := &controllerFakeTaskAdaptor{failByChannel: map[int]error{49: assertErr("connection reset after request write")}}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeModelAPISeedance)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_9334567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerModelAPISeedanceMultiKeyChannel(t, 49)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	var asset model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&asset).Error)
	require.NoError(t, model.DB.Create(&model.AssetBinding{
		AssetId:         asset.Id,
		ChannelId:       49,
		BindingScope:    "",
		Status:          model.AssetStatusActive,
		UpstreamAssetId: "modelapi-bound-" + publicID,
	}).Error)
	task := seedControllerQueuedAssetTask(t, "task_modelapi_unknown_key", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, "modelapi-key-b", stored.PrivateData.Key)
}

func TestAssetTaskWorkerCrossTypeFallbackUsesSelectedAdaptorAndPricing(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreBytePlusMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreBytePlusMaterializer()
	restoreViduMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeVidu, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreViduMaterializer()

	bytePlusAdaptor := &controllerFakeTaskAdaptor{failHTTPByChannel: map[int]int{131: http.StatusTooManyRequests}}
	restoreBytePlusAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), bytePlusAdaptor)
	defer restoreBytePlusAdaptor()
	viduAdaptor := &controllerFakeTaskAdaptor{estimatedRatios: map[string]float64{"provider": 2}}
	restoreViduAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeVidu)), viduAdaptor)
	defer restoreViduAdaptor()

	publicID := "ast_5234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelTypeWithPriority(t, 131, constant.ChannelTypeBytePlus, "sk-provider-byteplus", 100, 1)
	seedControllerTaskChannelTypeWithPriority(t, 132, constant.ChannelTypeVidu, "sk-provider-vidu", 90, 1)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_worker_cross_type_fallback", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	require.Equal(t, []int{131}, bytePlusAdaptor.channelsSeen)
	require.Equal(t, []int{132}, viduAdaptor.channelsSeen)
	require.EqualValues(t, 1, bytePlusAdaptor.estimateCalls.Load())
	require.EqualValues(t, 1, viduAdaptor.estimateCalls.Load())
	require.EqualValues(t, 2, materializerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 132, stored.ChannelId)
	require.Equal(t, constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeVidu)), stored.Platform)
	expectedQuota := int(0.001 * float64(common.QuotaPerUnit) * 2)
	require.Equal(t, expectedQuota, stored.Quota)
}

func TestAssetTaskTransportFailureAfterSubmitQuarantinesBeforeFallback(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{failByChannel: map[int]error{131: assertErr("connection reset after request write")}}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_8234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-transport-a", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-transport-b", 90, 1)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_transport_unknown", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, []int{131}, adaptor.channelsSeen)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
	require.EqualValues(t, 1, materializerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, 131, stored.ChannelId)
	require.Empty(t, stored.PrivateData.UpstreamTaskID)
}

func TestAssetTaskServerFailureAfterSubmitQuarantinesBeforeFallback(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 1
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{failHTTPByChannel: map[int]int{131: http.StatusInternalServerError}}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_9234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-server-a", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-server-b", 90, 1)
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_server_unknown", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, []int{131}, adaptor.channelsSeen)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
	require.EqualValues(t, 1, materializerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, 131, stored.ChannelId)
	require.Empty(t, stored.PrivateData.UpstreamTaskID)
}

func TestAssetTaskWorkerAcceptedWinnerSettlesAndLogsOnce(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{
		upstreamTaskID: "upstream-accounted",
		adjustedRatios: map[string]float64{"actual": 2},
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_4234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-accounted")
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_worker_accounting", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.Quota = 123
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)
	model.InitChannelCache()
	expectedQuota := int(0.001 * float64(common.QuotaPerUnit) * 2)

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_worker_accounting").First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, expectedQuota, stored.Quota)
	require.Equal(t, 131, stored.ChannelId)
	require.Equal(t, "upstream-accounted", stored.PrivateData.UpstreamTaskID)

	var user model.User
	require.NoError(t, model.DB.First(&user, 7).Error)
	require.Equal(t, 10000-expectedQuota, user.Quota)
	require.EqualValues(t, expectedQuota, user.UsedQuota)
	require.Equal(t, 1, user.RequestCount)
	var token model.Token
	require.NoError(t, model.DB.First(&token, 11).Error)
	require.Equal(t, 10000-expectedQuota, token.RemainQuota)
	require.Equal(t, expectedQuota, token.UsedQuota)
	var channel model.Channel
	require.NoError(t, model.DB.First(&channel, 131).Error)
	require.EqualValues(t, expectedQuota, channel.UsedQuota)
	var consumeLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&consumeLogs).Error)
	require.EqualValues(t, 1, consumeLogs)

	err = acceptAssetTask(nil, nil, task, "node-late", 1200, &model.Channel{Id: 132}, &relay.TaskSubmitResult{
		UpstreamTaskID: "late-upstream",
		TaskData:       []byte(`{"id":"late-upstream"}`),
		Platform:       constant.TaskPlatform("107"),
		Quota:          999,
	})
	require.Error(t, err)
	require.NoError(t, model.DB.First(&user, 7).Error)
	require.Equal(t, 10000-expectedQuota, user.Quota)
	require.EqualValues(t, expectedQuota, user.UsedQuota)
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&consumeLogs).Error)
	require.EqualValues(t, 1, consumeLogs, "late worker must not settle or log after losing acceptance CAS")
}

func TestAssetTaskWorkerRecoversPendingAcceptedAccountingAfterCrash(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-recover")
	task := seedControllerQueuedAssetTask(t, "task_accounting_recover", model.TaskPreparationStatusPreparing, "node-a", 2000)
	task.ChannelId = 0
	task.Quota = 123
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)

	assetTaskWorkerTestNow = 1000
	won, err := model.MarkQueuedTaskAccepted("task_accounting_recover", "node-a", 2000, 1000, 1000, 131, constant.TaskPlatform("107"), 246, "upstream-recover", []byte(`{"id":"upstream-recover"}`), nil, 1000, 2000)
	require.NoError(t, err)
	require.True(t, won)

	var accepted model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_accounting_recover").First(&accepted).Error)
	require.Equal(t, model.TaskAcceptedAccountingPending, accepted.AcceptedAccountingStatus)
	require.Equal(t, 123, accepted.AcceptedAccountingReservedQuota)
	require.Equal(t, 246, accepted.AcceptedAccountingActualQuota)
	require.Equal(t, 10000-123, getControllerUserQuota(t, 7))
	require.Zero(t, countControllerConsumeLogs(t))

	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 10000-246, getControllerUserQuota(t, 7))
	require.Equal(t, 10000-246, getControllerTokenRemain(t, 11))
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_recover", model.TaskAcceptedAccountingStepFunding))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_recover", model.TaskAcceptedAccountingStepLogStats))

	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-c", 10)
	require.NoError(t, err)
	require.Zero(t, processed)
	require.Equal(t, 10000-246, getControllerUserQuota(t, 7))
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
}

func TestAssetTaskAcceptedAccountingReentryAfterFundingLedgerDoesNotDoubleCharge(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-reentry")
	task := seedControllerQueuedAssetTask(t, "task_accounting_reentry", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	task.PrivateData.UpstreamTaskID = "upstream-reentry"
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)

	assetTaskWorkerTestNow = 1000
	won, err := model.ClaimAcceptedAccountingLease("task_accounting_reentry", "node-a", 1000, 1100)
	require.NoError(t, err)
	require.True(t, won)
	stored, ok, err := model.GetByOnlyTaskId("task_accounting_reentry")
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, service.SettleAcceptedTaskFundingOnce(context.Background(), stored, 246))
	require.Equal(t, 10000-246, getControllerUserQuota(t, 7))
	require.Equal(t, 10000-246, getControllerTokenRemain(t, 11))

	assetTaskWorkerTestNow = 1101
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 10000-246, getControllerUserQuota(t, 7))
	require.Equal(t, 10000-246, getControllerTokenRemain(t, 11))
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_reentry", model.TaskAcceptedAccountingStepFunding))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_reentry", model.TaskAcceptedAccountingStepLogStats))
}

func TestAssetTaskAcceptedAccountingLeaseTakeoverFencesOldOwner(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-lease")
	task := seedControllerQueuedAssetTask(t, "task_accounting_lease", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	require.NoError(t, model.DB.Save(task).Error)

	assetTaskWorkerTestNow = 1000
	won, err := model.ClaimAcceptedAccountingLease("task_accounting_lease", "node-a", 1000, 1100)
	require.NoError(t, err)
	require.True(t, won)
	won, err = model.ClaimAcceptedAccountingLease("task_accounting_lease", "node-b", 1050, 1150)
	require.NoError(t, err)
	require.False(t, won)
	won, err = model.ClaimAcceptedAccountingLease("task_accounting_lease", "node-b", 1101, 1201)
	require.NoError(t, err)
	require.True(t, won)
	won, err = model.MarkAcceptedAccountingDone("task_accounting_lease", "node-a", 1100, 1110)
	require.NoError(t, err)
	require.False(t, won)
	won, err = model.MarkAcceptedAccountingRetryable("task_accounting_lease", "node-a", 1100, "late failure", 1110)
	require.NoError(t, err)
	require.False(t, won)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_accounting_lease").First(&stored).Error)
	require.Equal(t, model.TaskAcceptedAccountingProcessing, stored.AcceptedAccountingStatus)
	require.Equal(t, "node-b", stored.AcceptedAccountingLeaseOwner)
}

func TestAssetTaskAcceptedAccountingRetryableFailureDoesNotLogStats(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-retryable")
	task := seedControllerQueuedAssetTask(t, "task_accounting_retryable", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	task.PrivateData.TokenId = 9999
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 10000-123, getControllerUserQuota(t, 7))
	require.Zero(t, countControllerConsumeLogs(t))
	var failed model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_accounting_retryable").First(&failed).Error)
	require.Equal(t, model.TaskAcceptedAccountingFailedRetryable, failed.AcceptedAccountingStatus)

	failed.PrivateData.TokenId = 11
	require.NoError(t, model.DB.Save(&failed).Error)
	assetTaskWorkerTestNow = 1001
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 10000-246, getControllerUserQuota(t, 7))
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
}

func TestAssetTaskAcceptedAccountingSeparateLogDBReentryDoesNotDuplicateLogOrStats(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	logDB, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"_log?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, logDB.AutoMigrate(&model.Log{}, &model.TaskAcceptedAccountingLogLedger{}))
	oldLogDB := model.LOG_DB
	model.LOG_DB = logDB
	defer func() { model.LOG_DB = oldLogDB }()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-logdb")
	task := seedControllerQueuedAssetTask(t, "task_accounting_logdb", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	task.PrivateData.UpstreamTaskID = "upstream-logdb"
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)

	restoreAfterLog := service.SetAcceptedAccountingAfterLogForTest(func(taskID string) error {
		if taskID == "task_accounting_logdb" {
			return errors.New("simulate main db rollback after log")
		}
		return nil
	})
	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
	require.Equal(t, 0, getControllerUserUsedQuota(t, 7))
	require.EqualValues(t, 0, countControllerAccountingLedgers(t, "task_accounting_logdb", model.TaskAcceptedAccountingStepLogStats))

	restoreAfterLog()
	assetTaskWorkerTestNow = 1001
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, countControllerConsumeLogs(t))
	require.Equal(t, 246, getControllerUserUsedQuota(t, 7))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_logdb", model.TaskAcceptedAccountingStepLogStats))
}

func TestAssetTaskAcceptedAccountingExternalStepsAreIdempotent(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	restoreRedis := useControllerAssetTaskRedisForTest(t)
	defer restoreRedis()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-external")
	task := seedControllerQueuedAssetTask(t, "task_accounting_external", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	task.PrivateData.UpstreamTaskID = "upstream-external"
	task.PrivateData.BillingSource = service.BillingSourceSubscription
	task.PrivateData.SubscriptionId = 19
	task.PrivateData.BillingContext.SubscriptionWindow = &model.TaskSubscriptionWindow{
		SubId:      19,
		SubStart:   100,
		Limit5h:    1000,
		LimitWeek:  1000,
		BucketHeld: map[string]int64{"sub:window:5h:19:0": 123},
		WeekHeld:   map[string]int64{"sub:window:week:19:0": 123},
	}
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:          19,
		UserId:      7,
		AmountTotal: 100000,
		AmountUsed:  123,
		Status:      "active",
		StartTime:   1,
		EndTime:     time.Now().Add(time.Hour).Unix(),
	}).Error)
	require.NoError(t, model.DB.Save(task).Error)
	_, err := model.GetTokenByKey("sk-task-token-11", true)
	require.NoError(t, err)
	time.Sleep(20 * time.Millisecond)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)

	var temporaryHookCalls atomic.Int32
	oldTemporaryHook := model.TemporaryChannelSpendHook
	model.TemporaryChannelSpendHook = func(channelId int, modelName string, quota int) {
		temporaryHookCalls.Add(1)
	}
	defer func() { model.TemporaryChannelSpendHook = oldTemporaryHook }()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Zero(t, processed)
	require.EqualValues(t, 0, temporaryHookCalls.Load())
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_external", model.TaskAcceptedAccountingStepTemporarySpend))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_external", model.TaskAcceptedAccountingStepTokenCache))
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_external", model.TaskAcceptedAccountingStepSubscriptionWindow))

	cached, err := model.GetTokenByKey("sk-task-token-11", false)
	require.NoError(t, err)
	require.Equal(t, 10000-246, cached.RemainQuota)
}

func TestAssetTaskAcceptedAccountingTemporarySpendPersistsOnce(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()
	prevHook := model.TemporaryChannelSpendHook
	model.TemporaryChannelSpendHook = nil
	defer func() { model.TemporaryChannelSpendHook = prevHook }()
	monitor := operation_setting.GetMonitorSetting()
	oldThreshold := monitor.TemporaryChannelSpendThresholdUSD
	monitor.TemporaryChannelSpendThresholdUSD = 0.000001
	defer func() { monitor.TemporaryChannelSpendThresholdUSD = oldThreshold }()

	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	settingJSON := `{"temporary":true}`
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:      131,
		Type:    constant.ChannelTypeBytePlus,
		Key:     "sk-provider-temp",
		Status:  common.ChannelStatusEnabled,
		Name:    "temp-channel",
		Models:  "seedance-2.0",
		Group:   "default",
		Setting: &settingJSON,
	}).Error)
	model.InitChannelCache()
	task := seedControllerQueuedAssetTask(t, "task_accounting_temp_spend", model.TaskPreparationStatusReady, "", 0)
	task.Status = model.TaskStatusSubmitted
	task.ChannelId = 131
	task.Quota = 123
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingPending
	task.AcceptedAccountingReservedQuota = 123
	task.AcceptedAccountingActualQuota = 246
	task.PrivateData.UpstreamTaskID = "upstream-temp"
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("quota", 10000-task.Quota).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"remain_quota": 10000 - task.Quota,
		"used_quota":   task.Quota,
	}).Error)

	rollbackErr := model.DB.Transaction(func(tx *gorm.DB) error {
		require.NoError(t, tx.Create(&model.TaskAcceptedAccountingLedger{
			TaskID: "task_accounting_temp_spend",
			Step:   model.TaskAcceptedAccountingStepTemporarySpend,
		}).Error)
		_, err := model.AddTemporaryChannelModelSpendTx(tx, "seedance-2.0", 246, 999)
		require.NoError(t, err)
		return errors.New("rollback accepted temporary spend")
	})
	require.Error(t, rollbackErr)
	require.EqualValues(t, 0, countControllerAccountingLedgers(t, "task_accounting_temp_spend", model.TaskAcceptedAccountingStepTemporarySpend))

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Zero(t, processed)

	var spend model.TemporaryChannelModelSpend
	require.NoError(t, model.DB.Where("model_name = ?", "seedance-2.0").First(&spend).Error)
	require.EqualValues(t, 246, spend.Quota)
	require.EqualValues(t, 1, spend.Count)
	require.EqualValues(t, 1, countControllerAccountingLedgers(t, "task_accounting_temp_spend", model.TaskAcceptedAccountingStepTemporarySpend))
}

func TestAssetTaskWorkerAcceptedSubscriptionUsesSnapshotForSettlement(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	adaptor := &controllerFakeTaskAdaptor{
		upstreamTaskID: "upstream-sub-accounted",
		adjustedRatios: map[string]float64{"actual": 2},
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_6234567890abcdefABCDEF1234567890"
	const userID = 17
	const tokenID = 18
	const subID = 19
	seedControllerRelayUserToken(t, userID, tokenID, 0, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-sub-accounted")
	seedControllerAsset(t, userID, publicID, time.Now().Add(time.Hour).Unix())
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:          subID,
		UserId:      userID,
		AmountTotal: 100000,
		AmountUsed:  150,
		Status:      "active",
		StartTime:   time.Now().Add(-time.Hour).Unix(),
		EndTime:     time.Now().Add(time.Hour).Unix(),
	}).Error)
	task := seedControllerQueuedAssetTask(t, "task_worker_subscription_accounting", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.UserId = userID
	task.ChannelId = 0
	task.Quota = 100
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	task.PrivateData = model.TaskPrivateData{
		BillingSource:  service.BillingSourceSubscription,
		SubscriptionId: subID,
		TokenId:        tokenID,
		BillingContext: &model.TaskBillingContext{
			OriginModelName:      "seedance-2.0",
			SubscriptionWeight:   1.5,
			SubscriptionWindow:   &model.TaskSubscriptionWindow{SubId: subID, SubStart: time.Now().Add(-time.Hour).Unix()},
			ModelPrice:           0.001,
			GroupRatio:           1,
			GroupModelRatioGroup: "",
		},
	}
	require.NoError(t, model.DB.Save(task).Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", tokenID).Updates(map[string]any{
		"remain_quota": 9900,
		"used_quota":   100,
	}).Error)
	model.InitChannelCache()
	expectedQuota := int(0.001 * float64(common.QuotaPerUnit) * 2)

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_worker_subscription_accounting").First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, expectedQuota, stored.Quota)
	require.Equal(t, "upstream-sub-accounted", stored.PrivateData.UpstreamTaskID)
	require.Equal(t, int64(float64(expectedQuota)*1.5), getControllerSubscriptionUsed(t, subID), "accepted settlement must use persisted subscription weight")
	var token model.Token
	require.NoError(t, model.DB.First(&token, tokenID).Error)
	require.Equal(t, 10000-expectedQuota, token.RemainQuota)
	require.Equal(t, expectedQuota, token.UsedQuota)
	var consumeLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&consumeLogs).Error)
	require.EqualValues(t, 1, consumeLogs)
}

func TestAssetTaskQueuePersistsSubscriptionSnapshot(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreRedis := useControllerAssetTaskRedisForTest(t)
	defer restoreRedis()
	originalWeights := setting.SubscriptionModelWeights2JSONString()
	require.NoError(t, setting.UpdateSubscriptionModelWeightsByJSONString(`{"seedance-2.0":1.5}`))
	defer func() { require.NoError(t, setting.UpdateSubscriptionModelWeightsByJSONString(originalWeights)) }()

	const userID = 77
	const tokenID = 88
	const subID = 99
	window5h := int64(1000)
	windowWeek := int64(5000)
	now := time.Now().Unix()
	seedControllerRelayUserToken(t, userID, tokenID, 0, 10000)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:               501,
		Title:            "Task Snapshot Plan",
		DurationUnit:     "month",
		DurationValue:    1,
		TotalAmount:      100000,
		Window5hAmount:   window5h,
		WindowWeekAmount: windowWeek,
	}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:               subID,
		UserId:           userID,
		PlanId:           501,
		AmountTotal:      100000,
		AmountUsed:       0,
		Window5hAmount:   &window5h,
		WindowWeekAmount: &windowWeek,
		Status:           "active",
		StartTime:        now - 60,
		EndTime:          now + 3600,
	}).Error)

	c := newControllerAssetTaskContext(seedanceTaskBody("ast_5234567890abcdefABCDEF1234567890"))
	common.SetContextKey(c, constant.ContextKeyUserId, userID)
	common.SetContextKey(c, constant.ContextKeyTokenId, tokenID)
	common.SetContextKey(c, constant.ContextKeyTokenKey, "sk-task-token-88")
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{})
	info := &relaycommon.RelayInfo{
		UserId:          userID,
		TokenId:         tokenID,
		TokenKey:        "sk-task-token-88",
		UsingGroup:      "default",
		TokenGroup:      "default",
		OriginModelName: "seedance-2.0",
		RequestId:       "asset-subscription-snapshot",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{Action: constant.TaskActionGenerate, PublicTaskID: "task_subscription_snapshot"},
		PriceData: types.PriceData{
			Quota:      100,
			ModelPrice: 0.001,
		},
	}
	apiErr := service.PreConsumeBilling(c, 100, info)
	require.Nil(t, apiErr)
	require.Equal(t, service.BillingSourceSubscription, info.BillingSource)

	video, taskErr := queueAssetTaskForPreparation(c, info, &relay.TaskPreflightResult{Platform: constant.TaskPlatform("107"), Quota: 100})
	require.Nil(t, taskErr)
	require.Equal(t, "task_subscription_snapshot", video.TaskID)

	var task model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_subscription_snapshot").First(&task).Error)
	require.NotNil(t, task.PrivateData.BillingContext)
	require.Equal(t, service.BillingSourceSubscription, task.PrivateData.BillingSource)
	require.Equal(t, subID, task.PrivateData.SubscriptionId)
	require.InDelta(t, 1.5, task.PrivateData.BillingContext.SubscriptionWeight, 0.0001)
	require.Nil(t, task.PrivateData.BillingContext.SubscriptionWindow)

	beforeRefund := getControllerSubscriptionUsed(t, subID)
	service.RefundTaskQuota(context.Background(), &task, "restart refund")
	require.Equal(t, beforeRefund-150, getControllerSubscriptionUsed(t, subID), "refund must use persisted non-1 subscription weight after restart")
}

func TestAssetTaskQueuePersistsQueuedTaskAndReturnsImmediately(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()

	c := newControllerAssetTaskContext(`{
		"model":"seedance-2.0",
		"content":[{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}]
	}`)
	c.Request.Header.Set("Authorization", "Bearer sk-user-secret")
	common.SetContextKey(c, constant.ContextKeyChannelKey, `{"api_key":"sk-provider-secret","signed":"https://signed.example/?X-Goog-Signature=abc"}`)
	common.SetContextKey(c, constant.ContextKeyChannelId, 131)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeBytePlus)

	info := &relaycommon.RelayInfo{
		UserId:          7,
		TokenId:         11,
		UsingGroup:      "default",
		TokenGroup:      "default",
		OriginModelName: "seedance-2.0",
		RelayMode:       20,
		BillingSource:   service.BillingSourceWallet,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{Action: constant.TaskActionTextGenerate, PublicTaskID: "task_public_queued"},
		PriceData: types.PriceData{
			Quota:      123,
			ModelPrice: 0.02,
		},
	}
	preflight := &relay.TaskPreflightResult{Platform: constant.TaskPlatform("107"), Quota: 123}

	video, taskErr := queueAssetTaskForPreparation(c, info, preflight)
	require.Nil(t, taskErr)
	require.NotNil(t, video)
	require.Equal(t, "task_public_queued", video.ID)
	require.Equal(t, "task_public_queued", video.TaskID)
	require.Equal(t, dto.VideoStatusQueued, video.Status)
	require.Equal(t, 0, video.Progress)

	var task model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_public_queued").First(&task).Error)
	require.EqualValues(t, model.TaskStatusQueued, task.Status)
	require.Equal(t, model.TaskPreparationStatusPreparingAssets, task.PreparationStatus)
	require.Equal(t, 123, task.Quota)
	require.Equal(t, 7, task.UserId)
	require.Equal(t, 11, task.PrivateData.TokenId)
	require.Equal(t, service.BillingSourceWallet, task.PrivateData.BillingSource)
	require.NotNil(t, task.PrivateData.BillingContext)
	require.Empty(t, task.PrivateData.UpstreamTaskID)

	privateData, err := common.Marshal(task.PrivateData)
	require.NoError(t, err)
	persisted := string(task.NormalizedRequestPayload) + string(privateData) + string(task.Data)
	require.Contains(t, persisted, "asset://ast_1234567890abcdefABCDEF1234567890")
	require.NotContains(t, persisted, "sk-user-secret")
	require.NotContains(t, persisted, "sk-provider-secret")
	require.NotContains(t, persisted, "signed.example")
	require.NotContains(t, persisted, "X-Goog-Signature")
}

func TestRebuildAssetTaskContextRestoresCurrentTokenRestrictionsAndSpecificChannel(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreSettings := useControllerAssetTaskAccessSettingsForTest(t)
	defer restoreSettings()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP","auto":"Auto"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))

	seedControllerRelayUserToken(t, 7, 11, 1000, 1000)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("group", "vip").Error)
	require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
		"group":                   "auto",
		"model_limits_enabled":    true,
		"model_limits":            "seedance-2.0-fast,seedance-2.0-pro",
		"model_blacklist_enabled": true,
		"model_blacklist":         "seedance-2.0-pro",
		"cross_group_retry":       true,
	}).Error)
	task := seedControllerQueuedAssetTask(t, "task_restore_current_token_scope", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.NormalizedRequestPayload = []byte(`{"model":"seedance-2.0-fast","content":[{"type":"text","text":"prompt"}]}`)
	task.Properties.OriginModelName = "seedance-2.0-fast"
	task.PrivateData.BillingContext.OriginModelName = "seedance-2.0-fast"
	task.PrivateData.SpecificChannelId = 120
	require.NoError(t, model.DB.Save(task).Error)

	c, info, err := rebuildAssetTaskContext(task)
	require.NoError(t, err)
	require.Equal(t, "vip", common.GetContextKeyString(c, constant.ContextKeyUserGroup))
	require.Equal(t, "auto", common.GetContextKeyString(c, constant.ContextKeyTokenGroup))
	require.True(t, common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled))
	require.Equal(t, map[string]bool{"seedance-2.0-fast": true, "seedance-2.0-pro": true}, mustContextBoolMap(t, c, constant.ContextKeyTokenModelLimit))
	require.True(t, common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled))
	require.Equal(t, map[string]bool{"seedance-2.0-pro": true}, mustContextBoolMap(t, c, constant.ContextKeyTokenModelBlacklist))
	require.True(t, common.GetContextKeyBool(c, constant.ContextKeyTokenCrossGroupRetry))
	require.Equal(t, "120", common.GetContextKeyString(c, constant.ContextKeyTokenSpecificChannelId))
	require.Equal(t, "auto", common.GetContextKeyString(c, constant.ContextKeyUsingGroup))
	require.Equal(t, "auto", info.TokenGroup)
	require.Equal(t, "auto", info.UsingGroup)
}

func TestAssetTaskWorkerFailsClosedWhenQueuedUserIsNoLongerUsable(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T)
	}{
		{
			name: "deleted",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Delete(&model.User{}, 7).Error)
			},
		},
		{
			name: "disabled",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 7).Update("status", common.UserStatusDisabled).Error)
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			restoreDB := useControllerAssetTaskDBForTest(t)
			defer restoreDB()
			restorePricing := useControllerAssetTaskPricingForTest(t)
			defer restorePricing()
			restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
			defer restoreHooks()

			adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "must-not-submit-user-" + testCase.name}
			restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
			defer restoreAdaptor()

			seedControllerRelayUserToken(t, 7, 11, 1000, 500)
			seedControllerTaskChannel(t, 131, "sk-provider-user-"+testCase.name)
			task := seedControllerQueuedAssetTask(t, "task_user_"+testCase.name, model.TaskPreparationStatusPreparingAssets, "", 0)
			testCase.mutate(t)
			model.InitChannelCache()

			assetTaskWorkerTestNow = 1000
			processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			require.Zero(t, adaptor.providerCalls.Load(), "worker must fail before provider submission")
			expectedUserQuota := 1123
			expectedTokenRemain := 623
			expectedRefundLogs := int64(1)
			if testCase.name == "deleted" {
				expectedUserQuota = -1
				expectedTokenRemain = -1
			}
			assertQueuedAssetTaskFailedAndRefunded(t, task.TaskID, expectedUserQuota, expectedTokenRemain, expectedRefundLogs)
		})
	}
}

func TestAssetTaskWorkerFailsClosedWhenQueuedTokenIsNoLongerUsable(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T)
	}{
		{
			name: "deleted",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Delete(&model.Token{}, 11).Error)
			},
		},
		{
			name: "disabled",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Update("status", common.TokenStatusDisabled).Error)
			},
		},
		{
			name: "expired",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
					"status":       common.TokenStatusEnabled,
					"expired_time": int64(999),
				}).Error)
			},
		},
		{
			name: "exhausted",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
					"status":          common.TokenStatusEnabled,
					"remain_quota":    0,
					"unlimited_quota": false,
				}).Error)
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			restoreDB := useControllerAssetTaskDBForTest(t)
			defer restoreDB()
			restorePricing := useControllerAssetTaskPricingForTest(t)
			defer restorePricing()
			restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
			defer restoreHooks()

			adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "must-not-submit-token-" + testCase.name}
			restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
			defer restoreAdaptor()

			seedControllerRelayUserToken(t, 7, 11, 1000, 500)
			seedControllerTaskChannel(t, 131, "sk-provider-token-"+testCase.name)
			task := seedControllerQueuedAssetTask(t, "task_token_"+testCase.name, model.TaskPreparationStatusPreparingAssets, "", 0)
			testCase.mutate(t)
			model.InitChannelCache()

			assetTaskWorkerTestNow = 1000
			processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			require.Zero(t, adaptor.providerCalls.Load(), "worker must fail before provider submission")
			expectedTokenRemain := 623
			if testCase.name == "deleted" {
				expectedTokenRemain = -1
			} else if testCase.name == "exhausted" {
				expectedTokenRemain = 123
			}
			assertQueuedAssetTaskFailedAndRefunded(t, task.TaskID, 1123, expectedTokenRemain, 1)
		})
	}
}

func TestAssetTaskWorkerFailsClosedWhenQueuedTokenGroupIsNoLongerAuthorized(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T)
	}{
		{
			name: "unusable_group",
			mutate: func(t *testing.T) {
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))
			},
		},
		{
			name: "missing_group_ratio",
			mutate: func(t *testing.T) {
				require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
				require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			restoreDB := useControllerAssetTaskDBForTest(t)
			defer restoreDB()
			restorePricing := useControllerAssetTaskPricingForTest(t)
			defer restorePricing()
			restoreSettings := useControllerAssetTaskAccessSettingsForTest(t)
			defer restoreSettings()
			restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
			defer restoreHooks()

			adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "must-not-submit-group-" + testCase.name}
			restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
			defer restoreAdaptor()

			seedControllerRelayUserToken(t, 7, 11, 1000, 500)
			require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Update("group", "vip").Error)
			seedControllerTaskChannelWithPriority(t, 131, "sk-provider-group-"+testCase.name, 100, 1)
			require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 131).Update("group", "vip").Error)
			require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", 131).Update("group", "vip").Error)
			task := seedControllerQueuedAssetTask(t, "task_group_"+testCase.name, model.TaskPreparationStatusPreparingAssets, "", 0)
			testCase.mutate(t)
			model.InitChannelCache()

			assetTaskWorkerTestNow = 1000
			processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			require.Zero(t, adaptor.providerCalls.Load(), "worker must fail before provider submission")
			assertQueuedAssetTaskFailedAndRefunded(t, task.TaskID, 1123, 623, 1)
		})
	}
}

func TestAssetTaskWorkerFailsClosedWhenQueuedTokenModelAccessIsRevoked(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T)
	}{
		{
			name: "allowlist_excludes_model",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
					"model_limits_enabled": true,
					"model_limits":         "seedance-2.0-pro",
				}).Error)
			},
		},
		{
			name: "blacklist_blocks_model",
			mutate: func(t *testing.T) {
				require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", 11).Updates(map[string]any{
					"model_blacklist_enabled": true,
					"model_blacklist":         "seedance-2.0",
				}).Error)
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			restoreDB := useControllerAssetTaskDBForTest(t)
			defer restoreDB()
			restorePricing := useControllerAssetTaskPricingForTest(t)
			defer restorePricing()
			restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
			defer restoreHooks()

			adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "must-not-submit-model-" + testCase.name}
			restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
			defer restoreAdaptor()

			seedControllerRelayUserToken(t, 7, 11, 1000, 500)
			seedControllerTaskChannel(t, 131, "sk-provider-model-"+testCase.name)
			task := seedControllerQueuedAssetTask(t, "task_model_"+testCase.name, model.TaskPreparationStatusPreparingAssets, "", 0)
			testCase.mutate(t)
			model.InitChannelCache()

			assetTaskWorkerTestNow = 1000
			processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			require.Zero(t, adaptor.providerCalls.Load(), "worker must fail before provider submission")
			assertQueuedAssetTaskFailedAndRefunded(t, task.TaskID, 1123, 623, 1)
		})
	}
}

func TestAssetTaskWorkerHonorsQueuedSpecificChannelDuringSelection(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	adaptor := &controllerFakeTaskAdaptor{upstreamTaskID: "upstream-specific-channel"}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	seedControllerRelayUserToken(t, 7, 11, 1000, 500)
	seedControllerTaskChannelWithPriority(t, 131, "sk-provider-high-priority", 100, 1)
	seedControllerTaskChannelWithPriority(t, 132, "sk-provider-specific", 1, 1)
	task := seedControllerQueuedAssetTask(t, "task_specific_channel_worker", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.PrivateData.SpecificChannelId = 132
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, []int{132}, adaptor.channelsSeen)

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 132, stored.ChannelId)
	require.Equal(t, "upstream-specific-channel", stored.PrivateData.UpstreamTaskID)
}

func TestAssetTaskShouldWaitForAssetNotReadyAndRetryableMaterializeErrors(t *testing.T) {
	task := &model.Task{CreatedAt: 100}
	assetNotReady := types.NewError(errors.New("asset is preparing"), types.ErrorCodeAssetNotReady)
	require.True(t, assetTaskShouldWaitForAssets(task, assetNotReady, 399))
	require.True(t, assetTaskShouldWaitForAssets(task, context.DeadlineExceeded, 399))
	require.False(t, assetTaskShouldWaitForAssets(task, errors.New("definitive failure"), 399))
	require.False(t, assetTaskShouldWaitForAssets(task, assetNotReady, 400))
}

func mustContextBoolMap(t *testing.T, c *gin.Context, key constant.ContextKey) map[string]bool {
	t.Helper()
	value, ok := common.GetContextKey(c, key)
	require.True(t, ok)
	result, ok := value.(map[string]bool)
	require.True(t, ok)
	return result
}

func TestAssetTaskPreparationStaleLeaseTakeoverAndLateResultFenced(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	task := seedControllerQueuedAssetTask(t, "task_stale_takeover", model.TaskPreparationStatusPreparingAssets, "", 0)
	calls := make([]string, 0, 2)
	runLeasedAssetTaskFunc = func(ctx context.Context, taskID string, owner string, lease *taskPreparationLease) error {
		calls = append(calls, owner)
		if owner == "node-a" {
			return nil
		}
		return acceptLeasedAssetTask(nil, nil, task, owner, lease, &model.Channel{Id: 132}, &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream-node-b",
			TaskData:       []byte(`{"id":"upstream-node-b"}`),
			Platform:       constant.TaskPlatform("107"),
			Quota:          123,
		})
	}

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	assetTaskWorkerTestNow = 1050
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 0, processed, "fresh foreign lease must not be scanned for takeover")

	assetTaskWorkerTestNow = 1101
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed, "expired foreign lease must be claimable by another node")
	require.Equal(t, []string{"node-a", "node-b"}, calls)

	lateWon, err := model.MarkQueuedTaskAccepted("task_stale_takeover", "node-a", 1100, 1102, 1102, 131, constant.TaskPlatform("107"), 123, "late-upstream", []byte(`{"id":"late"}`), nil, 1102, 1200)
	require.NoError(t, err)
	require.False(t, lateWon, "old worker result must be fenced after takeover acceptance")

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", "task_stale_takeover").First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 132, stored.ChannelId)
	require.Equal(t, "upstream-node-b", stored.PrivateData.UpstreamTaskID)
}

func TestAssetTaskPreparationHeartbeatPreventsDuplicateProviderSubmitAcrossOriginalExpiry(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	var now atomic.Int64
	now.Store(1000)
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 2, now.Load)
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	providerEntered := make(chan int, 2)
	providerRelease := make(chan struct{})
	defer func() {
		select {
		case <-providerRelease:
		default:
			close(providerRelease)
		}
	}()
	adaptor := &controllerFakeTaskAdaptor{
		providerEntered: providerEntered,
		providerRelease: providerRelease,
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_6234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-heartbeat")
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_worker_heartbeat", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	type workerResult struct {
		processed int
		err       error
	}
	nodeAResult := make(chan workerResult, 1)
	go func() {
		processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
		nodeAResult <- workerResult{processed: processed, err: err}
	}()

	select {
	case channelID := <-providerEntered:
		require.Equal(t, 131, channelID)
	case <-time.After(2 * time.Second):
		t.Fatal("node-a did not reach the provider submit")
	}

	now.Store(1001)
	renewalDeadline := time.Now().Add(2 * time.Second)
	for {
		var leased model.Task
		require.NoError(t, model.DB.Select("preparation_lease_expires_at").Where("task_id = ?", task.TaskID).First(&leased).Error)
		if leased.PreparationLeaseExpiresAt > 1002 {
			break
		}
		if time.Now().After(renewalDeadline) {
			t.Fatal("node-a did not renew the task preparation lease")
		}
		time.Sleep(10 * time.Millisecond)
	}
	now.Store(1002)
	nodeBResult := make(chan workerResult, 1)
	go func() {
		processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
		nodeBResult <- workerResult{processed: processed, err: err}
	}()

	select {
	case <-providerEntered:
	case <-time.After(500 * time.Millisecond):
	}
	close(providerRelease)

	nodeA := <-nodeAResult
	require.NoError(t, nodeA.err)
	require.Equal(t, 1, nodeA.processed)
	var nodeB workerResult
	select {
	case nodeB = <-nodeBResult:
	case <-time.After(2 * time.Second):
		t.Fatal("node-b did not complete")
	}
	require.NoError(t, nodeB.err)
	require.EqualValues(t, 1, adaptor.providerCalls.Load(), "a live worker must renew before the original lease expiry so a takeover cannot duplicate the upstream write")

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, stored.Status)
	require.Equal(t, 131, stored.ChannelId)
}

func TestAssetTaskSubmitFencePreventsExpiredTakeoverAndPreservesLateUpstreamEvidence(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	var now atomic.Int64
	now.Store(1000)
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, now.Load)
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	providerEntered := make(chan int, 1)
	providerRelease := make(chan struct{})
	defer func() {
		select {
		case <-providerRelease:
		default:
			close(providerRelease)
		}
	}()
	adaptor := &controllerFakeTaskAdaptor{
		upstreamTaskID:  "upstream-after-expired-submit-lease",
		providerEntered: providerEntered,
		providerRelease: providerRelease,
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_a234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-submit-fence")
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_submit_fence", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	type workerResult struct {
		processed int
		err       error
	}
	nodeAResult := make(chan workerResult, 1)
	go func() {
		processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
		nodeAResult <- workerResult{processed: processed, err: err}
	}()

	select {
	case channelID := <-providerEntered:
		require.Equal(t, 131, channelID)
	case <-time.After(2 * time.Second):
		t.Fatal("node-a did not reach the provider submit")
	}

	now.Store(1101)
	claimed, err := model.ClaimTaskPreparationLease(task.TaskID, "node-b", 1, 1101, 1201)
	close(providerRelease)

	nodeA := <-nodeAResult
	require.NoError(t, err)
	require.False(t, claimed, "a durable submit fence must block takeover after the provider write starts")
	require.NoError(t, nodeA.err)
	require.Equal(t, 1, nodeA.processed)
	require.EqualValues(t, 1, adaptor.providerCalls.Load())
	require.EqualValues(t, 1, materializerCalls.Load())

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, "upstream-after-expired-submit-lease", stored.PrivateData.UpstreamTaskID)
}

func TestAssetTaskWorkerQuarantinesExpiredSubmitFenceWithoutProviderRetry(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	publicID := "ast_b234567890abcdefABCDEF1234567890"
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_expired_submit_fence", model.TaskPreparationStatusSubmitting, "node-crashed", 900)
	task.PreparationAttemptCount = 3
	task.ChannelId = 131
	task.Platform = constant.TaskPlatform("107")
	task.Quota = 123
	task.AcceptedAccountingActualQuota = 246
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)

	var providerCalls atomic.Int32
	runLeasedAssetTaskFunc = func(context.Context, string, string, *taskPreparationLease) error {
		providerCalls.Add(1)
		return nil
	}
	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Zero(t, providerCalls.Load(), "an expired submit fence must be quarantined without another provider write")

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Equal(t, 131, stored.ChannelId)
	require.Equal(t, constant.TaskPlatform("107"), stored.Platform)
	require.Equal(t, 123, stored.AcceptedAccountingReservedQuota)
	require.Equal(t, 246, stored.AcceptedAccountingActualQuota)
	require.Empty(t, stored.PrivateData.UpstreamTaskID)

	enriched, err := model.MarkQueuedTaskSubmissionUnknown(task.TaskID, 3, 1001, 1001, 131, constant.TaskPlatform("107"), 246, "upstream-after-crash", []byte(`{"id":"upstream-after-crash"}`), []string{publicID}, 1001, 2000)
	require.NoError(t, err)
	require.True(t, enriched, "the original generation must be able to append late upstream evidence")
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.Equal(t, "upstream-after-crash", stored.PrivateData.UpstreamTaskID)
	require.JSONEq(t, `{"id":"upstream-after-crash"}`, string(stored.Data))
}

func TestAssetTaskAcceptanceStillCommitsAfterLeaseRenewalError(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	var now atomic.Int64
	now.Store(1000)
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, now.Load)
	defer restoreHooks()

	task := seedControllerQueuedAssetTask(t, "task_accept_after_renewal_error", model.TaskPreparationStatusPreparingAssets, "", 0)
	var providerCalls atomic.Int32
	runLeasedAssetTaskFunc = func(ctx context.Context, taskID string, owner string, lease *taskPreparationLease) error {
		providerCalls.Add(1)
		lease.lose(assertErr("transient renewal database error"))
		return acceptLeasedAssetTask(nil, nil, task, owner, lease, &model.Channel{Id: 131}, &relay.TaskSubmitResult{
			UpstreamTaskID: "upstream-after-renewal-error",
			TaskData:       []byte(`{"id":"upstream-after-renewal-error"}`),
			Platform:       constant.TaskPlatform("107"),
			Quota:          123,
		})
	}

	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.EqualValues(t, 1, providerCalls.Load())

	var accepted model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&accepted).Error)
	require.EqualValues(t, model.TaskStatusSubmitted, accepted.Status)
	require.Equal(t, "upstream-after-renewal-error", accepted.PrivateData.UpstreamTaskID)

	now.Store(1101)
	processed, err = RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 0, processed)
	require.EqualValues(t, 1, providerCalls.Load(), "a committed upstream result must not be submitted again after the original lease expires")
}

func TestAssetTaskAcceptanceCASFailureQuarantinesKnownUpstreamResult(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	var now atomic.Int64
	now.Store(1000)
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, now.Load)
	defer restoreHooks()

	task := seedControllerQueuedAssetTask(t, "task_accept_unknown_outcome", model.TaskPreparationStatusPreparing, "node-a", 1200)
	task.PreparationAttemptCount = 3
	require.NoError(t, model.DB.Save(task).Error)
	renewalDone := make(chan struct{})
	close(renewalDone)
	lease := &taskPreparationLease{
		attemptCount: 3,
		stopRenewal:  make(chan struct{}),
		renewalDone:  renewalDone,
		cancel:       func() {},
		expiresAt:    1100,
		renewalError: assertErr("transient renewal database error"),
	}

	err := acceptLeasedAssetTask(nil, nil, task, "node-a", lease, &model.Channel{Id: 131}, &relay.TaskSubmitResult{
		UpstreamTaskID: "upstream-unknown-outcome",
		TaskData:       []byte(`{"id":"upstream-unknown-outcome"}`),
		Platform:       constant.TaskPlatform("107"),
		Quota:          123,
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "unknown outcome")
	require.Contains(t, err.Error(), "upstream-unknown-outcome")
	require.Contains(t, err.Error(), "manual reconciliation")

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Empty(t, stored.PreparationLeaseOwner)
	require.Zero(t, stored.PreparationLeaseExpiresAt)
	require.Equal(t, 131, stored.ChannelId)
	require.Equal(t, "upstream-unknown-outcome", stored.PrivateData.UpstreamTaskID)
	require.JSONEq(t, `{"id":"upstream-unknown-outcome"}`, string(stored.Data))

	var providerCalls atomic.Int32
	runLeasedAssetTaskFunc = func(ctx context.Context, taskID string, owner string, lease *taskPreparationLease) error {
		providerCalls.Add(1)
		return nil
	}
	now.Store(1300)
	processed, runErr := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, runErr)
	require.Equal(t, 0, processed)
	require.Zero(t, providerCalls.Load(), "an unknown upstream result must never be submitted again automatically")
}

func TestAssetTaskSubmitCancellationQuarantinesBeforeAutomaticRetry(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restorePricing := useControllerAssetTaskPricingForTest(t)
	defer restorePricing()
	var now atomic.Int64
	now.Store(1000)
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, now.Load)
	defer restoreHooks()
	oldRetryTimes := common.RetryTimes
	common.RetryTimes = 0
	defer func() { common.RetryTimes = oldRetryTimes }()

	var materializerCalls atomic.Int32
	restoreMaterializer := service.RegisterAssetMaterializer(constant.ChannelTypeBytePlus, controllerAssetMaterializerWithCounter{calls: &materializerCalls})
	defer restoreMaterializer()
	providerEntered := make(chan int, 1)
	providerRelease := make(chan struct{})
	defer close(providerRelease)
	adaptor := &controllerFakeTaskAdaptor{
		providerEntered: providerEntered,
		providerRelease: providerRelease,
	}
	restoreAdaptor := registerTaskAdaptorForTest(constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), adaptor)
	defer restoreAdaptor()

	publicID := "ast_7234567890abcdefABCDEF1234567890"
	seedControllerRelayUserToken(t, 7, 11, 10000, 10000)
	seedControllerTaskChannel(t, 131, "sk-provider-cancel")
	seedControllerAsset(t, 7, publicID, time.Now().Add(time.Hour).Unix())
	task := seedControllerQueuedAssetTask(t, "task_submit_canceled", model.TaskPreparationStatusPreparingAssets, "", 0)
	task.ChannelId = 0
	task.NormalizedRequestPayload = []byte(seedanceTaskBody(publicID))
	require.NoError(t, model.DB.Save(task).Error)
	model.InitChannelCache()

	workerCtx, cancelWorker := context.WithCancel(context.Background())
	type workerResult struct {
		processed int
		err       error
	}
	workerDone := make(chan workerResult, 1)
	go func() {
		processed, err := RunAssetTaskWorkerOnce(workerCtx, "node-a", 10)
		workerDone <- workerResult{processed: processed, err: err}
	}()

	select {
	case channelID := <-providerEntered:
		require.Equal(t, 131, channelID)
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not enter provider submit")
	}
	cancelWorker()

	select {
	case result := <-workerDone:
		require.NoError(t, result.err)
		require.Equal(t, 1, result.processed)
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not stop after submit cancellation")
	}

	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", task.TaskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusUnknown, stored.Status)
	require.Equal(t, model.TaskPreparationStatusUnknownOutcome, stored.PreparationStatus)
	require.Empty(t, stored.PrivateData.UpstreamTaskID)
	require.Equal(t, 131, stored.ChannelId)
	require.Equal(t, constant.TaskPlatform(fmt.Sprint(constant.ChannelTypeBytePlus)), stored.Platform)
	require.Equal(t, 123, stored.Quota)
	require.Equal(t, 123, stored.AcceptedAccountingReservedQuota)
	require.Equal(t, int(0.001*float64(common.QuotaPerUnit)), stored.AcceptedAccountingActualQuota)
	require.JSONEq(t, `{}`, string(stored.Data))
	require.EqualValues(t, 1, adaptor.providerCalls.Load())

	now.Store(1200)
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-b", 10)
	require.NoError(t, err)
	require.Equal(t, 0, processed)
	require.EqualValues(t, 1, adaptor.providerCalls.Load(), "a canceled in-flight submit must not be attempted again automatically")
}

func TestAssetTaskAcceptedWinnerExtendsRetentionAndLateWorkerDoesNot(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	publicID := "ast_1234567890abcdefABCDEF1234567890"
	task := seedControllerQueuedAssetTask(t, "task_retention", model.TaskPreparationStatusPreparing, "node-a", 2000)
	seedControllerAsset(t, 7, publicID, 100)
	task.NormalizedRequestPayload = []byte(`{"content":[{"type":"image_url","image_url":{"url":"asset://` + publicID + `"}}]}`)
	require.NoError(t, model.DB.Save(task).Error)

	assetTaskWorkerTestNow = 1900
	err := acceptAssetTask(nil, nil, task, "node-a", 2000, &model.Channel{Id: 131}, &relay.TaskSubmitResult{
		UpstreamTaskID: "upstream-accepted",
		TaskData:       []byte(`{"id":"upstream-accepted"}`),
		Platform:       constant.TaskPlatform("107"),
		Quota:          123,
	})
	require.NoError(t, err)

	var accepted model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&accepted).Error)
	require.GreaterOrEqual(t, accepted.LastUsedAt, int64(1))
	require.Greater(t, accepted.SourceExpiresAt, int64(100))
	winnerLastUsed := accepted.LastUsedAt
	winnerExpires := accepted.SourceExpiresAt

	lateWon, err := model.MarkQueuedTaskAccepted("task_retention", "node-b", 3000, winnerLastUsed+10, winnerLastUsed+10, 132, constant.TaskPlatform("107"), 123, "late-upstream", []byte(`{"id":"late"}`), []string{publicID}, winnerLastUsed+10, winnerExpires+1000)
	require.NoError(t, err)
	require.False(t, lateWon)

	var afterLate model.Asset
	require.NoError(t, model.DB.Where("public_id = ?", publicID).First(&afterLate).Error)
	require.Equal(t, winnerLastUsed, afterLate.LastUsedAt)
	require.Equal(t, winnerExpires, afterLate.SourceExpiresAt)
}

func TestAssetTaskWorkerPreparationFailureRefundsOnceForLateResult(t *testing.T) {
	restoreDB := useControllerAssetTaskDBForTest(t)
	defer restoreDB()
	restoreHooks := useAssetTaskWorkerHooksForTest(t, 100, func() int64 { return assetTaskWorkerTestNow })
	defer restoreHooks()

	require.NoError(t, model.DB.Create(&model.User{Id: 7, Username: "task_worker_refund", Quota: 1000, Status: common.UserStatusEnabled, AffCode: "task_worker_refund"}).Error)
	require.NoError(t, model.DB.Create(&model.Token{Id: 11, UserId: 7, Key: "sk-task-worker-refund", Name: "task-worker-refund", Status: common.TokenStatusEnabled, RemainQuota: 500}).Error)
	require.NoError(t, model.DB.Create(&model.Channel{Id: 131, Name: "task-worker-refund", Key: "sk-channel", Status: common.ChannelStatusEnabled}).Error)

	task := seedControllerQueuedAssetTask(t, "task_worker_refund_once", model.TaskPreparationStatusPreparingAssets, "", 0)
	runLeasedAssetTaskFunc = func(ctx context.Context, taskID string, owner string, lease *taskPreparationLease) error {
		stored, ok, err := model.GetByOnlyTaskId(taskID)
		require.NoError(t, err)
		require.True(t, ok)
		return failLeasedAssetTaskPreparation(ctx, stored, owner, lease, assertErr("materialize failed"))
	}

	assetTaskWorkerTestNow = 1000
	processed, err := RunAssetTaskWorkerOnce(context.Background(), "node-a", 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	lateErr := failAssetTaskPreparation(context.Background(), task, "node-b", 1100, assertErr("late materialize failed"))
	require.Error(t, lateErr)

	var user model.User
	require.NoError(t, model.DB.Where("id = ?", 7).First(&user).Error)
	require.Equal(t, 1123, user.Quota)
	var token model.Token
	require.NoError(t, model.DB.Where("id = ?", 11).First(&token).Error)
	require.Equal(t, 623, token.RemainQuota)
	var refundLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	require.EqualValues(t, 1, refundLogs)
}

type assertErr string

func (e assertErr) Error() string {
	return string(e)
}

func newControllerAssetTaskContext(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newControllerRelayTaskContext(body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func useControllerAssetTaskDBForTest(t *testing.T) func() {
	t.Helper()
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldCommonKeyCol := modelCommonKeyCol
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Task{}, &model.TaskAcceptedAccountingLedger{}, &model.TaskAcceptedAccountingLogLedger{}, &model.TemporaryChannelModelSpend{}, &model.Asset{}, &model.AssetBinding{}, &model.Ability{}, &model.User{}, &model.Token{}, &model.Channel{}, &model.Log{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.UserSubscriptionContract{}, &model.SubscriptionPreConsumeRecord{}, &model.SubscriptionDiscountAccount{}, &model.SubscriptionDiscountEntry{}, &model.RecallLifecycleEvent{}, &model.QuotaLifecycleState{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	modelCommonKeyCol = "`key`"
	return func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.RedisEnabled = oldRedisEnabled
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		modelCommonKeyCol = oldCommonKeyCol
		model.InitChannelCache()
		_ = sqlDB.Close()
	}
}

func useControllerAssetTaskRedisForTest(t *testing.T) func() {
	t.Helper()
	mr := miniredis.RunT(t)
	oldRDB := common.RDB
	oldRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	return func() {
		_ = common.RDB.Close()
		common.RDB = oldRDB
		common.RedisEnabled = oldRedisEnabled
		mr.Close()
	}
}

func useControllerAssetTaskPricingForTest(t *testing.T) func() {
	t.Helper()
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	originalModelPrice := ratio_setting.ModelPrice2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{"seedance-2.0":0.001}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	return func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(originalModelPrice))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	}
}

func useControllerAssetTaskAccessSettingsForTest(t *testing.T) func() {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	return func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
	}
}

var assetTaskWorkerTestNow int64

func useAssetTaskWorkerHooksForTest(t *testing.T, leaseSeconds int64, now func() int64) func() {
	t.Helper()
	oldRunner := runLeasedAssetTaskFunc
	oldNow := assetTaskWorkerNowUnix
	oldLease := assetTaskPreparationLeaseSeconds
	assetTaskWorkerNowUnix = now
	assetTaskPreparationLeaseSeconds = leaseSeconds
	return func() {
		runLeasedAssetTaskFunc = oldRunner
		assetTaskWorkerNowUnix = oldNow
		assetTaskPreparationLeaseSeconds = oldLease
	}
}

func seedControllerQueuedAssetTask(t *testing.T, taskID string, prepStatus string, leaseOwner string, leaseExpiresAt int64) *model.Task {
	t.Helper()
	task := &model.Task{
		TaskID:                    taskID,
		UserId:                    7,
		Group:                     "default",
		ChannelId:                 131,
		Platform:                  constant.TaskPlatform("107"),
		Quota:                     123,
		Action:                    constant.TaskActionGenerate,
		Status:                    model.TaskStatusQueued,
		PreparationStatus:         prepStatus,
		PreparationLeaseOwner:     leaseOwner,
		PreparationLeaseExpiresAt: leaseExpiresAt,
		NormalizedRequestPayload:  []byte(`{"model":"seedance-2.0","content":[]}`),
		Data:                      []byte(`{}`),
		PrivateData: model.TaskPrivateData{
			BillingSource: service.BillingSourceWallet,
			TokenId:       11,
			BillingContext: &model.TaskBillingContext{
				OriginModelName: "seedance-2.0",
			},
		},
		Properties: model.Properties{OriginModelName: "seedance-2.0"},
	}
	require.NoError(t, model.DB.Create(task).Error)
	return task
}

func seedControllerAsset(t *testing.T, userID int, publicID string, sourceExpiresAt int64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.Asset{
		PublicId:        publicID,
		UserId:          userID,
		AssetType:       "Image",
		Status:          model.AssetStatusActive,
		SourceStatus:    model.AssetSourceStatusAvailable,
		StorageBackend:  "gcs",
		StorageBucket:   "bucket",
		ObjectKey:       "assets/" + publicID,
		SourceExpiresAt: sourceExpiresAt,
		CreatedAt:       1,
		UpdatedAt:       1,
	}).Error)
}

func seedControllerRelayUserToken(t *testing.T, userID int, tokenID int, userQuota int, tokenQuota int) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{Id: userID, Username: fmt.Sprintf("task-user-%d", userID), Group: "default", Quota: userQuota, Status: common.UserStatusEnabled, AffCode: fmt.Sprintf("task-user-%d", userID)}).Error)
	require.NoError(t, model.DB.Create(&model.Token{Id: tokenID, UserId: userID, Key: fmt.Sprintf("sk-task-token-%d", tokenID), Name: "task-token", Status: common.TokenStatusEnabled, RemainQuota: tokenQuota}).Error)
}

func getControllerSubscriptionUsed(t *testing.T, subscriptionID int) int64 {
	t.Helper()
	var sub model.UserSubscription
	require.NoError(t, model.DB.Select("amount_used").Where("id = ?", subscriptionID).First(&sub).Error)
	return sub.AmountUsed
}

func getControllerUserQuota(t *testing.T, userID int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("quota").Where("id = ?", userID).First(&user).Error)
	return user.Quota
}

func getControllerUserUsedQuota(t *testing.T, userID int) int {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", userID).First(&user).Error)
	return user.UsedQuota
}

func getControllerTokenRemain(t *testing.T, tokenID int) int {
	t.Helper()
	var token model.Token
	require.NoError(t, model.DB.Select("remain_quota").Where("id = ?", tokenID).First(&token).Error)
	return token.RemainQuota
}

func assertQueuedAssetTaskFailedAndRefunded(t *testing.T, taskID string, expectedUserQuota int, expectedTokenRemain int, expectedRefundLogs int64) {
	t.Helper()
	var stored model.Task
	require.NoError(t, model.DB.Where("task_id = ?", taskID).First(&stored).Error)
	require.EqualValues(t, model.TaskStatusFailure, stored.Status)
	require.Equal(t, model.TaskPreparationStatusFailed, stored.PreparationStatus)
	require.NotEmpty(t, stored.FailReason)
	if expectedUserQuota >= 0 {
		require.Equal(t, expectedUserQuota, getControllerUserQuota(t, 7))
	}
	if expectedTokenRemain >= 0 {
		require.Equal(t, expectedTokenRemain, getControllerTokenRemain(t, 11))
	}
	var refundLogs int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeRefund).Count(&refundLogs).Error)
	require.EqualValues(t, expectedRefundLogs, refundLogs)
}

func countControllerConsumeLogs(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("type = ?", model.LogTypeConsume).Count(&count).Error)
	return count
}

func countControllerAccountingLedgers(t *testing.T, taskID string, step string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.TaskAcceptedAccountingLedger{}).Where("task_id = ? AND step = ?", taskID, step).Count(&count).Error)
	return count
}

func seedControllerTaskChannel(t *testing.T, id int, key string) {
	t.Helper()
	seedControllerTaskChannelWithPriority(t, id, key, 100, 1)
}

func seedControllerTaskChannelWithPriority(t *testing.T, id int, key string, priority int64, weight uint) {
	seedControllerTaskChannelTypeWithPriority(t, id, constant.ChannelTypeBytePlus, key, priority, weight)
}

func seedControllerTaskChannelTypeWithPriority(t *testing.T, id int, channelType int, key string, priority int64, weight uint) {
	t.Helper()
	channel := &model.Channel{
		Id:       id,
		Type:     channelType,
		Key:      key,
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("asset-task-%d", id),
		Group:    "default",
		Models:   "seedance-2.0",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "seedance-2.0",
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func seedControllerModelAPISeedanceChannel(t *testing.T, id int, baseURL string) {
	t.Helper()
	priority := int64(100)
	weight := uint(1)
	require.NoError(t, model.DB.Create(&model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeModelAPISeedance,
		Key:      "sk-modelapi-provider",
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("modelapi-seedance-%d", id),
		Group:    "default",
		Models:   "seedance-2.0",
		BaseURL:  common.GetPointer(baseURL),
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "seedance-2.0",
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func seedControllerModelAPISeedanceMultiKeyChannel(t *testing.T, id int) {
	t.Helper()
	seedControllerTaskChannelTypeWithPriority(t, id, constant.ChannelTypeModelAPISeedance, "modelapi-key-a\nmodelapi-key-b", 100, 1)
	channelInfo := model.ChannelInfo{
		IsMultiKey:           true,
		MultiKeySize:         2,
		MultiKeyMode:         constant.MultiKeyModePolling,
		MultiKeyPollingIndex: 1,
		MultiKeyStatusList: map[int]int{
			0: common.ChannelStatusManuallyDisabled,
		},
	}
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", id).Update("channel_info", channelInfo).Error)
}

func seedControllerTechMobiTaskChannel(t *testing.T, id int) {
	t.Helper()
	seedControllerTaskChannelTypeWithPriority(t, id, constant.ChannelTypeTechMobiVideo, "techmobi-key-a\ntechmobi-key-b", 100, 1)
	mapping := `{"seedance-2.0":"doubao/doubao-seedance-2-0-260128"}`
	channelInfo := model.ChannelInfo{
		IsMultiKey:           true,
		MultiKeySize:         2,
		MultiKeyMode:         constant.MultiKeyModePolling,
		MultiKeyPollingIndex: 1,
		MultiKeyStatusList: map[int]int{
			0: common.ChannelStatusManuallyDisabled,
		},
	}
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", id).Updates(map[string]any{
		"model_mapping": mapping,
		"channel_info":  channelInfo,
	}).Error)
}

func seedanceTaskBody(publicID string) string {
	return fmt.Sprintf(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"asset://%s"},"role":"reference_image"}]}`, publicID)
}

type controllerAssetMaterializerWithCounter struct {
	calls *atomic.Int32
}

type controllerProcessingThenActiveMaterializer struct {
	getCalls    *atomic.Int32
	activeAfter int32
}

func (m controllerProcessingThenActiveMaterializer) CreateAsset(_ context.Context, input service.AssetMaterializeInput) (service.AssetMaterializeResult, error) {
	return service.AssetMaterializeResult{
		UpstreamGroupID: "group",
		UpstreamAssetID: "upstream-" + input.Asset.PublicId,
		Status:          model.AssetStatusProcessing,
	}, nil
}

func (m controllerProcessingThenActiveMaterializer) GetAsset(_ context.Context, _ service.AssetMaterializeInput, upstreamAssetID string) (service.AssetMaterializeResult, error) {
	call := m.getCalls.Add(1)
	status := model.AssetStatusProcessing
	if call > m.activeAfter {
		status = model.AssetStatusActive
	}
	return service.AssetMaterializeResult{UpstreamAssetID: upstreamAssetID, Status: status}, nil
}

func (m controllerAssetMaterializerWithCounter) CreateAsset(ctx context.Context, input service.AssetMaterializeInput) (service.AssetMaterializeResult, error) {
	if m.calls != nil {
		m.calls.Add(1)
	}
	return controllerAssetMaterializer{}.CreateAsset(ctx, input)
}

func (m controllerAssetMaterializerWithCounter) GetAsset(ctx context.Context, input service.AssetMaterializeInput, upstreamAssetID string) (service.AssetMaterializeResult, error) {
	return controllerAssetMaterializer{}.GetAsset(ctx, input, upstreamAssetID)
}

type controllerFakeTaskAdaptor struct {
	validateCalls     atomic.Int32
	estimateCalls     atomic.Int32
	providerCalls     atomic.Int32
	upstreamTaskID    string
	estimatedRatios   map[string]float64
	adjustedRatios    map[string]float64
	failByChannel     map[int]error
	failHTTPByChannel map[int]int
	channelsSeen      []int
	providerEntered   chan<- int
	providerRelease   <-chan struct{}
}

var _ channel.TaskAdaptor = (*controllerFakeTaskAdaptor)(nil)

func (a *controllerFakeTaskAdaptor) Init(info *relaycommon.RelayInfo) {}

func (a *controllerFakeTaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	a.validateCalls.Add(1)
	var req dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
	}
	info.Action = constant.TaskActionGenerate
	info.OriginModelName = req.Model
	return nil
}

func (a *controllerFakeTaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	a.estimateCalls.Add(1)
	return a.estimatedRatios
}

func (a *controllerFakeTaskAdaptor) AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64 {
	return a.adjustedRatios
}

func (a *controllerFakeTaskAdaptor) AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int {
	return 0
}

func (a *controllerFakeTaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return "https://provider.example/tasks", nil
}

func (a *controllerFakeTaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	return nil
}

func (a *controllerFakeTaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return storage, nil
}

func (a *controllerFakeTaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	a.providerCalls.Add(1)
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	a.channelsSeen = append(a.channelsSeen, channelID)
	if a.providerEntered != nil {
		a.providerEntered <- channelID
	}
	if a.providerRelease != nil {
		select {
		case <-a.providerRelease:
		case <-c.Request.Context().Done():
			return nil, c.Request.Context().Err()
		}
	}
	if status := a.failHTTPByChannel[channelID]; status > 0 {
		return &http.Response{
			StatusCode: status,
			Body:       io.NopCloser(strings.NewReader(`{"error":"retryable upstream failure"}`)),
			Header:     make(http.Header),
		}, nil
	}
	if err := a.failByChannel[channelID]; err != nil {
		return nil, err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"accepted":true}`)),
		Header:     make(http.Header),
	}, nil
}

func (a *controllerFakeTaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (string, []byte, *dto.TaskError) {
	taskID := a.upstreamTaskID
	if taskID == "" {
		taskID = fmt.Sprintf("upstream-channel-%d", common.GetContextKeyInt(c, constant.ContextKeyChannelId))
	}
	video := dto.NewOpenAIVideo()
	video.ID = taskID
	video.TaskID = taskID
	video.Model = info.OriginModelName
	video.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, video)
	data, err := common.Marshal(video)
	if err != nil {
		return "", nil, service.TaskErrorWrapperLocal(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return taskID, data, nil
}

func (a *controllerFakeTaskAdaptor) GetModelList() []string {
	return []string{"seedance-2.0"}
}

func (a *controllerFakeTaskAdaptor) GetChannelName() string {
	return "fake-byteplus"
}

func (a *controllerFakeTaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	return nil, nil
}

func (a *controllerFakeTaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	return nil, nil
}
