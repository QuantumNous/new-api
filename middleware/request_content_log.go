package middleware

import (
	"io"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const (
	reqBodyCap  = 256 * 1024 // store up to 256KB of request (prompt) — generous
	respHeadCap = 8 * 1024   // capture up to 8KB of response (URLs / truncated text)
)

func capString(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func detectStream(body []byte) bool {
	return gjson.GetBytes(body, "stream").Bool()
}

func RequestContentLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.RequestContentLogEnabled {
			c.Next()
			return
		}
		start := time.Now()

		// read request body (already buffered by Distribute), then restore
		var reqBody []byte
		if storage, err := common.GetBodyStorage(c); err == nil {
			if b, err := storage.Bytes(); err == nil {
				if len(b) > reqBodyCap {
					reqBody = append(reqBody, b[:reqBodyCap]...)
				} else {
					reqBody = append(reqBody, b...)
				}
				_, _ = storage.Seek(0, io.SeekStart)
				c.Request.Body = io.NopCloser(storage)
			}
		}
		isStream := detectStream(reqBody)

		tee := newBodyTeeWriter(c.Writer, respHeadCap)
		c.Writer = tee

		c.Next()

		// snapshot primitives BEFORE leaving the request scope
		entry := &model.RequestLog{
			RequestId:       c.GetString(common.RequestIdKey),
			UserId:          common.GetContextKeyInt(c, constant.ContextKeyUserId),
			Username:        c.GetString("username"),
			TokenId:         common.GetContextKeyInt(c, constant.ContextKeyTokenId),
			TokenName:       c.GetString("token_name"),
			Group:           common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
			ModelName:       common.GetContextKeyString(c, constant.ContextKeyOriginalModel),
			ChannelId:       common.GetContextKeyInt(c, constant.ContextKeyChannelId),
			ChannelName:     common.GetContextKeyString(c, constant.ContextKeyChannelName),
			ChannelType:     common.GetContextKeyInt(c, constant.ContextKeyChannelType),
			Endpoint:        c.FullPath(),
			Method:          c.Request.Method,
			StatusCode:      c.Writer.Status(),
			DurationMs:      time.Since(start).Milliseconds(),
			IsStream:        isStream,
			RequestBody:     capString(string(reqBody), reqBodyCap),
			ResponseSummary: capString(strings.ToValidUTF8(string(tee.Captured()), ""), respHeadCap),
		}
		go model.RecordRequestLog(entry) // async; entry holds copies, safe after request ends
	}
}
