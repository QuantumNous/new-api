package relay

import (
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	jsonKeepaliveInitialDelay = 75 * time.Second
	jsonKeepaliveInterval     = 25 * time.Second
)

type jsonKeepalive struct {
	stopCh   chan struct{}
	doneCh   chan struct{}
	stopOnce sync.Once

	written atomic.Bool
}

func startJSONKeepalive(c *gin.Context, initialDelay, interval time.Duration) *jsonKeepalive {
	if c == nil || c.Request == nil || c.Writer == nil || initialDelay <= 0 || interval <= 0 {
		return nil
	}

	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	c.Header("X-Accel-Buffering", "no")

	keepalive := &jsonKeepalive{
		stopCh: make(chan struct{}),
		doneCh: make(chan struct{}),
	}

	go keepalive.run(c, initialDelay, interval)
	return keepalive
}

func (k *jsonKeepalive) stop() {
	if k == nil {
		return
	}
	k.stopOnce.Do(func() {
		close(k.stopCh)
		<-k.doneCh
	})
}

func (k *jsonKeepalive) wasWritten() bool {
	return k != nil && k.written.Load()
}

func (k *jsonKeepalive) run(c *gin.Context, initialDelay, interval time.Duration) {
	defer close(k.doneCh)

	timer := time.NewTimer(initialDelay)
	defer timer.Stop()

	select {
	case <-timer.C:
	case <-c.Request.Context().Done():
		return
	case <-k.stopCh:
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		if !k.write(c) {
			return
		}

		select {
		case <-ticker.C:
		case <-c.Request.Context().Done():
			return
		case <-k.stopCh:
			return
		}
	}
}

func (k *jsonKeepalive) write(c *gin.Context) bool {
	if c == nil || c.Writer == nil {
		return false
	}

	writer := jsonKeepaliveResponseWriter(c)
	if writer == nil {
		return false
	}

	writer.WriteHeader(http.StatusProcessing)
	k.written.Store(true)
	if flusher, ok := writer.(http.Flusher); ok {
		flusher.Flush()
	}
	return true
}

func jsonKeepaliveResponseWriter(c *gin.Context) http.ResponseWriter {
	type responseWriterUnwrapper interface {
		Unwrap() http.ResponseWriter
	}
	if c == nil || c.Writer == nil {
		return nil
	}
	if unwrapper, ok := c.Writer.(responseWriterUnwrapper); ok {
		return unwrapper.Unwrap()
	}
	return nil
}
