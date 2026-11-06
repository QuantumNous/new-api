package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var paymentLogStatuses = map[string]struct{}{
	common.TopUpStatusPending: {},
	common.TopUpStatusSuccess: {},
	common.TopUpStatusFailed:  {},
	common.TopUpStatusExpired: {},
}

var paymentLogProviders = map[string]struct{}{
	model.PaymentProviderEpay:         {},
	model.PaymentProviderStripe:       {},
	model.PaymentProviderCreem:        {},
	model.PaymentProviderWaffo:        {},
	model.PaymentProviderWaffoPancake: {},
	model.PaymentProviderBalance:      {},
}

// parsePaymentLogTimestamp accepts an optional Unix timestamp in seconds.
// The boolean is false only for a malformed or negative value.
func parsePaymentLogTimestamp(value string) (int64, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, true
	}
	seconds, err := strconv.ParseInt(value, 10, 64)
	if err != nil || seconds < 0 {
		return 0, false
	}
	return seconds, true
}

// GetAdminPaymentLogs returns a read-only page of platform top-up orders.
// It never mutates orders, balances, or payment state.
func GetAdminPaymentLogs(c *gin.Context) {
	startTime, ok := parsePaymentLogTimestamp(c.Query("start_time"))
	if !ok {
		common.ApiError(c, common.NewMessage("Invalid start time"))
		return
	}
	endTime, ok := parsePaymentLogTimestamp(c.Query("end_time"))
	if !ok {
		common.ApiError(c, common.NewMessage("Invalid end time"))
		return
	}

	status := strings.TrimSpace(c.Query("status"))
	if status != "" {
		if _, ok := paymentLogStatuses[status]; !ok {
			common.ApiError(c, common.NewMessage("Invalid payment status"))
			return
		}
	}

	provider := strings.TrimSpace(c.Query("payment_provider"))
	if provider != "" {
		if _, ok := paymentLogProviders[provider]; !ok {
			common.ApiError(c, common.NewMessage("Invalid payment gateway"))
			return
		}
	}

	pageInfo := common.GetPageQuery(c)
	entries, total, err := model.QueryTopUpLedger(model.TopUpLedgerFilter{
		StartTime: startTime,
		EndTime:   endTime,
		Status:    status,
		Provider:  provider,
		Keyword:   c.Query("keyword"),
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(entries)
	common.ApiSuccess(c, pageInfo)
}
