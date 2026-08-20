package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func preparePlayground(c *gin.Context, relayFormat types.RelayFormat) *types.NewAPIError {
	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		return types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, nil, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	// Playground consumes the user's quota directly; apply the same
	// email-verification gate used for API tokens.
	if operation_setting.RequireEmailVerificationForTokens() &&
		userCache.Role < common.RoleAdminUser &&
		userCache.Email != "" && userCache.EmailVerifiedAt == 0 {
		return types.NewError(errors.New(i18n.T(c, i18n.MsgUserEmailVerificationRequiredForAPI, map[string]any{"ConsoleOrigin": system_setting.ResolveConsoleOrigin()})), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

func runPlaygroundRelay(c *gin.Context, relayFormat types.RelayFormat, relayHandler func()) {
	defer func() {
		sendActivationEventOnSuccess(c, "playground_used", map[string]any{"surface": "playground"})
	}()

	if newAPIError := preparePlayground(c, relayFormat); newAPIError != nil {
		c.JSON(newAPIError.StatusCode, gin.H{
			"error": newAPIError.ToOpenAIError(),
		})
		return
	}
	relayHandler()
}

func Playground(c *gin.Context) {
	runPlaygroundRelay(c, types.RelayFormatOpenAI, func() {
		Relay(c, types.RelayFormatOpenAI)
	})
}

func PlaygroundImage(c *gin.Context) {
	runPlaygroundRelay(c, types.RelayFormatOpenAIImage, func() {
		Relay(c, types.RelayFormatOpenAIImage)
	})
}

func PlaygroundVideoSubmit(c *gin.Context) {
	runPlaygroundRelay(c, types.RelayFormatTask, func() {
		RelayTask(c)
	})
}

func PlaygroundVideoFetch(c *gin.Context) {
	runPlaygroundRelay(c, types.RelayFormatTask, func() {
		RelayTaskFetch(c)
	})
}
