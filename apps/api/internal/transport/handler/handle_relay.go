package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/gateway"
	taskcap "github.com/QuantumNous/new-api/internal/task"
	taskdomain "github.com/QuantumNous/new-api/internal/task"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	usage "github.com/QuantumNous/new-api/internal/usage"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	catalog "github.com/QuantumNous/new-api/internal/catalog"
	"github.com/QuantumNous/new-api/internal/catalog/routestats"
	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	taskdto "github.com/QuantumNous/new-api/internal/dto"
	"github.com/QuantumNous/new-api/internal/logger"
	"github.com/QuantumNous/new-api/internal/relay"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/relay/helper"
	"github.com/QuantumNous/new-api/internal/transport/middleware"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/transport/middleware/status_code"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/samber/lo"

	"github.com/QuantumNous/new-api/internal/sensitive"
)

func relayHandler(c contract.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits:
		err = relay.ImageHelper(c, info)
	case relayconstant.RelayModeAudioSpeech:
		fallthrough
	case relayconstant.RelayModeAudioTranslation:
		fallthrough
	case relayconstant.RelayModeAudioTranscription:
		err = relay.AudioHelper(c, info)
	case relayconstant.RelayModeRerank:
		err = relay.RerankHelper(c, info)
	case relayconstant.RelayModeEmbeddings:
		err = relay.EmbeddingHelper(c, info)
	case relayconstant.RelayModeResponses, relayconstant.RelayModeResponsesCompact:
		err = relay.ResponsesHelper(c, info)
	case relayconstant.RelayModeAlphaSearch:
		err = relay.AlphaSearchHelper(c, info)
	default:
		err = relay.TextHelper(c, info)
	}
	return err
}

func geminiRelayHandler(c contract.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	var err *types.NewAPIError
	if strings.Contains(c.Path(), "embed") {
		err = relay.GeminiEmbeddingHandler(c, info)
	} else {
		err = relay.GeminiHelper(c, info)
	}
	return err
}

