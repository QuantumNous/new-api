package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	codexOfficialNoticeAITimeout           = 20 * time.Second
	codexOfficialNoticeAIResponseMaxBytes  = int64(256 * 1024)
	codexOfficialNoticeAIContentMaxRunes   = 60000
	codexOfficialNoticeAIDefaultBaseURL    = "https://api.openai.com/v1"
	codexOfficialNoticeAIDefaultModel      = "gpt-5.4-mini"
	codexOfficialNoticeAIEndpointEnv       = "MONITOR_AI_ANALYSIS_BASE_URL"
	codexOfficialNoticeAIModelEnv          = "MONITOR_AI_ANALYSIS_MODEL"
	codexOfficialNoticeAIMatchedRulePrefix = "ai_analysis"
)

type codexOfficialNoticeAIRequest struct {
	Model           string                         `json:"model"`
	Input           []codexOfficialNoticeAIMessage `json:"input"`
	Text            codexOfficialNoticeAIText      `json:"text"`
	MaxOutputTokens int                            `json:"max_output_tokens"`
}

type codexOfficialNoticeAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type codexOfficialNoticeAIText struct {
	Format codexOfficialNoticeAITextFormat `json:"format"`
}

type codexOfficialNoticeAITextFormat struct {
	Type   string                          `json:"type"`
	Name   string                          `json:"name"`
	Schema codexOfficialNoticeAIJSONSchema `json:"schema"`
	Strict bool                            `json:"strict"`
}

type codexOfficialNoticeAIJSONSchema struct {
	Type                 string                                 `json:"type"`
	AdditionalProperties bool                                   `json:"additionalProperties"`
	Properties           map[string]codexOfficialNoticeAISchema `json:"properties"`
	Required             []string                               `json:"required"`
}

type codexOfficialNoticeAISchema struct {
	Type                 string                                 `json:"type,omitempty"`
	Description          string                                 `json:"description,omitempty"`
	Items                *codexOfficialNoticeAISchema           `json:"items,omitempty"`
	Properties           map[string]codexOfficialNoticeAISchema `json:"properties,omitempty"`
	Required             []string                               `json:"required,omitempty"`
	AdditionalProperties *bool                                  `json:"additionalProperties,omitempty"`
}

