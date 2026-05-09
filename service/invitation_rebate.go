package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type InvitationRebateResultStatus string

const (
	InvitationRebateResultStatusGranted               InvitationRebateResultStatus = "granted"
	InvitationRebateResultStatusAlreadyGranted        InvitationRebateResultStatus = "already_granted"
	InvitationRebateResultStatusSkippedDisabled       InvitationRebateResultStatus = "skipped_disabled"
	InvitationRebateResultStatusSkippedZeroRatio      InvitationRebateResultStatus = "skipped_zero_ratio"
	InvitationRebateResultStatusSkippedInvalidSource  InvitationRebateResultStatus = "skipped_invalid_source"
	InvitationRebateResultStatusSkippedZeroQuota      InvitationRebateResultStatus = "skipped_zero_quota"
	InvitationRebateResultStatusSkippedMinQuota       InvitationRebateResultStatus = "skipped_min_quota"
	InvitationRebateResultStatusSkippedInviteeMissing InvitationRebateResultStatus = "skipped_invitee_missing"
	InvitationRebateResultStatusSkippedNoInviter      InvitationRebateResultStatus = "skipped_no_inviter"
	InvitationRebateResultStatusSkippedInviterMissing InvitationRebateResultStatus = "skipped_inviter_missing"
	InvitationRebateResultStatusSkippedSelfInviter    InvitationRebateResultStatus = "skipped_self_inviter"
	InvitationRebateResultStatusSkippedZeroRebate     InvitationRebateResultStatus = "skipped_zero_rebate"
	InvitationRebateResultStatusAccumulated           InvitationRebateResultStatus = "accumulated"
	InvitationRebateResultStatusAlreadyAccumulated    InvitationRebateResultStatus = "already_accumulated"
)

type InvitationRebateInput struct {
	InviteeUserId   int
	SourceType      string
	SourceKey       string
	SourceRequestId string
	SourceQuota     int
}

type InvitationRebateResult struct {
	Status         InvitationRebateResultStatus
	RecordId       int
	InviterUserId  int
	InviteeUserId  int
	SourceQuota    int
	SettledQuota   int
	PendingQuota   int
	RebateQuota    int
	RebateRatioBps int
}

func TryGrantInvitationRebate(ctx context.Context, input InvitationRebateInput) (*InvitationRebateResult, error) {
	result := newInvitationRebateResult(input)
	if !common.InvitationRebateEnabled {
		result.Status = InvitationRebateResultStatusSkippedDisabled
		return result, nil
	}

	ratioBps := normalizeInvitationRebateRatioBps(common.InvitationRebateRatioBps)
	result.RebateRatioBps = ratioBps
	if ratioBps == 0 {
		result.Status = InvitationRebateResultStatusSkippedZeroRatio
		return result, nil
	}

	if input.SourceType == "" || input.SourceKey == "" {
		result.Status = InvitationRebateResultStatusSkippedInvalidSource
		return result, nil
	}

	if input.SourceQuota <= 0 {
		result.Status = InvitationRebateResultStatusSkippedZeroQuota
		return result, nil
	}

	if model.DB == nil {
		return result, errors.New("database is not initialized")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	err := model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txResult, err := grantInvitationRebateTx(tx, input, ratioBps)
		if txResult != nil {
			*result = *txResult
		}
		return err
	})
	if err != nil {
		return result, err
	}
	return result, nil
}

func newInvitationRebateResult(input InvitationRebateInput) *InvitationRebateResult {
	return &InvitationRebateResult{
		InviteeUserId: input.InviteeUserId,
		SourceQuota:   input.SourceQuota,
	}
}

func normalizeInvitationRebateRatioBps(ratioBps int) int {
	if ratioBps < 0 {
		return 0
	}
	if ratioBps > 10000 {
		return 10000
	}
	return ratioBps
}

func calculateInvitationRebateQuota(sourceQuota int, ratioBps int) int {
	return int(int64(sourceQuota) * int64(ratioBps) / 10000)
}

