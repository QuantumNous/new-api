package relay

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	appmodel "github.com/QuantumNous/new-api/model"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const responsesWSEventTypeResponseCreate = "response.create"

type responsesWSCreateEvent struct {
	Type    string          `json:"type"`
	EventID string          `json:"event_id,omitempty"`
	Request json.RawMessage `json:"response,omitempty"`
}

type responsesWSCreateRequest struct {
	Request  dto.OpenAIResponsesRequest
	Generate json.RawMessage
}

type responsesWSErrorEvent struct {
	Type    string             `json:"type"`
	Status  int                `json:"status"`
	EventID string             `json:"event_id,omitempty"`
	Error   *types.OpenAIError `json:"error"`
}

type responsesWSCallState struct {
	info       *relaycommon.RelayInfo
	usage      *dto.Usage
	outputText strings.Builder
	commitRate middleware.ModelRequestRateLimitCommit
}

type responsesWSSession struct {
	c              *gin.Context
	client         *websocket.Conn
	target         *websocket.Conn
	lockedModel    string
	lockedChannel  *appmodel.Channel
	nextEventIndex int

	clientWriteMu sync.Mutex
	targetWriteMu sync.Mutex
	stateMu       sync.Mutex
	current       *responsesWSCallState
}

func ResponsesWebSocketHelper(c *gin.Context, client *websocket.Conn) *types.NewAPIError {
	session := &responsesWSSession{
		c:      c,
		client: client,
	}
	defer session.closeTarget()
	defer session.failCurrent()

	for {
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
			if session.target == nil {
				session.sendError("", newResponsesWSInvalidRequestError(errors.New("first responses websocket event must be response.create")))
				continue
			}
			if err := session.writeTarget(messageType, message); err != nil {
				return session.handleTargetWriteFailure(err)
			}
			continue
		}

		create, eventID, err := normalizeResponsesWSCreateEvent(message)
		if err != nil {
			session.sendError("", newResponsesWSInvalidRequestError(err))
			continue
		}
		if create.Request.Model == "" {
			session.sendError(eventID, newResponsesWSInvalidRequestError(errors.New("model is required")))
			continue
		}
		if err := session.handleResponseCreate(create, eventID); err != nil {
			session.sendError(eventID, err)
		}
	}
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

	var generate json.RawMessage
	var raw map[string]json.RawMessage
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
		var responseMap map[string]json.RawMessage
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

	commitRate, apiErr := middleware.CheckModelRequestRateLimit(s.c)
	if apiErr != nil {
		return apiErr
	}

	if s.target == nil {
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

func (s *responsesWSSession) connectAndSendFirst(create responsesWSCreateRequest, commitRate middleware.ModelRequestRateLimitCommit) *types.NewAPIError {
	req := create.Request
	if err := checkResponsesWSModelAccess(s.c, req.Model); err != nil {
		commitRate(false)
		return err
	}

	retryParam := &service.RetryParam{
		Ctx:        s.c,
		TokenGroup: common.GetContextKeyString(s.c, appconstant.ContextKeyUsingGroup),
		ModelName:  req.Model,
		Retry:      common.GetPointer(0),
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

		if channel.Type != appconstant.ChannelTypeOpenAI && channel.Type != appconstant.ChannelTypeCodex {
			lastErr = types.NewErrorWithStatusCode(
				fmt.Errorf("responses websocket only supports OpenAI and Codex channels, got channel type %d", channel.Type),
				types.ErrorCodeInvalidRequest,
				http.StatusBadRequest,
				types.ErrOptionWithSkipRetry(),
			)
			continue
		}

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

		s.target = target
		if !s.tryReserveCurrent(state) {
			_ = target.Close()
			s.target = nil
			state.refund(s.c)
			commitRate(false)
			return types.NewErrorWithStatusCode(errors.New("another response.create is already in progress on this websocket connection"), types.ErrorCodeInvalidRequest, http.StatusConflict, types.ErrOptionWithSkipRetry())
		}
		if err := s.writeTarget(websocket.TextMessage, payload); err != nil {
			s.finishCall(state, false)
			_ = target.Close()
			s.target = nil
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

func (s *responsesWSSession) prepareCall(create responsesWSCreateRequest, commitRate middleware.ModelRequestRateLimitCommit) (*responsesWSCallState, []byte, *types.NewAPIError) {
	req := create.Request
	common.SetContextKey(s.c, appconstant.ContextKeyRequestStartTime, time.Now())
	relayInfo := relaycommon.GenRelayInfoResponses(s.c, &req)
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

func buildResponsesWSCreatePayload(c *gin.Context, relayInfo *relaycommon.RelayInfo, req dto.OpenAIResponsesRequest, generate json.RawMessage) ([]byte, *types.NewAPIError) {
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

func buildResponsesWSCreateEvent(jsonData []byte, generate json.RawMessage) ([]byte, error) {
	var event map[string]json.RawMessage
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
	var data map[string]any
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

	targetConn, resp, err := websocket.DefaultDialer.Dial(fullRequestURL, targetHeader)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if resp != nil {
			statusCode = resp.StatusCode
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("dial failed to %s: %w", fullRequestURL, err), types.ErrorCodeDoRequestFailed, statusCode)
	}
	return targetConn, nil
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
	target := s.target
	go func() {
		for {
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
	state.info.SetFirstResponseTime()

	var streamResponse dto.ResponsesStreamResponse
	if err := common.Unmarshal(message, &streamResponse); err != nil {
		return
	}

	switch streamResponse.Type {
	case "response.completed", "response.done", "response.incomplete":
		s.applyTerminalResponseUsage(state, streamResponse.Response)
		s.finishCall(state, true)
	case "response.failed", "response.cancelled", "response.canceled":
		s.finishCall(state, false)
	case "response.output_text.delta":
		state.outputText.WriteString(streamResponse.Delta)
	case dto.ResponsesOutputTypeItemDone:
		if streamResponse.Item != nil && streamResponse.Item.Type == dto.BuildInCallWebSearchCall {
			if state.info != nil && state.info.ResponsesUsageInfo != nil && state.info.ResponsesUsageInfo.BuiltInTools != nil {
				if webSearchTool, exists := state.info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearchPreview]; exists && webSearchTool != nil {
					webSearchTool.CallCount++
				}
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
	if response.Usage != nil {
		service.ApplyResponsesUsage(state.usage, response.Usage)
	}
	if response.HasImageGenerationCall() {
		s.c.Set("image_generation_call", true)
		s.c.Set("image_generation_call_quality", response.GetQuality())
		s.c.Set("image_generation_call_size", response.GetSize())
	}
}

func (s *responsesWSSession) finishCall(state *responsesWSCallState, success bool) {
	if state == nil {
		return
	}
	if !s.clearCurrent(state) {
		return
	}
	if !success {
		state.refund(s.c)
		if state.commitRate != nil {
			state.commitRate(false)
		}
		return
	}

	finalizeResponsesWSUsage(state)
	service.PostTextConsumeQuota(s.c, state.info, state.usage, nil)
	if state.commitRate != nil {
		state.commitRate(true)
	}
}

func finalizeResponsesWSUsage(state *responsesWSCallState) {
	if state == nil || state.usage == nil || state.info == nil {
		return
	}
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
	return s.client.WriteMessage(messageType, message)
}

func (s *responsesWSSession) writeTarget(messageType int, message []byte) error {
	s.targetWriteMu.Lock()
	defer s.targetWriteMu.Unlock()
	if s.target == nil {
		return errors.New("responses websocket upstream is not connected")
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
	if s.target != nil {
		_ = s.target.Close()
		s.target = nil
	}
}

func checkResponsesWSModelAccess(c *gin.Context, modelName string) *types.NewAPIError {
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
		if err := middleware.SetupContextForSelectedChannel(c, channel, modelName); err != nil {
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
			if err == nil && preferred != nil && preferred.Status == common.ChannelStatusEnabled {
				if usingGroup == "auto" {
					userGroup := common.GetContextKeyString(c, appconstant.ContextKeyUserGroup)
					for _, g := range service.GetUserAutoGroup(userGroup) {
						if appmodel.IsChannelEnabledForGroupModel(g, modelName, preferred.Id) {
							common.SetContextKey(c, appconstant.ContextKeyAutoGroup, g)
							service.MarkChannelAffinityUsed(c, g, preferred.Id)
							if err := middleware.SetupContextForSelectedChannel(c, preferred, modelName); err != nil {
								return nil, err
							}
							return preferred, nil
						}
					}
				} else if appmodel.IsChannelEnabledForGroupModel(usingGroup, modelName, preferred.Id) {
					service.MarkChannelAffinityUsed(c, usingGroup, preferred.Id)
					if err := middleware.SetupContextForSelectedChannel(c, preferred, modelName); err != nil {
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
	if err := middleware.SetupContextForSelectedChannel(c, channel, modelName); err != nil {
		return nil, err
	}
	return channel, nil
}

func addResponsesWSUsedChannel(c *gin.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}
