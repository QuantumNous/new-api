package model

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// PaymentReview is an append-only audit of notes and explicit financial dispositions.
type PaymentReview struct {
	Action    string `json:"action" gorm:"type:varchar(24)"`
	Reference string `json:"reference" gorm:"type:varchar(128)"`
	Snapshot  string `json:"-" gorm:"type:varchar(64)"`
	ID        int64  `json:"id"`
	TradeNo   string `json:"-" gorm:"type:varchar(64);index:idx_payment_review_order,priority:1"`
	Provider  string `json:"-" gorm:"type:varchar(24);index:idx_payment_review_order,priority:2"`
	ActorID   int    `json:"actor_id"`
	Note      string `json:"note" gorm:"type:text"`
	CreatedAt int64  `json:"created_at"`
}

func RecordPaymentReview(order *SiteOrder, actorID int, note string) error {
	note = strings.TrimSpace(note)
	if actorID <= 0 || utf8.RuneCountInString(note) < 5 || utf8.RuneCountInString(note) > 500 {
		return errors.New("invalid payment review")
	}
	var target any
	switch order.PaymentProvider {
	case PaymentProviderAlipay:
		target = &AlipayOrder{}
	case PaymentProviderWechatPay:
		target = &WechatPayOrder{}
	case PaymentProviderMixPay:
		target = &MixPayOrder{}
	case PaymentProviderWebMoney:
		target = &WebMoneyOrder{}
	case PaymentProviderAntom:
		target = &AntomOrder{}
	default:
		return ErrPaymentMethodMismatch
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var current struct{ ReviewRequired bool }
		if err := lockForUpdate(tx.Model(target)).Where("trade_no = ?", order.TradeNo).Take(&current).Error; err != nil {
			return err
		}
		if !current.ReviewRequired {
			return errors.New("payment does not require review")
		}
		return tx.Create(&PaymentReview{TradeNo: order.TradeNo, Provider: order.PaymentProvider, ActorID: actorID, Note: note, CreatedAt: common.GetTimestamp()}).Error
	})
}

// The fingerprint deliberately excludes polling times and cache retries. A change
// in financial evidence reopens the review instead of hiding it behind an old decision.
func paymentReviewSnapshot(o *SiteOrder) string {
	data, _ := common.Marshal([]any{o.TradeNo, o.PaymentProvider, o.UserId, o.OrderStatus, o.Status, o.ProviderTradeNo, o.GatewayStatus, o.LastError, o.FrozenQuota, o.Currency, o.PaymentAmount, o.AmountFen, o.PaymentReceipt, o.CancelRequested, o.CancellationState})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}

func populatePaymentReviewResolutions(db *gorm.DB, orders []SiteOrder) error {
	if len(orders) == 0 {
		return nil
	}
	trades := make([]string, 0, len(orders))
	for _, o := range orders {
		trades = append(trades, o.TradeNo)
	}
	var reviews []PaymentReview
	latest := db.Model(&PaymentReview{}).Select("MAX(id)").Where("trade_no IN ? AND action <> ?", trades, "").Group("trade_no, provider")
	if err := db.Where("id IN (?)", latest).Find(&reviews).Error; err != nil {
		return err
	}
	byOrder := make(map[string]PaymentReview, len(reviews))
	for _, r := range reviews {
		byOrder[r.Provider+":"+r.TradeNo] = r
	}
	for i := range orders {
		o := &orders[i]
		r := byOrder[o.PaymentProvider+":"+o.TradeNo]
		snapshot := paymentReviewSnapshot(o)
		o.ReviewVersion = fmt.Sprintf("%s:%d", snapshot, r.ID)
		if r.Action != "" && r.Snapshot == snapshot {
			o.ReviewResolution = r.Action
		}
	}
	return nil
}

