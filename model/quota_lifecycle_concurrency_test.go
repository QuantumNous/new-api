package model

import (
	"fmt"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
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
