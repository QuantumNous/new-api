package openai

import (
	"context"
	"fmt"
	"strings"
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
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

type realtimeBillingTurn struct {
	info    *relaycommon.RelayInfo
	local   dto.RealtimeUsage
	eventID string
}

// All accounting and socket writes run on one event loop. Reader goroutines
// only deliver frames, so client audio and upstream usage cannot race.
func OpenaiRealtimeHandler(c *gin.Context, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.RealtimeUsage) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return types.NewError(fmt.Errorf("invalid websocket connection"), types.ErrorCodeBadResponse), nil
	}
	info.IsStream = true
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()
	stop := context.AfterFunc(ctx, func() { _ = info.ClientWs.Close(); _ = info.TargetWs.Close() })
	defer stop()
	type frame struct {
		upstream bool
		message  []byte
		err      error
	}
	frames := make(chan frame, 2)
	var readers sync.WaitGroup
	for _, upstream := range []bool{false, true} {
		conn := info.ClientWs
		if upstream {
			conn = info.TargetWs
		}
		readers.Go(func() {
			defer func() {
				if recovered := recover(); recovered != nil {
					cancel()
				}
			}()
			for {
				_, message, err := conn.ReadMessage()
				select {
				case frames <- frame{upstream, message, err}:
				case <-ctx.Done():
					return
				}
				if err != nil {
					return
				}
			}
		})
	}
	// Only creates awaiting acceptance belong in pending. A rejected create's
	// reservation can be reused, but cannot claim another request's response.
	var pending []*realtimeBillingTurn
	reusable := []*realtimeBillingTurn{{info: info}}
	active := make(map[string]*realtimeBillingTurn)
	completed := make(map[string]bool)
	total := &dto.RealtimeUsage{}
	bufferedInput := dto.RealtimeUsage{}
	defer func() {
		cancel()
		_ = info.ClientWs.Close()
		_ = info.TargetWs.Close()
		readers.Wait()
		for _, turn := range active {
			service.PostWssConsumeQuota(c, turn.info, turn.info.UpstreamModelName, &turn.local, nil)
		}
		for _, turns := range [][]*realtimeBillingTurn{pending, reusable} {
			for _, turn := range turns {
				if turn.local.TotalTokens > 0 {
					service.PostWssConsumeQuota(c, turn.info, turn.info.UpstreamModelName, &turn.local, nil)
				} else if turn.info.Billing != nil {
					turn.info.Billing.Refund(c)
				}
			}
		}
	}()
	for {
		var incoming frame
		select {
		case incoming = <-frames:
		case <-ctx.Done():
			return nil, total
		}
		if incoming.err != nil {
			return nil, total
		}
		var event dto.RealtimeEvent
		if err := common.Unmarshal(incoming.message, &event); err != nil {
			return types.NewError(err, types.ErrorCodeBadResponse), total
		}
		if !incoming.upstream {
			if event.Type == dto.RealtimeEventTypeSessionUpdate && event.Session != nil {
				info.RealtimeTools = event.Session.Tools
			}
			if event.Type == dto.RealtimeEventTypeResponseCreate {
				if len(reusable) == 0 {
					turn, apiErr := reserveRealtimeTurn(c, info)
					if apiErr != nil {
						_ = helper.WssObject(c, info.ClientWs, gin.H{"type": "error", "error": apiErr.ToOpenAIError()})
						return nil, total
					}
					reusable = append(reusable, turn)
				}
				turn := reusable[0]
				// A connection can start with a zero estimate. Ensure that its
				// first turn also reserves token quota before generation is requested.
				if apiErr := preConsumeRealtimeTurn(c, turn.info); apiErr != nil {
					_ = helper.WssObject(c, info.ClientWs, gin.H{"type": "error", "error": apiErr.ToOpenAIError()})
					return nil, total
				}

				// error.event_id refers to the client event, not the server
				// error envelope. Supply an ID when the client omitted one.
				if event.EventId == "" {
					event.EventId = common.NewRequestId()
					var err error
					incoming.message, err = sjson.SetBytes(incoming.message, "event_id", event.EventId)
					if err != nil {
						return types.NewError(err, types.ErrorCodeInvalidRequest), total
					}
				}
				turn.eventID = event.EventId
				pending = append(pending, turn)
				reusable = reusable[1:]
			}
			// Audio chunks and commits only fill input context. In particular,
			// continuous microphone audio must not reserve a second response.
			text, audio, err := service.CountTokenRealtime(info, event, info.UpstreamModelName)
			if err != nil {
				return types.NewError(err, types.ErrorCodeBadResponse), total
			}
			bufferedInput.InputTokenDetails.TextTokens += text
			bufferedInput.InputTokenDetails.AudioTokens += audio
			bufferedInput.InputTokens += text + audio
			bufferedInput.TotalTokens += text + audio
			if event.Type == "input_audio_buffer.clear" {
				bufferedInput.InputTokens -= bufferedInput.InputTokenDetails.AudioTokens
				bufferedInput.TotalTokens -= bufferedInput.InputTokenDetails.AudioTokens
				bufferedInput.InputTokenDetails.AudioTokens = 0
			}
			if err := helper.WssString(c, info.TargetWs, string(incoming.message)); err != nil {
				return nil, total
			}
			continue
		}
		if event.Type == dto.RealtimeEventTypeError {
			// Reuse only a rejected, not-yet-started generation. An unrelated
			// error must not release another turn's reservation.
			eventID := gjson.GetBytes(incoming.message, "error.event_id").String()
			rejectedIndex := -1
			if eventID != "" {
				for index, turn := range pending {
					if turn.eventID == eventID {
						rejectedIndex = index
						break
					}
				}
			} else if event.Error != nil && event.Error.Type == "invalid_request_error" && (event.Error.Param == "response" || strings.HasPrefix(event.Error.Param, "response.")) {
				// Some providers omit event_id. A response parameter error is
				// unambiguous only when exactly one create is awaiting acceptance.
				if len(pending) == 1 {
					rejectedIndex = 0
				}
			}
			if rejectedIndex >= 0 {
				rejected := pending[rejectedIndex]
				rejected.eventID = ""
				pending = append(pending[:rejectedIndex], pending[rejectedIndex+1:]...)
				reusable = append(reusable, rejected)
			}
		}

		if event.Type == dto.RealtimeEventTypeSessionUpdated || event.Type == dto.RealtimeEventTypeSessionCreated {
			if event.Session != nil {
				info.InputAudioFormat = common.GetStringIfEmpty(event.Session.InputAudioFormat, info.InputAudioFormat)
				info.OutputAudioFormat = common.GetStringIfEmpty(event.Session.OutputAudioFormat, info.OutputAudioFormat)
			}
		}
		// Input items can be confirmed before a response starts (or while a
		// preceding response is running). Keep them for the next generation's
		// fallback usage; they are never output tokens of the active response.
		if event.Type == dto.RealtimeEventConversationItemCreated {
			text, audio, err := service.CountTokenRealtime(info, event, info.UpstreamModelName)
			if err != nil {
				logger.LogWarn(c, err.Error())
			} else {
				bufferedInput.InputTokenDetails.TextTokens += text
				bufferedInput.InputTokenDetails.AudioTokens += audio
				bufferedInput.InputTokens += text + audio
				bufferedInput.TotalTokens += text + audio
			}
		}
		responseID := gjson.GetBytes(incoming.message, "response_id").String()
		if id := gjson.GetBytes(incoming.message, "response.id").String(); id != "" {
			responseID = id
		}
		if event.Type == "response.created" && active[responseID] == nil && !completed[responseID] {
			if len(pending) == 0 {
				// VAD/idle-timeout responses can be initiated by the provider.
				// Reserve before accepting their output and close on exhaustion.
				if len(reusable) == 0 {
					turn, apiErr := reserveRealtimeTurn(c, info)
					if apiErr != nil {
						_ = helper.WssObject(c, info.ClientWs, gin.H{"type": "error", "error": apiErr.ToOpenAIError()})
						return nil, total
					}
					reusable = append(reusable, turn)
				}
				pending = append(pending, reusable[0])
				reusable = reusable[1:]
			}
			if apiErr := preConsumeRealtimeTurn(c, pending[0].info); apiErr != nil {
				_ = helper.WssObject(c, info.ClientWs, gin.H{"type": "error", "error": apiErr.ToOpenAIError()})
				return nil, total
			}
			pending[0].local = bufferedInput
			pending[0].info.SetFirstResponseTime()
			bufferedInput = dto.RealtimeUsage{}
			active[responseID] = pending[0]
			pending = pending[1:]
		}
		turn := active[responseID]
		if turn == nil && len(active) == 1 {
			for _, candidate := range active {
				turn = candidate
			}
		}
		if event.Type == dto.RealtimeEventTypeResponseDone && !completed[responseID] {
			if turn == nil && len(pending) > 0 {
				turn = pending[0]
				turn.local = bufferedInput
				bufferedInput = dto.RealtimeUsage{}
				pending = pending[1:]
			}
			if turn != nil {
				turn.info.SetFirstResponseTime()
				usage := &turn.local
				if event.Response != nil && event.Response.Usage != nil {
					usage = event.Response.Usage
				}
				if responseID != "" {
					completed[responseID] = true
				}
				service.PostWssConsumeQuota(c, turn.info, turn.info.UpstreamModelName, usage, nil)
				total.TotalTokens += usage.TotalTokens
				total.InputTokens += usage.InputTokens
				total.OutputTokens += usage.OutputTokens
				for id, candidate := range active {
					if candidate == turn {
						delete(active, id)
					}
				}
			}
		} else if turn != nil && event.Type != dto.RealtimeEventConversationItemCreated {
			text, audio, err := service.CountTokenRealtime(info, event, info.UpstreamModelName)
			if err != nil {
				logger.LogWarn(c, err.Error())
			} else {
				turn.local.OutputTokenDetails.TextTokens += text
				turn.local.OutputTokenDetails.AudioTokens += audio
				turn.local.OutputTokens += text + audio
				turn.local.TotalTokens += text + audio
			}
		}
		if err := helper.WssString(c, info.ClientWs, string(incoming.message)); err != nil {
			return nil, total
		}
	}
}

// Each generation selects its funding source again, which preserves subscription
// fallback preferences and gives a new request its own calendar provenance.
func reserveRealtimeTurn(c *gin.Context, template *relaycommon.RelayInfo) (*realtimeBillingTurn, *types.NewAPIError) {
	info := *template
	info.RequestId = common.NewRequestId()
	info.ResetResponseTiming(time.Now())
	info.Billing = nil
	info.BillingSource = ""
	info.SubscriptionReceiptID = ""
	info.SubscriptionId = 0
	info.SubscriptionPreConsumed = 0
	info.SubscriptionPostDelta = 0
	info.FinalPreConsumedQuota = 0
	info.ForcePreConsume = true
	if apiErr := preConsumeRealtimeTurn(c, &info); apiErr != nil {
		return nil, apiErr
	}
	return &realtimeBillingTurn{info: &info}, nil
}

// A paid response needs a positive reservation even when its estimate is zero.
// Preserve negative estimates so the shared billing validator can reject them.
func preConsumeRealtimeTurn(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	if info.PriceData.FreeModel {
		return nil
	}
	amount := info.PriceData.QuotaToPreConsume
	if amount == 0 {
		amount = 1
	}
	return service.PreConsumeBilling(c, amount, info)
}
