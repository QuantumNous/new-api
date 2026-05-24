package common

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/tidwall/sjson"
)

const responsesTranscriptReplayTTL = time.Hour
const responsesTranscriptPreflightSanitizeMinBytes = 900 * 1024
const responsesTranscriptPreflightSanitizeTargetBytes = responsesTranscriptPreflightSanitizeMinBytes - 64*1024
const responsesTranscriptOmittedImageText = "[image omitted from oversized transcript replay]"

const (
	openAIInvalidEncryptedContentCode  = "invalid_encrypted_content"
	openAIThinkingSignatureInvalidCode = "thinking_signature_invalid"
)

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
	LooksReplacementInput bool
	CompactionItems       int
	AssistantMessageItems int
	FunctionCallItems     int
	CustomToolCallItems   int
	ReasoningItems        int
	EncryptedContentItems int
	InlineImageItems      int
}

type responsesTranscriptRequestEnvelope struct {
	Model              string          `json:"model,omitempty"`
	PromptCacheKey     json.RawMessage `json:"prompt_cache_key,omitempty"`
	PreviousResponseID json.RawMessage `json:"previous_response_id,omitempty"`
	Input              json.RawMessage `json:"input,omitempty"`
}

type responsesTranscriptInput struct {
	Raw   string
	Items []responsesTranscriptItem
}

type responsesTranscriptItem struct {
	Type     string `json:"type,omitempty"`
	Role     string `json:"role,omitempty"`
	CallID   string `json:"call_id,omitempty"`
	ImageURL string `json:"image_url,omitempty"`

	object map[string]any
	value  any
}

func (item *responsesTranscriptItem) UnmarshalJSON(data []byte) error {
	var object map[string]any
	if err := json.Unmarshal(data, &object); err == nil && object != nil {
		item.object = object
		item.value = object
		item.Type = stringFromAny(object["type"])
		item.Role = stringFromAny(object["role"])
		item.CallID = stringFromAny(object["call_id"])
		item.ImageURL = stringFromAny(object["image_url"])
		return nil
	}

	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	item.value = value
	return nil
}

func (item responsesTranscriptItem) MarshalJSON() ([]byte, error) {
	if item.object != nil {
		return json.Marshal(item.object)
	}
	return json.Marshal(item.value)
}

func (item responsesTranscriptItem) mutableValue() any {
	if item.object != nil {
		return item.object
	}
	return item.value
}

func (item responsesTranscriptItem) typeValue() string {
	if item.object != nil {
		return stringFromAny(item.object["type"])
	}
	return strings.TrimSpace(item.Type)
}

func (item responsesTranscriptItem) roleValue() string {
	if item.object != nil {
		return stringFromAny(item.object["role"])
	}
	return strings.TrimSpace(item.Role)
}

func (item responsesTranscriptItem) callIDValue() string {
	if item.object != nil {
		return stringFromAny(item.object["call_id"])
	}
	return strings.TrimSpace(item.CallID)
}

type responsesTranscriptResponseEnvelope struct {
	Output   json.RawMessage                    `json:"output,omitempty"`
	Response responsesTranscriptResponsePayload `json:"response,omitempty"`
}

type responsesTranscriptResponsePayload struct {
	Output json.RawMessage `json:"output,omitempty"`
}

type responsesTranscriptStreamEvent struct {
	Type     string                             `json:"type,omitempty"`
	Item     json.RawMessage                    `json:"item,omitempty"`
	Response responsesTranscriptResponsePayload `json:"response,omitempty"`
}

type openAIErrorCodeResponse struct {
	Code  any             `json:"code,omitempty"`
	Error json.RawMessage `json:"error,omitempty"`
}

