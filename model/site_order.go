package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"

	"gorm.io/gorm"
)

// PaymentReceipt contains only verified, non-secret display metadata.
// It never participates in settlement or changes the amount of wallet credit.
type PaymentReceipt struct {
	ReceiptCurrency string `json:"currency" gorm:"type:varchar(8)"`
	ReceiptAmount   string `json:"payment_amount" gorm:"type:varchar(64)"`
	ReceiptTradeNo  string `json:"receipt_trade_no" gorm:"type:varchar(255)"`
}

// RecordPaymentReceipt must only be called after the provider signature and
// successful-payment state have been verified. Retries may fill missing metadata;
// conflicting transaction IDs cannot replace an existing receipt.
func RecordPaymentReceipt(tradeNo, provider, transaction, currency, amount string, subscription bool) error {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if len(currency) != 3 || currency[0] < 'A' || currency[0] > 'Z' || currency[1] < 'A' || currency[1] > 'Z' || currency[2] < 'A' || currency[2] > 'Z' || len(transaction) > 255 {
		return errors.New("invalid payment receipt")
	}
	if len(amount) > 64 {
		return errors.New("invalid receipt amount")
	}
	value, err := decimal.NewFromString(amount)
	if err != nil || value.IsNegative() || value.Exponent() < -8 || value.Exponent() > 12 || value.GreaterThan(decimal.NewFromInt(9007199254740991)) {
		return errors.New("invalid receipt amount")
	}
	var target any = &TopUp{}
	if subscription {
		target = &SubscriptionOrder{}
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var current struct {
			PaymentReceipt
			Status string
		}
		if err := lockForUpdate(tx.Model(target)).Where("trade_no = ? AND payment_provider = ?", tradeNo, provider).First(&current).Error; err != nil {
			return err
		}
		if current.Status != common.TopUpStatusSuccess {
			return errors.New("payment receipt requires a completed order")
		}
		if current.ReceiptTradeNo != "" && transaction != "" && current.ReceiptTradeNo != transaction {
			return errors.New("conflicting payment transaction")
		}
		if current.ReceiptCurrency != "" && (current.ReceiptCurrency != currency || current.ReceiptAmount != value.String()) {
			return errors.New("conflicting payment amount")
		}
		updates := map[string]any{"receipt_currency": currency, "receipt_amount": value.String()}
		if transaction != "" {
			updates["receipt_trade_no"] = transaction
		}
		return tx.Model(target).Where("trade_no = ? AND payment_provider = ?", tradeNo, provider).Updates(updates).Error
	})
}

// SiteOrder is a read-only projection. Payment credentials never enter this DTO.
type SiteOrder struct {
	DirectPaymentLifecycle
	NextCheckAt      int64  `json:"next_check_at"`
	Currency         string `json:"currency" gorm:"-"`
	PaymentAmount    string `json:"payment_amount" gorm:"-"`
	TopUp            `gorm:"embedded"`
	OrderType        string `json:"order_type"`
	Username         string `json:"username"`
	OrderStatus      string `json:"order_status"`
	ProviderTradeNo  string `json:"provider_trade_no"`
	AmountFen        *int64 `json:"amount_fen"`
	FrozenQuota      *int64 `json:"frozen_quota"`
	Sandbox          bool   `json:"sandbox"`
	CancelRequested  bool   `json:"cancel_requested"`
	CachePending     bool   `json:"cache_pending"`
	LastError        string `json:"last_error"`
	ExpiresAt        int64  `json:"expires_at"`
	LastCheckAt      int64  `json:"last_check_at" gorm:"-"`
	LastCheckSuccess *bool  `json:"last_check_success" gorm:"-"`
}

type SiteOrderFilter struct {
	ExcludeClosed bool   `form:"-"`
	Actionable    bool   `form:"actionable"`
	OwnerID       int    `form:"-"`
	ID            int    `form:"-"`
	Keyword       string `form:"keyword" binding:"max=128"`
	User          string `form:"user" binding:"max=64"`
	Provider      string `form:"provider" binding:"max=50"`
	Status        string `form:"status" binding:"omitempty,oneof=pending paid success expired failed"`
	Start         int64  `form:"start" binding:"min=0"`
	End           int64  `form:"end" binding:"min=0"`
	Page          int    `form:"p" binding:"min=1,max=1000000"`
	PageSize      int    `form:"page_size" binding:"min=1,max=100"`
}