func grantInvitationRebateTx(tx *gorm.DB, input InvitationRebateInput, ratioBps int) (*InvitationRebateResult, error) {
	result := &InvitationRebateResult{
		InviteeUserId:  input.InviteeUserId,
		SourceQuota:    input.SourceQuota,
		RebateRatioBps: ratioBps,
	}

	if existing, err := findInvitationRebateRecordBySourceTx(tx, input.SourceType, input.SourceKey); err == nil {
		fillInvitationRebateAlreadyGrantedResult(result, existing)
		return result, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}

	var invitee model.User
	if err := tx.Select("id", "inviter_id").Where("id = ?", input.InviteeUserId).First(&invitee).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result.Status = InvitationRebateResultStatusSkippedInviteeMissing
			return result, nil
		}
		return result, err
	}

	inviterId := invitee.InviterId
	result.InviterUserId = inviterId
	if inviterId == 0 {
		result.Status = InvitationRebateResultStatusSkippedNoInviter
		return result, nil
	}
	if inviterId == input.InviteeUserId {
		result.Status = InvitationRebateResultStatusSkippedSelfInviter
		return result, nil
	}

	var inviter model.User
	if err := tx.Select("id").Where("id = ?", inviterId).First(&inviter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result.Status = InvitationRebateResultStatusSkippedInviterMissing
			return result, nil
		}
		return result, err
	}

	consumption := &model.InvitationRebateConsumption{
		InviterUserId:   inviterId,
		InviteeUserId:   input.InviteeUserId,
		SourceType:      input.SourceType,
		SourceKey:       input.SourceKey,
		SourceRequestId: input.SourceRequestId,
		SourceQuota:     input.SourceQuota,
		RebateRatioBps:  ratioBps,
		Status:          model.InvitationRebateConsumptionStatusPending,
	}
	createConsumption := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "source_type"},
			{Name: "source_key"},
		},
		DoNothing: true,
	}).Create(consumption)
	if createConsumption.Error != nil {
		return result, createConsumption.Error
	}
	if createConsumption.RowsAffected == 0 {
		return invitationRebateAlreadyProcessedTx(tx, input, result)
	}

	state, err := getInvitationRebateAccumulationForUpdateTx(tx, inviterId, input.InviteeUserId)
	if err != nil {
		return result, err
	}

	pendingAfterAdd, err := checkedInvitationRebateInt64ToInt(
		int64(state.PendingSourceQuota)+int64(input.SourceQuota),
		"invitation rebate pending quota",
	)
	if err != nil {
		return result, err
	}
	totalSourceAfterAdd, err := checkedInvitationRebateInt64ToInt(
		int64(state.TotalSourceQuota)+int64(input.SourceQuota),
		"invitation rebate total source quota",
	)
	if err != nil {
		return result, err
	}

	minQuota := common.InvitationRebateMinQuota
	if minQuota < 0 {
		minQuota = 0
	}
	settleQuota := calculateInvitationRebateSettleQuota(pendingAfterAdd, minQuota)
	result.PendingQuota = pendingAfterAdd - settleQuota
	if settleQuota <= 0 {
		state.PendingSourceQuota = pendingAfterAdd
		state.TotalSourceQuota = totalSourceAfterAdd
		if err := saveInvitationRebateAccumulationTx(tx, state); err != nil {
			return result, err
		}
		result.Status = InvitationRebateResultStatusAccumulated
		return result, nil
	}

	rebateQuota, remainder, err := settleInvitationRebateConsumptionsTx(tx, state, settleQuota)
	if err != nil {
		return result, err
	}
	result.SettledQuota = settleQuota
	result.RebateQuota = rebateQuota

	totalSettledAfter, err := checkedInvitationRebateInt64ToInt(
		int64(state.TotalSettledSourceQuota)+int64(settleQuota),
		"invitation rebate total settled quota",
	)
	if err != nil {
		return result, err
	}
	totalRebateAfter, err := checkedInvitationRebateInt64ToInt(
		int64(state.TotalRebateQuota)+int64(rebateQuota),
		"invitation rebate total rebate quota",
	)
	if err != nil {
		return result, err
	}
	state.PendingSourceQuota = pendingAfterAdd - settleQuota
	state.TotalSourceQuota = totalSourceAfterAdd
	state.TotalSettledSourceQuota = totalSettledAfter
	state.TotalRebateQuota = totalRebateAfter
	state.RebateNumeratorRemainder = remainder

	if rebateQuota <= 0 {
		if err := saveInvitationRebateAccumulationTx(tx, state); err != nil {
			return result, err
		}
		result.Status = InvitationRebateResultStatusAccumulated
		return result, nil
	}

	effectiveRatioBps, err := calculateEffectiveInvitationRebateRatioBps(settleQuota, rebateQuota)
	if err != nil {
		return result, err
	}

	record := &model.InvitationRebateRecord{
		InviterUserId:   inviterId,
		InviteeUserId:   input.InviteeUserId,
		SourceType:      input.SourceType,
		SourceKey:       input.SourceKey,
		SourceRequestId: input.SourceRequestId,
		SourceQuota:     settleQuota,
		RebateQuota:     rebateQuota,
		RebateRatioBps:  effectiveRatioBps,
		Status:          model.InvitationRebateStatusSuccess,
	}

	createResult := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "source_type"},
			{Name: "source_key"},
		},
		DoNothing: true,
	}).Create(record)
	if createResult.Error != nil {
		return result, createResult.Error
	}
	if createResult.RowsAffected == 0 {
		return result, fmt.Errorf("invitation rebate record already exists for source %s/%s", input.SourceType, input.SourceKey)
	}

	updateResult := tx.Model(&model.User{}).Where("id = ?", inviterId).Updates(map[string]interface{}{
		"aff_quota":   gorm.Expr("aff_quota + ?", rebateQuota),
		"aff_history": gorm.Expr("aff_history + ?", rebateQuota),
	})
	if updateResult.Error != nil {
		return result, updateResult.Error
	}
	if updateResult.RowsAffected == 0 {
		return result, fmt.Errorf("invitation rebate inviter %d was not updated", inviterId)
	}
	if err := saveInvitationRebateAccumulationTx(tx, state); err != nil {
		return result, err
	}

	result.Status = InvitationRebateResultStatusGranted
	result.RecordId = record.Id
	result.RebateRatioBps = effectiveRatioBps
	result.PendingQuota = state.PendingSourceQuota
	return result, nil
}

