package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestSubscriptionLifecycleStaticLockOrderUsesBindingBeforeContract(t *testing.T) {
	testCases := []struct {
		name           string
		path           string
		functionName   string
		bindingNeedle  string
		contractNeedle string
	}{
		{
			name:           "renewal_stripe_update",
			path:           "subscription_renewal_lifecycle.go",
			functionName:   "updateCurrentSubscriptionRenewal",
			bindingNeedle:  "lockStripeRenewalLifecycleBinding",
			contractNeedle: "loadRenewalLifecycleContract",
		},
		{
			name:           "paid_invoice_upgrade",
			path:           "subscription_upgrade.go",
			functionName:   "reconcilePaidInvoiceUpgradeTx",
			bindingNeedle:  "lockStripeUpgradeIntentBinding",
			contractNeedle: "UserSubscriptionContract",
		},
		{
			name:           "stripe_to_balance_compensation",
			path:           "subscription_compensation.go",
			functionName:   "grantStripeToBalanceEntitlement",
			bindingNeedle:  "lockStripeToBalanceCompensationBinding",
			contractNeedle: "UserSubscriptionContract",
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			body := sourceFunctionBody(t, testCase.path, testCase.functionName)
			bindingIndex := strings.Index(body, testCase.bindingNeedle)
			contractIndex := strings.Index(body, testCase.contractNeedle)
			require.NotEqual(t, -1, bindingIndex, "missing binding lock marker")
			require.NotEqual(t, -1, contractIndex, "missing contract lock marker")
			require.Less(t, bindingIndex, contractIndex)
		})
	}
}

func TestRenewalLifecycleConfirmationValidationUsesTransactionDBClock(t *testing.T) {
	body := sourceFunctionBody(t, "subscription_renewal_lifecycle.go", "validateRenewalLifecycleContractForConfirmationTx")

	require.Contains(t, body, "now, err := subscriptionLifecycleDBTimestampTx(tx)")
	require.NotContains(t, body, "common.GetTimestamp()")
}

func sourceFunctionBody(t *testing.T, path string, functionName string) string {
	t.Helper()
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	source := string(raw)
	start := strings.Index(source, "func "+functionName+"(")
	require.NotEqual(t, -1, start)
	open := strings.Index(source[start:], "{")
	require.NotEqual(t, -1, open)
	index := start + open
	depth := 0
	for ; index < len(source); index++ {
		switch source[index] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return source[start : index+1]
			}
		}
	}
	t.Fatalf("function body not closed for %s", functionName)
	return ""
}

func TestCancelCurrentSubscriptionRenewalStripeUsesAuthoritativeCurrentBinding(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7941, false, "sub_unified_cancel")
	stale := insertStripeRenewalLifecycleBinding(t, contract.UserId, contract.Id, contract.CurrentPlanId, "sub_unified_cancel_stale", false)
	require.NoError(t, model.DB.Model(stale).Updates(map[string]interface{}{
		"provider_status": "canceled",
		"ended_at":        common.GetTimestamp(),
	}).Error)
	originalCancel := cancelCurrentStripeRecurringSubscription
	t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
	var gotUserID int
	var gotBindingID int64
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		gotUserID = userID
		gotBindingID = bindingID
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, contract.CurrentProviderBindingId, bindingID)
		require.NotEqual(t, stale.Id, bindingID)
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		require.NoError(t, model.DB.WithContext(ctx).Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("base_user_group", "cancel_delegate_seen").Error)
		var delegatedBinding model.SubscriptionProviderBinding
		require.NoError(t, model.DB.WithContext(ctx).First(&delegatedBinding, bindingID).Error)
		require.Equal(t, binding.ProviderSubscriptionId, delegatedBinding.ProviderSubscriptionId)
		delegatedBinding.CancelAtPeriodEnd = true
		return &delegatedBinding, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, contract.UserId, gotUserID)
	require.Equal(t, binding.Id, gotBindingID)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.Equal(t, binding.CurrentPeriodEnd, result.CurrentPeriodEnd)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, storedContract.RenewalStatus)
	require.Equal(t, "cancel_delegate_seen", storedContract.BaseUserGroup)
}

func TestCancelCurrentSubscriptionRenewalReservesBindingBeforeStripeMutation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7949, false, "sub_unified_cancel_reserved")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalUpdate := stripeUpdateSubscriptionCancelAtPeriodEnd
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeUpdateSubscriptionCancelAtPeriodEnd = originalUpdate
	})
	cancelCurrentStripeRecurringSubscription = CancelStripeRecurringSubscription
	var terminationErr error
	stripeUpdateSubscriptionCancelAtPeriodEnd = func(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		require.True(t, cancelAtPeriodEnd)
		require.NotEmpty(t, idempotencyKey)
		_, terminationErr = model.ApplyProviderSubscriptionTermination(binding.Id, model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		})
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, terminationErr, model.ErrSubscriptionProviderLifecycleConflict)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	var stored model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&stored, binding.Id).Error)
	require.True(t, stored.CancelAtPeriodEnd)
	require.Zero(t, stored.EndedAt)
}

