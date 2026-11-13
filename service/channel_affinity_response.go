package service

import (
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// BindChannelAffinityResponse commits affinity before output from each selected
// channel becomes visible. Heartbeats only renew an already committed channel;
// they cannot establish that a pending retry has succeeded.
func BindChannelAffinityResponse(c *gin.Context, initialChannelID int) {
	if _, _, ok := getChannelAffinityContext(c); !ok {
		return
	}
	c.Writer = &channelAffinityResponseWriter{ResponseWriter: c.Writer, ctx: c, initialChannelID: initialChannelID}
}

// FinalizeChannelAffinityResponse commits empty success responses and returns any
// sticky binding failure hidden by Gin's error-free WriteHeaderNow interface.
func FinalizeChannelAffinityResponse(c *gin.Context) error {
	c.Writer.WriteHeaderNow()
	var writer http.ResponseWriter = c.Writer
	for {
		if affinity, ok := writer.(*channelAffinityResponseWriter); ok {
			affinity.mutex.Lock()
			defer affinity.mutex.Unlock()
			return affinity.commitErr
		}
		unwrapper, ok := writer.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			return nil
		}
		writer = unwrapper.Unwrap()
	}
}

type channelAffinityResponseWriter struct {
	gin.ResponseWriter
	ctx                *gin.Context
	initialChannelID   int
	mutex              sync.Mutex
	committedChannelID int
	commitErr          error
	refreshAfter       time.Time
}

func (w *channelAffinityResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// commitAffinity binds each new channel before output and periodically renews
// long streams. A cache failure remains sticky so later writes cannot leak output.
func (w *channelAffinityResponseWriter) commitAffinity(heartbeat bool) error {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	// Terminal SSE errors must remain deliverable after a binding failure. The
	// sticky error still blocks success output and is returned at finalization.
	status, _ := common.GetContextKeyType[*relaycommon.StreamStatus](w.ctx, constant.ContextKeyResponseStreamStatus)
	if status != nil && status.ResponseFailed() {
		return nil
	}
	if w.commitErr == nil {
		if w.Status() < http.StatusOK || w.Status() >= http.StatusMultipleChoices {
			return nil
		}
		channelID := w.committedChannelID
		if !heartbeat {
			channelID = channelAffinityTarget(w.ctx, w.initialChannelID)
		}
		key, ttl, active := channelAffinityBinding(w.ctx)
		if !active || channelID <= 0 {
			return nil
		}
		sameChannel := channelID == w.committedChannelID
		if sameChannel && time.Now().Before(w.refreshAfter) {
			return nil
		}
		cache := getChannelAffinityCache()
		if sameChannel {
			// Renew before exposing more output, restoring expired entries but
			// never replacing a binding another request has since established.
			var renewed bool
			renewed, w.commitErr = cache.RefreshOrSetWithTTL(key, channelID, ttl)
			if !renewed && w.commitErr == nil {
				if heartbeat {
					// Keepalive carries no model context. Do not advance the renewal
					// deadline: the next success write must check the conflicting binding.
					w.refreshAfter = time.Time{}
					return nil
				}
				w.commitErr = errors.New("channel affinity binding changed during response")
			}
		} else {
			w.commitErr = cache.SetWithTTL(key, channelID, ttl)
		}
		if w.commitErr == nil {
			w.committedChannelID = channelID
			// Bound Redis traffic independently of token/chunk frequency.
			w.refreshAfter = time.Now().Add(ttl / 2)
			return nil
		}
	}
	// Heartbeats may already have sent 200. Never rewrite committed headers;
	// return the error so no output from the unbound channel is sent. Before
	// headers are sent, retain 503 even if an outer error renderer changes it.
	if !w.Written() {
		w.Header().Del("Content-Length")
		w.ResponseWriter.WriteHeader(http.StatusServiceUnavailable)
	}
	return w.commitErr
}

func (w *channelAffinityResponseWriter) WriteHeaderNow() {
	_ = w.commitAffinity(false)
	w.ResponseWriter.WriteHeaderNow()
}

// Write withholds response bytes when the channel binding cannot be committed.
func (w *channelAffinityResponseWriter) Write(data []byte) (int, error) {
	if err := w.commitAffinity(false); err != nil {
		return 0, err
	}
	return w.ResponseWriter.Write(data)
}

// WriteString applies the same binding barrier as Write to Gin's string output.
func (w *channelAffinityResponseWriter) WriteString(data string) (int, error) {
	if err := w.commitAffinity(false); err != nil {
		return 0, err
	}
	return w.ResponseWriter.WriteString(data)
}

func (w *channelAffinityResponseWriter) Flush() {
	_ = w.FlushError()
}

// FlushError commits affinity before flushing SSE output and preserves errors
// from transports hidden behind Gin or other response-writer wrappers.
func (w *channelAffinityResponseWriter) FlushError() error {
	if err := w.commitAffinity(false); err != nil {
		return err
	}
	return w.flushResponse()
}

// WriteHeartbeat sends keepalive bytes without treating a pending channel as successful.
func (w *channelAffinityResponseWriter) WriteHeartbeat(data []byte) error {
	if err := w.commitAffinity(true); err != nil {
		return err
	}
	if _, err := w.ResponseWriter.Write(data); err != nil {
		return err
	}
	return w.flushResponse()
}

// flushResponse preserves buffered output and transport errors without changing affinity.
func (w *channelAffinityResponseWriter) flushResponse() error {
	w.ResponseWriter.Flush()
	// Gin's Flush discards transport errors. Preserve wrapper buffers first,
	// then recover an error-aware flusher through the same chain as Unwrap.
	var writer http.ResponseWriter = w.ResponseWriter
	for {
		if flusher, ok := writer.(interface{ FlushError() error }); ok {
			return flusher.FlushError()
		}
		unwrapper, ok := writer.(interface{ Unwrap() http.ResponseWriter })
		if !ok {
			return nil
		}
		writer = unwrapper.Unwrap()
	}
}
