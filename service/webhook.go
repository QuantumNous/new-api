package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// WebhookPayload webhook 通知的负载数据
type WebhookPayload struct {
	Type      string        `json:"type"`
	Title     string        `json:"title"`
	Content   string        `json:"content"`
	Values    []interface{} `json:"values,omitempty"`
	Timestamp int64         `json:"timestamp"`
}

const (
	webhookDeliveryTimeout  = 15 * time.Second
	WebhookDeliveryIDHeader = "X-Webhook-Delivery-Id"
	WebhookTimestampHeader  = "X-Webhook-Timestamp"
	webhookSignatureVersion = "v1"
)

// generateSignature preserves the existing notification-webhook contract.
func generateSignature(secret string, payload []byte) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

func generateVersionedSignature(secret string, timestamp string, deliveryID string, payload []byte) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(webhookSignatureVersion))
	h.Write([]byte("."))
	h.Write([]byte(timestamp))
	h.Write([]byte("."))
	h.Write([]byte(deliveryID))
	h.Write([]byte("."))
	h.Write(payload)
	return webhookSignatureVersion + "=" + hex.EncodeToString(h.Sum(nil))
}

// ValidateJSONWebhookURL applies the SSRF policy and requires encrypted
// transport for async callback payloads and signatures.
func ValidateJSONWebhookURL(webhookURL string) error {
	parsed, err := url.Parse(webhookURL)
	if err != nil {
		return err
	}
	if !strings.EqualFold(parsed.Scheme, "https") {
		return fmt.Errorf("async image webhook transport only supports https URLs")
	}
	return validateWebhookFetchURL(webhookURL)
}

// SendJSONWebhook preserves the original body-only signature contract.
func SendJSONWebhook(ctx context.Context, webhookURL string, secret string, payload any) error {
	return SendJSONWebhookWithDeliveryID(ctx, webhookURL, secret, "", payload)
}

// SendJSONWebhookWithDeliveryID sends an at-least-once webhook delivery. The
// delivery ID must remain stable across retries so receivers can deduplicate a
// request when an acknowledgement is lost after they process it.
func SendJSONWebhookWithDeliveryID(ctx context.Context, webhookURL string, secret string, deliveryID string, payload any) error {
	requestCtx, cancel := context.WithTimeout(ctx, webhookDeliveryTimeout)
	defer cancel()

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}
	if err := ValidateJSONWebhookURL(webhookURL); err != nil {
		return fmt.Errorf("request reject: %w", err)
	}

	return sendJSONWebhookBytesWithClient(requestCtx, GetDirectSSRFProtectedHTTPClient(), webhookURL, secret, deliveryID, payloadBytes)
}

func sendJSONWebhookWithClient(ctx context.Context, client *http.Client, webhookURL string, secret string, deliveryID string, payload any) error {
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}
	return sendJSONWebhookBytesWithClient(ctx, client, webhookURL, secret, deliveryID, payloadBytes)
}

func sendJSONWebhookBytesWithClient(ctx context.Context, client *http.Client, webhookURL string, secret string, deliveryID string, payload []byte) error {
	if client == nil {
		return fmt.Errorf("webhook HTTP client is required")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if deliveryID != "" {
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		req.Header.Set(WebhookTimestampHeader, timestamp)
		req.Header.Set(WebhookDeliveryIDHeader, deliveryID)
		if secret != "" {
			req.Header.Set("X-Webhook-Signature", generateVersionedSignature(secret, timestamp, deliveryID, payload))
		}
	} else if secret != "" {
		req.Header.Set("X-Webhook-Signature", generateSignature(secret, payload))
	}

	// Webhook delivery is defined as one POST to the registered endpoint. Go
	// rewrites POST to GET for 301/302/303 redirects and copies custom headers,
	// which could both falsely acknowledge delivery and disclose the signature
	// to another origin. Clone the client so the shared transport remains reusable
	// while redirects are rejected for this request.
	deliveryClient := *client
	deliveryClient.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	resp, err := deliveryClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("webhook request failed with status code: %d", resp.StatusCode)
	}
	return nil
}

// SendWebhookNotify 发送 webhook 通知
func SendWebhookNotify(webhookURL string, secret string, data dto.Notify) error {
	// 处理占位符
	content := data.Content
	for _, value := range data.Values {
		content = fmt.Sprintf(content, value)
	}

	// 构建 webhook 负载
	payload := WebhookPayload{
		Type:      data.Type,
		Title:     data.Title,
		Content:   content,
		Values:    data.Values,
		Timestamp: time.Now().Unix(),
	}

	// 序列化负载
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %v", err)
	}

	// 创建 HTTP 请求
	var req *http.Request
	var resp *http.Response

	if system_setting.EnableWorker() {
		// 构建worker请求数据
		workerReq := &WorkerRequest{
			URL:    webhookURL,
			Key:    system_setting.WorkerValidKey,
			Method: http.MethodPost,
			Headers: map[string]string{
				"Content-Type": "application/json",
			},
			Body: payloadBytes,
		}

		// 如果有secret，添加签名到headers
		if secret != "" {
			signature := generateSignature(secret, payloadBytes)
			workerReq.Headers["X-Webhook-Signature"] = signature
			workerReq.Headers["Authorization"] = "Bearer " + secret
		}

		resp, err = DoWorkerRequest(workerReq)
		if err != nil {
			return fmt.Errorf("failed to send webhook request through worker: %v", err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("webhook request failed with status code: %d", resp.StatusCode)
		}
	} else {
		// SSRF防护：验证Webhook URL（非Worker模式）
		if err := ValidateSSRFProtectedFetchURL(webhookURL); err != nil {
			return fmt.Errorf("request reject: %v", err)
		}

		req, err = http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(payloadBytes))
		if err != nil {
			return fmt.Errorf("failed to create webhook request: %v", err)
		}

		// 设置请求头
		req.Header.Set("Content-Type", "application/json")

		// 如果有 secret，生成签名
		if secret != "" {
			signature := generateSignature(secret, payloadBytes)
			req.Header.Set("X-Webhook-Signature", signature)
		}

		// 发送请求
		client := GetSSRFProtectedHTTPClient()
		resp, err = client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to send webhook request: %v", err)
		}
		defer resp.Body.Close()

		// 检查响应状态
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("webhook request failed with status code: %d", resp.StatusCode)
		}
	}

	return nil
}
