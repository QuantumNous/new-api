package relay

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	appmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/wsmanager"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	responsesWSEventTypeResponseCreate = "response.create"
	responsesWSV2BetaHeaderValue       = "responses_websockets=2026-02-06"
	responsesWSWriteWait               = 10 * time.Second
	responsesWSPongWait                = 60 * time.Second
	responsesWSPingPeriod              = responsesWSPongWait * 9 / 10
)

type responsesWSCreateEvent struct {
	Type    string            `json:"type"`
	EventID string            `json:"event_id,omitempty"`
	Request common.RawMessage `json:"response,omitempty"`
}

type responsesWSCreateRequest struct {
	Request  dto.OpenAIResponsesRequest
	Generate common.RawMessage
}

type responsesWSErrorEvent struct {
	Type    string             `json:"type"`
	Status  int                `json:"status"`
	EventID string             `json:"event_id,omitempty"`
	Error   *types.OpenAIError `json:"error"`
}

type responsesWSCallState struct {
	mu         sync.Mutex
	finished   bool
	info       *relaycommon.RelayInfo
	usage      *dto.Usage
	outputText strings.Builder
	commitRate responsesWSRateLimitCommit
	finishOnce sync.Once
	images     relaycommon.ImageGenerationCallCounter
}

type ResponsesWebSocketRateLimitCommit func(success bool)

type responsesWSRateLimitCommit = ResponsesWebSocketRateLimitCommit

var (
	responsesWSCheckRateLimit = func(*gin.Context) (responsesWSRateLimitCommit, *types.NewAPIError) {
		return func(bool) {}, nil
	}
	responsesWSSetupContext = func(*gin.Context, *appmodel.Channel, string) *types.NewAPIError {
		return types.NewError(errors.New("responses websocket dependencies are not configured"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
)

// ConfigureResponsesWebSocketDependencies wires the middleware-owned pieces
// needed by the WebSocket relay without creating a package import cycle.
func ConfigureResponsesWebSocketDependencies(
	checkRateLimit func(*gin.Context) (ResponsesWebSocketRateLimitCommit, *types.NewAPIError),
	setupContext func(*gin.Context, *appmodel.Channel, string) *types.NewAPIError,
) {
	if checkRateLimit != nil {
		responsesWSCheckRateLimit = checkRateLimit
	}
	if setupContext != nil {
		responsesWSSetupContext = setupContext
	}
}

type responsesWSSession struct {
	c              *gin.Context
	client         *websocket.Conn
	target         *websocket.Conn
	unregister     func()
	lockedModel    string
	lockedChannel  *appmodel.Channel
	nextEventIndex int
	closeOnce      sync.Once
	keepaliveOnce  sync.Once
	done           chan struct{}

	clientWriteMu sync.Mutex
	targetWriteMu sync.Mutex
	stateMu       sync.Mutex
	current       *responsesWSCallState
}

func ResponsesWebSocketHelper(c *gin.Context, client *websocket.Conn) *types.NewAPIError {
	session := &responsesWSSession{
		c:      c,
		client: client,
		done:   make(chan struct{}),
	}
	defer session.closeTarget()
	defer session.failCurrent()
	defer session.stopKeepalive()
	if err := configureResponsesWSConnection(client); err != nil {
		return types.NewError(err, types.ErrorCodeBadRequestBody, types.ErrOptionWithSkipRetry())
	}
	session.startKeepalive()

	for {
		if err := client.SetReadDeadline(time.Now().Add(responsesWSPongWait)); err != nil {
			return types.NewError(err, types.ErrorCodeBadRequestBody, types.ErrOptionWithSkipRetry())
		}
		messageType, message, err := client.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				return nil
			}
			return types.NewError(err, types.ErrorCodeBadRequestBody, types.ErrOptionWithSkipRetry())
		}

		eventType, eventErr := responsesWSEventType(message)
		if eventErr != nil {
			session.sendError("", newResponsesWSInvalidRequestError(eventErr))
			continue
		}

		if eventType != responsesWSEventTypeResponseCreate {
			if !session.hasTarget() {
				session.sendError("", newResponsesWSInvalidRequestError(errors.New("first responses websocket event must be response.create")))
				continue
			}
			if err := session.writeTarget(messageType, message); err != nil {
				return session.handleControlEventWriteFailure(err)
			}
			continue
		}

		create, eventID, err := normalizeResponsesWSCreateEvent(message)
		if err != nil {
			session.sendError(eventID, newResponsesWSInvalidRequestError(err))
			continue
		}
		if err := helper.ValidateResponsesRequest(&create.Request); err != nil {
			session.sendError(eventID, newResponsesWSInvalidRequestError(err))
			continue
		}
		if err := session.handleResponseCreate(create, eventID); err != nil {
			session.sendError(eventID, err)
		}
	}
}

func configureResponsesWSConnection(conn *websocket.Conn) error {
	if conn == nil {
		return errors.New("responses websocket connection is nil")
	}
	if err := conn.SetReadDeadline(time.Now().Add(responsesWSPongWait)); err != nil {
		return err
	}
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(responsesWSPongWait))
	})
	return nil
}