type openAIErrorCodeObject struct {
	Code any `json:"code,omitempty"`
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
	envelope, ok := parseResponsesTranscriptRequestEnvelope(requestBody)
	if !ok {
		info.ResponsesTranscriptReplay = nil
		return
	}
	cacheKey := responsesTranscriptReplayCacheKey(info, requestBody)
	if cacheKey == "" {
		info.ResponsesTranscriptReplay = nil
		return
	}
	baseInputRaw := ""
	if envelope.hasPreviousResponseID() && !responsesInputLooksFullTranscript(envelope.Input) {
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
	envelope, ok := parseResponsesTranscriptRequestEnvelope(requestBody)
	if !ok {
		return nil, false, "request input is not an array"
	}

	if envelope.hasPreviousResponseID() {
		return buildResponsesIncrementalTranscriptRetryRequest(requestBody, envelope.Input)
	}

	mergedInput := string(envelope.Input)
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

func SanitizeResponsesTranscriptInitialRequest(requestBody []byte) ([]byte, bool, string) {
	if len(requestBody) < responsesTranscriptPreflightSanitizeMinBytes {
		return nil, false, "request body below transcript preflight sanitize threshold"
	}
	envelope, ok := parseResponsesTranscriptRequestEnvelope(requestBody)
	if !ok {
		return nil, false, "request input is not an array"
	}
	hasPreviousResponseID := envelope.hasPreviousResponseID()
	if hasPreviousResponseID && !responsesInputLooksFullTranscript(envelope.Input) && !responsesInputLooksTranscriptReplacement(envelope.Input) {
		return nil, false, "incremental request keeps previous_response_id"
	}

	sanitizedInput, err := sanitizeResponsesTranscriptReplayInputRaw(string(envelope.Input))
	if err != nil {
		return nil, false, fmt.Sprintf("strip encrypted_content failed: %v", err)
	}

	out, err := sjson.SetRawBytes(append([]byte(nil), requestBody...), "input", []byte(sanitizedInput.InputRaw))
	if err != nil {
		return nil, false, fmt.Sprintf("set sanitized input failed: %v", err)
	}

	inputRaw := sanitizedInput.InputRaw
	strippedHistoricalImages := 0
	strippedLatestImages := 0
	trimmedItems := 0
	if len(out) > responsesTranscriptPreflightSanitizeTargetBytes {
		items, err := parseResponsesTranscriptInputItems(inputRaw)
		if err != nil {
			return nil, false, fmt.Sprintf("parse sanitized input failed: %v", err)
		}

		strippedHistoricalImages = stripResponsesInlineImageItems(items, true)
		if strippedHistoricalImages > 0 {
			out, _, err = marshalResponsesTranscriptInputIntoRequest(requestBody, items)
			if err != nil {
				return nil, false, fmt.Sprintf("set image-stripped input failed: %v", err)
			}
		}

		if len(out) > responsesTranscriptPreflightSanitizeTargetBytes {
			strippedLatestImages = stripResponsesInlineImageItems(items, false)
			if strippedLatestImages > 0 {
				out, _, err = marshalResponsesTranscriptInputIntoRequest(requestBody, items)
				if err != nil {
					return nil, false, fmt.Sprintf("set fully image-stripped input failed: %v", err)
				}
			}
		}

		if len(out) > responsesTranscriptPreflightSanitizeTargetBytes {
			var trimmed bool
			items, trimmedItems, trimmed = trimResponsesTranscriptHistoryToRequestBudget(requestBody, items, responsesTranscriptPreflightSanitizeTargetBytes)
			if trimmed {
				out, _, err = marshalResponsesTranscriptInputIntoRequest(requestBody, items)
				if err != nil {
					return nil, false, fmt.Sprintf("set trimmed input failed: %v", err)
				}
			}
		}
	}

	if !sanitizedInput.StrippedEncryptedContent &&
		!sanitizedInput.RemovedReasoningItems &&
		strippedHistoricalImages == 0 &&
		strippedLatestImages == 0 &&
		trimmedItems == 0 {
		return nil, false, "request has no oversized transcript fields to strip"
	}

	reason := "sanitized oversized full input transcript"
	if hasPreviousResponseID {
		reason = "sanitized oversized previous_response_id transcript fallback"
	}
	if sanitizedInput.StrippedEncryptedContent {
		reason += "; stripped encrypted_content"
	}
	if sanitizedInput.RemovedReasoningItems {
		reason += "; removed reasoning items"
	}
	if strippedHistoricalImages > 0 {
		reason += fmt.Sprintf("; stripped historical inline_images=%d", strippedHistoricalImages)
	}
	if strippedLatestImages > 0 {
		reason += fmt.Sprintf("; stripped latest inline_images=%d", strippedLatestImages)
	}
	if trimmedItems > 0 {
		reason += fmt.Sprintf("; trimmed history_items=%d", trimmedItems)
	}
	return out, true, reason
}

func buildResponsesIncrementalTranscriptRetryRequest(requestBody []byte, input json.RawMessage) ([]byte, bool, string) {
	sanitizedInput, err := sanitizeResponsesTranscriptReplayInputRaw(string(input))
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
	code := parseOpenAIErrorCode(body)
	return code == openAIInvalidEncryptedContentCode || code == openAIThinkingSignatureInvalidCode
}

func ResponsesTranscriptReplayRequestHasEncryptedContent(requestBody []byte) bool {
	if len(requestBody) == 0 {
		return false
	}
	envelope, ok := parseResponsesTranscriptRequestEnvelope(requestBody)
	if !ok {
		return false
	}
	_, stripped, err := stripResponsesEncryptedContentFromJSONArrayRaw(string(envelope.Input))
	return err == nil && stripped
}

func InspectResponsesTranscriptRequestShape(requestBody []byte) ResponsesTranscriptRequestShape {
	shape := ResponsesTranscriptRequestShape{
		BodyBytes: len(requestBody),
	}
	envelope, ok := parseResponsesTranscriptRequestEnvelope(requestBody)
	if !ok {
		shape.InputExists = envelope.inputExists()
		return shape
	}
	shape.HasPreviousResponseID = envelope.hasPreviousResponseID()
	shape.HasPromptCacheKey = envelope.promptCacheKey() != ""
	shape.InputExists = true
	shape.InputIsArray = true

	input, err := parseResponsesTranscriptInput(envelope.Input)
	if err != nil {
		return shape
	}
	shape.InputItems = len(input.Items)
	shape.LooksFullTranscript = responsesInputLooksFullTranscript(envelope.Input)
	shape.LooksReplacementInput = responsesInputLooksTranscriptReplacement(envelope.Input)
	for _, item := range input.Items {
		itemType := item.typeValue()
		switch itemType {
		case "compaction", "compaction_summary":
			shape.CompactionItems++
		case "function_call":
			shape.FunctionCallItems++
		case "custom_tool_call":
			shape.CustomToolCallItems++
		case "reasoning":
			shape.ReasoningItems++
		case "message":
			if item.roleValue() == "assistant" {
				shape.AssistantMessageItems++
			}
		}
		if responsesValueHasEncryptedContent(item.mutableValue()) {
			shape.EncryptedContentItems++
		}
		shape.InlineImageItems += countResponsesInlineImageItems(item.mutableValue())
	}
	return shape
}

func ObserveResponsesTranscriptReplayResponseBody(info *RelayInfo, responseBody []byte) {
	state := responsesTranscriptReplayState(info)
	if state == nil || len(responseBody) == 0 {
		return
	}
	var envelope responsesTranscriptResponseEnvelope
	if err := json.Unmarshal(responseBody, &envelope); err != nil {
		return
	}
	if isJSONArrayRaw(envelope.Output) {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(string(envelope.Output))
		return
	}
	if isJSONArrayRaw(envelope.Response.Output) {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(string(envelope.Response.Output))
	}
}

func ObserveResponsesTranscriptReplayStreamEvent(info *RelayInfo, data string) {
	state := responsesTranscriptReplayState(info)
	if state == nil || strings.TrimSpace(data) == "" {
		return
	}
	var event responsesTranscriptStreamEvent
	if err := json.Unmarshal([]byte(data), &event); err != nil {
		return
	}
	if isJSONArrayRaw(event.Response.Output) {
		state.OutputRaw = normalizeResponsesJSONArrayRaw(string(event.Response.Output))
		return
	}
	if event.Type != "response.output_item.done" {
		return
	}
	if isJSONObjectRaw(event.Item) {
		state.OutputItems = append(state.OutputItems, string(event.Item))
	}
}

func CommitResponsesTranscriptReplay(info *RelayInfo) bool {
	state := responsesTranscriptReplayState(info)
	if state == nil || state.CacheKey == "" || len(state.RequestBody) == 0 {
		return false
	}
	envelope, ok := parseResponsesTranscriptRequestEnvelope(state.RequestBody)
	if !ok {
		return false
	}
	inputRaw := string(envelope.Input)
	if !state.Replayed &&
		envelope.hasPreviousResponseID() &&
		!responsesInputLooksFullTranscript(envelope.Input) {
		baseInputRaw := state.BaseInputRaw
		if baseInputRaw == "" {
			if cachedInput, ok := getResponsesTranscriptReplayCachedInput(state.CacheKey); ok {
				baseInputRaw = cachedInput
			}
		}
		if baseInputRaw != "" {
			mergedInput, err := mergeResponsesJSONArrayRaw(baseInputRaw, inputRaw)
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
	envelope, _ := parseResponsesTranscriptRequestEnvelope(requestBody)
	sessionID := envelope.promptCacheKey()
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
	model := strings.TrimSpace(envelope.Model)
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

func parseResponsesTranscriptRequestEnvelope(body []byte) (responsesTranscriptRequestEnvelope, bool) {
	var envelope responsesTranscriptRequestEnvelope
	if len(body) == 0 {
		return envelope, false
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return envelope, false
	}
	return envelope, isJSONArrayRaw(envelope.Input)
}

func (envelope responsesTranscriptRequestEnvelope) inputExists() bool {
	return len(envelope.Input) > 0
}

func (envelope responsesTranscriptRequestEnvelope) hasPreviousResponseID() bool {
	return rawJSONHasValue(envelope.PreviousResponseID)
}

func (envelope responsesTranscriptRequestEnvelope) promptCacheKey() string {
	return stringFromRawJSON(envelope.PromptCacheKey)
}

func parseResponsesTranscriptInput(raw json.RawMessage) (responsesTranscriptInput, error) {
	normalized := normalizeResponsesJSONArrayRaw(string(raw))
	var items []responsesTranscriptItem
	if err := json.Unmarshal([]byte(normalized), &items); err != nil {
		return responsesTranscriptInput{}, err
	}
	return responsesTranscriptInput{Raw: normalized, Items: items}, nil
}

func parseResponsesTranscriptInputItems(raw string) ([]responsesTranscriptItem, error) {
	input, err := parseResponsesTranscriptInput(json.RawMessage(raw))
	if err != nil {
		return nil, err
	}
	return input.Items, nil
}

func responsesInputLooksFullTranscript(inputRaw json.RawMessage) bool {
	input, err := parseResponsesTranscriptInput(inputRaw)
	if err != nil {
		return false
	}
	for _, item := range input.Items {
		switch item.typeValue() {
		case "compaction", "compaction_summary":
			return true
		}
	}
	return false
}

func responsesInputLooksTranscriptReplacement(inputRaw json.RawMessage) bool {
	input, err := parseResponsesTranscriptInput(inputRaw)
	if err != nil {
		return false
	}
	for _, item := range input.Items {
		switch item.typeValue() {
		case "function_call", "custom_tool_call":
			return true
		case "message":
			if item.roleValue() == "assistant" {
				return true
			}
		}
	}
	return false
}

func responsesValueHasEncryptedContent(value any) bool {
	switch typed := value.(type) {
	case []any:
		for _, child := range typed {
			if responsesValueHasEncryptedContent(child) {
				return true
			}
		}
	case map[string]any:
		if _, ok := typed["encrypted_content"]; ok {
			return true
		}
		for _, child := range typed {
			if responsesValueHasEncryptedContent(child) {
				return true
			}
		}
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
	RemovedReasoningCount    int
}

func sanitizeResponsesTranscriptReplayInputRaw(raw string) (responsesTranscriptReplaySanitizedInput, error) {
	raw = normalizeResponsesJSONArrayRaw(raw)
	items, err := parseResponsesTranscriptInputItems(raw)
	if err != nil {
		return responsesTranscriptReplaySanitizedInput{}, err
	}
	stripped := stripResponsesEncryptedContentValue(items)
	items, removedReasoningCount := removeTopLevelResponsesReasoningItems(items)
	removedReasoningItems := removedReasoningCount > 0
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
		RemovedReasoningCount:    removedReasoningCount,
	}, nil
}

func removeTopLevelResponsesReasoningItems(items []responsesTranscriptItem) ([]responsesTranscriptItem, int) {
	if len(items) == 0 {
		return items, 0
	}
	removed := 0
	out := items[:0]
	for _, item := range items {
		if item.typeValue() == "reasoning" {
			removed++
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
	case []responsesTranscriptItem:
		stripped := false
		for _, item := range typed {
			if stripResponsesEncryptedContentValue(item.mutableValue()) {
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

func marshalResponsesTranscriptInputIntoRequest(requestBody []byte, items []responsesTranscriptItem) ([]byte, string, error) {
	inputJSON, err := json.Marshal(items)
	if err != nil {
		return nil, "", err
	}
	out, err := sjson.SetRawBytes(append([]byte(nil), requestBody...), "input", inputJSON)
	if err != nil {
		return nil, "", err
	}
	return out, string(inputJSON), nil
}

func stripResponsesInlineImageItems(items []responsesTranscriptItem, preserveLatestUserMessageImages bool) int {
	latestUserIndex := -1
	if preserveLatestUserMessageImages {
		for i, item := range items {
			if responsesTranscriptItemIsUserMessage(item) {
				latestUserIndex = i
			}
		}
	}

	stripped := 0
	for i, item := range items {
		if preserveLatestUserMessageImages && i == latestUserIndex {
			continue
		}
		stripped += stripResponsesInlineImageValue(item.mutableValue())
	}
	return stripped
}

func stripResponsesInlineImageValue(value any) int {
	switch typed := value.(type) {
	case []any:
		stripped := 0
		for _, item := range typed {
			stripped += stripResponsesInlineImageValue(item)
		}
		return stripped
	case map[string]any:
		if strings.TrimSpace(fmt.Sprint(typed["type"])) == "input_image" &&
			isResponsesInlineImageDataURL(fmt.Sprint(typed["image_url"])) {
			for key := range typed {
				delete(typed, key)
			}
			typed["type"] = "input_text"
			typed["text"] = responsesTranscriptOmittedImageText
			return 1
		}
		stripped := 0
		for _, item := range typed {
			stripped += stripResponsesInlineImageValue(item)
		}
		return stripped
	default:
		return 0
	}
}

func countResponsesInlineImageItems(value any) int {
	switch typed := value.(type) {
	case []any:
		count := 0
		for _, child := range typed {
			count += countResponsesInlineImageItems(child)
		}
		return count
	case map[string]any:
		if stringFromAny(typed["type"]) == "input_image" &&
			isResponsesInlineImageDataURL(stringFromAny(typed["image_url"])) {
			return 1
		}
		count := 0
		for _, child := range typed {
			count += countResponsesInlineImageItems(child)
		}
		return count
	default:
		return 0
	}
}

func isResponsesInlineImageDataURL(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	lower := strings.ToLower(value)
	if !strings.HasPrefix(lower, "data:image/") {
		return false
	}
	comma := strings.IndexByte(lower, ',')
	if comma < 0 {
		return false
	}
	return strings.Contains(lower[:comma], ";base64")
}

func trimResponsesTranscriptHistoryToRequestBudget(requestBody []byte, items []responsesTranscriptItem, targetBytes int) ([]responsesTranscriptItem, int, bool) {
	if len(items) == 0 {
		return items, 0, false
	}
	if body, _, err := marshalResponsesTranscriptInputIntoRequest(requestBody, items); err != nil || len(body) <= targetBytes {
		return items, 0, false
	}

	trimmed := 0
	for len(items) > 1 {
		removeIndex := oldestResponsesTranscriptTrimCandidate(items)
		if removeIndex < 0 {
			break
		}
		before := len(items)
		items = removeResponsesTranscriptItemWithCounterpart(items, removeIndex)
		trimmed += before - len(items)

		body, _, err := marshalResponsesTranscriptInputIntoRequest(requestBody, items)
		if err != nil {
			break
		}
		if len(body) <= targetBytes {
			return items, trimmed, true
		}
	}
	return items, trimmed, trimmed > 0
}

func oldestResponsesTranscriptTrimCandidate(items []responsesTranscriptItem) int {
	latestUserIndex := -1
	for i, item := range items {
		if responsesTranscriptItemIsUserMessage(item) {
			latestUserIndex = i
		}
	}
	if latestUserIndex < 0 {
		latestUserIndex = len(items) - 1
	}
	for i := 0; i < latestUserIndex; i++ {
		if responsesTranscriptItemIsTrimProtected(items[i]) {
			continue
		}
		return i
	}
	return -1
}

func responsesTranscriptItemIsUserMessage(item responsesTranscriptItem) bool {
	return item.typeValue() == "message" && item.roleValue() == "user"
}

func responsesTranscriptItemIsTrimProtected(item responsesTranscriptItem) bool {
	itemType := item.typeValue()
	if itemType == "compaction" || itemType == "compaction_summary" {
		return true
	}
	return itemType == "message" && item.roleValue() == "developer"
}

func removeResponsesTranscriptItemWithCounterpart(items []responsesTranscriptItem, index int) []responsesTranscriptItem {
	if index < 0 || index >= len(items) {
		return items
	}
	if responsesTranscriptItemIsUserMessage(items[index]) {
		remove := map[int]struct{}{}
		for i := index; i < len(items); i++ {
			if i > index && responsesTranscriptItemIsUserMessage(items[i]) {
				break
			}
			remove[i] = struct{}{}
		}
		out := items[:0]
		for i, item := range items {
			if _, ok := remove[i]; ok {
				continue
			}
			out = append(out, item)
		}
		return out
	}
	callID := responsesTranscriptItemCallID(items[index])
	itemType := responsesTranscriptItemType(items[index])
	remove := map[int]struct{}{index: {}}
	if callID != "" && responsesTranscriptItemHasCallCounterpart(itemType) {
		for i, item := range items {
			if i == index {
				continue
			}
			if responsesTranscriptItemCallID(item) == callID && responsesTranscriptItemHasCallCounterpart(responsesTranscriptItemType(item)) {
				remove[i] = struct{}{}
			}
		}
	}

	out := items[:0]
	for i, item := range items {
		if _, ok := remove[i]; ok {
			continue
		}
		out = append(out, item)
	}
	return out
}

func responsesTranscriptItemType(item responsesTranscriptItem) string {
	return item.typeValue()
}

func responsesTranscriptItemCallID(item responsesTranscriptItem) string {
	return item.callIDValue()
}

func responsesTranscriptItemHasCallCounterpart(itemType string) bool {
	switch itemType {
	case "function_call", "function_call_output", "custom_tool_call", "custom_tool_call_output":
		return true
	default:
		return false
	}
}

func parseOpenAIErrorCode(body []byte) string {
	var response openAIErrorCodeResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return ""
	}
	if rawJSONHasValue(response.Error) && isJSONObjectRaw(response.Error) {
		var nested openAIErrorCodeObject
		if err := json.Unmarshal(response.Error, &nested); err == nil {
			if code := errorCodeString(nested.Code); code != "" {
				return code
			}
		}
	}
	return errorCodeString(response.Code)
}

func errorCodeString(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.ToLower(strings.TrimSpace(typed))
	case json.RawMessage:
		return strings.ToLower(strings.TrimSpace(stringFromRawJSON(typed)))
	case nil:
		return ""
	default:
		return strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
	}
}

func rawJSONHasValue(raw json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(raw))
	return trimmed != "" && trimmed != "null"
}

func stringFromRawJSON(raw json.RawMessage) string {
	if !rawJSONHasValue(raw) {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err == nil {
		return strings.TrimSpace(value)
	}
	return strings.TrimSpace(string(raw))
}

func stringFromAny(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case json.RawMessage:
		return stringFromRawJSON(typed)
	case nil:
		return ""
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func isJSONArrayRaw(raw json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(raw))
	return strings.HasPrefix(trimmed, "[")
}

func isJSONObjectRaw(raw json.RawMessage) bool {
	trimmed := strings.TrimSpace(string(raw))
	return strings.HasPrefix(trimmed, "{")
}
