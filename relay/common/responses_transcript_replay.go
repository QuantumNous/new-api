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
const responsesTranscriptPreflightSanitizeMinBytes = 900 * 1024
const responsesTranscriptPreflightSanitizeTargetBytes = responsesTranscriptPreflightSanitizeMinBytes - 64*1024
const responsesTranscriptOmittedImageText = "[image omitted from oversized transcript replay]"

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

func SanitizeResponsesTranscriptInitialRequest(requestBody []byte) ([]byte, bool, string) {
	if len(requestBody) < responsesTranscriptPreflightSanitizeMinBytes {
		return nil, false, "request body below transcript preflight sanitize threshold"
	}
	hasPreviousResponseID := gjson.GetBytes(requestBody, "previous_response_id").Exists()
	input := gjson.GetBytes(requestBody, "input")
	if hasPreviousResponseID && !responsesInputLooksFullTranscript(input) && !responsesInputLooksTranscriptReplacement(input) {
		return nil, false, "incremental request keeps previous_response_id"
	}
	if !input.Exists() || !input.IsArray() {
		return nil, false, "request input is not an array"
	}

	sanitizedInput, err := sanitizeResponsesTranscriptReplayInputRaw(input.Raw)
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
		var items []any
		if err := json.Unmarshal([]byte(inputRaw), &items); err != nil {
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
	code := strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "error.code").String()))
	if code == "" {
		code = strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "code").String()))
	}
	return code == "invalid_encrypted_content" || code == "thinking_signature_invalid"
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
	shape.LooksReplacementInput = responsesInputLooksTranscriptReplacement(input)
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
		shape.InlineImageItems += countResponsesInlineImageItems(item)
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

func responsesInputLooksTranscriptReplacement(input gjson.Result) bool {
	if !input.IsArray() {
		return false
	}
	for _, item := range input.Array() {
		switch strings.TrimSpace(item.Get("type").String()) {
		case "function_call", "custom_tool_call":
			return true
		case "message":
			if strings.TrimSpace(item.Get("role").String()) == "assistant" {
				return true
			}
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
	RemovedReasoningCount    int
}

func sanitizeResponsesTranscriptReplayInputRaw(raw string) (responsesTranscriptReplaySanitizedInput, error) {
	raw = normalizeResponsesJSONArrayRaw(raw)
	var items []any
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
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

func removeTopLevelResponsesReasoningItems(items []any) ([]any, int) {
	if len(items) == 0 {
		return items, 0
	}
	removed := 0
	out := items[:0]
	for _, item := range items {
		typed, ok := item.(map[string]any)
		if ok && strings.TrimSpace(fmt.Sprint(typed["type"])) == "reasoning" {
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

func marshalResponsesTranscriptInputIntoRequest(requestBody []byte, items []any) ([]byte, string, error) {
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

func stripResponsesInlineImageItems(items []any, preserveLatestUserMessageImages bool) int {
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
		stripped += stripResponsesInlineImageValue(item)
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

func countResponsesInlineImageItems(item gjson.Result) int {
	if !item.Exists() {
		return 0
	}
	if item.IsArray() {
		count := 0
		for _, child := range item.Array() {
			count += countResponsesInlineImageItems(child)
		}
		return count
	}
	if item.IsObject() {
		if strings.TrimSpace(item.Get("type").String()) == "input_image" &&
			isResponsesInlineImageDataURL(item.Get("image_url").String()) {
			return 1
		}
		count := 0
		item.ForEach(func(_, child gjson.Result) bool {
			count += countResponsesInlineImageItems(child)
			return true
		})
		return count
	}
	return 0
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

func trimResponsesTranscriptHistoryToRequestBudget(requestBody []byte, items []any, targetBytes int) ([]any, int, bool) {
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

func oldestResponsesTranscriptTrimCandidate(items []any) int {
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

func responsesTranscriptItemIsUserMessage(item any) bool {
	typed, ok := item.(map[string]any)
	if !ok {
		return false
	}
	return strings.TrimSpace(fmt.Sprint(typed["type"])) == "message" &&
		strings.TrimSpace(fmt.Sprint(typed["role"])) == "user"
}

func responsesTranscriptItemIsTrimProtected(item any) bool {
	typed, ok := item.(map[string]any)
	if !ok {
		return false
	}
	itemType := strings.TrimSpace(fmt.Sprint(typed["type"]))
	if itemType == "compaction" || itemType == "compaction_summary" {
		return true
	}
	return itemType == "message" && strings.TrimSpace(fmt.Sprint(typed["role"])) == "developer"
}

func removeResponsesTranscriptItemWithCounterpart(items []any, index int) []any {
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

func responsesTranscriptItemType(item any) string {
	typed, ok := item.(map[string]any)
	if !ok {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(typed["type"]))
}

func responsesTranscriptItemCallID(item any) string {
	typed, ok := item.(map[string]any)
	if !ok {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(typed["call_id"]))
}

func responsesTranscriptItemHasCallCounterpart(itemType string) bool {
	switch itemType {
	case "function_call", "function_call_output", "custom_tool_call", "custom_tool_call_output":
		return true
	default:
		return false
	}
}
