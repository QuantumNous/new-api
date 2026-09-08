package service

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	AgentPurchaseMinQuantity = 1
	AgentPurchaseMaxQuantity = 100
)

var (
	ErrAgentFeatureDisabled         = errors.New("agent workspace is disabled")
	ErrAgentPurchaseInvalidQuantity = errors.New("agent purchase quantity must be between 1 and 100")
	ErrAgentPurchaseInvalidRequest  = errors.New("invalid agent purchase request")
	ErrAgentOfferUnavailable        = errors.New("agent offer is unavailable")
	ErrAgentPlanUnavailable         = errors.New("subscription plan is unavailable")
	ErrAgentDailyLimitExceeded      = errors.New("agent daily code limit exceeded")

	errAgentPurchaseUniqueConflict = errors.New("agent purchase unique conflict")
)

type AgentPurchaseInput struct {
	AgentUserID    int
	PlanID         int
	Quantity       int
	IdempotencyKey string
}

type AgentPurchaseResult struct {
	Order        model.AgentPurchaseOrder
	Codes        []model.Redemption
	BalanceAfter int64
}

type AgentOverview struct {
	Account          model.AgentAccount
	DailyCodeCount   int
	DailyRemaining   int
	NextDailyResetAt int64
}

func PurchaseAgentCodes(input AgentPurchaseInput) (*AgentPurchaseResult, error) {
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
	if input.Quantity < AgentPurchaseMinQuantity || input.Quantity > AgentPurchaseMaxQuantity {
		return nil, ErrAgentPurchaseInvalidQuantity
	}
	if input.AgentUserID <= 0 || input.PlanID <= 0 || input.IdempotencyKey == "" || len(input.IdempotencyKey) > agentIdempotencyKeyMaxBytes {
		return nil, ErrAgentPurchaseInvalidRequest
	}

	for attempt := 0; attempt < agentAccountMutationMaxAttempts; attempt++ {
		var existing model.AgentPurchaseOrder
		err := model.DB.Where("agent_user_id = ? AND idempotency_key = ?", input.AgentUserID, input.IdempotencyKey).
			First(&existing).Error
		if err == nil {
			if existing.PlanId != input.PlanID || existing.Quantity != input.Quantity {
				return nil, ErrAgentIdempotencyConflict
			}
			var replay *AgentPurchaseResult
			err = model.DB.Transaction(func(tx *gorm.DB) error {
				loaded, loadErr := loadAgentPurchaseResultTx(tx, existing)
				replay = loaded
				return loadErr
			})
			return replay, err
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if !operation_setting.GetAgentSetting().Enabled {
			return nil, ErrAgentFeatureDisabled
		}

		var expectedAccount model.AgentAccount
		if err := model.DB.Where("user_id = ?", input.AgentUserID).First(&expectedAccount).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrAgentAccountNotFound
			}
			return nil, err
		}
		if expectedAccount.Status != model.AgentAccountStatusActive {
			return nil, ErrAgentAccountDisabled
		}
		if expectedAccount.Balance < 0 || expectedAccount.Version == math.MaxInt64 {
			return nil, ErrAgentBalanceOverflow
		}
		var preflightPlan model.SubscriptionPlan
		if err := model.DB.Where("id = ?", input.PlanID).First(&preflightPlan).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrAgentPlanUnavailable
			}
			return nil, err
		}
		if _, err := validateAgentPurchasePlan(&preflightPlan); err != nil {
			return nil, err
		}

		var result AgentPurchaseResult
		err = model.DB.Transaction(func(tx *gorm.DB) error {
			// Advancing the optimistic version is the transaction's first database
			// operation. This avoids SQLite read-to-write upgrade races while the
			// same compare-and-swap remains correct on every supported database.
			guard := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ? AND status = ?", expectedAccount.Id, expectedAccount.Version, model.AgentAccountStatusActive).
				UpdateColumn("version", expectedAccount.Version+1)
			if guard.Error != nil {
				return guard.Error
			}
			if guard.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}

			var existing model.AgentPurchaseOrder
			err := tx.Where("agent_user_id = ? AND idempotency_key = ?", input.AgentUserID, input.IdempotencyKey).
				First(&existing).Error
			if err == nil {
				// A competing request committed after the preflight read. Roll back
				// the version guard and resolve the immutable result on the next pass.
				return errAgentPurchaseUniqueConflict
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			var account model.AgentAccount
			if err := tx.Where("user_id = ?", input.AgentUserID).First(&account).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAgentAccountNotFound
				}
				return err
			}
			if account.Status != model.AgentAccountStatusActive {
				return ErrAgentAccountDisabled
			}
			if account.Balance < 0 {
				return ErrAgentBalanceOverflow
			}
			if err := guardAgentLedgerConsistencyTx(tx, &account); err != nil {
				return err
			}
			var offer model.AgentPlanOffer
			if err := tx.Where("plan_id = ?", input.PlanID).First(&offer).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAgentOfferUnavailable
				}
				return err
			}
			if !offer.Enabled || offer.UnitPrice <= 0 || offer.CodeValidDays < 1 || offer.CodeValidDays > maxAgentCodeValidDays || offer.RefundFeeBps < 0 || offer.RefundFeeBps > 10000 {
				return ErrAgentOfferUnavailable
			}

			var plan model.SubscriptionPlan
			if err := tx.Where("id = ?", input.PlanID).First(&plan).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAgentPlanUnavailable
				}
				return err
			}
			snapshot, err := validateAgentPurchasePlan(&plan)
			if err != nil {
				return err
			}

			total, err := AgentPurchaseTotal(offer.UnitPrice, input.Quantity)
			if err != nil {
				return err
			}
			if account.Balance < total {
				return ErrAgentInsufficientBalance
			}

			now := time.Now()
			localNow := now.In(time.Local)
			today := localNow.Format("2006-01-02")
			dailyCount := 0
			if account.DailyCountDate == today {
				dailyCount = account.DailyCodeCount
			}
			if account.DailyCodeLimit <= 0 || dailyCount < 0 || input.Quantity > account.DailyCodeLimit-dailyCount {
				return ErrAgentDailyLimitExceeded
			}

			encodedSnapshot, err := model.EncodeSubscriptionEntitlementSnapshot(snapshot)
			if err != nil {
				return err
			}

			balanceAfter := account.Balance - total
			updated := tx.Model(&model.AgentAccount{}).
				Where("id = ? AND version = ? AND status = ? AND balance >= ?", account.Id, account.Version, model.AgentAccountStatusActive, total).
				Updates(map[string]interface{}{
					"balance":          balanceAfter,
					"daily_count_date": today,
					"daily_code_count": dailyCount + input.Quantity,
					"version":          account.Version,
				})
			if updated.Error != nil {
				return updated.Error
			}
			if updated.RowsAffected != 1 {
				return errAgentAccountVersionConflict
			}

			order := model.AgentPurchaseOrder{
				OrderNo: common.GetUUID(), AgentUserId: input.AgentUserID,
				PlanId: plan.Id, PlanTitle: snapshot.PlanTitle, Quantity: input.Quantity,
				UnitPrice: offer.UnitPrice, TotalPrice: total, CodeValidDays: offer.CodeValidDays,
				RefundFeeBps: offer.RefundFeeBps, EntitlementSnapshot: encodedSnapshot,
				IdempotencyKey: input.IdempotencyKey, Status: model.AgentPurchaseOrderStatusCompleted,
			}
			if err := tx.Create(&order).Error; err != nil {
				if isAgentPurchaseUniqueConflict(err) {
					return errAgentPurchaseUniqueConflict
				}
				return err
			}

			expiresAt := now.AddDate(0, 0, offer.CodeValidDays).Unix()
			codes := make([]model.Redemption, 0, input.Quantity)
			for index := 0; index < input.Quantity; index++ {
				codes = append(codes, model.Redemption{
					UserId: input.AgentUserID, Key: common.GetUUID(), Status: common.RedemptionCodeStatusEnabled,
					Type: common.RedemptionCodeTypeSubscription, Name: snapshot.PlanTitle, CreatedTime: now.Unix(),
					AgentUserId: input.AgentUserID, AgentOrderId: order.Id, SubscriptionPlanId: plan.Id,
					ExpiredTime: expiresAt,
				})
			}
			if err := tx.Create(&codes).Error; err != nil {
				if isAgentPurchaseUniqueConflict(err) {
					return errAgentPurchaseUniqueConflict
				}
				return err
			}

			ledger := model.AgentCreditLog{
				AgentUserId: input.AgentUserID, Delta: -total,
				BalanceBefore: account.Balance, BalanceAfter: balanceAfter,
				EventType: model.AgentCreditEventPurchase, BusinessKey: "agent-purchase:" + order.OrderNo,
				OrderId: order.Id, Remark: "package code purchase",
			}
			if err := tx.Create(&ledger).Error; err != nil {
				if isAgentPurchaseUniqueConflict(err) {
					return errAgentPurchaseUniqueConflict
				}
				return err
			}

			result = AgentPurchaseResult{Order: order, Codes: codes, BalanceAfter: balanceAfter}
			return nil
		})
		if err == nil {
			return &result, nil
		}
		if errors.Is(err, errAgentAccountVersionConflict) || errors.Is(err, errAgentPurchaseUniqueConflict) {
			continue
		}
		return nil, err
	}
	return nil, ErrAgentAccountConflict
}

