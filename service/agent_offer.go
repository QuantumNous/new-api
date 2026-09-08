package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxAgentCodeValidDays = 3650

var (
	ErrAgentPlanNotFound          = errors.New("subscription plan not found")
	ErrAgentOfferInvalidPrice     = errors.New("agent offer unit price must be positive")
	ErrAgentOfferInvalidValidity  = errors.New("agent offer code validity must be between 1 and 3650 days")
	ErrAgentOfferInvalidRefundFee = errors.New("agent offer refund fee must be between 0 and 10000 basis points")
)

type AgentPlanOfferInput struct {
	PlanID        int
	Enabled       bool
	UnitPrice     int64
	CodeValidDays *int
	RefundFeeBps  int
}

type AgentPlanOfferRecord struct {
	Offer model.AgentPlanOffer
	Plan  model.SubscriptionPlan
}

// UpsertAgentPlanOffer configures the single global agent offer for a plan.
// Historical orders and redemption codes are deliberately outside this write.
func UpsertAgentPlanOffer(input AgentPlanOfferInput) (*model.AgentPlanOffer, error) {
	if input.PlanID <= 0 {
		return nil, ErrAgentPlanNotFound
	}
	if input.UnitPrice <= 0 {
		return nil, ErrAgentOfferInvalidPrice
	}
	codeValidDays := model.DefaultAgentCodeValidDays
	if input.CodeValidDays != nil {
		codeValidDays = *input.CodeValidDays
	}
	if codeValidDays < 1 || codeValidDays > maxAgentCodeValidDays {
		return nil, ErrAgentOfferInvalidValidity
	}
	if input.RefundFeeBps < 0 || input.RefundFeeBps > 10000 {
		return nil, ErrAgentOfferInvalidRefundFee
	}

	var result model.AgentPlanOffer
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var plan model.SubscriptionPlan
		if err := tx.Select("id").Where("id = ?", input.PlanID).First(&plan).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrAgentPlanNotFound
			}
			return err
		}

		offer := model.AgentPlanOffer{
			PlanId: input.PlanID, Enabled: input.Enabled, UnitPrice: input.UnitPrice,
			CodeValidDays: codeValidDays, RefundFeeBps: input.RefundFeeBps,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "plan_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"enabled":         input.Enabled,
				"unit_price":      input.UnitPrice,
				"code_valid_days": codeValidDays,
				"refund_fee_bps":  input.RefundFeeBps,
				"updated_at":      common.GetTimestamp(),
			}),
		}).Create(&offer).Error; err != nil {
			return err
		}
		return tx.Where("plan_id = ?", input.PlanID).First(&result).Error
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func ListAgentPlanOffers() ([]AgentPlanOfferRecord, error) {
	var offers []model.AgentPlanOffer
	if err := model.DB.Order("id DESC").Find(&offers).Error; err != nil {
		return nil, err
	}
	if len(offers) == 0 {
		return []AgentPlanOfferRecord{}, nil
	}
	planIDs := make([]int, 0, len(offers))
	for _, offer := range offers {
		planIDs = append(planIDs, offer.PlanId)
	}
	var plans []model.SubscriptionPlan
	if err := model.DB.Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
		return nil, err
	}
	plansByID := make(map[int]model.SubscriptionPlan, len(plans))
	for _, plan := range plans {
		plan.NormalizeDefaults()
		plansByID[plan.Id] = plan
	}
	records := make([]AgentPlanOfferRecord, 0, len(offers))
	for _, offer := range offers {
		plan, ok := plansByID[offer.PlanId]
		if !ok {
			return nil, ErrAgentPlanNotFound
		}
		records = append(records, AgentPlanOfferRecord{Offer: offer, Plan: plan})
	}
	return records, nil
}