func ListSiteOrders(filter SiteOrderFilter) ([]SiteOrder, int64, error) {
	name := DB.NamingStrategy.TableName
	// Subscription IDs occupy the negative namespace in this read-only projection.
	// This keeps existing top-up URLs stable and avoids collisions across tables.
	// Successful subscription history rows are excluded: the subscription is authoritative.
	topups := DB.Table(name("TopUp")+" AS t").
		Select("t.id, t.user_id, t.amount, t.money, t.trade_no, t.payment_method, t.payment_provider, t.create_time, t.complete_time, t.status, t.receipt_currency, t.receipt_amount, t.receipt_trade_no, ? AS order_type", "topup").
		Where("NOT EXISTS (?)", DB.Table(name("SubscriptionOrder")+" AS s").Select("1").Where("s.trade_no = t.trade_no"))
	subscriptions := DB.Table(name("SubscriptionOrder")+" AS s").
		Select("-s.id AS id, s.user_id, 0 AS amount, s.money, s.trade_no, s.payment_method, s.payment_provider, s.create_time, s.complete_time, s.status, s.receipt_currency, s.receipt_amount, s.receipt_trade_no, ? AS order_type", "subscription")
	query := DB.Table("(? UNION ALL ?) AS t", topups, subscriptions).
		Joins("LEFT JOIN "+name("User")+" AS u ON u.id = t.user_id").
		Joins("LEFT JOIN "+name("AlipayOrder")+" AS a ON a.trade_no = t.trade_no AND t.payment_provider = ?", PaymentProviderAlipay).
		Joins("LEFT JOIN "+name("WechatPayOrder")+" AS w ON w.trade_no = t.trade_no AND t.payment_provider = ?", PaymentProviderWechatPay).
		Joins("LEFT JOIN " + name("AlipayConfig") + " AS ac ON ac.id = a.config_id")
	if filter.OwnerID > 0 {
		query = query.Where("t.user_id = ?", filter.OwnerID)
	}
	if filter.ID != 0 {
		query = query.Where("t.id = ?", filter.ID)
	}
	if filter.Keyword != "" {
		query = query.Where("(t.trade_no = ? OR a.provider_trade_no = ? OR w.provider_trade_no = ? OR t.receipt_trade_no = ?)", filter.Keyword, filter.Keyword, filter.Keyword, filter.Keyword)
	}
	if filter.User != "" {
		id, _ := strconv.Atoi(filter.User)
		query = query.Where("(u.username = ? OR t.user_id = ?)", filter.User, id)
	}
	if filter.Provider != "" {
		query = query.Where("t.payment_provider = ?", filter.Provider)
	}
	if filter.Status != "" {
		query = query.Where("COALESCE(a.status, w.status, t.status) = ?", filter.Status)
	}
	if filter.ExcludeClosed {
		query = query.Where("COALESCE(a.status, w.status, t.status) <> ?", common.TopUpStatusExpired)
	}
	if filter.Actionable {
		query = query.Where("t.payment_provider IN ? AND COALESCE(a.status, w.status, t.status) = ? AND COALESCE(a.cancel_requested, w.cancel_requested, ?) = ? AND COALESCE(a.review_required, w.review_required, ?) = ? AND COALESCE(a.expires_at, w.expires_at, 0) > ?", []string{PaymentProviderAlipay, PaymentProviderWechatPay}, common.TopUpStatusPending, false, false, false, false, common.GetTimestamp())
	}
	if filter.Start > 0 {
		query = query.Where("t.create_time >= ?", filter.Start)
	}
	if filter.End > 0 {
		query = query.Where("t.create_time <= ?", filter.End)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	orders := make([]SiteOrder, 0)
	err := query.Select("t.*, COALESCE(u.username, '') AS username, COALESCE(a.status, w.status, t.status) AS order_status, COALESCE(NULLIF(a.provider_trade_no, ''), NULLIF(w.provider_trade_no, ''), t.receipt_trade_no, '') AS provider_trade_no, COALESCE(a.amount_fen, w.amount_fen) AS amount_fen, COALESCE(a.credited_quota, w.credited_quota) AS frozen_quota, COALESCE(ac.sandbox, ?) AS sandbox, COALESCE(a.cache_pending, w.cache_pending, ?) AS cache_pending, COALESCE(a.cancel_requested, w.cancel_requested, ?) AS cancel_requested, COALESCE(a.last_error, w.last_error, '') AS last_error, COALESCE(a.expires_at, w.expires_at, 0) AS expires_at, COALESCE(a.closed_at, w.closed_at, 0) AS closed_at, COALESCE(a.close_requested_at, w.close_requested_at, 0) AS close_requested_at, COALESCE(a.close_reason, w.close_reason, '') AS close_reason, COALESCE(a.gateway_status, w.gateway_status, '') AS gateway_status, COALESCE(a.checked_at, w.checked_at, 0) AS checked_at, COALESCE(a.next_check_at, w.next_check_at, 0) AS next_check_at, COALESCE(a.retry_count, w.retry_count, 0) AS retry_count, COALESCE(a.review_required, w.review_required, ?) AS review_required", false, false, false, false).
		Order("t.create_time DESC, t.id DESC").Offset((filter.Page - 1) * filter.PageSize).Limit(filter.PageSize).Scan(&orders).Error
	for i := range orders {
		orders[i].Currency = orders[i].PaymentReceipt.ReceiptCurrency
		orders[i].PaymentAmount = orders[i].PaymentReceipt.ReceiptAmount
	}
	return orders, total, err
}

func GetSiteOrder(id int) (*SiteOrder, error) {
	orders, _, err := ListSiteOrders(SiteOrderFilter{ID: id, Page: 1, PageSize: 1})
	if err != nil {
		return nil, err
	}
	if len(orders) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	order := &orders[0]
	var audit AuditLog
	// Audit lives in the separately configured log database; no cross-database JOIN.
	if LOG_DB == nil {
		return nil, errors.New("audit database unavailable")
	}
	err = LOG_DB.Table("audit_logs").Select("created_at", "success").Where("action IN ? AND content = ?", []string{"payment.order.recheck", "payment.order.recover"}, order.TradeNo).Order("created_at DESC, id DESC").First(&audit).Error
	if err == nil {
		order.LastCheckAt = audit.CreatedAt
		order.LastCheckSuccess = &audit.Success
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return order, nil
}
