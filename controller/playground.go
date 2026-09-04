package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// setupPlaygroundRelayContext prepares the dashboard-authenticated context for
// a playground relay: it rejects access tokens, loads the user cache, and
// installs a temporary token whose group matches the resolved using group so
// downstream distribution and billing run under the selected group.
func setupPlaygroundRelayContext(c *gin.Context, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		return types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}

// respondPlaygroundError writes a relay error in OpenAI error shape.
func respondPlaygroundError(c *gin.Context, newAPIError *types.NewAPIError) {
	c.JSON(newAPIError.StatusCode, gin.H{
		"error": newAPIError.ToOpenAIError(),
	})
}

// Playground relays a dashboard chat completion through the standard relay
// pipeline using the dashboard user identity instead of a relay token.
func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			respondPlaygroundError(c, newAPIError)
		}
	}()

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	newAPIError = setupPlaygroundRelayContext(c, relayInfo)
	if newAPIError != nil {
		return
	}

	Relay(c, types.RelayFormatOpenAI)
}

// PlaygroundImage relays a dashboard image generation through the standard
// image relay pipeline using the dashboard user identity instead of a relay
// token. The request body stays a standard OpenAI image contract; group
// selection is carried by the pg_group query parameter handled by
// middleware.PlaygroundGroup.
func PlaygroundImage(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			respondPlaygroundError(c, newAPIError)
		}
	}()

	relayInfo := relaycommon.GenRelayInfoImage(c, nil)

	newAPIError = setupPlaygroundRelayContext(c, relayInfo)
	if newAPIError != nil {
		return
	}

	Relay(c, types.RelayFormatOpenAIImage)
}