func invitationRebateAlreadyGrantedTx(tx *gorm.DB, input InvitationRebateInput, result *InvitationRebateResult) (*InvitationRebateResult, error) {
	existing, err := findInvitationRebateRecordBySourceTx(tx, input.SourceType, input.SourceKey)
	if err != nil {
		return result, err
	}
	fillInvitationRebateAlreadyGrantedResult(result, existing)
	return result, nil
}

func findInvitationRebateRecordBySourceTx(tx *gorm.DB, sourceType string, sourceKey string) (*model.InvitationRebateRecord, error) {
	var existing model.InvitationRebateRecord
	result := tx.Where("source_type = ? AND source_key = ?", sourceType, sourceKey).
		Limit(1).
		Find(&existing)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &existing, nil
}

func fillInvitationRebateAlreadyGrantedResult(result *InvitationRebateResult, existing *model.InvitationRebateRecord) {
	result.Status = InvitationRebateResultStatusAlreadyGranted
	result.RecordId = existing.Id
	result.InviterUserId = existing.InviterUserId
	result.InviteeUserId = existing.InviteeUserId
	result.SourceQuota = existing.SourceQuota
	result.SettledQuota = existing.SourceQuota
	result.RebateQuota = existing.RebateQuota
	result.RebateRatioBps = existing.RebateRatioBps
}

func invitationRebateAlreadyProcessedTx(tx *gorm.DB, input InvitationRebateInput, result *InvitationRebateResult) (*InvitationRebateResult, error) {
	if existing, err := findInvitationRebateRecordBySourceTx(tx, input.SourceType, input.SourceKey); err == nil {
		fillInvitationRebateAlreadyGrantedResult(result, existing)
		return result, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}

	var consumption model.InvitationRebateConsumption
	err := tx.Where("source_type = ? AND source_key = ?", input.SourceType, input.SourceKey).First(&consumption).Error
	if err != nil {
		return result, err
	}
	result.Status = InvitationRebateResultStatusAlreadyAccumulated
	result.InviterUserId = consumption.InviterUserId
	result.InviteeUserId = consumption.InviteeUserId
	result.SourceQuota = consumption.SourceQuota
	result.SettledQuota = consumption.SettledSourceQuota
	result.RebateRatioBps = consumption.RebateRatioBps
	return result, nil
}

