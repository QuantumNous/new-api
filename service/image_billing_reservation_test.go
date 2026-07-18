package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedServiceImageBillingReservation(t *testing.T, suffix string, quota int) (*model.User, *model.Token, *model.Task) {
	t.Helper()
	truncate(t)
	user := &model.User{
		Username: "service-image-reservation-" + suffix,
		Password: "password",
		Quota:    1000,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, model.DB.Create(user).Error)
	token := &model.Token{
		UserId:      user.Id,
		Key:         "service-image-token-" + suffix,
		Name:        "image token",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
	}
	require.NoError(t, model.DB.Create(token).Error)
	now := common.GetTimestamp()
	task := &model.Task{
		TaskID:     "task_service_image_reservation_" + suffix,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     user.Id,
		Status:     model.TaskStatusReserving,
		Progress:   "0%",
		SubmitTime: now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, model.InsertPreparedImageTask(task, nil, &model.ImageBillingReservation{
		TaskID:        task.TaskID,
		RequestID:     "request-service-image-reservation-" + suffix,
		UserID:        user.Id,
		TokenID:       token.Id,
		TokenRequired: true,
		ExpectedQuota: quota,
	}))
	return user, token, task
}

func TestPreConsumeBillingUsesImageReservationLedgerAndRefundsIdempotently(t *testing.T) {
	user, token, task := seedServiceImageBillingReservation(t, "wallet", 120)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:                "request-service-image-reservation-wallet",
		UserId:                   user.Id,
		TokenId:                  token.Id,
		TokenKey:                 token.Key,
		OriginModelName:          "gpt-image-1",
		ForcePreConsume:          true,
		BillingReservationTaskID: task.TaskID,
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := PreConsumeBilling(c, 120, info)
	require.Nil(t, apiErr)
	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 120, reservation.WalletReserved)
	assert.Equal(t, 120, reservation.TokenReserved)
	assert.Equal(t, 880, getUserQuota(t, user.Id))
	assert.Equal(t, 880, getTokenRemainQuota(t, token.Id))
	assert.Equal(t, 120, getTokenUsedQuota(t, token.Id))

	info.Billing.Refund(c)
	info.Billing.Refund(c)
	require.NoError(t, model.DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, model.DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)

	applied, err := model.RefundImageBillingReservation(task.TaskID, "submission failed after pre-consume")
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = model.RefundImageBillingReservation(task.TaskID, "duplicate terminalization")
	require.NoError(t, err)
	assert.False(t, applied)
	require.NoError(t, model.DB.First(task, task.ID).Error)
	assert.Equal(t, model.TaskStatus(model.TaskStatusFailure), task.Status)
}

func TestFailedImageLedgerPreConsumeCanBeTerminalizedWithoutCredit(t *testing.T) {
	user, token, task := seedServiceImageBillingReservation(t, "insufficient", 1200)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:                "request-service-image-reservation-insufficient",
		UserId:                   user.Id,
		TokenId:                  token.Id,
		TokenKey:                 token.Key,
		OriginModelName:          "gpt-image-1",
		ForcePreConsume:          true,
		BillingReservationTaskID: task.TaskID,
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := PreConsumeBilling(c, 1200, info)
	require.NotNil(t, apiErr)
	applied, err := model.RefundImageBillingReservation(task.TaskID, "pre-consume rejected")
	require.NoError(t, err)
	require.True(t, applied)
	assert.Equal(t, 1000, getUserQuota(t, user.Id))
	assert.Equal(t, 1000, getTokenRemainQuota(t, token.Id))
	assert.Zero(t, getTokenUsedQuota(t, token.Id))
}

