package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateCommissionEventListInput struct {
	Scope            AffiliateScope
	AffiliateUserId  int
	RuleSetId        int
	DownstreamUserId int
	SettlementId     int
	Status           string
	Kind             string
	PeriodStart      int64
	PeriodEnd        int64
	StartIdx         int
	PageSize         int
}

type AffiliateSettlementListInput struct {
	Scope           AffiliateScope
	AffiliateUserId int
	RuleSetId       int
	Status          string
	PeriodStart     int64
	PeriodEnd       int64
	StartIdx        int
	PageSize        int
}

func ListAffiliateCommissionEvents(db *gorm.DB, input AffiliateCommissionEventListInput) ([]model.AffiliateCommissionEvent, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}
	tx := db.Model(&model.AffiliateCommissionEvent{})
	var err error
	tx, err = applyAffiliateFinanceScope(tx, input.Scope, input.AffiliateUserId)
	if err != nil {
		return nil, 0, err
	}
	if input.RuleSetId > 0 {
		tx = tx.Where("rule_set_id = ?", input.RuleSetId)
	}
	if input.DownstreamUserId > 0 {
		tx = tx.Where("downstream_user_id = ?", input.DownstreamUserId)
	}
	if input.SettlementId > 0 {
		tx = tx.Where("settlement_id = ?", input.SettlementId)
	}
	if status := normalizeAffiliateEventStatus(input.Status); status != "" {
		tx = tx.Where("status = ?", status)
	}
	if kind := normalizeAffiliateCommissionKind(input.Kind); kind != "" {
		tx = tx.Where("kind = ?", kind)
	}
	if input.PeriodStart != 0 {
		tx = tx.Where("period_start = ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("period_end = ?", input.PeriodEnd)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var events []model.AffiliateCommissionEvent
	if err := tx.
		Order("created_at desc, id desc").
		Offset(normalizeAffiliateFinanceStartIdx(input.StartIdx)).
		Limit(normalizeAffiliateFinancePageSize(input.PageSize)).
		Find(&events).Error; err != nil {
		return nil, 0, err
	}
	return events, total, nil
}

func ListAffiliateSettlements(db *gorm.DB, input AffiliateSettlementListInput) ([]model.AffiliateSettlement, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}
	tx := db.Model(&model.AffiliateSettlement{})
	var err error
	tx, err = applyAffiliateFinanceScope(tx, input.Scope, input.AffiliateUserId)
	if err != nil {
		return nil, 0, err
	}
	if input.RuleSetId > 0 {
		tx = tx.Where("rule_set_id = ?", input.RuleSetId)
	}
	if status := normalizeAffiliateSettlementStatus(input.Status); status != "" {
		tx = tx.Where("status = ?", status)
	}
	if input.PeriodStart != 0 {
		tx = tx.Where("period_start = ?", input.PeriodStart)
	}
	if input.PeriodEnd != 0 {
		tx = tx.Where("period_end = ?", input.PeriodEnd)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var settlements []model.AffiliateSettlement
	if err := tx.
		Order("period_end desc, id desc").
		Offset(normalizeAffiliateFinanceStartIdx(input.StartIdx)).
		Limit(normalizeAffiliateFinancePageSize(input.PageSize)).
		Find(&settlements).Error; err != nil {
		return nil, 0, err
	}
	return settlements, total, nil
}

func applyAffiliateFinanceScope(tx *gorm.DB, scope AffiliateScope, requestedAffiliateUserId int) (*gorm.DB, error) {
	switch scope.Kind {
	case AffiliateScopeGlobal:
		if requestedAffiliateUserId > 0 {
			tx = tx.Where("affiliate_user_id = ?", requestedAffiliateUserId)
		}
		return tx, nil
	case AffiliateScopeAffiliate:
		if scope.UserId <= 0 {
			return nil, errors.New("invalid affiliate scope")
		}
		if requestedAffiliateUserId > 0 && requestedAffiliateUserId != scope.UserId {
			return nil, errors.New("affiliate user outside scope")
		}
		return tx.Where("affiliate_user_id = ?", scope.UserId), nil
	default:
		return nil, errors.New("affiliate scope unavailable")
	}
}

func normalizeAffiliateEventStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "":
		return ""
	case model.AffiliateEventStatusPending:
		return model.AffiliateEventStatusPending
	case model.AffiliateEventStatusReady:
		return model.AffiliateEventStatusReady
	case model.AffiliateEventStatusSettled:
		return model.AffiliateEventStatusSettled
	case model.AffiliateEventStatusVoid:
		return model.AffiliateEventStatusVoid
	default:
		return ""
	}
}

func normalizeAffiliateSettlementStatus(status string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "":
		return ""
	case model.AffiliateSettlementStatusDraft:
		return model.AffiliateSettlementStatusDraft
	case model.AffiliateSettlementStatusFrozen:
		return model.AffiliateSettlementStatusFrozen
	case model.AffiliateSettlementStatusPaid:
		return model.AffiliateSettlementStatusPaid
	case model.AffiliateSettlementStatusVoid:
		return model.AffiliateSettlementStatusVoid
	default:
		return ""
	}
}

func normalizeAffiliateCommissionKind(kind string) string {
	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "":
		return ""
	case AffiliateCommissionEventKindAccrual:
		return AffiliateCommissionEventKindAccrual
	case AffiliateCommissionEventKindClawback:
		return AffiliateCommissionEventKindClawback
	case AffiliateCommissionEventKindManualAdjustment:
		return AffiliateCommissionEventKindManualAdjustment
	default:
		return ""
	}
}

func normalizeAffiliateFinanceStartIdx(startIdx int) int {
	if startIdx < 0 {
		return 0
	}
	return startIdx
}

func normalizeAffiliateFinancePageSize(pageSize int) int {
	if pageSize <= 0 {
		return common.ItemsPerPage
	}
	if pageSize > 100 {
		return 100
	}
	return pageSize
}