// ResolvePaymentReview keeps the financial hold for non-fulfillment dispositions.
// Review history, fulfillment and the balance/entitlement change commit together.
func ResolvePaymentReview(order *SiteOrder, actorID int, action, note, reference, version string) error {
	note, reference = strings.TrimSpace(note), strings.TrimSpace(reference)
	if actorID <= 0 || utf8.RuneCountInString(note) < 5 || utf8.RuneCountInString(note) > 500 || len(reference) > 128 || (action == "refunded" && reference == "") {
		return errors.New("invalid payment review")
	}
	if action != "fulfill" && action != "refunded" && action != "acknowledged" {
		return errors.New("invalid review action")
	}
	var payment any
	switch order.PaymentProvider {
	case PaymentProviderAntom:
		payment = &AntomOrder{}
	case PaymentProviderWebMoney:
		payment = &WebMoneyOrder{}
	case PaymentProviderMixPay:
		payment = &MixPayOrder{}
	case PaymentProviderAlipay:
		payment = &AlipayOrder{}
	case PaymentProviderWechatPay:
		payment = &WechatPayOrder{}
	default:
		return ErrPaymentMethodMismatch
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Match each provider's settlement lock order.
		directTopUp := order.OrderType != "subscription" && (order.PaymentProvider == PaymentProviderAlipay || order.PaymentProvider == PaymentProviderWechatPay)
		if !directTopUp {
			if err := lockSubscriptionBuyer(tx, order.UserId); err != nil {
				return err
			}
		}
		var evidence struct {
			Status         string
			ReviewRequired bool
			UserID         int
			VerifiedAt     int64
		}
		if err := lockForUpdate(tx.Model(payment)).Select("*").Where("trade_no = ?", order.TradeNo).Take(&evidence).Error; err != nil {
			return err
		}
		var business any = &TopUp{}
		if order.OrderType == "subscription" {
			business = &SubscriptionOrder{}
		}
		var locked struct {
			UserId          int
			PaymentProvider string
			CompleteTime    int64
		}
		if err := lockForUpdate(tx.Model(business)).Where("trade_no = ?", order.TradeNo).Take(&locked).Error; err != nil {
			return err
		}
		if locked.UserId != order.UserId || evidence.UserID != order.UserId || locked.PaymentProvider != order.PaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if directTopUp {
			if err := lockSubscriptionBuyer(tx, order.UserId); err != nil {
				return err
			}
		}
		current, _, err := listSiteOrders(tx, SiteOrderFilter{ID: order.Id, Page: 1, PageSize: 1})
		if err != nil {
			return err
		}
		if len(current) != 1 {
			return gorm.ErrRecordNotFound
		}
		o := &current[0]
		if o.ReviewResolution != "" {
			return errors.New("review already resolved")
		}
		if version == "" || version != o.ReviewVersion {
			return errors.New("payment changed; reload before resolving")
		}
		if !o.ReviewRequired {
			return errors.New("payment does not require review")
		}
		if action == "fulfill" {
			var refunds int64
			if err := tx.Model(&PaymentReview{}).Where("trade_no = ? AND provider = ? AND action = ?", o.TradeNo, o.PaymentProvider, "refunded").Count(&refunds).Error; err != nil {
				return err
			}
			if refunds > 0 || o.CancelRequested {
				return ErrPaymentReviewRequired
			}
			if evidence.Status != "paid" || o.ProviderTradeNo == "" || locked.CompleteTime != 0 || (o.Status != "pending" && o.Status != "expired" && o.Status != SubscriptionOrderPaidReview) {
				return ErrTopUpStatusInvalid
			}
			// Contradictory/refunded evidence must never be overridden by a manual credit.
			validGateway := o.GatewayStatus == "SUCCESS" || o.GatewayStatus == "success" || o.GatewayStatus == "TRADE_SUCCESS" || o.GatewayStatus == "TRADE_FINISHED"
			if !validGateway || (o.LastError != "" && o.LastError != "subscription_conflict" && o.LastError != "credit_pending") || (o.PaymentProvider == PaymentProviderMixPay && evidence.VerifiedAt == 0) {
				return ErrPaymentReviewRequired
			}
			var buyer User
			if err := tx.First(&buyer, o.UserId).Error; err != nil {
				return err
			}
			if buyer.Status != common.UserStatusEnabled {
				return errors.New("payment buyer unavailable")
			}
			receipt := PaymentReceipt{ReceiptTradeNo: o.ProviderTradeNo, ReceiptCurrency: o.Currency, ReceiptAmount: o.PaymentAmount}
			if o.AmountFen != nil {
				receipt.ReceiptCurrency = "CNY"
				receipt.ReceiptAmount = decimal.NewFromInt(*o.AmountFen).Div(decimal.NewFromInt(100)).StringFixed(2)
			}
			updates := map[string]any{"status": "success", "review_required": false, "last_error": "", "next_check_at": 0}
			if o.OrderType == "subscription" {
				var sub SubscriptionOrder
				if err := tx.Where("trade_no = ?", o.TradeNo).First(&sub).Error; err != nil {
					return err
				}
				var plan SubscriptionPlan
				if common.UnmarshalJsonStr(sub.ProviderPayload, &plan) != nil || plan.Id != sub.PlanId {
					return errors.New("invalid subscription snapshot")
				}
				if _, err := createUserSubscriptionFromPlanTx(tx, o.UserId, &plan, "order"); err != nil {
					return err
				}
			} else {
				if o.FrozenQuota == nil || *o.FrozenQuota <= 0 || *o.FrozenQuota > common.MaxWalletQuota || buyer.AlipayCredit < 0 || buyer.AlipayCredit > common.MaxWalletQuota-*o.FrozenQuota {
					return ErrInvalidTopUpQuota
				}
				sequence := buyer.AlipayCredit + *o.FrozenQuota
				if err := creditTopUpQuota(tx, o.UserId, int(*o.FrozenQuota), map[string]any{"alipay_credit": sequence}); err != nil {
					return err
				}
				updates["credit_sequence"] = sequence
				updates["cache_pending"] = true
			}
			if o.PaymentProvider == PaymentProviderMixPay {
				updates["cache_pending"] = true
			}
			if o.PaymentProvider == PaymentProviderMixPay || (o.OrderType != "subscription" && (o.PaymentProvider == PaymentProviderAntom || o.PaymentProvider == PaymentProviderWebMoney)) {
				updates["log_pending"] = true
			}
			if err := tx.Model(business).Where("trade_no = ?", o.TradeNo).Updates(map[string]any{"status": "success", "complete_time": common.GetTimestamp(), "receipt_trade_no": receipt.ReceiptTradeNo, "receipt_currency": receipt.ReceiptCurrency, "receipt_amount": receipt.ReceiptAmount}).Error; err != nil {
				return err
			}
			if err := tx.Model(payment).Where("trade_no = ?", o.TradeNo).Updates(updates).Error; err != nil {
				return err
			}
		}
		if action != "fulfill" && o.Status != common.TopUpStatusSuccess {
			if err := tx.Model(business).Where("trade_no = ?", o.TradeNo).Update("status", PaymentOrderReviewClosed).Error; err != nil {
				return err
			}
		}

		updated, _, err := listSiteOrders(tx, SiteOrderFilter{ID: order.Id, Page: 1, PageSize: 1})
		if err != nil {
			return err
		}
		if len(updated) != 1 {
			return gorm.ErrRecordNotFound
		}
		return tx.Create(&PaymentReview{TradeNo: o.TradeNo, Provider: o.PaymentProvider, ActorID: actorID, Note: note, Action: action, Reference: reference, Snapshot: paymentReviewSnapshot(&updated[0]), CreatedAt: common.GetTimestamp()}).Error
	})
	if err == nil && action == "fulfill" && order.OrderType == "subscription" {
		refreshSubscriptionUserGroupCache(order.UserId, "manual payment fulfillment")
	}
	return err
}
