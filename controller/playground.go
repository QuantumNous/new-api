package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	playgroundRelay(c, types.RelayFormatOpenAI)
}

// PlaygroundImage relays an image generation request on behalf of the logged-in
// user (session auth), mirroring Playground but targeting the OpenAI image format.
func PlaygroundImage(c *gin.Context) {
	playgroundRelay(c, types.RelayFormatOpenAIImage)
}

// PlaygroundResponses relays an OpenAI Responses request (canvas assistant,
// streaming) on behalf of the logged-in user (session auth).
func PlaygroundResponses(c *gin.Context) {
	playgroundRelay(c, types.RelayFormatOpenAIResponses)
}

// PlaygroundAudioSpeech relays a TTS request on behalf of the logged-in user (session auth).
func PlaygroundAudioSpeech(c *gin.Context) {
	playgroundRelay(c, types.RelayFormatOpenAIAudio)
}

func playgroundRelay(c *gin.Context, relayFormat types.RelayFormat) {
	if apiErr := playgroundSetupContext(c, relayFormat); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	Relay(c, relayFormat)
}

// PlaygroundVideo submits a video generation task on behalf of the logged-in
// user (session auth), mirroring Playground but delegating to the async task relay.
func PlaygroundVideo(c *gin.Context) {
	if apiErr := playgroundSetupContext(c, types.RelayFormatTask); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	RelayTask(c)
}

// PlaygroundVideoFetch polls a video generation task for the logged-in user.
func PlaygroundVideoFetch(c *gin.Context) {
	if apiErr := playgroundSetupContext(c, types.RelayFormatTask); apiErr != nil {
		c.JSON(apiErr.StatusCode, gin.H{"error": apiErr.ToOpenAIError()})
		return
	}
	RelayTaskFetch(c)
}

// playgroundSetupContext 为登录用户签发临时 token 并写入用户上下文，供后续 relay 使用。
func playgroundSetupContext(c *gin.Context, relayFormat types.RelayFormat) *types.NewAPIError {
	if c.GetBool("use_access_token") {
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

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}
