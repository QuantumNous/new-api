package attemptlog

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// int32Ptr converts the int values used by the relay/billing layers to the
// exact type expected by ClickHouse Int32 columns. The range guard prevents a
// 64-bit host value from wrapping before it reaches telemetry storage.
func int32Ptr(value int) *int32 {
	const (
		minInt32 = -1 << 31
		maxInt32 = 1<<31 - 1
	)
	if int64(value) < minInt32 || int64(value) > maxInt32 {
		return nil
	}
	converted := int32(value)
	return &converted
}

func int32PtrValue(value *int) *int32 {
	if value == nil {
		return nil
	}
	return int32Ptr(*value)
}

// FinishInput carries the attempt's terminal state.
type FinishInput struct {
	// Err is the gateway's error for this attempt, nil on success.
	Err error
	// InternalErrCode is the gateway's own error code, e.g. "empty_response".
	InternalErrCode string
	// ErrMessage is the unmasked error text, used only to derive a cluster hash
	// and to probe for cause substrings. It is never persisted verbatim.
	ErrMessage string
	// HTTPStatus overrides the status seen by NoteUpstream when non-zero, for
	// paths that resolve a status without going through the shared request layer.
	HTTPStatus int
	// StreamEndReason is StreamStatus.EndReason, empty for non-stream attempts.
	StreamEndReason string
	// RelayFirstResponseTime is the relay layer's own first-response timestamp,
	// or nil when it never fired. It is a fallback: it is stamped on the first
	// chunk of any shape, so it is only used when chunk inspection could not
	// reach a verdict. Callers must resolve the relay layer's sentinel value
	// before passing it here. See resolveFirstTokenTime.
	RelayFirstResponseTime *time.Time
	// StreamChunks is the number of upstream chunks received.
	StreamChunks int
	// UpstreamModelName is the model the channel actually sent upstream (after
	// model mapping). Populated at Finish time, after the relay handler has run
	// InitChannelMeta; at BeginAttempt time the embedded ChannelMeta is still
	// nil, so this is read late.
	UpstreamModelName string
}

// Finish closes the attempt, classifies its outcome, and enqueues the record.
// It is safe to call on a nil Attempt, and it is idempotent.
func (a *Attempt) Finish(c *gin.Context, in FinishInput) {
	if a == nil {
		return
	}

	a.mu.Lock()
	if a.finished {
		a.mu.Unlock()
		return
	}
	a.finished = true

	endTime := time.Now()

	httpStatus := a.httpStatus
	if in.HTTPStatus != 0 {
		httpStatus = in.HTTPStatus
	}

	firstTokenTime := a.resolveFirstTokenTime(in.RelayFirstResponseTime)
	sentFirstToken := firstTokenTime != nil
	classifyIn := ClassifyInput{
		Err:             in.Err,
		InternalErrCode: in.InternalErrCode,
		HTTPStatus:      httpStatus,
		ErrMessage:      in.ErrMessage,
		StreamEndReason: in.StreamEndReason,
		SentFirstToken:  sentFirstToken,
		IsStream:        a.features.IsStream,
	}

	outcome := Classify(classifyIn)
	record := a.buildRecord(c, in, classifyIn, outcome, httpStatus, endTime, firstTokenTime)
	a.mu.Unlock()

	if c != nil {
		common.SetContextKey(c, constant.ContextKeyRelayAttempt, nil)
	}
	enqueue(record)
}

// resolveFirstTokenTime decides when this attempt produced its first token.
// Caller must hold a.mu.
//
// Chunk inspection wins when it reached a verdict, because the relay layer
// stamps its own timestamp on the first chunk of any shape and therefore counts
// role openers, pings and usage-only chunks as content.
//
// A nil result is meaningful, not missing: it says the stream was readable and
// produced nothing, which is what lets the classifier reach empty_response
// instead of stream_interrupted.
//
// The fallback is rejected when it predates this attempt. RelayInfo is
// per-request and its first-response time is never reset between retries, so
// after an attempt streams content and fails, the next attempt would otherwise
// inherit a timestamp from before it began.
func (a *Attempt) resolveFirstTokenTime(fallback *time.Time) *time.Time {
	if !a.firstContentTime.IsZero() {
		t := a.firstContentTime
		return &t
	}

	// Chunks arrived, every one was recognized, none carried content.
	if !a.firstChunkTime.IsZero() && !a.sawUnknownChunk {
		return nil
	}

	// Either no chunk was ever observed (non-SSE paths such as image
	// generation, which never call NoteChunk) or the upstream speaks an
	// envelope we cannot read. Trust the relay layer rather than discard the
	// measurement.
	if fallback == nil || fallback.Before(a.startTime) {
		return nil
	}
	return fallback
}

