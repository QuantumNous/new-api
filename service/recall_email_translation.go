package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	recallEmailTranslationDefaultMaxBytes = int64(256 * 1024)
	recallEmailTranslationDefaultTimeout  = 30 * time.Second
	recallEmailTranslationMaxAttempts     = 3
	recallEmailTranslationMaxRetryAfter   = 2 * time.Second
	recallEmailSubjectMaxRunes            = 200
	recallEmailBodyMaxRunes               = 2000
	recallEmailTranslationMaxOutputTokens = 32768
	recallEmailTranslationMaxSegments     = 120
	recallEmailTranslationMaxSourceBytes  = 20000
)

var (
	errRecallEmailTranslationNotConfigured = errors.New("recall email translation API key is empty")
	recallEmailTranslationLanguages        = []string{"zh", "es", "fr", "pt", "ru", "ja", "vi"}
	recallEmailProtectedPattern            = regexp.MustCompile(`https?://[^\s<>"']+|\{\{[^{}\r\n]+\}\}|\$\{[^{}\r\n]+\}`)
	recallEmailSentinelPattern             = regexp.MustCompile(`__RECALL_EMAIL_PROTECTED_[0-9a-f]{32}_[0-9]{4}__`)
	recallEmailSegmentIdentityPattern      = regexp.MustCompile(`__RECALL_EMAIL_SEGMENT_[0-9a-f]{32}_S[0-9]{4}_I[0-9]{4}__`)
)

type RecallEmailTranslator interface {
	Translate(ctx context.Context, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error)
}

type RecallEmailTranslatorOptions struct {
	APIKey   string
	BaseURL  string
	Model    string
	Client   *http.Client
	MaxBytes int64
	Timeout  time.Duration

	sleep func(context.Context, time.Duration) error
}

type recallEmailTranslationConfig struct {
	apiKey  string
	baseURL string
	model   string
}

type recallEmailTranslator struct {
	apiKey         string
	baseURL        string
	model          string
	configProvider func() recallEmailTranslationConfig
	client         *http.Client
	maxBytes       int64
	timeout        time.Duration
	sleep          func(context.Context, time.Duration) error
}

type recallEmailTranslationMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type recallEmailTranslationRequest struct {
	Model           string                          `json:"model"`
	Input           []recallEmailTranslationMessage `json:"input"`
	Text            recallEmailTranslationText      `json:"text"`
	MaxOutputTokens int                             `json:"max_output_tokens"`
}

type recallEmailTranslationText struct {
	Format recallEmailTranslationFormat `json:"format"`
}

type recallEmailTranslationFormat struct {
	Type   string         `json:"type"`
	Name   string         `json:"name"`
	Schema map[string]any `json:"schema"`
	Strict bool           `json:"strict"`
}

