package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const aiTranslationSnapshotOptionKey = "AITranslationSnapshot"

var aiTranslationSnapshotCache sync.Map

type translationRef struct {
	value string
	apply func(string)
}

type AITranslationSource struct {
	Scope   string
	Payload any
	Paths   []string
}

type AITranslationSnapshot struct {
	Version   int                          `json:"version"`
	UpdatedAt int64                        `json:"updated_at"`
	Languages map[string]map[string]string `json:"languages"`
	Stats     AITranslationSnapshotStats   `json:"stats"`
}

type AITranslationSnapshotStats struct {
	SourceTextCount int            `json:"source_text_count"`
	LanguageCounts  map[string]int `json:"language_counts"`
}

type aiTranslationConfig struct {
	Enabled        bool
	BaseURL        string
	APIKey         string
	Model          string
	TimeoutSeconds int
}

func TranslateAPIResponse(c *gin.Context, scope string, payload any, paths []string) any {
	cfg := getAITranslationConfig()
	if !cfg.Enabled {
		return payload
	}
	lang := detectAITranslationLanguage(c)
	if lang == "" || lang == "zh" {
		return payload
	}
	snapshot := getStoredAITranslationSnapshot()
	if snapshot == nil {
		return payload
	}
	translations := snapshot.Languages[lang]
	if len(translations) == 0 {
		return payload
	}
	return ApplyAITranslations(payload, paths, translations)
}

func ApplyAITranslations(payload any, paths []string, translations map[string]string) any {
	if len(translations) == 0 {
		return payload
	}
	var root any
	raw, err := common.Marshal(payload)
	if err != nil {
		return payload
	}
	if err = common.Unmarshal(raw, &root); err != nil {
		return payload
	}

	refs := collectTranslationRefsFromPaths(root, paths)
	for _, ref := range refs {
		text := strings.TrimSpace(ref.value)
		if translated, ok := translations[text]; ok && strings.TrimSpace(translated) != "" {
			ref.apply(translated)
		}
	}
	return root
}

func GenerateAITranslationSnapshot(ctx context.Context, sources []AITranslationSource) (*AITranslationSnapshot, error) {
	totalStart := time.Now()
	cfg := getAITranslationConfig()
	if cfg.APIKey == "" || cfg.Model == "" {
		return nil, fmt.Errorf("translation API key and model are required")
	}

	collectStart := time.Now()
	texts := collectUniqueTranslationTexts(sources)
	common.SysLog(fmt.Sprintf("AI translation texts collected: sources=%d, items=%d, elapsed=%s", len(sources), len(texts), time.Since(collectStart)))
	if len(texts) == 0 {
		return nil, fmt.Errorf("no translatable text found")
	}

	languages := map[string]map[string]string{
		"zh": make(map[string]string, len(texts)),
	}
	for _, text := range texts {
		languages["zh"][text] = text
	}

	targetLanguages := []string{"en", "fr", "ja", "ru", "vi"}
	existingSnapshot := getStoredAITranslationSnapshot()
	missingTexts := make([]string, 0)
	reusedCount := 0
	for _, lang := range targetLanguages {
		languages[lang] = make(map[string]string, len(texts))
	}
	for _, text := range texts {
		complete := true
		for _, lang := range targetLanguages {
			if existingSnapshot != nil {
				if existingValue := strings.TrimSpace(existingSnapshot.Languages[lang][text]); existingValue != "" {
					languages[lang][text] = existingValue
					continue
				}
			}
			complete = false
		}
		if complete {
			reusedCount++
		} else {
			missingTexts = append(missingTexts, text)
		}
	}
	common.SysLog(fmt.Sprintf("AI translation reuse checked: total=%d, reused=%d, missing=%d", len(texts), reusedCount, len(missingTexts)))

	if len(missingTexts) > 0 {
		translateCtx, cancel := context.WithTimeout(ctx, time.Duration(cfg.TimeoutSeconds)*time.Second)
		defer cancel()
		common.SysLog(fmt.Sprintf("AI translation generate started: languages=%s, items=%d", strings.Join(targetLanguages, ","), len(missingTexts)))
		start := time.Now()
		results, err := requestAITranslations(translateCtx, cfg, targetLanguages, missingTexts)
		if err != nil {
			return nil, err
		}
		common.SysLog(fmt.Sprintf("AI translation model request finished: languages=%s, items=%d, elapsed=%s", strings.Join(targetLanguages, ","), len(missingTexts), time.Since(start)))
		for _, lang := range targetLanguages {
			values := results[lang]
			if len(values) != len(missingTexts) {
				return nil, fmt.Errorf("translate %s count mismatch: got %d, want %d", lang, len(values), len(missingTexts))
			}
			for i, text := range missingTexts {
				value := strings.TrimSpace(values[i])
				if value == "" {
					value = text
				}
				languages[lang][text] = value
			}
		}
		common.SysLog(fmt.Sprintf("AI translation response normalized: languages=%s, items=%d, elapsed=%s", strings.Join(targetLanguages, ","), len(missingTexts), time.Since(start)))
	} else {
		common.SysLog("AI translation model request skipped: no changed source text")
	}

	stats := AITranslationSnapshotStats{
		SourceTextCount: len(texts),
		LanguageCounts:  make(map[string]int, len(languages)),
	}
	for lang, translations := range languages {
		stats.LanguageCounts[lang] = len(translations)
	}
	snapshot := &AITranslationSnapshot{
		Version:   1,
		UpdatedAt: time.Now().Unix(),
		Languages: languages,
		Stats:     stats,
	}
	saveStart := time.Now()
	if err := SaveAITranslationSnapshot(snapshot); err != nil {
		return nil, err
	}
	common.SysLog(fmt.Sprintf("AI translation snapshot saved: elapsed=%s, total=%s", time.Since(saveStart), time.Since(totalStart)))
	return snapshot, nil
}

