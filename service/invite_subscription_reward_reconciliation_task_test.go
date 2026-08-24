package service

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		gotSince = sinceSeconds
		gotLimit = limit
		require.Zero(t, cursor)
		return 3, 3, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 1, ID: 3}, nil
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
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		require.Zero(t, sinceSeconds)
		require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize, limit)
		calls++
		require.Equal(t, int64(calls-1), cursor.CompleteTime)
		require.Equal(t, calls-1, cursor.ID)
		nextCursor := model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(calls), ID: calls}
		if calls == inviteSubscriptionRewardReconciliationMaxRounds {
			return 3, 3, nextCursor, nil
		}
		return inviteSubscriptionRewardReconciliationBatchSize, inviteSubscriptionRewardReconciliationBatchSize, nextCursor, nil
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
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		calls++
		return 1, 1, cursor, nil
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
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		return 2, 2, cursor, expected
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.ErrorIs(t, err, expected)
	require.Equal(t, 2, count)
}

func TestInviteSubscriptionRewardReconciliationContinuesWhenFullBatchPartiallyFails(t *testing.T) {
	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	calls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		require.Zero(t, sinceSeconds)
		require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize, limit)
		calls++
		switch calls {
		case 1:
			require.Zero(t, cursor)
			nextCursor := model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 1, ID: inviteSubscriptionRewardReconciliationBatchSize}
			return 1, inviteSubscriptionRewardReconciliationBatchSize, nextCursor, nil
		case 2:
			require.Equal(t, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 1, ID: inviteSubscriptionRewardReconciliationBatchSize}, cursor)
			return 2, 2, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 2, ID: inviteSubscriptionRewardReconciliationBatchSize + 2}, nil
		default:
			t.Fatalf("unexpected reconciliation call %d", calls)
			return 0, 0, cursor, nil
		}
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 3, count)
	require.Equal(t, 2, calls)
}

func TestInviteSubscriptionRewardReconciliationDoesNotStarveLaterValidOrdersWhenFirstFullBatchFails(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	originalMaster := common.IsMasterNode
	originalMode := common.InviteRewardSubscriptionMode
	originalQuotaPerUnit := common.QuotaPerUnit
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		common.InviteRewardSubscriptionMode = originalMode
		common.QuotaPerUnit = originalQuotaPerUnit
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true
	common.InviteRewardSubscriptionMode = true
	common.QuotaPerUnit = 100
	common.QuotaForInviter = 750
	common.QuotaForInviterMaxCount = 0
	inviteSubscriptionRewardReconciler = model.ReconcileMissedInviteSubscriptionRewardsWithCursor

	for i := 0; i < inviteSubscriptionRewardReconciliationBatchSize; i++ {
		inviter := createInviteSubscriptionRewardReconciliationUser(t, fmt.Sprintf("blocked-inviter-%d", i), 0)
		invitee := createInviteSubscriptionRewardReconciliationUser(t, fmt.Sprintf("blocked-invitee-%d", i), inviter.Id)
		createInviteSubscriptionRewardReconciliationOrder(t, invitee.Id, fmt.Sprintf("blocked-order-%d", i), int64(1000+i))
		require.True(t, grantPollutedInviteSubscriptionRewardLedgerForTest(t, inviter.Id, invitee.Id))
	}
	validInviter := createInviteSubscriptionRewardReconciliationUser(t, "valid-inviter", 0)
	validInvitee := createInviteSubscriptionRewardReconciliationUser(t, "valid-invitee", validInviter.Id)
	createInviteSubscriptionRewardReconciliationOrder(t, validInvitee.Id, "valid-order", 2000)

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	var reward model.InviteSubscriptionReward
	require.NoError(t, model.DB.First(&reward, "invitee_id = ?", validInvitee.Id).Error)
	require.Equal(t, "valid-order", reward.TradeNo)
	require.Equal(t, model.InviteSubRewardStatusGranted, reward.Status)
}

