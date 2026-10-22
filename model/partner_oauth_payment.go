package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var (
	ErrPartnerOAuthPaymentOrderNotFound   = errors.New("partner oauth payment order not found")
	ErrPartnerOAuthPaymentIdempotencyRace = errors.New("partner oauth payment idempotency key already used")
)

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
// the partner link together. A concurrent request that already used the same
// idempotency key returns ErrPartnerOAuthPaymentIdempotencyRace and leaves no
// orphan top-up behind.
func CreatePartnerOAuthPaymentOrder(order *PartnerOAuthPaymentOrder, topUp *TopUp, baseQuota int, metadata CashbackRequestMetadata) error {
	if order == nil || topUp == nil || order.BindingId == "" || order.IdempotencyKeyHash == "" {
		return errors.New("invalid partner oauth payment order")
	}
	metadata.IneligibleReason = CashbackIneligiblePartnerOAuth
	err := DB.Transaction(func(tx *gorm.DB) error {
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

// CountPartnerOAuthPaymentOrders counts a binding's orders created at or after
// since; pendingOnly restricts the count to orders still awaiting payment.
func CountPartnerOAuthPaymentOrders(bindingID string, since int64, pendingOnly bool) (int64, error) {
	query := DB.Model(&PartnerOAuthPaymentOrder{}).Where("binding_id = ? AND created_at >= ?", bindingID, since)
	if pendingOnly {
		// A subquery keeps both table names under GORM's naming strategy.
		pending := DB.Model(&TopUp{}).Select("id").Where("status = ?", common.TopUpStatusPending)
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