func Relay(c contract.Context, relayFormat types.RelayFormat) {

	requestId := c.GetString(common.RequestIdKey)
	//group := common.GetCtxKeyString(c, constant.ContextKeyUsingGroup)
	//originalModel := common.GetCtxKeyString(c, constant.ContextKeyOriginalModel)

	var (
		newAPIError *types.NewAPIError
		ws          relaycommon.WSConn
	)

	if relayFormat == types.RelayFormatOpenAIRealtime {
		// The only server-side WebSocket upgrade in the application, reached
		// solely for RelayFormatOpenAIRealtime on GET /v1/realtime. The
		// transport performs the handshake, so this works under either adapter
		// and the relay flow below stays straight-line code.
		//
		// The upgrade result is held in its concrete-typed variable and only
		// widened into ws on success. The contract guarantees a nil WSConn
		// exactly when the error is non-nil, and this shape keeps the guarantee
		// at the call site too: assigning a failed upgrade's result straight
		// into the interface could leave a non-nil interface holding a nil
		// pointer, turning the `if ws == nil` guards in WssError/WssString into
		// false and dereferencing nil on every failed handshake.
		//
		// A failed handshake is already answered by the upgrader's own HTTP
		// error response, so WssError writes nothing here: ws is nil and the
		// guard returns early. It is called for the logging side effect only.
		conn, err := c.UpgradeWebSocket("realtime")
		if err != nil {
			helper.WssError(c, ws, types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry()).ToOpenAIError())
			return
		}
		ws = conn
		defer conn.Close()
	}

	defer func() {
		if newAPIError != nil {
			logger.LogError(c.Context(), fmt.Sprintf("relay error: %s", common.LocalLogPreview(newAPIError.Error())))
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			// The failover loop's terminal 504 (relayFailoverExhausted
			// carrying RetryAfterSec) is the only response that carries a
			// Retry-After header; a stashed switchable-4xx passthrough stays
			// the upstream's error unmodified, without a hint of our own.
			var exhausted relayFailoverExhausted
			if errors.As(newAPIError.Err, &exhausted) && exhausted.RetryAfterSec > 0 {
				c.SetHeader("Retry-After", strconv.Itoa(exhausted.RetryAfterSec))
			}
			switch relayFormat {
			case types.RelayFormatOpenAIRealtime:
				helper.WssError(c, ws, newAPIError.ToOpenAIError())
			case types.RelayFormatClaude:
				_ = c.JSON(newAPIError.StatusCode, common.H{
					"type":  "error",
					"error": newAPIError.ToClaudeError(),
				})
			default:
				_ = c.JSON(newAPIError.StatusCode, common.H{
					"error": newAPIError.ToOpenAIError(),
				})
			}
		}
	}()

	request, err := helper.GetAndValidateRequest(c, relayFormat)
	if err != nil {
		// Map "request body too large" to 413 so clients can handle it correctly
		if common.IsRequestBodyTooLargeError(err) || errors.Is(err, common.ErrRequestBodyTooLarge) {
			newAPIError = types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
		} else {
			newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest)
		}
		return
	}

	relayInfo, err := gateway.GenRelayInfo(c, relayFormat, request, ws)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeGenRelayInfoFailed)
		return
	}

	needSensitiveCheck := sensitive.ShouldCheckPromptSensitive()
	needCountToken := constant.CountToken
	// Avoid building huge CombineText (strings.Join) when token counting and sensitive check are both disabled.
	var meta *types.TokenCountMeta
	if needSensitiveCheck || needCountToken {
		meta = request.GetTokenCountMeta()
	} else {
		meta = fastTokenCountMetaForPricing(request)
	}

	// 敏感内容静默过滤：目标域名与词库敏感词从请求文本中删除后照常转发，
	// 不再 403（攻击者无感知）。破甲组合层已随旧拦截路径一并删除。
	if needSensitiveCheck {
		if labels := sensitive.SanitizeRelayRequest(request); len(labels) > 0 {
			logger.LogInfo(c.Context(), fmt.Sprintf("input sanitized by sensitive filter: %s", strings.Join(labels, ",")))
			sensitive.RecordSensitiveBlock(c, "input", "sanitize:"+strings.Join(labels, ","), meta.CombineText)
			// 消息已被净化，按净化后文本重建 token 统计。
			meta = request.GetTokenCountMeta()
		}
	}

	tokens, err := relaycommon.EstimateRequestToken(c, meta, relayInfo)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeCountTokenFailed)
		return
	}

	// The channel system prompt is injected later by the relay helpers, but it
	// travels upstream and must be part of the reserved quota, the tier context
	// length and the local-count fallback. Reserve it here, before pre-consume.
	basePromptTokens := tokens
	tokens += channelSystemPromptTokenDelta(c, relayInfo)
	relayInfo.SetEstimatePromptTokens(tokens)

	priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError, types.ErrOptionWithStatusCode(http.StatusBadRequest))
		return
	}

	// common.SetCtxKey(c, constant.ContextKeyTokenCountMeta, meta)

	if priceData.FreeModel {
		logger.LogInfo(c.Context(), fmt.Sprintf("模型 %s 免费，跳过预扣费", relayInfo.OriginModelName))
	} else {
		newAPIError = billing.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)
		if newAPIError != nil {
			return
		}
	}

	defer func() {
		// Refund unconditionally whenever a session was pre-consumed: a panic
		// in any downstream helper still runs this defer with newAPIError==nil,
		// so gating on newAPIError would strand the pre-consumed quota. BillingSession.Refund
		// is a no-op once settled (success path) and idempotent, so calling it here is safe;
		// the FreeModel path leaves relayInfo.Billing nil and is guarded by the != nil check.
		if relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
		if newAPIError != nil {
			newAPIError = billing.NormalizeViolationFeeError(newAPIError)
			billing.ChargeViolationFeeIfNeeded(c, relayInfo, newAPIError)
		}
	}()

	retryParam := &catalog.SelectParams{
		Ctx:           c,
		TokenGroup:    relayInfo.TokenGroup,
		ModelName:     relayInfo.OriginModelName,
		RequestPath:   c.Path(),
		Retry:         common.GetPointer(0),
		ExcludeRoutes: make(map[catalog.RouteKey]bool),
	}
	relayInfo.RetryIndex = 0
	relayInfo.LastError = nil
	// Health accounting is deferred until the loop ends: a failure a retry
	// recovered from is not evidence against the channel. See
	// model.RecordRequestAttempts.
	var attempts []catalog.ChannelAttempt
	winnerID, requestSucceeded := 0, false
	defer func() {
		catalog.GetChannelHealthManager().RecordRequestAttempts(attempts, winnerID, relayInfo.OriginModelName, requestSucceeded)
	}()

	// The failover loop's state (mono dispatch::retry): the tried-exclusion
	// set is the request's ExcludeRoutes map — selection and the retry loop
	// consult the same set — plus the attempt cap and the hot-swapped
	// request-level time budget (failed attempt latency and cooldown waits
	// only; a successful attempt charges nothing).
	failover := catalog.NewFailover(failoverPolicy(), retryParam.ExcludeRoutes)

	// The local 429 of the last slot-full pass; when the pool exhausts
	// saturated it is the terminal authority instead of a failover
	// exhausted 503/504 wrap. A real pass (dial or success) clears it.
	var slotFullErr *types.NewAPIError

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		relayInfo.RetryIndex = retryParam.GetRetry()
		route, channelErr := getChannel(c, relayInfo, retryParam)
		if channelErr != nil {
			// mono's "no candidate" arm: when the whole pool for this model
			// is cooling and the shortest recovery cooldown fits the
			// request's failover time budget, sleep it out and clear the
			// tried set instead of terminating — the wait dials no upstream
			// and consumes no attempt slot. Retry-suppressed requests
			// (specific-channel replay, failed channel affinity) keep
			// today's no-wait passthrough: the suppressions are not
			// weakened.
			suppressed := catalog.ShouldSkipRetryAfterChannelAffinityFailure(c)
			if !suppressed {
				if _, ok := c.Get("specific_channel_id"); ok {
					suppressed = true
				}
			}
			if !suppressed {
				coolingMs := catalog.MinCooldownRemainingForModel(retryParam.TokenGroup, relayInfo.OriginModelName, retryParam.ExcludeRoutes, time.Now())
				if coolingMs > 0 && failover.WithinWaitBudget(coolingMs) {
					if interrupted := coolDownSleep(c, time.Duration(coolingMs)*time.Millisecond); interrupted {
						// The client went away while we waited: report the
						// selection failure (quota refund still applies via
						// the defers) and stop.
						newAPIError = channelErr
						break
					}
					failover.ChargeWait(coolingMs)
					// Waiting out a recovery re-opens the cooled units
					// (mono's "tolerate the connection time"): without the
					// reset the wait would be pointless, since the recovered
					// candidates would still be excluded.
					failover.ResetTried()
					retryParam.ResetRetryNextTry() // this pass consumed no attempt
					continue
				}
				// No wait available: the last slot-full pass's local 429
				// wins (the pool saturated — nothing failed upstream), else a
				// stashed switchable-4xx passes through unmodified, else 504
				// + Retry-After while any unit is cooling, 503 when nothing
				// is (mono's terminal split).
				newAPIError = terminalFailoverError(slotFullErr, failover.TakeStashed(), coolingMs)
			} else {
				// Suppressed passes keep today's no-wait passthrough; only a
				// pool saturation (our local gate, not an upstream failure)
				// replaces the raw selection error with its 429.
				if slotFullErr != nil {
					newAPIError = slotFullErr
				} else {
					newAPIError = channelErr
				}
			}
			logger.LogError(c.Context(), channelErr.Error())
			break
		}
		// The attempt slot is consumed only when we are about to dial the
		// upstream (mono: next_attempt fires at select-success, not at the
		// loop top); wait passes stay slot-free.
		if !failover.NextAttempt() {
			coolingMs := catalog.MinCooldownRemainingForModel(retryParam.TokenGroup, relayInfo.OriginModelName, retryParam.ExcludeRoutes, time.Now())
			newAPIError = terminalFailoverError(slotFullErr, failover.TakeStashed(), coolingMs)
			break
		}
		// Concurrency slots (mono stage_concurrency): the global pool
		// first, then the selected upstream key's pool, both try-only.
		// A full pool rejects this attempt with a local 429 — not an
		// upstream failure: no health-table outcome, no route-stats
		// charge, no channel-fault processing. The pass mirrors the
		// cooldown-wait pass: the unit is marked tried, no attempt slot.
		release, slotsAcquired := catalog.AcquireRelaySlots(catalog.ChannelKey{ChannelId: route.ChannelId, KeyIndex: route.KeyIndex})
		if !slotsAcquired {
			failover.MarkTried(catalog.RouteKey{ChannelId: route.ChannelId, KeyIndex: route.KeyIndex, Model: route.Alias})
			failover.ClearStash()
			slotFullErr = newConcurrencySlotFullError()
			retryParam.ResetRetryNextTry() // this pass consumed no attempt
			continue
		}
		// A real pass — success or an upstream failure — owns the terminal
		// error from here on. The slots release via this defer on every
		// terminal path (the success return, the terminal breaks) after
		// the attempt's handler has consumed the upstream response; the
		// retry path below releases them explicitly instead.
		slotFullErr = nil
		defer release()
		channel := route.Channel
		// Each attempt may land on a channel with a different system prompt, so
		// the fallback estimate follows the channel that is actually dialed.
		relayInfo.SetEstimatePromptTokens(basePromptTokens + channelSystemPromptTokenDelta(c, relayInfo))
		if billingErr := billing.PrepareTieredBillingForSelectedGroup(c, relayInfo); billingErr != nil {
			newAPIError = billingErr
			break
		}

		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			// Ensure consistent 413 for oversized bodies even when error occurs later (e.g., retry path)
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
			} else {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			break
		}
		c.ResetBody(io.NopCloser(bodyStorage))

		attemptStart := time.Now()

		switch relayFormat {
		case types.RelayFormatOpenAIRealtime:
			newAPIError = relay.WssHelper(c, relayInfo)
		case types.RelayFormatClaude:
			newAPIError = relay.ClaudeHelper(c, relayInfo)
		case types.RelayFormatGemini:
			newAPIError = geminiRelayHandler(c, relayInfo)
		default:
			newAPIError = relayHandler(c, relayInfo)
		}

		attemptLatencyMs := time.Since(attemptStart).Seconds() * 1000
		handle := relayInfo.StatsHandle
		routeKey := catalog.RouteKey{ChannelId: route.ChannelId, KeyIndex: route.KeyIndex, Model: route.Alias}

		// observeAttemptTiming feeds the latency-family EWMAs. It is deliberately
		// NOT called for neutral outcomes: a user 4xx or a client cancel says
		// nothing about the route, and charging its timing would let a caller's
		// own aborted request move the route's score.
		observeAttemptTiming := func() {
			if handle == nil {
				return
			}
			if ttftMs, ok := attemptTTFTMs(relayInfo, attemptStart); ok {
				handle.ObserveTTFT(ttftMs)
			}
			handle.ObserveLatency(attemptLatencyMs)
		}

		if newAPIError == nil && relayInfo.SettledUpstreamFailure {
			// Billing already settled the charge for this upstream stream cut,
			// so the attempt is terminal: retrying would append a second answer
			// after content the client already received, and refunding would
			// undo the settlement. The upstream still cut the stream, so both
			// health ledgers must see a failed attempt instead of the success
			// newAPIError == nil suggests.
			settledErr := settledUpstreamFailureError()
			attempts = append(attempts, catalog.ChannelAttempt{
				ChannelID: channel.Id,
				ModelName: relayInfo.OriginModelName,
				Outcome:   catalog.OutcomeFatal,
			})
			if healthErr := catalog.ReportOutcome(routeKey, catalog.ClassifyUnitOutcome(settledErr, channel.Id), 0, -1, time.Now()); healthErr != nil {
				logger.LogError(c.Context(), fmt.Sprintf("record unit outcome failed: %s", healthErr.Error()))
			}
			routeStats := classifyRouteStatsOutcome(settledErr)
			if handle != nil {
				if routeStats == routeStatsFatal {
					observeAttemptTiming()
					handle.ObserveSuccess(routestats.FatalObservation)
				}
				routestats.RecordAttempt(requestId, relayInfo.RetryIndex, handle.Key(),
					routestats.AuditOutcomeFromRouteStats(int(routeStats)),
					c.Header("X-Request-Id"), common.GetCtxKeyString(c, constant.ContextKeyRoutePath), relayInfo.UsingGroup)
			}
			gopool.Go(func() {
				usage.RecordRelaySample(relayInfo, false, 0)
			})
			return
		}

		if newAPIError == nil {
			// Two independent signals are charged for one attempt, and both must
			// fire. The soft signal (#405 EWMA) only nudges a continuous
			// preference inside [0.5, 1.5]; the hard signal (#368 state machine)
			// owns discrete isolation and is the only thing that can zero a route
			// out. Recording one and not the other silently disables half the
			// scheduler.
			observeAttemptTiming()
			if handle != nil {
				handle.ObserveSuccess(routestats.SuccessObservation)
			}
			if healthErr := catalog.ReportOutcome(routeKey, catalog.UnitSuccess, int64(attemptLatencyMs), -1, time.Now()); healthErr != nil {
				logger.LogError(c.Context(), fmt.Sprintf("record unit outcome failed: %s", healthErr.Error()))
			}
			if handle != nil {
				routestats.RecordAttempt(requestId, relayInfo.RetryIndex, handle.Key(), routestats.AuditOutcomeSuccess,
					c.Header("X-Request-Id"), common.GetCtxKeyString(c, constant.ContextKeyRoutePath), relayInfo.UsingGroup)
			}
			relayInfo.LastError = nil
			winnerID, requestSucceeded = channel.Id, true
			return
		}

		newAPIError = billing.NormalizeViolationFeeError(newAPIError)
		relayInfo.LastError = newAPIError

		// Classify by what the failure implies about the channel, not by whether the
		// error code happens to carry a "channel:" prefix. Upstream 5xx and empty
		// bodies are the channel's fault, 429 means it is merely throttled, and a
		// 4xx such as 400 is the caller's problem and must not cost the channel.
		outcome := catalog.ClassifyChannelOutcome(newAPIError, channel.Id)
		attempts = append(attempts, catalog.ChannelAttempt{ChannelID: channel.Id, ModelName: relayInfo.OriginModelName, Outcome: outcome})
		// The exclusion set follows the failover classification, not the
		// channel-level outcome ledger (mono: Retryable, Throttled and
		// FatalButSwitchable all mark_tried). A single upstream 401/403/404
		// is Neutral in the channel ledger yet disqualifies exactly this
		// route unit for the rest of the request; gating exclusion on the
		// channel ledger let a dead-key unit be re-dialed on the next
		// attempt. Route-UNIT granularity: a dead key never excludes its
		// siblings on the same channel.
		kind := classifyAttempt(newAPIError)
		if kind == relayAttemptRetryable || kind == relayAttemptThrottled || kind == relayAttemptFatalSwitchable {
			if retryParam.ExcludeRoutes != nil {
				failover.MarkTried(routeKey)
			}
		}
		// The unit machine consumes every attempt, terminal or switchable —
		// mono's retry loop reports the health result before deciding whether
		// the loop continues, so a terminal failure still cools its unit.
		// The channel-level outcome ledger below keeps its own independent
		// classification for the fallback family.
		// The upstream throttle hint: the parsed Retry-After in ms, -1 =
		// no hint (the state machine's "no hint" marker).
		retryAfterMs := int64(-1)
		if newAPIError.RetryAfterMs > 0 {
			retryAfterMs = newAPIError.RetryAfterMs
		}
		healthErr := catalog.ReportOutcome(routeKey, catalog.ClassifyUnitOutcome(newAPIError, channel.Id), 0, retryAfterMs, time.Now())
		if healthErr != nil {
			logger.LogError(c.Context(), fmt.Sprintf("record unit outcome failed: %s", healthErr.Error()))
		}
		processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetCtxKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		// Route stats are charged per attempt, and a failed attempt still feeds the
		// latency family so a route that fails fast cannot look like the fastest
		// route in the pool. A 429 is derated rather than zeroed because the route
		// is busy, not broken; a caller's own 4xx says nothing about the route and
		// is recorded as nothing at all.
		if handle != nil {
			switch classifyRouteStatsOutcome(newAPIError) {
			case routeStatsThrottled:
				// Observe429 folds in the synthetic TTFT penalty itself, so the
				// observed timing must not be charged a second time here. The
				// derate clamp wants the upstream Retry-After hint in seconds;
				// 0 = no hint (today's value).
				handle.Observe429(int(newAPIError.RetryAfterMs / 1000))
			case routeStatsFatal:
				observeAttemptTiming()
				handle.ObserveSuccess(routestats.FatalObservation)
			}
			routestats.RecordAttempt(requestId, relayInfo.RetryIndex, handle.Key(),
				routestats.AuditOutcomeFromRouteStats(int(classifyRouteStatsOutcome(newAPIError))),
				c.Header("X-Request-Id"), common.GetCtxKeyString(c, constant.ContextKeyRoutePath), relayInfo.UsingGroup)
		}

		switch kind {
		case relayAttemptRetryable, relayAttemptThrottled:
			// A later generic failure supersedes the stashed channel-scoped
			// 4xx: only the last attempt's failure decides the terminal error.
			failover.ClearStash()
		case relayAttemptFatalSwitchable:
			// The last switchable-4xx wins on exhaustion: it passes through
			// to the client instead of being disguised as a 503/504.
			failover.StoreSwitchable(newAPIError)
		}
		switchable := kind == relayAttemptRetryable || kind == relayAttemptThrottled || kind == relayAttemptFatalSwitchable
		if !switchable || !wouldRetryWithOneBudget(c, newAPIError) {
			// Caller-side 4xx, a canceled request, or the admin's status-range
			// gate / skip-retry rules: no candidate switch can help, so the
			// last failure passes through exactly as today.
			break
		}
		// A failed attempt's latency is the only non-wait charge to the
		// failover time budget (mono S2: a successful attempt never charges).
		// The attempt's slots go back now so the next candidate — usually
		// a different upstream key — can take them; terminal paths release
		// via the acquire-time defer, and the permit's sync.Once absorbs
		// whichever ordering the two paths produce.
		release()
		failover.ChargeFailed(int64(attemptLatencyMs))
		if failover.OverBudget() {
			coolingMs := catalog.MinCooldownRemainingForModel(retryParam.TokenGroup, relayInfo.OriginModelName, retryParam.ExcludeRoutes, time.Now())
			newAPIError = terminalFailoverError(slotFullErr, failover.TakeStashed(), coolingMs)
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c.Context(), retryLogStr)
	}
	if newAPIError != nil {
		gopool.Go(func() {
			usage.RecordRelaySample(relayInfo, false, 0)
		})
	}
}

