package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedPreparedImageBillingReservation(t *testing.T, suffix string, quota int) (*User, *Token, *Task) {
	t.Helper()
	truncateTables(t)

	user := &User{
		Username: "image-reservation-user-" + suffix,
		Password: "password",
		Quota:    1000,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "image-reservation-token-" + suffix,
		Name:        "image reservation",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
	}
	require.NoError(t, DB.Create(token).Error)

	now := common.GetTimestamp()
	task := &Task{
		TaskID:     "task_image_reservation_" + suffix,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     user.Id,
		Status:     TaskStatusReserving,
		Progress:   "0%",
		SubmitTime: now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	reservation := &ImageBillingReservation{
		TaskID:        task.TaskID,
		RequestID:     "request-image-reservation-" + suffix,
		UserID:        user.Id,
		TokenID:       token.Id,
		TokenRequired: true,
		ExpectedQuota: quota,
	}
	require.NoError(t, InsertPreparedImageTask(task, nil, reservation))
	return user, token, task
}

func TestImageBillingReservationWalletTokenRecoveryIsIdempotent(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "recover", 100)

	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 100, reservation.WalletReserved)
	assert.Equal(t, 100, reservation.TokenReserved)
	assert.Equal(t, "wallet", reservation.FundingSource)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = RefundImageBillingReservation(task.TaskID, "duplicate recovery")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)

	reservation, err = GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationRefunded, reservation.Status)
	assert.Zero(t, reservation.WalletReserved)
	assert.Zero(t, reservation.TokenReserved)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusFailure), task.Status)
	assert.Equal(t, "submission abandoned", task.FailReason)
}

func TestImageBillingReservationRefundsSoftDeletedTokenLedger(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "soft-deleted-token", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Delete(token).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)

	var storedToken Token
	require.NoError(t, DB.Unscoped().First(&storedToken, token.Id).Error)
	assert.True(t, storedToken.DeletedAt.Valid)
	assert.Equal(t, 1000, storedToken.RemainQuota)
	assert.Zero(t, storedToken.UsedQuota)
}

func TestImageBillingReservationRefundsSoftDeletedUserLedger(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "soft-deleted-user", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Delete(user).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.NoError(t, err)
	require.True(t, applied)

	var storedUser User
	require.NoError(t, DB.Unscoped().First(&storedUser, user.Id).Error)
	assert.True(t, storedUser.DeletedAt.Valid)
	assert.Equal(t, 1000, storedUser.Quota)
}

func TestRefundImageTaskWalletQuotaDoesNotClearLedgerWhenUserIsHardDeleted(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "missing-user", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	require.NoError(t, DB.Unscoped().Delete(user).Error)

	err := RefundImageTaskWalletQuota(task.TaskID, user.Id)
	require.ErrorContains(t, err, "image wallet reservation refund lost")
	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	assert.Equal(t, 100, reservation.WalletReserved)
}

func TestImageBillingReservationDoesNotClearLedgerWhenTokenIsHardDeleted(t *testing.T) {
	_, token, task := seedPreparedImageBillingReservation(t, "missing-token", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, DB.Unscoped().Delete(token).Error)

	applied, err := RefundImageBillingReservation(task.TaskID, "submission abandoned")
	require.ErrorContains(t, err, "image token reservation refund lost")
	assert.False(t, applied)

	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	assert.Equal(t, 100, reservation.TokenReserved)
}

func TestImageBillingReservationActivationPreventsRecovery(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "activate", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))

	task.Quota = 100
	task.Action = constant.TaskActionGenerate
	task.PrivateData.TokenBillingEnabled = true
	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	activated, err = ActivatePreparedImageTask(task)
	require.NoError(t, err)
	assert.False(t, activated)

	applied, err := RefundImageBillingReservation(task.TaskID, "must not refund active task")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 900, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 900, token.RemainQuota)
	assert.Equal(t, 100, token.UsedQuota)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusNotStart), task.Status)
	assert.Equal(t, "wallet", task.PrivateData.BillingSource)
	assert.Equal(t, 100, task.PrivateData.TokenPreConsumed)

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationActive, reservation.Status)
}

func TestImageBillingReservationActivationRequiresTokenLeg(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "missing-token", 100)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100))
	task.Quota = 100

	activated, err := ActivatePreparedImageTask(task)
	require.ErrorContains(t, err, "token reservation is incomplete")
	assert.False(t, activated)

	reservation, lookupErr := GetImageBillingReservation(task.TaskID)
	require.NoError(t, lookupErr)
	assert.Equal(t, ImageBillingReservationPreparing, reservation.Status)
	require.NoError(t, DB.First(task, task.ID).Error)
	assert.Equal(t, TaskStatus(TaskStatusReserving), task.Status)
}

func TestImageBillingReservationActivationRequiresFundingLeg(t *testing.T) {
	_, token, task := seedPreparedImageBillingReservation(t, "missing-funding", 100)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 100))
	task.Quota = 100

	activated, err := ActivatePreparedImageTask(task)
	require.ErrorContains(t, err, "funding reservation is incomplete")
	assert.False(t, activated)
}