type recallEmailTranslationEnvelope struct {
	OutputText string `json:"output_text"`
	Output     []struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

type recallEmailTranslationResult struct {
	Stages []struct {
		StageNo      int                                      `json:"stage_no"`
		Translations map[string]recallEmailTranslatedTemplate `json:"translations"`
	} `json:"stages"`
}

type recallEmailTranslatedTemplate struct {
	Subject      string   `json:"subject"`
	BodySegments []string `json:"body_segments"`
}

type recallEmailProtectedValue struct {
	Sentinel string
	Original string
}

type recallEmailProtectedStage struct {
	StageNo        int      `json:"stage_no"`
	Subject        string   `json:"subject"`
	BodySegments   []string `json:"body_segments"`
	subjectValues  []recallEmailProtectedValue
	segmentValues  [][]recallEmailProtectedValue
	segmentMarkers []string
	htmlDocument   *recallEmailHTMLDocument
	legacyBodyText bool
}

func NewRecallEmailTranslator(options RecallEmailTranslatorOptions) RecallEmailTranslator {
	baseURL := strings.TrimSpace(options.BaseURL)
	if baseURL == "" {
		baseURL = operation_setting.GetMonitorAIAnalysisBaseURL()
	}
	modelName := strings.TrimSpace(options.Model)
	if modelName == "" {
		modelName = operation_setting.GetMonitorAIAnalysisModel()
	}
	maxBytes := options.MaxBytes
	if maxBytes <= 0 {
		maxBytes = recallEmailTranslationDefaultMaxBytes
	}
	timeout := options.Timeout
	if timeout <= 0 {
		timeout = recallEmailTranslationDefaultTimeout
	}
	sleep := options.sleep
	if sleep == nil {
		sleep = recallEmailTranslationSleep
	}
	return &recallEmailTranslator{
		apiKey:   strings.TrimSpace(options.APIKey),
		baseURL:  strings.TrimSpace(baseURL),
		model:    strings.TrimSpace(modelName),
		client:   options.Client,
		maxBytes: maxBytes,
		timeout:  timeout,
		sleep:    sleep,
	}
}

func NewRecallEmailTranslatorFromMonitorSettings(options RecallEmailTranslatorOptions) RecallEmailTranslator {
	translator := NewRecallEmailTranslator(options).(*recallEmailTranslator)
	translator.configProvider = func() recallEmailTranslationConfig {
		return recallEmailTranslationConfig{
			apiKey:  operation_setting.GetMonitorAIAnalysisAPIKey(),
			baseURL: operation_setting.GetMonitorAIAnalysisBaseURL(),
			model:   operation_setting.GetMonitorAIAnalysisModel(),
		}
	}
	return translator
}

func (t *recallEmailTranslator) Translate(ctx context.Context, stages []RecallEmailStage) (map[int]map[string]RecallEmailTemplate, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	translationConfig := t.currentConfig()
	if translationConfig.apiKey == "" {
		return nil, errRecallEmailTranslationNotConfigured
	}
	protectedStages, err := protectRecallEmailTranslationStages(stages)
	if err != nil {
		return nil, err
	}
	endpoint := recallEmailTranslationEndpoint(translationConfig.baseURL)
	fetchSetting := system_setting.GetFetchSetting()
	if err := common.ValidateURLWithFetchSetting(endpoint, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return nil, fmt.Errorf("recall email translation request rejected: %v", err)
	}
	requestBody, err := common.Marshal(buildRecallEmailTranslationRequest(translationConfig.model, protectedStages))
	if err != nil {
		return nil, err
	}

	requestCtx, cancel := context.WithTimeout(ctx, t.timeout)
	defer cancel()
	client := t.client
	if client == nil {
		client, err = requireHttpClient()
		if err != nil {
			return nil, err
		}
	}

	var raw []byte
	for attempt := 0; attempt < recallEmailTranslationMaxAttempts; attempt++ {
		raw, err = t.request(requestCtx, client, endpoint, translationConfig.apiKey, requestBody, attempt)
		if err == nil {
			break
		}
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}
		var retryable *recallEmailTranslationRetryableError
		if !errors.As(err, &retryable) || attempt == recallEmailTranslationMaxAttempts-1 {
			return nil, err
		}
		if err := t.sleep(requestCtx, retryable.delay); err != nil {
			return nil, err
		}
	}

	result, err := parseRecallEmailTranslationResponse(raw)
	if err != nil {
		return nil, err
	}
	return validateAndRestoreRecallEmailTranslations(result, protectedStages)
}

func (t *recallEmailTranslator) currentConfig() recallEmailTranslationConfig {
	if t.configProvider != nil {
		return t.configProvider()
	}
	return recallEmailTranslationConfig{apiKey: t.apiKey, baseURL: t.baseURL, model: t.model}
}

type recallEmailTranslationRetryableError struct {
	err   error
	delay time.Duration
}

func (e *recallEmailTranslationRetryableError) Error() string { return e.err.Error() }
func (e *recallEmailTranslationRetryableError) Unwrap() error { return e.err }

