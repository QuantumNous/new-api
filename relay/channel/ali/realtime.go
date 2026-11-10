package ali

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// Qwen-Audio uses native PCM at 16 kHz input / 24 kHz output and plural
// input_tokens_details/output_tokens_details. Forward the original events so
// VAD, voiceprints, tool calls, languages and future extension fields survive.
// https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-audio-realtime-server-events
const aliRealtimeMaxMessageBytes = 16 << 20

type aliRealtimeSearchUsage struct {
	Count    int64  `json:"count"`
	Strategy string `json:"strategy"`
}

type aliRealtimePlugins struct {
	Search *aliRealtimeSearchUsage `json:"search"`
}

type aliRealtimeUsage struct {
	TotalTokens  int64 `json:"total_tokens"`
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	InputDetails struct {
		TextTokens  int64 `json:"text_tokens"`
		AudioTokens int64 `json:"audio_tokens"`
	} `json:"input_tokens_details"`
	OutputDetails struct {
		TextTokens  int64 `json:"text_tokens"`
		AudioTokens int64 `json:"audio_tokens"`
	} `json:"output_tokens_details"`
	Plugins aliRealtimePlugins `json:"plugins"`
}

type aliRealtimeSession struct {
	info              *relaycommon.RelayInfo
	usage             dto.RealtimeUsage
	responses         map[string]struct{}
	toolCounts        map[string]int
	outputPCM16       bool
	pendingResponse   bool
	activeResponseID  string
	awaitingResponses int
	bufferedAudio     bool
	pendingVAD        bool
	manualInput       bool
	outputDelivered   bool
}

// hasPendingResponse includes confirmed VAD speech for a later turn, but not
// unconfirmed microphone buffers, which may contain only filtered silence.
func (s *aliRealtimeSession) hasPendingResponse() bool {
	return s.pendingResponse || s.awaitingResponses > 0 || s.pendingVAD
}

// observeClientEvent records only successfully forwarded events. Manual audio
// commits do not start inference; response.create is required by Qwen's protocol.
func (s *aliRealtimeSession) observeClientEvent(message []byte) {
	var event struct {
		Type    string `json:"type"`
		Session struct {
			OutputFormat  string          `json:"output_audio_format"`
			TurnDetection json.RawMessage `json:"turn_detection"`
		} `json:"session"`
	}
	_ = common.Unmarshal(message, &event)
	switch event.Type {
	case "session.update":
		if event.Session.OutputFormat != "" {
			s.outputPCM16 = event.Session.OutputFormat == "pcm16"
		}
		if len(event.Session.TurnDetection) != 0 {
			s.manualInput = string(event.Session.TurnDetection) == "null"
		}
	case "input_audio_buffer.append":
		s.bufferedAudio = true
	case "response.create":
		s.awaitingResponses++
	}
}

