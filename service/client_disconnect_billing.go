package service

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

const detachedClientWriterKey = "detached_client_writer"

// detachedClientWriter keeps a relay running after Cloudflare truncated the
// connection: once the client is gone, writes are discarded and reported as
// successful so handlers keep reading upstream until the real usage arrives.
type detachedClientWriter struct {
	gin.ResponseWriter
	clientCtx         context.Context
	relayCtx          context.Context
	writeFailed       atomic.Bool
	truncated         atomic.Bool
	lastWriteUnixNs   atomic.Int64
	truncatedAtUnixNs atomic.Int64
}

func (w *detachedClientWriter) clientGone() bool {
	return w.writeFailed.Load() || w.clientCtx.Err() != nil
}

func (w *detachedClientWriter) Write(data []byte) (int, error) {
	if w.clientGone() {
		return len(data), nil
	}
	if _, err := w.ResponseWriter.Write(data); err != nil {
		w.writeFailed.Store(true)
		return len(data), nil
	}
	w.lastWriteUnixNs.Store(time.Now().UnixNano())
	return len(data), nil
}

func (w *detachedClientWriter) WriteString(data string) (int, error) {
	return w.Write([]byte(data))
}

func (w *detachedClientWriter) Flush() {
	if w.clientGone() {
		return
	}
	w.ResponseWriter.Flush()
}

// CloseNotify follows the relay context rather than the client connection so
// handlers built on gin's c.Stream keep reading upstream after a truncation.
func (w *detachedClientWriter) CloseNotify() <-chan bool {
	notify := make(chan bool, 1)
	context.AfterFunc(w.relayCtx, func() { notify <- true })
	return notify
}

func (w *detachedClientWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// DetachProxiedClientCancellation decouples the relay from the inbound
// connection for requests arriving through Cloudflare. Cloudflare drops the
// origin connection after about 100 seconds without response bytes, while the
// upstream keeps generating and bills the full output. Detaching lets the
// relay finish and settle the real usage instead of only the prompt estimate.
//
// Only a disconnect after CloudflareDisconnectBillingMinIdleSeconds without
// response bytes counts as a Cloudflare truncation; an earlier disconnect is a
// user abort and cancels the relay as before. A truncated relay may run at
// most CloudflareDisconnectBillingMaxSeconds before it is cancelled.
//
// The returned release func must be called when the request ends.
func DetachProxiedClientCancellation(c *gin.Context) func() {
	if !common.CloudflareDisconnectBillingEnabled || c == nil || c.Request == nil || c.Writer == nil ||
		c.GetHeader("Cf-Ray") == "" || !billing_setting.ContinueAfterCloudflareTruncation() {
		return func() {}
	}
	clientCtx := c.Request.Context()
	detachedCtx, cancel := context.WithCancel(context.WithoutCancel(clientCtx))
	maxRun := time.Duration(common.CloudflareDisconnectBillingMaxSeconds) * time.Second
	if maxRun <= 0 {
		maxRun = 30 * time.Minute
	}
	minIdle := time.Duration(common.CloudflareDisconnectBillingMinIdleSeconds) * time.Second
	writer := &detachedClientWriter{ResponseWriter: c.Writer, clientCtx: clientCtx, relayCtx: detachedCtx}
	writer.lastWriteUnixNs.Store(time.Now().UnixNano())
	stopWatch := context.AfterFunc(clientCtx, func() {
		if time.Since(time.Unix(0, writer.lastWriteUnixNs.Load())) < minIdle {
			cancel()
			return
		}
		writer.truncatedAtUnixNs.Store(time.Now().UnixNano())
		writer.truncated.Store(true)
		timer := time.NewTimer(maxRun)
		defer timer.Stop()
		select {
		case <-timer.C:
			cancel()
		case <-detachedCtx.Done():
		}
	})

	c.Writer = writer
	c.Set(detachedClientWriterKey, writer)
	c.Request = c.Request.WithContext(detachedCtx)
	return func() {
		stopWatch()
		cancel()
	}
}

// ProxiedClientGone reports whether Cloudflare truncated a detached request
// while the relay kept running.
func ProxiedClientGone(c *gin.Context) bool {
	if c == nil {
		return false
	}
	value, ok := c.Get(detachedClientWriterKey)
	if !ok {
		return false
	}
	writer, ok := value.(*detachedClientWriter)
	return ok && writer.truncated.Load()
}

// proxiedClientGoneAt returns when Cloudflare truncated a detached request.
func proxiedClientGoneAt(c *gin.Context) (time.Time, bool) {
	if c == nil {
		return time.Time{}, false
	}
	value, ok := c.Get(detachedClientWriterKey)
	if !ok {
		return time.Time{}, false
	}
	writer, ok := value.(*detachedClientWriter)
	if !ok || !writer.truncated.Load() {
		return time.Time{}, false
	}
	return time.Unix(0, writer.truncatedAtUnixNs.Load()), true
}

// ClientRequestCanceled reports whether the inbound client connection is gone.
func ClientRequestCanceled(c *gin.Context) bool {
	return c != nil && c.Request != nil && (c.Request.Context().Err() != nil || ProxiedClientGone(c))
}

// SettleClientDisconnectBilling handles a relay that failed because the client
// disconnected after the request had already been sent upstream (non-stream
// requests, or streams cancelled before the first byte). Upstream providers
// usually bill the processed input even when the call is cancelled, so instead
// of refunding the whole reservation this settles the estimated prompt tokens.
//
// It returns true when the session was settled. Callers should still invoke
// Billing.Refund afterwards; Refund is a no-op on a settled session and acts
// as a fallback if settlement did not complete.
//
// Under the official alignment the request is settled at zero, which leaves
// the same balance as the full refund upstream new-api makes, so the waived
// prompt charge is logged and kept for recovery.
//
// Per-call priced and free models keep the previous full-refund behavior,
// since there is no token count to charge proportionally.
func SettleClientDisconnectBilling(c *gin.Context, info *relaycommon.RelayInfo) bool {
	if info == nil || info.Billing == nil || info.ChannelMeta == nil || !ClientRequestCanceled(c) {
		return false
	}
	// MarkUpstreamStart is only called right before the upstream HTTP call,
	// so a zero start time means nothing reached the provider.
	if info.UpstreamStartTime.IsZero() {
		return false
	}
	if info.PriceData.UsePrice || info.PriceData.FreeModel {
		return false
	}
	promptTokens := info.GetEstimatePromptTokens()
	if promptTokens <= 0 {
		return false
	}
	chargeCase := classifyAbnormalCharge(c, info)
	if chargeCase == abnormalChargeNone {
		// The relay failed only because the client left, so the attempt still
		// tells which side of the response the client left from.
		chargeCase = abnormalChargeClientBeforeResponse
		if info.UpstreamAttempt().Responded() {
			chargeCase = abnormalChargeClientDuringResponse
		}
	}
	if chargeCase == abnormalChargeUpstreamBeforeResponse {
		// Upstream failed before answering; the client leaving afterwards does
		// not make that billable.
		return false
	}
	// Settlement reads the case back and decides the waiver itself.
	c.Set(abnormalChargeCaseKey, chargeCase)
	usage := &dto.Usage{
		PromptTokens: promptTokens,
		InputTokens:  promptTokens,
		TotalTokens:  promptTokens,
	}
	var content []*common.Message
	if waived, _ := abnormalChargeWaiver(info, chargeCase); !waived {
		content = append(content, common.NewMessage("Client disconnected after the request reached the upstream, billed by usage"))
	}
	PostTextConsumeQuota(c, info, usage, content)
	return true
}
