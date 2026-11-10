package service

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// BindChannelAffinityResponse commits affinity before output from each selected
// channel becomes visible. Keepalive may write before upstream accepts a
// request, so a later retry must commit again if it uses a different channel.
func BindChannelAffinityResponse(c *gin.Context, initialChannelID int) {
	if _, _, ok := getChannelAffinityContext(c); !ok {
		return
	}
	c.Writer = &channelAffinityResponseWriter{ResponseWriter: c.Writer, ctx: c, initialChannelID: initialChannelID}
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

func (w *channelAffinityResponseWriter) commitAffinity() error {
	w.mutex.Lock()
	defer w.mutex.Unlock()
	if w.commitErr == nil {
		if w.Status() < http.StatusOK || w.Status() >= http.StatusMultipleChoices {
			return nil
		}
		channelID := channelAffinityTarget(w.ctx, w.initialChannelID)
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
			_, w.commitErr = cache.RefreshOrSetWithTTL(key, channelID, ttl)
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
	_ = w.commitAffinity()
	w.ResponseWriter.WriteHeaderNow()
}

func (w *channelAffinityResponseWriter) Write(data []byte) (int, error) {
	if err := w.commitAffinity(); err != nil {
		return 0, err
	}
	return w.ResponseWriter.Write(data)
}

func (w *channelAffinityResponseWriter) WriteString(data string) (int, error) {
	if err := w.commitAffinity(); err != nil {
		return 0, err
	}
	return w.ResponseWriter.WriteString(data)
}

func (w *channelAffinityResponseWriter) Flush() {
	_ = w.FlushError()
}

func (w *channelAffinityResponseWriter) FlushError() error {
	if err := w.commitAffinity(); err != nil {
		return err
	}
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
