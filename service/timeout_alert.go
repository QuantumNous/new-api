package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

const defaultTimeoutAlertTimeoutMs = 3000

type feishuTextMessage struct {
	MsgType string `json:"msg_type"`
	Content struct {
		Text string `json:"text"`
	} `json:"content"`
}

type TimeoutAlert struct {
	Kind           string
	TimeoutSeconds int
	StatusCode     int
	Err            error
}

func IsTimeoutStatus(statusCode int) bool {
	return statusCode == http.StatusRequestTimeout || statusCode == http.StatusGatewayTimeout || statusCode == 524
}

func IsTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) || os.IsTimeout(err) {
		return true
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "timeout") || strings.Contains(message, "timed out") || strings.Contains(message, "deadline exceeded")
}

func NotifyRelayTimeout(c *gin.Context, info *relaycommon.RelayInfo, alert TimeoutAlert) {
	if strings.TrimSpace(common.TimeoutAlertWebhookURL) == "" {
		return
	}
	text := formatRelayTimeoutAlert(c, info, alert)
	gopool.Go(func() {
		if err := sendTimeoutAlertText(text); err != nil {
			common.SysError("timeout alert webhook failed: " + err.Error())
		}
	})
}

func sendTimeoutAlertText(text string) error {
	payload := feishuTextMessage{MsgType: "text"}
	payload.Content.Text = text
	body, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal timeout alert: %w", err)
	}

	timeout := time.Duration(common.TimeoutAlertTimeoutMs) * time.Millisecond
	if timeout <= 0 {
		timeout = defaultTimeoutAlertTimeoutMs * time.Millisecond
	}
	client := &http.Client{Timeout: timeout}
	resp, err := client.Post(common.TimeoutAlertWebhookURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("send timeout alert: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("timeout alert webhook status %d", resp.StatusCode)
	}
	return nil
}

func formatRelayTimeoutAlert(c *gin.Context, info *relaycommon.RelayInfo, alert TimeoutAlert) string {
	label := strings.TrimSpace(common.TimeoutAlertLabel)
	if label == "" {
		label = "unknown"
	}
	if !strings.HasPrefix(label, "[") {
		label = "[" + label + "]"
	}

	requestId := contextString(c, common.RequestIdKey)
	upstreamRequestId := contextString(c, common.UpstreamRequestIdKey)
	modelName := contextString(c, "original_model")
	path := ""
	if c != nil && c.Request != nil && c.Request.URL != nil {
		path = c.Request.URL.Path
	}
	channelId := 0
	channelName := contextString(c, "channel_name")
	channelType := 0
	if c != nil {
		channelId = c.GetInt("channel_id")
		channelType = c.GetInt("channel_type")
	}
	elapsedSeconds := 0

	if info != nil {
		if requestId == "" {
			requestId = info.RequestId
		}
		if modelName == "" {
			modelName = info.OriginModelName
		}
		if path == "" {
			path = info.RequestURLPath
		}
		if !info.StartTime.IsZero() {
			elapsedSeconds = int(time.Since(info.StartTime).Seconds())
		}
	}

	if requestId == "" {
		requestId = "unknown"
	}
	if modelName == "" {
		modelName = "unknown"
	}
	if path == "" {
		path = "unknown"
	}
	if alert.Kind == "" {
		alert.Kind = "unknown"
	}

	return fmt.Sprintf(
		"%s timeout, request-id: %s, model-name: %s\nkind: %s, timeout-seconds: %d, elapsed-seconds: %d, status-code: %d\npath: %s\nchannel-id: %d, channel-name: %s, channel-type: %d\nupstream-request-id: %s\nerror: %s",
		label,
		requestId,
		modelName,
		alert.Kind,
		alert.TimeoutSeconds,
		elapsedSeconds,
		alert.StatusCode,
		path,
		channelId,
		emptyToUnknown(channelName),
		channelType,
		emptyToUnknown(upstreamRequestId),
		emptyToUnknown(common.MaskSensitiveInfo(errorMessage(alert.Err))),
	)
}

func contextString(c *gin.Context, key string) string {
	if c == nil {
		return ""
	}
	return strings.TrimSpace(c.GetString(key))
}

func errorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func emptyToUnknown(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	return value
}