// settledUpstreamFailureError synthesizes the 502 that classifies an already
// settled upstream cut for the unit state machine and the route-stats EWMA.
// Billing settled the charge before the relay loop saw the attempt, so this
// error is never returned to the client, retried, or refunded; it exists only
// so the standard 5xx failure classification applies unchanged.
func settledUpstreamFailureError() *types.NewAPIError {
	return types.NewOpenAIError(
		errors.New("upstream stream closed before the answer was complete"),
		types.ErrorCodeBadResponse, http.StatusBadGateway)
}

func addUsedChannel(c contract.Context, channelId int) {
	useChannel := c.GetStringSlice("use_channel")
	useChannel = append(useChannel, fmt.Sprintf("%d", channelId))
	c.Set("use_channel", useChannel)
}

// channelSystemPromptTokenDelta returns how many input tokens the channel-level
// system prompt will add to the request actually sent upstream. The injection
// helpers run after pre-consume, so without this delta the reserved quota, the
// tier context length and the local-count fallback would all bill the request
// as if the channel prompt did not exist.
func channelSystemPromptTokenDelta(c contract.Context, info *relaycommon.RelayInfo) int {
	if info == nil || catalog.GetGlobalSettings().PassThroughRequestEnabled {
		return 0
	}
	setting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	if !ok || setting.PassThroughBodyEnabled {
		return 0
	}
	systemPrompt := setting.ResolveSystemPrompt(info.OriginModelName)
	if systemPrompt == "" || !carriesChannelSystemPrompt(info.Request) {
		return 0
	}
	model := common.GetCtxKeyString(c, constant.ContextKeyOriginalModel)
	delta := relaycommon.CountTextToken(systemPrompt, model)
	if _, ok := info.Request.(*dto.GeneralOpenAIRequest); ok {
		// Only chat-completions requests carry the injected system message; a
		// legacy completions request would drop it upstream.
		if info.RelayMode != relayconstant.RelayModeChatCompletions {
			return 0
		}
		// The chat format wraps the prompt in a system message and the estimate
		// charges three formatting tokens per message, so reserve that here too.
		delta += 3
	}
	if setting.UserSystemPromptOverride {
		// Override drops the caller's own system prompt, so its tokens do not
		// travel upstream and must not stay in the reserved count.
		delta -= userSystemPromptTokens(info.Request, model)
	}
	if delta < 0 {
		return 0
	}
	return delta
}