func loadAgentPurchaseResultTx(tx *gorm.DB, order model.AgentPurchaseOrder) (*AgentPurchaseResult, error) {
	var codes []model.Redemption
	if err := tx.Where("agent_order_id = ? AND type = ?", order.Id, common.RedemptionCodeTypeSubscription).
		Order("id ASC").Find(&codes).Error; err != nil {
		return nil, err
	}
	if len(codes) != order.Quantity {
		return nil, errors.New("agent purchase code inventory is incomplete")
	}
	var ledger model.AgentCreditLog
	if err := tx.Where("event_type = ? AND order_id = ?", model.AgentCreditEventPurchase, order.Id).First(&ledger).Error; err != nil {
		return nil, err
	}
	return &AgentPurchaseResult{Order: order, Codes: codes, BalanceAfter: ledger.BalanceAfter}, nil
}

func GetAgentOverview(agentUserID int) (*AgentOverview, error) {
	account, err := getActiveAgentAccount(agentUserID)
	if err != nil {
		return nil, err
	}
	now := time.Now().In(time.Local)
	dailyCount := 0
	if account.DailyCountDate == now.Format("2006-01-02") {
		dailyCount = account.DailyCodeCount
	}
	dailyRemaining := account.DailyCodeLimit - dailyCount
	if dailyRemaining < 0 {
		dailyRemaining = 0
	}
	nextReset := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
	return &AgentOverview{
		Account: *account, DailyCodeCount: dailyCount,
		DailyRemaining: dailyRemaining, NextDailyResetAt: nextReset.Unix(),
	}, nil
}

