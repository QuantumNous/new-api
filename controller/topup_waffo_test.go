package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"github.com/waffo-com/waffo-go/core"
)

func TestBuildWaffoTopUpGoodsInfoIncludesRequiredFields(t *testing.T) {
	originalSystemName := common.SystemName
	t.Cleanup(func() {
		common.SystemName = originalSystemName
	})
	common.SystemName = "Codex Billing"

	goodsInfo := buildWaffoTopUpGoodsInfo(12)

	require.NotNil(t, goodsInfo)
	require.Equal(t, "Recharge 12 credits", goodsInfo.GoodsName)
	require.Equal(t, "Codex Billing", goodsInfo.AppName)
}

func TestBuildWaffoTopUpGoodsInfoFallsBackWhenSystemNameIsBlank(t *testing.T) {
	originalSystemName := common.SystemName
	t.Cleanup(func() {
		common.SystemName = originalSystemName
	})
	common.SystemName = " "

	goodsInfo := buildWaffoTopUpGoodsInfo(12)

	require.Equal(t, "New API", goodsInfo.AppName)
}

func TestWebhookPayloadWithSubInfoAcceptsStringOrderFailedReason(t *testing.T) {
	payload := []byte(`{
		"eventType": "PAYMENT_NOTIFICATION",
		"result": {
			"paymentRequestId": "WAFFO-9-1782134775693-0E62O5",
			"merchantOrderId": "WAFFO-9-1782134775693-0E62O5",
			"orderStatus": "ORDER_CLOSE",
			"orderFailedReason": "{\"orderFailedCode\":\"TIMEOUT_CLOSE\",\"orderFailedDescription\":\"Timeout close\"}",
			"paymentInfo": {
				"payMethodType": "CREDITCARD/DEBITCARD",
				"productName": "ONE_TIME_PAYMENT"
			}
		}
	}`)

	var notification webhookPayloadWithSubInfo
	err := common.Unmarshal(payload, &notification)

	require.NoError(t, err)
	require.Equal(t, "WAFFO-9-1782134775693-0E62O5", notification.Result.MerchantOrderID)
	require.Equal(t, core.OrderStatusOrderClose, notification.Result.OrderStatus)
	require.Equal(t, "TIMEOUT_CLOSE", notification.Result.OrderFailedReason["orderFailedCode"])
}
