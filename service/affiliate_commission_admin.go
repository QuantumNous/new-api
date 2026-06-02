package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type AffiliateManualCommissionAdjustmentInput struct {
	AffiliateUserId  int
	DownstreamUserId int
	RuleSetId        int
	PeriodStart      int64
	PeriodEnd        int64
	CommissionCents  int64
	ActorUserId      int
	Reason           string
}

type AffiliateCommissionEventVoidInput struct {
	ActorUserId int
	Reason      string
}

type AffiliateCommissionRecomputeInput struct {
	RuleSetId       int
	PeriodStart     int64
	PeriodEnd       int64
	QuotaPerUnit    float64
	USDExchangeRate float64
	ActorUserId     int
	Reason          string
}

type AffiliateCommissionRecomputeResult struct {
	VoidedEventCount  int                              `json:"voided_event_count"`
	CreatedEventCount int                              `json:"created_event_count"`
	CreatedEvents     []model.AffiliateCommissionEvent `json:"created_events"`
}

func CreateAffiliateManualCommissionAdjustment(db *gorm.DB, input AffiliateManualCommissionAdjustmentInput) (*model.AffiliateCommissionEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.AffiliateUserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}
	if input.CommissionCents == 0 {
		return nil, errors.New("manual commission adjustment amount must not be zero")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return nil, errors.New("invalid commission adjustment period")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("manual commission adjustment reason is required")
	}

	ruleSet, err := findAffiliateCommissionManagementRuleSet(db, input.RuleSetId, input.PeriodStart, input.PeriodEnd)
	if err != nil {
		return nil, err
	}

	var event model.AffiliateCommissionEvent
	err = db.Transaction(func(tx *gorm.DB) error {
		event = model.AffiliateCommissionEvent{
			AffiliateUserId:  input.AffiliateUserId,
			DownstreamUserId: input.DownstreamUserId,
			Kind:             AffiliateCommissionEventKindManualAdjustment,
			Status:           model.AffiliateEventStatusPending,
			RuleSetId:        ruleSet.Id,
			PeriodStart:      input.PeriodStart,
			PeriodEnd:        input.PeriodEnd,
			CommissionCents:  input.CommissionCents,
			SyntheticMarker:  "manual:pending",
			Metadata: common.GetJsonString(map[string]interface{}{
				"actor_user_id":    input.ActorUserId,
				"reason":           reason,
				"rule_set_version": ruleSet.Version,
			}),
		}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		event.SyntheticMarker = fmt.Sprintf("manual:%d", event.Id)
		if err := tx.Model(&model.AffiliateCommissionEvent{}).
			Where("id = ?", event.Id).
			Update("synthetic_marker", event.SyntheticMarker).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func VoidAffiliateCommissionEvent(db *gorm.DB, eventId int, input AffiliateCommissionEventVoidInput) (*model.AffiliateCommissionEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if eventId <= 0 {
		return nil, errors.New("invalid commission event id")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("commission event void reason is required")
	}

	var event model.AffiliateCommissionEvent
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&event, eventId).Error; err != nil {
			return err
		}
		if event.Status == model.AffiliateEventStatusSettled {
			return errors.New("settled commission events cannot be voided")
		}
		if event.Status == model.AffiliateEventStatusVoid {
			return nil
		}
		if event.SettlementId > 0 {
			return errors.New("commission events linked to a settlement cannot be voided directly")
		}
		metadata := mergeAffiliateEventMetadata(event.Metadata, map[string]interface{}{
			"void_actor_user_id": input.ActorUserId,
			"void_reason":        reason,
			"voided_at":          common.GetTimestamp(),
		})
		if err := tx.Model(&model.AffiliateCommissionEvent{}).
			Where("id = ?", event.Id).
			Updates(map[string]interface{}{
				"status":   model.AffiliateEventStatusVoid,
				"metadata": metadata,
			}).Error; err != nil {
			return err
		}
		return tx.First(&event, event.Id).Error
	})
	if err != nil {
		return nil, err
	}
	return &event, nil
}

