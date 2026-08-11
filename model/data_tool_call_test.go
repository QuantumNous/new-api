package model

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
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
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &Token{}, &DataToolCall{}, &RecallLifecycleEvent{}, &QuotaLifecycleState{}))
	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		require.NoError(t, sqlDB.Close())
	})
}

func isSQLiteDataToolLockErr(err error) bool {
	return err != nil && strings.Contains(err.Error(), "database table is locked")
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

func TestCompleteAndSettleDataToolCallRejectsUserUsedQuotaUnderflow(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-settle-user-underflow", Password: "password", Quota: 500, AffCode: "dt08"}
	require.NoError(t, DB.Create(user).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-settle-user-underflow",
		RequestHash:    "request-settle-user-underflow",
		ToolID:         "provider.pay-on-match",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 50).Error)

	_, err = CompleteAndSettleDataToolCall(CompleteAndSettleDataToolCallInput{
		ID:            call.ID,
		FinalQuota:    0,
		ResultCount:   0,
		BuildResponse: func(_ int) ([]byte, error) { return []byte(`{}`), nil },
	})

	require.ErrorContains(t, err, "data tool quota refund underflow")
	var pendingCall DataToolCall
	require.NoError(t, DB.First(&pendingCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusPending, pendingCall.Status)
	var rolledBackUser User
	require.NoError(t, DB.First(&rolledBackUser, user.Id).Error)
	require.Equal(t, 400, rolledBackUser.Quota)
	require.Equal(t, 50, rolledBackUser.UsedQuota)
	require.GreaterOrEqual(t, rolledBackUser.UsedQuota, 0)
}

func TestCompleteAndSettleDataToolCallRejectsTokenUsedQuotaUnderflow(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-settle-token-underflow", Password: "password", Quota: 500, AffCode: "dt09"}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "settle-token-underflow",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 400,
	}
	require.NoError(t, DB.Create(token).Error)

	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		TokenID:        token.Id,
		TokenKey:       token.Key,
		IdempotencyKey: "idem-settle-token-underflow",
		RequestHash:    "request-settle-token-underflow",
		ToolID:         "provider.pay-on-match",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Update("used_quota", 50).Error)

	_, err = CompleteAndSettleDataToolCall(CompleteAndSettleDataToolCallInput{
		ID:            call.ID,
		FinalQuota:    0,
		ResultCount:   0,
		BuildResponse: func(_ int) ([]byte, error) { return []byte(`{}`), nil },
	})

	require.ErrorContains(t, err, "data tool quota refund underflow")
	var pendingCall DataToolCall
	require.NoError(t, DB.First(&pendingCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusPending, pendingCall.Status)
	var rolledBackUser User
	require.NoError(t, DB.First(&rolledBackUser, user.Id).Error)
	require.Equal(t, 400, rolledBackUser.Quota)
	require.Equal(t, 100, rolledBackUser.UsedQuota)
	var rolledBackToken Token
	require.NoError(t, DB.First(&rolledBackToken, token.Id).Error)
	require.Equal(t, 300, rolledBackToken.RemainQuota)
	require.Equal(t, 50, rolledBackToken.UsedQuota)
	require.GreaterOrEqual(t, rolledBackToken.UsedQuota, 0)
}

func TestFailAndRefundDataToolCallConcurrentFailuresHaveOneWinner(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-concurrent-fail", Password: "password", Quota: 500, AffCode: "dt10"}
	require.NoError(t, DB.Create(user).Error)
	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-concurrent-fail",
		RequestHash:    "request-concurrent-fail",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	start := make(chan struct{})
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs <- FailAndRefundDataToolCall(call.ID, "upstream unavailable")
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	successes := 0
	for err := range errs {
		if isSQLiteDataToolLockErr(err) {
			continue
		}
		require.NoError(t, err)
		successes++
	}
	require.GreaterOrEqual(t, successes, 1)

	var refundedUser User
	require.NoError(t, DB.First(&refundedUser, user.Id).Error)
	require.Equal(t, 500, refundedUser.Quota)
	require.Equal(t, 0, refundedUser.UsedQuota)
	var failedCall DataToolCall
	require.NoError(t, DB.First(&failedCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusFailed, failedCall.Status)
}

func TestDataToolCallConcurrentFailAndSettleHaveOneTerminalWinner(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-concurrent-terminal", Password: "password", Quota: 500, AffCode: "dt11"}
	require.NoError(t, DB.Create(user).Error)
	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-concurrent-terminal",
		RequestHash:    "request-concurrent-terminal",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)

	start := make(chan struct{})
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		errs <- FailAndRefundDataToolCall(call.ID, "upstream unavailable")
	}()
	go func() {
		defer wg.Done()
		<-start
		_, settleErr := CompleteAndSettleDataToolCall(CompleteAndSettleDataToolCallInput{
			ID:            call.ID,
			FinalQuota:    0,
			ResultCount:   0,
			BuildResponse: func(_ int) ([]byte, error) { return []byte(`{}`), nil },
		})
		errs <- settleErr
	}()
	close(start)
	wg.Wait()
	close(errs)

	successes := 0
	for err := range errs {
		if isSQLiteDataToolLockErr(err) {
			continue
		}
		if err == nil {
			successes++
		}
	}
	require.Equal(t, 1, successes)
	var terminalCall DataToolCall
	require.NoError(t, DB.First(&terminalCall, call.ID).Error)
	require.Contains(t, []string{DataToolCallStatusFailed, DataToolCallStatusSucceeded}, terminalCall.Status)
	var refundedUser User
	require.NoError(t, DB.First(&refundedUser, user.Id).Error)
	require.Equal(t, 500, refundedUser.Quota)
	require.Equal(t, 0, refundedUser.UsedQuota)
}

