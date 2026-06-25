package service

import (
	"net/url"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// topUpURL suppresses only the known loopback addresses we already avoid
// surfacing to API callers; it is not a full public-address validator.
func topUpURL() string {
	base := strings.TrimRight(topUpBaseOrigin(), "/")
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
	return base + common.ThemeAwarePath("/console/topup")
}

func topUpBaseOrigin() string {
	if consoleOrigin := strings.TrimSpace(os.Getenv("APP_CONSOLE_ORIGIN")); consoleOrigin != "" {
		return consoleOrigin
	}
	return system_setting.ServerAddress
}

func appendWalletTopUpHint(c *gin.Context, msg string) string {
	if topUp := topUpURL(); topUp != "" {
		return msg + " " + common.TranslateMessage(c, "quota.topup_hint", map[string]any{"URL": topUp})
	}
	return msg
}

func walletTopUpHintPreserveOption() types.NewAPIErrorOptions {
	if topUp := topUpURL(); topUp != "" && system_setting.TopupHintHostAllowed(topUp) {
		return types.ErrOptionWithPreservedMessageFragments(topUp)
	}
	return func(*types.NewAPIError) {}
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
