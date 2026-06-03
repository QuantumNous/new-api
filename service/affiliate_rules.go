package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	AffiliateConfigAuditActionCreateRuleSet   = "create_rule_set"
	AffiliateConfigAuditActionUpdateRuleSet   = "update_rule_set"
	AffiliateConfigAuditActionPublishRuleSet  = "publish_rule_set"
	AffiliateConfigAuditActionArchiveRuleSet  = "archive_rule_set"
	AffiliateConfigAuditActionRollbackRuleSet = "rollback_rule_set"

	affiliateBpsBase                  = 10000
	affiliateLevelOneCommissionCapBps = 3000
	affiliateRiskSelfBrushStrategy    = "exclude"
	affiliateRiskBulkAbuseStrategy    = "manual_review"
	affiliateRiskAction               = "manual_review"
)

type AffiliateRuleSetDraftInput struct {
	Id               int                            `json:"id"`
	Version          string                         `json:"version"`
	Name             string                         `json:"name"`
	EffectiveStart   int64                          `json:"effective_start"`
	EffectiveEnd     int64                          `json:"effective_end"`
	ActorUserId      int                            `json:"actor_user_id"`
	Reason           string                         `json:"reason"`
	CommissionRules  []AffiliateCommissionRuleInput `json:"commission_rules"`
	CommissionTiers  []AffiliateCommissionTierInput `json:"commission_tiers"`
	KPITiers         []AffiliateKPITierInput        `json:"kpi_tiers"`
	HeadFeeRules     []AffiliateHeadFeeRuleInput    `json:"head_fee_rules"`
	RiskRules        []AffiliateRiskRuleInput       `json:"risk_rules"`
	SettlementConfig AffiliateSettlementRuleConfig  `json:"settlement_config"`
}

type AffiliateCommissionRuleInput struct {
	AffiliateLevel           int    `json:"affiliate_level"`
	Name                     string `json:"name"`
	Status                   string `json:"status"`
	DefaultRateBps           int    `json:"default_rate_bps"`
	DefaultCapRateBps        int    `json:"default_cap_rate_bps"`
	MinSettlementAmountCents int64  `json:"min_settlement_amount_cents"`
	AllowManualApprovalRate  bool   `json:"allow_manual_approval_rate"`
	Metadata                 string `json:"metadata"`
}

type AffiliateCommissionTierInput struct {
	AffiliateLevel         int   `json:"affiliate_level"`
	MinNetPaidAmountCents  int64 `json:"min_net_paid_amount_cents"`
	MaxNetPaidAmountCents  int64 `json:"max_net_paid_amount_cents"`
	BaseRateBps            int   `json:"base_rate_bps"`
	CapRateBps             int   `json:"cap_rate_bps"`
	RequiresManualApproval bool  `json:"requires_manual_approval"`
	SortOrder              int   `json:"sort_order"`
}

type AffiliateKPITierInput struct {
	AffiliateLevel           int    `json:"affiliate_level"`
	Code                     string `json:"code"`
	Name                     string `json:"name"`
	MinEffectiveNewUsers     int    `json:"min_effective_new_users"`
	MinNetPaidAmountCents    int64  `json:"min_net_paid_amount_cents"`
	CoefficientBps           int    `json:"coefficient_bps"`
	MaxGiftOnlyRatioBps      int    `json:"max_gift_only_ratio_bps"`
	MaxAbnormalRatioBps      int    `json:"max_abnormal_ratio_bps"`
	MinSecondPaymentRatioBps int    `json:"min_second_payment_ratio_bps"`
	SortOrder                int    `json:"sort_order"`
}

type AffiliateHeadFeeRuleInput struct {
	AffiliateLevel        int    `json:"affiliate_level"`
	KPITierCode           string `json:"kpi_tier_code"`
	Status                string `json:"status"`
	AmountCents           int64  `json:"amount_cents"`
	FirstRechargeMinCents int64  `json:"first_recharge_min_cents"`
	PeriodNetPaidMinCents int64  `json:"period_net_paid_min_cents"`
	QualificationDays     int    `json:"qualification_days"`
	UnlockDelayDays       int    `json:"unlock_delay_days"`
}

type AffiliateRiskRuleInput struct {
	AffiliateLevel           int    `json:"affiliate_level"`
	Code                     string `json:"code"`
	MaxGiftOnlyRatioBps      int    `json:"max_gift_only_ratio_bps"`
	MaxAbnormalRatioBps      int    `json:"max_abnormal_ratio_bps"`
	MaxRefundRatioBps        int    `json:"max_refund_ratio_bps"`
	MinSecondPaymentRatioBps int    `json:"min_second_payment_ratio_bps"`
	SelfBrushStrategy        string `json:"self_brush_strategy"`
	BulkAbuseStrategy        string `json:"bulk_abuse_strategy"`
	Action                   string `json:"action"`
	Metadata                 string `json:"metadata"`
}

type AffiliateSettlementRuleConfig struct {
	Cycle                    string `json:"cycle"`
	FreezeDays               int    `json:"freeze_days"`
	MinSettlementAmountCents int64  `json:"min_settlement_amount_cents"`
	ManualReviewEnabled      bool   `json:"manual_review_enabled"`
	AutoSettlementEnabled    bool   `json:"auto_settlement_enabled"`
	ReviewNote               string `json:"review_note"`
}

