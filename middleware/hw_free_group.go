package middleware

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// hwFreeModelsEnv names the comma-separated extra models a free trial account
// may call besides the Haiku class. The default stays empty.
const hwFreeModelsEnv = "HW_FREE_MODELS"

const (
	hwFreeGroupMinuteSeconds = 60
	hwFreeGroupDaySeconds    = 24 * 60 * 60
	// The limiter drops keys that stayed idle longer than its expiration; one
	// hour above the longest window keeps a day counter alive between two
	// requests of the same account.
	hwFreeGroupLimiterExpiration = 25 * time.Hour
)

var (
	hwFreeGroupLimiter     common.InMemoryRateLimiter
	hwFreeGroupLimiterOnce sync.Once
)

// hwUserGroup is the group the account itself belongs to. The trial limits and
// the model class follow the account, never the token group or the group a
// request asks for: a free account that holds a token in default, vip or auto
// is still a free account, and a playground body that names another group does
// not change that.
func hwUserGroup(c *gin.Context) string {
	return common.GetContextKeyString(c, constant.ContextKeyUserGroup)
}

// HwAccountGroup returns the group of the account behind the request. Paths
// outside this package (the Responses WebSocket relay) use it so the trial
// class follows the account there too.
func HwAccountGroup(c *gin.Context) string {
	return hwUserGroup(c)
}

// HwFreeGroupRateLimit blocks a frozen account and caps the request rate of a
// free trial account per minute and per rolling day. The limits are fixed and
// on by default (see setting.HwFreeGroupPerMinuteLimit /
// HwFreeGroupPerDayLimit), unlike the operator switch of the general model rate
// limit: a trial account must never be able to use the trial credit as an
// unpaid relay, whatever the operator forgot to enable. Both the group and the
// frozen check look at the account, so a token group or a request group cannot
// lift them. Requests of every other group pass unchanged, which is what keeps
// paid credit usable while an account is frozen.
//
// The counters live in this process, like the memory handler of the general
// model rate limit, so a multi-node deployment counts per node. The house runs
// one node; a Redis-backed counter would be the upgrade if that changes.
func HwFreeGroupRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.EqualFold(hwUserGroup(c), setting.HwFreeGroupName) {
			c.Next()
			return
		}
		userID := c.GetInt("id")
		if userID <= 0 {
			c.Next()
			return
		}
		frozen, err := model.HwAccountFrozen(userID)
		if err != nil {
			common.SysError(common.LogText("hw: frozen check failed for user %d: %v", userID, err))
			abortWithOpenAiMessage(c, http.StatusInternalServerError, service.HwGenericErrorMessage(c, http.StatusInternalServerError), service.HwErrorCodeServiceBusy)
			return
		}
		if frozen {
			abortWithOpenAiMessage(c, http.StatusForbidden, service.HwAccountFrozenMessage(c), service.HwErrorCodeAccountFrozen)
			return
		}
		hwFreeGroupLimiterOnce.Do(func() {
			hwFreeGroupLimiter.Init(hwFreeGroupLimiterExpiration)
		})
		subject := strconv.Itoa(userID)
		minuteLimit := setting.HwFreeGroupPerMinuteLimit()
		if !hwFreeGroupLimiter.Request("HWFreeGroup:minute:"+subject, minuteLimit, hwFreeGroupMinuteSeconds) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": 1, "Max": minuteLimit}))
			return
		}
		dayLimit := setting.HwFreeGroupPerDayLimit()
		if !hwFreeGroupLimiter.Request("HWFreeGroup:day:"+subject, dayLimit, hwFreeGroupDaySeconds) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": 24 * 60, "Max": dayLimit}))
			return
		}
		c.Next()
	}
}

// HwFreeGroupModelAllowed reports whether a request of the given group may call
// the model. A free trial account (also a partner channel of the 250 dollar
// campaign) may call every model of the catalog, the premium ones included
// (decision Altuner, 4 Nov 2026): the cost stays inside its own credit, and the
// console warns that a premium model uses that credit up much faster. Outside
// the catalog only the Haiku class is open; every other group is unrestricted
// here. The operator can add exact model names to the allow-list with
// HW_FREE_MODELS. An empty model name is refused, because nothing was chosen to
// check. Callers pass the account group (hwUserGroup), so the token group and a
// playground request group cannot widen the class.
func HwFreeGroupModelAllowed(group, model string) bool {
	if !strings.EqualFold(strings.TrimSpace(group), setting.HwFreeGroupName) {
		return true
	}
	name := strings.ToLower(strings.TrimSpace(model))
	if name == "" {
		return false
	}
	// The reasoning modifier and the vendor prefix decorate the same model, so
	// the class check runs on the base name: "vendor/claude-haiku-4-5@high".
	base, _, _ := strings.Cut(name, "@")
	if idx := strings.LastIndexByte(base, '/'); idx >= 0 {
		base = base[idx+1:]
	}
	if service.HwIsSoldModel(base) {
		return true
	}
	// A name belongs to the class only when it is a Haiku family name followed
	// by a version number. A model that merely mentions "haiku" somewhere, such
	// as an alias priced like Sonnet, is not part of the trial class.
	for _, family := range []string{"claude-haiku", "claude-3-haiku", "claude-3-5-haiku"} {
		version, matched := strings.CutPrefix(base, family)
		if matched && len(version) > 1 && version[0] == '-' && version[1] >= '0' && version[1] <= '9' {
			return true
		}
	}
	for allowed := range strings.SplitSeq(strings.ToLower(os.Getenv(hwFreeModelsEnv)), ",") {
		if strings.TrimSpace(allowed) == name {
			return true
		}
	}
	return false
}
