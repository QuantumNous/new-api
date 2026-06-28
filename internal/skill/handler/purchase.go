package handler

import (
	"errors"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/pricing"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const oneTimeSkillPurchaseAmountUSD = pricing.OneTimeSkillPriceUSD

type purchaseSkillRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	PaymentStatus  string `json:"payment_status,omitempty"`
}

type purchaseSkillResponse struct {
	OrderID          string                 `json:"order_id"`
	SkillID          string                 `json:"skill_id"`
	SkillVersionID   *string                `json:"skill_version_id,omitempty"`
	Status           string                 `json:"status"`
	Entitled         bool                   `json:"entitled"`
	AmountUSD        float64                `json:"amount_usd"`
	Currency         string                 `json:"currency"`
	QuotaCharged     int                    `json:"quota_charged"`
	MonetizationType enums.MonetizationType `json:"monetization_type"`
}

// PurchaseMarketplaceSkill handles POST /api/v1/marketplace/skills/:id/purchase.
func PurchaseMarketplaceSkill(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userID := int64(c.GetInt("id"))
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	var req purchaseSkillRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Invalid purchase payload.", nil)
		return
	}
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if req.IdempotencyKey == "" || len(req.IdempotencyKey) > 128 {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "idempotency_key is required.", nil)
		return
	}
	status := strings.TrimSpace(req.PaymentStatus)
	if status == "" {
		status = "paid"
	}
	if status != "paid" && status != skillmodel.SkillPurchaseStatusFailed && status != skillmodel.SkillPurchaseStatusAbandoned {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Unsupported payment_status.", nil)
		return
	}

	var resp purchaseSkillResponse
	err := db.Transaction(func(tx *gorm.DB) error {
		var s skillmodel.Skill
		if err := tx.Where("status = ?", enums.SkillStatusPublished).
			Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
			First(&s).Error; err != nil {
			return err
		}
		if s.MonetizationType != enums.MonetizationTypeOneTime {
			return errSkillPurchaseInvalidMonetization
		}
		if s.ActiveVersionID == nil || strings.TrimSpace(*s.ActiveVersionID) == "" {
			return errSkillPurchaseNoActiveVersion
		}

		var order skillmodel.SkillPurchaseOrder
		err := tx.Where("user_id = ? AND idempotency_key = ?", userID, req.IdempotencyKey).First(&order).Error
		if err == nil {
			if order.SkillID != s.ID {
				return errSkillPurchaseIdempotencyConflict
			}
			resp = purchaseResponseFromOrder(order, order.Status == skillmodel.SkillPurchaseStatusSucceeded)
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		order = skillmodel.SkillPurchaseOrder{
			UserID:         userID,
			TenantID:       userID,
			SkillID:        s.ID,
			SkillVersionID: s.ActiveVersionID,
			IdempotencyKey: req.IdempotencyKey,
			AmountUSD:      oneTimeSkillPurchaseAmountUSD,
			Currency:       "USD",
			QuotaCharged:   oneTimePurchaseQuotaCharge(),
			Monetization:   enums.MonetizationTypeOneTime,
			Status:         skillmodel.SkillPurchaseStatusPending,
		}
		if status != "paid" {
			order.Status = status
			now := time.Now().UTC()
			order.CompletedAt = &now
			if err := tx.Create(&order).Error; err != nil {
				return err
			}
			resp = purchaseResponseFromOrder(order, false)
			return nil
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		charged, err := debitOneTimePurchaseQuota(tx, int(userID), order.QuotaCharged)
		if err != nil {
			return err
		}
		if !charged {
			return errSkillPurchaseInsufficientQuota
		}
		if err := skillmodel.GrantOneTimeEntitlement(tx, userID, userID, s.ID, order.ID); err != nil {
			return err
		}
		if err := skillmodel.EnableSkillForUser(tx, userID, userID, s.ID, "one_time_purchase"); err != nil {
			return err
		}
		plan := groupToPlan(c.GetString("group"))
		if err := skillmodel.EmitSkillPurchased(tx, userID, s.ID, s.ActiveVersionID, plan, oneTimeSkillPurchaseAmountUSD); err != nil {
			return err
		}
		now := time.Now().UTC()
		order.Status = skillmodel.SkillPurchaseStatusSucceeded
		order.CompletedAt = &now
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		resp = purchaseResponseFromOrder(order, true)
		return nil
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			writeSkillLookupError(c, err)
		case errors.Is(err, errSkillPurchaseInvalidMonetization):
			skillapi.Error(c, errcodes.ErrInvalidRequest, "Skill is not available for one-time purchase.", nil)
		case errors.Is(err, errSkillPurchaseNoActiveVersion):
			skillapi.Error(c, errcodes.ErrSkillNotPublished, "Skill is not currently runnable.", nil)
		case errors.Is(err, errSkillPurchaseIdempotencyConflict):
			skillapi.Error(c, errcodes.ErrSkillConflict, "idempotency_key is already used for a different skill.", nil)
		case errors.Is(err, errSkillPurchaseInsufficientQuota):
			skillapi.Error(c, errcodes.ErrSkillQuotaExceeded, "Insufficient wallet balance for one-time purchase.", nil)
		default:
			writeDBError(c, err)
		}
		return
	}
	skillapi.Success(c, resp)
}

var (
	errSkillPurchaseInvalidMonetization = errors.New("skill is not one_time monetization")
	errSkillPurchaseNoActiveVersion     = errors.New("skill has no active version for purchase")
	errSkillPurchaseIdempotencyConflict = errors.New("idempotency key used for different skill")
	errSkillPurchaseInsufficientQuota   = errors.New("insufficient quota for one_time purchase")
)

func oneTimePurchaseQuotaCharge() int {
	return int(math.Round(oneTimeSkillPurchaseAmountUSD * common.QuotaPerUnit))
}

func debitOneTimePurchaseQuota(tx *gorm.DB, userID int, quota int) (bool, error) {
	if quota <= 0 {
		return false, nil
	}
	res := tx.Model(&platformmodel.User{}).
		Where("id = ? AND quota >= ?", userID, quota).
		Update("quota", gorm.Expr("quota - ?", quota))
	if res.Error != nil {
		return false, res.Error
	}
	return res.RowsAffected == 1, nil
}

func purchaseResponseFromOrder(order skillmodel.SkillPurchaseOrder, entitled bool) purchaseSkillResponse {
	return purchaseSkillResponse{
		OrderID:          order.ID,
		SkillID:          order.SkillID,
		SkillVersionID:   order.SkillVersionID,
		Status:           order.Status,
		Entitled:         entitled,
		AmountUSD:        order.AmountUSD,
		Currency:         order.Currency,
		QuotaCharged:     order.QuotaCharged,
		MonetizationType: order.Monetization,
	}
}
