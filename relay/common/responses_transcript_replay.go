package common

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const responsesTranscriptReplayTTL = time.Hour

type ResponsesTranscriptReplayState struct {
	CacheKey     string
	RequestBody  []byte
	BaseInputRaw string
	OutputRaw    string
	OutputItems  []string
	Replayed     bool
}

type ResponsesTranscriptRequestShape struct {
	BodyBytes             int
	HasPreviousResponseID bool
	HasPromptCacheKey     bool
	InputExists           bool
	InputIsArray          bool
	InputItems            int
	LooksFullTranscript   bool
	CompactionItems       int
	AssistantMessageItems int
	FunctionCallItems     int
	CustomToolCallItems   int
	ReasoningItems        int
	EncryptedContentItems int
}

type responsesTranscriptReplayCacheEntry struct {
	InputRaw string
	Expire   time.Time
}

var (
	responsesTranscriptReplayMu    sync.RWMutex
	responsesTranscriptReplayCache = map[string]responsesTranscriptReplayCacheEntry{}
)

func PrepareResponsesTranscriptReplay(info *RelayInfo, requestBody []byte) {
	if info == nil || len(requestBody) == 0 {
		return
	}
	cacheKey := responsesTranscriptReplayCacheKey(info, requestBody)
	if cacheKey == "" {
		info.ResponsesTranscriptReplay = nil
		return
	}
	baseInputRaw := ""
	if input := gjson.GetBytes(requestBody, "input"); input.Exists() && input.IsArray() &&
		gjson.GetBytes(requestBody, "previous_response_id").Exists() &&
		!responsesInputLooksFullTranscript(input) {
		if cachedInput, ok := getResponsesTranscriptReplayCachedInput(cacheKey); ok {
			baseInputRaw = cachedInput
		}
	}
	info.ResponsesTranscriptReplay = &ResponsesTranscriptReplayState{
		CacheKey:     cacheKey,
		RequestBody:  append([]byte(nil), requestBody...),
		BaseInputRaw: baseInputRaw,
	}
}

func UpdateResponsesTranscriptReplayRequest(info *RelayInfo, requestBody []byte, replayed bool) {
	if info == nil || len(requestBody) == 0 {
		return
	}
	if info.ResponsesTranscriptReplay == nil {
		PrepareResponsesTranscriptReplay(info, requestBody)
		if info.ResponsesTranscriptReplay == nil {
			return
		}
	}
	info.ResponsesTranscriptReplay.RequestBody = append([]byte(nil), requestBody...)
	info.ResponsesTranscriptReplay.BaseInputRaw = ""
	info.ResponsesTranscriptReplay.OutputRaw = ""
	info.ResponsesTranscriptReplay.OutputItems = nil
	info.ResponsesTranscriptReplay.Replayed = replayed
}

func BuildResponsesTranscriptReplayRequest(info *RelayInfo, requestBody []byte) ([]byte, bool, string) {
	if info == nil || len(requestBody) == 0 {
		return nil, false, "missing request body"
	}
	hasPreviousResponseID := gjson.GetBytes(requestBody, "previous_response_id").Exists()
	input := gjson.GetBytes(requestBody, "input")
	if !input.Exists() || !input.IsArray() {
		return nil, false, "request input is not an array"
	}

	if hasPreviousResponseID {
		return buildResponsesIncrementalTranscriptRetryRequest(requestBody, input)
	}

	mergedInput := input.Raw
	reason := "using full input transcript"

	sanitizedInput, err := sanitizeResponsesTranscriptReplayInputRaw(mergedInput)
	if err != nil {
		return nil, false, fmt.Sprintf("strip encrypted_content failed: %v", err)
	}
	if sanitizedInput.StrippedEncryptedContent || sanitizedInput.RemovedReasoningItems {
		mergedInput = sanitizedInput.InputRaw
	}
	if sanitizedInput.StrippedEncryptedContent {
		reason += "; stripped encrypted_content"
	}
	if sanitizedInput.RemovedReasoningItems {
		reason += "; removed reasoning items"
	}
	if !sanitizedInput.StrippedEncryptedContent && !sanitizedInput.RemovedReasoningItems {
		return nil, false, "request has no encrypted_content or reasoning items to strip"
	}

	out, err := sjson.DeleteBytes(append([]byte(nil), requestBody...), "previous_response_id")
	if err != nil {
		out = append([]byte(nil), requestBody...)
	}
	out, err = sjson.SetRawBytes(out, "input", []byte(mergedInput))
	if err != nil {
		return nil, false, fmt.Sprintf("set replay input failed: %v", err)
	}
	return out, true, reason
}

