package service

import (
	"context"
	"fmt"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func setupInvitationRebateTest(t *testing.T) {
	t.Helper()

	oldEnabled := common.InvitationRebateEnabled
	oldRatioBps := common.InvitationRebateRatioBps
	oldMinQuota := common.InvitationRebateMinQuota

	require.NoError(t, model.DB.AutoMigrate(&model.InvitationRebateRecord{}))
	cleanupInvitationRebateTables(t)

	t.Cleanup(func() {
		cleanupInvitationRebateTables(t)
		common.InvitationRebateEnabled = oldEnabled
		common.InvitationRebateRatioBps = oldRatioBps
		common.InvitationRebateMinQuota = oldMinQuota
	})
}

func cleanupInvitationRebateTables(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_records").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM users").Error)
}

func seedInvitationRebateUser(t *testing.T, id int, inviterId int, affQuota int, affHistoryQuota int) {
	t.Helper()
	user := &model.User{
		Id:              id,
		Username:        fmt.Sprintf("rebate_user_%d", id),
		Status:          common.UserStatusEnabled,
		AffCode:         fmt.Sprintf("aff_%d", id),
		InviterId:       inviterId,
		AffQuota:        affQuota,
		AffHistoryQuota: affHistoryQuota,
	}
	require.NoError(t, model.DB.Create(user).Error)
}

func getInvitationRebateUser(t *testing.T, id int) model.User {
	t.Helper()
	var user model.User
	require.NoError(t, model.DB.Where("id = ?", id).First(&user).Error)
	return user
}

func countInvitationRebateRecords(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.InvitationRebateRecord{}).Count(&count).Error)
	return count
}

func invitationRebateInput(sourceKey string, sourceQuota int) InvitationRebateInput {
	return InvitationRebateInput{
		InviteeUserId:   2,
		SourceType:      "sync_relay_request",
		SourceKey:       sourceKey,
		SourceRequestId: sourceKey,
		SourceQuota:     sourceQuota,
	}
}

func enableInvitationRebate(ratioBps int, minQuota int) {
	common.InvitationRebateEnabled = true
	common.InvitationRebateRatioBps = ratioBps
	common.InvitationRebateMinQuota = minQuota
}