// carriesChannelSystemPrompt reports whether the relay helpers inject the
// channel system prompt for this request type.
func carriesChannelSystemPrompt(request dto.Request) bool {
	switch request.(type) {
	case *dto.GeneralOpenAIRequest, *dto.ClaudeRequest, *dto.GeminiChatRequest,
		*dto.OpenAIResponsesRequest, *dto.OpenAIResponsesCompactionRequest:
		return true
	default:
		return false
	}
}

// userSystemPromptTokens counts the caller-provided system prompt that
// UserSystemPromptOverride replaces, using the same tokenizer as the estimate.
func userSystemPromptTokens(request dto.Request, model string) int {
	switch req := request.(type) {
	case *dto.GeneralOpenAIRequest:
		for _, message := range req.Messages {
			if message.Role != req.GetSystemRoleName() {
				continue
			}
			return openAISystemMessageTokens(&message, model)
		}
		return 0
	case *dto.ClaudeRequest:
		tokens := 0
		for _, content := range req.ParseSystem() {
			tokens += relaycommon.CountTextToken(content.GetText(), model)
		}
		return tokens
	case *dto.GeminiChatRequest:
		if req.SystemInstructions == nil {
			return 0
		}
		tokens := 0
		for _, part := range req.SystemInstructions.Parts {
			tokens += relaycommon.CountTextToken(part.Text, model)
		}
		return tokens
	case *dto.OpenAIResponsesRequest:
		return instructionsTokens(req.Instructions, model)
	case *dto.OpenAIResponsesCompactionRequest:
		return instructionsTokens(req.Instructions, model)
	default:
		return 0
	}
}