func (s *responsesWSSession) startKeepalive() {
	if s == nil || s.client == nil || s.done == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(responsesWSPingPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-s.done:
				return
			case now := <-ticker.C:
				deadline := now.Add(responsesWSWriteWait)
				if err := s.client.WriteControl(websocket.PingMessage, nil, deadline); err != nil {
					s.failCurrent()
					s.closeTarget()
					_ = s.client.Close()
					return
				}
				target := s.getTarget()
				if target == nil {
					continue
				}
				if err := target.WriteControl(websocket.PingMessage, nil, deadline); err != nil {
					s.failCurrent()
					s.closeTarget()
					_ = s.client.Close()
					return
				}
			}
		}
	}()
}

func (s *responsesWSSession) stopKeepalive() {
	if s == nil || s.done == nil {
		return
	}
	s.keepaliveOnce.Do(func() {
		close(s.done)
	})
}

func responsesWSEventType(message []byte) (string, error) {
	var event struct {
		Type string `json:"type"`
	}
	if err := common.Unmarshal(message, &event); err != nil {
		return "", fmt.Errorf("invalid websocket event json: %w", err)
	}
	if strings.TrimSpace(event.Type) == "" {
		return "", errors.New("websocket event type is required")
	}
	return event.Type, nil
}

func newResponsesWSInvalidRequestError(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

func normalizeResponsesWSCreateEvent(message []byte) (responsesWSCreateRequest, string, error) {
	var event responsesWSCreateEvent
	if err := common.Unmarshal(message, &event); err != nil {
		return responsesWSCreateRequest{}, "", err
	}
	if event.Type != responsesWSEventTypeResponseCreate {
		return responsesWSCreateRequest{}, event.EventID, fmt.Errorf("unsupported event type %q", event.Type)
	}

	var generate common.RawMessage
	var raw map[string]common.RawMessage
	if err := common.Unmarshal(message, &raw); err == nil {
		if generateRaw, ok := raw["generate"]; ok {
			generate = generateRaw
		}
	}
	payload := event.Request
	if len(payload) == 0 {
		if err := common.Unmarshal(message, &raw); err != nil {
			return responsesWSCreateRequest{}, event.EventID, err
		}
		delete(raw, "type")
		delete(raw, "event_id")
		delete(raw, "background")
		delete(raw, "generate")
		delete(raw, "stream")
		delete(raw, "stream_options")
		var err error
		payload, err = common.Marshal(raw)
		if err != nil {
			return responsesWSCreateRequest{}, event.EventID, err
		}
	} else {
		var responseMap map[string]common.RawMessage
		if err := common.Unmarshal(payload, &responseMap); err == nil {
			if len(generate) == 0 {
				if generateRaw, ok := responseMap["generate"]; ok {
					generate = generateRaw
				}
			}
			if _, exists := responseMap["generate"]; exists {
				delete(responseMap, "generate")
				if merged, err := common.Marshal(responseMap); err == nil {
					payload = merged
				}
			}
		}
	}
	if len(generate) > 0 && common.GetJsonType(generate) != "boolean" {
		return responsesWSCreateRequest{}, event.EventID, errors.New("generate must be a boolean")
	}

	var req dto.OpenAIResponsesRequest
	if err := common.Unmarshal(payload, &req); err != nil {
		return responsesWSCreateRequest{}, event.EventID, err
	}
	req.Stream = nil
	req.StreamOptions = nil
	return responsesWSCreateRequest{
		Request:  req,
		Generate: generate,
	}, event.EventID, nil
}

func (s *responsesWSSession) handleResponseCreate(create responsesWSCreateRequest, eventID string) *types.NewAPIError {
	req := create.Request
	if s.lockedModel != "" && req.Model != s.lockedModel {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("responses websocket connection is locked to model %q; got %q", s.lockedModel, req.Model),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	if s.hasCurrent() {
		return types.NewErrorWithStatusCode(
			errors.New("another response.create is already in progress on this websocket connection"),
			types.ErrorCodeInvalidRequest,
			http.StatusConflict,
			types.ErrOptionWithSkipRetry(),
		)
	}

	commitRate, apiErr := responsesWSCheckRateLimit(s.c)
	if apiErr != nil {
		return apiErr
	}

	if !s.hasTarget() {
		return s.connectAndSendFirst(create, commitRate)
	}

	state, payload, apiErr := s.prepareCall(create, commitRate)
	if apiErr != nil {
		commitRate(false)
		return apiErr
	}
	if !s.tryReserveCurrent(state) {
		state.refund(s.c)
		commitRate(false)
		return types.NewErrorWithStatusCode(
			errors.New("another response.create is already in progress on this websocket connection"),
			types.ErrorCodeInvalidRequest,
			http.StatusConflict,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if err := s.writeTarget(websocket.TextMessage, payload); err != nil {
		return s.handleTargetWriteFailureWithState(state, err)
	}
	return nil
}

func (s *responsesWSSession) handleControlEventWriteFailure(err error) *types.NewAPIError {
	apiErr := s.handleTargetWriteFailure(err)
	s.sendError("", apiErr)
	return nil
}

func (s *responsesWSSession) handleTargetWriteFailure(err error) *types.NewAPIError {
	s.closeTarget()
	apiErr := types.NewError(err, types.ErrorCodeBadResponse)
	apiErr, _ = s.processChannelError(s.lockedChannel, apiErr, nil)
	return apiErr
}

func (s *responsesWSSession) handleTargetWriteFailureWithState(state *responsesWSCallState, err error) *types.NewAPIError {
	s.finishCall(state, false)
	return s.handleTargetWriteFailure(err)
}

func (s *responsesWSSession) connectAndSendFirst(create responsesWSCreateRequest, commitRate responsesWSRateLimitCommit) *types.NewAPIError {
	req := create.Request
	if err := checkResponsesWSModelAccess(s.c, req.Model); err != nil {
		commitRate(false)
		return err
	}

	retryParam := &service.RetryParam{
		Ctx:                 s.c,
		TokenGroup:          common.GetContextKeyString(s.c, appconstant.ContextKeyUsingGroup),
		ModelName:           req.Model,
		AllowedChannelTypes: []int{appconstant.ChannelTypeOpenAI, appconstant.ChannelTypeCodex},
		Retry:               common.GetPointer(0),
	}
	if retryParam.TokenGroup == "" {
		retryParam.TokenGroup = common.GetContextKeyString(s.c, appconstant.ContextKeyTokenGroup)
	}

	var lastErr *types.NewAPIError
	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		channel, apiErr := selectResponsesWSChannel(s.c, req.Model, retryParam)
		if apiErr != nil {
			lastErr = apiErr
			break
		}
		addResponsesWSUsedChannel(s.c, channel.Id)
		connectionVersion := wsmanager.ChannelVersion(channel.Id)

		state, payload, apiErr := s.prepareCall(create, commitRate)
		if apiErr != nil {
			commitRate(false)
			return apiErr
		}

		adaptor := GetAdaptor(state.info.ApiType)
		if adaptor == nil {
			state.refund(s.c)
			apiErr = types.NewError(fmt.Errorf("invalid api type: %d", state.info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
			var shouldRetry bool
			lastErr, shouldRetry = s.processChannelError(channel, apiErr, retryParam)
			if !shouldRetry {
				break
			}
			continue
		}
		adaptor.Init(state.info)
		target, apiErr := dialResponsesWebSocketUpstream(s.c, adaptor, state.info)
		if apiErr != nil {
			state.refund(s.c)
			var shouldRetry bool
			lastErr, shouldRetry = s.processChannelError(channel, apiErr, retryParam)
			if !shouldRetry {
				break
			}
			continue
		}

		s.setTarget(target)
		if !s.tryReserveCurrent(state) {
			s.closeTarget()
			state.refund(s.c)
			commitRate(false)
			return types.NewErrorWithStatusCode(errors.New("another response.create is already in progress on this websocket connection"), types.ErrorCodeInvalidRequest, http.StatusConflict, types.ErrOptionWithSkipRetry())
		}
		if err := s.writeTarget(websocket.TextMessage, payload); err != nil {
			state.refund(s.c)
			s.clearCurrent(state)
			s.closeTarget()
			apiErr = types.NewError(err, types.ErrorCodeBadResponse)
			var shouldRetry bool
			lastErr, shouldRetry = s.processChannelError(channel, apiErr, retryParam)
			if !shouldRetry {
				break
			}
			continue
		}

		s.lockedModel = req.Model
		s.lockedChannel = channel
		if !s.registerChannelClose(channel.Id, connectionVersion) {
			return types.NewError(errors.New("responses websocket channel was closed while connecting"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
		}
		service.RecordChannelAffinity(s.c, channel.Id)
		s.startTargetReader()
		return nil
	}

	if lastErr == nil {
		lastErr = types.NewError(errors.New("failed to connect responses websocket upstream"), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	commitRate(false)
	return lastErr
}

func (s *responsesWSSession) processChannelError(channel *appmodel.Channel, apiErr *types.NewAPIError, retryParam *service.RetryParam) (*types.NewAPIError, bool) {
	if apiErr == nil {
		return nil, false
	}
	apiErr = service.NormalizeViolationFeeError(apiErr)
	statusCodeMapping := ""
	if s.c != nil {
		statusCodeMapping = s.c.GetString("status_code_mapping")
	}
	service.ResetStatusCode(apiErr, statusCodeMapping)
	if channel != nil && s.c != nil {
		service.ProcessChannelError(s.c, *types.NewChannelError(
			channel.Id,
			channel.Type,
			channel.Name,
			channel.ChannelInfo.IsMultiKey,
			common.GetContextKeyString(s.c, appconstant.ContextKeyChannelKey),
			channel.GetAutoBan(),
		), apiErr)
	}
	if retryParam == nil {
		return apiErr, false
	}
	return apiErr, service.ShouldRetryRelayError(s.c, apiErr, common.RetryTimes-retryParam.GetRetry())
}

func (s *responsesWSSession) prepareCall(create responsesWSCreateRequest, commitRate responsesWSRateLimitCommit) (*responsesWSCallState, []byte, *types.NewAPIError) {
	req := create.Request
	common.SetContextKey(s.c, appconstant.ContextKeyRequestStartTime, time.Now())
	relayInfo := relaycommon.GenRelayInfoResponses(s.c, &req)
	relayInfo.IsStream = true
	common.SetContextKey(s.c, appconstant.ContextKeyIsStream, true)
	relayInfo.RequestId = fmt.Sprintf("%s-ws-%d", relayInfo.RequestId, s.nextEventIndex)
	s.nextEventIndex++

	meta := req.GetTokenCountMeta()
	if setting.ShouldCheckPromptSensitive() && meta != nil {
		contains, words := service.CheckSensitiveText(meta.CombineText)
		if contains {
			return nil, nil, types.NewError(fmt.Errorf("user sensitive words detected: %s", strings.Join(words, ", ")), types.ErrorCodeSensitiveWordsDetected, types.ErrOptionWithSkipRetry())
		}
	}

	tokens, err := service.EstimateRequestToken(s.c, meta, relayInfo)
	if err != nil {
		return nil, nil, types.NewError(err, types.ErrorCodeCountTokenFailed)
	}
	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(s.c, relayInfo, tokens, meta)
	if err != nil {
		return nil, nil, types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
	}
	if !priceData.FreeModel {
		if apiErr := service.PreConsumeBilling(s.c, priceData.QuotaToPreConsume, relayInfo); apiErr != nil {
			return nil, nil, apiErr
		}
	}

	payload, apiErr := buildResponsesWSCreatePayload(s.c, relayInfo, req, create.Generate)
	if apiErr != nil {
		if relayInfo.Billing != nil {
			relayInfo.Billing.Refund(s.c)
		}
		return nil, nil, apiErr
	}

	return &responsesWSCallState{
		info:       relayInfo,
		usage:      &dto.Usage{},
		commitRate: commitRate,
	}, payload, nil
}

func buildResponsesWSCreatePayload(c *gin.Context, relayInfo *relaycommon.RelayInfo, req dto.OpenAIResponsesRequest, generate common.RawMessage) ([]byte, *types.NewAPIError) {
	relayInfo.InitChannelMeta(c)
	request, err := common.DeepCopy(&req)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("failed to copy responses request: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	if err := helper.ModelMappedHelper(c, relayInfo, request); err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(relayInfo)
	convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, relayInfo, *request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(relayInfo, convertedRequest)
	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, relayInfo.ChannelOtherSettings, relayInfo.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	jsonData, err = removeResponsesWSTransportFields(jsonData)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if len(relayInfo.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, relayInfo)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	event, err := buildResponsesWSCreateEvent(jsonData, generate)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	return event, nil
}

func buildResponsesWSCreateEvent(jsonData []byte, generate common.RawMessage) ([]byte, error) {
	var event map[string]common.RawMessage
	if err := common.Unmarshal(jsonData, &event); err != nil {
		return nil, err
	}
	typeData, err := common.Marshal(responsesWSEventTypeResponseCreate)
	if err != nil {
		return nil, err
	}
	event["type"] = typeData
	delete(event, "event_id")
	delete(event, "background")
	delete(event, "stream")
	delete(event, "stream_options")
	if len(generate) > 0 {
		event["generate"] = generate
	}
	return common.Marshal(event)
}

func removeResponsesWSTransportFields(jsonData []byte) ([]byte, error) {
	var data map[string]common.RawMessage
	if err := common.Unmarshal(jsonData, &data); err != nil {
		return jsonData, err
	}
	delete(data, "stream")
	delete(data, "stream_options")
	delete(data, "background")
	return common.Marshal(data)
}

func dialResponsesWebSocketUpstream(c *gin.Context, adaptor relaychannel.Adaptor, info *relaycommon.RelayInfo) (*websocket.Conn, *types.NewAPIError) {
	fullRequestURL, err := adaptor.GetRequestURL(info)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("get request url failed: %w", err), types.ErrorCodeDoRequestFailed)
	}
	fullRequestURL = toWebSocketURL(fullRequestURL)

	targetHeader := http.Header{}
	if err := adaptor.SetupRequestHeader(c, &targetHeader, info); err != nil {
		return nil, types.NewError(fmt.Errorf("setup request header failed: %w", err), types.ErrorCodeDoRequestFailed)
	}
	headerOverride, err := relaychannel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelHeaderOverrideInvalid)
	}
	for key, value := range headerOverride {
		targetHeader.Set(key, value)
	}
	applyResponsesWSUpstreamHeaders(targetHeader, info.ChannelType)

	dialer, err := service.GetWebSocketDialerWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("new proxy websocket dialer failed: %w", err), types.ErrorCodeDoRequestFailed)
	}
	targetConn, resp, err := dialer.DialContext(c.Request.Context(), fullRequestURL, targetHeader)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if resp != nil {
			statusCode = resp.StatusCode
			if resp.Body != nil {
				_ = resp.Body.Close()
			}
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("dial failed to %s: %w", relaycommon.SanitizeURLForLog(fullRequestURL), err), types.ErrorCodeDoRequestFailed, statusCode)
	}
	return targetConn, nil
}

func applyResponsesWSUpstreamHeaders(header http.Header, channelType int) {
	if channelType != appconstant.ChannelTypeCodex {
		return
	}
	// Codex uses a different beta contract for WebSocket transport than the
	// HTTP/SSE Responses endpoint configured by the adaptor.
	header.Set("OpenAI-Beta", responsesWSV2BetaHeaderValue)
}

func toWebSocketURL(raw string) string {
	switch {
	case strings.HasPrefix(raw, "https://"):
		return "wss://" + strings.TrimPrefix(raw, "https://")
	case strings.HasPrefix(raw, "http://"):
		return "ws://" + strings.TrimPrefix(raw, "http://")
	default:
		return raw
	}
}

func (s *responsesWSSession) startTargetReader() {
	target := s.getTarget()
	if target == nil {
		return
	}
	go func() {
		for {
			if err := target.SetReadDeadline(time.Now().Add(responsesWSPongWait)); err != nil {
				logger.LogError(s.c, "responses websocket upstream read deadline failed: "+err.Error())
				s.failCurrent()
				_ = s.client.Close()
				return
			}
			messageType, message, err := target.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					logger.LogError(s.c, "responses websocket upstream read failed: "+err.Error())
				}
				s.failCurrent()
				_ = s.client.Close()
				return
			}
			s.observeUpstreamMessage(message)
			if err := s.writeClient(messageType, message); err != nil {
				logger.LogError(s.c, "responses websocket client write failed: "+err.Error())
				s.failCurrent()
				s.closeTarget()
				return
			}
		}
	}()
}

func (s *responsesWSSession) observeUpstreamMessage(message []byte) {
	state := s.getCurrent()
	if state == nil {
		return
	}

	var streamResponse dto.ResponsesStreamResponse
	if err := common.Unmarshal(message, &streamResponse); err != nil {
		return
	}
	state.mu.Lock()
	if state.finished {
		state.mu.Unlock()
		return
	}
	state.info.SetFirstResponseTime()
	state.mu.Unlock()

	switch streamResponse.Type {
	case "response.completed", "response.done", "response.incomplete":
		s.applyTerminalResponseUsage(state, streamResponse.Response)
		s.finishCall(state, true)
	case "response.failed", "response.error", "response.cancelled", "response.canceled":
		s.finishCall(state, false)
	case "response.output_text.delta":
		state.mu.Lock()
		if !state.finished {
			state.outputText.WriteString(streamResponse.Delta)
		}
		state.mu.Unlock()
	case dto.ResponsesOutputTypeItemDone:
		if streamResponse.Item != nil {
			state.mu.Lock()
			defer state.mu.Unlock()
			if state.finished {
				return
			}
			switch streamResponse.Item.Type {
			case dto.BuildInCallWebSearchCall:
				state.info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
			case dto.BuildInCallFileSearchCall:
				state.info.CountBillableToolCall(dto.BuildInCallFileSearchCall, "")
			case dto.BuildInCallFunctionCall:
				state.info.CountBillableToolCall(dto.BuildInCallFunctionCall, streamResponse.Item.Name)
			case dto.ResponsesOutputTypeImageGenerationCall:
				state.images.Observe(streamResponse.Item, streamResponse.OutputIndex)
			}
		}
	case "error":
		s.finishCall(state, false)
	}
}

func (s *responsesWSSession) applyTerminalResponseUsage(state *responsesWSCallState, response *dto.OpenAIResponsesResponse) {
	if state == nil || response == nil {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.finished {
		return
	}
	if response.Usage != nil {
		service.ApplyResponsesUsage(state.usage, response.Usage)
	}
	if relaycommon.IsNonBillableResponsesStatus(response.Status) {
		state.images.Reset()
	} else {
		for i := range response.Output {
			idx := i
			state.images.Observe(&response.Output[i], &idx)
		}
	}
	state.images.Commit(state.info)
}

func (s *responsesWSSession) finishCall(state *responsesWSCallState, success bool) {
	if state == nil {
		return
	}
	state.finishOnce.Do(func() {
		defer s.clearCurrent(state)
		state.mu.Lock()
		state.finished = true
		if !success {
			state.mu.Unlock()
			state.refund(s.c)
			if state.commitRate != nil {
				state.commitRate(false)
			}
			return
		}

		if state.usage != nil && state.info != nil {
			if state.usage.CompletionTokens == 0 {
				if output := state.outputText.String(); output != "" {
					state.usage.CompletionTokens = service.CountTextToken(output, state.info.UpstreamModelName)
				}
			}
			if state.usage.PromptTokens == 0 && state.usage.CompletionTokens != 0 {
				state.usage.PromptTokens = state.info.GetEstimatePromptTokens()
			}
			if state.usage.TotalTokens == 0 {
				state.usage.TotalTokens = state.usage.PromptTokens + state.usage.CompletionTokens
			}
		}
		state.mu.Unlock()
		service.PostTextConsumeQuota(s.c, state.info, state.usage, nil)
		if state.commitRate != nil {
			state.commitRate(true)
		}
	})
}

func (state *responsesWSCallState) refund(c *gin.Context) {
	if state != nil && state.info != nil && state.info.Billing != nil {
		state.info.Billing.Refund(c)
	}
}

func (s *responsesWSSession) tryReserveCurrent(state *responsesWSCallState) bool {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	if s.current != nil {
		return false
	}
	s.current = state
	return true
}

func (s *responsesWSSession) hasCurrent() bool {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	return s.current != nil
}

func (s *responsesWSSession) clearCurrent(state *responsesWSCallState) bool {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	if state != nil && s.current != state {
		return false
	}
	s.current = nil
	return true
}

func (s *responsesWSSession) getCurrent() *responsesWSCallState {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	return s.current
}

func (s *responsesWSSession) failCurrent() {
	state := s.getCurrent()
	if state != nil {
		s.finishCall(state, false)
	}
}

func (s *responsesWSSession) writeClient(messageType int, message []byte) error {
	s.clientWriteMu.Lock()
	defer s.clientWriteMu.Unlock()
	if err := s.client.SetWriteDeadline(time.Now().Add(responsesWSWriteWait)); err != nil {
		return err
	}
	return s.client.WriteMessage(messageType, message)
}

func (s *responsesWSSession) hasTarget() bool {
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	return s.target != nil
}

func (s *responsesWSSession) getTarget() *websocket.Conn {
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	return s.target
}

func (s *responsesWSSession) setTarget(target *websocket.Conn) {
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	_ = configureResponsesWSConnection(target)
	s.target = target
}

func (s *responsesWSSession) writeTarget(messageType int, message []byte) error {
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	if s.target == nil {
		return errors.New("responses websocket upstream is not connected")
	}
	if err := s.target.SetWriteDeadline(time.Now().Add(responsesWSWriteWait)); err != nil {
		return err
	}
	return s.target.WriteMessage(messageType, message)
}

func (s *responsesWSSession) sendError(eventID string, apiErr *types.NewAPIError) {
	if apiErr == nil {
		return
	}
	payload, err := buildResponsesWSErrorPayload(eventID, apiErr)
	if err != nil {
		return
	}
	_ = s.writeClient(websocket.TextMessage, payload)
}

func buildResponsesWSErrorPayload(eventID string, apiErr *types.NewAPIError) ([]byte, error) {
	if apiErr == nil {
		return nil, errors.New("api error is nil")
	}
	status := apiErr.StatusCode
	if status == 0 {
		status = http.StatusInternalServerError
	}
	openaiErr := apiErr.ToOpenAIError()
	return common.Marshal(&responsesWSErrorEvent{
		Type:    "error",
		Status:  status,
		EventID: eventID,
		Error:   &openaiErr,
	})
}

func (s *responsesWSSession) closeTarget() {
	var target *websocket.Conn
	var unregister func()
	s.targetWriteMu.Lock()
	target = s.target
	s.target = nil
	unregister = s.unregister
	s.unregister = nil
	s.targetWriteMu.Unlock()
	if unregister != nil {
		unregister()
	}
	if target != nil {
		_ = target.Close()
	}
}

func (s *responsesWSSession) registerChannelClose(channelID int, version uint64) bool {
	unregister, registered := wsmanager.RegisterWithVersion(channelID, wsmanager.KindResponses, func(reason string) {
		s.closeForPolicy(reason)
	}, version)
	if !registered {
		return false
	}
	s.targetWriteMu.Lock()
	if s.unregister != nil {
		s.unregister()
	}
	s.unregister = unregister
	s.targetWriteMu.Unlock()
	return true
}

func (s *responsesWSSession) closeForPolicy(reason string) {
	s.closeOnce.Do(func() {
		s.failCurrent()
		deadline := time.Now().Add(time.Second)
		closeMessage := websocket.FormatCloseMessage(websocket.ClosePolicyViolation, reason)
		_ = s.client.WriteControl(websocket.CloseMessage, closeMessage, deadline)
		if target := s.getTarget(); target != nil {
			_ = target.WriteControl(websocket.CloseMessage, closeMessage, deadline)
		}
		s.closeTarget()
		_ = s.client.Close()
	})
}

func checkResponsesWSModelAccess(c *gin.Context, modelName string) *types.NewAPIError {
	if _, ok := common.GetContextKey(c, appconstant.ContextKeyTokenSpecificChannelId); ok {
		return nil
	}
	if !common.GetContextKeyBool(c, appconstant.ContextKeyTokenModelLimitEnabled) {
		return nil
	}
	raw, ok := common.GetContextKey(c, appconstant.ContextKeyTokenModelLimit)
	if !ok {
		return types.NewErrorWithStatusCode(errors.New("token has no model access"), types.ErrorCodeAccessDenied, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	tokenModelLimit, ok := raw.(map[string]bool)
	if !ok {
		tokenModelLimit = map[string]bool{}
	}
	matchName := ratio_setting.FormatMatchingModelName(modelName)
	if _, ok := tokenModelLimit[matchName]; !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("token is not allowed to use model %s", modelName), types.ErrorCodeAccessDenied, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	return nil
}

func selectResponsesWSChannel(c *gin.Context, modelName string, retryParam *service.RetryParam) (*appmodel.Channel, *types.NewAPIError) {
	if channelIdRaw, ok := common.GetContextKey(c, appconstant.ContextKeyTokenSpecificChannelId); ok {
		channelID, ok := channelIdRaw.(string)
		if !ok {
			return nil, types.NewErrorWithStatusCode(errors.New("invalid specified channel id"), types.ErrorCodeGetChannelFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		id, err := strconv.Atoi(channelID)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		channel, err := appmodel.GetChannelById(id, true)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeGetChannelFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if channel.Status != common.ChannelStatusEnabled {
			return nil, types.NewErrorWithStatusCode(errors.New("specified channel is disabled"), types.ErrorCodeGetChannelFailed, http.StatusForbidden, types.ErrOptionWithSkipRetry())
		}
		if !isResponsesWSChannelType(channel.Type) {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("responses websocket does not support specified channel type %d", channel.Type),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		if err := responsesWSSetupContext(c, channel, modelName); err != nil {
			return nil, err
		}
		return channel, nil
	}

	usingGroup := common.GetContextKeyString(c, appconstant.ContextKeyUsingGroup)
	if usingGroup == "" {
		usingGroup = retryParam.TokenGroup
	}

	if retryParam.GetRetry() == 0 {
		if preferredChannelID, found := service.GetPreferredChannelByAffinity(c, modelName, usingGroup); found {
			preferred, err := appmodel.CacheGetChannel(preferredChannelID)
			if err == nil && preferred != nil && preferred.Status == common.ChannelStatusEnabled && isResponsesWSChannelType(preferred.Type) {
				if usingGroup == "auto" {
					userGroup := common.GetContextKeyString(c, appconstant.ContextKeyUserGroup)
					for _, g := range service.GetRequestAutoGroups(c, userGroup) {
						if appmodel.IsChannelEnabledForGroupModel(g, modelName, preferred.Id) {
							common.SetContextKey(c, appconstant.ContextKeyAutoGroup, g)
							service.MarkChannelAffinityUsed(c, g, preferred.Id)
							if err := responsesWSSetupContext(c, preferred, modelName); err != nil {
								return nil, err
							}
							return preferred, nil
						}
					}
				} else if appmodel.IsChannelEnabledForGroupModel(usingGroup, modelName, preferred.Id) {
					service.MarkChannelAffinityUsed(c, usingGroup, preferred.Id)
					if err := responsesWSSetupContext(c, preferred, modelName); err != nil {
						return nil, err
					}
					return preferred, nil
				}
			}
		}
	}

	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, modelName, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（retry）", selectGroup, modelName), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if err := responsesWSSetupContext(c, channel, modelName); err != nil {
		return nil, err
	}
	return channel, nil
}

func isResponsesWSChannelType(channelType int) bool {
	return channelType == appconstant.ChannelTypeOpenAI || channelType == appconstant.ChannelTypeCodex
}

func addResponsesWSUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}