func TestProviderLifecycleReservationBlocksCurrentEntitlementReplacement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalLifecycleContract(t, 7959, false, "sub_unified_replace_reserved")
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"replace-reservation-token",
		300,
	)
	require.NoError(t, err)
	require.NotNil(t, reservation)

	periodStart := common.GetTimestamp()
	result, err := model.RotateCurrentEntitlement(model.GrantEntitlementInput{
		ContractId:           contract.Id,
		UserId:               contract.UserId,
		PlanId:               contract.CurrentPlanId,
		ProviderBindingId:    0,
		GrantKey:             "replacement-during-provider-mutation",
		PaymentMode:          model.SubscriptionPaymentModePrepaid,
		AmountTotal:          700,
		PeriodStart:          periodStart,
		PeriodEnd:            periodStart + 7200,
		EndReasonForPrevious: model.SubscriptionEntitlementEndReasonUpgraded,
		Source:               model.PaymentMethodBalance,
		UpgradeGroup:         common.GetPointer(""),
	})

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, binding.Id, storedContract.CurrentProviderBindingId)
	require.Equal(t, entitlement.Id, storedContract.CurrentEntitlementId)
}

func TestProviderLifecycleReservationCanBeReclaimedAfterExpiry(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	_, binding, _ := seedStripeRenewalLifecycleContract(t, 7969, false, "sub_unified_expired_reservation")
	first, reservedBinding, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"expired-reservation-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", model.GetDBTimestamp()-1).Error)

	second, reclaimedBinding, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		reservedBinding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"reclaimed-reservation-token",
		300,
	)

	require.NoError(t, err)
	require.Equal(t, "reclaimed-reservation-token", second.Token)
	require.Equal(t, model.SubscriptionProviderLifecycleActionResume, second.Action)
	require.Equal(t, first.LifecycleActionSeq+1, second.LifecycleActionSeq)
	require.Equal(t, second.LifecycleActionSeq, reclaimedBinding.LifecycleActionSeq)
	_, err = model.ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(first, model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
	})
	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
}

func TestProviderLifecycleReservationRejectsDifferentTokenForSameActiveAction(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	_, binding, _ := seedStripeRenewalLifecycleContract(t, 7970, false, "sub_unified_same_action_reservation")
	first, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"same-action-first-token",
		300,
	)
	require.NoError(t, err)

	second, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		first.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"same-action-second-token",
		300,
	)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, second)
}

func TestProviderLifecycleReservationReusesSequenceForExpiredSameAction(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	_, binding, _ := seedStripeRenewalLifecycleContract(t, 7971, false, "sub_unified_same_action_retry")
	first, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"same-action-expired-first-token",
		300,
	)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
		Where("id = ?", binding.Id).
		Update("lifecycle_reservation_until", model.GetDBTimestamp()-1).Error)

	second, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		first.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"same-action-expired-second-token",
		300,
	)

	require.NoError(t, err)
	require.Equal(t, first.LifecycleActionSeq, second.LifecycleActionSeq)
	require.NotEqual(t, first.Token, second.Token)
}

func TestSubscriptionProviderLifecycleReservationRejectsOversizedToken(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	_, binding, _ := seedStripeRenewalLifecycleContract(t, 7972, false, "sub_unified_oversized_token")

	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		binding.Id,
		binding.UserId,
		binding.ProviderSubscriptionId,
		binding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		strings.Repeat("x", 129),
		300,
	)

	require.Error(t, err)
	require.Nil(t, reservation)
}

func TestStripeRenewalTransitionAlreadyAtTargetRejectsWithoutProviderMutation(t *testing.T) {
	testCases := []struct {
		name              string
		cancelAtPeriodEnd bool
		invoke            func(userID int) (*SubscriptionRenewalLifecycleResult, error)
		installFailure    func(t *testing.T)
	}{
		{
			name:              "cancel already scheduled",
			cancelAtPeriodEnd: true,
			invoke:            CancelCurrentSubscriptionRenewal,
			installFailure: func(t *testing.T) {
				original := cancelCurrentStripeRecurringSubscription
				t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = original })
				cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
					return nil, errors.New("duplicate cancel reached Stripe delegate")
				}
			},
		},
		{
			name:              "renewal already enabled",
			cancelAtPeriodEnd: false,
			invoke:            ResumeCurrentSubscriptionRenewal,
			installFailure: func(t *testing.T) {
				original := resumeCurrentStripeRecurringSubscription
				t.Cleanup(func() { resumeCurrentStripeRecurringSubscription = original })
				resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
					return nil, errors.New("duplicate resume reached Stripe delegate")
				}
			},
		},
	}

	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			contract, _, _ := seedStripeRenewalLifecycleContract(t, 7950+index, testCase.cancelAtPeriodEnd, "sub_target_state_"+testCase.name)
			testCase.installFailure(t)

			result, err := testCase.invoke(contract.UserId)

			require.ErrorContains(t, err, "already matches requested state")
			require.Nil(t, result)
		})
	}
}

func TestOppositeStripeRenewalActionCannotMutateWhileCancelIsInFlight(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7952, false, "sub_cancel_in_flight")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalResume := resumeCurrentStripeRecurringSubscription
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		resumeCurrentStripeRecurringSubscription = originalResume
	})
	cancelStarted := make(chan struct{})
	releaseCancel := make(chan struct{}, 1)
	t.Cleanup(func() {
		select {
		case releaseCancel <- struct{}{}:
		default:
		}
	})
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		close(cancelStarted)
		<-releaseCancel
		updated := *binding
		updated.CancelAtPeriodEnd = true
		return &updated, nil
	}
	var resumeCalls atomic.Int32
	resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		resumeCalls.Add(1)
		return nil, errors.New("opposite resume reached Stripe delegate")
	}
	type lifecycleCallResult struct {
		result *SubscriptionRenewalLifecycleResult
		err    error
	}
	cancelResult := make(chan lifecycleCallResult, 1)
	go func() {
		result, err := CancelCurrentSubscriptionRenewal(contract.UserId)
		cancelResult <- lifecycleCallResult{result: result, err: err}
	}()
	select {
	case <-cancelStarted:
	case <-time.After(time.Second):
		t.Fatal("cancel delegate did not start")
	}

	resumeResult, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "already matches requested state")
	require.Nil(t, resumeResult)
	require.Zero(t, resumeCalls.Load())
	releaseCancel <- struct{}{}
	select {
	case completed := <-cancelResult:
		require.NoError(t, completed.err)
		require.NotNil(t, completed.result)
		require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, completed.result.RenewalStatus)
	case <-time.After(time.Second):
		t.Fatal("cancel did not complete")
	}
}