func openAISystemMessageTokens(message *dto.Message, model string) int {
	tokens := 3
	if message.IsStringContent() {
		return tokens + relaycommon.CountTextToken(message.StringContent(), model)
	}
	for _, part := range message.ParseContent() {
		if part.Type == dto.ContentTypeText {
			tokens += relaycommon.CountTextToken(part.Text, model)
		}
	}
	return tokens
}

func instructionsTokens(instructions json.RawMessage, model string) int {
	if len(instructions) == 0 {
		return 0
	}
	var text string
	if err := common.Unmarshal(instructions, &text); err != nil {
		return 0
	}
	return relaycommon.CountTextToken(text, model)
}

func fastTokenCountMetaForPricing(request dto.Request) *types.TokenCountMeta {
	if request == nil {
		return &types.TokenCountMeta{}
	}
	meta := &types.TokenCountMeta{
		TokenType: types.TokenTypeTokenizer,
	}
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		maxCompletionTokens := lo.FromPtrOr(r.MaxCompletionTokens, uint(0))
		maxTokens := lo.FromPtrOr(r.MaxTokens, uint(0))
		if maxCompletionTokens > maxTokens {
			meta.MaxTokens = int(maxCompletionTokens)
		} else {
			meta.MaxTokens = int(maxTokens)
		}
	case *dto.OpenAIResponsesRequest:
		meta.MaxTokens = int(lo.FromPtrOr(r.MaxOutputTokens, uint(0)))
	case *dto.ClaudeRequest:
		meta.MaxTokens = int(lo.FromPtr(r.MaxTokens))
	case *dto.ImageRequest:
		// Pricing for image requests depends on ImagePriceRatio; safe to compute even when CountToken is disabled.
		return r.GetTokenCountMeta()
	default:
		// Best-effort: leave CombineText empty to avoid large allocations.
	}
	return meta
}

// attemptTTFTMs reports the time-to-first-token of THIS attempt, and whether it
// is chargeable at all.
//
// StartTime is whole-request scoped, so subtracting it would bill a retry for
// every millisecond its failed predecessors burned. attemptStart is the only
// origin that belongs to the attempt being scored.
//
// The After(attemptStart) guard is the second half: isFirstResponse is armed once
// when RelayInfo is built and cleared by the first SetFirstResponseTime, with no
// per-attempt reset. Once any attempt has streamed a chunk the timestamp is
// frozen, so a later attempt would otherwise re-charge a stale value — and
// ObserveTTFT is peak-sensitive, so the worst sibling's latency would stick to
// every route the request touched afterwards.
func attemptTTFTMs(info *relaycommon.RelayInfo, attemptStart time.Time) (float64, bool) {
	if info == nil || !info.IsStream || !info.HasSendResponse() {
		return 0, false
	}
	if !info.FirstResponseTime.After(attemptStart) {
		return 0, false
	}
	return info.FirstResponseTime.Sub(attemptStart).Seconds() * 1000, true
}