// buildRecord assembles the row. Caller must hold a.mu.
func (a *Attempt) buildRecord(
	c *gin.Context,
	in FinishInput,
	classifyIn ClassifyInput,
	outcome string,
	httpStatus int,
	endTime time.Time,
	firstTokenTime *time.Time,
) *model.RelayAttempt {
	totalMs := endTime.Sub(a.startTime).Milliseconds()

	record := &model.RelayAttempt{
		CreatedAt: endTime.Unix(),

		AttemptId:    a.attemptId,
		RequestId:    a.features.RequestId,
		AttemptIndex: a.attemptIndex,

		ChannelId:         a.target.ChannelId,
		ChannelType:       a.target.ChannelType,
		ModelName:         a.features.ModelName,
		UpstreamModelName: in.UpstreamModelName,
		UsingGroup:        a.target.UsingGroup,

		InputTokensEst: a.features.InputTokensEst,
		CharsLatin:     a.features.Chars.Latin,
		CharsHan:       a.features.Chars.Han,
		CharsOther:     a.features.Chars.Other,
		MaxTokensReq:   int32PtrValue(a.features.MaxTokensReq),
		IsStream:       a.features.IsStream,
		HasTools:       a.features.HasTools,
		ToolsCount:     a.features.ToolsCount,
		Temperature:    a.features.Temperature,
		TenantId:       a.features.TenantId,
		TokenId:        a.features.TokenId,
		RelayFormat:    a.features.RelayFormat,
		RequestPath:    a.features.RequestPath,

		PrefixHashSystem: a.features.PrefixHashSystem,
		PrefixHashTools:  a.features.PrefixHashTools,
		PrefixHashPrefix: a.features.PrefixHashPrefix,
		TaskTypeGuess:    a.features.TaskTypeGuess,
		TaskTypeGuessVer: a.features.TaskTypeGuessVer,

		TsStart: a.startTime.UnixMilli(),
		TsEnd:   endTime.UnixMilli(),
		TotalMs: totalMs,

		Ok:              outcome == OutcomeOK,
		OutcomeCode:     outcome,
		UpstreamErrHash: ErrorHash(in.ErrMessage),
		TerminatedBy:    TerminatedBy(classifyIn, outcome),
		InternalErrCode: in.InternalErrCode,
		StreamEndReason: in.StreamEndReason,
		RetryAfterHint:  int32PtrValue(a.retryAfterHint),
	}

	if httpStatus != 0 {
		record.HttpStatus = int32Ptr(httpStatus)
	}

	if firstTokenTime != nil {
		tsFirst := firstTokenTime.UnixMilli()
		record.TsFirstToken = &tsFirst
		if ttft := firstTokenTime.Sub(a.startTime).Milliseconds(); ttft >= 0 {
			record.TtftMs = &ttft
		}
	}

	if a.upstreamKnown {
		upstreamMs := endTime.Sub(a.upstreamStart).Milliseconds()
		record.UpstreamMs = &upstreamMs
		overhead := totalMs - upstreamMs
		if overhead < 0 {
			overhead = 0
		}
		record.GatewayOverheadMs = &overhead
	}

	if in.StreamChunks > 0 {
		record.StreamChunks = int32Ptr(in.StreamChunks)
	}

	a.applyPricing(record)
	a.applyUsage(record, endTime, firstTokenTime)

	if c != nil {
		if reason := common.GetContextKeyString(c, constant.ContextKeyFinishReason); reason != "" {
			record.FinishReason = reason
		}
	}

	return record
}

// applyPricing records the ratios this gateway actually bills on. price_in and
// price_out stay nil deliberately: billing here is a per-model-name ratio, and a
// per-token unit price cannot be derived from it without inventing a base rate.
func (a *Attempt) applyPricing(record *model.RelayAttempt) {
	if a.pricing == nil {
		return
	}
	p := a.pricing
	if p.UsePrice {
		record.ModelPrice = &p.ModelPrice
	} else {
		record.ModelRatio = &p.ModelRatio
		record.CompletionRatio = &p.CompletionRatio
	}
	record.GroupRatio = &p.GroupRatio
	if p.CacheRatio > 0 {
		record.CacheRatio = &p.CacheRatio
	}
}

// applyUsage records settled usage. Nothing is written when billing never
// reported usage for this attempt, which is the normal case for a failed
// attempt: nil there means "never settled", not "zero tokens".
func (a *Attempt) applyUsage(record *model.RelayAttempt, endTime time.Time, firstTokenTime *time.Time) {
	if !a.usageKnown {
		return
	}

	record.InputTokensActual = int32Ptr(a.inputTokens)
	record.OutputTokensActual = int32Ptr(a.outputTokens)
	record.CachedTokens = int32Ptr(a.cachedTokens)
	record.CostActual = int32Ptr(a.costActual)
	if a.reasoningTokens > 0 {
		record.ReasoningTokens = int32Ptr(a.reasoningTokens)
	}

	if a.outputTokens <= 0 {
		return
	}

	// Streaming: the rate is measured over the generation window, i.e. after
	// the first token. Using total elapsed time instead would fold queueing and
	// TTFT into the rate and understate a fast-but-slow-to-start channel.
	// Non-streaming: every token arrives with the single response, so the only
	// honest window is the whole attempt.
	var windowMs int64
	if firstTokenTime != nil {
		windowMs = endTime.Sub(*firstTokenTime).Milliseconds()
	} else if !a.features.IsStream {
		windowMs = record.TotalMs
	} else {
		return
	}
	// Sub-millisecond windows (cached instant replies) truncate to 0 ms:
	// report NULL rather than 0 or Inf.
	if windowMs <= 0 {
		return
	}
	tps := float64(a.outputTokens) / (float64(windowMs) / 1000)
	record.TpsActual = &tps
}
