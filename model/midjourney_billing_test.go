package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMidjourneyTerminalTransitionAndRefundAreAtomicAndIdempotent(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "midjourney-refund-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	task := Midjourney{
		UserId:   user.Id,
		MjId:     "midjourney-refund-task",
		Status:   "IN_PROGRESS",
		Progress: "90%",
		Quota:    30,
	}
	require.NoError(t, DB.Create(&task).Error)
	task.Status = "FAILURE"
	task.Progress = "100%"

	won, err := task.UpdateWithStatusAndRefund("IN_PROGRESS")
	require.NoError(t, err)
	require.True(t, won)
	won, err = task.UpdateWithStatusAndRefund("IN_PROGRESS")
	require.NoError(t, err)
	assert.False(t, won)

	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 130, user.Quota)
	var adjustment BillingAdjustmentOutbox
	require.NoError(t, DB.Where(
		"request_id = ? AND phase = ? AND leg = ?",
		fmt.Sprintf("mj-refund:%d", task.Id),
		BillingAdjustmentPhaseTaskRefund,
		BillingAdjustmentLegWallet,
	).First(&adjustment).Error)
	assert.Equal(t, billingAdjustmentDelivered, adjustment.Status)
	assert.True(t, adjustment.DBApplied)
	assert.True(t, adjustment.CacheApplied)
}

func TestMidjourneyRefundOutboxConflictRollsBackTerminalTransition(t *testing.T) {
	truncateTables(t)
	oldRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = oldRedisEnabled })

	user := User{Username: "midjourney-refund-conflict-user", Quota: 100, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	task := Midjourney{UserId: user.Id, MjId: "midjourney-refund-conflict", Status: "IN_PROGRESS", Quota: 30}
	require.NoError(t, DB.Create(&task).Error)
	_, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{{
		RequestID: fmt.Sprintf("mj-refund:%d", task.Id),
		Phase:     BillingAdjustmentPhaseTaskRefund,
		Leg:       BillingAdjustmentLegWallet,
		UserID:    user.Id,
		Delta:     29,
	}})
	require.NoError(t, err)

	task.Status = "FAILURE"
	won, err := task.UpdateWithStatusAndRefund("IN_PROGRESS")
	require.ErrorContains(t, err, "idempotency conflict")
	assert.False(t, won)

	var stored Midjourney
	require.NoError(t, DB.First(&stored, task.Id).Error)
	assert.Equal(t, "IN_PROGRESS", stored.Status)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 100, user.Quota)
}