func TestStripeRenewalLifecycleResultNeverExposesTerminalBindingAsEnabled(t *testing.T) {
	testCases := []struct {
		name       string
		status     string
		endedAt    int64
		wantStatus string
	}{
		{name: "user canceled", status: "canceled", endedAt: 100},
		{name: "unpaid terminal", status: "unpaid", endedAt: 100},
		{name: "incomplete expired terminal", status: "incomplete_expired", endedAt: 100},
		{name: "incomplete", status: "incomplete"},
		{name: "active but already ended", status: "active", endedAt: 100},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			result := buildStripeSubscriptionRenewalLifecycleResult(&model.SubscriptionProviderBinding{
				ProviderStatus:   testCase.status,
				EndedAt:          testCase.endedAt,
				CurrentPeriodEnd: 200,
			})

			require.Equal(t, testCase.wantStatus, result.RenewalStatus)
			require.False(t, result.CanCancel)
			require.False(t, result.CanResume)
			require.False(t, result.CancelAtPeriodEnd)
		})
	}
}

func TestStripeRenewalMutationRejectsNonActionableResultStatus(t *testing.T) {
	testCases := []struct {
		name              string
		cancelAtPeriodEnd bool
		invoke            func(userID int) (*SubscriptionRenewalLifecycleResult, error)
		installResult     func(t *testing.T, binding *model.SubscriptionProviderBinding)
	}{
		{
			name:              "cancel",
			cancelAtPeriodEnd: false,
			invoke:            CancelCurrentSubscriptionRenewal,
			installResult: func(t *testing.T, binding *model.SubscriptionProviderBinding) {
				original := cancelCurrentStripeRecurringSubscription
				t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = original })
				cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
					updated := *binding
					updated.ProviderStatus = "past_due"
					updated.CancelAtPeriodEnd = true
					return &updated, nil
				}
			},
		},
		{
			name:              "resume",
			cancelAtPeriodEnd: true,
			invoke:            ResumeCurrentSubscriptionRenewal,
			installResult: func(t *testing.T, binding *model.SubscriptionProviderBinding) {
				original := resumeCurrentStripeRecurringSubscription
				t.Cleanup(func() { resumeCurrentStripeRecurringSubscription = original })
				resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
					updated := *binding
					updated.ProviderStatus = "past_due"
					updated.CancelAtPeriodEnd = false
					return &updated, nil
				}
			},
		},
	}

	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			contract, binding, _ := seedStripeRenewalLifecycleContract(
				t,
				7960+index,
				testCase.cancelAtPeriodEnd,
				"sub_non_actionable_result_"+testCase.name,
			)
			testCase.installResult(t, binding)

			result, err := testCase.invoke(contract.UserId)

			require.ErrorContains(t, err, "requires support")
			require.Nil(t, result)
		})
	}
}

func TestResumeCurrentSubscriptionRenewalStripeUsesAuthoritativeCurrentBinding(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7942, true, "sub_unified_resume")
	stale := insertStripeRenewalLifecycleBinding(t, contract.UserId, contract.Id, contract.CurrentPlanId, "sub_unified_resume_stale", true)
	require.NoError(t, model.DB.Model(stale).Updates(map[string]interface{}{
		"provider_status": "canceled",
		"ended_at":        common.GetTimestamp(),
	}).Error)
	originalResume := resumeCurrentStripeRecurringSubscription
	t.Cleanup(func() { resumeCurrentStripeRecurringSubscription = originalResume })
	var gotUserID int
	var gotBindingID int64
	resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		gotUserID = userID
		gotBindingID = bindingID
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, contract.CurrentProviderBindingId, bindingID)
		require.NotEqual(t, stale.Id, bindingID)
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		require.NoError(t, model.DB.WithContext(ctx).Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("base_user_group", "resume_delegate_seen").Error)
		var delegatedBinding model.SubscriptionProviderBinding
		require.NoError(t, model.DB.WithContext(ctx).First(&delegatedBinding, bindingID).Error)
		require.Equal(t, binding.ProviderSubscriptionId, delegatedBinding.ProviderSubscriptionId)
		delegatedBinding.CancelAtPeriodEnd = false
		return &delegatedBinding, nil
	}

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, contract.UserId, gotUserID)
	require.Equal(t, binding.Id, gotBindingID)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, result.RenewalStatus)
	require.Equal(t, binding.CurrentPeriodEnd, result.CurrentPeriodEnd)
	require.True(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.False(t, result.CancelAtPeriodEnd)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, storedContract.RenewalStatus)
	require.Equal(t, "resume_delegate_seen", storedContract.BaseUserGroup)
}

