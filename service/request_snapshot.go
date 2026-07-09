package service

import (
	"fmt"
	"net/http"
	"net/textproto"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	clientGoneSnapshotStatusCode = 499
	requestSnapshotSavedKey      = "request_snapshot_saved"
)

type RequestSnapshotOptions struct {
	SnapshotType      string
	ErrorCode         string
	ErrorType         string
	StatusCode        int
	ErrorMessage      string
	RetryDecisionJSON string
	RelayFormat       types.RelayFormat
}

func SaveFinalFailedRequestSnapshot(c *gin.Context, relayInfo *relaycommon.RelayInfo, newAPIError *types.NewAPIError, retryDecisionJSON string) {
	if relayInfo == nil || newAPIError == nil {
		return
	}
	SaveRequestSnapshot(c, relayInfo, RequestSnapshotOptions{
		SnapshotType:      model.FailedRequestSnapshotTypeFinalFailed,
		ErrorCode:         string(newAPIError.GetErrorCode()),
		ErrorType:         string(newAPIError.GetErrorType()),
		StatusCode:        newAPIError.StatusCode,
		ErrorMessage:      newAPIError.MaskSensitiveErrorWithStatusCode(),
		RetryDecisionJSON: retryDecisionJSON,
		RelayFormat:       relayInfo.RelayFormat,
	})
}

func SaveClientGoneRequestSnapshot(c *gin.Context, relayInfo *relaycommon.RelayInfo) {
	if relayInfo == nil || relayInfo.StreamStatus == nil || relayInfo.StreamStatus.EndReason != relaycommon.StreamEndReasonClientGone {
		return
	}
	SaveRequestSnapshot(c, relayInfo, RequestSnapshotOptions{
		SnapshotType: model.FailedRequestSnapshotTypeClientGone,
		ErrorCode:    string(relaycommon.StreamEndReasonClientGone),
		ErrorType:    string(types.ErrorTypeNewAPIError),
		StatusCode:   clientGoneSnapshotStatusCode,
		ErrorMessage: relayInfo.StreamStatus.Summary(),
		RelayFormat:  relayInfo.RelayFormat,
	})
}

func SaveRequestSnapshot(c *gin.Context, relayInfo *relaycommon.RelayInfo, opts RequestSnapshotOptions) {
	if c == nil || relayInfo == nil {
		return
	}
	if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-NewAPI-Replay")), "true") {
		return
	}
	snapshotType := strings.TrimSpace(opts.SnapshotType)
	if snapshotType == "" {
		snapshotType = model.FailedRequestSnapshotTypeFinalFailed
	}
	if snapshotAlreadySaved(c, snapshotType) {
		return
	}
	requestID := c.GetString(common.RequestIdKey)
	if strings.TrimSpace(requestID) == "" {
		return
	}
	bodyStorage, err := common.GetBodyStorage(c)
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to capture request snapshot body: %s", err.Error()))
		return
	}
	body, err := bodyStorage.Bytes()
	if err != nil {
		logger.LogError(c, fmt.Sprintf("failed to read request snapshot body: %s", err.Error()))
		return
	}
	requestPath := relayInfo.RequestURLPath
	if c.Request != nil && c.Request.URL != nil && c.Request.URL.Path != "" {
		requestPath = c.Request.URL.Path
	}
	method := http.MethodPost
	contentType := ""
	if c.Request != nil {
		method = c.Request.Method
		contentType = c.Request.Header.Get("Content-Type")
	}
	relayFormat := opts.RelayFormat
	if relayFormat == "" {
		relayFormat = relayInfo.RelayFormat
	}
	snapshot := &model.FailedRequestSnapshot{
		RequestId:       requestID,
		SnapshotType:    snapshotType,
		UserId:          relayInfo.UserId,
		TokenId:         relayInfo.TokenId,
		ModelName:       relayInfo.OriginModelName,
		RequestPath:     requestPath,
		Method:          method,
		ContentType:     contentType,
		Headers:         common.GetJsonString(captureReplayHeaders(c)),
		Body:            string(body),
		BodySize:        int64(len(body)),
		UseChannel:      common.GetJsonString(c.GetStringSlice("use_channel")),
		ErrorCode:       opts.ErrorCode,
		ErrorType:       opts.ErrorType,
		StatusCode:      opts.StatusCode,
		ErrorMessage:    opts.ErrorMessage,
		RetryDecision:   opts.RetryDecisionJSON,
		RequestFormat:   string(relayInfo.RelayFormat),
		RelayMode:       int(relayInfo.RelayMode),
		RelayFormat:     string(relayFormat),
		LastChannelId:   c.GetInt("channel_id"),
		LastChannelName: c.GetString("channel_name"),
		FrtMs:           -1,
		CancelAtMs:      time.Since(relayInfo.StartTime).Milliseconds(),
		LastDataMs:      -1,
	}
	if relayInfo.HasSendResponse() {
		snapshot.FrtMs = relayInfo.FirstResponseTime.Sub(relayInfo.StartTime).Milliseconds()
	}
	if !relayInfo.LastDataTime.IsZero() {
		snapshot.LastDataMs = relayInfo.LastDataTime.Sub(relayInfo.StartTime).Milliseconds()
	}
	snapshot.SendResponseCount = relayInfo.SendResponseCount
	if err := model.SaveFailedRequestSnapshot(snapshot); err != nil {
		logger.LogError(c, fmt.Sprintf("failed to save request snapshot: %s", err.Error()))
		return
	}
	markSnapshotSaved(c, snapshotType)
}

