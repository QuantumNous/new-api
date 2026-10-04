package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel/xai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func XAINativeHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.ChannelType != constant.ChannelTypeXai {
		return types.NewErrorWithStatusCode(fmt.Errorf("xAI native endpoint requires xAI channel, got channel type %d", info.ChannelType), types.ErrorCodeInvalidApiType, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if newAPIError := xai.ValidateEndpointForModel(info); newAPIError != nil {
		return newAPIError
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	requestBody, closer, err := xAINativeRequestBody(c, info)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if closer != nil {
		defer closer.Close()
	}

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid response type: %T", resp), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	statusCodeMappingStr := c.GetString("status_code_mapping")
	if httpResp.StatusCode < http.StatusOK || httpResp.StatusCode >= http.StatusMultipleChoices {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	responseBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(httpResp)
	service.IOCopyBytesGracefully(c, httpResp, responseBody)
	service.PostTextConsumeQuota(c, info, xAINativeUsage(info), nil)
	return nil
}

func XAINativeWssHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.ChannelType != constant.ChannelTypeXai {
		return types.NewErrorWithStatusCode(fmt.Errorf("xAI native websocket endpoint requires xAI channel, got channel type %d", info.ChannelType), types.ErrorCodeInvalidApiType, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	if newAPIError := xai.ValidateEndpointForModel(info); newAPIError != nil {
		return newAPIError
	}
	if info.ClientWs == nil {
		return types.NewError(fmt.Errorf("invalid client websocket connection"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	resp, err := adaptor.DoRequest(c, info, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}
	targetWs, ok := resp.(*websocket.Conn)
	if !ok || targetWs == nil {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid websocket response type: %T", resp), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	info.TargetWs = targetWs
	defer targetWs.Close()

	if preUpgraded, ok := GetPreUpgradedWebSocket(c); ok && len(preUpgraded.Message) > 0 {
		if err := targetWs.WriteMessage(preUpgraded.MessageType, preUpgraded.Message); err != nil {
			return types.NewError(err, types.ErrorCodeDoRequestFailed)
		}
	}
	xAINativeProxyWebSocket(c, info)
	service.PostTextConsumeQuota(c, info, xAINativeUsage(info), []string{"xAI native WebSocket passthrough"})
	return nil
}

func xAINativeRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, io.Closer, error) {
	if c == nil || c.Request == nil || !xAINativeMethodMayHaveBody(c.Request.Method, c.Request.ContentLength) {
		return bytes.NewReader(nil), nil, nil
	}

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, nil, err
	}

	if xAINativeIsJSONContentType(c.Request.Header.Get("Content-Type")) && len(info.ParamOverride) > 0 {
		requestBody, err := storage.Bytes()
		if err != nil {
			return nil, nil, err
		}
		requestBody, err = relaycommon.ApplyParamOverrideWithRelayInfo(requestBody, info)
		if err != nil {
			return nil, nil, err
		}
		info.UpstreamRequestBodySize = int64(len(requestBody))
		return bytes.NewReader(requestBody), nil, nil
	}

	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return nil, nil, err
	}
	c.Request.Body = io.NopCloser(storage)
	info.UpstreamRequestBodySize = storage.Size()
	return common.ReaderOnly(storage), storage, nil
}

func xAINativeMethodMayHaveBody(method string, contentLength int64) bool {
	if contentLength > 0 {
		return true
	}
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch:
		return true
	default:
		return false
	}
}

func xAINativeIsJSONContentType(contentType string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "application/json")
}

func xAINativeProxyWebSocket(c *gin.Context, info *relaycommon.RelayInfo) {
	done := make(chan struct{}, 2)
	errChan := make(chan error, 2)

	gopool.Go(func() {
		xAINativeCopyWebSocket(c, "client to xAI", info.ClientWs, info.TargetWs, nil, done, errChan)
	})
	gopool.Go(func() {
		xAINativeCopyWebSocket(c, "xAI to client", info.TargetWs, info.ClientWs, func() {
			info.SetFirstResponseTime()
		}, done, errChan)
	})

	select {
	case <-done:
	case err := <-errChan:
		logger.LogError(c, "xAI native websocket proxy error: "+err.Error())
	case <-c.Done():
	}

	_ = info.ClientWs.Close()
	_ = info.TargetWs.Close()
}

func xAINativeCopyWebSocket(c *gin.Context, direction string, src *websocket.Conn, dst *websocket.Conn, beforeWrite func(), done chan<- struct{}, errChan chan<- error) {
	defer func() {
		if r := recover(); r != nil {
			errChan <- fmt.Errorf("panic in %s websocket copy: %v", direction, r)
		}
	}()

	for {
		messageType, message, err := src.ReadMessage()
		if err != nil {
			if xAINativeIsNormalWebSocketClose(err) {
				done <- struct{}{}
			} else {
				errChan <- fmt.Errorf("read %s failed: %w", direction, err)
			}
			return
		}
		if beforeWrite != nil {
			beforeWrite()
		}
		if err := dst.WriteMessage(messageType, message); err != nil {
			if xAINativeIsNormalWebSocketClose(err) {
				done <- struct{}{}
			} else {
				errChan <- fmt.Errorf("write %s failed: %w", direction, err)
			}
			return
		}
	}
}

func xAINativeIsNormalWebSocketClose(err error) bool {
	if err == nil {
		return true
	}
	return websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) ||
		strings.Contains(err.Error(), "use of closed network connection")
}

func xAINativeUsage(info *relaycommon.RelayInfo) *dto.Usage {
	promptTokens := info.GetEstimatePromptTokens()
	if promptTokens <= 0 {
		promptTokens = 1
	}
	return &dto.Usage{
		PromptTokens: promptTokens,
		TotalTokens:  promptTokens,
	}
}
