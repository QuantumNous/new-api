package model

import (
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDataToolCallTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &DataToolCall{}))
	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
}

func TestReserveDataToolCallChargesUserAndTokenExactlyOnce(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-user", Password: "password", Quota: 1000, AffCode: "dt01"}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "data-tool-token",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 800,
	}
	require.NoError(t, DB.Create(token).Error)

	input := ReserveDataToolCallInput{
		UserID:         user.Id,
		TokenID:        token.Id,
		TokenKey:       token.Key,
		IdempotencyKey: "idem-1",
		RequestHash:    "request-1",
		ToolID:         "provider.tool",
		PriceMicroUSD:  400,
		Quota:          200,
	}
	call, replayed, err := ReserveDataToolCall(input)
	require.NoError(t, err)
	require.False(t, replayed)
	require.Equal(t, DataToolCallStatusPending, call.Status)

	var chargedUser User
	require.NoError(t, DB.First(&chargedUser, user.Id).Error)
	require.Equal(t, 800, chargedUser.Quota)
	require.Equal(t, 200, chargedUser.UsedQuota)
	var chargedToken Token
	require.NoError(t, DB.First(&chargedToken, token.Id).Error)
	require.Equal(t, 600, chargedToken.RemainQuota)
	require.Equal(t, 200, chargedToken.UsedQuota)

	replayedCall, replayed, err := ReserveDataToolCall(input)
	require.NoError(t, err)
	require.True(t, replayed)
	require.Equal(t, call.ID, replayedCall.ID)
	require.NoError(t, DB.First(&chargedUser, user.Id).Error)
	require.Equal(t, 800, chargedUser.Quota)
	require.NoError(t, DB.First(&chargedToken, token.Id).Error)
	require.Equal(t, 600, chargedToken.RemainQuota)
}

func TestFailAndRefundDataToolCallIsIdempotent(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-refund", Password: "password", Quota: 500, AffCode: "dt02"}
	require.NoError(t, DB.Create(user).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-refund",
		RequestHash:    "request-refund",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, FailAndRefundDataToolCall(call.ID, "upstream unavailable"))
	require.NoError(t, FailAndRefundDataToolCall(call.ID, "upstream unavailable"))

	var refundedUser User
	require.NoError(t, DB.First(&refundedUser, user.Id).Error)
	require.Equal(t, 500, refundedUser.Quota)
	require.Equal(t, 0, refundedUser.UsedQuota)
	var failedCall DataToolCall
	require.NoError(t, DB.First(&failedCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusFailed, failedCall.Status)
	require.Equal(t, "upstream unavailable", failedCall.ErrorMessage)
}

func TestFailAndRefundDataToolCallRefundsUserAfterTokenDeletion(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-deleted-token", Password: "password", Quota: 500, AffCode: "dt04"}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "deleted-data-tool-token",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 400,
	}
	require.NoError(t, DB.Create(token).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		TokenID:        token.Id,
		TokenKey:       token.Key,
		IdempotencyKey: "idem-deleted-token",
		RequestHash:    "request-deleted-token",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Delete(token).Error)

	require.NoError(t, FailAndRefundDataToolCall(call.ID, "upstream unavailable"))

	var refundedUser User
	require.NoError(t, DB.First(&refundedUser, user.Id).Error)
	require.Equal(t, 500, refundedUser.Quota)
	require.Equal(t, 0, refundedUser.UsedQuota)
	var failedCall DataToolCall
	require.NoError(t, DB.First(&failedCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusFailed, failedCall.Status)
	require.Equal(t, "upstream unavailable", failedCall.ErrorMessage)
}

func TestReserveDataToolCallRejectsIdempotencyKeyReuse(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-conflict", Password: "password", Quota: 500, AffCode: "dt03"}
	require.NoError(t, DB.Create(user).Error)
	base := ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-conflict",
		RequestHash:    "request-a",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	}
	_, _, err := ReserveDataToolCall(base)
	require.NoError(t, err)

	base.RequestHash = "request-b"
	_, _, err = ReserveDataToolCall(base)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrDataToolIdempotencyConflict))
}

func TestCompleteAndSettleDataToolCallReconcilesUserAndTokenAtomically(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-settle", Password: "password", Quota: 2000, AffCode: "dt05"}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "settlement-token",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1600,
	}
	require.NoError(t, DB.Create(token).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		TokenID:        token.Id,
		TokenKey:       token.Key,
		IdempotencyKey: "idem-settle",
		RequestHash:    "request-settle",
		ToolID:         "provider.per-result",
		PriceMicroUSD:  400,
		Quota:          200,
	})
	require.NoError(t, err)

	remaining, err := CompleteAndSettleDataToolCall(CompleteAndSettleDataToolCallInput{
		ID:                 call.ID,
		FinalPriceMicroUSD: 800,
		FinalQuota:         400,
		ResultCount:        4,
		LatencyMS:          25,
		BuildResponse: func(remainingQuota int) ([]byte, error) {
			return []byte(`{"remaining_quota":` + fmt.Sprint(remainingQuota) + `}`), nil
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1600, remaining)

	var settledUser User
	require.NoError(t, DB.First(&settledUser, user.Id).Error)
	require.Equal(t, 1600, settledUser.Quota)
	require.Equal(t, 400, settledUser.UsedQuota)
	var settledToken Token
	require.NoError(t, DB.First(&settledToken, token.Id).Error)
	require.Equal(t, 1200, settledToken.RemainQuota)
	require.Equal(t, 400, settledToken.UsedQuota)
	var settledCall DataToolCall
	require.NoError(t, DB.First(&settledCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusSucceeded, settledCall.Status)
	require.Equal(t, int64(800), settledCall.PriceMicroUSD)
	require.Equal(t, 400, settledCall.ChargedQuota)
	require.JSONEq(t, `{"remaining_quota":1600}`, string(settledCall.ResponseBody))
}

func TestCompleteAndSettleDataToolCallRefundsZeroResult(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-zero", Password: "password", Quota: 500, AffCode: "dt06"}
	require.NoError(t, DB.Create(user).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-zero",
		RequestHash:    "request-zero",
		ToolID:         "provider.pay-on-match",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)

	remaining, err := CompleteAndSettleDataToolCall(CompleteAndSettleDataToolCallInput{
		ID:            call.ID,
		FinalQuota:    0,
		ResultCount:   0,
		BuildResponse: func(_ int) ([]byte, error) { return []byte(`{}`), nil },
	})
	require.NoError(t, err)
	require.Equal(t, 500, remaining)

	var refundedUser User
	require.NoError(t, DB.First(&refundedUser, user.Id).Error)
	require.Equal(t, 500, refundedUser.Quota)
	require.Equal(t, 0, refundedUser.UsedQuota)
}

func TestGetHighestActiveSubscriptionTierRankForDataToolGate(t *testing.T) {
	setupDataToolCallTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}))
	user := &User{Username: "data-tool-plan", Password: "password", Quota: 500, AffCode: "dt07"}
	require.NoError(t, DB.Create(user).Error)
	proRank := 20
	proPlan := &SubscriptionPlan{
		Title:         "Pro",
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TierRank:      &proRank,
	}
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Create(proPlan).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:    user.Id,
		PlanId:    proPlan.Id,
		StartTime: common.GetTimestamp() - 60,
		EndTime:   common.GetTimestamp() + 3600,
		Status:    "active",
	}).Error)

	rank, err := GetHighestActiveSubscriptionTierRank(user.Id)
	require.NoError(t, err)
	require.Equal(t, 20, rank)
}