func SaveAITranslationSnapshot(snapshot *AITranslationSnapshot) error {
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return err
	}
	aiTranslationSnapshotCache.Delete(aiTranslationSnapshotOptionKey)
	return model.UpdateOption(aiTranslationSnapshotOptionKey, string(raw))
}

func collectUniqueTranslationTexts(sources []AITranslationSource) []string {
	texts := make([]string, 0)
	seen := make(map[string]struct{})
	for _, source := range sources {
		var root any
		raw, err := common.Marshal(source.Payload)
		if err != nil {
			continue
		}
		if err = common.Unmarshal(raw, &root); err != nil {
			continue
		}
		for _, ref := range collectTranslationRefsFromPaths(root, source.Paths) {
			text := strings.TrimSpace(ref.value)
			if text == "" {
				continue
			}
			if _, ok := seen[text]; ok {
				continue
			}
			seen[text] = struct{}{}
			texts = append(texts, text)
		}
	}
	return texts
}

func getStoredAITranslationSnapshot() *AITranslationSnapshot {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[aiTranslationSnapshotOptionKey]
	common.OptionMapRWMutex.RUnlock()
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	if cached, ok := aiTranslationSnapshotCache.Load(raw); ok {
		return cached.(*AITranslationSnapshot)
	}
	var snapshot AITranslationSnapshot
	if err := common.UnmarshalJsonStr(raw, &snapshot); err != nil {
		common.SysLog("failed to parse AI translation snapshot: " + err.Error())
		return nil
	}
	aiTranslationSnapshotCache.Store(raw, &snapshot)
	return &snapshot
}

func getAITranslationConfig() aiTranslationConfig {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	cfg := aiTranslationConfig{
		Enabled:        parseBoolOption(common.OptionMap["AITranslationEnabled"]),
		BaseURL:        strings.TrimRight(common.OptionMap["AITranslationBaseURL"], "/"),
		APIKey:         common.OptionMap["AITranslationAPIKey"],
		Model:          common.OptionMap["AITranslationModel"],
		TimeoutSeconds: parseIntOption(common.OptionMap["AITranslationTimeoutSeconds"], 30),
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.openai.com/v1"
	}
	if cfg.TimeoutSeconds <= 0 {
		cfg.TimeoutSeconds = 30
	}
	return cfg
}