// account records each completed upstream response once, preserving validated
// token usage even if its search counters or the next reservation are invalid.
func (s *aliRealtimeSession) account(c *gin.Context, message []byte) error {
	var event struct {
		Type     string `json:"type"`
		Reason   string `json:"reason"`
		Response *struct {
			ID      string             `json:"id"`
			Status  string             `json:"status"`
			Usage   *aliRealtimeUsage  `json:"usage"`
			Plugins aliRealtimePlugins `json:"plugins"`
		} `json:"response"`
	}
	if err := common.Unmarshal(message, &event); err != nil {
		return errors.New("invalid Qwen realtime event")
	}
	if event.Type != dto.RealtimeEventTypeResponseDone {
		switch event.Type {
		case "input_audio_buffer.speech_started":
			s.pendingVAD = true
		case "input_audio_buffer.speech_stopped":
			// A valid stopped turn still awaits inference. Smart-turn detection
			// explicitly reports discarded speech as turn_invalid.
			s.pendingVAD = event.Reason != "turn_invalid"
			s.bufferedAudio = false
		case "input_audio_buffer.committed":
			if !s.manualInput {
				s.pendingVAD = true
			}
		}
		if event.Type == "response.created" {
			s.awaitingResponses = max(s.awaitingResponses-1, 0)
			s.bufferedAudio = false
			s.pendingVAD = false
			if event.Response != nil {
				s.activeResponseID = event.Response.ID
			}
		}
		if s.manualInput && (event.Type == "input_audio_buffer.cleared" || event.Type == "input_audio_buffer.committed") {
			s.bufferedAudio = false
		}
		if event.Type == "response.created" || event.Type == "response.audio.delta" || event.Type == "response.text.delta" {
			s.pendingResponse = true
		}
		if event.Type == "response.audio.delta" || event.Type == "response.text.delta" {
			s.outputDelivered = true
		}
		return nil
	}
	if s.info.RealtimeBilling == nil {
		s.info.RealtimeBilling = &relaycommon.RealtimeBillingState{ToolPrices: make(map[string]float64)}
	}
	response := event.Response
	if response == nil {
		return errors.New("Qwen response.done is missing response")
	}
	if response.ID == "" || len(response.ID) > 256 {
		return errors.New("Qwen response.done has an invalid response ID")
	}
	if _, exists := s.responses[response.ID]; exists {
		return nil
	}
	if response.Usage == nil {
		if s.outputDelivered {
			s.info.RealtimeBilling.UsageIncomplete = true
		}
		s.finishResponse(response.ID)
		if response.Status == "cancelled" || response.Status == "failed" || response.Status == "incomplete" {
			s.responses[response.ID] = struct{}{}
			return nil
		}
		return errors.New("Qwen completed response is missing usage")
	}
	u := response.Usage
	values := []int64{u.TotalTokens, u.InputTokens, u.OutputTokens, u.InputDetails.TextTokens, u.InputDetails.AudioTokens, u.OutputDetails.TextTokens, u.OutputDetails.AudioTokens}
	for _, value := range values {
		if value < 0 || value > common.MaxQuota {
			return errors.New("Qwen realtime usage is outside the supported range")
		}
	}
	if u.InputTokens != u.InputDetails.TextTokens+u.InputDetails.AudioTokens ||
		u.OutputTokens != u.OutputDetails.TextTokens+u.OutputDetails.AudioTokens ||
		u.TotalTokens != u.InputTokens+u.OutputTokens {
		return errors.New("Qwen realtime token totals do not match their details")
	}
	s.finishResponse(response.ID)
	// Account tokens before validating plugins: a malformed/oversized search
	// count must not make an otherwise completed audio response free.
	counters := []*int{&s.usage.TotalTokens, &s.usage.InputTokens, &s.usage.OutputTokens,
		&s.usage.InputTokenDetails.TextTokens, &s.usage.InputTokenDetails.AudioTokens,
		&s.usage.OutputTokenDetails.TextTokens, &s.usage.OutputTokenDetails.AudioTokens}
	for i, counter := range counters {
		value, clamp := common.QuotaFromFloatChecked(float64(*counter) + float64(values[i]))
		*counter = value
		if s.info.QuotaClamp == nil {
			s.info.QuotaClamp = clamp
		}
	}
	if u.OutputDetails.AudioTokens > 0 {
		value, clamp := common.QuotaFromFloatChecked(float64(s.info.RealtimeBilling.AudioCompanionTextTokens) + float64(u.OutputDetails.TextTokens))
		s.info.RealtimeBilling.AudioCompanionTextTokens = value
		if s.info.QuotaClamp == nil {
			s.info.QuotaClamp = clamp
		}
	}
	s.responses[response.ID] = struct{}{}
	responseUsage := dto.RealtimeUsage{TotalTokens: int(u.TotalTokens), InputTokens: int(u.InputTokens), OutputTokens: int(u.OutputTokens),
		InputTokenDetails:  dto.InputTokenDetails{TextTokens: int(u.InputDetails.TextTokens), AudioTokens: int(u.InputDetails.AudioTokens)},
		OutputTokenDetails: dto.OutputTokenDetails{TextTokens: int(u.OutputDetails.TextTokens), AudioTokens: int(u.OutputDetails.AudioTokens)}}
	if responseUsage.OutputTokenDetails.AudioTokens > 0 {
		responseUsage.TotalTokens -= responseUsage.OutputTokenDetails.TextTokens
		responseUsage.OutputTokens -= responseUsage.OutputTokenDetails.TextTokens
		responseUsage.OutputTokenDetails.TextTokens = 0
	}
	billingErr := service.RecordRealtimeResponseBilling(s.info, response.ID, responseUsage)
	search := u.Plugins.Search
	if search == nil {
		search = response.Plugins.Search
	}
	searchKey, searchCount := "", 0
	if search != nil && search.Count != 0 {
		if search.Count < 0 || search.Count > relaycommon.MaxBillableToolCallCount {
			return errors.New("Qwen realtime search count is outside the supported range")
		}
		switch search.Strategy {
		case "turbo", "max", "agent", "agent_max":
			searchKey = "search_strategy_" + search.Strategy
		default:
			return errors.New("Qwen realtime search usage has an unknown pricing strategy")
		}
		searchCount = s.toolCounts[searchKey] + int(search.Count)
		if searchCount > relaycommon.MaxBillableToolCallCount {
			s.info.SetBillableToolCount(searchKey, relaycommon.MaxBillableToolCallCount)
			return errors.New("Qwen realtime session exceeded the supported search count")
		}
	}
	if searchKey != "" {
		s.toolCounts[searchKey] = searchCount
		s.info.SetBillableToolCount(searchKey, searchCount)
	}
	if billingErr != nil {
		return billingErr
	}
	return service.ReserveRealtimeQuota(c, s.info, &s.usage)
}

