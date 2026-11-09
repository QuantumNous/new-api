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
	info       *relaycommon.RelayInfo
	usage      dto.RealtimeUsage
	responses  map[string]struct{}
	toolCounts map[string]int
}

func (s *aliRealtimeSession) account(c *gin.Context, message []byte) error {
	var event struct {
		Type     string `json:"type"`
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
		return nil
	}
	response := event.Response
	if response == nil {
		return errors.New("Qwen response.done is missing response")
	}
	if response.Usage == nil {
		if response.Status == "cancelled" || response.Status == "failed" || response.Status == "incomplete" {
			return nil
		}
		return errors.New("Qwen completed response is missing usage")
	}
	if response.ID == "" || len(response.ID) > 256 {
		return errors.New("Qwen response.done has an invalid response ID")
	}
	if _, exists := s.responses[response.ID]; exists {
		return nil
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
			return errors.New("Qwen realtime session exceeded the supported search count")
		}
	}

	// Each response is bounded above; use checked accumulation for a long-lived
	// session too. Stop accepting new turns if any counter saturates.
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
	s.responses[response.ID] = struct{}{}
	if searchKey != "" {
		s.toolCounts[searchKey] = searchCount
		s.info.SetBillableToolCount(searchKey, searchCount)
	}
	return service.ReserveRealtimeQuota(c, s.info, &s.usage)
}

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

func handleAliRealtimeResponse(c *gin.Context, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return nil, types.NewErrorWithStatusCode(errors.New("invalid Qwen realtime connection"), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	info.IsStream = true
	info.InputAudioFormat, info.OutputAudioFormat = "pcm", "pcm"
	session := &aliRealtimeSession{info: info, responses: make(map[string]struct{}), toolCounts: make(map[string]int)}
	ctx := c.Request.Context()
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
relayLoop:
	for {
		select {
		case <-ctx.Done():
			break relayLoop
		case p, ok := <-packets:
			if !ok {
				break relayLoop
			}
			if p.err != nil {
				if !websocket.IsCloseError(p.err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					relayErr = p.err
				}
				break relayLoop
			}
			if p.kind != websocket.TextMessage {
				relayErr = errors.New("Qwen realtime expects text JSON frames with Base64 audio")
				break relayLoop
			}
			destination := info.TargetWs
			if p.upstream {
				info.SetFirstResponseTime()
				if err := session.account(c, p.data); err != nil {
					relayErr = err
					break relayLoop
				}
				destination = info.ClientWs
			} else if err := validateAliRealtimeEvent(p.data); err != nil {
				_ = info.ClientWs.SetWriteDeadline(time.Now().Add(30 * time.Second))
				helper.WssError(c, info.ClientWs, types.OpenAIError{Message: err.Error(), Type: "invalid_request_error", Code: "invalid_request"})
				continue
			}
			_ = destination.SetWriteDeadline(time.Now().Add(30 * time.Second))
			if err := destination.WriteMessage(p.kind, p.data); err != nil {
				relayErr = err
				break relayLoop
			}
		}
	}
	if relayErr != nil {
		logger.LogWarn(c, common.LogText("realtime error: %s", relayErr.Error()))
		_ = info.ClientWs.SetWriteDeadline(time.Now().Add(time.Second))
		helper.WssError(c, info.ClientWs, types.OpenAIError{Message: "Qwen realtime session stopped: " + relayErr.Error(), Type: "server_error", Code: "realtime_error"})
	}
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
	// Return accumulated usage even on disconnect/quota failure: WssHelper must
	// settle completed turns instead of refunding the whole conversation.
	return &session.usage, nil
}
