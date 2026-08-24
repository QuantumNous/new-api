package model

import (
	"fmt"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestQuotaLifecycleConcurrentDeductions(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 4)

	user := createLifecycleQuotaTestUser(t, "concurrent-wallet", 150, 100)
	start := make(chan struct{})
	var wg sync.WaitGroup
	results := make([]LifecycleQuotaMutationResult, 2)
	errs := make([]error, 2)

	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			results[i], errs[i] = applyLifecycleQuotaMutationForTest(LifecycleQuotaMutation{
				UserID:         user.Id,
				ScopeType:      QuotaLifecycleScopeWallet,
				ScopeID:        int64(user.Id),
				Delta:          -100,
				RequireAtLeast: 100,
				Cause:          "relay_charge",
				SourceRef:      fmt.Sprintf("concurrent-%d", i),
				Threshold:      100,
				OccurredAt:     1700000500 + int64(i),
			})
		}(i)
	}

	close(start)
	wg.Wait()

	applied := 0
	for _, err := range errs {
		require.NoError(t, err)
	}
	for _, result := range results {
		if result.Applied {
			applied++
			require.Equal(t, int64(150), result.PreviousBalance)
			require.Equal(t, int64(50), result.CurrentBalance)
		}
	}
	require.Equal(t, 1, applied)

	var refreshed User
	require.NoError(t, DB.Where("id = ?", user.Id).First(&refreshed).Error)
	require.Equal(t, 50, refreshed.Quota)
	requireLifecycleState(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), fmt.Sprintf("baseline:wallet:%d", user.Id), 50, 100)
	requireLifecycleEvents(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id), fmt.Sprintf("baseline:wallet:%d", user.Id), []string{RecallLifecycleTriggerQuotaLow})
}

func TestApplyWalletQuotaOverrideTxConcurrentOverridesSerializeTargets(t *testing.T) {
	setupLifecycleQuotaMutationTestDB(t, 4)

	user := createLifecycleQuotaTestUser(t, "concurrent-override", 150, 100)
	targets := []int64{90, 220}
	start := make(chan struct{})
	results := make([]LifecycleQuotaMutationResult, len(targets))
	errs := make([]error, len(targets))
	var wg sync.WaitGroup

	for i, target := range targets {
		i, target := i, target
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs[i] = DB.Transaction(func(tx *gorm.DB) error {
				var err error
				results[i], err = ApplyWalletQuotaOverrideTx(tx, user.Id, target, "admin_adjustment", fmt.Sprintf("admin:override:concurrent:%d", i))
				return err
			})
		}()
	}

	close(start)
	wg.Wait()

	for i, err := range errs {
		require.NoError(t, err)
		require.Equal(t, targets[i], results[i].CurrentBalance)
	}
	firstIndex := -1
	for i, result := range results {
		if result.PreviousBalance == 150 {
			require.Equal(t, -1, firstIndex, "only one override can observe the initial balance")
			firstIndex = i
		}
	}
	require.NotEqual(t, -1, firstIndex, "one override must observe the initial balance")
	secondIndex := 1 - firstIndex
	require.Equal(t, results[firstIndex].CurrentBalance, results[secondIndex].PreviousBalance)
	finalByResult := results[secondIndex].CurrentBalance

	require.Equal(t, int(finalByResult), walletQuotaForTest(t, user.Id))
	state := lifecycleStateForTest(t, user.Id, QuotaLifecycleScopeWallet, strconv.Itoa(user.Id))
	require.Equal(t, finalByResult, state.Balance)
}