// finishResponse consumes only the completed inference, leaving subsequently
// buffered VAD audio and explicit response requests available for reconciliation.
func (s *aliRealtimeSession) finishResponse(id string) {
	if s.activeResponseID != "" && s.activeResponseID != id {
		return
	}
	if !s.pendingResponse {
		s.awaitingResponses = max(s.awaitingResponses-1, 0)
	}
	s.pendingResponse, s.outputDelivered = false, false
	s.activeResponseID = ""
}

// validateAliRealtimeEvent bounds client-controlled billing quantities and
// rejects input formats whose sample rate is incompatible with native Qwen.
func validateAliRealtimeEvent(message []byte) error {
	var event struct {
		Type     string                     `json:"type"`
		Session  map[string]json.RawMessage `json:"session"`
		Response map[string]json.RawMessage `json:"response"`
	}
	if err := common.Unmarshal(message, &event); err != nil || event.Type == "" {
		return errors.New("realtime events must be JSON objects with a type")
	}
	for _, fields := range []map[string]json.RawMessage{event.Session, event.Response} {
		if _, exists := fields["model"]; exists {
			return errors.New("select the realtime model in the URL, not inside an event")
		}
		for _, field := range []string{"max_tokens", "max_completion_tokens", "max_output_tokens", "max_response_output_tokens"} {
			raw, exists := fields[field]
			if !exists {
				continue
			}
			var value uint
			if err := common.Unmarshal(raw, &value); err != nil || helper.ExceedsMaxTokensLimit(&value) {
				return fmt.Errorf("invalid realtime %s", field)
			}
		}
		for _, field := range []string{"input_audio_format", "output_audio_format"} {
			if raw, exists := fields[field]; exists {
				var format string
				if err := common.Unmarshal(raw, &format); err != nil || format != "pcm" {
					return fmt.Errorf("Qwen %s must be pcm (16 kHz input, 24 kHz output, mono PCM16)", field)
				}
			}
		}
		if raw, exists := fields["speech_rate"]; exists {
			var rate float64
			if err := common.Unmarshal(raw, &rate); err != nil || rate < 0.5 || rate > 2 {
				return errors.New("Qwen realtime speech_rate must be between 0.5 and 2")
			}
		}
	}
	return nil
}

// translateFormats changes only the output codec label: OpenAI pcm16 and Qwen
// pcm both mean 24 kHz mono PCM16 output. Input pcm16 is deliberately rejected
// by validation because OpenAI's 24 kHz input is incompatible with Qwen's 16 kHz.
func (s *aliRealtimeSession) translateFormats(message []byte, upstream bool) ([]byte, error) {
	var event map[string]json.RawMessage
	if err := common.Unmarshal(message, &event); err != nil {
		return nil, err
	}
	var eventType string
	if err := common.Unmarshal(event["type"], &eventType); err != nil {
		return nil, errors.New("realtime events must have a string type")
	}
	field := "session"
	if !upstream && eventType == "response.create" {
		field = "response"
	} else if eventType != "session.update" && eventType != "session.created" && eventType != "session.updated" {
		return message, nil
	}
	var settings map[string]json.RawMessage
	if raw, ok := event[field]; !ok || common.Unmarshal(raw, &settings) != nil {
		return message, nil
	}
	var format string
	_ = common.Unmarshal(settings["output_audio_format"], &format)
	if upstream {
		if !s.outputPCM16 || format != "pcm" {
			return message, nil
		}
		settings["output_audio_format"] = json.RawMessage(`"pcm16"`)
	} else {
		if format != "pcm16" {
			return message, nil
		}
		settings["output_audio_format"] = json.RawMessage(`"pcm"`)
	}
	raw, err := common.Marshal(settings)
	if err != nil {
		return nil, err
	}
	event[field] = raw
	return common.Marshal(event)
}

