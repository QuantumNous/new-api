package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func paymentReturnPath(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + common.ThemeAwarePath(suffix)
}

func consolePaymentReturnPath(suffix string) string {
	base := strings.TrimRight(strings.TrimSpace(system_setting.GetAppConsoleSettings().Origin), "/")
	if base == "" {
		return paymentReturnPath(suffix)
	}
	return base + common.ThemeAwarePath(suffix)
}