func (t *recallEmailTranslator) request(ctx context.Context, client *http.Client, endpoint string, apiKey string, body []byte, attempt int) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "NewAPI-Recall-Email-Translation/1.0")

	resp, err := client.Do(req)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		if isTemporaryRecallEmailTranslationNetworkError(err) {
			return nil, &recallEmailTranslationRetryableError{err: err, delay: recallEmailTranslationBackoff(attempt)}
		}
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, t.maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) > t.maxBytes {
		return nil, fmt.Errorf("recall email translation response exceeds %d bytes", t.maxBytes)
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		statusErr := fmt.Errorf("recall email translation returned status %d %s: %s", resp.StatusCode, http.StatusText(resp.StatusCode), recallEmailTranslationErrorBodySummary(raw))
		if recallEmailTranslationRetryableStatus(resp.StatusCode) {
			return nil, &recallEmailTranslationRetryableError{err: statusErr, delay: recallEmailTranslationRetryDelay(resp.Header.Get("Retry-After"), attempt)}
		}
		return nil, statusErr
	}
	return raw, nil
}

func protectRecallEmailTranslationStages(stages []RecallEmailStage) ([]recallEmailProtectedStage, error) {
	if len(stages) < 1 || len(stages) > 3 {
		return nil, fmt.Errorf("recall email translation requires one to three stages")
	}
	seen := make(map[int]struct{}, len(stages))
	originalValues := make([]string, 0, len(stages)*2)
	totalSegments := 0
	totalSourceBytes := 0
	for _, stage := range stages {
		if stage.StageNo <= 0 {
			return nil, fmt.Errorf("recall email translation stage number must be positive")
		}
		if _, exists := seen[stage.StageNo]; exists {
			return nil, fmt.Errorf("recall email translation stage %d is duplicated", stage.StageNo)
		}
		seen[stage.StageNo] = struct{}{}
		english, exists := stage.Templates["en"]
		if !exists || strings.TrimSpace(english.Subject) == "" {
			return nil, fmt.Errorf("recall email translation stage %d requires a non-empty English template", stage.StageNo)
		}
		if strings.ContainsAny(english.Subject, "\r\n") {
			return nil, fmt.Errorf("recall email translation stage %d English subject must be single-line", stage.StageNo)
		}
		if utf8.RuneCountInString(english.Subject) > recallEmailSubjectMaxRunes {
			return nil, fmt.Errorf("recall email translation stage %d English subject exceeds %d characters", stage.StageNo, recallEmailSubjectMaxRunes)
		}
		english, err := normalizeRecallEmailTemplate(stage.StageNo, "en", english)
		if err != nil {
			return nil, err
		}
		segments, _, err := recallEmailTranslationSegmentsForTemplate(english)
		if err != nil {
			return nil, err
		}
		if strings.Contains(english.Subject, "__RECALL_EMAIL_SEGMENT_") {
			return nil, fmt.Errorf("recall email translation stage %d contains reserved segment identity marker text", stage.StageNo)
		}
		for _, segment := range segments {
			if strings.Contains(segment, "__RECALL_EMAIL_SEGMENT_") {
				return nil, fmt.Errorf("recall email translation stage %d contains reserved segment identity marker text", stage.StageNo)
			}
		}
		totalSegments += len(segments)
		if totalSegments > recallEmailTranslationMaxSegments {
			return nil, fmt.Errorf("recall email translation segment count limit exceeded: %d segments; maximum %d", totalSegments, recallEmailTranslationMaxSegments)
		}
		for _, segment := range segments {
			totalSourceBytes += len([]byte(segment))
		}
		if totalSourceBytes > recallEmailTranslationMaxSourceBytes {
			return nil, fmt.Errorf("recall email translation source translatable bytes limit exceeded: %d bytes; maximum %d", totalSourceBytes, recallEmailTranslationMaxSourceBytes)
		}
		originalValues = append(originalValues, english.Subject)
		originalValues = append(originalValues, segments...)
	}
	nonce, err := newRecallEmailTranslationSentinelNonce(originalValues)
	if err != nil {
		return nil, err
	}
	protected := make([]recallEmailProtectedStage, 0, len(stages))
	counter := 0
	for _, stage := range stages {
		english, err := normalizeRecallEmailTemplate(stage.StageNo, "en", stage.Templates["en"])
		if err != nil {
			return nil, err
		}
		segments, htmlDocument, err := recallEmailTranslationSegmentsForTemplate(english)
		if err != nil {
			return nil, err
		}
		subject, subjectValues := protectRecallEmailValue(english.Subject, nonce, &counter)
		protectedSegments := make([]string, len(segments))
		segmentValues := make([][]recallEmailProtectedValue, len(segments))
		segmentMarkers := make([]string, len(segments))
		for index, segment := range segments {
			protectedSegment, values := protectRecallEmailValue(segment, nonce, &counter)
			marker := recallEmailSegmentIdentityMarker(nonce, stage.StageNo, index)
			protectedSegments[index] = marker + " " + protectedSegment
			segmentValues[index] = values
			segmentMarkers[index] = marker
		}
		protected = append(protected, recallEmailProtectedStage{
			StageNo: stage.StageNo, Subject: subject, BodySegments: protectedSegments,
			subjectValues: subjectValues, segmentValues: segmentValues, segmentMarkers: segmentMarkers,
			htmlDocument: htmlDocument, legacyBodyText: english.BodyText != "",
		})
	}
	return protected, nil
}

