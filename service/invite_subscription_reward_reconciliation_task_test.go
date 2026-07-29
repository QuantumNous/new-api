package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestInviteSubscriptionRewardReconciliationRunsAllHistoryBoundedOnMaster(t *testing.T) {
	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	var gotSince int64 = -1
	var gotLimit int
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int) (int, error) {
		gotSince = sinceSeconds
		gotLimit = limit
		return 3, nil
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 3, count)
	require.Zero(t, gotSince)
	require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize, gotLimit)
}

func TestInviteSubscriptionRewardReconciliationContinuesFullBatchesUntilBound(t *testing.T) {
	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	calls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int) (int, error) {
		require.Zero(t, sinceSeconds)
		require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize, limit)
		calls++
		if calls == inviteSubscriptionRewardReconciliationMaxRounds {
			return 3, nil
		}
		return inviteSubscriptionRewardReconciliationBatchSize, nil
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize*(inviteSubscriptionRewardReconciliationMaxRounds-1)+3, count)
	require.Equal(t, inviteSubscriptionRewardReconciliationMaxRounds, calls)
}

func TestInviteSubscriptionRewardReconciliationSkipsNonMasterAndOverlaps(t *testing.T) {
	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})

	common.IsMasterNode = false
	calls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int) (int, error) {
		calls++
		return 1, nil
	}
	count, err := RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Zero(t, count)
	require.Zero(t, calls)

	common.IsMasterNode = true
	inviteSubscriptionRewardReconciliationRunning.Store(true)
	count, err = RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Zero(t, count)
	require.Zero(t, calls)
}

func TestInviteSubscriptionRewardReconciliationReturnsReconcilerError(t *testing.T) {
	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true
	expected := errors.New("reconcile failed")
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int) (int, error) {
		return 2, expected
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.ErrorIs(t, err, expected)
	require.Equal(t, 2, count)
}