func TestCancelCurrentSubscriptionRenewalStripeRejectsUnsafeBindingStates(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding)
	}{
		{
			name: "missing_current_provider_binding",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Model(contract).Update("current_provider_binding_id", 0).Error)
			},
		},
		{
			name: "binding_other_user",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Create(&model.User{
					Id:       contract.UserId + 1000,
					Username: "stripe_lifecycle_other_user",
					Status:   common.UserStatusEnabled,
					AffCode:  "stripe_lifecycle_other_user",
				}).Error)
				require.NoError(t, model.DB.Model(binding).Update("user_id", contract.UserId+1000).Error)
			},
		},
		{
			name: "binding_other_contract",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Model(binding).Update("contract_id", contract.Id+1000).Error)
			},
		},
		{
			name: "terminal_binding",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Model(binding).Update("provider_status", "canceled").Error)
			},
		},
		{
			name: "incomplete_current_binding",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Model(binding).Update("provider_status", "incomplete").Error)
			},
		},
		{
			name: "blank_provider_subscription_id",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				require.NoError(t, model.DB.Model(binding).Update("provider_subscription_id", "   ").Error)
			},
		},
		{
			name: "multiple_non_terminal_bindings",
			mutate: func(t *testing.T, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding) {
				_ = insertStripeRenewalLifecycleBinding(t, contract.UserId, contract.Id, contract.CurrentPlanId, "sub_unified_ambiguous_extra", false)
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			setupSubscriptionPurchaseServiceTestDB(t)
			contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7943, false, "sub_unified_reject_"+tc.name)
			tc.mutate(t, contract, binding)
			originalCancel := cancelCurrentStripeRecurringSubscription
			t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
			cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
				t.Fatal("unsafe unified Stripe cancel must not reach the provider delegate")
				return nil, nil
			}

			result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

			require.Error(t, err)
			require.Nil(t, result)
		})
	}
}

func TestCancelCurrentSubscriptionRenewalStripeIgnoresUnfinishedCheckoutBinding(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7945, false, "sub_unified_valid")
	unfinished := insertStripeRenewalLifecycleBinding(t, contract.UserId, contract.Id, contract.CurrentPlanId, "sub_unified_unfinished", false)
	require.NoError(t, model.DB.Model(unfinished).Update("provider_status", "incomplete").Error)
	originalCancel := cancelCurrentStripeRecurringSubscription
	t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		result := *binding
		result.CancelAtPeriodEnd = true
		return &result, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsLockedProviderContractMovedToWalletBeforeStripeMutation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, _, _ := seedStripeRenewalLifecycleContract(t, 7946, false, "sub_unified_source_moved_wallet")
	var moved atomic.Bool
	callbackName := "test:subscription_renewal_source_moved:" + t.Name()
	require.NoError(t, model.DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Table != "user_subscription_contracts" || !moved.CompareAndSwap(false, true) {
			return
		}
		require.NoError(t, tx.Session(&gorm.Session{NewDB: true}).
			Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("renewal_source", model.SubscriptionRenewalSourceWallet).Error)
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Query().Remove(callbackName))
	})
	originalCancel := cancelCurrentStripeRecurringSubscription
	t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
	var delegateCalls atomic.Int32
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		delegateCalls.Add(1)
		return nil, errors.New("Stripe cancel delegate reached after renewal source moved")
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "renewal source")
	require.Nil(t, result)
	require.Zero(t, delegateCalls.Load())
}

func TestResumeCurrentSubscriptionRenewalStripeRejectsProviderFailureWithoutPseudoSuccess(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7944, true, "sub_unified_resume_failure")
	originalResume := resumeCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		resumeCurrentStripeRecurringSubscription = originalResume
		stripeSubscriptionSnapshotGetter = originalGet
	})
	providerErr := errors.New("stripe update failed")
	resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		return nil, providerErr
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, providerErr)
	require.Nil(t, result)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, storedContract.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalReturnsConfirmedRemoteStateAfterLocalSyncFailure(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7946, false, "sub_unified_cancel_sync_failure")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-local-sync-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, binding.LifecycleActionSeq+1, storedBinding.LifecycleActionSeq)
}

func TestCancelCurrentSubscriptionRenewalConfirmsTerminalSnapshotAfterLocalSyncFailure(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7953, false, "sub_unified_cancel_terminal_sync_failure")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-local-sync-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.Equal(t, binding.CurrentPeriodEnd, result.CurrentPeriodEnd)
	require.False(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "canceled", storedBinding.ProviderStatus)
	require.Greater(t, storedBinding.EndedAt, int64(0))
	require.Equal(t, "cancel-terminal-local-sync-recovery", storedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionCancel, storedBinding.LifecycleReservationAction)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
	var entitlement model.UserSubscription
	require.NoError(t, model.DB.Where("provider_binding_id = ?", binding.Id).First(&entitlement).Error)
	require.Equal(t, "cancelled", entitlement.Status)
}

func TestCancelCurrentSubscriptionRenewalReturnsConfirmedTerminalRenewalResult(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7957, false, "sub_unified_cancel_terminal_empty_result")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-empty-result",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.Equal(t, binding.CurrentPeriodEnd, result.CurrentPeriodEnd)
	require.False(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
}

func TestCancelCurrentSubscriptionRenewalReturnsTerminalLocalStateAfterConcurrentApply(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7954, false, "sub_unified_cancel_terminal_concurrent_apply")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot apply raced")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-concurrent-apply",
			300,
		)
		require.NoError(t, reserveErr)
		_, applyErr := model.ApplyProviderSubscriptionTerminationWithReservation(reservation, model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		})
		require.NoError(t, applyErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "canceled", storedBinding.ProviderStatus)
	require.Greater(t, storedBinding.EndedAt, int64(0))
	require.Equal(t, "cancel-terminal-concurrent-apply", storedBinding.LifecycleReservationToken)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
}

