package requestaudit

import (
	"context"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := loadConfig()
		if !cfg.Enabled {
			c.Next()
			return
		}

		c.Next()

		requestID := c.GetString(common.RequestIdKey)
		if requestID == "" {
			return
		}
		if !shouldSample(requestID, cfg.SampleRate) {
			return
		}

		raw, exists := c.Get(common.KeyBodyStorage)
		if !exists || raw == nil {
			if !cfg.IfUncached {
				return
			}
			storage, err := common.GetBodyStorage(c)
			if err != nil || storage == nil {
				return
			}
			raw = storage
		}

		storage, ok := raw.(common.BodyStorage)
		if !ok || storage == nil {
			return
		}

		body, err := storage.Bytes()
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("requestaudit: read body: %s", err.Error()))
			return
		}

		originalSize := len(body)
		truncated := false
		maxBytes := cfg.MaxBodyKB * 1024
		if maxBytes > 0 && len(body) > maxBytes {
			body = body[:maxBytes]
			truncated = true
		}

		bodyCopy := make([]byte, len(body))
		copy(bodyCopy, body)

		record := &RelayAuditRecord{
			RequestId:   requestID,
			Method:      c.Request.Method,
			Path:        c.Request.URL.Path,
			ClientIp:    c.ClientIP(),
			ContentType: c.Request.Header.Get("Content-Type"),
			Body:        string(bodyCopy),
			BodySize:    originalSize,
			Truncated:   truncated,
		}

		db := logDB
		gopool.Go(func() {
			if err := saveRecord(db, record); err != nil {
				if isDuplicateKeyError(err) {
					return
				}
				logger.LogError(context.Background(), fmt.Sprintf("requestaudit: save record request_id=%s: %s", requestID, err.Error()))
			}
		})
	}
}

func shouldSample(requestID string, ratePercent int) bool {
	if ratePercent >= 100 {
		return true
	}
	if ratePercent <= 0 {
		return false
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(requestID))
	return int(h.Sum32()%100) < ratePercent
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "1062") ||
		strings.Contains(msg, "23505")
}
