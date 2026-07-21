package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	asyncImagePricingTestModel        = "verified-4k-image-pricing-test"
	asyncImagePricingTestGroup        = "verified-4k-pricing-test"
	asyncImagePricingTestInitialQuota = 5_000_000
	asyncImagePricingTestQuota        = 1_800_000
)

func setupRelayAsyncImagePricingTest(t *testing.T, resolutionPrices string) (*model.User, *model.Token, *model.Channel) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.Channel{},
		&model.Task{},
		&model.TaskWebhook{},
		&model.ImageBillingReservation{},
		&model.BillingAdjustmentOutbox{},
		&model.ImageTaskBillingLogOutbox{},
		&model.ImageTaskBillingLogReceipt{},
		&model.ImageInputCleanup{},
		&model.SystemTask{},
		&model.SystemTaskLock{},
	))

	previousDB := model.DB
	previousLogDB := model.LOG_DB
	previousRedisEnabled := common.RedisEnabled
	previousBatchUpdateEnabled := common.BatchUpdateEnabled
	previousMainDatabaseType := common.MainDatabaseType()
	previousLogDatabaseType := common.LogDatabaseType()
	previousGroupRatios := ratio_setting.GroupRatio2JSONString()
	previousResolutionPrices := ratio_setting.ImageResolutionPrice2JSONString()
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"`+asyncImagePricingTestGroup+`":1.5}`))
	require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(resolutionPrices))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(previousGroupRatios))
		require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(previousResolutionPrices))
		model.DB = previousDB
		model.LOG_DB = previousLogDB
		common.RedisEnabled = previousRedisEnabled
		common.BatchUpdateEnabled = previousBatchUpdateEnabled
		common.SetDatabaseTypes(previousMainDatabaseType, previousLogDatabaseType)
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			_ = sqlDB.Close()
		}
	})

	t.Setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "test-access-key")
	t.Setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "test-secret-key")
	t.Setenv("CLOUDFLARE_R2_ACCOUNT_ID", "test-account")
	t.Setenv("CLOUDFLARE_R2_BUCKET", "test-bucket")
	t.Setenv("CLOUDFLARE_R2_INPUT_BUCKET", "test-input-bucket")
	t.Setenv("CLOUDFLARE_R2_PUBLIC_BASE", "https://cdn.example.com")
	t.Setenv("CRYPTO_SECRET", "test-crypto-secret")
	t.Setenv("ASYNC_IMAGE_ENCRYPTED_WRITES_ENABLED", "true")
	t.Setenv("ASYNC_IMAGE_PAYLOAD_V7_WRITES_ENABLED", "true")

	user := &model.User{
		Username: "verified-4k-pricing-user",
		Password: "password",
		Quota:    asyncImagePricingTestInitialQuota,
		Status:   common.UserStatusEnabled,
		Group:    asyncImagePricingTestGroup,
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "verified-4k-pricing-token",
		Name:        "verified 4k pricing token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: asyncImagePricingTestInitialQuota,
	}
	require.NoError(t, model.DB.Create(token).Error)
	baseURL := "https://openai.example.com"
	channel := &model.Channel{
		Type:        constant.ChannelTypeOpenAI,
		Key:         "verified-4k-pricing-channel-key",
		Name:        "verified 4k pricing channel",
		Status:      common.ChannelStatusEnabled,
		CreatedTime: 1_700_000_000,
		BaseURL:     &baseURL,
		Models:      asyncImagePricingTestModel,
		Group:       asyncImagePricingTestGroup,
	}
	require.NoError(t, model.DB.Create(channel).Error)
	return user, token, channel
}

func relayAsyncImagePricingRequest(t *testing.T, user *model.User, token *model.Token, channel *model.Channel) *httptest.ResponseRecorder {
	t.Helper()
	routing := &dto.ImageRoutingConfig{
		Version: dto.ImageRoutingVersion1,
		Profiles: []dto.ImageRoutingProfile{{
			Model:               asyncImagePricingTestModel,
			Protocol:            dto.ImageRoutingProtocolImagesGenerations,
			UpstreamPath:        "/v1/images/generations",
			Operations:          []dto.ImageOperation{dto.ImageOperationGeneration},
			Resolutions:         []string{"4K"},
			DefaultResolution:   "4K",
			MaxOutputImages:     2,
			AllowedCombinations: []dto.ImageRoutingCombination{{Operation: dto.ImageOperationGeneration, Resolution: "4K"}},
			VerificationStatus:  dto.ImageRoutingVerificationProductionVerified,
		}},
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/v1/images/generations",
		strings.NewReader(`{"model":"`+asyncImagePricingTestModel+`","prompt":"draw two observatories","n":2}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	c.Set(common.RequestIdKey, "request-verified-4k-pricing")
	common.SetContextKey(c, constant.ContextKeyOriginalModel, asyncImagePricingTestModel)
	common.SetContextKey(c, constant.ContextKeyUserId, user.Id)
	common.SetContextKey(c, constant.ContextKeyUserQuota, user.Quota)
	common.SetContextKey(c, constant.ContextKeyUserGroup, asyncImagePricingTestGroup)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, asyncImagePricingTestGroup)
	common.SetContextKey(c, constant.ContextKeyTokenId, token.Id)
	common.SetContextKey(c, constant.ContextKeyTokenKey, token.Key)
	common.SetContextKey(c, constant.ContextKeyTokenUnlimited, false)
	common.SetContextKey(c, constant.ContextKeyUserSetting, dto.UserSetting{
		BillingPreference:     "wallet_only",
		QuotaWarningThreshold: -1,
	})
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, channel.CreatedTime)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, *channel.BaseURL)
	common.SetContextKey(c, constant.ContextKeyChannelKey, channel.Key)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{ImageRouting: routing})
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{})
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})

	Relay(c, types.RelayFormatOpenAIImage)
	return recorder
}