func getChannel(c contract.Context, info *relaycommon.RelayInfo, retryParam *catalog.SelectParams) (*catalog.SelectedRoute, *types.NewAPIError) {
	if info.ChannelMeta == nil {
		// First attempt: Distribute already resolved a route, recorded its share
		// entry and set the serving key in context. ChannelMeta is only assigned by
		// InitChannelMeta, which runs after this function returns, so iteration 0 of
		// every request lands here — re-deriving the route would fold a second entry
		// into the share window and re-draw the key, charging isolation against an
		// index that never served the attempt.
		if selected, ok := common.GetCtxKey(c, constant.ContextKeySelectedRoute); ok {
			if route, cast := selected.(*catalog.SelectedRoute); cast && route != nil {
				return route, nil
			}
		}
		// Specific-channel replay: the channel identity comes from context, and the
		// route unit it belongs to is resolved so exclusion and attribution stay
		// keyed by RouteKey rather than collapsing every key of one channel.
		channel, err := catalog.CacheGetChannel(c.GetInt("channel_id"))
		if err != nil || channel == nil {
			autoBanInt := 1
			if !c.GetBool("auto_ban") {
				autoBanInt = 0
			}
			channel = &catalog.Channel{
				Id:      c.GetInt("channel_id"),
				Type:    c.GetInt("channel_type"),
				Name:    c.GetString("channel_name"),
				AutoBan: &autoBanInt,
			}
		}
		route, routeErr := catalog.SelectedRouteFromChannel(channel, info.OriginModelName, info.UsingGroup)
		if routeErr != nil {
			return nil, types.NewError(routeErr, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
		}
		return route, nil
	}
	route, selectGroup, err := catalog.SelectChannel(retryParam)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败（retry）: %s", selectGroup, info.OriginModelName, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if route == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在（retry）", selectGroup, info.OriginModelName), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)

	if newAPIError := middleware.SetupContextForSelectedChannel(c, route, info.OriginModelName); newAPIError != nil {
		return nil, newAPIError
	}
	return route, nil
}

// routeStatsOutcome tells the EWMA how much of a failure an attempt was. It
// exists only to shape the soft signal: isolation, disabling and retry
// eligibility are decided elsewhere by the state machine and shouldRetry.
type routeStatsOutcome int

const (
	routeStatsNeutral routeStatsOutcome = iota
	routeStatsThrottled
	routeStatsFatal
)

func classifyRouteStatsOutcome(err *types.NewAPIError) routeStatsOutcome {
	if err == nil {
		return routeStatsNeutral
	}
	// A client cancel is not route evidence: the caller abandoned the request,
	// so its 500 wrapper must not derate the soft EWMA.
	if errors.Is(err, context.Canceled) {
		return routeStatsNeutral
	}
	if types.IsChannelError(err) || err.GetErrorCode() == types.ErrorCodeBadResponseBody {
		return routeStatsFatal
	}
	if err.StatusCode == http.StatusTooManyRequests {
		return routeStatsThrottled
	}
	if err.StatusCode >= http.StatusInternalServerError {
		return routeStatsFatal
	}
	return routeStatsNeutral
}

// wouldRetryWithOneBudget reports whether a relay error would retry if a single
// retry were available, independent of the remaining budget. It reuses
// shouldRetry with retryTimes=1 so the skip/channel/specific-channel/status-code
// rules live in exactly one place. The RetryTimes>0 gate is applied at the call
// site so RetryTimes=0 writes no state.
func wouldRetryWithOneBudget(c contract.Context, err *types.NewAPIError) bool {
	return shouldRetry(c, err, 1)
}