func TestCancelCurrentSubscriptionRenewalReturnsTerminalLocalStateAfterContractEnded(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7955, false, "sub_unified_cancel_terminal_contract_ended")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot already applied")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-contract-ended",
			300,
		)
		require.NoError(t, reserveErr)
		_, applyErr := model.ApplyProviderSubscriptionTerminationWithReservation(reservation, model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		})
		require.NoError(t, applyErr)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("status", model.SubscriptionContractStatusEnded).Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalSourceProvider, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, storedContract.Status)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "canceled", storedBinding.ProviderStatus)
	require.Equal(t, "cancel-terminal-contract-ended", storedBinding.LifecycleReservationToken)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
}

func TestCancelCurrentSubscriptionRenewalDoesNotConfirmTerminalStaleBindingAfterContractMoves(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7956, false, "sub_unified_cancel_terminal_stale_moved")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot already applied")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-stale-moved",
			300,
		)
		require.NoError(t, reserveErr)
		_, applyErr := model.ApplyProviderSubscriptionTerminationWithReservation(reservation, model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		})
		require.NoError(t, applyErr)
		replacement := insertStripeRenewalLifecycleBinding(t, contract.UserId, contract.Id, contract.CurrentPlanId, "sub_unified_cancel_terminal_replacement", false)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("current_provider_binding_id", replacement.Id).Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.NotEqual(t, binding.Id, storedContract.CurrentProviderBindingId)
}

func TestCancelCurrentSubscriptionRenewalDoesNotConfirmTerminalSnapshotAfterApplyConflict(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7958, false, "sub_unified_cancel_terminal_apply_conflict")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local terminal subscription snapshot apply conflicted")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-terminal-apply-conflict",
			300,
		)
		require.NoError(t, reserveErr)
		require.NoError(t, model.DB.Exec(fmt.Sprintf(`
			CREATE TRIGGER conflict_terminal_renewal_apply
			BEFORE UPDATE OF ended_at ON subscription_provider_bindings
			WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d
			BEGIN
				UPDATE subscription_provider_bindings
				SET lifecycle_action_seq = OLD.lifecycle_action_seq + 1
				WHERE id = OLD.id;
				SELECT RAISE(IGNORE);
			END
		`, binding.Id, reservation.LifecycleActionSeq)).Error)
		t.Cleanup(func() {
			require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS conflict_terminal_renewal_apply").Error)
		})
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "canceled",
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalReturnsConsumedLocalStateAfterPostApplyFailure(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7952, false, "sub_unified_cancel_post_apply_failure")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	postApplyErr := errors.New("post-apply cleanup failed")
	var reservation *model.SubscriptionProviderLifecycleReservation
	snapshot := model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId: binding.ProviderSubscriptionId,
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      true,
		CurrentPeriodStart:     binding.CurrentPeriodStart,
		CurrentPeriodEnd:       binding.CurrentPeriodEnd,
	}
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		var reserveErr error
		reservation, _, reserveErr = model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-post-apply-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		_, applyErr := model.ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, snapshot)
		require.NoError(t, applyErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(postApplyErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return snapshot, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.NotNil(t, reservation)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, reservation.LifecycleActionSeq, storedBinding.LifecycleActionSeq)
	require.Equal(t, reservation.Token, storedBinding.LifecycleReservationToken)
	require.Equal(t, reservation.Action, storedBinding.LifecycleReservationAction)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
}

func TestCancelCurrentSubscriptionRenewalConfirmsReservedMutationWhenContractNeedsAttention(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7934, false, "sub_unified_cancel_needs_attention")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-needs-attention-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, binding.LifecycleActionSeq+1, storedBinding.LifecycleActionSeq)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, storedContract.Status)
}

func TestCancelCurrentSubscriptionRenewalRejectsNeedsAttentionContractBeforeProviderMutation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, _, _ := seedStripeRenewalLifecycleContract(t, 7935, false, "sub_unified_cancel_needs_attention_command")
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
	originalCancel := cancelCurrentStripeRecurringSubscription
	t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		return nil, errors.New("needs_attention command reached Stripe delegate")
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "active subscription contract is required")
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalConfirmsWrappedLifecycleConflictOwnedByThisRequest(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7951, false, "sub_unified_cancel_wrapped_conflict")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	var ownedReservation *model.SubscriptionProviderLifecycleReservation
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-wrapped-conflict-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		ownedReservation = reservation
		mutationErr := fmt.Errorf("local subscription snapshot apply failed: %w", model.ErrSubscriptionProviderLifecycleConflict)
		return nil, wrapStripeSubscriptionLifecycleMutationError(mutationErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.True(t, result.CancelAtPeriodEnd)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	require.NotNil(t, ownedReservation)
	require.Equal(t, ownedReservation.Token, storedBinding.LifecycleReservationToken)
	require.Equal(t, ownedReservation.Action, storedBinding.LifecycleReservationAction)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
}

