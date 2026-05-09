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
	"gorm.io/gorm"
)

func setupInvitationRebateTest(t *testing.T) {
	t.Helper()

	oldEnabled := common.InvitationRebateEnabled
	oldRatioBps := common.InvitationRebateRatioBps
	oldMinQuota := common.InvitationRebateMinQuota

	require.NoError(t, model.DB.AutoMigrate(
		&model.InvitationRebateRecord{},
		&model.InvitationRebateConsumption{},
		&model.InvitationRebateAccumulation{},
		&model.InvitationRebateSettlementItem{},
	))
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
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_settlement_items").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_records").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_consumptions").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM invitation_rebate_accumulations").Error)
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

func countInvitationRebateConsumptions(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.InvitationRebateConsumption{}).Count(&count).Error)
	return count
}

func countInvitationRebateSettlementItems(t *testing.T) int64 {
	t.Helper()
	var count int64
	require.NoError(t, model.DB.Model(&model.InvitationRebateSettlementItem{}).Count(&count).Error)
	return count
}

func getInvitationRebateRecordBySource(t *testing.T, sourceKey string) model.InvitationRebateRecord {
	t.Helper()
	var record model.InvitationRebateRecord
	require.NoError(t, model.DB.Where("source_type = ? AND source_key = ?", "sync_relay_request", sourceKey).First(&record).Error)
	return record
}

func getInvitationRebateSettlementItems(t *testing.T, recordId int) []model.InvitationRebateSettlementItem {
	t.Helper()
	var items []model.InvitationRebateSettlementItem
	require.NoError(t, model.DB.Where("rebate_record_id = ?", recordId).Order("id asc").Find(&items).Error)
	return items
}

func getInvitationRebateAccumulation(t *testing.T, inviterId int, inviteeId int) model.InvitationRebateAccumulation {
	t.Helper()
	var state model.InvitationRebateAccumulation
	require.NoError(t, model.DB.Where("inviter_user_id = ? AND invitee_user_id = ?", inviterId, inviteeId).First(&state).Error)
	return state
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
	require.Equal(t, InvitationRebateResultStatusAccumulated, result.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	require.Equal(t, int64(1), countInvitationRebateConsumptions(t))
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 199, state.PendingSourceQuota)
	require.Equal(t, 199, state.TotalSourceQuota)
	require.Equal(t, 0, state.TotalSettledSourceQuota)
	require.Equal(t, 0, state.TotalRebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 5, inviter.AffQuota)
	require.Equal(t, 7, inviter.AffHistoryQuota)
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

func TestTryGrantInvitationRebateCumulativeReachesThreshold(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 5, 7)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	first, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_cumulative_60", 60))
	require.NoError(t, err)
	second, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_cumulative_40", 40))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, first.Status)
	require.Equal(t, InvitationRebateResultStatusGranted, second.Status)
	require.Equal(t, 100, second.SettledQuota)
	require.Equal(t, 10, second.RebateQuota)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	require.Equal(t, int64(2), countInvitationRebateConsumptions(t))
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 0, state.PendingSourceQuota)
	require.Equal(t, 100, state.TotalSourceQuota)
	require.Equal(t, 100, state.TotalSettledSourceQuota)
	require.Equal(t, 10, state.TotalRebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 15, inviter.AffQuota)
	require.Equal(t, 17, inviter.AffHistoryQuota)

	var record model.InvitationRebateRecord
	require.NoError(t, model.DB.Where("source_type = ? AND source_key = ?", "sync_relay_request", "req_cumulative_40").First(&record).Error)
	require.Equal(t, 100, record.SourceQuota)
	require.Equal(t, 10, record.RebateQuota)
	items := getInvitationRebateSettlementItems(t, record.Id)
	require.Len(t, items, 2)
	require.Equal(t, "req_cumulative_60", items[0].SourceKey)
	require.Equal(t, 60, items[0].SettledSourceQuota)
	require.Equal(t, 6, items[0].RebateQuota)
	require.Equal(t, "req_cumulative_40", items[1].SourceKey)
	require.Equal(t, 40, items[1].SettledSourceQuota)
	require.Equal(t, 4, items[1].RebateQuota)
}