func shouldRetry(c contract.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
	if openaiErr == nil {
		return false
	}
	if catalog.ShouldSkipRetryAfterChannelAffinityFailure(c) {
		return false
	}
	if types.IsChannelError(openaiErr) {
		return true
	}
	if types.IsSkipRetryError(openaiErr) {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	code := openaiErr.StatusCode
	if code >= 200 && code < 300 {
		return false
	}
	if code < 100 || code > 599 {
		return true
	}
	if status_code.IsAlwaysSkipRetryCode(openaiErr.GetErrorCode()) {
		return false
	}
	return status_code.ShouldRetryByStatusCode(code)
}

func processChannelError(c contract.Context, channelError types.ChannelError, err *types.NewAPIError) {
	logger.LogError(c.Context(), fmt.Sprintf("channel error (channel #%d, status code: %d): %s", channelError.ChannelId, err.StatusCode, common.LocalLogPreview(err.Error())))
	// 不要使用context获取渠道信息，异步处理时可能会出现渠道信息不一致的情况
	// do not use context to get channel info, there may be inconsistent channel info when processing asynchronously
	if catalog.ShouldDisableChannel(err) && channelError.AutoBan {
		gopool.Go(func() {
			catalog.DisableChannel(channelError, err.ErrorWithStatusCode())
		})
	}

	if constant.ErrorLogEnabled && types.IsRecordErrorLog(err) {
		// 保存错误日志到mysql中
		userId := c.GetInt("id")
		tokenName := c.GetString("token_name")
		modelName := c.GetString("original_model")
		tokenId := c.GetInt("token_id")
		userGroup := c.GetString("group")
		channelId := c.GetInt("channel_id")
		other := make(map[string]interface{})
		other["request_path"] = c.Path()
		other["error_type"] = err.GetErrorType()
		other["error_code"] = err.GetErrorCode()
		other["status_code"] = err.StatusCode
		other["channel_id"] = channelId
		other["channel_name"] = c.GetString("channel_name")
		other["channel_type"] = c.GetInt("channel_type")
		adminInfo := make(map[string]interface{})
		adminInfo["use_channel"] = c.GetStringSlice("use_channel")
		isMultiKey := common.GetCtxKeyBool(c, constant.ContextKeyChannelIsMultiKey)
		if isMultiKey {
			adminInfo["is_multi_key"] = true
			adminInfo["multi_key_index"] = common.GetCtxKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
		}
		catalog.AppendChannelAffinityAdminInfo(c, adminInfo)
		other["admin_info"] = adminInfo
		startTime := common.GetCtxKeyTime(c, constant.ContextKeyRequestStartTime)
		if startTime.IsZero() {
			startTime = time.Now()
		}
		useTimeSeconds := int(time.Since(startTime).Seconds())
		usage.RecordErrorLog(c, userId, channelId, modelName, tokenName, err.MaskSensitiveErrorWithStatusCode(), tokenId, useTimeSeconds, common.GetCtxKeyBool(c, constant.ContextKeyIsStream), userGroup, other)
	}

}

func RelayMidjourney(c contract.Context) {
	relayInfo, err := gateway.GenRelayInfo(c, types.RelayFormatMjProxy, nil, nil)

	if err != nil {
		_ = c.JSON(http.StatusInternalServerError, common.H{
			"description": fmt.Sprintf("failed to generate relay info: %s", err.Error()),
			"type":        "upstream_error",
			"code":        4,
		})
		return
	}

	var mjErr *taskdto.MidjourneyResponse
	switch relayInfo.RelayMode {
	case relayconstant.RelayModeMidjourneyNotify:
		mjErr = relay.RelayMidjourneyNotify(c)
	case relayconstant.RelayModeMidjourneyTaskFetch, relayconstant.RelayModeMidjourneyTaskFetchByCondition:
		mjErr = relay.RelayMidjourneyTask(c, relayInfo.RelayMode)
	case relayconstant.RelayModeMidjourneyTaskImageSeed:
		mjErr = relay.RelayMidjourneyTaskImageSeed(c)
	case relayconstant.RelayModeSwapFace:
		mjErr = relay.RelaySwapFace(c, relayInfo)
	default:
		mjErr = relay.RelayMidjourneySubmit(c, relayInfo)
	}
	//err = relayMidjourneySubmit(c, relayMode)
	log.Println(mjErr)
	if mjErr != nil {
		statusCode := http.StatusBadRequest
		if mjErr.Code == 30 {
			mjErr.Result = "当前分组负载已饱和，请稍后再试，或升级账户以提升服务质量。"
			statusCode = http.StatusTooManyRequests
		}
		_ = c.JSON(statusCode, common.H{
			"description": fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result),
			"type":        "upstream_error",
			"code":        mjErr.Code,
		})
		channelId := c.GetInt("channel_id")
		logger.LogError(c.Context(), fmt.Sprintf("relay error (channel #%d, status code %d): %s", channelId, statusCode, fmt.Sprintf("%s %s", mjErr.Description, mjErr.Result)))
	}
}

func RelayNotImplemented(c contract.Context) {
	err := types.OpenAIError{
		Message: "API not implemented",
		Type:    "new_api_error",
		Param:   "",
		Code:    "api_not_implemented",
	}
	_ = c.JSON(http.StatusNotImplemented, common.H{
		"error": err,
	})
}

func RelayNotFound(c contract.Context) {
	err := types.OpenAIError{
		Message: fmt.Sprintf("Invalid URL (%s %s)", c.Method(), c.Path()),
		Type:    "invalid_request_error",
		Param:   "",
		Code:    "",
	}
	_ = c.JSON(http.StatusNotFound, common.H{
		"error": err,
	})
}