func recallEmailSegmentIdentityMarker(nonce string, stageNo int, segmentIndex int) string {
	return fmt.Sprintf("__RECALL_EMAIL_SEGMENT_%s_S%04d_I%04d__", nonce, stageNo, segmentIndex+1)
}

func recallEmailTranslationSegmentsForTemplate(template RecallEmailTemplate) ([]string, *recallEmailHTMLDocument, error) {
	if template.BodyHTML == "" {
		return []string{template.BodyText}, nil, nil
	}
	document, err := parseRecallEmailHTML(template.BodyHTML)
	if err != nil {
		return nil, nil, err
	}
	segments := document.TranslationSegments()
	if len(segments) == 0 {
		return nil, nil, fmt.Errorf("recall email html requires translatable text")
	}
	return segments, document, nil
}

func newRecallEmailTranslationSentinelNonce(originalValues []string) (string, error) {
	var random [16]byte
	for {
		if _, err := rand.Read(random[:]); err != nil {
			return "", fmt.Errorf("generate recall email translation protected marker: %w", err)
		}
		nonce := hex.EncodeToString(random[:])
		collides := false
		for _, value := range originalValues {
			if strings.Contains(value, nonce) {
				collides = true
				break
			}
		}
		if !collides {
			return nonce, nil
		}
	}
}

func protectRecallEmailValue(value string, nonce string, counter *int) (string, []recallEmailProtectedValue) {
	values := make([]recallEmailProtectedValue, 0)
	protected := recallEmailProtectedPattern.ReplaceAllStringFunc(value, func(match string) string {
		*counter++
		sentinel := fmt.Sprintf("__RECALL_EMAIL_PROTECTED_%s_%04d__", nonce, *counter)
		values = append(values, recallEmailProtectedValue{Sentinel: sentinel, Original: match})
		return sentinel
	})
	return protected, values
}

func buildRecallEmailTranslationRequest(modelName string, stages []recallEmailProtectedStage) recallEmailTranslationRequest {
	stagesJSON, _ := common.Marshal(stages)
	return recallEmailTranslationRequest{
		Model: modelName,
		Input: []recallEmailTranslationMessage{
			{Role: "system", Content: strings.Join([]string{
				"Translate recall marketing email templates from English into Simplified Chinese, Spanish, French, Portuguese, Russian, Japanese, and Vietnamese.",
				"Each stage contains only a subject and ordered body_segments array of visible text; no HTML, URLs, CSS, images, or markup are provided.",
				"Every body segment starts with a protected segment identity marker; keep that exact marker in the same body_segments array index.",
				"Return exactly the same number of body_segments for every language as the source stage, preserving item order and every protected marker exactly in the same order within its segment.",
				"Do not add markup, URLs, claims, or content. Subjects must be single-line. Return JSON only following the schema.",
			}, " ")},
			{Role: "user", Content: "Translate every stage and target language in this JSON:\n" + string(stagesJSON)},
		},
		Text: recallEmailTranslationText{Format: recallEmailTranslationFormat{
			Type: "json_schema", Name: "recall_email_translations", Schema: buildRecallEmailTranslationSchema(), Strict: true,
		}},
		MaxOutputTokens: recallEmailTranslationMaxOutputTokens,
	}
}

