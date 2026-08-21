package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// RecordStreamErrorLog writes a type=5 monitoring event when an upstream SSE
// response ends abnormally after the HTTP response was accepted. It does not
// return a relay error, because replaying a partially delivered request is
// unsafe. A pure client cancellation is intentionally excluded.
func RecordStreamErrorLog(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if c == nil || relayInfo == nil || relayInfo.StreamStatus == nil || !constant.ErrorLogEnabled {
		return
	}
	streamStatus := relayInfo.StreamStatus
	if (streamStatus.IsNormalEnd() && !streamStatus.HasErrors()) ||
		(streamStatus.EndReason == relaycommon.StreamEndReasonClientGone && !streamStatus.HasErrors()) {
		return
	}

	channelID := 0
	if relayInfo.ChannelMeta != nil {
		channelID = relayInfo.ChannelMeta.ChannelId
	}
	streamDetails := map[string]interface{}{
		"status":      "error",
		"end_reason":  string(streamStatus.EndReason),
		"received":    relayInfo.ReceivedResponseCount,
		"error_count": streamStatus.ErrorCount,
	}
	if streamStatus.EndError != nil {
		streamDetails["end_error"] = streamStatus.EndError.Error()
	}
	if streamStatus.ErrorCount > 0 {
		messages := make([]string, 0, len(streamStatus.Errors))
		for _, entry := range streamStatus.Errors {
			messages = append(messages, entry.Message)
		}
		streamDetails["errors"] = messages
	}
	other := map[string]interface{}{
		"error_type":    "transport",
		"error_code":    "stream_incomplete",
		"status_code":   0,
		"channel_id":    channelID,
		"channel_name":  c.GetString("channel_name"),
		"channel_type":  c.GetInt("channel_type"),
		"request_path":  relayInfo.RequestURLPath,
		"stream_status": streamDetails,
	}
	if c.Request != nil && c.Request.URL != nil {
		other["request_path"] = c.Request.URL.Path
	}

	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}
	model.RecordErrorLog(c, relayInfo.UserId, channelID, relayInfo.OriginModelName,
		c.GetString("token_name"), "upstream stream ended before completion", relayInfo.TokenId,
		int(time.Since(startTime).Seconds()), true, relayInfo.UserGroup, other)
}