func RelayTaskFetch(c contract.Context) {
	relayInfo, err := gateway.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		_ = c.JSON(http.StatusInternalServerError, &taskdto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}
	if taskErr := taskcap.FetchTask(c, relayInfo.RelayMode); taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

func RelayTask(c contract.Context) {
	relayInfo, err := gateway.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		_ = c.JSON(http.StatusInternalServerError, &taskdto.TaskError{
			Code:       "gen_relay_info_failed",
			Message:    err.Error(),
			StatusCode: http.StatusInternalServerError,
		})
		return
	}

	// relay owns the task adaptors, so submission goes straight through it, the
	// same way every other relay path in this file does. The task capability
	// used to mirror this flow behind a TaskSubmitProvider port that nothing
	// implemented, which made every submit nil-panic; that mirror is gone.
	if taskErr := relay.ResolveOriginTask(c, relayInfo); taskErr != nil {
		respondTaskError(c, taskErr)
		return
	}

	var result *relay.TaskSubmitResult
	var taskErr *taskdto.TaskError
	defer func() {
		// Refund unconditionally whenever a session was pre-consumed: a panic
		// on the async task path must not strand the pre-consumed quota. BillingSession.Refund
		// is a no-op once settled (success path) and idempotent, so calling it here is safe;
		// the FreeModel path leaves relayInfo.Billing nil and is guarded by the != nil check.
		if relayInfo.Billing != nil {
			relayInfo.Billing.Refund(c)
		}
	}()

	retryParam := &catalog.SelectParams{
		Ctx:           c,
		TokenGroup:    relayInfo.TokenGroup,
		ModelName:     relayInfo.OriginModelName,
		RequestPath:   c.Path(),
		Retry:         common.GetPointer(0),
		ExcludeRoutes: make(map[catalog.RouteKey]bool),
	}

	// Same deferral as Relay: only a request that exhausted its retries counts
	// against the channels it tried.
	var attempts []catalog.ChannelAttempt
	winnerID, requestSucceeded := 0, false
	defer func() {
		catalog.GetChannelHealthManager().RecordRequestAttempts(attempts, winnerID, relayInfo.OriginModelName, requestSucceeded)
	}()

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		var route *catalog.SelectedRoute
		if lockedCh, ok := relayInfo.LockedChannel.(*catalog.Channel); ok && lockedCh != nil {
			var err error
			route, err = catalog.SelectedRouteFromChannel(lockedCh, relayInfo.OriginModelName, relayInfo.UsingGroup)
			if err != nil {
				taskErr = taskdomain.TaskErrorWrapperLocal(err, "setup_locked_channel_failed", http.StatusInternalServerError)
				break
			}
			if retryParam.GetRetry() > 0 {
				if setupErr := middleware.SetupContextForSelectedChannel(c, route, relayInfo.OriginModelName); setupErr != nil {
					taskErr = taskdomain.TaskErrorWrapperLocal(setupErr.Err, "setup_locked_channel_failed", http.StatusInternalServerError)
					break
				}
			}
		} else {
			var channelErr *types.NewAPIError
			route, channelErr = getChannel(c, relayInfo, retryParam)
			if channelErr != nil {
				logger.LogError(c.Context(), channelErr.Error())
				taskErr = taskdomain.TaskErrorWrapperLocal(channelErr.Err, "get_channel_failed", http.StatusInternalServerError)
				break
			}
		}
		channel := route.Channel
		addUsedChannel(c, channel.Id)
		bodyStorage, bodyErr := common.GetBodyStorage(c)
		if bodyErr != nil {
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				taskErr = taskdomain.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusRequestEntityTooLarge)
			} else {
				taskErr = taskdomain.TaskErrorWrapperLocal(bodyErr, "read_request_body_failed", http.StatusBadRequest)
			}
			break
		}
		c.ResetBody(io.NopCloser(bodyStorage))

		result, taskErr = relay.RelayTaskSubmit(c, relayInfo)
		if taskErr == nil {
			winnerID, requestSucceeded = channel.Id, true
			break
		}

		if !taskErr.LocalError {
			// TaskError carries a StatusCode, so the same classification applies here:
			// build the equivalent NewAPIError once and reuse it for both the health
			// decision and the existing channel-error reporting.
			taskAPIError := types.NewOpenAIError(taskErr.Error, types.ErrorCodeBadResponseStatusCode, taskErr.StatusCode)
			outcome := catalog.ClassifyChannelOutcome(taskAPIError, channel.Id)
			attempts = append(attempts, catalog.ChannelAttempt{ChannelID: channel.Id, ModelName: relayInfo.OriginModelName, Outcome: outcome})
			if outcome.ExcludesChannel() && retryParam.ExcludeRoutes != nil {
				retryParam.ExcludeRoutes[catalog.RouteKey{ChannelId: route.ChannelId, KeyIndex: route.KeyIndex, Model: route.Alias}] = true
			}
			processChannelError(c,
				*types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey,
					common.GetCtxKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()),
				taskAPIError)
		}

		if !shouldRetryTaskRelay(c, channel.Id, taskErr, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c.Context(), retryLogStr)
	}

	// ── 成功：结算 + 日志 + 插入任务 ──
	if taskErr == nil {
		if settleErr := billing.SettleBilling(c, relayInfo, result.Quota); settleErr != nil {
			common.SysError("settle task billing error: " + settleErr.Error())
		}
		taskdomain.LogTaskConsumption(c, relayInfo)

		task := taskdomain.InitTask(constant.TaskPlatform(result.Platform), relayInfo)
		task.PrivateData.UpstreamTaskID = result.UpstreamTaskID
		task.PrivateData.BillingSource = relayInfo.BillingSource
		task.PrivateData.SubscriptionId = relayInfo.SubscriptionId
		task.PrivateData.TokenId = relayInfo.TokenId
		task.PrivateData.NodeName = common.NodeName
		task.PrivateData.BillingContext = &taskdomain.TaskBillingContext{
			ModelPrice:      relayInfo.PriceData.ModelPrice,
			GroupRatio:      relayInfo.PriceData.GroupRatioInfo.GroupRatio,
			ModelRatio:      relayInfo.PriceData.ModelRatio,
			OtherRatios:     relayInfo.PriceData.OtherRatios(),
			OriginModelName: relayInfo.OriginModelName,
			PerCallBilling:  common.StringsContains(constant.TaskPricePatches, relayInfo.OriginModelName) || relayInfo.PriceData.UsePrice,
		}
		task.Quota = result.Quota
		task.Data = result.TaskData
		task.Action = relayInfo.Action
		if insertErr := task.Insert(); insertErr != nil {
			common.SysError("insert task error: " + insertErr.Error())
		}
	}

	if taskErr != nil {
		respondTaskError(c, taskErr)
	}
}

// respondTaskError 统一输出 Task 错误响应（含 429 限流提示改写）
func respondTaskError(c contract.Context, taskErr *taskdto.TaskError) {
	if taskErr.StatusCode == http.StatusTooManyRequests {
		taskErr.Message = "当前分组上游负载已饱和，请稍后再试"
	}
	_ = c.JSON(taskErr.StatusCode, taskErr)
}

func shouldRetryTaskRelay(c contract.Context, channelId int, taskErr *taskdto.TaskError, retryTimes int) bool {
	if taskErr == nil {
		return false
	}
	// The client is gone: re-dialing upstream repeats a request nobody is
	// waiting for. Mirrors classifyAttempt's cancel rule for the sync loop.
	if errors.Is(taskErr.Error, context.Canceled) {
		return false
	}
	if catalog.ShouldSkipRetryAfterChannelAffinityFailure(c) {
		return false
	}
	if retryTimes <= 0 {
		return false
	}
	if _, ok := c.Get("specific_channel_id"); ok {
		return false
	}
	if taskErr.StatusCode == http.StatusTooManyRequests {
		return true
	}
	if taskErr.StatusCode == 307 {
		return true
	}
	if taskErr.StatusCode/100 == 5 {
		// 超时不重试
		if status_code.IsAlwaysSkipRetryStatusCode(taskErr.StatusCode) {
			return false
		}
		return true
	}
	if taskErr.StatusCode == http.StatusBadRequest {
		return false
	}
	if taskErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}
	if taskErr.LocalError {
		return false
	}
	if taskErr.StatusCode/100 == 2 {
		return false
	}
	return true
}
