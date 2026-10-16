package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const PaymentProviderMixPay = "mixpay"
const PaymentMethodMixPay = "mixpay"

// Config revisions and order snapshots are retained for payments still in flight.
type MixPayConfig struct {
	ID                int    `json:"id"`
	Enabled           bool   `json:"enabled"`
	PayeeID           string `json:"payee_id" gorm:"type:varchar(64)"`
	SettlementAssetID string `json:"settlement_asset_id" gorm:"type:varchar(64)"`
	StrictMode        bool   `json:"strict_mode"`
	NotifyBaseURL     string `json:"notify_base_url" gorm:"type:varchar(512)"`
	ReturnURL         string `json:"return_url" gorm:"type:varchar(512)"`
	MinTopUp          int64  `json:"min_topup"`
	TTLSeconds        int64  `json:"ttl_seconds"`
	CreatedAt         int64  `json:"created_at"`
}

type MixPayOrder struct {
	ID                int    `json:"id"`
	TradeNo           string `json:"trade_no" gorm:"type:varchar(36);uniqueIndex"`
	TraceID           string `json:"trace_id" gorm:"type:varchar(36);uniqueIndex"`
	UserID            int    `json:"-" gorm:"uniqueIndex:idx_mixpay_request,priority:1;index"`
	RequestKey        string `json:"-" gorm:"type:varchar(64);uniqueIndex:idx_mixpay_request,priority:2"`
	RequestedAmount   int64  `json:"-"`
	PlanID            int    `json:"-"`
	ConfigID          int    `json:"-"`
	PayeeID           string `json:"-" gorm:"type:varchar(64)"`
	QuoteAmount       string `json:"amount" gorm:"type:varchar(64)"`
	QuoteAssetID      string `json:"currency" gorm:"type:varchar(64)"`
	SettlementAssetID string `json:"-" gorm:"type:varchar(64)"`
	StrictMode        bool   `json:"-"`
	CallbackURL       string `json:"-" gorm:"type:varchar(512)"`
	ReturnURL         string `json:"-" gorm:"type:varchar(512)"`
	CreditedQuota     int    `json:"credited_quota"`
	Code              string `json:"-" gorm:"type:varchar(64)"`
	CreationState     string `json:"creation_state" gorm:"type:varchar(24)"`
	Status            string `json:"status" gorm:"type:varchar(24);index"`
	GatewayStatus     string `json:"gateway_status" gorm:"type:varchar(32)"`
	FailureCode       string `json:"failure_code" gorm:"type:varchar(32)"`
	SettleStatus      string `json:"settle_status" gorm:"type:varchar(24)"`
	SettleAmount      string `json:"settle_amount" gorm:"type:varchar(64)"`
	SettleAsset       string `json:"settle_asset" gorm:"type:varchar(64)"`
	CreatedAt         int64  `json:"created_at"`
	ExpiresAt         int64  `json:"expires_at"`
	VerifiedAt        int64  `json:"verified_at"`
	CheckedAt         int64  `json:"checked_at"`
	NextCheckAt       int64  `json:"-" gorm:"index"`
	LeaseUntil        int64  `json:"-"`
	LeaseToken        string `json:"-" gorm:"type:varchar(36)"`
	WakeVersion       int64  `json:"-"`
	RetryCount        int    `json:"-"`
	LastError         string `json:"last_error" gorm:"type:varchar(64)"`
	ReviewRequired    bool   `json:"review_required"`
	CachePending      bool   `json:"-"`
	LogPending        bool   `json:"-"`
	CreditSequence    int64  `json:"-"`
}

// A single paced budget is shared by all instances and all MixPay operations.
// A 1500ms gap limits sustained traffic to 40/minute, below the documented 60.
type MixPayRequestBudget struct {
	ID     int `gorm:"primaryKey;autoIncrement:false"`
	NextAt int64
}

func CurrentMixPayConfig() (*MixPayConfig, error) {
	var c MixPayConfig
	err := DB.Order("id DESC").First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &MixPayConfig{StrictMode: true, MinTopUp: 1, TTLSeconds: 900}, nil
	}
	return &c, err
}

func GetMixPayOrder(trade string) (*MixPayOrder, error) {
	var o MixPayOrder
	err := DB.Where("trade_no = ?", trade).First(&o).Error
	return &o, err
}