func buildRecallEmailTranslationSchema() map[string]any {
	templateSchema := map[string]any{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{
			"subject": map[string]any{"type": "string"},
			"body_segments": map[string]any{
				"type": "array", "items": map[string]any{"type": "string"}, "minItems": 1,
			},
		},
		"required": []string{"subject", "body_segments"},
	}
	translations := make(map[string]any, len(recallEmailTranslationLanguages))
	for _, language := range recallEmailTranslationLanguages {
		translations[language] = templateSchema
	}
	stageSchema := map[string]any{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{
			"stage_no": map[string]any{"type": "integer"},
			"translations": map[string]any{
				"type": "object", "additionalProperties": false,
				"properties": translations, "required": recallEmailTranslationLanguages,
			},
		},
		"required": []string{"stage_no", "translations"},
	}
	return map[string]any{
		"type": "object", "additionalProperties": false,
		"properties": map[string]any{
			"stages": map[string]any{"type": "array", "items": stageSchema},
		},
		"required": []string{"stages"},
	}
}

func parseRecallEmailTranslationResponse(raw []byte) (recallEmailTranslationResult, error) {
	var envelope recallEmailTranslationEnvelope
	if err := common.Unmarshal(raw, &envelope); err != nil {
		return recallEmailTranslationResult{}, fmt.Errorf("invalid recall email translation response: %w", err)
	}
	if envelope.Error != nil {
		return recallEmailTranslationResult{}, fmt.Errorf("recall email translation provider returned an error")
	}
	outputText := strings.TrimSpace(envelope.OutputText)
	if outputText == "" {
		for _, output := range envelope.Output {
			for _, content := range output.Content {
				if strings.TrimSpace(content.Text) != "" {
					outputText = strings.TrimSpace(content.Text)
					break
				}
			}
			if outputText != "" {
				break
			}
		}
	}
	if outputText == "" {
		return recallEmailTranslationResult{}, fmt.Errorf("recall email translation returned empty output")
	}
	outputJSON := []byte(outputText)
	if err := validateRecallEmailTranslationOutputShape(outputJSON); err != nil {
		return recallEmailTranslationResult{}, err
	}
	var result recallEmailTranslationResult
	if err := common.Unmarshal(outputJSON, &result); err != nil {
		return recallEmailTranslationResult{}, fmt.Errorf("invalid recall email translation output: %w", err)
	}
	return result, nil
}

func validateRecallEmailTranslationOutputShape(raw []byte) error {
	var root map[string]any
	if err := common.Unmarshal(raw, &root); err != nil {
		return fmt.Errorf("invalid recall email translation output: %w", err)
	}
	if !recallEmailTranslationHasExactKeys(root, []string{"stages"}) {
		return fmt.Errorf("invalid recall email translation output: root must contain only stages")
	}
	stages, ok := root["stages"].([]any)
	if !ok {
		return fmt.Errorf("invalid recall email translation output: stages must be an array")
	}
	for stageIndex, rawStage := range stages {
		stage, ok := rawStage.(map[string]any)
		if !ok {
			return fmt.Errorf("invalid recall email translation output: stage %d must be an object", stageIndex+1)
		}
		if !recallEmailTranslationHasExactKeys(stage, []string{"stage_no", "translations"}) {
			return fmt.Errorf("invalid recall email translation output: stage %d contains unexpected fields", stageIndex+1)
		}
		translations, ok := stage["translations"].(map[string]any)
		if !ok {
			return fmt.Errorf("invalid recall email translation output: stage %d translations must be an object", stageIndex+1)
		}
		if !recallEmailTranslationHasExactKeys(translations, recallEmailTranslationLanguages) {
			return fmt.Errorf("invalid recall email translation output: stage %d translations must contain exactly seven target languages", stageIndex+1)
		}
		for _, language := range recallEmailTranslationLanguages {
			template, ok := translations[language].(map[string]any)
			if !ok {
				return fmt.Errorf("invalid recall email translation output: stage %d language %s must be an object", stageIndex+1, language)
			}
			if !recallEmailTranslationHasExactKeys(template, []string{"subject", "body_segments"}) {
				return fmt.Errorf("invalid recall email translation output: stage %d language %s contains unexpected fields", stageIndex+1, language)
			}
			bodySegments, ok := template["body_segments"].([]any)
			if !ok {
				return fmt.Errorf("invalid recall email translation output: stage %d language %s body_segments must be an array", stageIndex+1, language)
			}
			if len(bodySegments) == 0 {
				return fmt.Errorf("invalid recall email translation output: stage %d language %s body_segments must not be empty", stageIndex+1, language)
			}
			for segmentIndex, segment := range bodySegments {
				if _, ok := segment.(string); !ok {
					return fmt.Errorf("invalid recall email translation output: stage %d language %s body segment %d must be a string", stageIndex+1, language, segmentIndex+1)
				}
			}
		}
	}
	return nil
}