func TestCancelCurrentSubscriptionRenewalConfirmsWrappedCancelForNeedsAttentionPastDueBinding(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7937, false, "sub_unified_cancel_needs_attention_past_due")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	var reservation *model.SubscriptionProviderLifecycleReservation
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		var reserveErr error
		reservation, _, reserveErr = model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-needs-attention-past-due",
			300,
		)
		require.NoError(t, reserveErr)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
		require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
			Where("id = ?", binding.Id).
			Update("provider_status", "past_due").Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	require.NotNil(t, reservation)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.Equal(t, "active", storedBinding.ProviderStatus)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, reservation.Token, storedBinding.LifecycleReservationToken)
	require.Equal(t, reservation.Action, storedBinding.LifecycleReservationAction)
	require.Zero(t, storedBinding.LifecycleReservationUntil)
}

func TestResumeCurrentSubscriptionRenewalReturnsConfirmedRemoteStateAfterLocalSyncFailure(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7947, true, "sub_unified_resume_sync_failure")
	originalResume := resumeCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		resumeCurrentStripeRecurringSubscription = originalResume
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionResume,
			"resume-local-sync-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, result.RenewalStatus)
	require.True(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.False(t, result.CancelAtPeriodEnd)
	require.False(t, result.SyncPending)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.False(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, binding.LifecycleActionSeq+1, storedBinding.LifecycleActionSeq)
}

func TestResumeCurrentSubscriptionRenewalDoesNotConfirmReservedMutationWhenContractNeedsAttention(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7936, true, "sub_unified_resume_needs_attention")
	originalResume := resumeCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		resumeCurrentStripeRecurringSubscription = originalResume
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	var reservation *model.SubscriptionProviderLifecycleReservation
	resumeCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		var reserveErr error
		reservation, _, reserveErr = model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionResume,
			"resume-needs-attention-recovery",
			300,
		)
		require.NoError(t, reserveErr)
		require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Update("status", model.SubscriptionContractStatusNeedsAttention).Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      false,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
	require.NotNil(t, reservation)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.True(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, reservation.LifecycleActionSeq, storedBinding.LifecycleActionSeq)
	require.Equal(t, reservation.Token, storedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionResume, storedBinding.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, storedBinding.LifecycleReservationUntil)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, storedContract.Status)
}

func TestCancelCurrentSubscriptionRenewalDoesNotConfirmLifecycleConflictFromProviderSnapshot(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7949, false, "sub_unified_cancel_lifecycle_conflict")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		return nil, model.ErrSubscriptionProviderLifecycleConflict
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalDoesNotConfirmAfterBindingSequenceAdvances(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7931, false, "sub_unified_cancel_sequence_advanced")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-sequence-advanced",
			300,
		)
		require.NoError(t, reserveErr)
		require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).
			Where("id = ?", binding.Id).
			Update("lifecycle_action_seq", reservation.LifecycleActionSeq+1).Error)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalDoesNotUseForeignReservationForRecovery(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7932, false, "sub_unified_cancel_foreign_reservation")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		_, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"foreign-recovery-reservation",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, localSyncErr
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalDoesNotConfirmWhenStrictRecoveryCASLosesToSameTarget(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7933, false, "sub_unified_cancel_strict_cas")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	localSyncErr := errors.New("local subscription snapshot apply failed")
	var reservation *model.SubscriptionProviderLifecycleReservation
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		var reserveErr error
		reservation, _, reserveErr = model.ReserveSubscriptionProviderLifecycle(
			binding.Id,
			binding.UserId,
			binding.ProviderSubscriptionId,
			binding.LifecycleActionSeq,
			model.SubscriptionProviderLifecycleActionCancel,
			"cancel-strict-cas",
			300,
		)
		require.NoError(t, reserveErr)
		return nil, wrapStripeSubscriptionLifecycleMutationError(localSyncErr, reservation)
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "active",
			CancelAtPeriodEnd:      true,
			CurrentPeriodStart:     binding.CurrentPeriodStart,
			CurrentPeriodEnd:       binding.CurrentPeriodEnd,
		}, nil
	}
	require.NoError(t, model.DB.Exec(fmt.Sprintf(`
		CREATE TRIGGER advance_renewal_seq_to_same_target
		BEFORE UPDATE OF cancel_at_period_end ON subscription_provider_bindings
		WHEN OLD.id = %d AND OLD.lifecycle_action_seq = %d AND NEW.cancel_at_period_end = 1
		BEGIN
			UPDATE subscription_provider_bindings
			SET cancel_at_period_end = 1,
				lifecycle_action_seq = OLD.lifecycle_action_seq + 1
			WHERE id = OLD.id;
			SELECT RAISE(IGNORE);
		END
	`, binding.Id, binding.LifecycleActionSeq+1)).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS advance_renewal_seq_to_same_target").Error)
	})

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, localSyncErr)
	require.Nil(t, result)
	var storedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&storedBinding, binding.Id).Error)
	require.False(t, storedBinding.CancelAtPeriodEnd)
	require.Equal(t, reservation.LifecycleActionSeq, storedBinding.LifecycleActionSeq)
}

