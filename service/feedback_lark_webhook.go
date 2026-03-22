package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	feedbackLarkWebhookRetryInterval = 5 * time.Second
	feedbackLarkWebhookRetryCount    = 3
)

var feedbackLarkWebhookSleep = time.Sleep

type larkWebhookResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

type larkWebhookPayload struct {
	Timestamp string                 `json:"timestamp,omitempty"`
	Sign      string                 `json:"sign,omitempty"`
	MsgType   string                 `json:"msg_type"`
	Card      map[string]interface{} `json:"card"`
}

func feedbackCategoryLabel(category string) string {
	switch category {
	case "bug":
		return "问题反馈"
	case "consulting":
		return "采购咨询"
	case "feature":
		return "产品建议"
	case "other":
		return "其他反馈"
	default:
		return category
	}
}

func generateLarkWebhookSign(secret string, timestamp int64) (string, error) {
	stringToSign := fmt.Sprintf("%d\n%s", timestamp, secret)
	h := hmac.New(sha256.New, []byte(stringToSign))
	if _, err := h.Write([]byte{}); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(h.Sum(nil)), nil
}

func buildFeedbackLarkCard(feedback *model.Feedback) map[string]interface{} {
	submittedAt := time.Unix(feedback.CreatedTime, 0).Format("2006-01-02 15:04:05")
	content := fmt.Sprintf("%s**反馈中心收到新提交**\n\n**系统**：%s\n**类型**：%s\n**用户名**：%s\n**邮箱**：%s\n**提交时间**：%s\n\n**内容**：\n%s",
		buildFeedbackLarkMentions(),
		common.SystemName,
		feedbackCategoryLabel(feedback.Category),
		feedback.Username,
		feedback.Email,
		submittedAt,
		feedback.Content,
	)

	return map[string]interface{}{
		"header": map[string]interface{}{
			"title": map[string]interface{}{
				"tag":     "plain_text",
				"content": "反馈新提交通知",
			},
			"template": "orange",
		},
		"elements": []map[string]interface{}{
			{
				"tag": "div",
				"text": map[string]interface{}{
					"tag":     "lark_md",
					"content": content,
				},
			},
		},
	}
}

func buildFeedbackLarkMentions() string {
	mentions := make([]string, 0, 4)
	if common.FeedbackLarkWebhookMentionAllEnabled {
		mentions = append(mentions, "<at id=all></at>")
	}

	for _, openID := range splitFeedbackLarkMentionOpenIDs(common.FeedbackLarkWebhookMentionOpenIDs) {
		mentions = append(mentions, fmt.Sprintf("<at id=%s></at>", openID))
	}

	if len(mentions) == 0 {
		return ""
	}

	return strings.Join(mentions, " ") + "\n\n"
}

func splitFeedbackLarkMentionOpenIDs(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r' || r == ';'
	})

	openIDs := make([]string, 0, len(fields))
	seen := make(map[string]struct{}, len(fields))
	for _, field := range fields {
		openID := strings.TrimSpace(field)
		if openID == "" {
			continue
		}
		if _, ok := seen[openID]; ok {
			continue
		}
		seen[openID] = struct{}{}
		openIDs = append(openIDs, openID)
	}

	return openIDs
}

func sendFeedbackLarkWebhookRequest(webhookURL string, payloadBytes []byte) error {
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("create lark webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return fmt.Errorf("send lark webhook request: %w", err)
	}
	defer CloseResponseBodyGracefully(resp)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("lark webhook request failed with status code: %d", resp.StatusCode)
	}

	var response larkWebhookResponse
	if err := common.DecodeJson(resp.Body, &response); err != nil {
		return fmt.Errorf("decode lark webhook response: %w", err)
	}
	if response.Code != 0 {
		return fmt.Errorf("lark webhook response error: code=%d msg=%s", response.Code, response.Msg)
	}

	return nil
}

func NotifyFeedbackLarkWebhook(feedback *model.Feedback) error {
	if !common.FeedbackLarkWebhookEnabled {
		return nil
	}

	webhookURL := strings.TrimSpace(common.FeedbackLarkWebhookURL)
	if webhookURL == "" {
		return nil
	}

	payload := larkWebhookPayload{
		MsgType: "interactive",
		Card:    buildFeedbackLarkCard(feedback),
	}

	if secret := strings.TrimSpace(common.FeedbackLarkWebhookSecret); secret != "" {
		timestamp := time.Now().Unix()
		sign, err := generateLarkWebhookSign(secret, timestamp)
		if err != nil {
			return fmt.Errorf("generate lark webhook sign: %w", err)
		}
		payload.Timestamp = fmt.Sprintf("%d", timestamp)
		payload.Sign = sign
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal lark webhook payload: %w", err)
	}

	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(
		webhookURL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	); err != nil {
		return fmt.Errorf("request reject: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= feedbackLarkWebhookRetryCount; attempt++ {
		lastErr = sendFeedbackLarkWebhookRequest(webhookURL, payloadBytes)
		if lastErr == nil {
			return nil
		}
		if attempt == feedbackLarkWebhookRetryCount {
			break
		}
		feedbackLarkWebhookSleep(feedbackLarkWebhookRetryInterval)
	}

	return fmt.Errorf("notify lark webhook failed after %d retries: %w", feedbackLarkWebhookRetryCount, lastErr)
}