func parseBoolOption(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	return value == "true" || value == "1" || value == "yes" || value == "on"
}

func parseIntOption(value string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return n
}

func detectAITranslationLanguage(c *gin.Context) string {
	for _, header := range []string{"X-New-Api-Language", "Accept-Language"} {
		if value := c.GetHeader(header); value != "" {
			return normalizeAITranslationLanguage(value)
		}
	}
	return ""
}

func normalizeAITranslationLanguage(lang string) string {
	lang = strings.ToLower(strings.TrimSpace(strings.Split(lang, ",")[0]))
	if idx := strings.Index(lang, ";"); idx >= 0 {
		lang = strings.TrimSpace(lang[:idx])
	}
	switch {
	case strings.HasPrefix(lang, "zh"):
		return "zh"
	case strings.HasPrefix(lang, "en"):
		return "en"
	case strings.HasPrefix(lang, "fr"):
		return "fr"
	case strings.HasPrefix(lang, "ja"):
		return "ja"
	case strings.HasPrefix(lang, "ru"):
		return "ru"
	case strings.HasPrefix(lang, "vi"):
		return "vi"
	default:
		return "en"
	}
}

func collectTranslationRefsFromPaths(root any, paths []string) []translationRef {
	refs := make([]translationRef, 0)
	for _, path := range paths {
		refs = append(refs, collectTranslationRefs(root, strings.Split(path, "."))...)
	}
	return refs
}

func collectTranslationRefs(node any, parts []string) []translationRef {
	if len(parts) == 0 {
		return nil
	}
	part := parts[0]
	if len(parts) == 1 {
		return collectTranslationLeafRefs(node, part)
	}
	nextParts := parts[1:]
	refs := make([]translationRef, 0)
	switch current := node.(type) {
	case map[string]any:
		if part == "*" {
			for _, value := range current {
				refs = append(refs, collectTranslationRefs(value, nextParts)...)
			}
			return refs
		}
		if value, ok := current[part]; ok {
			return collectTranslationRefs(value, nextParts)
		}
	case []any:
		if part == "*" {
			for _, value := range current {
				refs = append(refs, collectTranslationRefs(value, nextParts)...)
			}
		}
	}
	return refs
}

func collectTranslationLeafRefs(node any, part string) []translationRef {
	refs := make([]translationRef, 0)
	switch current := node.(type) {
	case map[string]any:
		switch part {
		case "@key":
			for key := range current {
				key := key
				refs = append(refs, translationRef{
					value: key,
					apply: func(translated string) {
						if translated == "" || translated == key {
							return
						}
						if _, exists := current[translated]; exists {
							return
						}
						current[translated] = current[key]
						delete(current, key)
					},
				})
			}
		case "@value":
			for key, value := range current {
				if text, ok := value.(string); ok {
					key := key
					refs = append(refs, translationRef{
						value: text,
						apply: func(translated string) {
							if _, exists := current[key]; exists {
								current[key] = translated
							}
						},
					})
				}
			}
		default:
			if value, ok := current[part].(string); ok {
				refs = append(refs, translationRef{
					value: value,
					apply: func(translated string) {
						current[part] = translated
					},
				})
				return refs
			}
			if values, ok := current[part].([]any); ok {
				for index, value := range values {
					if text, ok := value.(string); ok {
						index := index
						refs = append(refs, translationRef{
							value: text,
							apply: func(translated string) {
								values[index] = translated
							},
						})
					}
				}
			}
		}
	case []any:
		if part == "*" {
			for index, value := range current {
				if text, ok := value.(string); ok {
					index := index
					refs = append(refs, translationRef{
						value: text,
						apply: func(translated string) {
							current[index] = translated
						},
					})
				}
			}
		}
	}
	return refs
}

