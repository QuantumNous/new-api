package middleware

import (
	"bytes"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// payloadLogMaxBodySize bounds how much of each request/response body is stored,
// so a huge upload or long stream cannot bloat the database.
const payloadLogMaxBodySize = 256 * 1024 // 256KB per body

// PayloadLog captures the full request and response bodies of relay calls when
// the platform-wide "business payload logging" switch (common.PayloadLogEnabled)
// is ON. When it is OFF (the default) this middleware is a strict no-op with
// zero overhead: no body is read, no writer is wrapped, nothing is stored — so
// user prompts and model responses are never persisted.
func PayloadLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Default-OFF fast path: zero overhead, no capture.
		if !common.PayloadLogEnabled || c.Request.Method != "POST" {
			c.Next()
			return
		}

		start := time.Now()

		// Read the request body before c.Next(); GetBodyStorage caches it, so
		// the relay downstream still reads the same body. (BodyStorageCleanup
		// releases the storage only after the request finishes.)
		var requestBody string
		if bs, err := common.GetBodyStorage(c); err == nil {
			if b, err := bs.Bytes(); err == nil {
				requestBody = truncatePayloadBody(b)
			}
		}

		// Tee a bounded copy of the response. auditResponseWriter (audit.go)
		// already implements exactly this capped-buffer wrapper.
		writer := &auditResponseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBuffer(nil),
			maxSize:        payloadLogMaxBodySize,
		}
		c.Writer = writer

		c.Next()

		entry := &model.PayloadLog{
			CreatedAt:    common.GetTimestamp(),
			UserId:       c.GetInt("id"),
			Username:     c.GetString("username"),
			TokenName:    c.GetString("token_name"),
			ModelName:    c.GetString("original_model"),
			ChannelId:    c.GetInt("channel_id"),
			RequestId:    c.GetString(common.RequestIdKey),
			Ip:           c.ClientIP(),
			StatusCode:   writer.Status(),
			DurationMs:   time.Since(start).Milliseconds(),
			RequestBody:  requestBody,
			ResponseBody: writer.body.String(),
		}
		// Persist off the request path so logging never adds latency.
		gopool.Go(func() {
			model.RecordPayloadLog(entry)
		})
	}
}

func truncatePayloadBody(b []byte) string {
	if len(b) > payloadLogMaxBodySize {
		return string(b[:payloadLogMaxBodySize])
	}
	return string(b)
}
