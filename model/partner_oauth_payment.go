package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrPartnerOAuthPaymentOrderNotFound   = errors.New("partner oauth payment order not found")
	ErrPartnerOAuthPaymentIdempotencyRace = errors.New("partner oauth payment idempotency key already used")
	ErrPartnerOAuthPaymentRateLimited     = errors.New("partner oauth payment order limit reached")
)

// PartnerOAuthPaymentOrderLimits caps the orders one binding may create: at
// most MaxRecent created since RecentSince, and at most MaxPending still
// unpaid among those created since PendingSince.
type PartnerOAuthPaymentOrderLimits struct {
	RecentSince  int64
	MaxRecent    int64
	PendingSince int64
	MaxPending   int64
}

// PartnerOAuthPaymentOrder links a top-up order to the partner binding that
// placed it. The order itself lives in top_ups and settles through the normal
// provider callbacks; this table only scopes lookups, idempotency and the
// optional browser return to the partner.
type PartnerOAuthPaymentOrder struct {
	Id                 int64  `json:"id" gorm:"primaryKey"`
	BindingId          string `json:"binding_id" gorm:"type:varchar(64);not null;uniqueIndex:ux_partner_payment_idempotency,priority:1;index:idx_partner_payment_binding_created,priority:1"`
	IdempotencyKeyHash string `json:"-" gorm:"type:char(64);not null;uniqueIndex:ux_partner_payment_idempotency,priority:2"`
	RequestHash        string `json:"-" gorm:"type:char(64);not null"`
	ClientId           string `json:"client_id" gorm:"type:varchar(64);not null;index"`
	UserId             int    `json:"user_id" gorm:"not null;index"`
	TopUpId            int    `json:"top_up_id" gorm:"not null;uniqueIndex"`
	RequestedAmount    int64  `json:"requested_amount" gorm:"type:bigint;not null"`
	ReturnURL          string `json:"-" gorm:"type:varchar(512)"`
	CreatedAt          int64  `json:"created_at" gorm:"type:bigint;not null;index:idx_partner_payment_binding_created,priority:2"`
}

func (PartnerOAuthPaymentOrder) TableName() string {
	return "partner_oauth_payment_orders"
}

// CreatePartnerOAuthPaymentOrder commits the top-up, its cashback context and
// the partner link together. It locks the active binding row first, so
// concurrent requests of one binding are checked against the limits one at a
// time. A request whose idempotency key is already used returns
// ErrPartnerOAuthPaymentIdempotencyRace, one over the limits returns
// ErrPartnerOAuthPaymentRateLimited, and neither leaves an orphan top-up.
func CreatePartnerOAuthPaymentOrder(order *PartnerOAuthPaymentOrder, topUp *TopUp, baseQuota int, metadata CashbackRequestMetadata, limits PartnerOAuthPaymentOrderLimits) error {
	if order == nil || topUp == nil || order.BindingId == "" || order.IdempotencyKeyHash == "" {
		return errors.New("invalid partner oauth payment order")
	}
	metadata.IneligibleReason = CashbackIneligiblePartnerOAuth
	err := DB.Transaction(func(tx *gorm.DB) error {
		var binding PartnerOAuthBinding
		err := lockForUpdate(tx).Select("id").
			Where("binding_id = ? AND status = ?", order.BindingId, PartnerOAuthBindingStatusActive).
			First(&binding).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPartnerOAuthBindingNotFound
		}
		if err != nil {
			return err
		}
		var used int64
		if err := tx.Model(&PartnerOAuthPaymentOrder{}).
			Where("binding_id = ? AND idempotency_key_hash = ?", order.BindingId, order.IdempotencyKeyHash).
			Count(&used).Error; err != nil {
			return err
		}
		if used > 0 {
			return ErrPartnerOAuthPaymentIdempotencyRace
		}
		recent, err := countPartnerOAuthPaymentOrdersTx(tx, order.BindingId, limits.RecentSince, false)
		if err != nil {
			return err
		}
		pending, err := countPartnerOAuthPaymentOrdersTx(tx, order.BindingId, limits.PendingSince, true)
		if err != nil {
			return err
		}
		if recent >= limits.MaxRecent || pending >= limits.MaxPending {
			return ErrPartnerOAuthPaymentRateLimited
		}
		if err := InsertOnlineTopUpTx(tx, topUp, baseQuota, metadata); err != nil {
			return err
		}
		order.TopUpId = topUp.Id
		order.UserId = topUp.UserId
		if order.CreatedAt == 0 {
			order.CreatedAt = common.GetTimestamp()
		}
		return tx.Create(order).Error
	})
	if isDatabaseDuplicatedKey(DB, err) {
		return ErrPartnerOAuthPaymentIdempotencyRace
	}
	return err
}

func FindPartnerOAuthPaymentOrderByIdempotency(bindingID, keyHash string) (*PartnerOAuthPaymentOrder, *TopUp, error) {
	var order PartnerOAuthPaymentOrder
	err := DB.Where("binding_id = ? AND idempotency_key_hash = ?", bindingID, keyHash).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerOAuthPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	var topUp TopUp
	if err := DB.Where("id = ?", order.TopUpId).First(&topUp).Error; err != nil {
		return nil, nil, err
	}
	return &order, &topUp, nil
}

// GetPartnerOAuthPaymentOrder returns the order only when this binding placed
// it; orders from the web console or other bindings are reported as missing.
func GetPartnerOAuthPaymentOrder(bindingID, tradeNo string) (*PartnerOAuthPaymentOrder, *TopUp, error) {
	var topUp TopUp
	err := DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerOAuthPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	var order PartnerOAuthPaymentOrder
	err = DB.Where("top_up_id = ? AND binding_id = ?", topUp.Id, bindingID).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil, ErrPartnerOAuthPaymentOrderNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	return &order, &topUp, nil
}

// countPartnerOAuthPaymentOrdersTx counts a binding's orders created at or
// after since; pendingOnly restricts the count to orders still awaiting payment.
func countPartnerOAuthPaymentOrdersTx(tx *gorm.DB, bindingID string, since int64, pendingOnly bool) (int64, error) {
	query := tx.Model(&PartnerOAuthPaymentOrder{}).Where("binding_id = ? AND created_at >= ?", bindingID, since)
	if pendingOnly {
		// A subquery keeps both table names under GORM's naming strategy.
		pending := tx.Model(&TopUp{}).Select("id").Where("status = ?", common.TopUpStatusPending)
		query = query.Where("top_up_id IN (?)", pending)
	}
	var count int64
	err := query.Count(&count).Error
	return count, err
}

// GetPartnerOAuthPaymentReturnURL returns the partner return URL registered
// for a top-up, or "" when the order has none or was not placed by a partner.
func GetPartnerOAuthPaymentReturnURL(topUpID int) string {
	var order PartnerOAuthPaymentOrder
	if err := DB.Select("return_url").Where("top_up_id = ?", topUpID).First(&order).Error; err != nil {
		return ""
	}
	return order.ReturnURL
}