func buildResponsesIncrementalTranscriptRetryRequest(requestBody []byte, input gjson.Result) ([]byte, bool, string) {
	sanitizedInput, err := sanitizeResponsesTranscriptReplayInputRaw(input.Raw)
	if err != nil {
		return nil, false, fmt.Sprintf("strip encrypted_content failed: %v", err)
	}
	if !sanitizedInput.StrippedEncryptedContent && !sanitizedInput.RemovedReasoningItems {
		return nil, false, "incremental request has no encrypted_content or reasoning items to strip"
	}

	out, err := sjson.SetRawBytes(append([]byte(nil), requestBody...), "input", []byte(sanitizedInput.InputRaw))
	if err != nil {
		return nil, false, fmt.Sprintf("set retry input failed: %v", err)
	}

	reason := "using incremental previous_response_id"
	if sanitizedInput.StrippedEncryptedContent {
		reason += "; stripped encrypted_content"
	}
	if sanitizedInput.RemovedReasoningItems {
		reason += "; removed reasoning items"
	}
	return out, true, reason
}

func IsResponsesTranscriptReplayError(statusCode int, body []byte) bool {
	if statusCode < 400 || len(body) == 0 {
		return false
	}
	lower := strings.ToLower(strings.TrimSpace(string(body)))
	code := strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "error.code").String()))
	message := strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "error.message").String()))
	if message == "" {
		message = strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "message").String()))
	}
	return strings.Contains(lower, "invalid_encrypted_content") ||
		strings.Contains(lower, "invalid signature in thinking block") ||
		strings.Contains(lower, "encrypted_content") && (strings.Contains(lower, "invalid") || strings.Contains(lower, "decrypt") || strings.Contains(lower, "signature")) ||
		code == "invalid_encrypted_content" ||
		strings.Contains(message, "encrypted_content") && (strings.Contains(message, "invalid") || strings.Contains(message, "decrypt") || strings.Contains(message, "signature"))
}

func ResponsesTranscriptReplayRequestHasEncryptedContent(requestBody []byte) bool {
	if len(requestBody) == 0 {
		return false
	}
	input := gjson.GetBytes(requestBody, "input")
	if !input.Exists() || !input.IsArray() {
		return false
	}
	_, stripped, err := stripResponsesEncryptedContentFromJSONArrayRaw(input.Raw)
	return err == nil && stripped
}

func InspectResponsesTranscriptRequestShape(requestBody []byte) ResponsesTranscriptRequestShape {
	shape := ResponsesTranscriptRequestShape{
		BodyBytes:             len(requestBody),
		HasPreviousResponseID: gjson.GetBytes(requestBody, "previous_response_id").Exists(),
		HasPromptCacheKey:     strings.TrimSpace(gjson.GetBytes(requestBody, "prompt_cache_key").String()) != "",
	}
	input := gjson.GetBytes(requestBody, "input")
	shape.InputExists = input.Exists()
	shape.InputIsArray = input.IsArray()
	if !input.IsArray() {
		return shape
	}

	items := input.Array()
	shape.InputItems = len(items)
	shape.LooksFullTranscript = responsesInputLooksFullTranscript(input)
	for _, item := range items {
		switch strings.TrimSpace(item.Get("type").String()) {
		case "compaction", "compaction_summary":
			shape.CompactionItems++
		case "function_call":
			shape.FunctionCallItems++
		case "custom_tool_call":
			shape.CustomToolCallItems++
		case "reasoning":
			shape.ReasoningItems++
		case "message":
			if strings.TrimSpace(item.Get("role").String()) == "assistant" {
				shape.AssistantMessageItems++
			}
		}
		if responsesItemHasEncryptedContent(item) {
			shape.EncryptedContentItems++
		}
	}
	return shape
}

func ObserveResponsesTranscriptReplayResponseBody(info *RelayInfo, responseBody []byte) {
	state := responsesTranscriptReplayState(info)
	if state == nil || len(responseBody) == 0 {
		return
	}
	if output := gjson.GetBytes(responseBody, "output"); output.Exists() && output.IsArray() {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(output.Raw)
		return
	}
	if output := gjson.GetBytes(responseBody, "response.output"); output.Exists() && output.IsArray() {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(output.Raw)
	}
}

