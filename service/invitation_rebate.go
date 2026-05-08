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

	minQuota := common.InvitationRebateMinQuota
	if minQuota < 0 {
		minQuota = 0
	}
	if input.SourceQuota < minQuota {
		result.Status = InvitationRebateResultStatusSkippedMinQuota
		return result, nil
	}

	rebateQuota := calculateInvitationRebateQuota(input.SourceQuota, ratioBps)
	result.RebateQuota = rebateQuota
	if rebateQuota <= 0 {
		result.Status = InvitationRebateResultStatusSkippedZeroRebate
		return result, nil
	}

	if model.DB == nil {
		return result, errors.New("database is not initialized")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	err := model.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		txResult, err := grantInvitationRebateTx(tx, input, rebateQuota, ratioBps)
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

func grantInvitationRebateTx(tx *gorm.DB, input InvitationRebateInput, rebateQuota int, ratioBps int) (*InvitationRebateResult, error) {
	result := &InvitationRebateResult{
		InviteeUserId:  input.InviteeUserId,
		SourceQuota:    input.SourceQuota,
		RebateQuota:    rebateQuota,
		RebateRatioBps: ratioBps,
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

	record := &model.InvitationRebateRecord{
		InviterUserId:   inviterId,
		InviteeUserId:   input.InviteeUserId,
		SourceType:      input.SourceType,
		SourceKey:       input.SourceKey,
		SourceRequestId: input.SourceRequestId,
		SourceQuota:     input.SourceQuota,
		RebateQuota:     rebateQuota,
		RebateRatioBps:  ratioBps,
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
		return invitationRebateAlreadyGrantedTx(tx, input, result)
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

	result.Status = InvitationRebateResultStatusGranted
	result.RecordId = record.Id
	return result, nil
}

func invitationRebateAlreadyGrantedTx(tx *gorm.DB, input InvitationRebateInput, result *InvitationRebateResult) (*InvitationRebateResult, error) {
	var existing model.InvitationRebateRecord
	err := tx.Where("source_type = ? AND source_key = ?", input.SourceType, input.SourceKey).First(&existing).Error
	if err != nil {
		return result, err
	}
	result.Status = InvitationRebateResultStatusAlreadyGranted
	result.RecordId = existing.Id
	result.InviterUserId = existing.InviterUserId
	result.InviteeUserId = existing.InviteeUserId
	result.SourceQuota = existing.SourceQuota
	result.RebateQuota = existing.RebateQuota
	result.RebateRatioBps = existing.RebateRatioBps
	return result, nil
}
