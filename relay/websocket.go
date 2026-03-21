package relay

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func WssHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	//var requestBody io.Reader
	//firstWssRequest, _ := c.Get("first_wss_request")
	//requestBody = bytes.NewBuffer(firstWssRequest.([]byte))

	statusCodeMappingStr := c.GetString("status_code_mapping")
	resp, err := adaptor.DoRequest(c, info, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}

	if resp != nil {
		info.TargetWs = resp.(*websocket.Conn)
		defer info.TargetWs.Close()
	}

	usage, newAPIError := adaptor.DoResponse(c, nil, info)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}
	service.PostWssConsumeQuota(c, info, info.UpstreamModelName, usage.(*dto.RealtimeUsage), "")
	return nil
}

func WssResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if info.ClientWs == nil {
		return types.NewError(errors.New("client websocket connection is nil"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	targetWs, err := channel.DoWssRequest(adaptor, c, info, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}
	info.TargetWs = targetWs
	defer info.TargetWs.Close()

	if err := sendInitialResponsesWSRequest(c, adaptor, info); err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if err := proxyResponsesWS(c, info.ClientWs, info.TargetWs); err != nil {
		return types.NewError(err, types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}
	if err := service.SettleBilling(c, info, info.FinalPreConsumedQuota); err != nil {
		logger.LogError(c, "responses websocket settle billing failed: "+err.Error())
	}
	return nil
}

func sendInitialResponsesWSRequest(c *gin.Context, adaptor channel.Adaptor, info *relaycommon.RelayInfo) error {
	request, ok := info.Request.(*dto.OpenAIResponsesRequest)
	if !ok || request == nil {
		return errors.New("invalid responses websocket request")
	}
	initialRequest := *request
	if initialRequest.Type == "" {
		initialRequest.Type = "response.create"
	}
	converted, err := adaptor.ConvertOpenAIResponsesRequest(c, info, initialRequest)
	if err != nil {
		return err
	}
	switch v := converted.(type) {
	case string:
		return helper.WssString(c, info.TargetWs, v)
	case []byte:
		return info.TargetWs.WriteMessage(websocket.TextMessage, v)
	default:
		return helper.WssObject(c, info.TargetWs, v)
	}
}

func proxyResponsesWS(c *gin.Context, clientConn, targetConn *websocket.Conn) error {
	errChan := make(chan error, 2)
	forward := func(src, dst *websocket.Conn, direction string) {
		defer func() {
			if r := recover(); r != nil {
				errChan <- fmt.Errorf("%s panic: %v", direction, r)
			}
		}()
		for {
			messageType, payload, err := src.ReadMessage()
			if err != nil {
				if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					errChan <- nil
					return
				}
				errChan <- fmt.Errorf("%s read failed: %w", direction, err)
				return
			}
			if err := dst.WriteMessage(messageType, payload); err != nil {
				errChan <- fmt.Errorf("%s write failed: %w", direction, err)
				return
			}
		}
	}

	gopool.Go(func() {
		forward(clientConn, targetConn, "client->target")
	})
	gopool.Go(func() {
		forward(targetConn, clientConn, "target->client")
	})

	select {
	case <-c.Request.Context().Done():
		return nil
	case err := <-errChan:
		if err == nil {
			deadline := time.Now().Add(500 * time.Millisecond)
			_ = clientConn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), deadline)
			_ = targetConn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), deadline)
			return nil
		}
		return err
	}
}
