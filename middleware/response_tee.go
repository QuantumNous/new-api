package middleware

import (
	"bytes"

	"github.com/gin-gonic/gin"
)

type bodyTeeWriter struct {
	gin.ResponseWriter
	buf *bytes.Buffer
	cap int
}

func newBodyTeeWriter(w gin.ResponseWriter, cap int) *bodyTeeWriter {
	return &bodyTeeWriter{ResponseWriter: w, buf: &bytes.Buffer{}, cap: cap}
}

func (w *bodyTeeWriter) capture(b []byte) {
	if w.buf.Len() >= w.cap {
		return
	}
	remain := w.cap - w.buf.Len()
	if remain > len(b) {
		remain = len(b)
	}
	w.buf.Write(b[:remain])
}

func (w *bodyTeeWriter) Write(b []byte) (int, error) {
	w.capture(b)
	return w.ResponseWriter.Write(b)
}

func (w *bodyTeeWriter) WriteString(s string) (int, error) {
	w.capture([]byte(s))
	return w.ResponseWriter.WriteString(s)
}

func (w *bodyTeeWriter) Captured() []byte { return w.buf.Bytes() }