func TestInviteSubscriptionRewardReconciliationPersistsCursorAcrossRunsWhenFailurePrefixExceedsSingleRunCapacity(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	calls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		require.Zero(t, sinceSeconds)
		if limit < inviteSubscriptionRewardReconciliationBatchSize {
			return 0, 0, cursor, nil
		}
		require.Equal(t, inviteSubscriptionRewardReconciliationBatchSize, limit)
		calls++
		if calls <= inviteSubscriptionRewardReconciliationMaxRounds {
			require.Equal(t, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(calls - 1), ID: calls - 1}, cursor)
			nextCursor := model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(calls), ID: calls}
			return 0, inviteSubscriptionRewardReconciliationBatchSize, nextCursor, nil
		}
		require.Equal(t, model.InviteSubscriptionRewardReconciliationCursor{
			CompleteTime: int64(inviteSubscriptionRewardReconciliationMaxRounds),
			ID:           inviteSubscriptionRewardReconciliationMaxRounds,
		}, cursor)
		return 1, 1, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(calls), ID: calls}, nil
	}

	firstCount, err := RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Zero(t, firstCount)

	secondCount, err := RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Equal(t, 1, secondCount)
	require.Equal(t, inviteSubscriptionRewardReconciliationMaxRounds+1, calls)
}

func TestInviteSubscriptionRewardReconciliationWrapsPersistentCursorAfterEndOfScan(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	calls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		if limit < inviteSubscriptionRewardReconciliationBatchSize {
			return 0, 0, cursor, nil
		}
		calls++
		require.Zero(t, cursor)
		return 0, 1, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 99, ID: 99}, nil
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Zero(t, count)
	require.Equal(t, 1, calls)
	var option model.Option
	require.NoError(t, model.DB.Where("key = ?", "invite_subscription_reward_reconciliation_cursor").First(&option).Error)
	require.True(t, strings.Contains(option.Value, `"complete_time":0`), option.Value)
	require.True(t, strings.Contains(option.Value, `"id":0`), option.Value)
}

func TestInviteSubscriptionRewardReconciliationRetryLaneScansOldFailuresWhileForwardCursorStaysFull(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	retryCalled := false
	forwardCalls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		require.Zero(t, sinceSeconds)
		if limit == inviteSubscriptionRewardReconciliationBatchSize {
			forwardCalls++
			return 0, inviteSubscriptionRewardReconciliationBatchSize, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(forwardCalls), ID: forwardCalls}, nil
		}
		require.Less(t, limit, inviteSubscriptionRewardReconciliationBatchSize)
		require.Zero(t, cursor)
		retryCalled = true
		return 1, 1, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 1, ID: 1}, nil
	}

	count, err := RunInviteSubscriptionRewardReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	require.Equal(t, inviteSubscriptionRewardReconciliationMaxRounds, forwardCalls)
	require.True(t, retryCalled)
}

func TestInviteSubscriptionRewardReconciliationRetryLanePersistsAcrossRunsWhenFailurePrefixExceedsRetryCapacity(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	originalMaster := common.IsMasterNode
	originalReconciler := inviteSubscriptionRewardReconciler
	t.Cleanup(func() {
		common.IsMasterNode = originalMaster
		inviteSubscriptionRewardReconciler = originalReconciler
		inviteSubscriptionRewardReconciliationRunning.Store(false)
	})
	common.IsMasterNode = true

	forwardCalls := 0
	retryCalls := 0
	inviteSubscriptionRewardReconciler = func(sinceSeconds int64, limit int, cursor model.InviteSubscriptionRewardReconciliationCursor) (int, int, model.InviteSubscriptionRewardReconciliationCursor, error) {
		require.Zero(t, sinceSeconds)
		if limit == inviteSubscriptionRewardReconciliationBatchSize {
			forwardCalls++
			return 0, inviteSubscriptionRewardReconciliationBatchSize, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: int64(100 + forwardCalls), ID: 100 + forwardCalls}, nil
		}
		require.Less(t, limit, inviteSubscriptionRewardReconciliationBatchSize)
		retryCalls++
		switch retryCalls {
		case 1:
			require.Zero(t, cursor)
			return 0, limit, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 10, ID: 10}, nil
		case 2:
			require.Equal(t, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 10, ID: 10}, cursor)
			return 1, 1, model.InviteSubscriptionRewardReconciliationCursor{CompleteTime: 11, ID: 11}, nil
		default:
			t.Fatalf("unexpected retry call %d", retryCalls)
			return 0, 0, cursor, nil
		}
	}

	firstCount, err := RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Zero(t, firstCount)

	secondCount, err := RunInviteSubscriptionRewardReconciliationOnce()
	require.NoError(t, err)
	require.Equal(t, 1, secondCount)
	require.Equal(t, 2, retryCalls)
	require.Equal(t, inviteSubscriptionRewardReconciliationMaxRounds*2, forwardCalls)
}

