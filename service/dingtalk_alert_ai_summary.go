package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	dingTalkChannelAlertAISummaryTimeout       = 5 * time.Second
	dingTalkChannelAlertAIResponseMaxBytes     = int64(64 * 1024)
	dingTalkChannelAlertAIContentMaxRunes      = 12000
	dingTalkChannelAlertAISummaryMaxRunes      = 1000
	dingTalkChannelAlertAISummaryMaxBulletRows = 5
)

type dingTalkChannelAlertAIOptions struct {
	APIKey  string
	BaseURL string
	Model   string
}

type dingTalkChannelAlertAIRequest struct {
	Model           string                          `json:"model"`
	Input           []dingTalkChannelAlertAIMessage `json:"input"`
	MaxOutputTokens int                             `json:"max_output_tokens"`
}

type dingTalkChannelAlertAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type dingTalkChannelAlertAIHTTPResponse struct {
	OutputText string `json:"output_text"`
	Output     []struct {
		Type    string `json:"type"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func buildDingTalkChannelAlertContentWithOptionalAISummary(alerts []DingTalkChannelAlert, rawContent string) string {
	if strings.TrimSpace(rawContent) == "" || strings.TrimSpace(operation_setting.GetMonitorAIAnalysisAPIKey()) == "" {
		return rawContent
	}
	summary, err := generateDingTalkChannelAlertAISummary(rawContent, alerts)
	if err != nil {
		common.SysError("dingtalk channel alert AI summary skipped: " + sanitizeDingTalkAlertText(err.Error()))
		return rawContent
	}
	summary = normalizeDingTalkChannelAlertAISummary(summary)
	if summary == "" {
		return rawContent
	}
	return "AI 中文总结：\n" + summary + "\n\n" + rawContent
}

func generateDingTalkChannelAlertAISummary(rawContent string, alerts []DingTalkChannelAlert) (string, error) {
	options := resolveDingTalkChannelAlertAIOptions(dingTalkChannelAlertAIOptions{
		APIKey: operation_setting.GetMonitorAIAnalysisAPIKey(),
	})
	if options.APIKey == "" {
		return "", fmt.Errorf("monitoring AI analysis API key is empty")
	}

	endpoint := dingTalkChannelAlertAIEndpoint(options.BaseURL)
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(endpoint, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return "", fmt.Errorf("request reject: %v", err)
	}

	body, err := common.Marshal(buildDingTalkChannelAlertAIRequest(rawContent, alerts, options.Model))
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), dingTalkChannelAlertAISummaryTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+options.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NewAPI-DingTalk-Alert-AI/1.0")

	client, err := requireHttpClient()
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, dingTalkChannelAlertAIResponseMaxBytes+1))
	if err != nil {
		return "", err
	}
	if int64(len(raw)) > dingTalkChannelAlertAIResponseMaxBytes {
		return "", fmt.Errorf("monitoring AI summary response exceeds %d bytes", dingTalkChannelAlertAIResponseMaxBytes)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("monitoring AI summary returned status %d: %s", resp.StatusCode, dingTalkChannelAlertAIErrorBodySummary(raw))
	}

	var envelope dingTalkChannelAlertAIHTTPResponse
	if err := common.Unmarshal(raw, &envelope); err != nil {
		return "", err
	}
	if envelope.Error != nil && strings.TrimSpace(envelope.Error.Message) != "" {
		return "", fmt.Errorf("monitoring AI summary error: %s", sanitizeDingTalkAlertText(envelope.Error.Message))
	}
	outputText := strings.TrimSpace(extractDingTalkChannelAlertAIOutputText(envelope))
	if outputText == "" {
		return "", fmt.Errorf("monitoring AI summary returned empty output")
	}
	outputText = sanitizeDingTalkAlertText(outputText)
	if len([]rune(outputText)) > dingTalkChannelAlertAISummaryMaxRunes*2 {
		return "", fmt.Errorf("monitoring AI summary is too long")
	}
	return outputText, nil
}

func buildDingTalkChannelAlertAIRequest(rawContent string, alerts []DingTalkChannelAlert, modelName string) dingTalkChannelAlertAIRequest {
	sanitizedContent := truncateDingTalkChannelAlertAIContent(sanitizeDingTalkAlertText(rawContent))
	return dingTalkChannelAlertAIRequest{
		Model: modelName,
		Input: []dingTalkChannelAlertAIMessage{
			{
				Role: "system",
				Content: strings.Join([]string{
					"You summarize New API scheduled channel-test DingTalk failure alerts for operators.",
					"Write simplified Chinese only.",
					"Use 3 to 5 short bullet points when enough information is present.",
					"Summarize only the supplied alert batch.",
					"Mention high-priority actions only when clear from the alert fields, such as authentication failures, quota or rate limits, upstream unavailability, timeouts, or automatic disabling.",
					"Do not invent facts, root causes, channel IDs, or remediation steps.",
					"Do not expose secrets.",
				}, " "),
			},
			{
				Role: "user",
				Content: fmt.Sprintf(
					"Alert count: %d\nSanitized DingTalk alert content:\n%s",
					len(alerts),
					sanitizedContent,
				),
			},
		},
		MaxOutputTokens: 600,
	}
}

func resolveDingTalkChannelAlertAIOptions(options dingTalkChannelAlertAIOptions) dingTalkChannelAlertAIOptions {
	apiKey := strings.TrimSpace(options.APIKey)
	if apiKey == "" {
		apiKey = operation_setting.GetMonitorAIAnalysisAPIKey()
	}
	baseURL := strings.TrimSpace(options.BaseURL)
	if baseURL == "" {
		baseURL = operation_setting.GetMonitorAIAnalysisBaseURL()
	}
	modelName := strings.TrimSpace(options.Model)
	if modelName == "" {
		modelName = operation_setting.GetMonitorAIAnalysisModel()
	}
	return dingTalkChannelAlertAIOptions{
		APIKey:  apiKey,
		BaseURL: dingTalkChannelAlertAIBaseURL(baseURL),
		Model:   dingTalkChannelAlertAIModel(modelName),
	}
}

func dingTalkChannelAlertAIEndpoint(baseURL string) string {
	baseURL = strings.TrimRight(dingTalkChannelAlertAIBaseURL(baseURL), "/")
	if strings.HasSuffix(baseURL, "/responses") {
		return baseURL
	}
	return baseURL + "/responses"
}

func dingTalkChannelAlertAIBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL != "" {
		return baseURL
	}
	return operation_setting.DefaultMonitorAIAnalysisBaseURL
}

func dingTalkChannelAlertAIModel(modelName string) string {
	modelName = strings.TrimSpace(modelName)
	if modelName != "" {
		return modelName
	}
	return operation_setting.DefaultMonitorAIAnalysisModelName
}

func extractDingTalkChannelAlertAIOutputText(envelope dingTalkChannelAlertAIHTTPResponse) string {
	if strings.TrimSpace(envelope.OutputText) != "" {
		return envelope.OutputText
	}
	for _, output := range envelope.Output {
		for _, content := range output.Content {
			if strings.TrimSpace(content.Text) != "" {
				return content.Text
			}
		}
	}
	return ""
}

func normalizeDingTalkChannelAlertAISummary(value string) string {
	value = strings.TrimSpace(sanitizeDingTalkAlertText(value))
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	value = strings.TrimSpace(strings.TrimPrefix(value, "AI 中文总结："))
	value = strings.TrimSpace(strings.TrimPrefix(value, "AI中文总结："))
	if value == "" {
		return ""
	}

	lines := strings.Split(value, "\n")
	normalized := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "AI 中文总结") || strings.HasPrefix(line, "AI中文总结") {
			continue
		}
		if !strings.HasPrefix(line, "- ") {
			line = strings.TrimLeft(line, "-*• \t")
			line = "- " + line
		}
		normalized = append(normalized, truncateDingTalkChannelAlertAIRunes(line, 240))
		if len(normalized) >= dingTalkChannelAlertAISummaryMaxBulletRows {
			break
		}
	}
	return truncateDingTalkChannelAlertAIRunes(strings.Join(normalized, "\n"), dingTalkChannelAlertAISummaryMaxRunes)
}

func truncateDingTalkChannelAlertAIContent(content string) string {
	content = strings.TrimSpace(content)
	return truncateDingTalkChannelAlertAIRunes(content, dingTalkChannelAlertAIContentMaxRunes)
}

func truncateDingTalkChannelAlertAIRunes(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes])
}

func dingTalkChannelAlertAIErrorBodySummary(raw []byte) string {
	body := strings.TrimSpace(string(raw))
	if body == "" {
		return "empty response body"
	}
	sanitized := common.LocalLogPreview(sanitizeDingTalkAlertText(body))
	return fmt.Sprintf("response body redacted (sanitized_length=%d)", len([]rune(sanitized)))
}
