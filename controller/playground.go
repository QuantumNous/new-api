package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	openaichannel "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	if newAPIError = setupPlaygroundTokenContext(c, fmt.Sprintf("playground-%s", relayInfo.UsingGroup), relayInfo.UsingGroup); newAPIError != nil {
		return
	}

	Relay(c, types.RelayFormatOpenAI)
}

func PlaygroundVideoSubmit(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-video", c.GetString("group")); newAPIError != nil {
		return
	}
	RelayTask(c)
}

func PlaygroundImageGenerations(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-image", c.GetString("group")); newAPIError != nil {
		return
	}
	Relay(c, types.RelayFormatOpenAIImage)
}

func PlaygroundImageEdits(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-image-edit", c.GetString("group")); newAPIError != nil {
		return
	}
	Relay(c, types.RelayFormatOpenAIImage)
}

func PlaygroundVideoFetch(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()
	if newAPIError = setupPlaygroundTokenContext(c, "playground-video-fetch", c.GetString("group")); newAPIError != nil {
		return
	}
	RelayTaskFetch(c)
}

func PlaygroundRequestStatus(c *gin.Context) {
	var newAPIError *types.NewAPIError
	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	modelName := c.Query("model")
	if modelName == "" {
		newAPIError = types.NewError(errors.New("model is required"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	requestID := c.Param("request_id")
	if requestID == "" {
		newAPIError = types.NewError(errors.New("request_id is required"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	tokenGroup := c.Query("group")
	if newAPIError = setupPlaygroundTokenContext(c, "playground-request-status", tokenGroup); newAPIError != nil {
		return
	}

	if tokenGroup == "" {
		tokenGroup = c.GetString("group")
	}
	if tokenGroup == "" {
		tokenGroup = c.GetString("token_group")
	}

	channelModel, err := model.GetChannel(tokenGroup, modelName, 0)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo := relaycommon.GenRelayInfoOpenAI(c, nil)
	relayInfo.OriginModelName = modelName
	relayInfo.UpstreamModelName = modelName
	relayInfo.ChannelType = channelModel.Type
	relayInfo.ChannelId = channelModel.Id
	relayInfo.ChannelBaseUrl = channelModel.GetBaseURL()
	relayInfo.ApiKey = channelModel.Key
	relayInfo.Organization = ""
	if channelModel.OpenAIOrganization != nil {
		relayInfo.Organization = *channelModel.OpenAIOrganization
	}
	relayInfo.HeadersOverride = channelModel.GetHeaderOverride()
	relayInfo.ChannelSetting = channelModel.GetSetting()
	relayInfo.ChannelOtherSettings = channelModel.GetOtherSettings()
	relayInfo.RequestURLPath = "/v1/requests/" + url.PathEscape(requestID)

	adaptor := &openaichannel.Adaptor{ChannelType: channelModel.Type}
	requestURL, err := adaptor.GetRequestURL(relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
		return
	}

	header := http.Header{}
	if err = adaptor.SetupRequestHeader(c, &header, relayInfo); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
		return
	}
	req.Header = header

	resp, err := relaychannel.DoRequest(c, req, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
		return
	}
	defer resp.Body.Close()

	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		c.Header("Content-Type", contentType)
	}
	if upstreamReqID := resp.Header.Get("X-Request-Id"); upstreamReqID != "" {
		c.Header("X-Request-Id", upstreamReqID)
	}
	c.Status(resp.StatusCode)
	_, _ = io.Copy(c.Writer, resp.Body)
}

func setupPlaygroundTokenContext(c *gin.Context, tokenName string, tokenGroup string) *types.NewAPIError {
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
	}
	userCache.WriteContext(c)
	if tokenGroup == "" {
		tokenGroup = c.GetString("group")
	}
	if tokenGroup == "" {
		tokenGroup = userCache.Group
	}
	tempToken := &model.Token{
		UserId: userId,
		Name:   tokenName,
		Group:  tokenGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	return nil
}
