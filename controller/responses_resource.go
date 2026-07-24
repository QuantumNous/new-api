package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func RelayResponsesResource(c *gin.Context) {
	responseID := strings.TrimSpace(c.Param("response_id"))
	if responseID == "" {
		responsesResourceError(c, http.StatusBadRequest, "response_id is required")
		return
	}

	resourceRoute, found, err := service.GetResponsesResourceRoute(c, responseID)
	if err != nil {
		responsesResourceError(c, http.StatusInternalServerError, "failed to resolve response route")
		return
	}
	if !found {
		responsesResourceError(c, http.StatusNotFound, "response not found")
		return
	}

	selectedChannel, err := model.CacheGetChannel(resourceRoute.ChannelID)
	if err != nil || selectedChannel == nil {
		responsesResourceError(c, http.StatusBadGateway, "response channel is unavailable")
		return
	}
	if setupErr := middleware.SetupContextForSelectedChannel(c, selectedChannel, resourceRoute.OriginModelName); setupErr != nil {
		responsesResourceError(c, setupErr.StatusCode, setupErr.Error())
		return
	}
	if resourceRoute.ChannelIsMultiKey {
		keys := selectedChannel.GetKeys()
		if resourceRoute.ChannelMultiKeyIndex < 0 || resourceRoute.ChannelMultiKeyIndex >= len(keys) {
			responsesResourceError(c, http.StatusBadGateway, "response channel key is unavailable")
			return
		}
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
		common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, resourceRoute.ChannelMultiKeyIndex)
		common.SetContextKey(c, constant.ContextKeyChannelKey, keys[resourceRoute.ChannelMultiKeyIndex])
	}

	upstreamURL, err := service.BuildResponsesResourceURL(
		resourceRoute.UpstreamResponsesURL,
		responseID,
		strings.HasSuffix(c.Request.URL.Path, "/input_items"),
		c.Request.URL.Query(),
	)
	if err != nil {
		responsesResourceError(c, http.StatusInternalServerError, "failed to build upstream response URL")
		return
	}

	info := &relaycommon.RelayInfo{
		UserId:          common.GetContextKeyInt(c, constant.ContextKeyUserId),
		TokenId:         common.GetContextKeyInt(c, constant.ContextKeyTokenId),
		RelayMode:       relayconstant.RelayModeResponses,
		RelayFormat:     types.RelayFormatOpenAIResponses,
		OriginModelName: resourceRoute.OriginModelName,
		RequestURLPath:  c.Request.URL.RequestURI(),
		IsStream:        strings.EqualFold(c.Query("stream"), "true"),
	}
	info.InitChannelMeta(c)

	adaptor := relay.GetAdaptor(info.ApiType)
	if adaptor == nil {
		responsesResourceError(c, http.StatusBadGateway, fmt.Sprintf("unsupported response channel type: %d", info.ApiType))
		return
	}
	adaptor.Init(info)

	upstreamResponse, err := channel.DoApiRequestWithURL(adaptor, c, info, nil, upstreamURL)
	if err != nil {
		responsesResourceError(c, http.StatusBadGateway, "failed to query upstream response")
		return
	}
	defer service.CloseResponseBodyGracefully(upstreamResponse)

	copyResponsesResourceHeaders(c, upstreamResponse)
	c.Status(upstreamResponse.StatusCode)
	c.Writer.WriteHeaderNow()
	if _, err = copyResponsesResourceBody(c, upstreamResponse.Body); err != nil {
		logger.LogError(c, "failed to copy responses resource body: "+err.Error())
		return
	}

	if c.Request.Method == http.MethodDelete && upstreamResponse.StatusCode >= 200 && upstreamResponse.StatusCode < 300 {
		if err := service.DeleteResponsesResourceRoute(c, responseID); err != nil {
			logger.LogWarn(c, "failed to delete responses resource route: "+err.Error())
		}
	}
}

func copyResponsesResourceHeaders(c *gin.Context, response *http.Response) {
	for key, values := range response.Header {
		if !service.ShouldCopyUpstreamHeader(c, key, values) {
			continue
		}
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}
}

func copyResponsesResourceBody(c *gin.Context, body io.Reader) (int64, error) {
	buffer := make([]byte, 32*1024)
	var total int64
	for {
		readCount, readErr := body.Read(buffer)
		if readCount > 0 {
			written, writeErr := c.Writer.Write(buffer[:readCount])
			total += int64(written)
			c.Writer.Flush()
			if writeErr != nil {
				return total, writeErr
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				return total, nil
			}
			return total, readErr
		}
	}
}

func responsesResourceError(c *gin.Context, statusCode int, message string) {
	c.AbortWithStatusJSON(statusCode, gin.H{
		"error": gin.H{
			"message": message,
			"type":    "invalid_request_error",
		},
	})
}