func TestTryGrantInvitationRebateCumulativeKeepsRemainderQuota(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_cumulative_250", 250))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusGranted, result.Status)
	require.Equal(t, 200, result.SettledQuota)
	require.Equal(t, 50, result.PendingQuota)
	require.Equal(t, 20, result.RebateQuota)
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 50, state.PendingSourceQuota)
	require.Equal(t, 250, state.TotalSourceQuota)
	require.Equal(t, 200, state.TotalSettledSourceQuota)
	require.Equal(t, 20, state.TotalRebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 20, inviter.AffQuota)
	require.Equal(t, 20, inviter.AffHistoryQuota)
	require.Equal(t, int64(1), countInvitationRebateSettlementItems(t))
	record := getInvitationRebateRecordBySource(t, "req_cumulative_250")
	items := getInvitationRebateSettlementItems(t, record.Id)
	require.Len(t, items, 1)
	require.Equal(t, 200, items[0].SettledSourceQuota)
	require.Equal(t, 20, items[0].RebateQuota)
}

func TestTryGrantInvitationRebateSplitsOneConsumptionAcrossSettlements(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	first, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_split_250", 250))
	require.NoError(t, err)
	second, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_split_50", 50))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusGranted, first.Status)
	require.Equal(t, 200, first.SettledQuota)
	require.Equal(t, InvitationRebateResultStatusGranted, second.Status)
	require.Equal(t, 100, second.SettledQuota)
	require.Equal(t, int64(2), countInvitationRebateRecords(t))
	require.Equal(t, int64(3), countInvitationRebateSettlementItems(t))

	secondRecord := getInvitationRebateRecordBySource(t, "req_split_50")
	items := getInvitationRebateSettlementItems(t, secondRecord.Id)
	require.Len(t, items, 2)
	require.Equal(t, "req_split_250", items[0].SourceKey)
	require.Equal(t, 50, items[0].SettledSourceQuota)
	require.Equal(t, 5, items[0].RebateQuota)
	require.Equal(t, "req_split_50", items[1].SourceKey)
	require.Equal(t, 50, items[1].SettledSourceQuota)
	require.Equal(t, 5, items[1].RebateQuota)
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 0, state.PendingSourceQuota)
	require.Equal(t, 300, state.TotalSettledSourceQuota)
	require.Equal(t, 30, state.TotalRebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 30, inviter.AffQuota)
	require.Equal(t, 30, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateDuplicateAccumulationIsIdempotent(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)
	input := invitationRebateInput("req_accumulated_duplicate", 60)

	first, err := TryGrantInvitationRebate(context.Background(), input)
	require.NoError(t, err)
	second, err := TryGrantInvitationRebate(context.Background(), input)
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, first.Status)
	require.Equal(t, InvitationRebateResultStatusAlreadyAccumulated, second.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	require.Equal(t, int64(1), countInvitationRebateConsumptions(t))
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 60, state.PendingSourceQuota)
	require.Equal(t, 60, state.TotalSourceQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 0, inviter.AffQuota)
	require.Equal(t, 0, inviter.AffHistoryQuota)
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

func TestTryGrantInvitationRebateAccumulatesFractionalRemainder(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(2500, 1)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	for i := 0; i < 3; i++ {
		result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput(fmt.Sprintf("req_fraction_%d", i), 1))
		require.NoError(t, err)
		require.Equal(t, InvitationRebateResultStatusAccumulated, result.Status)
	}
	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_fraction_final", 1))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusGranted, result.Status)
	require.Equal(t, 1, result.RebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 1, inviter.AffQuota)
	require.Equal(t, 1, inviter.AffHistoryQuota)
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, int64(0), state.RebateNumeratorRemainder)
	require.Equal(t, 4, state.TotalSettledSourceQuota)
}