func TestCancelCurrentSubscriptionRenewalDoesNotTreatUnpaidSnapshotAsConfirmedCancellation(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalLifecycleContract(t, 7948, false, "sub_unified_cancel_unpaid")
	originalCancel := cancelCurrentStripeRecurringSubscription
	originalGet := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		cancelCurrentStripeRecurringSubscription = originalCancel
		stripeSubscriptionSnapshotGetter = originalGet
	})
	providerErr := errors.New("stripe cancellation failed")
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		require.Equal(t, contract.UserId, userID)
		require.Equal(t, binding.Id, bindingID)
		return nil, providerErr
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: providerSubscriptionID,
			ProviderStatus:         "unpaid",
			EndedAt:                common.GetTimestamp(),
		}, nil
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorIs(t, err, providerErr)
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalMarksWalletAutoCancelledAndIsIdempotent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7821, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7921, 700, plan, periodEnd)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, result.RenewalStatus)
	require.Equal(t, periodEnd, result.CurrentPeriodEnd)
	require.False(t, result.CanCancel)
	require.True(t, result.CanResume)
	require.True(t, result.CancelAtPeriodEnd)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
	firstUpdatedAt := stored.UpdatedAt
	contractUpdates := countSubscriptionContractUpdates(t)

	replay, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, replay.RenewalStatus)
	require.False(t, replay.CanCancel)
	require.True(t, replay.CanResume)
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, firstUpdatedAt, stored.UpdatedAt)
	require.Zero(t, *contractUpdates)
}

func TestCancelCurrentSubscriptionRenewalRejectsZeroRowWalletCAS(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7831, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7932, 700, plan, periodEnd)

	require.NoError(t, model.DB.Exec(`
		CREATE TRIGGER ignore_wallet_renewal_status_update
		BEFORE UPDATE OF renewal_status ON user_subscription_contracts
		BEGIN
			SELECT RAISE(IGNORE);
		END
	`).Error)
	t.Cleanup(func() {
		require.NoError(t, model.DB.Exec("DROP TRIGGER IF EXISTS ignore_wallet_renewal_status_update").Error)
	})

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "subscription renewal status cannot be changed")
	require.Nil(t, result)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
}

func TestResumeCurrentSubscriptionRenewalRestoresWalletAutoEnabledAndIsIdempotent(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7822, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7922, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalSourceWallet, result.RenewalSource)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, result.RenewalStatus)
	require.Equal(t, periodEnd, result.CurrentPeriodEnd)
	require.True(t, result.CanCancel)
	require.False(t, result.CanResume)
	require.False(t, result.CancelAtPeriodEnd)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
	firstUpdatedAt := stored.UpdatedAt
	contractUpdates := countSubscriptionContractUpdates(t)

	replay, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.NoError(t, err)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, replay.RenewalStatus)
	require.True(t, replay.CanCancel)
	require.False(t, replay.CanResume)
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, firstUpdatedAt, stored.UpdatedAt)
	require.Zero(t, *contractUpdates)
}

func TestResumeCurrentSubscriptionRenewalRejectsExpiredPeriod(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7823, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 1
	contract, _ := seedWalletRenewalContract(t, 7923, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.Error(t, err)
	require.Nil(t, result)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsInactiveOrMismatchedEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7824, 1, 7, 700)
	futureEnd := common.GetTimestamp() + 3600
	inactiveContract, _ := seedWalletRenewalContract(t, 7924, 700, plan, futureEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", inactiveContract.Id).
		Update("status", model.SubscriptionContractStatusEnded).Error)

	inactiveResult, inactiveErr := CancelCurrentSubscriptionRenewal(inactiveContract.UserId)

	require.Error(t, inactiveErr)
	require.Nil(t, inactiveResult)

	contract, _ := seedWalletRenewalContract(t, 7925, 700, plan, futureEnd)
	otherContract, otherEntitlement := seedWalletRenewalContract(t, 7926, 700, plan, futureEnd)
	require.NotEqual(t, contract.Id, otherContract.Id)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("current_entitlement_id", otherEntitlement.Id).Error)

	mismatchResult, mismatchErr := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.Error(t, mismatchErr)
	require.Nil(t, mismatchResult)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsHistoricalCurrentEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7829, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, entitlement := seedWalletRenewalContract(t, 7929, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("id = ? AND contract_id = ?", entitlement.Id, contract.Id).
		Update("status", model.SubscriptionEntitlementStatusHistorical).Error)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
	require.NotNil(t, storedEntitlement.CurrentSlot)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "active current subscription entitlement")
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, storedContract.RenewalStatus)
}

func TestResumeCurrentSubscriptionRenewalRejectsHistoricalCurrentEntitlement(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7830, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, entitlement := seedWalletRenewalContract(t, 7930, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).
		Where("id = ? AND contract_id = ?", entitlement.Id, contract.Id).
		Update("status", model.SubscriptionEntitlementStatusHistorical).Error)
	var storedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&storedEntitlement, "id = ?", entitlement.Id).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, storedEntitlement.Status)
	require.NotNil(t, storedEntitlement.CurrentSlot)

	result, err := ResumeCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "active current subscription entitlement")
	require.Nil(t, result)
	var storedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&storedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, storedContract.RenewalStatus)
}

func TestCancelCurrentSubscriptionRenewalRejectsProviderSourceWithoutStripeRecurringMode(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7825, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7927, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_source", model.SubscriptionRenewalSourceProvider).Error)

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "Stripe recurring")
	require.Nil(t, result)
}

func TestCancelCurrentSubscriptionRenewalRejectsProviderBindingWithoutStripeRecurringMode(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	contract, _, _ := seedStripeRenewalLifecycleContract(t, 7929, false, "sub_unified_non_recurring_mode")
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("payment_mode", model.SubscriptionPaymentModePrepaid).Error)
	originalCancel := cancelCurrentStripeRecurringSubscription
	t.Cleanup(func() { cancelCurrentStripeRecurringSubscription = originalCancel })
	delegateCalled := false
	cancelCurrentStripeRecurringSubscription = func(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
		delegateCalled = true
		return nil, errors.New("Stripe cancel delegate reached")
	}

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.ErrorContains(t, err, "Stripe recurring")
	require.Nil(t, result)
	require.False(t, delegateCalled)
}