func TestFailAndRefundDataToolCallRejectsUserUsedQuotaUnderflow(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-fail-user-underflow", Password: "password", Quota: 500, AffCode: "dt12"}
	require.NoError(t, DB.Create(user).Error)
	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		IdempotencyKey: "idem-fail-user-underflow",
		RequestHash:    "request-fail-user-underflow",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("used_quota", 50).Error)

	err = FailAndRefundDataToolCall(call.ID, "upstream unavailable")

	require.ErrorContains(t, err, "data tool quota refund underflow")
	var pendingCall DataToolCall
	require.NoError(t, DB.First(&pendingCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusPending, pendingCall.Status)
	var rolledBackUser User
	require.NoError(t, DB.First(&rolledBackUser, user.Id).Error)
	require.Equal(t, 400, rolledBackUser.Quota)
	require.Equal(t, 50, rolledBackUser.UsedQuota)
	require.GreaterOrEqual(t, rolledBackUser.UsedQuota, 0)
}

func TestFailAndRefundDataToolCallRejectsTokenUsedQuotaUnderflow(t *testing.T) {
	setupDataToolCallTestDB(t)
	user := &User{Username: "data-tool-fail-token-underflow", Password: "password", Quota: 500, AffCode: "dt13"}
	require.NoError(t, DB.Create(user).Error)
	token := &Token{
		UserId:      user.Id,
		Key:         "fail-token-underflow",
		Name:        "test",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 400,
	}
	require.NoError(t, DB.Create(token).Error)
	call, _, err := ReserveDataToolCall(ReserveDataToolCallInput{
		UserID:         user.Id,
		TokenID:        token.Id,
		TokenKey:       token.Key,
		IdempotencyKey: "idem-fail-token-underflow",
		RequestHash:    "request-fail-token-underflow",
		ToolID:         "provider.tool",
		PriceMicroUSD:  200,
		Quota:          100,
	})
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Token{}).Where("id = ?", token.Id).Update("used_quota", 50).Error)

	err = FailAndRefundDataToolCall(call.ID, "upstream unavailable")

	require.ErrorContains(t, err, "data tool quota refund underflow")
	var pendingCall DataToolCall
	require.NoError(t, DB.First(&pendingCall, call.ID).Error)
	require.Equal(t, DataToolCallStatusPending, pendingCall.Status)
	var rolledBackUser User
	require.NoError(t, DB.First(&rolledBackUser, user.Id).Error)
	require.Equal(t, 400, rolledBackUser.Quota)
	require.Equal(t, 100, rolledBackUser.UsedQuota)
	var rolledBackToken Token
	require.NoError(t, DB.First(&rolledBackToken, token.Id).Error)
	require.Equal(t, 300, rolledBackToken.RemainQuota)
	require.Equal(t, 50, rolledBackToken.UsedQuota)
	require.GreaterOrEqual(t, rolledBackToken.UsedQuota, 0)
}

func TestCompleteAndSettleDataToolCallLocksPendingRowBeforeSideEffects(t *testing.T) {
	source, err := os.ReadFile("data_tool_call.go")
	require.NoError(t, err)
	body := string(source)
	body = body[strings.Index(body, "func CompleteAndSettleDataToolCall("):strings.Index(body, "func FailAndRefundDataToolCall(")]
	require.Contains(t, body, "lockQuery(tx).Where(\"id = ?\", input.ID).First(&call)")
	require.True(t,
		strings.Index(body, "lockQuery(tx).Where(\"id = ?\", input.ID).First(&call)") <
			strings.Index(body, "ApplyWalletQuotaMutationTx(tx, call.UserID"),
	)
}

func TestFailAndRefundDataToolCallLocksPendingRowBeforeSideEffects(t *testing.T) {
	source, err := os.ReadFile("data_tool_call.go")
	require.NoError(t, err)
	body := string(source)
	body = body[strings.Index(body, "func FailAndRefundDataToolCall("):strings.Index(body, "func decrementDataToolUserUsedQuotaForRefund(")]
	require.Contains(t, body, "lockQuery(tx).Where(\"id = ?\", id).First(&call)")
	require.True(t,
		strings.Index(body, "lockQuery(tx).Where(\"id = ?\", id).First(&call)") <
			strings.Index(body, "ApplyWalletQuotaMutationTx(tx, call.UserID"),
	)
}

func TestGetHighestActiveSubscriptionTierRankForDataToolGate(t *testing.T) {
	setupDataToolCallTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &RecallLifecycleEvent{}, &QuotaLifecycleState{}))
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
