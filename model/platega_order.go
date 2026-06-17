package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	PlategaPaymentMethodSBPQR = "SBPQR"

	PlategaStatusPending    = "pending"
	PlategaStatusConfirmed  = "confirmed"
	PlategaStatusCanceled   = "canceled"
	PlategaStatusChargeback = "chargeback"

	PlategaAPIStatusConfirmed  = "CONFIRMED"
	PlategaAPIStatusCanceled   = "CANCELED"
	PlategaAPIStatusChargeback = "CHARGEBACK"
)

// PlategaOrder stores Platega-specific payment metadata linked to top_ups.trade_no.
type PlategaOrder struct {
	Id                   int     `json:"id"`
	TradeNo              string  `json:"trade_no" gorm:"uniqueIndex;type:varchar(255)"`
	UserId               int     `json:"user_id" gorm:"index"`
	RubAmount            float64 `json:"rub_amount"`
	UsdQuotaAmount       int64   `json:"usd_quota_amount"`
	PlategaTransactionId string  `json:"platega_transaction_id" gorm:"uniqueIndex;type:varchar(255)"`
	PaymentMethod        string  `json:"payment_method" gorm:"type:varchar(32);default:SBPQR"`
	PlategaStatus        string  `json:"platega_status" gorm:"type:varchar(32);index"`
	Payload              string  `json:"payload" gorm:"type:varchar(255);index"`
	CreateRequestJSON    string  `json:"create_request_json" gorm:"type:text"`
	CreateResponseJSON   string  `json:"create_response_json" gorm:"type:text"`
	CallbackJSON         string  `json:"callback_json" gorm:"type:text"`
	CallbackHeadersJSON  string  `json:"callback_headers_json" gorm:"type:text"`
	CreateTime           int64   `json:"create_time"`
	UpdateTime           int64   `json:"update_time"`
}

func (o *PlategaOrder) Insert() error {
	return DB.Create(o).Error
}

func (o *PlategaOrder) Save() error {
	o.UpdateTime = common.GetTimestamp()
	return DB.Save(o).Error
}

func GetPlategaOrderByTradeNo(tradeNo string) *PlategaOrder {
	var order PlategaOrder
	if err := DB.Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

func GetPlategaOrderByTransactionId(transactionId string) *PlategaOrder {
	if strings.TrimSpace(transactionId) == "" {
		return nil
	}
	var order PlategaOrder
	if err := DB.Where("platega_transaction_id = ?", transactionId).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

func GetPlategaOrderByPayload(payload string) *PlategaOrder {
	if strings.TrimSpace(payload) == "" {
		return nil
	}
	var order PlategaOrder
	if err := DB.Where("payload = ?", payload).First(&order).Error; err != nil {
		return nil
	}
	return &order
}

func ListPlategaOrders(limit, offset int) ([]*PlategaOrder, int64, error) {
	var orders []*PlategaOrder
	var total int64
	tx := DB.Model(&PlategaOrder{})
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := tx.Order("id desc").Limit(limit).Offset(offset).Find(&orders).Error; err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

func NormalizePlategaAPIStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case PlategaAPIStatusConfirmed:
		return PlategaStatusConfirmed
	case PlategaAPIStatusCanceled:
		return PlategaStatusCanceled
	case PlategaAPIStatusChargeback:
		return PlategaStatusChargeback
	case "PENDING", "PENDING_PAYMENT", "IN_PROGRESS":
		return PlategaStatusPending
	default:
		return strings.ToLower(strings.TrimSpace(status))
	}
}

func (o *PlategaOrder) ApplyPlategaStatus(status string) error {
	if o == nil {
		return errors.New("missing platega order")
	}
	normalized := NormalizePlategaAPIStatus(status)
	if normalized == "" {
		return fmt.Errorf("unknown platega status: %s", status)
	}
	o.PlategaStatus = normalized
	o.UpdateTime = common.GetTimestamp()
	return o.Save()
}

func MarkTopUpCanceledForPlatega(tradeNo string) error {
	topUp := GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return ErrTopUpNotFound
	}
	if topUp.Status != common.TopUpStatusPending {
		return nil
	}
	topUp.Status = common.TopUpStatusFailed
	topUp.CompleteTime = common.GetTimestamp()
	return topUp.Update()
}

func RechargePlatega(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("未提供支付单号")
	}

	var quotaToAdd int
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingPostgreSQL {
		refCol = `"trade_no"`
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return errors.New("充值订单不存在")
		}

		if topUp.PaymentProvider != PaymentProviderPlatega {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("充值订单状态错误")
		}

		plategaOrder := &PlategaOrder{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("trade_no = ?", tradeNo).First(plategaOrder).Error; err != nil {
			return errors.New("Platega 订单不存在")
		}
		if plategaOrder.PlategaStatus != PlategaStatusConfirmed {
			return errors.New("Platega 订单未确认")
		}

		quotaToAdd = int(decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)).IntPart())
		if quotaToAdd <= 0 {
			return errors.New("无效的充值额度")
		}

		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", topUp.UserId).Update("quota", gorm.Expr("quota + ?", quotaToAdd)).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		common.SysError("platega topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, fmt.Sprintf("Russian SBP QR 充值成功，充值额度: %v，支付金额: %.2f RUB", logger.FormatQuota(quotaToAdd), topUp.Money), callerIp, topUp.PaymentMethod, PaymentMethodPlatega)
		OnTopupSucceeded(topUp.UserId, quotaToAdd, PaymentMethodPlatega)
	}
	return nil
}