func FindMixPayRequest(userID int, key string) (*MixPayOrder, error) {
	var o MixPayOrder
	err := DB.Where("user_id = ? AND request_key = ?", userID, key).First(&o).Error
	return &o, err
}

func CreateMixPayOrder(o *MixPayOrder, topup *TopUp, sub *SubscriptionOrder, plan *SubscriptionPlan) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		// Also serializes per-user outstanding-order limits and subscription reservations.
		if err := lockSubscriptionBuyer(tx, o.UserID); err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&MixPayOrder{}).Where("user_id = ? AND status IN ?", o.UserID, []string{"pending", "paid"}).Count(&count).Error; err != nil {
			return err
		}
		if count >= 10 {
			return errors.New("too many pending payment orders")
		}
		if sub != nil {
			if err := checkSubscriptionEligibilityTx(tx, o.UserID, plan); err != nil {
				return err
			}
			if err := checkSubscriptionReservationTx(tx, o.UserID, plan); err != nil {
				return err
			}
			payload, err := common.Marshal(plan)
			if err != nil {
				return err
			}
			sub.ProviderPayload = string(payload)
			if err := tx.Create(sub).Error; err != nil {
				return err
			}
		} else if err := tx.Create(topup).Error; err != nil {
			return err
		}
		return tx.Create(o).Error
	})
}

func ClaimMixPayRequest() (bool, error) {
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&MixPayRequestBudget{ID: 1}).Error; err != nil {
		return false, err
	}
	now := time.Now().UnixMilli()
	r := DB.Model(&MixPayRequestBudget{}).Where("id = 1 AND next_at <= ?", now).Update("next_at", now+1500)
	return r.RowsAffected == 1, r.Error
}

func DeferMixPayRequests() error {
	next := time.Now().Add(time.Minute).UnixMilli()
	return DB.Model(&MixPayRequestBudget{}).Where("id = 1 AND next_at < ?", next).Update("next_at", next).Error
}

func ClaimMixPayOrder(trade string) (*MixPayOrder, error) {
	now := common.GetTimestamp()
	token := uuid.NewString()
	r := DB.Model(&MixPayOrder{}).Where("trade_no = ? AND lease_until <= ?", trade, now).Updates(map[string]any{"lease_until": now + 60, "lease_token": token})
	if r.Error != nil {
		return nil, r.Error
	}
	if r.RowsAffected != 1 {
		return nil, nil
	}
	return GetMixPayOrder(trade)
}

func WakeMixPayOrder(trade string) error {
	return DB.Model(&MixPayOrder{}).Where("trade_no = ?", trade).Updates(map[string]any{"next_check_at": common.GetTimestamp(), "wake_version": gorm.Expr("wake_version + 1")}).Error
}

func FinishMixPayCheck(o *MixPayOrder, checkErr error) error {
	now := common.GetTimestamp()
	delay := int64(30)
	retries := 0
	last := ""
	if checkErr != nil {
		retries = min(o.RetryCount+1, 8)
		delay = min(int64(15)<<uint(retries-1), 300)
		last = "payment_check_pending"
	}
	if now-o.CreatedAt > 3600 {
		delay = max(delay, 300)
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var current MixPayOrder
		if err := lockForUpdate(tx).Where("id = ? AND lease_token = ?", o.ID, o.LeaseToken).First(&current).Error; err != nil {
			return err
		}
		next := now + delay
		if current.WakeVersion != o.WakeVersion {
			next = now
		}
		if current.Status == "pending" && current.Code == "" && (current.CreationState == "uncertain" || current.CreationState == "recovering") {
			last = "checkout_recovery_pending"
		}
		if current.ReviewRequired {
			next = now + 300
			last = current.LastError
		}
		if (current.Status == "failed" || (current.Status == "success" && current.SettleStatus == "success")) && !current.CachePending && !current.LogPending {
			next = 0
		}
		return tx.Model(&current).Updates(map[string]any{"lease_until": 0, "lease_token": "", "checked_at": now, "next_check_at": next, "retry_count": retries, "last_error": last}).Error
	})
}