func getInvitationRebateAccumulationForUpdateTx(tx *gorm.DB, inviterId int, inviteeUserId int) (*model.InvitationRebateAccumulation, error) {
	seed := &model.InvitationRebateAccumulation{
		InviterUserId: inviterId,
		InviteeUserId: inviteeUserId,
	}
	createResult := tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "inviter_user_id"},
			{Name: "invitee_user_id"},
		},
		DoNothing: true,
	}).Create(seed)
	if createResult.Error != nil {
		return nil, createResult.Error
	}

	var state model.InvitationRebateAccumulation
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("inviter_user_id = ? AND invitee_user_id = ?", inviterId, inviteeUserId).
		First(&state).Error
	if err != nil {
		return nil, err
	}
	return &state, nil
}

func saveInvitationRebateAccumulationTx(tx *gorm.DB, state *model.InvitationRebateAccumulation) error {
	return tx.Model(&model.InvitationRebateAccumulation{}).
		Where("id = ?", state.Id).
		Updates(map[string]interface{}{
			"pending_source_quota":       state.PendingSourceQuota,
			"total_source_quota":         state.TotalSourceQuota,
			"total_settled_source_quota": state.TotalSettledSourceQuota,
			"total_rebate_quota":         state.TotalRebateQuota,
			"rebate_numerator_remainder": state.RebateNumeratorRemainder,
		}).Error
}

func calculateInvitationRebateSettleQuota(pendingQuota int, minQuota int) int {
	if pendingQuota <= 0 {
		return 0
	}
	if minQuota <= 0 {
		return pendingQuota
	}
	return pendingQuota / minQuota * minQuota
}

func settleInvitationRebateConsumptionsTx(tx *gorm.DB, state *model.InvitationRebateAccumulation, settleQuota int) (int, int64, error) {
	var consumptions []*model.InvitationRebateConsumption
	err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("inviter_user_id = ? AND invitee_user_id = ? AND settled_source_quota < source_quota", state.InviterUserId, state.InviteeUserId).
		Order("created_at asc, id asc").
		Find(&consumptions).Error
	if err != nil {
		return 0, state.RebateNumeratorRemainder, err
	}

	remaining := settleQuota
	rebateTotal := int64(0)
	remainder := state.RebateNumeratorRemainder
	for _, consumption := range consumptions {
		if remaining <= 0 {
			break
		}
		available := consumption.SourceQuota - consumption.SettledSourceQuota
		if available <= 0 {
			continue
		}
		used := available
		if used > remaining {
			used = remaining
		}
		numerator := int64(used)*int64(consumption.RebateRatioBps) + remainder
		rebateTotal += numerator / 10000
		remainder = numerator % 10000
		consumption.SettledSourceQuota += used
		remaining -= used

		status := model.InvitationRebateConsumptionStatusPartiallySettled
		if consumption.SettledSourceQuota >= consumption.SourceQuota {
			status = model.InvitationRebateConsumptionStatusSettled
		}
		if err := tx.Model(&model.InvitationRebateConsumption{}).
			Where("id = ?", consumption.Id).
			Updates(map[string]interface{}{
				"settled_source_quota": consumption.SettledSourceQuota,
				"status":               status,
			}).Error; err != nil {
			return 0, remainder, err
		}
	}
	if remaining > 0 {
		return 0, remainder, fmt.Errorf("invitation rebate accumulation missing %d source quota to settle", remaining)
	}

	rebateQuota, err := checkedInvitationRebateInt64ToInt(rebateTotal, "invitation rebate quota")
	if err != nil {
		return 0, remainder, err
	}
	return rebateQuota, remainder, nil
}

func calculateEffectiveInvitationRebateRatioBps(settleQuota int, rebateQuota int) (int, error) {
	if settleQuota <= 0 || rebateQuota <= 0 {
		return 0, nil
	}
	return checkedInvitationRebateInt64ToInt(int64(rebateQuota)*10000/int64(settleQuota), "invitation rebate effective ratio")
}

func checkedInvitationRebateInt64ToInt(value int64, name string) (int, error) {
	maxInt := int64(int(^uint(0) >> 1))
	if value > maxInt {
		return 0, fmt.Errorf("%s overflows int: %d", name, value)
	}
	if value < -maxInt-1 {
		return 0, fmt.Errorf("%s underflows int: %d", name, value)
	}
	return int(value), nil
}