func ObserveResponsesTranscriptReplayStreamEvent(info *RelayInfo, data string) {
	state := responsesTranscriptReplayState(info)
	if state == nil || strings.TrimSpace(data) == "" {
		return
	}
	event := gjson.Parse(data)
	if output := event.Get("response.output"); output.Exists() && output.IsArray() {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(output.Raw)
		return
	}
	if event.Get("type").String() != "response.output_item.done" {
		return
	}
	item := event.Get("item")
	if item.Exists() && item.IsObject() {
		state.OutputItems = append(state.OutputItems, item.Raw)
	}
}

func CommitResponsesTranscriptReplay(info *RelayInfo) bool {
	state := responsesTranscriptReplayState(info)
	if state == nil || state.CacheKey == "" || len(state.RequestBody) == 0 {
		return false
	}
	input := gjson.GetBytes(state.RequestBody, "input")
	if !input.Exists() || !input.IsArray() {
		return false
	}
	inputRaw := input.Raw
	if !state.Replayed &&
		gjson.GetBytes(state.RequestBody, "previous_response_id").Exists() &&
		!responsesInputLooksFullTranscript(input) {
		baseInputRaw := state.BaseInputRaw
		if baseInputRaw == "" {
			if cachedInput, ok := getResponsesTranscriptReplayCachedInput(state.CacheKey); ok {
				baseInputRaw = cachedInput
			}
		}
		if baseInputRaw != "" {
			mergedInput, err := mergeResponsesJSONArrayRaw(baseInputRaw, input.Raw)
			if err == nil {
				inputRaw = mergedInput
			}
		}
	}
	outputRaw := state.OutputRaw
	if outputRaw == "" && len(state.OutputItems) > 0 {
		outputRaw = "[" + strings.Join(state.OutputItems, ",") + "]"
	}
	if outputRaw == "" {
		outputRaw = "[]"
	}
	merged, err := mergeResponsesJSONArrayRaw(inputRaw, outputRaw)
	if err != nil {
		return false
	}
	if sanitized, err := sanitizeResponsesTranscriptReplayInputRaw(merged); err == nil {
		merged = sanitized.InputRaw
	}
	setResponsesTranscriptReplayCachedInput(state.CacheKey, merged)
	return true
}

func responsesTranscriptReplayState(info *RelayInfo) *ResponsesTranscriptReplayState {
	if info == nil {
		return nil
	}
	return info.ResponsesTranscriptReplay
}

func responsesTranscriptReplayCacheKey(info *RelayInfo, requestBody []byte) string {
	sessionID := strings.TrimSpace(gjson.GetBytes(requestBody, "prompt_cache_key").String())
	if sessionID == "" {
		for _, name := range []string{"Session_id", "session_id", "X-Session-ID", "x-session-id", "Conversation_id", "conversation_id"} {
			if v := requestHeaderValueCaseInsensitive(info.RequestHeaders, name); v != "" {
				sessionID = v
				break
			}
		}
	}
	if sessionID == "" {
		return ""
	}
	model := strings.TrimSpace(gjson.GetBytes(requestBody, "model").String())
	if model == "" {
		model = strings.TrimSpace(info.UpstreamModelName)
	}
	return fmt.Sprintf("channel:%d:model:%s:session:%s", info.ChannelId, model, sessionID)
}