func TestTryGrantInvitationRebateZeroRebateSettlementIsTraceable(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1, 1)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_zero_trace", 1))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, result.Status)
	require.Equal(t, 1, result.SettledQuota)
	require.Equal(t, 0, result.RebateQuota)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	require.Equal(t, int64(1), countInvitationRebateSettlementItems(t))
	record := getInvitationRebateRecordBySource(t, "req_zero_trace")
	require.Equal(t, 1, record.SourceQuota)
	require.Equal(t, 0, record.RebateQuota)
	items := getInvitationRebateSettlementItems(t, record.Id)
	require.Len(t, items, 1)
	require.Equal(t, "req_zero_trace", items[0].SourceKey)
	require.Equal(t, 1, items[0].SettledSourceQuota)
	require.Equal(t, 0, items[0].RebateQuota)
	require.Equal(t, int64(0), items[0].RemainderBefore)
	require.Equal(t, int64(1), items[0].RemainderAfter)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 0, inviter.AffQuota)
	require.Equal(t, 0, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateRatioChangeUsesConsumptionSnapshot(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	first, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_old_ratio", 60))
	require.NoError(t, err)
	common.InvitationRebateRatioBps = 2000
	second, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_new_ratio", 40))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, first.Status)
	require.Equal(t, InvitationRebateResultStatusGranted, second.Status)
	require.Equal(t, 14, second.RebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 14, inviter.AffQuota)
	require.Equal(t, 14, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateThresholdDecreaseSettlesOnNextConsume(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	first, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_threshold_down_60", 60))
	require.NoError(t, err)
	common.InvitationRebateMinQuota = 50
	second, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_threshold_down_1", 1))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, first.Status)
	require.Equal(t, InvitationRebateResultStatusGranted, second.Status)
	require.Equal(t, 50, second.SettledQuota)
	require.Equal(t, 5, second.RebateQuota)
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 11, state.PendingSourceQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 5, inviter.AffQuota)
	require.Equal(t, 5, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateThresholdIncreaseKeepsAccumulation(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	first, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_threshold_up_60", 60))
	require.NoError(t, err)
	common.InvitationRebateMinQuota = 200
	second, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_threshold_up_100", 100))
	require.NoError(t, err)

	require.Equal(t, InvitationRebateResultStatusAccumulated, first.Status)
	require.Equal(t, InvitationRebateResultStatusAccumulated, second.Status)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 160, state.PendingSourceQuota)
	require.Equal(t, 160, state.TotalSourceQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 0, inviter.AffQuota)
	require.Equal(t, 0, inviter.AffHistoryQuota)
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

func TestTryGrantInvitationRebateConcurrentAccumulationSettlesOnce(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)

	const calls = 4
	results := make(chan InvitationRebateResultStatus, calls)
	errs := make(chan error, calls)
	var wg sync.WaitGroup
	for i := 0; i < calls; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput(fmt.Sprintf("req_concurrent_acc_%d", index), 25))
			if err != nil {
				errs <- err
				return
			}
			results <- result.Status
		}(i)
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}
	granted := 0
	accumulated := 0
	for status := range results {
		switch status {
		case InvitationRebateResultStatusGranted:
			granted++
		case InvitationRebateResultStatusAccumulated:
			accumulated++
		default:
			t.Fatalf("unexpected status: %s", status)
		}
	}
	require.Equal(t, 1, granted)
	require.Equal(t, calls-1, accumulated)
	require.Equal(t, int64(1), countInvitationRebateRecords(t))
	require.Equal(t, int64(calls), countInvitationRebateConsumptions(t))
	state := getInvitationRebateAccumulation(t, 1, 2)
	require.Equal(t, 0, state.PendingSourceQuota)
	require.Equal(t, 100, state.TotalSettledSourceQuota)
	require.Equal(t, 10, state.TotalRebateQuota)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 10, inviter.AffQuota)
	require.Equal(t, 10, inviter.AffHistoryQuota)
}

func TestTryGrantInvitationRebateRollsBackWhenInviterUpdateFails(t *testing.T) {
	setupInvitationRebateTest(t)
	enableInvitationRebate(1000, 100)
	seedInvitationRebateUser(t, 1, 0, 0, 0)
	seedInvitationRebateUser(t, 2, 1, 0, 0)
	oldHook := invitationRebateBeforeInviterUpdateHook
	invitationRebateBeforeInviterUpdateHook = func(tx *gorm.DB) error {
		return tx.Delete(&model.User{}, 1).Error
	}
	t.Cleanup(func() {
		invitationRebateBeforeInviterUpdateHook = oldHook
	})

	result, err := TryGrantInvitationRebate(context.Background(), invitationRebateInput("req_rollback", 100))

	require.Error(t, err)
	require.NotNil(t, result)
	require.Equal(t, int64(0), countInvitationRebateRecords(t))
	require.Equal(t, int64(0), countInvitationRebateSettlementItems(t))
	require.Equal(t, int64(0), countInvitationRebateConsumptions(t))
	var accumulationCount int64
	require.NoError(t, model.DB.Model(&model.InvitationRebateAccumulation{}).Count(&accumulationCount).Error)
	require.Equal(t, int64(0), accumulationCount)
	inviter := getInvitationRebateUser(t, 1)
	require.Equal(t, 0, inviter.AffQuota)
	require.Equal(t, 0, inviter.AffHistoryQuota)
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
