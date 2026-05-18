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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"
)

type moderationImageURL struct {
	URL string `json:"url"`
}

type moderationInputPart struct {
	Type     string              `json:"type"`
	Text     string              `json:"text,omitempty"`
	ImageURL *moderationImageURL `json:"image_url,omitempty"`
}

type moderationRequest struct {
	Model string `json:"model"`
	Input any    `json:"input"`
}

type moderationResponse struct {
	ID      string                  `json:"id"`
	Model   string                  `json:"model"`
	Results []moderationResultEntry `json:"results"`
}

type moderationErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    any    `json:"code"`
		Param   string `json:"param"`
	} `json:"error"`
}

type moderationResultEntry struct {
	Flagged                   bool                `json:"flagged"`
	Categories                map[string]bool     `json:"categories"`
	CategoryScores            map[string]float64  `json:"category_scores"`
	CategoryAppliedInputTypes map[string][]string `json:"category_applied_input_types"`
}

type ModerationResult struct {
	Action                    string              `json:"action"`
	Flagged                   bool                `json:"flagged"`
	Model                     string              `json:"model,omitempty"`
	BlockedCategories         []string            `json:"blocked_categories,omitempty"`
	FlaggedCategories         []string            `json:"flagged_categories,omitempty"`
	CategoryScores            map[string]float64  `json:"category_scores,omitempty"`
	CategoryAppliedInputTypes map[string][]string `json:"category_applied_input_types,omitempty"`
	InputTypes                []string            `json:"input_types,omitempty"`
	Error                     string              `json:"error,omitempty"`
}

func NewModerationErrorResult(err error) *ModerationResult {
	result := &ModerationResult{
		Action: "error",
	}
	if err != nil {
		result.Error = err.Error()
	}
	return result
}

func ModerationFailureModeClosed() bool {
	return setting.NormalizeModerationFailureMode(setting.ModerationFailureMode) == "closed"
}

func ModerateRelayRequest(ctx context.Context, request dto.Request, meta *types.TokenCountMeta) (*ModerationResult, error) {
	if !setting.ModerationEnabled {
		return nil, nil
	}
	if strings.TrimSpace(setting.ModerationAPIKey) == "" {
		return nil, fmt.Errorf("moderation api key is not configured")
	}
	if meta == nil && request != nil {
		meta = request.GetTokenCountMeta()
	}
	input, inputTypes := buildModerationInput(meta)
	if input == nil {
		return nil, nil
	}

	model := strings.TrimSpace(setting.ModerationModel)
	if model == "" {
		model = "omni-moderation-latest"
	}
	baseURL := strings.TrimRight(strings.TrimSpace(setting.ModerationBaseURL), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	timeout := time.Duration(setting.ModerationTimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	payload, err := common.Marshal(moderationRequest{
		Model: model,
		Input: input,
	})
	if err != nil {
		return nil, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, baseURL+"/moderations", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+setting.ModerationAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("moderation endpoint returned status %d: %s", resp.StatusCode, readModerationErrorBody(resp.Body))
	}

	var parsed moderationResponse
	if err := common.DecodeJson(resp.Body, &parsed); err != nil {
		return nil, err
	}
	result := normalizeModerationResult(parsed, inputTypes)
	return result, nil
}

func readModerationErrorBody(body io.Reader) string {
	if body == nil {
		return "empty response body"
	}
	data, err := io.ReadAll(io.LimitReader(body, 4096))
	if err != nil {
		return "failed to read response body: " + err.Error()
	}
	text := strings.TrimSpace(string(data))
	if text == "" {
		return "empty response body"
	}

	var parsed moderationErrorResponse
	if err := common.Unmarshal(data, &parsed); err == nil && parsed.Error.Message != "" {
		parts := []string{parsed.Error.Message}
		if parsed.Error.Type != "" {
			parts = append(parts, "type="+parsed.Error.Type)
		}
		if parsed.Error.Param != "" {
			parts = append(parts, "param="+parsed.Error.Param)
		}
		if parsed.Error.Code != nil {
			parts = append(parts, "code="+common.Interface2String(parsed.Error.Code))
		}
		return strings.Join(parts, ", ")
	}
	return text
}

func buildModerationInput(meta *types.TokenCountMeta) (any, []string) {
	if meta == nil {
		return nil, nil
	}
	parts := make([]moderationInputPart, 0, 1+len(meta.Files))
	inputTypes := make([]string, 0, 2)
	if strings.TrimSpace(meta.CombineText) != "" {
		parts = append(parts, moderationInputPart{
			Type: "text",
			Text: meta.CombineText,
		})
		inputTypes = appendUnique(inputTypes, "text")
	}
	for _, file := range meta.Files {
		if file == nil || file.FileType != types.FileTypeImage || file.Source == nil {
			continue
		}
		url := moderationImageSourceURL(file.Source)
		if url == "" {
			continue
		}
		parts = append(parts, moderationInputPart{
			Type:     "image_url",
			ImageURL: &moderationImageURL{URL: url},
		})
		inputTypes = appendUnique(inputTypes, "image")
	}
	if len(parts) == 0 {
		return nil, nil
	}
	if len(parts) == 1 && parts[0].Type == "text" {
		return parts[0].Text, inputTypes
	}
	return parts, inputTypes
}

func moderationImageSourceURL(source types.FileSource) string {
	raw := strings.TrimSpace(source.GetRawData())
	if raw == "" {
		return ""
	}
	if source.IsURL() || strings.HasPrefix(raw, "data:image/") {
		return raw
	}
	if base64Source, ok := source.(*types.Base64Source); ok && base64Source.MimeType != "" {
		return fmt.Sprintf("data:%s;base64,%s", base64Source.MimeType, raw)
	}
	return ""
}

func normalizeModerationResult(response moderationResponse, inputTypes []string) *ModerationResult {
	result := &ModerationResult{
		Action:     "pass",
		Model:      response.Model,
		InputTypes: inputTypes,
	}
	if len(response.Results) == 0 {
		return result
	}
	entry := response.Results[0]
	result.Flagged = entry.Flagged
	result.CategoryScores = entry.CategoryScores
	result.CategoryAppliedInputTypes = entry.CategoryAppliedInputTypes

	blockSet := make(map[string]struct{}, len(setting.ModerationBlockCategories))
	for _, category := range setting.ModerationBlockCategories {
		blockSet[strings.TrimSpace(category)] = struct{}{}
	}
	for category, flagged := range entry.Categories {
		if !flagged {
			continue
		}
		result.FlaggedCategories = append(result.FlaggedCategories, category)
		if _, ok := blockSet[category]; ok {
			result.BlockedCategories = append(result.BlockedCategories, category)
		}
	}
	if len(result.BlockedCategories) > 0 {
		result.Action = "block"
	} else if result.Flagged {
		result.Action = "warn"
	}
	return result
}

func appendUnique(items []string, item string) []string {
	for _, existing := range items {
		if existing == item {
			return items
		}
	}
	return append(items, item)
}