func ListPurchasableAgentOffers(agentUserID int) ([]AgentPlanOfferRecord, error) {
	if _, err := getActiveAgentAccount(agentUserID); err != nil {
		return nil, err
	}
	var offers []model.AgentPlanOffer
	if err := model.DB.Where("enabled = ?", true).Order("id ASC").Find(&offers).Error; err != nil {
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
	if err := model.DB.Where("id IN ? AND enabled = ?", planIDs, true).Order("sort_order ASC, id ASC").Find(&plans).Error; err != nil {
		return nil, err
	}
	offersByPlanID := make(map[int]model.AgentPlanOffer, len(offers))
	for _, offer := range offers {
		offersByPlanID[offer.PlanId] = offer
	}
	result := make([]AgentPlanOfferRecord, 0, len(plans))
	for _, plan := range plans {
		offer, ok := offersByPlanID[plan.Id]
		if !ok || offer.UnitPrice <= 0 || offer.CodeValidDays < 1 || offer.CodeValidDays > maxAgentCodeValidDays || offer.RefundFeeBps < 0 || offer.RefundFeeBps > 10000 {
			continue
		}
		if _, err := validateAgentPurchasePlan(&plan); err != nil {
			continue
		}
		result = append(result, AgentPlanOfferRecord{Offer: offer, Plan: plan})
	}
	return result, nil
}

func validateAgentPurchasePlan(plan *model.SubscriptionPlan) (model.SubscriptionEntitlementSnapshot, error) {
	if plan == nil || !plan.Enabled {
		return model.SubscriptionEntitlementSnapshot{}, ErrAgentPlanUnavailable
	}
	plan.NormalizeDefaults()
	snapshot, err := model.BuildSubscriptionEntitlementSnapshot(plan)
	if err != nil {
		return model.SubscriptionEntitlementSnapshot{}, ErrAgentPlanUnavailable
	}
	return snapshot, nil
}

func getActiveAgentAccount(agentUserID int) (*model.AgentAccount, error) {
	if !operation_setting.GetAgentSetting().Enabled {
		return nil, ErrAgentFeatureDisabled
	}
	account, err := GetAgentAccount(agentUserID)
	if err != nil {
		return nil, err
	}
	if account.Status != model.AgentAccountStatusActive {
		return nil, ErrAgentAccountDisabled
	}
	return account, nil
}

func isAgentPurchaseUniqueConflict(err error) bool {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique constraint") || strings.Contains(message, "duplicate entry") || strings.Contains(message, "duplicate key")
}