func requestHeaderValueCaseInsensitive(headers map[string]string, name string) string {
	if len(headers) == 0 || strings.TrimSpace(name) == "" {
		return ""
	}
	if v := strings.TrimSpace(headers[name]); v != "" {
		return v
	}
	for key, value := range headers {
		if strings.EqualFold(key, name) {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func responsesInputLooksFullTranscript(input gjson.Result) bool {
	if !input.IsArray() {
		return false
	}
	for _, item := range input.Array() {
		switch strings.TrimSpace(item.Get("type").String()) {
		case "compaction", "compaction_summary":
			return true
		}
	}
	return false
}

func responsesItemHasEncryptedContent(item gjson.Result) bool {
	if !item.Exists() {
		return false
	}
	if item.IsArray() {
		for _, child := range item.Array() {
			if responsesItemHasEncryptedContent(child) {
				return true
			}
		}
		return false
	}
	if item.IsObject() {
		if item.Get("encrypted_content").Exists() {
			return true
		}
		found := false
		item.ForEach(func(_, child gjson.Result) bool {
			if responsesItemHasEncryptedContent(child) {
				found = true
				return false
			}
			return true
		})
		return found
	}
	return false
}

func getResponsesTranscriptReplayCachedInput(cacheKey string) (string, bool) {
	now := time.Now()
	responsesTranscriptReplayMu.RLock()
	entry, ok := responsesTranscriptReplayCache[cacheKey]
	responsesTranscriptReplayMu.RUnlock()
	if !ok || entry.Expire.Before(now) {
		if ok {
			responsesTranscriptReplayMu.Lock()
			delete(responsesTranscriptReplayCache, cacheKey)
			responsesTranscriptReplayMu.Unlock()
		}
		return "", false
	}
	return entry.InputRaw, true
}

func setResponsesTranscriptReplayCachedInput(cacheKey string, inputRaw string) {
	if strings.TrimSpace(cacheKey) == "" || strings.TrimSpace(inputRaw) == "" {
		return
	}
	responsesTranscriptReplayMu.Lock()
	responsesTranscriptReplayCache[cacheKey] = responsesTranscriptReplayCacheEntry{
		InputRaw: normalizeResponsesJSONArrayRaw(inputRaw),
		Expire:   time.Now().Add(responsesTranscriptReplayTTL),
	}
	responsesTranscriptReplayMu.Unlock()
}

func mergeResponsesJSONArrayRaw(existingRaw string, appendRaw string) (string, error) {
	existingRaw = normalizeResponsesJSONArrayRaw(existingRaw)
	appendRaw = normalizeResponsesJSONArrayRaw(appendRaw)

	var existing []json.RawMessage
	if err := json.Unmarshal([]byte(existingRaw), &existing); err != nil {
		return "", err
	}
	var appendItems []json.RawMessage
	if err := json.Unmarshal([]byte(appendRaw), &appendItems); err != nil {
		return "", err
	}
	merged := append(existing, appendItems...)
	out, err := json.Marshal(merged)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func normalizeResponsesJSONArrayRaw(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "[]"
	}
	if strings.HasPrefix(trimmed, "[") {
		return trimmed
	}
	return "[]"
}

func stripResponsesEncryptedContentFromJSONArrayRaw(raw string) (string, bool, error) {
	sanitized, err := sanitizeResponsesTranscriptReplayInputRaw(raw)
	if err != nil {
		return "", false, err
	}
	return sanitized.InputRaw, sanitized.StrippedEncryptedContent, nil
}

type responsesTranscriptReplaySanitizedInput struct {
	InputRaw                 string
	StrippedEncryptedContent bool
	RemovedReasoningItems    bool
}

func sanitizeResponsesTranscriptReplayInputRaw(raw string) (responsesTranscriptReplaySanitizedInput, error) {
	raw = normalizeResponsesJSONArrayRaw(raw)
	var items []any
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return responsesTranscriptReplaySanitizedInput{}, err
	}
	stripped := stripResponsesEncryptedContentValue(items)
	items, removedReasoningItems := removeTopLevelResponsesReasoningItems(items)
	if !stripped && !removedReasoningItems {
		return responsesTranscriptReplaySanitizedInput{InputRaw: raw}, nil
	}
	out, err := json.Marshal(items)
	if err != nil {
		return responsesTranscriptReplaySanitizedInput{}, err
	}
	return responsesTranscriptReplaySanitizedInput{
		InputRaw:                 string(out),
		StrippedEncryptedContent: stripped,
		RemovedReasoningItems:    removedReasoningItems,
	}, nil
}

func removeTopLevelResponsesReasoningItems(items []any) ([]any, bool) {
	if len(items) == 0 {
		return items, false
	}
	removed := false
	out := items[:0]
	for _, item := range items {
		typed, ok := item.(map[string]any)
		if ok && strings.TrimSpace(fmt.Sprint(typed["type"])) == "reasoning" {
			removed = true
			continue
		}
		out = append(out, item)
	}
	return out, removed
}

func stripResponsesEncryptedContentValue(value any) bool {
	switch typed := value.(type) {
	case []any:
		stripped := false
		for _, item := range typed {
			if stripResponsesEncryptedContentValue(item) {
				stripped = true
			}
		}
		return stripped
	case map[string]any:
		stripped := false
		if _, ok := typed["encrypted_content"]; ok {
			delete(typed, "encrypted_content")
			stripped = true
		}
		for _, item := range typed {
			if stripResponsesEncryptedContentValue(item) {
				stripped = true
			}
		}
		return stripped
	default:
		return false
	}
}
