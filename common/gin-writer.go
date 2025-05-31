package common

import (
	"bytes"
	"github.com/gin-gonic/gin"
	"io"
	"strings"
)

const KeyResponseWriter = "key_response_Writer"

func checkWrapWriter(c *gin.Context) bool {
	if !ResponseLogEnabled {
		return false
	}
	if !strings.Contains(c.Request.Header.Get("Content-Type"), "application/json") {
		return false
	}
	return true
}

type BodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w BodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}
func (w BodyLogWriter) String() string {
	return w.body.String()
}
func (w BodyLogWriter) Bytes() []byte {
	return w.body.Bytes()
}
func WrapWriter(c *gin.Context) *gin.Context {
	if !checkWrapWriter(c) {
		return c
	}
	requestBody, _ := GetRequestBody(c)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
	w := BodyLogWriter{
		ResponseWriter: c.Writer,
		body:           bytes.NewBufferString(""),
	}
	c.Writer = w
	c.Set(KeyResponseWriter, w)
	return c
}