// SaveMixPayResult accepts only service-verified evidence and fences stale workers.
func SaveMixPayResult(o *MixPayOrder, status, failure, settleStatus, settleAmount, settleAsset string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var current MixPayOrder
		if err := lockForUpdate(tx).Where("id = ? AND lease_token = ? AND lease_until > ?", o.ID, o.LeaseToken, common.GetTimestamp()).First(&current).Error; err != nil {
			return err
		}
		terminal := current.GatewayStatus == "success" || current.GatewayStatus == "failed"
		if terminal && status != current.GatewayStatus {
			if status == "success" || status == "failed" {
				return tx.Model(&current).Updates(map[string]any{"review_required": true, "last_error": "conflicting_payment_result"}).Error
			}
			return nil
		}
		updates := map[string]any{"gateway_status": status, "failure_code": failure}
		if settleStatus != "" && current.SettleStatus != "success" {
			updates["settle_status"] = settleStatus
			updates["settle_amount"] = settleAmount
			updates["settle_asset"] = settleAsset
		}
		if status == "success" && current.Status == "pending" {
			updates["status"] = "paid"
			updates["verified_at"] = common.GetTimestamp()
		}
		if status == "failed" && current.Status == "pending" {
			updates["status"] = "failed"
			var target any = &TopUp{}
			if current.PlanID > 0 {
				target = &SubscriptionOrder{}
			}
			if err := tx.Model(target).Where("trade_no = ? AND payment_provider = ? AND status = ?", current.TradeNo, PaymentProviderMixPay, common.TopUpStatusPending).Update("status", "failed").Error; err != nil {
				return err
			}
		}
		return tx.Model(&current).Updates(updates).Error
	})
}

// CompleteMixPayOrder locks the buyer before the order for consistency with
// subscription purchases. A durable paid result survives all fulfillment errors.
func CompleteMixPayOrder(trade string) error {
	initial, err := GetMixPayOrder(trade)
	if err != nil {
		return err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := lockSubscriptionBuyer(tx, initial.UserID); err != nil {
			return err
		}
		var buyer User
		if err := tx.First(&buyer, initial.UserID).Error; err != nil {
			return err
		}
		if buyer.Status != common.UserStatusEnabled {
			return errors.New("payment buyer unavailable")
		}
		var o MixPayOrder
		if err := lockForUpdate(tx).Where("id = ?", initial.ID).First(&o).Error; err != nil {
			return err
		}
		if o.Status == "success" {
			return nil
		}
		if o.Status != "paid" || o.VerifiedAt == 0 || o.GatewayStatus != "success" || o.ReviewRequired {
			return ErrTopUpStatusInvalid
		}
		receipt := PaymentReceipt{ReceiptCurrency: "USD", ReceiptAmount: o.QuoteAmount, ReceiptTradeNo: o.TraceID}
		updates := map[string]any{"status": "success", "cache_pending": true, "log_pending": true, "last_error": ""}
		if o.PlanID > 0 {
			var sub SubscriptionOrder
			if err := lockForUpdate(tx).Where("trade_no = ?", trade).First(&sub).Error; err != nil {
				return err
			}
			if sub.UserId != o.UserID || sub.PaymentProvider != PaymentProviderMixPay || sub.Status != common.TopUpStatusPending {
				return ErrPaymentMethodMismatch
			}
			var plan SubscriptionPlan
			if common.UnmarshalJsonStr(sub.ProviderPayload, &plan) != nil || plan.Id != o.PlanID {
				return errors.New("invalid subscription snapshot")
			}
			if err := checkSubscriptionEligibilityTx(tx, o.UserID, &plan); err != nil {
				if !errors.Is(err, ErrActiveSubscriptionExists) && !errors.Is(err, ErrSubscriptionPurchaseLimit) {
					return err
				}
				sub.Status = SubscriptionOrderPaidReview
				sub.PaymentReceipt = receipt
				if err := tx.Save(&sub).Error; err != nil {
					return err
				}
				return tx.Model(&o).Updates(map[string]any{"review_required": true, "last_error": "subscription_conflict"}).Error
			}
			if _, err := createUserSubscriptionFromPlanTx(tx, o.UserID, &plan, "order"); err != nil {
				return err
			}
			sub.Status = common.TopUpStatusSuccess
			sub.CompleteTime = common.GetTimestamp()
			sub.PaymentReceipt = receipt
			if err := tx.Save(&sub).Error; err != nil {
				return err
			}
		} else {
			var top TopUp
			if err := lockForUpdate(tx).Where("trade_no = ?", trade).First(&top).Error; err != nil {
				return err
			}
			if top.UserId != o.UserID || top.PaymentProvider != PaymentProviderMixPay || top.Status != common.TopUpStatusPending || top.CompleteTime != 0 {
				return ErrPaymentMethodMismatch
			}
			var user User
			if err := tx.First(&user, o.UserID).Error; err != nil {
				return err
			}
			if o.CreditedQuota <= 0 || user.AlipayCredit < 0 || user.AlipayCredit > common.MaxWalletQuota-int64(o.CreditedQuota) {
				return ErrInvalidTopUpQuota
			}
			sequence := user.AlipayCredit + int64(o.CreditedQuota)
			if err := creditTopUpQuota(tx, o.UserID, o.CreditedQuota, map[string]any{"alipay_credit": sequence}); err != nil {
				return err
			}
			updates["credit_sequence"] = sequence
			top.Status = common.TopUpStatusSuccess
			top.CompleteTime = common.GetTimestamp()
			top.PaymentReceipt = receipt
			if err := tx.Save(&top).Error; err != nil {
				return err
			}
		}
		return tx.Model(&o).Where("status = ?", "paid").Updates(updates).Error
	})
	if err != nil {
		return err
	}
	return SyncMixPayFulfillment(trade)
}

