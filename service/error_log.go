package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const contextKeyErrorLogRecorded = "error_log_recorded"

func MarkErrorLogRecorded(c *gin.Context) {
	c.Set(contextKeyErrorLogRecorded, true)
}

func IsErrorLogRecorded(c *gin.Context) bool {
	v, ok := c.Get(contextKeyErrorLogRecorded)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

func BuildErrorLogOther(c *gin.Context, category string, extra map[string]interface{}) map[string]interface{} {
	other := make(map[string]interface{})
	for k, v := range extra {
		other[k] = v
	}
	other["error_category"] = category
	if c != nil && c.Request != nil && c.Request.URL != nil {
		if _, ok := other["request_path"]; !ok {
			other["request_path"] = c.Request.URL.Path
		}
	}
	return other
}

// RecordRequestErrorLog records type=5 once per request (unless allowRetryDuplicate, used for upstream retries).
func RecordRequestErrorLog(c *gin.Context, category string, content string, extra map[string]interface{}, allowRetryDuplicate bool) {
	if !constant.ErrorLogEnabled {
		return
	}
	if !allowRetryDuplicate && IsErrorLogRecorded(c) {
		return
	}
	userId := c.GetInt("id")
	tokenName := c.GetString("token_name")
	modelName := c.GetString("original_model")
	if modelName == "" {
		modelName = c.GetString("model")
	}
	tokenId := c.GetInt("token_id")
	userGroup := c.GetString("group")
	channelId := c.GetInt("channel_id")
	other := BuildErrorLogOther(c, category, extra)
	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}
	useTimeSeconds := int(time.Since(startTime).Seconds())
	isStream := common.GetContextKeyBool(c, constant.ContextKeyIsStream)
	model.RecordErrorLog(c, userId, channelId, modelName, tokenName, content, tokenId, useTimeSeconds, isStream, userGroup, other)
	// Always mark so non-retry paths don't double-write a generic entry.
	// allowRetryDuplicate only skips the "already recorded" early return so each upstream retry can insert.
	MarkErrorLogRecorded(c)
}