func RecomputeAffiliatePendingCommissionEvents(db *gorm.DB, logDB *gorm.DB, input AffiliateCommissionRecomputeInput) (AffiliateCommissionRecomputeResult, error) {
	if db == nil {
		return AffiliateCommissionRecomputeResult{}, errors.New("nil db")
	}
	if logDB == nil {
		return AffiliateCommissionRecomputeResult{}, errors.New("nil log db")
	}
	if input.PeriodStart > 0 && input.PeriodEnd > 0 && input.PeriodEnd < input.PeriodStart {
		return AffiliateCommissionRecomputeResult{}, errors.New("invalid commission recompute period")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return AffiliateCommissionRecomputeResult{}, errors.New("commission recompute reason is required")
	}

	ruleSet, err := findAffiliateCommissionManagementRuleSet(db, input.RuleSetId, input.PeriodStart, input.PeriodEnd)
	if err != nil {
		return AffiliateCommissionRecomputeResult{}, err
	}

	var result AffiliateCommissionRecomputeResult
	err = db.Transaction(func(tx *gorm.DB) error {
		var events []model.AffiliateCommissionEvent
		query := tx.
			Where("rule_set_id = ? AND settlement_id = ? AND status = ? AND source_log_id > ?", ruleSet.Id, 0, model.AffiliateEventStatusPending, 0).
			Where("kind IN ?", []string{AffiliateCommissionEventKindAccrual, AffiliateCommissionEventKindClawback})
		if input.PeriodStart != 0 {
			query = query.Where("period_start = ?", input.PeriodStart)
		}
		if input.PeriodEnd != 0 {
			query = query.Where("period_end = ?", input.PeriodEnd)
		}
		if err := query.Order("id asc").Find(&events).Error; err != nil {
			return err
		}
		for _, event := range events {
			metadata := mergeAffiliateEventMetadata(event.Metadata, map[string]interface{}{
				"recompute_actor_user_id":   input.ActorUserId,
				"recompute_reason":          reason,
				"original_synthetic_marker": event.SyntheticMarker,
				"voided_at":                 common.GetTimestamp(),
			})
			if err := tx.Model(&model.AffiliateCommissionEvent{}).
				Where("id = ?", event.Id).
				Updates(map[string]interface{}{
					"status":           model.AffiliateEventStatusVoid,
					"synthetic_marker": fmt.Sprintf("void:%d", event.Id),
					"metadata":         metadata,
				}).Error; err != nil {
				return err
			}
		}
		result.VoidedEventCount = len(events)

		created, err := BuildAffiliatePendingCommissionEvents(tx, logDB, AffiliateCommissionBuildInput{
			RuleSetId:       ruleSet.Id,
			PeriodStart:     input.PeriodStart,
			PeriodEnd:       input.PeriodEnd,
			QuotaPerUnit:    input.QuotaPerUnit,
			USDExchangeRate: input.USDExchangeRate,
		})
		if err != nil {
			return err
		}
		result.CreatedEvents = created
		result.CreatedEventCount = len(created)
		return nil
	})
	if err != nil {
		return AffiliateCommissionRecomputeResult{}, err
	}
	return result, nil
}

func findAffiliateCommissionManagementRuleSet(db *gorm.DB, ruleSetId int, periodStart int64, periodEnd int64) (model.AffiliateRuleSet, error) {
	var ruleSet model.AffiliateRuleSet
	tx := db.Where("status = ?", model.AffiliateRuleSetStatusPublished)
	if ruleSetId > 0 {
		tx = tx.Where("id = ?", ruleSetId)
	}
	if periodEnd > 0 {
		tx = tx.Where("(effective_start = 0 OR effective_start <= ?) AND (effective_end = 0 OR effective_end >= ?)", periodEnd, periodStart)
	}
	err := tx.Order("effective_start desc, published_at desc, id desc").First(&ruleSet).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.AffiliateRuleSet{}, errors.New("no published affiliate rule set for commission management")
	}
	return ruleSet, err
}

func mergeAffiliateEventMetadata(existing string, values map[string]interface{}) string {
	metadata, _ := common.StrToMap(existing)
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	for key, value := range values {
		metadata[key] = value
	}
	return common.GetJsonString(metadata)
}