func TestInviteSubscriptionRewardReconciliationRetryCursorCASDoesNotMoveBackward(t *testing.T) {
	setupInviteSubscriptionRewardReconciliationDBTest(t)

	stale, err := loadInviteSubscriptionRewardReconciliationRetryCursor()
	require.NoError(t, err)
	advanced, err := checkpointInviteSubscriptionRewardReconciliationRetryCursor(stale, model.InviteSubscriptionRewardReconciliationCursor{
		CompleteTime: 20,
		ID:           20,
	})
	require.NoError(t, err)

	_, err = checkpointInviteSubscriptionRewardReconciliationRetryCursor(stale, model.InviteSubscriptionRewardReconciliationCursor{
		CompleteTime: 10,
		ID:           10,
	})
	require.ErrorIs(t, err, errInviteSubscriptionRewardReconciliationCursorAdvanced)

	var option model.Option
	require.NoError(t, model.DB.Where("key = ?", inviteSubscriptionRewardReconciliationRetryKey).First(&option).Error)
	parsed, err := parseInviteSubscriptionRewardReconciliationCursor(option.Value)
	require.NoError(t, err)
	require.Equal(t, advanced.CompleteTime, parsed.CompleteTime)
	require.Equal(t, advanced.ID, parsed.ID)
}

func setupInviteSubscriptionRewardReconciliationDBTest(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "invite-subscription-reconciliation.db")+"?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.Option{}, &model.SubscriptionDiscountAccount{}, &model.SubscriptionDiscountEntry{}, &model.SubscriptionOrder{}, &model.InviteSubscriptionReward{}))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
	})
}

func createInviteSubscriptionRewardReconciliationUser(t *testing.T, username string, inviterID int) model.User {
	t.Helper()

	user := model.User{
		Username:           username,
		Password:           "password123",
		Role:               common.RoleCommonUser,
		InviterId:          inviterID,
		AffCode:            username + "-code",
		InviteRewardStatus: model.InviteRewardStatusPending,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	require.NotZero(t, user.Id)
	return user
}

func createInviteSubscriptionRewardReconciliationOrder(t *testing.T, userID int, tradeNo string, completeTime int64) model.SubscriptionOrder {
	t.Helper()

	order := model.SubscriptionOrder{
		UserId:          userID,
		PlanId:          1,
		Money:           5,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      completeTime,
		CompleteTime:    completeTime,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	require.NotZero(t, order.Id)
	return order
}

func grantPollutedInviteSubscriptionRewardLedgerForTest(t *testing.T, inviterID int, inviteeID int) bool {
	t.Helper()

	var changed bool
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		changed, err = model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
			UserID:         inviterID,
			USDMinor:       750,
			EntryType:      model.SubscriptionDiscountEntryTypeGrantInviter,
			SourceType:     "polluted_invite_subscription_reward",
			SourceKey:      fmt.Sprintf("inviter:%d:first-paid-subscription", inviteeID),
			IdempotencyKey: fmt.Sprintf("inviter:%d:first-paid-subscription", inviteeID),
		})
		return err
	}))
	return changed
}