type AffiliateRuleSetStatusInput struct {
	ActorUserId int
	Reason      string
}

type AffiliateRuleSetRollbackInput struct {
	Version     string `json:"version"`
	Name        string `json:"name"`
	ActorUserId int    `json:"actor_user_id"`
	Reason      string `json:"reason"`
}

type AffiliateRuleSetListInput struct {
	Status   string
	StartIdx int
	PageSize int
}

func SaveAffiliateRuleSetDraft(db *gorm.DB, input AffiliateRuleSetDraftInput) (*model.AffiliateRuleSet, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	input = normalizeAffiliateRuleSetDraftInput(input)
	if err := validateAffiliateRuleSetDraftInput(input); err != nil {
		return nil, err
	}

	var saved model.AffiliateRuleSet
	err := db.Transaction(func(tx *gorm.DB) error {
		var ruleSet model.AffiliateRuleSet
		var beforeSnapshot string
		action := AffiliateConfigAuditActionCreateRuleSet

		if input.Id > 0 {
			if err := tx.Where("id = ?", input.Id).First(&ruleSet).Error; err != nil {
				return err
			}
			if ruleSet.Status != model.AffiliateRuleSetStatusDraft {
				return errors.New("only draft affiliate rule set can be edited")
			}
			beforeSnapshot = ruleSet.ConfigSnapshot
			action = AffiliateConfigAuditActionUpdateRuleSet
		} else {
			err := tx.Where("version = ?", input.Version).First(&ruleSet).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil {
				if ruleSet.Status != model.AffiliateRuleSetStatusDraft {
					return errors.New("affiliate rule set version already exists")
				}
				beforeSnapshot = ruleSet.ConfigSnapshot
				action = AffiliateConfigAuditActionUpdateRuleSet
			}
		}

		snapshot := buildAffiliateRuleSetConfigSnapshot(input)
		ruleSet.Version = input.Version
		ruleSet.Name = input.Name
		ruleSet.Status = model.AffiliateRuleSetStatusDraft
		ruleSet.EffectiveStart = input.EffectiveStart
		ruleSet.EffectiveEnd = input.EffectiveEnd
		ruleSet.UpdatedByUserId = input.ActorUserId
		ruleSet.ConfigSnapshot = snapshot
		if ruleSet.Id == 0 {
			ruleSet.CreatedByUserId = input.ActorUserId
			if err := tx.Create(&ruleSet).Error; err != nil {
				return err
			}
		} else if err := tx.Save(&ruleSet).Error; err != nil {
			return err
		}

		if err := replaceAffiliateRuleSetChildren(tx, ruleSet.Id, input); err != nil {
			return err
		}
		if err := RecordAffiliateConfigAuditLog(tx, AffiliateConfigAuditInput{
			ActorUserId:    input.ActorUserId,
			RuleSetId:      ruleSet.Id,
			Action:         action,
			BeforeSnapshot: beforeSnapshot,
			AfterSnapshot:  snapshot,
			Reason:         input.Reason,
		}); err != nil {
			return err
		}
		saved = ruleSet
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func PublishAffiliateRuleSet(db *gorm.DB, ruleSetId int, input AffiliateRuleSetStatusInput) (*model.AffiliateRuleSet, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if ruleSetId <= 0 {
		return nil, errors.New("invalid affiliate rule set id")
	}

	var saved model.AffiliateRuleSet
	err := db.Transaction(func(tx *gorm.DB) error {
		var ruleSet model.AffiliateRuleSet
		if err := tx.Where("id = ?", ruleSetId).First(&ruleSet).Error; err != nil {
			return err
		}
		if ruleSet.Status != model.AffiliateRuleSetStatusDraft {
			return errors.New("only draft affiliate rule set can be published")
		}
		if err := validateAffiliateRuleSetPersistedConfig(tx, ruleSet); err != nil {
			return err
		}

		var publishedRows []model.AffiliateRuleSet
		if err := tx.
			Where("status = ? AND id <> ?", model.AffiliateRuleSetStatusPublished, ruleSet.Id).
			Find(&publishedRows).Error; err != nil {
			return err
		}
		now := common.GetTimestamp()
		for _, published := range publishedRows {
			before := snapshotAffiliateRuleSetStatus(published)
			published.Status = model.AffiliateRuleSetStatusArchived
			published.UpdatedByUserId = input.ActorUserId
			if err := tx.Save(&published).Error; err != nil {
				return err
			}
			if err := RecordAffiliateConfigAuditLog(tx, AffiliateConfigAuditInput{
				ActorUserId:    input.ActorUserId,
				RuleSetId:      published.Id,
				Action:         AffiliateConfigAuditActionArchiveRuleSet,
				BeforeSnapshot: before,
				AfterSnapshot:  snapshotAffiliateRuleSetStatus(published),
				Reason:         input.Reason,
			}); err != nil {
				return err
			}
		}

		before := snapshotAffiliateRuleSetStatus(ruleSet)
		ruleSet.Status = model.AffiliateRuleSetStatusPublished
		ruleSet.PublishedAt = now
		ruleSet.UpdatedByUserId = input.ActorUserId
		if err := tx.Save(&ruleSet).Error; err != nil {
			return err
		}
		if err := RecordAffiliateConfigAuditLog(tx, AffiliateConfigAuditInput{
			ActorUserId:    input.ActorUserId,
			RuleSetId:      ruleSet.Id,
			Action:         AffiliateConfigAuditActionPublishRuleSet,
			BeforeSnapshot: before,
			AfterSnapshot:  snapshotAffiliateRuleSetStatus(ruleSet),
			Reason:         input.Reason,
		}); err != nil {
			return err
		}
		saved = ruleSet
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func ArchiveAffiliateRuleSet(db *gorm.DB, ruleSetId int, input AffiliateRuleSetStatusInput) (*model.AffiliateRuleSet, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if ruleSetId <= 0 {
		return nil, errors.New("invalid affiliate rule set id")
	}

	var saved model.AffiliateRuleSet
	err := db.Transaction(func(tx *gorm.DB) error {
		var ruleSet model.AffiliateRuleSet
		if err := tx.Where("id = ?", ruleSetId).First(&ruleSet).Error; err != nil {
			return err
		}
		before := snapshotAffiliateRuleSetStatus(ruleSet)
		ruleSet.Status = model.AffiliateRuleSetStatusArchived
		ruleSet.UpdatedByUserId = input.ActorUserId
		if err := tx.Save(&ruleSet).Error; err != nil {
			return err
		}
		if err := RecordAffiliateConfigAuditLog(tx, AffiliateConfigAuditInput{
			ActorUserId:    input.ActorUserId,
			RuleSetId:      ruleSet.Id,
			Action:         AffiliateConfigAuditActionArchiveRuleSet,
			BeforeSnapshot: before,
			AfterSnapshot:  snapshotAffiliateRuleSetStatus(ruleSet),
			Reason:         input.Reason,
		}); err != nil {
			return err
		}
		saved = ruleSet
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func RollbackAffiliateRuleSetToDraft(db *gorm.DB, ruleSetId int, input AffiliateRuleSetRollbackInput) (*model.AffiliateRuleSet, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if ruleSetId <= 0 {
		return nil, errors.New("invalid affiliate rule set id")
	}
	input = normalizeAffiliateRuleSetRollbackInput(input)
	if input.Version == "" {
		return nil, errors.New("affiliate rule set version is required")
	}
	if input.Name == "" {
		return nil, errors.New("affiliate rule set name is required")
	}

	var saved model.AffiliateRuleSet
	err := db.Transaction(func(tx *gorm.DB) error {
		var source model.AffiliateRuleSet
		if err := tx.Where("id = ?", ruleSetId).First(&source).Error; err != nil {
			return err
		}
		if source.Status != model.AffiliateRuleSetStatusPublished && source.Status != model.AffiliateRuleSetStatusArchived {
			return errors.New("only published or archived affiliate rule set can be rolled back")
		}

		var existing model.AffiliateRuleSet
		err := tx.Where("version = ?", input.Version).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err == nil {
			return errors.New("affiliate rule set version already exists")
		}

		copiedInput, err := buildAffiliateRuleSetDraftInputFromPersistedConfig(tx, source)
		if err != nil {
			return err
		}
		copiedInput.Id = 0
		copiedInput.Version = input.Version
		copiedInput.Name = input.Name
		copiedInput.ActorUserId = input.ActorUserId
		copiedInput.Reason = input.Reason
		if err := validateAffiliateRuleSetDraftInput(copiedInput); err != nil {
			return err
		}

		snapshot := buildAffiliateRuleSetConfigSnapshot(copiedInput)
		draft := model.AffiliateRuleSet{
			Version:         copiedInput.Version,
			Name:            copiedInput.Name,
			Status:          model.AffiliateRuleSetStatusDraft,
			EffectiveStart:  copiedInput.EffectiveStart,
			EffectiveEnd:    copiedInput.EffectiveEnd,
			CreatedByUserId: copiedInput.ActorUserId,
			UpdatedByUserId: copiedInput.ActorUserId,
			ConfigSnapshot:  snapshot,
		}
		if err := tx.Create(&draft).Error; err != nil {
			return err
		}
		if err := replaceAffiliateRuleSetChildren(tx, draft.Id, copiedInput); err != nil {
			return err
		}
		if err := validateAffiliateRuleSetPersistedConfig(tx, draft); err != nil {
			return err
		}
		if err := RecordAffiliateConfigAuditLog(tx, AffiliateConfigAuditInput{
			ActorUserId:    input.ActorUserId,
			RuleSetId:      draft.Id,
			Action:         AffiliateConfigAuditActionRollbackRuleSet,
			BeforeSnapshot: snapshotAffiliateRuleSetStatus(source),
			AfterSnapshot:  snapshotAffiliateRuleSetStatus(draft),
			Reason:         input.Reason,
		}); err != nil {
			return err
		}
		saved = draft
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func ListAffiliateRuleSets(db *gorm.DB, input AffiliateRuleSetListInput) ([]model.AffiliateRuleSet, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}

	tx := db.Model(&model.AffiliateRuleSet{})
	switch strings.ToLower(strings.TrimSpace(input.Status)) {
	case model.AffiliateRuleSetStatusDraft, model.AffiliateRuleSetStatusPublished, model.AffiliateRuleSetStatusArchived:
		tx = tx.Where("status = ?", strings.ToLower(strings.TrimSpace(input.Status)))
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	startIdx := input.StartIdx
	if startIdx < 0 {
		startIdx = 0
	}

	var ruleSets []model.AffiliateRuleSet
	if err := tx.
		Order("published_at desc, updated_at desc, id desc").
		Offset(startIdx).
		Limit(pageSize).
		Find(&ruleSets).Error; err != nil {
		return nil, 0, err
	}
	return ruleSets, total, nil
}

type AffiliateConfigAuditInput struct {
	ActorUserId    int
	RuleSetId      int
	Action         string
	BeforeSnapshot string
	AfterSnapshot  string
	Reason         string
	RequestId      string
}

func RecordAffiliateConfigAuditLog(db *gorm.DB, input AffiliateConfigAuditInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if strings.TrimSpace(input.Action) == "" {
		return errors.New("empty affiliate config audit action")
	}
	audit := model.AffiliateConfigAuditLog{
		ActorUserId:    input.ActorUserId,
		RuleSetId:      input.RuleSetId,
		Action:         strings.TrimSpace(input.Action),
		BeforeSnapshot: input.BeforeSnapshot,
		AfterSnapshot:  input.AfterSnapshot,
		Reason:         strings.TrimSpace(input.Reason),
		RequestId:      strings.TrimSpace(input.RequestId),
		CreatedAt:      common.GetTimestamp(),
	}
	return db.Create(&audit).Error
}

func normalizeAffiliateRuleSetDraftInput(input AffiliateRuleSetDraftInput) AffiliateRuleSetDraftInput {
	input.Version = strings.TrimSpace(input.Version)
	input.Name = strings.TrimSpace(input.Name)
	input.Reason = strings.TrimSpace(input.Reason)
	input.SettlementConfig.Cycle = strings.TrimSpace(input.SettlementConfig.Cycle)
	input.SettlementConfig.ReviewNote = strings.TrimSpace(input.SettlementConfig.ReviewNote)
	for i := range input.CommissionRules {
		input.CommissionRules[i].Name = strings.TrimSpace(input.CommissionRules[i].Name)
		input.CommissionRules[i].Status = normalizeAffiliateRuleStatus(input.CommissionRules[i].Status)
		input.CommissionRules[i].Metadata = strings.TrimSpace(input.CommissionRules[i].Metadata)
	}
	for i := range input.KPITiers {
		input.KPITiers[i].Code = strings.TrimSpace(input.KPITiers[i].Code)
		input.KPITiers[i].Name = strings.TrimSpace(input.KPITiers[i].Name)
	}
	for i := range input.HeadFeeRules {
		input.HeadFeeRules[i].KPITierCode = strings.TrimSpace(input.HeadFeeRules[i].KPITierCode)
		input.HeadFeeRules[i].Status = normalizeAffiliateRuleStatus(input.HeadFeeRules[i].Status)
	}
	for i := range input.RiskRules {
		input.RiskRules[i].Code = strings.TrimSpace(input.RiskRules[i].Code)
		input.RiskRules[i].SelfBrushStrategy = normalizeAffiliateRiskPolicyField(input.RiskRules[i].SelfBrushStrategy, affiliateRiskSelfBrushStrategy)
		input.RiskRules[i].BulkAbuseStrategy = normalizeAffiliateRiskPolicyField(input.RiskRules[i].BulkAbuseStrategy, affiliateRiskBulkAbuseStrategy)
		input.RiskRules[i].Action = normalizeAffiliateRiskPolicyField(input.RiskRules[i].Action, affiliateRiskAction)
		input.RiskRules[i].Metadata = strings.TrimSpace(input.RiskRules[i].Metadata)
	}
	return input
}

func normalizeAffiliateRuleSetRollbackInput(input AffiliateRuleSetRollbackInput) AffiliateRuleSetRollbackInput {
	input.Version = strings.TrimSpace(input.Version)
	input.Name = strings.TrimSpace(input.Name)
	input.Reason = strings.TrimSpace(input.Reason)
	return input
}

func validateAffiliateRuleSetDraftInput(input AffiliateRuleSetDraftInput) error {
	if input.Version == "" {
		return errors.New("affiliate rule set version is required")
	}
	if input.Name == "" {
		return errors.New("affiliate rule set name is required")
	}
	if input.EffectiveStart > 0 && input.EffectiveEnd > 0 && input.EffectiveEnd < input.EffectiveStart {
		return errors.New("invalid effective window")
	}
	if err := validateAffiliateSettlementRuleConfig(input.SettlementConfig); err != nil {
		return err
	}

	maxLevelOneCap := 0
	for _, rule := range input.CommissionRules {
		if err := validateAffiliateLevel(rule.AffiliateLevel); err != nil {
			return err
		}
		if err := validateAffiliateRuleStatus(rule.Status); err != nil {
			return err
		}
		if err := validateBps("commission rate", rule.DefaultRateBps); err != nil {
			return err
		}
		if err := validateBps("commission cap", rule.DefaultCapRateBps); err != nil {
			return err
		}
		if rule.MinSettlementAmountCents < 0 {
			return errors.New("commission minimum settlement amount cannot be negative")
		}
		if rule.DefaultCapRateBps > 0 && rule.DefaultRateBps > rule.DefaultCapRateBps {
			return errors.New("commission rate cannot exceed commission cap")
		}
		if rule.AffiliateLevel == 1 {
			if rule.DefaultCapRateBps > affiliateLevelOneCommissionCapBps {
				return fmt.Errorf("level one commission cap cannot exceed %d bps", affiliateLevelOneCommissionCapBps)
			}
			maxLevelOneCap = maxInt(maxLevelOneCap, rule.DefaultCapRateBps)
		}
	}

	for _, tier := range input.CommissionTiers {
		if err := validateAffiliateLevel(tier.AffiliateLevel); err != nil {
			return err
		}
		if tier.MinNetPaidAmountCents < 0 || tier.MaxNetPaidAmountCents < 0 {
			return errors.New("commission tier amount cannot be negative")
		}
		if tier.MaxNetPaidAmountCents > 0 && tier.MaxNetPaidAmountCents < tier.MinNetPaidAmountCents {
			return errors.New("commission tier max amount cannot be less than min amount")
		}
		if err := validateBps("commission tier base rate", tier.BaseRateBps); err != nil {
			return err
		}
		if err := validateBps("commission tier cap", tier.CapRateBps); err != nil {
			return err
		}
		if tier.CapRateBps > 0 && tier.BaseRateBps > tier.CapRateBps {
			return errors.New("commission tier base rate cannot exceed cap")
		}
		if tier.AffiliateLevel == 1 {
			if tier.CapRateBps > affiliateLevelOneCommissionCapBps {
				return fmt.Errorf("level one commission cap cannot exceed %d bps", affiliateLevelOneCommissionCapBps)
			}
			maxLevelOneCap = maxInt(maxLevelOneCap, tier.CapRateBps)
		}
	}

	for _, rule := range input.CommissionRules {
		if rule.AffiliateLevel == 2 && rule.DefaultCapRateBps > maxLevelOneCap {
			return errors.New("level two commission cap cannot exceed level one commission cap")
		}
	}
	for _, tier := range input.CommissionTiers {
		if tier.AffiliateLevel == 2 && tier.CapRateBps > maxLevelOneCap {
			return errors.New("level two commission cap cannot exceed level one commission cap")
		}
	}

	for _, tier := range input.KPITiers {
		if err := validateAffiliateLevel(tier.AffiliateLevel); err != nil {
			return err
		}
		if tier.Code == "" {
			return errors.New("kpi tier code is required")
		}
		if tier.MinEffectiveNewUsers < 0 || tier.MinNetPaidAmountCents < 0 {
			return errors.New("kpi threshold cannot be negative")
		}
		if tier.CoefficientBps < affiliateBpsBase {
			return errors.New("kpi coefficient must be at least 10000 bps")
		}
		if tier.SortOrder > 1 && tier.CoefficientBps <= affiliateBpsBase {
			return errors.New("kpi coefficient for non-base tier must be greater than 10000 bps")
		}
		if err := validateBps("kpi max gift-only ratio", tier.MaxGiftOnlyRatioBps); err != nil {
			return err
		}
		if err := validateBps("kpi max abnormal ratio", tier.MaxAbnormalRatioBps); err != nil {
			return err
		}
		if err := validateBps("kpi min second payment ratio", tier.MinSecondPaymentRatioBps); err != nil {
			return err
		}
	}

	for _, rule := range input.HeadFeeRules {
		if err := validateAffiliateLevel(rule.AffiliateLevel); err != nil {
			return err
		}
		if rule.KPITierCode == "" {
			return errors.New("head fee kpi tier code is required")
		}
		if err := validateAffiliateRuleStatus(rule.Status); err != nil {
			return err
		}
		if rule.AmountCents < 0 || rule.FirstRechargeMinCents < 0 || rule.PeriodNetPaidMinCents < 0 {
			return errors.New("head fee amount cannot be negative")
		}
		if rule.QualificationDays < 0 || rule.UnlockDelayDays < 0 {
			return errors.New("head fee days cannot be negative")
		}
	}

	for _, rule := range input.RiskRules {
		if err := validateAffiliateLevel(rule.AffiliateLevel); err != nil {
			return err
		}
		if rule.Code == "" {
			return errors.New("risk rule code is required")
		}
		if err := validateBps("risk max gift-only ratio", rule.MaxGiftOnlyRatioBps); err != nil {
			return err
		}
		if err := validateBps("risk max abnormal ratio", rule.MaxAbnormalRatioBps); err != nil {
			return err
		}
		if err := validateBps("risk max refund ratio", rule.MaxRefundRatioBps); err != nil {
			return err
		}
		if err := validateBps("risk min second payment ratio", rule.MinSecondPaymentRatioBps); err != nil {
			return err
		}
		if err := validateAffiliateRiskPolicyValue("self-brush strategy", rule.SelfBrushStrategy, []string{"exclude", "manual_review"}); err != nil {
			return err
		}
		if err := validateAffiliateRiskPolicyValue("bulk-abuse strategy", rule.BulkAbuseStrategy, []string{"manual_review", "hold_commission", "exclude_from_kpi"}); err != nil {
			return err
		}
		if err := validateAffiliateRiskPolicyValue("action", rule.Action, []string{"manual_review", "review_only", "hold_commission", "hold_settlement", "exclude_from_kpi"}); err != nil {
			return err
		}
	}

	return nil
}

func validateAffiliateSettlementRuleConfig(config AffiliateSettlementRuleConfig) error {
	if config.Cycle == "" {
		return errors.New("settlement cycle is required")
	}
	if config.FreezeDays < 0 {
		return errors.New("settlement freeze days cannot be negative")
	}
	if config.MinSettlementAmountCents < 0 {
		return errors.New("settlement minimum amount cannot be negative")
	}
	return nil
}

func normalizeAffiliateRuleStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" {
		return model.AffiliateProfileStatusActive
	}
	return status
}

func validateAffiliateRuleStatus(status string) error {
	switch normalizeAffiliateRuleStatus(status) {
	case model.AffiliateProfileStatusActive, model.AffiliateProfileStatusDisabled:
		return nil
	default:
		return errors.New("invalid affiliate rule status")
	}
}

func normalizeAffiliateRiskPolicyField(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func validateAffiliateRiskPolicyValue(label string, value string, allowed []string) error {
	for _, candidate := range allowed {
		if value == candidate {
			return nil
		}
	}
	return fmt.Errorf("invalid affiliate risk %s", label)
}

func validateAffiliateLevel(level int) error {
	if level != 1 && level != 2 {
		return errors.New("invalid affiliate level")
	}
	return nil
}

func validateBps(label string, value int) error {
	if value < 0 || value > affiliateBpsBase {
		return fmt.Errorf("%s must be between 0 and %d bps", label, affiliateBpsBase)
	}
	return nil
}

func replaceAffiliateRuleSetChildren(tx *gorm.DB, ruleSetId int, input AffiliateRuleSetDraftInput) error {
	for _, modelValue := range []interface{}{
		&model.AffiliateCommissionRule{},
		&model.AffiliateCommissionTier{},
		&model.AffiliateKPITier{},
		&model.AffiliateHeadFeeRule{},
		&model.AffiliateRiskRule{},
	} {
		if err := tx.Where("rule_set_id = ?", ruleSetId).Delete(modelValue).Error; err != nil {
			return err
		}
	}

	commissionRules := make([]model.AffiliateCommissionRule, 0, len(input.CommissionRules))
	for _, rule := range input.CommissionRules {
		commissionRules = append(commissionRules, model.AffiliateCommissionRule{
			RuleSetId:                ruleSetId,
			AffiliateLevel:           rule.AffiliateLevel,
			Name:                     rule.Name,
			Status:                   rule.Status,
			Currency:                 "CNY",
			CalculationMode:          "single_user_net_paid_tier",
			DefaultRateBps:           rule.DefaultRateBps,
			DefaultCapRateBps:        rule.DefaultCapRateBps,
			AllowManualApprovalRate:  rule.AllowManualApprovalRate,
			MinSettlementAmountCents: rule.MinSettlementAmountCents,
			Metadata:                 rule.Metadata,
		})
	}
	if len(commissionRules) > 0 {
		if err := tx.Create(&commissionRules).Error; err != nil {
			return err
		}
	}

	commissionTiers := make([]model.AffiliateCommissionTier, 0, len(input.CommissionTiers))
	for _, tier := range input.CommissionTiers {
		commissionTiers = append(commissionTiers, model.AffiliateCommissionTier{
			RuleSetId:              ruleSetId,
			AffiliateLevel:         tier.AffiliateLevel,
			MinNetPaidAmountCents:  tier.MinNetPaidAmountCents,
			MaxNetPaidAmountCents:  tier.MaxNetPaidAmountCents,
			BaseRateBps:            tier.BaseRateBps,
			CapRateBps:             tier.CapRateBps,
			RequiresManualApproval: tier.RequiresManualApproval,
			SortOrder:              tier.SortOrder,
		})
	}
	if len(commissionTiers) > 0 {
		if err := tx.Create(&commissionTiers).Error; err != nil {
			return err
		}
	}

	kpiTiers := make([]model.AffiliateKPITier, 0, len(input.KPITiers))
	for _, tier := range input.KPITiers {
		kpiTiers = append(kpiTiers, model.AffiliateKPITier{
			RuleSetId:                ruleSetId,
			AffiliateLevel:           tier.AffiliateLevel,
			Code:                     tier.Code,
			Name:                     tier.Name,
			MinEffectiveNewUsers:     tier.MinEffectiveNewUsers,
			MinNetPaidAmountCents:    tier.MinNetPaidAmountCents,
			CoefficientBps:           tier.CoefficientBps,
			MaxGiftOnlyRatioBps:      tier.MaxGiftOnlyRatioBps,
			MaxAbnormalRatioBps:      tier.MaxAbnormalRatioBps,
			MinSecondPaymentRatioBps: tier.MinSecondPaymentRatioBps,
			SortOrder:                tier.SortOrder,
		})
	}
	if len(kpiTiers) > 0 {
		if err := tx.Create(&kpiTiers).Error; err != nil {
			return err
		}
	}

	headFeeRules := make([]model.AffiliateHeadFeeRule, 0, len(input.HeadFeeRules))
	for _, rule := range input.HeadFeeRules {
		headFeeRules = append(headFeeRules, model.AffiliateHeadFeeRule{
			RuleSetId:             ruleSetId,
			AffiliateLevel:        rule.AffiliateLevel,
			KPITierCode:           rule.KPITierCode,
			Status:                rule.Status,
			AmountCents:           rule.AmountCents,
			FirstRechargeMinCents: rule.FirstRechargeMinCents,
			PeriodNetPaidMinCents: rule.PeriodNetPaidMinCents,
			QualificationDays:     rule.QualificationDays,
			UnlockDelayDays:       rule.UnlockDelayDays,
		})
	}
	if len(headFeeRules) > 0 {
		if err := tx.Create(&headFeeRules).Error; err != nil {
			return err
		}
	}

	riskRules := make([]model.AffiliateRiskRule, 0, len(input.RiskRules))
	for _, rule := range input.RiskRules {
		riskRules = append(riskRules, model.AffiliateRiskRule{
			RuleSetId:                ruleSetId,
			AffiliateLevel:           rule.AffiliateLevel,
			Code:                     rule.Code,
			MaxGiftOnlyRatioBps:      rule.MaxGiftOnlyRatioBps,
			MaxAbnormalRatioBps:      rule.MaxAbnormalRatioBps,
			MaxRefundRatioBps:        rule.MaxRefundRatioBps,
			MinSecondPaymentRatioBps: rule.MinSecondPaymentRatioBps,
			SelfBrushStrategy:        rule.SelfBrushStrategy,
			BulkAbuseStrategy:        rule.BulkAbuseStrategy,
			Action:                   rule.Action,
			Metadata:                 rule.Metadata,
		})
	}
	if len(riskRules) > 0 {
		if err := tx.Create(&riskRules).Error; err != nil {
			return err
		}
	}
	return nil
}

func validateAffiliateRuleSetPersistedConfig(db *gorm.DB, ruleSet model.AffiliateRuleSet) error {
	input, err := buildAffiliateRuleSetDraftInputFromPersistedConfig(db, ruleSet)
	if err != nil {
		return err
	}
	return validateAffiliateRuleSetDraftInput(input)
}

func buildAffiliateRuleSetDraftInputFromPersistedConfig(db *gorm.DB, ruleSet model.AffiliateRuleSet) (AffiliateRuleSetDraftInput, error) {
	var commissionRules []model.AffiliateCommissionRule
	if err := db.Where("rule_set_id = ?", ruleSet.Id).Find(&commissionRules).Error; err != nil {
		return AffiliateRuleSetDraftInput{}, err
	}
	if len(commissionRules) == 0 {
		return AffiliateRuleSetDraftInput{}, errors.New("affiliate rule set has no commission rules")
	}

	var commissionTiers []model.AffiliateCommissionTier
	if err := db.Where("rule_set_id = ?", ruleSet.Id).Find(&commissionTiers).Error; err != nil {
		return AffiliateRuleSetDraftInput{}, err
	}
	var kpiTiers []model.AffiliateKPITier
	if err := db.Where("rule_set_id = ?", ruleSet.Id).Find(&kpiTiers).Error; err != nil {
		return AffiliateRuleSetDraftInput{}, err
	}
	var headFeeRules []model.AffiliateHeadFeeRule
	if err := db.Where("rule_set_id = ?", ruleSet.Id).Find(&headFeeRules).Error; err != nil {
		return AffiliateRuleSetDraftInput{}, err
	}
	var riskRules []model.AffiliateRiskRule
	if err := db.Where("rule_set_id = ?", ruleSet.Id).Find(&riskRules).Error; err != nil {
		return AffiliateRuleSetDraftInput{}, err
	}

	input := AffiliateRuleSetDraftInput{
		Id:               ruleSet.Id,
		Version:          ruleSet.Version,
		Name:             ruleSet.Name,
		EffectiveStart:   ruleSet.EffectiveStart,
		EffectiveEnd:     ruleSet.EffectiveEnd,
		SettlementConfig: extractAffiliateSettlementRuleConfig(ruleSet.ConfigSnapshot),
		CommissionRules:  make([]AffiliateCommissionRuleInput, 0, len(commissionRules)),
		CommissionTiers:  make([]AffiliateCommissionTierInput, 0, len(commissionTiers)),
		KPITiers:         make([]AffiliateKPITierInput, 0, len(kpiTiers)),
		HeadFeeRules:     make([]AffiliateHeadFeeRuleInput, 0, len(headFeeRules)),
		RiskRules:        make([]AffiliateRiskRuleInput, 0, len(riskRules)),
	}
	for _, rule := range commissionRules {
		input.CommissionRules = append(input.CommissionRules, AffiliateCommissionRuleInput{
			AffiliateLevel:           rule.AffiliateLevel,
			Name:                     rule.Name,
			Status:                   normalizeAffiliateRuleStatus(rule.Status),
			DefaultRateBps:           rule.DefaultRateBps,
			DefaultCapRateBps:        rule.DefaultCapRateBps,
			MinSettlementAmountCents: rule.MinSettlementAmountCents,
			AllowManualApprovalRate:  rule.AllowManualApprovalRate,
			Metadata:                 rule.Metadata,
		})
	}
	for _, tier := range commissionTiers {
		input.CommissionTiers = append(input.CommissionTiers, AffiliateCommissionTierInput{
			AffiliateLevel:         tier.AffiliateLevel,
			MinNetPaidAmountCents:  tier.MinNetPaidAmountCents,
			MaxNetPaidAmountCents:  tier.MaxNetPaidAmountCents,
			BaseRateBps:            tier.BaseRateBps,
			CapRateBps:             tier.CapRateBps,
			RequiresManualApproval: tier.RequiresManualApproval,
			SortOrder:              tier.SortOrder,
		})
	}
	for _, tier := range kpiTiers {
		input.KPITiers = append(input.KPITiers, AffiliateKPITierInput{
			AffiliateLevel:           tier.AffiliateLevel,
			Code:                     tier.Code,
			Name:                     tier.Name,
			MinEffectiveNewUsers:     tier.MinEffectiveNewUsers,
			MinNetPaidAmountCents:    tier.MinNetPaidAmountCents,
			CoefficientBps:           tier.CoefficientBps,
			MaxGiftOnlyRatioBps:      tier.MaxGiftOnlyRatioBps,
			MaxAbnormalRatioBps:      tier.MaxAbnormalRatioBps,
			MinSecondPaymentRatioBps: tier.MinSecondPaymentRatioBps,
			SortOrder:                tier.SortOrder,
		})
	}
	for _, rule := range headFeeRules {
		input.HeadFeeRules = append(input.HeadFeeRules, AffiliateHeadFeeRuleInput{
			AffiliateLevel:        rule.AffiliateLevel,
			KPITierCode:           rule.KPITierCode,
			Status:                normalizeAffiliateRuleStatus(rule.Status),
			AmountCents:           rule.AmountCents,
			FirstRechargeMinCents: rule.FirstRechargeMinCents,
			PeriodNetPaidMinCents: rule.PeriodNetPaidMinCents,
			QualificationDays:     rule.QualificationDays,
			UnlockDelayDays:       rule.UnlockDelayDays,
		})
	}
	for _, rule := range riskRules {
		input.RiskRules = append(input.RiskRules, AffiliateRiskRuleInput{
			AffiliateLevel:           rule.AffiliateLevel,
			Code:                     rule.Code,
			MaxGiftOnlyRatioBps:      rule.MaxGiftOnlyRatioBps,
			MaxAbnormalRatioBps:      rule.MaxAbnormalRatioBps,
			MaxRefundRatioBps:        rule.MaxRefundRatioBps,
			MinSecondPaymentRatioBps: rule.MinSecondPaymentRatioBps,
			SelfBrushStrategy:        normalizeAffiliateRiskPolicyField(rule.SelfBrushStrategy, affiliateRiskSelfBrushStrategy),
			BulkAbuseStrategy:        normalizeAffiliateRiskPolicyField(rule.BulkAbuseStrategy, affiliateRiskBulkAbuseStrategy),
			Action:                   normalizeAffiliateRiskPolicyField(rule.Action, affiliateRiskAction),
			Metadata:                 rule.Metadata,
		})
	}
	return input, nil
}

func extractAffiliateSettlementRuleConfig(snapshot string) AffiliateSettlementRuleConfig {
	var parsed struct {
		SettlementCycle  string `json:"settlement_cycle"`
		SettlementConfig struct {
			Cycle                    string `json:"cycle"`
			FreezeDays               int    `json:"freeze_days"`
			MinSettlementAmountCents int64  `json:"min_settlement_amount_cents"`
			ManualReviewEnabled      bool   `json:"manual_review_enabled"`
			AutoSettlementEnabled    *bool  `json:"auto_settlement_enabled"`
			ReviewNote               string `json:"review_note"`
		} `json:"settlement_config"`
	}
	if strings.TrimSpace(snapshot) == "" {
		return AffiliateSettlementRuleConfig{}
	}
	if err := json.Unmarshal([]byte(snapshot), &parsed); err != nil {
		return AffiliateSettlementRuleConfig{}
	}
	config := AffiliateSettlementRuleConfig{
		Cycle:                    strings.TrimSpace(parsed.SettlementConfig.Cycle),
		FreezeDays:               parsed.SettlementConfig.FreezeDays,
		MinSettlementAmountCents: parsed.SettlementConfig.MinSettlementAmountCents,
		ManualReviewEnabled:      parsed.SettlementConfig.ManualReviewEnabled,
		AutoSettlementEnabled:    true,
		ReviewNote:               strings.TrimSpace(parsed.SettlementConfig.ReviewNote),
	}
	if parsed.SettlementConfig.AutoSettlementEnabled != nil {
		config.AutoSettlementEnabled = *parsed.SettlementConfig.AutoSettlementEnabled
	}
	if config.Cycle == "" {
		config.Cycle = strings.TrimSpace(parsed.SettlementCycle)
	}
	return config
}

func buildAffiliateRuleSetConfigSnapshot(input AffiliateRuleSetDraftInput) string {
	return common.GetJsonString(map[string]interface{}{
		"version":           input.Version,
		"name":              input.Name,
		"effective_start":   input.EffectiveStart,
		"effective_end":     input.EffectiveEnd,
		"settlement_cycle":  input.SettlementConfig.Cycle,
		"commission_rules":  input.CommissionRules,
		"commission_tiers":  input.CommissionTiers,
		"kpi_tiers":         input.KPITiers,
		"head_fee_rules":    input.HeadFeeRules,
		"risk_rules":        input.RiskRules,
		"settlement_config": input.SettlementConfig,
	})
}

func snapshotAffiliateRuleSetStatus(ruleSet model.AffiliateRuleSet) string {
	return common.GetJsonString(map[string]interface{}{
		"id":                 ruleSet.Id,
		"version":            ruleSet.Version,
		"status":             ruleSet.Status,
		"effective_start":    ruleSet.EffectiveStart,
		"effective_end":      ruleSet.EffectiveEnd,
		"published_at":       ruleSet.PublishedAt,
		"config_snapshot":    ruleSet.ConfigSnapshot,
		"updated_by_user_id": ruleSet.UpdatedByUserId,
	})
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