func TestRelayAsyncImageUsesVerifiedDefaultResolutionForReservationAndSettlement(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user, token, channel := setupRelayAsyncImagePricingTest(
		t,
		`{"`+asyncImagePricingTestModel+`":{"4K":1.2}}`,
	)

	recorder := relayAsyncImagePricingRequest(t, user, token, channel)

	require.Equal(t, http.StatusAccepted, recorder.Code, recorder.Body.String())
	var task model.Task
	require.NoError(t, model.DB.Where("platform = ?", constant.TaskPlatformOpenAIImage).First(&task).Error)
	assert.Equal(t, asyncImagePricingTestQuota, task.Quota)
	assert.Equal(t, asyncImagePricingTestQuota, task.PrivateData.TokenPreConsumed)
	require.NotNil(t, task.PrivateData.BillingContext)
	assert.Equal(t, 1.2, task.PrivateData.BillingContext.ModelPrice)
	assert.Equal(t, 1.5, task.PrivateData.BillingContext.GroupRatio)
	assert.Equal(t, map[string]float64{"n": 2}, task.PrivateData.BillingContext.OtherRatios)
	require.NotNil(t, task.PrivateData.BillingContext.ImageRequest)
	assert.Equal(t, "4K", task.PrivateData.BillingContext.ImageRequest.Resolution)
	assert.Equal(t, uint(2), task.PrivateData.BillingContext.ImageRequest.Count)
	billingInput, err := task.PrivateData.BillingContext.ResolveBillingRequestInput()
	require.NoError(t, err)
	require.NotNil(t, billingInput)
	var billingSnapshot map[string]any
	require.NoError(t, common.Unmarshal(billingInput.Body, &billingSnapshot))
	assert.Equal(t, "4K", billingSnapshot["resolution"])
	assert.Equal(t, float64(2), billingSnapshot["n"])

	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, model.ImageBillingReservationActive, reservation.Status)
	assert.Equal(t, asyncImagePricingTestQuota, reservation.ExpectedQuota)
	assert.Equal(t, asyncImagePricingTestQuota, reservation.WalletReserved)
	assert.Equal(t, asyncImagePricingTestQuota, reservation.TokenReserved)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota-asyncImagePricingTestQuota, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota-asyncImagePricingTestQuota, token.RemainQuota)
	assert.Equal(t, asyncImagePricingTestQuota, token.UsedQuota)

	actualQuota, clamp, err := service.CalculateImageTaskQuotaWithCount(&task, &dto.Usage{}, 2)
	require.NoError(t, err)
	assert.Nil(t, clamp)
	assert.Equal(t, asyncImagePricingTestQuota, actualQuota)
	service.RecalculateTaskQuota(context.Background(), &task, actualQuota, "verified 4K output count")
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota-asyncImagePricingTestQuota, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota-asyncImagePricingTestQuota, token.RemainQuota)
	assert.Equal(t, asyncImagePricingTestQuota, token.UsedQuota)
	var adjustmentCount int64
	require.NoError(t, model.DB.Model(&model.BillingAdjustmentOutbox{}).Count(&adjustmentCount).Error)
	assert.Zero(t, adjustmentCount)
}

func TestRelayAsyncImageRejectsMissingVerifiedDefaultResolutionPriceBeforeReservation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user, token, channel := setupRelayAsyncImagePricingTest(t, `{}`)

	recorder := relayAsyncImagePricingRequest(t, user, token, channel)

	require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	assert.Contains(t, recorder.Body.String(), "image resolution 4K does not have a configured price")
	var taskCount int64
	require.NoError(t, model.DB.Model(&model.Task{}).Count(&taskCount).Error)
	assert.Zero(t, taskCount)
	var reservationCount int64
	require.NoError(t, model.DB.Model(&model.ImageBillingReservation{}).Count(&reservationCount).Error)
	assert.Zero(t, reservationCount)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, asyncImagePricingTestInitialQuota, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}
