package helper

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// responseModelRewritingWriter rewrites the model value of every response write. A
// chunk that ends in the middle of a model occurrence is carried over to the next
// write, so a chunk boundary cannot leak the upstream model name.
type responseModelRewritingWriter struct {
	gin.ResponseWriter
	c       *gin.Context
	pending []byte
}

func (w *responseModelRewritingWriter) Write(payload []byte) (int, error) {
	written := len(payload)
	target := common.ResponseModelRewriteTarget(w.c)
	if written == 0 || target == "" {
		return w.ResponseWriter.Write(payload)
	}

	chunk := payload
	if len(w.pending) > 0 {
		chunk = append(w.pending, payload...)
		w.pending = nil
	}

	out, hold := common.RewriteResponseModelChunk(chunk, target)
	if hold > 0 {
		w.pending = append([]byte(nil), chunk[len(chunk)-hold:]...)
	}
	if len(out) == 0 {
		return written, nil
	}
	if _, err := w.ResponseWriter.Write(out); err != nil {
		return 0, err
	}
	// Callers observe a full write of their own buffer even when part of it was carried
	// over, so that io.Copy and streaming loops keep their progress accounting.
	return written, nil
}

func (w *responseModelRewritingWriter) WriteString(payload string) (int, error) {
	return w.Write([]byte(payload))
}

func (w *responseModelRewritingWriter) Flush() {
	w.flushPending()
	w.ResponseWriter.Flush()
}

// Unwrap exposes the wrapped writer to http.ResponseController, so that streaming
// deadlines keep working while the rewriter is installed.
func (w *responseModelRewritingWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *responseModelRewritingWriter) flushPending() {
	if len(w.pending) == 0 {
		return
	}
	pending := w.pending
	w.pending = nil
	_, _ = w.ResponseWriter.Write(pending)
}

func installResponseModelRewriter(c *gin.Context) {
	if c == nil || c.Writer == nil {
		return
	}
	if _, ok := c.Writer.(*responseModelRewritingWriter); ok {
		return
	}
	c.Writer = &responseModelRewritingWriter{ResponseWriter: c.Writer, c: c}
}
