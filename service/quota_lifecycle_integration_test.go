package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	_ "unsafe"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

//go:linkname modelBatchUpdate github.com/QuantumNous/new-api/model.batchUpdate
func modelBatchUpdate()

func TestQuotaLifecycleFundingWalletReserveSettleRefund(t *testing.T) {
	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled

			const userID = 101
			seedUser(t, userID, 150)

			wallet := &WalletFunding{userId: userID}
			require.NoError(t, wallet.PreConsume(60))
			require.NoError(t, wallet.Settle(-20))

			require.Equal(t, 110, getUserQuota(t, userID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 110)
			require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
		})
	}
}

func TestWalletFundingConcurrentPreConsumeDoesNotOverdrawBatchModes(t *testing.T) {
	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled

			const userID = 109
			seedUser(t, userID, 100)

			runConcurrentServiceCalls(2, func() error {
				return (&WalletFunding{userId: userID}).PreConsume(80)
			}, func(successes int, failures int) {
				require.Equal(t, 1, successes)
				require.Equal(t, 1, failures)
			})

			require.Equal(t, 20, getUserQuota(t, userID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 20)
		})
	}
}

func TestQuotaLifecycleFundingWalletRefundRollback(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID = 102
	seedUser(t, userID, 150)

	wallet := &WalletFunding{userId: userID}
	require.NoError(t, wallet.PreConsume(60))
	require.NoError(t, wallet.Refund())

	require.Equal(t, 150, getUserQuota(t, userID))
	state := requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 150)
	require.Equal(t, fmt.Sprintf("baseline:wallet:%d", userID), state.Cycle)
	require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
}

func TestQuotaLifecycleBillingReserveFundingRollbackRestoresWallet(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID = 103
	seedUser(t, userID, 100)

	session := &BillingSession{
		relayInfo: &relaycommon.RelayInfo{
			UserId: userID,
		},
		funding:          &WalletFunding{userId: userID, consumed: 50},
		preConsumedQuota: 50,
		tokenConsumed:    50,
	}

	require.NoError(t, session.reserveFunding(50))
	session.rollbackFundingReserve(50)
	require.Equal(t, 100, getUserQuota(t, userID))
	requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 100)
}

func TestBillingSessionConcurrentWalletReserveFundingDoesNotOverdrawBatchModes(t *testing.T) {
	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled

			const userID = 110
			seedUser(t, userID, 100)

			runConcurrentServiceCalls(2, func() error {
				session := &BillingSession{
					relayInfo: &relaycommon.RelayInfo{
						UserId: userID,
					},
					funding: &WalletFunding{userId: userID},
				}
				return session.reserveFunding(80)
			}, func(successes int, failures int) {
				require.Equal(t, 1, successes)
				require.Equal(t, 1, failures)
			})

			require.Equal(t, 20, getUserQuota(t, userID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 20)
		})
	}
}

func TestQuotaLifecyclePostConsumeWalletRuntimeSeamBatchModes(t *testing.T) {
	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled

			const userID = 108
			seedUser(t, userID, 150)
			relayInfo := &relaycommon.RelayInfo{UserId: userID}

			require.NoError(t, PostConsumeQuota(relayInfo, 60, 0, false))
			require.NoError(t, PostConsumeQuota(relayInfo, -20, 0, false))

			require.Equal(t, 110, getUserQuota(t, userID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 110)
			require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
		})
	}
}

func TestPreConsumeQuotaConcurrentFallbackDoesNotOverdrawAndRollsBackTokenBatchModes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled
			modelCommonKeyCol = "`key`"

			const (
				userID   = 111
				tokenID  = 111
				tokenKey = "sk-legacy-fallback-concurrent"
			)
			seedUser(t, userID, 100)
			seedToken(t, tokenID, userID, tokenKey, 200)

			runConcurrentServiceCalls(2, func() error {
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
				c.Set("token_quota", 200)
				apiErr := PreConsumeQuota(c, 80, &relaycommon.RelayInfo{
					UserId:          userID,
					TokenId:         tokenID,
					TokenKey:        tokenKey,
					UsingGroup:      "default",
					UserGroup:       "default",
					BillingSource:   BillingSourceWallet,
					OriginModelName: "test-model",
					ForcePreConsume: true,
				})
				if apiErr != nil {
					return apiErr
				}
				return nil
			}, func(successes int, failures int) {
				require.Equal(t, 1, successes)
				require.Equal(t, 1, failures)
			})

			require.Equal(t, 20, getUserQuota(t, userID))
			if batchEnabled {
				modelBatchUpdate()
			}
			require.Equal(t, 120, getTokenRemainQuota(t, tokenID))
			require.Equal(t, 80, getTokenUsedQuota(t, tokenID))
			requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 20)
		})
	}
}

func TestQuotaLifecycleFundingSubscriptionReserveAndRefund(t *testing.T) {
	for _, batchEnabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("batch_%v", batchEnabled), func(t *testing.T) {
			truncate(t)
			restoreLifecycleThresholdForServiceTest(t, 100)
			common.BatchUpdateEnabled = batchEnabled

			const userID, subID = 104, 104
			seedUser(t, userID, 0)
			seedSubscription(t, subID, userID, 150, 0)

			funding := &SubscriptionFunding{
				requestId: "sub-lifecycle-" + fmt.Sprint(batchEnabled),
				userId:    userID,
				modelName: "test-model",
				amount:    60,
				weight:    1,
			}
			require.NoError(t, funding.PreConsume(60))
			require.NoError(t, funding.Refund())

			require.EqualValues(t, 0, getSubscriptionUsed(t, subID))
			state := requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeSubscription, strconv.Itoa(subID), 150)
			require.Equal(t, fmt.Sprintf("baseline:subscription:%d", subID), state.Cycle)
			require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeSubscription, strconv.Itoa(subID)))
		})
	}
}

