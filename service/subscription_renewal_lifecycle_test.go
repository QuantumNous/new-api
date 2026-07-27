package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

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
		{name: "user canceled", status: "canceled", endedAt: 100, wantStatus: model.SubscriptionRenewalStatusCancelledByUser},
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
		return nil, localSyncErr
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
	require.True(t, result.SyncPending)
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
		return nil, localSyncErr
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
	require.True(t, result.SyncPending)
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