func TestTryGrantInvitationRebateDisabled(t *testing.T) {
	setupInvitationRebateTest(t)
	common.InvitationRebateEnabled = false
	common.InvitationRebateRatioBps = 1000
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_disabled", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedDisabled, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 5, inviter.AffQuota)
	require.Equal(t, 7, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateZeroRatio(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(0, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_zero_ratio", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedZeroRatio, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
}

func TestTryGrantInvitationRebateEmptySourceKey(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedInvalidSource, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
}

func TestTryGrantInvitationRebateNoInviter(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 2, 0, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_no_inviter", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedNoInviter, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
}

func TestTryGrantInvitationRebateBelowMinQuota(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 200)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_min_quota", 199))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedMinQuota, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
}

func TestTryGrantInvitationRebateGranted(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_granted", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusGranted, result.Status)
	require.Equal(t, 10, result.RebateQuota)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 15, inviter.AffQuota)
	require.Equal(t, 17, inviter.AffHistoryQuota)

	var record model.InvitationRebateRecord
	require.NoError(t, model.DB.Where("source_type = ? AND source_key = ?", "sync_relay_request", "req_granted").First(&record).Error)
	require.Equal(t, 1, record.InviterUserId)
	require.Equal(t, 2, record.InviteeUserId)
	require.Equal(t, 100, record.SourceQuota)
	require.Equal(t, 10, record.RebateQuota)
	require.Equal(t, 1000, record.RebateRatioBps)
}

func TestTryGrantInvitationRebateDuplicateIsIdempotent(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)
	input := invitationRebateInput("req_duplicate", 100)

	first, err := TryGrantInvitationRebate(context.Background(), input)
	require.NoError(t, err)
	second, err := TryGrantInvitationRebate(context.Background(), input)
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusGranted, first.Status)
	require.Equal(t, InvitationRebateResultStatusAlreadyGranted, second.Status)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 15, inviter.AffQuota)
	require.Equal(t, 17, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateRoundsDown(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_round_down", 101))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusGranted, result.Status)
	require.Equal(t, 10, result.RebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 10, inviter.AffQuota)
	require.Equal(t, 10, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateMissingInviter(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 2, 99, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_missing_inviter", 100))

	require.NoError(t, err)
	require.Equal(t, InvitationRebateResultStatusSkippedInviterMissing, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
}

func TestTryGrantInvitationRebateConcurrentDuplicateIsIdempotent(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)
	input := invitationRebateInput("req_concurrent", 100)

	const calls = 8
	results := make(chan InvitationRebateResultStatus, calls)
	errs := make(chan error, calls)
	var wg sync.WaitGroup
	for i := 0; i < calls; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := TryGrantInvitationRebate(context.Background(), input)
			if err != nil {
				errs <- err
				return
			}
			results <- result.Status
		}()
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	granted := 0
	alreadyGranted := 0
	for status := range results {
		switch status {
		case InvitationRebateResultStatusGranted:
			granted++
		case InvitationRebateResultStatusAlreadyGranted:
			alreadyGranted++
		default:
			t.Fatalf("unexpected status: %s", status)
		}
	}
	require.Equal(t, 1, granted)
	require.Equal(t, calls-1, alreadyGranted)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 10, inviter.AffQuota)
	require.Equal(t, 10, inviter.AffHistoryQuota)
}

func newInvitationRebateGinContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	return ctx
}

func TestGrantInvitationRebateAfterSyncConsumeEmptyRequestIdSkips(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	grantInvitationRebateAfterSyncConsume(newInvitationRebateGinContext(), &relaycommon.RelayInfo{
		UserId:    2,
		RequestId: "",
	}, 100)

	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 5, inviter.AffQuota)
	require.Equal(t, 7, inviter.AffHistoryQuota)
}

func TestGrantInvitationRebateAfterSyncConsumeDuplicateRequestIdGrantsOnce(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 0)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)
	ctx := newInvitationRebateGinContext()
	relayInfo := &relaycommon.RelayInfo{
		UserId:    2,
		RequestId: "req_sync_hook",
	}

	grantInvitationRebateAfterSyncConsume(ctx, relayInfo, 100)
	grantInvitationRebateAfterSyncConsume(ctx, relayInfo, 100)

	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 15, inviter.AffQuota)
	require.Equal(t, 17, inviter.AffHistoryQuota)
	var record model.InvitationRebateRecord
	require.NoError(t, model.DB.Where("source_type = ? AND source_key = ?", invitationRebateSourceTypeSyncRelayRequest, "req_sync_hook").First(&record).Error)
	require.Equal(t, 100, record.SourceQuota)
	require.Equal(t, 10, record.RebateQuota)
}

func TestGrantInvitationRebateAfterSyncConsumeErrorIsIsolated(t *testing.T) {
	oldDB := model.DB
	oldEnabled := common.InvitationRebateEnabled
	oldRatioBps := common.InvitationRebateRatioBps
	oldMinQuota := common.InvitationRebateMinQuota
	t.Cleanup(func() {
		model.DB = oldDB
		common.InvitationRebateEnabled = oldEnabled
		common.InvitationRebateRatioBps = oldRatioBps
		common.InvitationRebateMinQuota = oldMinQuota
	})
	enableInvitationRebate(1000, 0)
	model.DB = nil

	require.NotPanics(t, func() {
		grantInvitationRebateAfterSyncConsume(newInvitationRebateGinContext(), &relaycommon.RelayInfo{
			UserId:    2,
			RequestId: "req_rebate_error_isolated",
		}, 100)
	})
}