func TestQuotaLifecycleTaskAcceptedWalletFundingEmitsLifecycleStateAndEvent(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID, tokenID, channelID = 105, 105, 105
	seedUser(t, userID, 150)
	seedToken(t, tokenID, userID, "sk-accepted-wallet", 1000)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.TaskID = "accepted-wallet-lifecycle"
	task.AcceptedAccountingActualQuota = 60
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, SettleAcceptedTaskFundingOnce(context.Background(), task, 60))

	require.Equal(t, 90, getUserQuota(t, userID))
	requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), 90)
	require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
}

func TestQuotaLifecycleAcceptedWalletFundingCanSettleThroughZero(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID, tokenID, channelID = 112, 112, 112
	seedUser(t, userID, 50)
	seedToken(t, tokenID, userID, "sk-accepted-wallet-through-zero", 1000)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceWallet, 0)
	task.TaskID = "accepted-wallet-through-zero"
	task.AcceptedAccountingStatus = model.TaskAcceptedAccountingProcessing
	task.AcceptedAccountingReservedQuota = 0
	task.AcceptedAccountingActualQuota = 80
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, SettleAcceptedTaskFundingOnce(context.Background(), task, 80))

	require.Equal(t, -30, getUserQuota(t, userID))
	require.Equal(t, 920, getTokenRemainQuota(t, tokenID))
	require.Equal(t, 80, getTokenUsedQuota(t, tokenID))
	requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), -30)
	require.Equal(t, int64(1), countLifecycleEventsByTypeForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID), model.RecallLifecycleTriggerQuotaExhaustedUnpaid))
}

func TestQuotaLifecycleTaskAcceptedFundingRollsBackLifecycleOnTokenFailure(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID, missingTokenID, channelID = 106, 106, 106
	seedUser(t, userID, 150)
	seedChannel(t, channelID)

	task := makeTask(userID, channelID, 0, missingTokenID, BillingSourceWallet, 0)
	task.TaskID = "accepted-wallet-lifecycle-rollback"
	task.AcceptedAccountingActualQuota = 60
	require.NoError(t, model.DB.Create(task).Error)

	require.Error(t, SettleAcceptedTaskFundingOnce(context.Background(), task, 60))

	require.Equal(t, 150, getUserQuota(t, userID))
	require.Equal(t, int64(0), countLifecycleStatesForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
	require.Equal(t, int64(0), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeWallet, strconv.Itoa(userID)))
}

func TestQuotaLifecycleTaskAcceptedSubscriptionFundingEmitsLifecycleStateAndEvent(t *testing.T) {
	truncate(t)
	restoreLifecycleThresholdForServiceTest(t, 100)

	const userID, tokenID, channelID, subID = 107, 107, 107, 107
	seedUser(t, userID, 0)
	seedToken(t, tokenID, userID, "sk-accepted-subscription", 1000)
	seedChannel(t, channelID)
	seedSubscription(t, subID, userID, 150, 0)

	task := makeTask(userID, channelID, 0, tokenID, BillingSourceSubscription, subID)
	task.TaskID = "accepted-subscription-lifecycle"
	task.AcceptedAccountingActualQuota = 60
	task.PrivateData.BillingContext.SubscriptionWeight = 1
	require.NoError(t, model.DB.Create(task).Error)

	require.NoError(t, SettleAcceptedTaskFundingOnce(context.Background(), task, 60))

	require.EqualValues(t, 60, getSubscriptionUsed(t, subID))
	requireLifecycleStateForServiceTest(t, userID, model.QuotaLifecycleScopeSubscription, strconv.Itoa(subID), 90)
	require.Equal(t, int64(1), countLifecycleEventsForServiceTest(t, userID, model.QuotaLifecycleScopeSubscription, strconv.Itoa(subID)))
}

func runConcurrentServiceCalls(count int, call func() error, assertCounts func(successes int, failures int)) {
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make(chan error, count)

	wg.Add(count)
	for i := 0; i < count; i++ {
		go func() {
			defer wg.Done()
			<-start
			errs <- call()
		}()
	}
	close(start)
	wg.Wait()
	close(errs)

	successes := 0
	failures := 0
	for err := range errs {
		if err != nil {
			failures++
			continue
		}
		successes++
	}
	assertCounts(successes, failures)
}

func restoreLifecycleThresholdForServiceTest(t *testing.T, threshold int) {
	t.Helper()
	oldThreshold := common.QuotaRemindThreshold
	oldBatch := common.BatchUpdateEnabled
	common.QuotaRemindThreshold = threshold
	t.Cleanup(func() {
		common.QuotaRemindThreshold = oldThreshold
		common.BatchUpdateEnabled = oldBatch
	})
}

func requireLifecycleStateForServiceTest(t *testing.T, userID int, scopeType string, scopeID string, wantBalance int64) model.QuotaLifecycleState {
	t.Helper()
	var state model.QuotaLifecycleState
	require.NoError(t, model.DB.Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).First(&state).Error)
	require.Equal(t, wantBalance, state.Balance)
	return state
}

func countLifecycleStatesForServiceTest(t *testing.T, userID int, scopeType string, scopeID string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.QuotaLifecycleState{}).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).
		Count(&count).Error)
	return count
}

func countLifecycleEventsForServiceTest(t *testing.T, userID int, scopeType string, scopeID string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).
		Count(&count).Error)
	return count
}

func countLifecycleEventsByTypeForServiceTest(t *testing.T, userID int, scopeType string, scopeID string, eventType string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.RecallLifecycleEvent{}).
		Where("user_id = ? AND scope_type = ? AND scope_id = ? AND event_type = ?", userID, scopeType, scopeID, eventType).
		Count(&count).Error)
	return count
}
