package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

func cashbackBaseQuotaFromTopUpAmount(amount int64) (int, error) {
	return getTopUpQuota(amount)
}

func cashbackBaseQuotaFromWalletQuota(quota int64) (int, error) {
	return validateCreditedQuota(decimal.NewFromInt(quota))
}

func insertOnlineTopUpWithCashbackContext(c *gin.Context, topUp *model.TopUp, baseQuota int, faceAmount int64, productQuota bool) error {
	return model.InsertOnlineTopUp(topUp, baseQuota, onlineTopUpCashbackMetadata(c, baseQuota, faceAmount, productQuota))
}

// onlineTopUpCashbackMetadata snapshots the checkout face evidence and request
// signals that every new online order stores in its cashback context.
func onlineTopUpCashbackMetadata(c *gin.Context, baseQuota int, faceAmount int64, productQuota bool) model.CashbackRequestMetadata {
	factor := decimal.NewFromFloat(common.QuotaPerUnit)
	if productQuota || operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		factor = decimal.NewFromInt(1)
		if !productQuota {
			// Token mode truncates the purchased amount to whole quota units.
			faceAmount = int64(baseQuota)
		}
	}
	return model.CashbackRequestMetadata{
		FaceAmount:       faceAmount,
		QuotaPerFaceUnit: factor.String(),
		RequestIP:        c.ClientIP(),
		UserAgent:        c.Request.UserAgent(),
		DeviceSignal:     c.GetHeader(model.CashbackDeviceSignalHeader),
	}
}

func captureCashbackDeviceLink(c *gin.Context, userID int, source model.CashbackDeviceSource) {
	if err := model.RecordCashbackDeviceLink(
		userID,
		c.GetHeader(model.CashbackDeviceSignalHeader),
		c.ClientIP(),
		c.Request.UserAgent(),
		source,
	); err != nil {
		common.SysError("failed to capture cashback device signal: " + err.Error())
	}
}