func recallEmailTranslationHasExactKeys(object map[string]any, expected []string) bool {
	if len(object) != len(expected) {
		return false
	}
	for _, key := range expected {
		if _, exists := object[key]; !exists {
			return false
		}
	}
	return true
}

func validateAndRestoreRecallEmailTranslations(result recallEmailTranslationResult, stages []recallEmailProtectedStage) (map[int]map[string]RecallEmailTemplate, error) {
	expected := make(map[int]recallEmailProtectedStage, len(stages))
	for _, stage := range stages {
		expected[stage.StageNo] = stage
	}
	if len(result.Stages) != len(expected) {
		return nil, fmt.Errorf("recall email translation returned %d stages; expected %d", len(result.Stages), len(expected))
	}
	translated := make(map[int]map[string]RecallEmailTemplate, len(expected))
	for _, stage := range result.Stages {
		protected, exists := expected[stage.StageNo]
		if !exists {
			return nil, fmt.Errorf("recall email translation returned unexpected stage %d", stage.StageNo)
		}
		if _, duplicate := translated[stage.StageNo]; duplicate {
			return nil, fmt.Errorf("recall email translation returned duplicate stage %d", stage.StageNo)
		}
		if len(stage.Translations) != len(recallEmailTranslationLanguages) {
			return nil, fmt.Errorf("recall email translation stage %d must contain exactly seven target languages", stage.StageNo)
		}
		translations := make(map[string]RecallEmailTemplate, len(recallEmailTranslationLanguages))
		for _, language := range recallEmailTranslationLanguages {
			translated, exists := stage.Translations[language]
			if !exists {
				return nil, fmt.Errorf("recall email translation stage %d is missing language %s", stage.StageNo, language)
			}
			if strings.TrimSpace(translated.Subject) == "" || len(translated.BodySegments) == 0 {
				return nil, fmt.Errorf("recall email translation stage %d language %s contains an empty field", stage.StageNo, language)
			}
			if strings.ContainsAny(translated.Subject, "\r\n") {
				return nil, fmt.Errorf("recall email translation stage %d language %s subject must be single-line", stage.StageNo, language)
			}
			if len(translated.BodySegments) != len(protected.BodySegments) {
				return nil, fmt.Errorf(
					"invalid recall email translation output: stage %d language %s returned %d body segments; expected %d",
					stage.StageNo, language, len(translated.BodySegments), len(protected.BodySegments),
				)
			}
			subject, err := restoreRecallEmailProtectedValue(translated.Subject, protected.subjectValues)
			if err != nil {
				return nil, fmt.Errorf("recall email translation stage %d language %s subject: %w", stage.StageNo, language, err)
			}
			restoredSegments := make([]string, len(translated.BodySegments))
			for index, segment := range translated.BodySegments {
				segmentWithoutIdentity, err := restoreRecallEmailSegmentIdentity(segment, protected.segmentMarkers[index], stage.StageNo, language, index)
				if err != nil {
					return nil, err
				}
				segmentWithoutIdentity = strings.TrimSpace(segmentWithoutIdentity)
				if segmentWithoutIdentity == "" {
					return nil, fmt.Errorf("invalid recall email translation output: stage %d language %s body segment %d is empty after segment identity marker removal", stage.StageNo, language, index+1)
				}
				restored, err := restoreRecallEmailProtectedValue(segmentWithoutIdentity, protected.segmentValues[index])
				if err != nil {
					return nil, fmt.Errorf("recall email translation stage %d language %s body segment %d: %w", stage.StageNo, language, index+1, err)
				}
				restoredSegments[index] = restored
			}
			template := RecallEmailTemplate{Subject: strings.TrimSpace(subject)}
			if protected.legacyBodyText {
				template.BodyText = strings.TrimSpace(restoredSegments[0])
			} else {
				bodyHTML, err := protected.htmlDocument.Rebuild(restoredSegments)
				if err != nil {
					return nil, fmt.Errorf("recall email translation stage %d language %s body_html: %w", stage.StageNo, language, err)
				}
				template.BodyHTML = strings.TrimSpace(bodyHTML)
			}
			template, err = normalizeRecallEmailTemplate(stage.StageNo, language, template)
			if err != nil {
				return nil, err
			}
			translations[language] = template
		}
		translated[stage.StageNo] = translations
	}
	return translated, nil
}