func requestAITranslations(ctx context.Context, cfg aiTranslationConfig, langs []string, texts []string) (map[string][]string, error) {
	userPayload, err := common.Marshal(gin.H{
		"target_languages": langs,
		"items":            texts,
	})
	if err != nil {
		return nil, err
	}
	bodyMap := gin.H{
		"model":            cfg.Model,
		"temperature":      0,
		"stream":           false,
		"enable_thinking":  false,
		"reasoning_effort": "low",
		"thinking":         gin.H{"type": "disabled"},
		"messages": []gin.H{
			{
				"role":    "system",
				"content": "You translate UI/business text for a web application. Translate every natural-language item to every target language. Return only compact JSON in this exact schema: {\"translations\":{\"en\":[\"...\"],\"fr\":[\"...\"],\"ja\":[\"...\"],\"ru\":[\"...\"],\"vi\":[\"...\"]}}. Include exactly one array for each requested target language. Keep placeholders, URLs, API paths, model ids, numbers, currency symbols, and code-like tokens unchanged. Preserve the input order and item count in every language array. If an item is already in the target language, return it unchanged.",
			},
			{
				"role":    "user",
				"content": string(userPayload),
			},
		},
		"response_format": gin.H{"type": "json_object"},
	}
	body, err := common.Marshal(bodyMap)
	if err != nil {
		return nil, err
	}

	respBody, err := doAITranslationHTTPRequest(ctx, cfg, body)
	if err != nil {
		respBody, err = retryAITranslationHTTPRequest(ctx, cfg, bodyMap, err)
	}
	if err != nil {
		return nil, err
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err = common.Unmarshal(respBody, &chatResp); err != nil {
		return nil, err
	}
	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("empty translation response")
	}
	content := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)
	var parsed struct {
		Translations map[string][]string `json:"translations"`
	}
	if err = common.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, err
	}
	if len(parsed.Translations) == 0 {
		return nil, fmt.Errorf("empty translation map")
	}
	for _, lang := range langs {
		values := parsed.Translations[lang]
		if len(values) != len(texts) {
			return nil, fmt.Errorf("translate %s count mismatch: got %d, want %d", lang, len(values), len(texts))
		}
	}
	return parsed.Translations, nil
}

func retryAITranslationHTTPRequest(ctx context.Context, cfg aiTranslationConfig, bodyMap gin.H, originalErr error) ([]byte, error) {
	lastErr := originalErr
	for i := 0; i < 2; i++ {
		errText := strings.ToLower(lastErr.Error())
		retryable := false
		if strings.Contains(errText, "response_format") {
			delete(bodyMap, "response_format")
			retryable = true
		}
		if strings.Contains(errText, "thinking") || strings.Contains(errText, "reasoning") || strings.Contains(errText, "valid levels") {
			delete(bodyMap, "thinking")
			delete(bodyMap, "enable_thinking")
			delete(bodyMap, "reasoning_effort")
			retryable = true
		}
		if !retryable {
			return nil, lastErr
		}
		retryBody, err := common.Marshal(bodyMap)
		if err != nil {
			return nil, lastErr
		}
		respBody, err := doAITranslationHTTPRequest(ctx, cfg, retryBody)
		if err == nil {
			return respBody, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func doAITranslationHTTPRequest(ctx context.Context, cfg aiTranslationConfig, body []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	start := time.Now()
	common.SysLog(fmt.Sprintf("AI translation HTTP request started: url=%s, bytes=%d, timeout=%ds", cfg.BaseURL+"/chat/completions", len(body), cfg.TimeoutSeconds))
	client := &http.Client{Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("AI translation HTTP request failed: elapsed=%s, error=%v", time.Since(start), err))
		return nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysLog(fmt.Sprintf("AI translation HTTP response read failed: status=%d, elapsed=%s, error=%v", resp.StatusCode, time.Since(start), err))
		return nil, err
	}
	common.SysLog(fmt.Sprintf("AI translation HTTP request finished: status=%d, response_bytes=%d, elapsed=%s", resp.StatusCode, len(respBody), time.Since(start)))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(respBody))
	}
	return respBody, nil
}
