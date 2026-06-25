package service

import (
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// topUpURL suppresses only the known loopback addresses we already avoid
// surfacing to API callers; it is not a full public-address validator.
func topUpURL() string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	if base == "" {
		return ""
	}
	parseBase := base
	if !strings.Contains(parseBase, "://") {
		parseBase = "http://" + parseBase
	}
	host := ""
	if parsed, err := url.Parse(parseBase); err == nil {
		host = parsed.Hostname()
	}
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return ""
	}
	return PaymentReturnURL("/console/topup")
}

func appendWalletTopUpHint(c *gin.Context, msg string) string {
	if topUp := topUpURL(); topUp != "" {
		return msg + " " + common.TranslateMessage(c, "quota.topup_hint", map[string]any{"URL": topUp})
	}
	return msg
}

func buildUserQuotaInsufficientMessage(c *gin.Context, quota int) string {
	base := common.TranslateMessage(c, "quota.user_insufficient", map[string]any{"Quota": logger.FormatQuota(quota)})
	return appendWalletTopUpHint(c, base)
}

func buildPreConsumeQuotaFailedMessage(c *gin.Context, remaining int, required int) string {
	base := common.TranslateMessage(c, "quota.pre_consume_failed", map[string]any{
		"Remaining": logger.FormatQuota(remaining),
		"Required":  logger.FormatQuota(required),
	})
	return appendWalletTopUpHint(c, base)
}