// aliRealtimeTimeouts bounds lost-client detection and the final upstream
// usage reconciliation, independently of the lifetime of the HTTP request.
type aliRealtimeTimeouts struct {
	pingInterval time.Duration
	pongWait     time.Duration
	settleWait   time.Duration
}

// handleAliRealtimeResponse bridges a native Qwen session and returns its
// cumulative usage even after client disconnects or reservation failures.
func handleAliRealtimeResponse(c *gin.Context, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return relayAliRealtime(c, info, aliRealtimeTimeouts{20 * time.Second, 60 * time.Second, 10 * time.Second})
}

// relayAliRealtime forwards events with one writer per peer. A lost client
// stops new input, but leaves the upstream open for a bounded response.done
// reconciliation. Missing terminal usage retains the reservation and is audited.
func relayAliRealtime(c *gin.Context, info *relaycommon.RelayInfo, timeouts aliRealtimeTimeouts) (any, *types.NewAPIError) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return nil, types.NewErrorWithStatusCode(errors.New("invalid Qwen realtime connection"), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	info.IsStream = true
	info.InputAudioFormat, info.OutputAudioFormat = "pcm", "pcm"
	session := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	if info.RealtimeBilling == nil {
		info.RealtimeBilling = &relaycommon.RealtimeBillingState{ToolPrices: make(map[string]float64)}
	}
	clientDone := c.Request.Context().Done()
	_ = info.ClientWs.SetReadDeadline(time.Now().Add(timeouts.pongWait))
	info.ClientWs.SetPongHandler(func(string) error {
		return info.ClientWs.SetReadDeadline(time.Now().Add(timeouts.pongWait))
	})
	ping := time.NewTicker(timeouts.pingInterval)
	defer ping.Stop()
	var settleTimer *time.Timer
	var settleTimeout <-chan time.Time
	defer func() {
		if settleTimer != nil {
			settleTimer.Stop()
		}
	}()
	type packet struct {
		upstream bool
		kind     int
		data     []byte
		err      error
	}
	packets := make(chan packet, 8)
	var readers sync.WaitGroup
	for _, side := range []struct {
		conn     *websocket.Conn
		upstream bool
	}{{info.ClientWs, false}, {info.TargetWs, true}} {
		side.conn.SetReadLimit(aliRealtimeMaxMessageBytes)
		readers.Go(func() {
			for {
				kind, data, err := side.conn.ReadMessage()
				// Always deliver an already-read frame, including usage on disconnect.
				// The main goroutine drains this channel after closing both sockets.
				packets <- packet{upstream: side.upstream, kind: kind, data: data, err: err}
				if err != nil {
					return
				}
			}
		})
	}
	go func() {
		readers.Wait()
		close(packets)
	}()

	var relayErr error
	draining := false
	waitingForSpeech := false
	closeCode, closeText := websocket.CloseNormalClosure, ""
relayLoop:
	for {
		var clientErr error
		select {
		case <-settleTimeout:
			if session.hasPendingResponse() {
				relayErr = errors.New("Qwen realtime terminal usage was not received before the settlement deadline")
			}
			break relayLoop
		case <-clientDone:
			clientErr = c.Request.Context().Err()
		case <-ping.C:
			if !draining {
				clientErr = info.ClientWs.WriteControl(websocket.PingMessage, nil, time.Now().Add(time.Second))
			}
		case p, ok := <-packets:
			if !ok {
				break relayLoop
			}
			if p.err != nil {
				if p.upstream {
					var closed *websocket.CloseError
					if errors.As(p.err, &closed) && closed.Code != websocket.CloseAbnormalClosure && closed.Code != websocket.CloseNoStatusReceived {
						closeCode, closeText = closed.Code, closed.Text
					} else {
						closeCode = websocket.CloseInternalServerErr
						relayErr = p.err
					}
					break relayLoop
				}
				clientErr = p.err
			} else if p.upstream {
				if p.kind != websocket.TextMessage {
					relayErr = errors.New("Qwen realtime expects text JSON frames with Base64 audio")
					break relayLoop
				}
				info.SetFirstResponseTime()
				if err := session.account(c, p.data); err != nil {
					relayErr = err
					break relayLoop
				}
				if draining {
					if session.hasPendingResponse() {
						if waitingForSpeech {
							settleTimer.Reset(timeouts.settleWait)
							waitingForSpeech = false
						}
					} else if session.bufferedAudio && !session.manualInput {
						if !waitingForSpeech {
							settleTimer.Reset(min(time.Second, timeouts.settleWait))
							waitingForSpeech = true
						}
					} else {
						break relayLoop
					}
					continue
				}
				message, err := session.translateFormats(p.data, true)
				if err != nil {
					relayErr = err
					break relayLoop
				}
				_ = info.ClientWs.SetWriteDeadline(time.Now().Add(30 * time.Second))
				clientErr = info.ClientWs.WriteMessage(p.kind, message)
			} else if !draining {
				message, err := session.translateFormats(p.data, false)
				if p.kind != websocket.TextMessage {
					err = errors.New("Qwen realtime expects text JSON frames with Base64 audio")
				}
				if err == nil {
					err = validateAliRealtimeEvent(message)
				}
				if err != nil {
					_ = info.ClientWs.SetWriteDeadline(time.Now().Add(30 * time.Second))
					helper.WssError(c, info.ClientWs, types.OpenAIError{Message: err.Error(), Type: "invalid_request_error", Code: "invalid_request"})
					continue
				}
				_ = info.TargetWs.SetWriteDeadline(time.Now().Add(30 * time.Second))
				if err := info.TargetWs.WriteMessage(p.kind, message); err != nil {
					relayErr = err
					break relayLoop
				}
				session.observeClientEvent(p.data)
			}
		}
		if clientErr != nil && !draining {
			_ = info.ClientWs.Close()
			wait := timeouts.settleWait
			if !session.hasPendingResponse() {
				if !session.bufferedAudio || session.manualInput {
					break relayLoop
				}
				// Give queued upstream VAD events a brief chance to identify speech.
				// Silence alone must not retain a reservation or a missing-usage flag.
				wait = min(time.Second, wait)
				waitingForSpeech = true
			}
			draining = true
			clientDone = nil
			ping.Stop()
			// Probe the upstream while its last response is allowed to finish.
			// Do not cancel it: Qwen cancellation may omit billable usage.
			_ = info.TargetWs.WriteControl(websocket.PingMessage, nil, time.Now().Add(time.Second))
			settleTimer = time.NewTimer(wait)
			settleTimeout = settleTimer.C
		}
	}
	if relayErr != nil {
		closeCode = websocket.CloseInternalServerErr
		logger.LogWarn(c, common.LogText("realtime error: %s", relayErr.Error()))
		_ = info.ClientWs.SetWriteDeadline(time.Now().Add(time.Second))
		helper.WssError(c, info.ClientWs, types.OpenAIError{Message: "Qwen realtime session stopped: " + relayErr.Error(), Type: "server_error", Code: "realtime_error"})
	}
	// Never put reserved pseudo-codes such as 1006 onto the wire.
	_ = info.ClientWs.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(closeCode, closeText), time.Now().Add(time.Second))
	_ = info.TargetWs.Close()
	_ = info.ClientWs.Close()
	// Account for response.done frames already read before either peer closed.
	// All accounting stays on this goroutine, including the final drain.
	for p := range packets {
		if p.upstream && p.err == nil && p.kind == websocket.TextMessage {
			if err := session.account(c, p.data); err != nil {
				logger.LogWarn(c, common.LogText("realtime error: %s", err.Error()))
			}
		}
	}
	if session.hasPendingResponse() {
		info.RealtimeBilling.UsageIncomplete = true
		logger.LogWarn(c, "Qwen realtime usage is incomplete; retaining the existing reservation")
	}
	// Return accumulated usage even on disconnect/quota failure: WssHelper must
	// settle completed turns instead of refunding the whole conversation.
	return &session.usage, nil
}