func captureReplayHeaders(c *gin.Context) map[string][]string {
	headers := make(map[string][]string)
	if c == nil || c.Request == nil {
		return headers
	}
	allow := map[string]bool{
		"Accept":           true,
		"Content-Type":     true,
		"OpenAI-Beta":      true,
		"OpenAI-Intent":    true,
		"OpenAI-Project":   true,
		"OpenAI-Org":       true,
		"User-Agent":       true,
		"X-Client-Name":    true,
		"X-Client-Version": true,
	}
	for key, values := range c.Request.Header {
		canonical := textproto.CanonicalMIMEHeaderKey(key)
		if !allow[canonical] {
			continue
		}
		copied := make([]string, 0, len(values))
		for _, value := range values {
			if value == "" {
				continue
			}
			copied = append(copied, value)
		}
		if len(copied) > 0 {
			headers[canonical] = copied
		}
	}
	return headers
}

func markSnapshotSaved(c *gin.Context, snapshotType string) {
	if c == nil {
		return
	}
	var saved map[string]bool
	if raw, exists := c.Get(requestSnapshotSavedKey); exists && raw != nil {
		if typed, ok := raw.(map[string]bool); ok {
			saved = typed
		}
	}
	if saved == nil {
		saved = make(map[string]bool)
	}
	saved[snapshotType] = true
	c.Set(requestSnapshotSavedKey, saved)
}

func snapshotAlreadySaved(c *gin.Context, snapshotType string) bool {
	if c == nil || snapshotType == "" {
		return false
	}
	var saved map[string]bool
	if raw, exists := c.Get(requestSnapshotSavedKey); exists && raw != nil {
		if typed, ok := raw.(map[string]bool); ok {
			saved = typed
		}
	}
	return saved != nil && saved[snapshotType]
}

func BuildReplayRequest(snapshot *model.FailedRequestSnapshot, channelID int, token string) (*http.Request, error) {
	if snapshot == nil {
		return nil, fmt.Errorf("snapshot is nil")
	}
	method := strings.TrimSpace(snapshot.Method)
	if method == "" {
		method = http.MethodPost
	}
	req, err := http.NewRequest(method, "http://snapshot-replay.invalid", strings.NewReader(snapshot.Body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer sk-%s-%d", token, channelID))
	req.Header.Set("X-NewAPI-Replay-Source-Request-Id", snapshot.RequestId)
	req.Header.Set("X-NewAPI-Replay", "true")
	if snapshot.ContentType != "" {
		req.Header.Set("Content-Type", snapshot.ContentType)
	}
	for key, values := range parseSnapshotHeaders(snapshot.Headers) {
		if strings.EqualFold(key, "Authorization") {
			continue
		}
		for _, value := range values {
			if value != "" {
				req.Header.Add(key, value)
			}
		}
	}
	return req, nil
}

func parseSnapshotHeaders(raw string) map[string][]string {
	headers := make(map[string][]string)
	if strings.TrimSpace(raw) == "" {
		return headers
	}
	_ = common.Unmarshal([]byte(raw), &headers)
	return headers
}