func TestImageBillingReservationAllowsFreeActivationWithoutQuotaLegs(t *testing.T) {
	_, _, task := seedPreparedImageBillingReservation(t, "free", 0)
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	task.Quota = 0

	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, ImageBillingReservationActive, reservation.Status)
}

func TestImageBillingReservationUpgradesZeroEstimateForSubscriptionMinimum(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "subscription-minimum", 0)
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("token_required", false).Error)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Minimum Reservation Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	requestID := "request-subscription-minimum"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 1))
	_, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 1)
	require.NoError(t, err)
	task.Quota = 1

	activated, err := ActivatePreparedImageTask(task)
	require.NoError(t, err)
	require.True(t, activated)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, 1, reservation.ExpectedQuota)
	assert.True(t, reservation.TokenRequired)
	assert.True(t, task.PrivateData.TokenBillingEnabled)
	assert.Equal(t, 1, task.PrivateData.TokenPreConsumed)
}

func TestImageBillingReservationFailedDebitRollsBackLedgerClaim(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "insufficient", 1100)

	err := ReserveImageTaskWalletQuota(task.TaskID, user.Id, 1100)
	require.ErrorContains(t, err, "user quota is not enough")
	err = ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 1100)
	require.ErrorContains(t, err, "token quota is not enough")

	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Zero(t, reservation.WalletReserved)
	assert.Zero(t, reservation.TokenReserved)
	assert.Empty(t, reservation.FundingSource)
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}

func TestImageBillingReservationSubscriptionRecoveryIsIdempotent(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "subscription", 100)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Image Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)

	requestID := "request-image-reservation-subscription"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)
	first, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 100)
	require.NoError(t, err)
	second, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, first.UserSubscriptionId, second.UserSubscriptionId)
	assert.EqualValues(t, 100, second.PreConsumed)

	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.EqualValues(t, 100, subscription.AmountUsed)
	reservation, err := GetImageBillingReservation(task.TaskID)
	require.NoError(t, err)
	assert.Equal(t, "subscription", reservation.FundingSource)
	assert.EqualValues(t, 100, reservation.SubscriptionReserved)
	err = ReserveImageTaskWalletQuota(task.TaskID, user.Id, 100)
	require.ErrorContains(t, err, "conflicting image wallet reservation")
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)

	applied, err := RefundImageBillingReservation(task.TaskID, "stale subscription submission")
	require.NoError(t, err)
	require.True(t, applied)
	applied, err = RefundImageBillingReservation(task.TaskID, "duplicate stale recovery")
	require.NoError(t, err)
	assert.False(t, applied)

	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", requestID).First(&record).Error)
	assert.Equal(t, "refunded", record.Status)

	// Subscription funding does not touch the wallet, and the token leg was not
	// reserved in this focused model test.
	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
}

func TestImageBillingReservationRejectsSubscriptionAfterWalletFunding(t *testing.T) {
	user, _, task := seedPreparedImageBillingReservation(t, "wallet-then-subscription", 75)
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 75))
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Title:            "Conflicting Plan",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(plan).Error)
	subscription := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 1000,
		StartTime:   now - 60,
		EndTime:     now + 3600,
		Status:      "active",
	}
	require.NoError(t, DB.Create(subscription).Error)
	requestID := "request-wallet-then-subscription"
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("request_id", requestID).Error)

	_, err := PreConsumeImageTaskSubscription(task.TaskID, requestID, user.Id, "gpt-image-1", 0, 75)
	require.ErrorContains(t, err, "already uses wallet funding")
	require.NoError(t, DB.First(subscription, subscription.Id).Error)
	assert.Zero(t, subscription.AmountUsed)
}

func TestRecoverStaleImageBillingReservationsOnlyClaimsDuePreparingRows(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "stale", 50)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 50))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 50))
	require.NoError(t, DB.Model(&ImageBillingReservation{}).Where("task_id = ?", task.TaskID).Update("updated_at", int64(100)).Error)

	recovered, err := RecoverStaleImageBillingReservations(200, 10, "reservation timed out")
	require.NoError(t, err)
	assert.Equal(t, 1, recovered)
	recovered, err = RecoverStaleImageBillingReservations(200, 10, "second pass")
	require.NoError(t, err)
	assert.Zero(t, recovered)
}

func TestFullImageBillingRefundReportsOnlyLegsStillReserved(t *testing.T) {
	user, token, task := seedPreparedImageBillingReservation(t, "partial-full", 80)
	require.NoError(t, ReserveImageTaskTokenQuota(task.TaskID, token.Id, token.Key, 80))
	require.NoError(t, ReserveImageTaskWalletQuota(task.TaskID, user.Id, 80))
	require.NoError(t, RefundImageTaskWalletQuota(task.TaskID, user.Id))

	applied, walletRefunded, tokenRefunded, err := refundImageBillingReservationDB(task.TaskID, "finish partial refund")
	require.NoError(t, err)
	require.True(t, applied)
	assert.Zero(t, walletRefunded)
	assert.Equal(t, 80, tokenRefunded)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 1000, user.Quota)
	require.NoError(t, DB.First(token, token.Id).Error)
	assert.Equal(t, 1000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}
