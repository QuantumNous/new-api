package model

import "github.com/QuantumNous/new-api/common"

// GAPurchaseLog records which top_ups have already had a GA4 `purchase` event
// reported (live, by SendGAPurchase, or by the daily backfill script), so the
// two paths never double-report the same transaction to GA.
type GAPurchaseLog struct {
	TradeNo string `json:"trade_no" gorm:"primaryKey;type:varchar(255)"`
	SentAt  int64  `json:"sent_at"`
}

func (GAPurchaseLog) TableName() string {
	return "ga_purchase_logs"
}

// ClaimGAPurchase atomically claims tradeNo for GA reporting. Returns true if
// this call won the claim (no one has reported it yet, proceed to send);
// false if it was already claimed (skip — already sent or being sent).
func ClaimGAPurchase(tradeNo string) bool {
	if tradeNo == "" {
		return false
	}
	err := DB.Create(&GAPurchaseLog{TradeNo: tradeNo, SentAt: common.GetTimestamp()}).Error
	return err == nil
}

// ReleaseGAPurchaseClaim undoes a claim whose send attempt did not actually
// succeed (network error, non-2xx from GA). Without this, a transient failure
// permanently hides the trade from the daily backfill script's retry query.
func ReleaseGAPurchaseClaim(tradeNo string) {
	if tradeNo == "" {
		return
	}
	DB.Where("trade_no = ?", tradeNo).Delete(&GAPurchaseLog{})
}