type codexOfficialNoticeAIHTTPResponse struct {
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

type codexOfficialNoticeAIResult struct {
	Findings []codexOfficialNoticeAIModelFinding `json:"findings"`
}

type CodexOfficialNoticeAIOptions struct {
	APIKey  string
	BaseURL string
	Model   string
}

type codexOfficialNoticeAIModelFinding struct {
	ModelName     string `json:"model_name"`
	LifecycleTerm string `json:"lifecycle_term"`
	Evidence      string `json:"evidence"`
}

func ExtractCodexOfficialNoticeFindingsByAI(content string, modelNames []string, sourceURL string, apiKey string) ([]CodexModelUnsupportedFinding, error) {
	return ExtractCodexOfficialNoticeFindingsByAIWithOptions(content, modelNames, sourceURL, CodexOfficialNoticeAIOptions{
		APIKey: apiKey,
	})
}

func ExtractCodexOfficialNoticeFindingsByAIWithOptions(content string, modelNames []string, sourceURL string, options CodexOfficialNoticeAIOptions) ([]CodexModelUnsupportedFinding, error) {
	options = resolveCodexOfficialNoticeAIOptions(options)
	if options.APIKey == "" {
		return nil, fmt.Errorf("monitoring AI analysis API key is empty")
	}
	modelNames = normalizeCodexOfficialNoticeCandidateModels(modelNames)
	if len(modelNames) == 0 {
		return nil, nil
	}

	result, err := requestCodexOfficialNoticeAIAnalysis(content, modelNames, sourceURL, options)
	if err != nil {
		return nil, err
	}
	return codexOfficialNoticeAIResultToFindings(result, modelNames), nil
}

func ExtractCodexOfficialNoticeFindingsWithOptionalAI(content string, modelNames []string, terms []string, sourceURL string, apiKey string) ([]CodexModelUnsupportedFinding, bool, error) {
	return ExtractCodexOfficialNoticeFindingsWithOptionalAIWithOptions(content, modelNames, terms, sourceURL, CodexOfficialNoticeAIOptions{
		APIKey: apiKey,
	})
}

func ExtractCodexOfficialNoticeFindingsWithOptionalAIWithOptions(content string, modelNames []string, terms []string, sourceURL string, options CodexOfficialNoticeAIOptions) ([]CodexModelUnsupportedFinding, bool, error) {
	options = resolveCodexOfficialNoticeAIOptions(options)
	if options.APIKey == "" {
		return ExtractCodexOfficialNoticeFindings(content, modelNames, terms), false, nil
	}
	findings, err := ExtractCodexOfficialNoticeFindingsByAIWithOptions(content, modelNames, sourceURL, options)
	if err != nil {
		return ExtractCodexOfficialNoticeFindings(content, modelNames, terms), true, err
	}
	return findings, true, nil
}

func requestCodexOfficialNoticeAIAnalysis(content string, modelNames []string, sourceURL string, options CodexOfficialNoticeAIOptions) (codexOfficialNoticeAIResult, error) {
	endpoint := codexOfficialNoticeAIEndpoint(options.BaseURL)
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(endpoint, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return codexOfficialNoticeAIResult{}, fmt.Errorf("request reject: %v", err)
	}

	body, err := common.Marshal(buildCodexOfficialNoticeAIRequest(content, modelNames, sourceURL, options.Model))
	if err != nil {
		return codexOfficialNoticeAIResult{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), codexOfficialNoticeAITimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return codexOfficialNoticeAIResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+options.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NewAPI-Codex-Governance-AI/1.0")

	client := GetHttpClient()
	if client == nil {
		client = http.DefaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return codexOfficialNoticeAIResult{}, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, codexOfficialNoticeAIResponseMaxBytes+1))
	if err != nil {
		return codexOfficialNoticeAIResult{}, err
	}
	if int64(len(raw)) > codexOfficialNoticeAIResponseMaxBytes {
		return codexOfficialNoticeAIResult{}, fmt.Errorf("monitoring AI analysis response exceeds %d bytes", codexOfficialNoticeAIResponseMaxBytes)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return codexOfficialNoticeAIResult{}, fmt.Errorf("monitoring AI analysis returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var envelope codexOfficialNoticeAIHTTPResponse
	if err := common.Unmarshal(raw, &envelope); err != nil {
		return codexOfficialNoticeAIResult{}, err
	}
	if envelope.Error != nil && strings.TrimSpace(envelope.Error.Message) != "" {
		return codexOfficialNoticeAIResult{}, fmt.Errorf("monitoring AI analysis error: %s", strings.TrimSpace(envelope.Error.Message))
	}
	outputText := strings.TrimSpace(extractCodexOfficialNoticeAIOutputText(envelope))
	if outputText == "" {
		return codexOfficialNoticeAIResult{}, fmt.Errorf("monitoring AI analysis returned empty output")
	}

	var result codexOfficialNoticeAIResult
	if err := common.Unmarshal([]byte(outputText), &result); err != nil {
		return codexOfficialNoticeAIResult{}, err
	}
	return result, nil
}

func buildCodexOfficialNoticeAIRequest(content string, modelNames []string, sourceURL string, modelName string) codexOfficialNoticeAIRequest {
	modelNamesJSON, _ := common.Marshal(modelNames)
	return codexOfficialNoticeAIRequest{
		Model: modelName,
		Input: []codexOfficialNoticeAIMessage{
			{
				Role: "system",
				Content: strings.Join([]string{
					"You analyze official Codex product notices for model lifecycle changes.",
					"Only mark a candidate model when the supplied official text explicitly says that exact model is deprecated, retired, sunset, removed, unavailable, or not supported for Codex or ChatGPT-account Codex usage.",
					"Do not infer from examples, generic feature descriptions, pricing, API model lists, or unclear wording.",
					"If evidence is ambiguous, return no finding for that model.",
					"Return JSON only, following the required schema.",
				}, " "),
			},
			{
				Role: "user",
				Content: fmt.Sprintf(
					"Source URL: %s\nCandidate model names JSON: %s\nOfficial notice text:\n%s",
					strings.TrimSpace(sourceURL),
					string(modelNamesJSON),
					truncateCodexOfficialNoticeAIContent(content),
				),
			},
		},
		Text: codexOfficialNoticeAIText{
			Format: codexOfficialNoticeAITextFormat{
				Type:   "json_schema",
				Name:   "codex_official_notice_findings",
				Schema: buildCodexOfficialNoticeAIResponseSchema(),
				Strict: true,
			},
		},
		MaxOutputTokens: 1200,
	}
}

func buildCodexOfficialNoticeAIResponseSchema() codexOfficialNoticeAIJSONSchema {
	noAdditionalProperties := false
	return codexOfficialNoticeAIJSONSchema{
		Type:                 "object",
		AdditionalProperties: false,
		Required:             []string{"findings"},
		Properties: map[string]codexOfficialNoticeAISchema{
			"findings": {
				Type: "array",
				Items: &codexOfficialNoticeAISchema{
					Type:                 "object",
					AdditionalProperties: &noAdditionalProperties,
					Required:             []string{"model_name", "lifecycle_term", "evidence"},
					Properties: map[string]codexOfficialNoticeAISchema{
						"model_name": {
							Type:        "string",
							Description: "Exact model name from the candidate list.",
						},
						"lifecycle_term": {
							Type:        "string",
							Description: "Short lifecycle term, for example retired, deprecated, sunset, unavailable, or not supported.",
						},
						"evidence": {
							Type:        "string",
							Description: "Short excerpt or paraphrase from the official text supporting the finding.",
						},
					},
				},
			},
		},
	}
}

func resolveCodexOfficialNoticeAIOptions(options CodexOfficialNoticeAIOptions) CodexOfficialNoticeAIOptions {
	return CodexOfficialNoticeAIOptions{
		APIKey:  strings.TrimSpace(options.APIKey),
		BaseURL: codexOfficialNoticeAIBaseURL(options.BaseURL),
		Model:   codexOfficialNoticeAIModel(options.Model),
	}
}

func codexOfficialNoticeAIEndpoint(baseURL string) string {
	baseURL = codexOfficialNoticeAIBaseURL(baseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	if strings.HasSuffix(baseURL, "/responses") {
		return baseURL
	}
	return baseURL + "/responses"
}

func codexOfficialNoticeAIBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = strings.TrimSpace(os.Getenv(codexOfficialNoticeAIEndpointEnv))
	}
	if baseURL != "" {
		return baseURL
	}
	return codexOfficialNoticeAIDefaultBaseURL
}

func codexOfficialNoticeAIModel(modelName string) string {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = strings.TrimSpace(os.Getenv(codexOfficialNoticeAIModelEnv))
	}
	if modelName != "" {
		return modelName
	}
	return codexOfficialNoticeAIDefaultModel
}

func extractCodexOfficialNoticeAIOutputText(envelope codexOfficialNoticeAIHTTPResponse) string {
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

func codexOfficialNoticeAIResultToFindings(result codexOfficialNoticeAIResult, candidateModels []string) []CodexModelUnsupportedFinding {
	candidates := make(map[string]struct{}, len(candidateModels))
	for _, modelName := range candidateModels {
		candidates[modelName] = struct{}{}
	}

	findings := make([]CodexModelUnsupportedFinding, 0, len(result.Findings))
	seen := make(map[string]struct{}, len(result.Findings))
	for _, item := range result.Findings {
		modelName := strings.TrimSpace(item.ModelName)
		if modelName == "" {
			continue
		}
		if _, ok := candidates[modelName]; !ok {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}

		term := strings.TrimSpace(item.LifecycleTerm)
		if term == "" {
			term = "matched"
		}
		findings = append(findings, CodexModelUnsupportedFinding{
			ModelName:   modelName,
			Source:      model.CodexModelGovernanceSourceOfficialCodexNotice,
			MatchedRule: codexOfficialNoticeAIMatchedRulePrefix + ":" + term,
			LastError:   strings.TrimSpace(item.Evidence),
		})
	}
	return findings
}

func normalizeCodexOfficialNoticeCandidateModels(modelNames []string) []string {
	seen := make(map[string]struct{}, len(modelNames))
	normalized := make([]string, 0, len(modelNames))
	for _, modelName := range modelNames {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" {
			continue
		}
		if _, ok := seen[modelName]; ok {
			continue
		}
		seen[modelName] = struct{}{}
		normalized = append(normalized, modelName)
	}
	return normalized
}

func truncateCodexOfficialNoticeAIContent(content string) string {
	content = strings.TrimSpace(content)
	runes := []rune(content)
	if len(runes) <= codexOfficialNoticeAIContentMaxRunes {
		return content
	}
	return string(runes[:codexOfficialNoticeAIContentMaxRunes])
}