func TestPreConsumeBillingUsesImageSubscriptionReservationLedger(t *testing.T) {
	user, token, task := seedServiceImageBillingReservation(t, "subscription", 90)
	now := model.GetDBTimestamp()
	plan := &model.SubscriptionPlan{
		Title:            "Image Subscription",
		PriceAmount:      10,
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: model.SubscriptionResetNever,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	subscription := &model.UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, model.DB.Create(subscription).Error)

	requestID := "request-service-image-reservation-subscription"
	require.NoError(t, model.DB.Model(&model.ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:                requestID,
		UserId:                   user.Id,
		TokenId:                  token.Id,
		TokenKey:                 token.Key,
		OriginModelName:          "gpt-image-1",
		ForcePreConsume:          true,
		BillingReservationTaskID: task.TaskID,
		UserSetting: dto.UserSetting{
			BillingPreference: "subscription_only",
		},
	}

	apiErr := PreConsumeBilling(c, 90, info)
	require.Nil(t, apiErr)
	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, "subscription", reservation.FundingSource)
	assert.EqualValues(t, 90, reservation.SubscriptionReserved)
	assert.Equal(t, 90, reservation.TokenReserved)
	require.NoError(t, model.DB.First(subscription, subscription.Id).Error)
	assert.EqualValues(t, 90, subscription.AmountUsed)
	assert.Equal(t, 1000, getUserQuota(t, user.Id))
	assert.Equal(t, 910, getTokenRemainQuota(t, token.Id))

	info.Billing.Refund(c)
	require.NoError(t, model.DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
	assert.Equal(t, 1000, getTokenRemainQuota(t, token.Id))
	applied, err := model.RefundImageBillingReservation(task.TaskID, "subscription submit failed")
	require.NoError(t, err)
	require.True(t, applied)
	require.NoError(t, model.DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
}

func TestPlaygroundImageReservationSkipsTokenLeg(t *testing.T) {
	user, token, task := seedServiceImageBillingReservation(t, "playground", 60)
	require.NoError(t, model.DB.Model(&model.ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:                "request-service-image-reservation-playground",
		UserId:                   user.Id,
		TokenId:                  token.Id,
		TokenKey:                 token.Key,
		OriginModelName:          "gpt-image-1",
		ForcePreConsume:          true,
		IsPlayground:             true,
		BillingReservationTaskID: task.TaskID,
		UserSetting: dto.UserSetting{
			BillingPreference: "wallet_only",
		},
	}

	apiErr := PreConsumeBilling(c, 60, info)
	require.Nil(t, apiErr)
	task.Quota = info.FinalPreConsumedQuota
	activated, err := model.ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	assert.Equal(t, 940, getUserQuota(t, user.Id))
	assert.Equal(t, 1000, getTokenRemainQuota(t, token.Id))
	assert.Zero(t, getTokenUsedQuota(t, token.Id))
	assert.Zero(t, task.PrivateData.TokenPreConsumed)
}

func TestSubscriptionImageReservationUpgradesZeroEstimateToMinimum(t *testing.T) {
	user, token, task := seedServiceImageBillingReservation(t, "subscription-minimum", 0)
	require.NoError(t, model.DB.Model(&model.ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	now := model.GetDBTimestamp()
	plan := &model.SubscriptionPlan{
		Title:            "Minimum Image Subscription",
		PriceAmount:      10,
		DurationUnit:     model.SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: model.SubscriptionResetNever,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	subscription := &model.UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, model.DB.Create(subscription).Error)
	requestID := "request-service-subscription-minimum"
	require.NoError(t, model.DB.Model(&model.ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RequestId:                requestID,
		UserId:                   user.Id,
		TokenId:                  token.Id,
		TokenKey:                 token.Key,
		OriginModelName:          "gpt-image-1",
		ForcePreConsume:          true,
		BillingReservationTaskID: task.TaskID,
		UserSetting: dto.UserSetting{
			BillingPreference: "subscription_only",
		},
	}

	apiErr := PreConsumeBilling(c, 0, info)
	require.Nil(t, apiErr)
	assert.Equal(t, 1, info.FinalPreConsumedQuota)
	task.Quota = info.FinalPreConsumedQuota
	activated, err := model.ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	reservation, err := model.GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 1, reservation.ExpectedQuota)
	assert.Equal(t, 1, reservation.TokenReserved)
	assert.EqualValues(t, 1, reservation.SubscriptionReserved)
	assert.True(t, task.PrivateData.TokenBillingEnabled)
	assert.Equal(t, 999, getTokenRemainQuota(t, token.Id))
}