func TestCancelCurrentSubscriptionRenewalPropagatesDBClockFailure(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7827, 1, 7, 700)
	periodEnd := common.GetTimestamp() + 3600
	contract, _ := seedWalletRenewalContract(t, 7931, 700, plan, periodEnd)
	originalUsingSQLite := common.UsingSQLite
	originalUsingPostgreSQL := common.UsingPostgreSQL
	t.Cleanup(func() {
		common.UsingSQLite = originalUsingSQLite
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
	common.UsingSQLite = false
	common.UsingPostgreSQL = true

	result, err := CancelCurrentSubscriptionRenewal(contract.UserId)

	require.Error(t, err)
	require.Nil(t, result)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, contract.Id).Error)
	require.Equal(t, model.SubscriptionRenewalStatusEnabled, stored.RenewalStatus)
}

func TestRunWalletSubscriptionRenewalOnceSkipsCancelledByUserWithoutWalletLedger(t *testing.T) {
	setupSubscriptionPurchaseServiceTestDB(t)
	plan := insertPurchaseServicePlan(t, 7826, 1, 7, 700)
	periodEnd := common.GetTimestamp() - 15
	contract, _ := seedWalletRenewalContract(t, 7928, 700, plan, periodEnd)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ?", contract.Id).
		Update("renewal_status", model.SubscriptionRenewalStatusCancelledByUser).Error)

	renewed, err := RunWalletSubscriptionRenewalOnce(10)

	require.NoError(t, err)
	require.Zero(t, renewed)
	var ledgerCount int64
	require.NoError(t, model.DB.Model(&model.WalletLedgerEntry{}).Where("user_id = ?", contract.UserId).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount)
	var stored model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&stored, "id = ?", contract.Id).Error)
	require.Equal(t, periodEnd, stored.CurrentPeriodEnd)
	require.Equal(t, model.SubscriptionRenewalStatusCancelledByUser, stored.RenewalStatus)
}

func countSubscriptionContractUpdates(t *testing.T) *int {
	t.Helper()
	count := 0
	callbackName := "test:subscription_renewal_lifecycle_contract_updates:" + t.Name()
	require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Table == "user_subscription_contracts" {
			count++
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, model.DB.Callback().Update().Remove(callbackName))
	})
	return &count
}

func seedStripeRenewalLifecycleContract(t *testing.T, userID int, cancelAtPeriodEnd bool, providerSubscriptionID string) (*model.UserSubscriptionContract, *model.SubscriptionProviderBinding, *model.UserSubscription) {
	t.Helper()
	plan := insertPurchaseServicePlan(t, 7840+userID, 1, 7, 700)
	insertPurchaseServiceUser(t, userID, 700)
	now := common.GetTimestamp()
	periodStart := now - 3600
	periodEnd := now + 3600
	binding := insertStripeRenewalLifecycleBinding(t, userID, 0, plan.Id, providerSubscriptionID, cancelAtPeriodEnd)
	currentSlot := 1
	entitlement := &model.UserSubscription{
		UserId:            userID,
		PlanId:            plan.Id,
		ContractId:        0,
		ProviderBindingId: binding.Id,
		AmountTotal:       700,
		StartTime:         periodStart,
		EndTime:           periodEnd,
		AccessEndTime:     periodEnd,
		Status:            model.SubscriptionEntitlementStatusActive,
		Source:            "order",
		PaymentMode:       model.SubscriptionPaymentModeStripeRecurring,
		CurrentSlot:       &currentSlot,
	}
	require.NoError(t, model.DB.Create(entitlement).Error)
	contract := &model.UserSubscriptionContract{
		UserId:                   userID,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              model.SubscriptionPaymentModeStripeRecurring,
		RenewalSource:            model.SubscriptionRenewalSourceProvider,
		RenewalStatus:            model.SubscriptionRenewalStatusEnabled,
		CurrentPlanId:            plan.Id,
		CurrentEntitlementId:     entitlement.Id,
		CurrentProviderBindingId: binding.Id,
		CurrentPeriodStart:       periodStart,
		CurrentPeriodEnd:         periodEnd,
	}
	require.NoError(t, model.DB.Create(contract).Error)
	require.NoError(t, model.DB.Model(binding).Update("contract_id", contract.Id).Error)
	require.NoError(t, model.DB.Model(entitlement).Update("contract_id", contract.Id).Error)
	binding.ContractId = contract.Id
	entitlement.ContractId = contract.Id
	return contract, binding, entitlement
}

func insertStripeRenewalLifecycleBinding(t *testing.T, userID int, contractID int64, planID int, providerSubscriptionID string, cancelAtPeriodEnd bool) *model.SubscriptionProviderBinding {
	t.Helper()
	now := common.GetTimestamp()
	binding := &model.SubscriptionProviderBinding{
		UserId:                 userID,
		PlanId:                 planID,
		ContractId:             contractID,
		Provider:               model.PaymentProviderStripe,
		ProviderSubscriptionId: providerSubscriptionID,
		ProviderCustomerId:     "cus_unified_lifecycle",
		ProviderPriceId:        "price_unified_lifecycle",
		ProviderStatus:         "active",
		CancelAtPeriodEnd:      cancelAtPeriodEnd,
		CurrentPeriodStart:     now - 3600,
		CurrentPeriodEnd:       now + 3600,
	}
	require.NoError(t, model.DB.Create(binding).Error)
	return binding
}