func SyncMixPayFulfillment(trade string) error {
	o, err := GetMixPayOrder(trade)
	if err != nil {
		return err
	}
	if o.Status != "success" {
		return nil
	}
	if o.CachePending {
		if o.PlanID > 0 {
			err = RefreshUserGroupCache(o.UserID)
		} else {
			err = syncDirectPaymentQuotaCache(o.UserID, o.CreditSequence)
		}
		if err != nil {
			return err
		}
		if err = DB.Model(o).Update("cache_pending", false).Error; err != nil {
			return err
		}
	}
	if o.LogPending {
		if LOG_DB == nil {
			return errors.New("audit database unavailable")
		}
		// At-least-once diagnostic delivery. The main DB order is the credit ledger.
		entry := Log{UserId: o.UserID, CreatedAt: common.GetTimestamp(), Type: LogTypeTopup, RequestId: "mixpay:" + trade, Content: fmt.Sprintf("MixPay order %s fulfilled (USD %s)", trade, o.QuoteAmount)}
		if err := createLog(&entry); err != nil {
			return err
		}
		return DB.Model(o).Update("log_pending", false).Error
	}
	return nil
}

func RejectUnsentMixPayOrder(o *MixPayOrder) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		r := tx.Model(&MixPayOrder{}).Where("id = ? AND lease_token = ? AND creation_state = ?", o.ID, o.LeaseToken, "queued").Updates(map[string]any{"creation_state": "rejected", "status": "failed"})
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return ErrTopUpStatusInvalid
		}
		var target any = &TopUp{}
		if o.PlanID > 0 {
			target = &SubscriptionOrder{}
		}
		return tx.Model(target).Where("trade_no = ? AND payment_provider = ? AND status = ?", o.TradeNo, PaymentProviderMixPay, common.TopUpStatusPending).Update("status", "failed").Error
	})
}

func PopulateMixPayTopUpQuotas(topups []*TopUp) error {
	var trades []string
	for _, t := range topups {
		if t.PaymentProvider == PaymentProviderMixPay {
			trades = append(trades, t.TradeNo)
		}
	}
	if len(trades) == 0 {
		return nil
	}
	var orders []MixPayOrder
	if err := DB.Select("trade_no", "credited_quota").Where("trade_no IN ?", trades).Find(&orders).Error; err != nil {
		return err
	}
	quotas := make(map[string]int, len(orders))
	for _, o := range orders {
		quotas[o.TradeNo] = o.CreditedQuota
	}
	for _, t := range topups {
		if t.PaymentProvider == PaymentProviderMixPay {
			t.CreditedQuota = quotas[t.TradeNo]
		}
	}
	return nil
}
