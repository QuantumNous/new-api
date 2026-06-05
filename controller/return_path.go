package controller

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	paymentScopeTopUp        = "topup"
	paymentScopeSubscription = "subscription"

	paymentStatusSuccess = "success"
	paymentStatusPending = "pending"
	paymentStatusFail    = "fail"
)

func paymentReturnPath(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + common.ThemeAwarePath(suffix)
}

func paymentResultPath(scope string, status string) string {
	values := url.Values{}
	values.Set("show_history", "true")
	if scope != "" {
		values.Set("scope", scope)
	}
	if status != "" {
		values.Set("pay", status)
	}
	return paymentReturnPath("/console/topup?" + values.Encode())
}
