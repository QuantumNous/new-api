package controller

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func paymentReturnPath(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + common.ThemeAwarePath(suffix)
}

func consolePaymentReturnPath(suffix string) string {
	return consoleReturnPath(suffix)
}

func consoleReturnPath(suffix string) string {
	base, err := system_setting.NormalizeAppConsoleOrigin(system_setting.GetAppConsoleSettings().Origin)
	if err != nil || base == "" {
		return paymentReturnPath(suffix)
	}
	return base + common.ThemeAwarePath(suffix)
}

func registrationEmailVerificationURL(token string) string {
	return consoleReturnPath("/sign-up/verify") + "#token=" + url.QueryEscape(token)
}
