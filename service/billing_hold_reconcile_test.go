package service

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVerifyBillingHoldUpstreamCharge_confirmedNotError(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  400,
		ErrorCode:    string(types.ErrorCodeConvertRequestFailed),
		ErrorMessage: "convert failed",
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if !refund {
		t.Fatalf("expected refund, got confirm: %s", detail)
	}
}

func TestVerifyBillingHoldUpstreamCharge_receivedResponses(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:       504,
		ErrorCode:         string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage:      "gateway timeout",
		ReceivedResponses: 12,
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if refund {
		t.Fatalf("expected confirm, got refund: %s", detail)
	}
}

func TestVerifyBillingHoldUpstreamCharge_ambiguousDefaultConfirm(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  502,
		ErrorCode:    string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage: "bad gateway",
	}
	refund, detail := VerifyBillingHoldUpstreamCharge(hold)
	if refund {
		t.Fatalf("expected confirm when upstream unverified, got refund: %s", detail)
	}
	if detail == "" {
		t.Fatal("expected detail")
	}
}

func TestBillingHoldAPIError(t *testing.T) {
	hold := &model.BillingHold{
		ErrorStatus:  http.StatusBadGateway,
		ErrorCode:    string(types.ErrorCodeBadResponseStatusCode),
		ErrorMessage: "upstream bad gateway",
	}
	err := billingHoldAPIError(hold)
	if ClassifyUpstreamChargeConfidence(err) != UpstreamChargeAmbiguous {
		t.Fatalf("expected ambiguous")
	}
}

func TestConfirmBillingHold_WritesConsumeLog(t *testing.T) {
	truncate(t)

	user := &model.User{Id: 101, Username: "hold_user", Quota: 10000, UsedQuota: 0, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)

	hold := &model.BillingHold{
		RequestId:        "req-confirm-1",
		UserId:           101,
		ModelName:        "gpt-4o",
		ChannelId:        7,
		PreConsumedQuota: 500,
		Status:           model.BillingHoldStatusPending,
	}
	require.NoError(t, model.CreateBillingHold(hold))
	claimed, err := model.ClaimBillingHold(hold.Id)
	require.NoError(t, err)
	require.True(t, claimed)

	hold, err = model.GetBillingHoldById(hold.Id)
	require.NoError(t, err)

	err = ConfirmBillingHold(hold, "upstream unverified")
	require.NoError(t, err)

	var updated model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", 101).First(&updated).Error)
	assert.Equal(t, 500, updated.UsedQuota)

	var log model.Log
	require.NoError(t, model.LOG_DB.Order("id desc").First(&log).Error)
	assert.Equal(t, model.LogTypeConsume, log.Type)
	assert.Equal(t, "req-confirm-1", log.RequestId)
	assert.Equal(t, 500, log.Quota)
	assert.Equal(t, "gpt-4o", log.ModelName)
}

func TestConfirmBillingHold_SkipsDuplicateConsumeLog(t *testing.T) {
	truncate(t)

	user := &model.User{Id: 102, Username: "hold_user2", Quota: 10000, UsedQuota: 500, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(user).Error)

	existing := &model.Log{
		UserId:    102,
		Type:      model.LogTypeConsume,
		RequestId: "req-dup-1",
		Quota:     500,
		CreatedAt: common.GetTimestamp(),
	}
	require.NoError(t, model.LOG_DB.Create(existing).Error)

	hold := &model.BillingHold{
		RequestId:        "req-dup-1",
		UserId:           102,
		PreConsumedQuota: 500,
		Status:           model.BillingHoldStatusPending,
	}
	require.NoError(t, model.CreateBillingHold(hold))
	claimed, err := model.ClaimBillingHold(hold.Id)
	require.NoError(t, err)
	require.True(t, claimed)
	hold, err = model.GetBillingHoldById(hold.Id)
	require.NoError(t, err)

	err = ConfirmBillingHold(hold, "already logged")
	require.NoError(t, err)

	var updated model.User
	require.NoError(t, model.DB.Select("used_quota").Where("id = ?", 102).First(&updated).Error)
	assert.Equal(t, 500, updated.UsedQuota)

	var count int64
	model.LOG_DB.Model(&model.Log{}).Where("user_id = ? AND type = ?", 102, model.LogTypeConsume).Count(&count)
	assert.Equal(t, int64(1), count)
}