func restoreRecallEmailSegmentIdentity(value string, expected string, stageNo int, language string, segmentIndex int) (string, error) {
	found := recallEmailSegmentIdentityPattern.FindAllString(value, -1)
	if len(found) != 1 || found[0] != expected {
		return "", fmt.Errorf("invalid recall email translation output: stage %d language %s body segment %d segment identity changed", stageNo, language, segmentIndex+1)
	}
	restored := strings.Replace(value, expected, "", 1)
	if recallEmailSegmentIdentityPattern.MatchString(restored) {
		return "", fmt.Errorf("invalid recall email translation output: stage %d language %s body segment %d segment identity changed", stageNo, language, segmentIndex+1)
	}
	return restored, nil
}

func restoreRecallEmailProtectedValue(value string, protected []recallEmailProtectedValue) (string, error) {
	found := recallEmailSentinelPattern.FindAllString(value, -1)
	if len(found) != len(protected) {
		return "", fmt.Errorf("protected marker sequence changed")
	}
	replacements := make(map[string]string, len(protected))
	for index, item := range protected {
		if found[index] != item.Sentinel {
			return "", fmt.Errorf("protected marker sequence changed")
		}
		replacements[item.Sentinel] = item.Original
	}
	return recallEmailSentinelPattern.ReplaceAllStringFunc(value, func(match string) string {
		return replacements[match]
	}), nil
}

func recallEmailTranslationEndpoint(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(baseURL, "/responses") {
		return baseURL
	}
	return baseURL + "/responses"
}

func recallEmailTranslationRetryableStatus(status int) bool {
	return status == http.StatusRequestTimeout || status == http.StatusTooManyRequests || (status >= 500 && status < 600)
}

func isTemporaryRecallEmailTranslationNetworkError(err error) bool {
	var networkError net.Error
	return errors.As(err, &networkError) && (networkError.Timeout() || networkError.Temporary())
}

func recallEmailTranslationRetryDelay(retryAfter string, attempt int) time.Duration {
	retryAfter = strings.TrimSpace(retryAfter)
	if seconds, err := strconv.Atoi(retryAfter); err == nil && seconds >= 0 {
		delay := time.Duration(seconds) * time.Second
		if delay > recallEmailTranslationMaxRetryAfter {
			return recallEmailTranslationMaxRetryAfter
		}
		return delay
	}
	if parsed, err := http.ParseTime(retryAfter); err == nil {
		delay := time.Until(parsed)
		if delay < 0 {
			return 0
		}
		if delay > recallEmailTranslationMaxRetryAfter {
			return recallEmailTranslationMaxRetryAfter
		}
		return delay
	}
	return recallEmailTranslationBackoff(attempt)
}

func recallEmailTranslationBackoff(attempt int) time.Duration {
	return time.Duration(attempt+1) * 100 * time.Millisecond
}

func recallEmailTranslationSleep(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func recallEmailTranslationErrorBodySummary(raw []byte) string {
	body := strings.TrimSpace(string(raw))
	if body == "" {
		return "empty response body"
	}
	sanitized := common.LocalLogPreview(common.MaskSensitiveInfo(body))
	return fmt.Sprintf("response body redacted (sanitized_length=%d)", len([]rune(sanitized)))
}
