package oairesponses

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	relaymedia "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/media"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

const (
	responsesInputTypeFunctionCall       = "function_call"
	responsesInputTypeFunctionCallOutput = "function_call_output"
	responsesInputTypeCustomToolCall     = "custom_tool_call"
	responsesInputTypeCustomToolOutput   = "custom_tool_call_output"
)

const (
	ResponsesInputTypeFunctionCall       = responsesInputTypeFunctionCall
	ResponsesInputTypeFunctionCallOutput = responsesInputTypeFunctionCallOutput
	ResponsesInputTypeCustomToolCall     = responsesInputTypeCustomToolCall
	ResponsesInputTypeCustomToolOutput   = responsesInputTypeCustomToolOutput
)

func ResponsesRequestToChatCompletionsRequest(ctx context.Context, req *dto.OpenAIResponsesRequest) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, errors.New("request is nil")
	}
	if req.Model == "" {
		return nil, errors.New("model is required")
	}
	if err := validateResponsesRequestChatUnsupportedFields(req); err != nil {
		return nil, err
	}

	messages, err := responsesRequestMessagesToChat(ctx, req)
	if err != nil {
		return nil, err
	}

	tools, err := responsesRequestToolsToChat(req.Tools)
	if err != nil {
		return nil, err
	}

	toolChoice, err := responsesRequestToolChoiceToChat(req.ToolChoice)
	if err != nil {
		return nil, err
	}

	responseFormat, err := responsesRequestTextToChatResponseFormat(req.Text)
	if err != nil {
		return nil, err
	}

	out := &dto.GeneralOpenAIRequest{
		Model:                req.Model,
		Messages:             messages,
		Stream:               req.Stream,
		StreamOptions:        req.StreamOptions,
		MaxCompletionTokens:  req.MaxOutputTokens,
		Temperature:          req.Temperature,
		TopP:                 req.TopP,
		TopLogProbs:          req.TopLogProbs,
		ResponseFormat:       responseFormat,
		Tools:                tools,
		ToolChoice:           toolChoice,
		User:                 req.User,
		Store:                req.Store,
		Metadata:             req.Metadata,
		SafetyIdentifier:     req.SafetyIdentifier,
		PromptCacheRetention: req.PromptCacheRetention,
		EnableThinking:       req.EnableThinking,
		ThinkingBudget:       req.ThinkingBudget,
	}

	out.FrequencyPenalty, err = responsesRawFloat(req.FrequencyPenalty)
	if err != nil {
		return nil, fmt.Errorf("invalid frequency_penalty: %w", err)
	}
	out.PresencePenalty, err = responsesRawFloat(req.PresencePenalty)
	if err != nil {
		return nil, fmt.Errorf("invalid presence_penalty: %w", err)
	}

	reasoningIntent, diagnostics, err := reasoning.FromOpenAIResponses(req)
	if err != nil {
		return nil, reasoning.AsClientError(err)
	}
	convdiag.Add(ctx, diagnostics...)
	if err := reasoning.ApplyToOpenAIChat(out, reasoningIntent); err != nil {
		return nil, reasoning.AsClientError(err)
	}
	if req.ServiceTier != "" {
		out.ServiceTier, _ = kitutil.Marshal(req.ServiceTier)
	}
	if len(req.ParallelToolCalls) > 0 && kitutil.GetJsonType(req.ParallelToolCalls) == "boolean" {
		var parallelToolCalls bool
		if err := kitutil.Unmarshal(req.ParallelToolCalls, &parallelToolCalls); err == nil {
			out.ParallelTooCalls = &parallelToolCalls
		}
	}
	if len(req.PromptCacheKey) > 0 && kitutil.GetJsonType(req.PromptCacheKey) == "string" {
		var promptCacheKey string
		if err := kitutil.Unmarshal(req.PromptCacheKey, &promptCacheKey); err == nil {
			out.PromptCacheKey = promptCacheKey
		}
	}

	return out, nil
}

func validateResponsesRequestChatUnsupportedFields(req *dto.OpenAIResponsesRequest) error {
	unsupported := make([]string, 0, 4)
	if rawJSONPresent(req.Conversation) {
		unsupported = append(unsupported, "conversation")
	}
	if strings.TrimSpace(req.PreviousResponseID) != "" {
		unsupported = append(unsupported, "previous_response_id")
	}
	if rawJSONPresent(req.Prompt) {
		unsupported = append(unsupported, "prompt")
	}
	if rawJSONPresent(req.ContextManagement) {
		unsupported = append(unsupported, "context_management")
	}
	if len(unsupported) > 0 {
		return fmt.Errorf("responses to chat conversion does not support stateful fields: %s", strings.Join(unsupported, ", "))
	}
	return nil
}

func ValidateRequestChatUnsupportedFields(req *dto.OpenAIResponsesRequest) error {
	return validateResponsesRequestChatUnsupportedFields(req)
}

func responsesRequestMessagesToChat(ctx context.Context, req *dto.OpenAIResponsesRequest) ([]dto.Message, error) {
	messages := make([]dto.Message, 0)
	if rawJSONPresent(req.Instructions) {
		instructions, err := responsesJSONString(req.Instructions)
		if err != nil {
			return nil, fmt.Errorf("invalid instructions: %w", err)
		}
		if strings.TrimSpace(instructions) != "" {
			messages = append(messages, dto.Message{Role: "system", Content: instructions})
		}
	}

	if !rawJSONPresent(req.Input) {
		return messages, nil
	}

	switch kitutil.GetJsonType(req.Input) {
	case "string":
		input, err := responsesJSONString(req.Input)
		if err != nil {
			return nil, fmt.Errorf("invalid input string: %w", err)
		}
		messages = append(messages, dto.Message{Role: "user", Content: input})
		return messages, nil
	case "array":
		var items []map[string]any
		if err := kitutil.Unmarshal(req.Input, &items); err != nil {
			return nil, fmt.Errorf("invalid input array: %w", err)
		}
		// Chat Completions requires the tool messages answering one assistant tool_calls
		// batch to stay contiguous, so media hoisted out of tool output items is
		// held back and emitted as a single user message once the batch ends.
		var pendingMedia []any
		for _, item := range items {
			itemType := strings.TrimSpace(kitutil.Interface2String(item["type"]))
			if len(pendingMedia) > 0 && itemType != responsesInputTypeFunctionCallOutput && itemType != responsesInputTypeCustomToolOutput {
				messages = append(messages, dto.Message{Role: "user", Content: pendingMedia})
				pendingMedia = nil
			}
			nextMessages, media, err := responsesInputItemToChatMessages(ctx, item, messages)
			if err != nil {
				return nil, err
			}
			messages = nextMessages
			pendingMedia = append(pendingMedia, media...)
		}
		if len(pendingMedia) > 0 {
			messages = append(messages, dto.Message{Role: "user", Content: pendingMedia})
		}
		return messages, nil
	default:
		return nil, fmt.Errorf("unsupported responses input type %q", kitutil.GetJsonType(req.Input))
	}
}

// responsesInputItemToChatMessages appends the Chat messages for one Responses input item.
// The second result carries media content parts hoisted out of a tool output item,
// already in Chat shape; the caller decides where that user message lands.
func responsesInputItemToChatMessages(ctx context.Context, item map[string]any, messages []dto.Message) ([]dto.Message, []any, error) {
	itemType := strings.TrimSpace(kitutil.Interface2String(item["type"]))
	switch itemType {
	case responsesInputTypeFunctionCall:
		toolCall, err := responsesFunctionCallItemToChatToolCall(item)
		if err != nil {
			return nil, nil, err
		}
		return appendToolCallToLastAssistant(messages, toolCall), nil, nil
	case responsesInputTypeCustomToolCall:
		toolCall, err := responsesCustomToolCallItemToChatToolCall(item)
		if err != nil {
			return nil, nil, err
		}
		return appendToolCallToLastAssistant(messages, toolCall), nil, nil
	case responsesInputTypeFunctionCallOutput, responsesInputTypeCustomToolOutput:
		callID := strings.TrimSpace(kitutil.Interface2String(item["call_id"]))
		content, media := responsesToolOutputToChat(ctx, item["output"])
		return append(messages, dto.Message{Role: "tool", ToolCallId: callID, Content: content}), media, nil
	}

	role := strings.TrimSpace(kitutil.Interface2String(item["role"]))
	if role == "" {
		role = "user"
	}
	content, err := responsesInputContentToChatContent(ctx, item["content"])
	if err != nil {
		return nil, nil, err
	}
	return append(messages, dto.Message{Role: role, Content: content}), nil, nil
}

func responsesInputContentToChatContent(ctx context.Context, content any) (any, error) {
	if content == nil {
		return "", nil
	}

	switch value := content.(type) {
	case string:
		return value, nil
	case []any:
		return responsesContentPartsToChatContent(ctx, value)
	case []map[string]any:
		parts := make([]any, 0, len(value))
		for _, part := range value {
			parts = append(parts, part)
		}
		return responsesContentPartsToChatContent(ctx, parts)
	default:
		return content, nil
	}
}

func responsesContentPartsToChatContent(ctx context.Context, parts []any) (any, error) {
	chatParts := make([]any, 0, len(parts))
	var textOnly strings.Builder
	onlyText := true
	droppedFile := false

	for _, rawPart := range parts {
		part, ok := rawPart.(map[string]any)
		if !ok {
			onlyText = false
			chatParts = append(chatParts, rawPart)
			continue
		}

		partType := strings.TrimSpace(kitutil.Interface2String(part["type"]))
		switch partType {
		case "input_text", "output_text", "text":
			text := kitutil.Interface2String(part["text"])
			textOnly.WriteString(text)
			chatParts = append(chatParts, map[string]any{
				"type": dto.ContentTypeText,
				"text": text,
			})
		case "input_image":
			onlyText = false
			chatParts = append(chatParts, map[string]any{
				"type":      dto.ContentTypeImageURL,
				"image_url": responsesImagePartToChatImageURL(part),
			})
		case "input_file":
			onlyText = false
			chatPart, reason := responsesFilePartToChat(ctx, part)
			if reason != "" {
				convdiag.Add(ctx, types.ConversionDiagnostic{
					Code:     "unsupported_media_type",
					Path:     "input.content",
					Message:  reason + "; the file was omitted",
					Severity: types.ConversionDiagnosticError,
				})
				droppedFile = true
				continue
			}
			chatParts = append(chatParts, chatPart)
		case "input_audio":
			onlyText = false
			chatParts = append(chatParts, map[string]any{
				"type":        dto.ContentTypeInputAudio,
				"input_audio": responsesPartPayload(part, "input_audio"),
			})
		case "input_video":
			onlyText = false
			chatParts = append(chatParts, map[string]any{
				"type":      dto.ContentTypeVideoUrl,
				"video_url": responsesVideoPartToChatVideoURL(part),
			})
		default:
			onlyText = false
			chatParts = append(chatParts, part)
		}
	}

	if onlyText {
		return textOnly.String(), nil
	}
	if len(chatParts) == 0 && droppedFile {
		// Chat rejects an empty content array; name what was omitted instead.
		return "[file]", nil
	}
	return chatParts, nil
}

func responsesFunctionCallItemToChatToolCall(item map[string]any) (dto.ToolCallRequest, error) {
	name := responsesCallName(item)
	if name == "" {
		return dto.ToolCallRequest{}, errors.New("function_call item is missing name")
	}
	return dto.ToolCallRequest{
		ID:   responsesCallID(item),
		Type: "function",
		Function: dto.FunctionRequest{
			Name:      name,
			Arguments: responsesArgumentsString(item["arguments"]),
		},
	}, nil
}

// responsesCustomToolCallItemToChatToolCall encodes a custom tool call the same
// way its definition reaches Chat Completions: a function call whose arguments
// carry the raw input under the single "input" key.
func responsesCustomToolCallItemToChatToolCall(item map[string]any) (dto.ToolCallRequest, error) {
	name := responsesCallName(item)
	if name == "" {
		return dto.ToolCallRequest{}, errors.New("custom_tool_call item is missing name")
	}
	arguments, err := kitutil.Marshal(map[string]string{
		convmeta.CustomToolInputArgument: responsesArgumentsString(item["input"]),
	})
	if err != nil {
		return dto.ToolCallRequest{}, err
	}
	return dto.ToolCallRequest{
		ID:   responsesCallID(item),
		Type: "function",
		Function: dto.FunctionRequest{
			Name:      name,
			Arguments: string(arguments),
		},
	}, nil
}

func appendToolCallToLastAssistant(messages []dto.Message, toolCall dto.ToolCallRequest) []dto.Message {
	if len(messages) == 0 || messages[len(messages)-1].Role != "assistant" {
		messages = append(messages, dto.Message{Role: "assistant"})
	}

	idx := len(messages) - 1
	toolCalls := messages[idx].ParseToolCalls()
	toolCalls = append(toolCalls, toolCall)
	toolCallsRaw, _ := kitutil.Marshal(toolCalls)
	messages[idx].ToolCalls = toolCallsRaw
	return messages
}

func responsesRequestToolsToChat(raw json.RawMessage) ([]dto.ToolCallRequest, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}

	var tools []map[string]any
	if err := kitutil.Unmarshal(raw, &tools); err != nil {
		return nil, fmt.Errorf("invalid tools: %w", err)
	}

	out := make([]dto.ToolCallRequest, 0, len(tools))
	for _, tool := range tools {
		toolType := strings.TrimSpace(kitutil.Interface2String(tool["type"]))
		if toolType == "function" {
			out = append(out, dto.ToolCallRequest{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        strings.TrimSpace(kitutil.Interface2String(tool["name"])),
					Description: kitutil.Interface2String(tool["description"]),
					Parameters:  tool["parameters"],
				},
			})
			continue
		}

		rawTool, err := kitutil.Marshal(tool)
		if err != nil {
			return nil, err
		}
		out = append(out, dto.ToolCallRequest{
			Type:   toolType,
			Custom: rawTool,
		})
	}
	return out, nil
}

func responsesRequestToolChoiceToChat(raw json.RawMessage) (any, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}
	if kitutil.GetJsonType(raw) == "string" {
		var choice string
		if err := kitutil.Unmarshal(raw, &choice); err != nil {
			return nil, fmt.Errorf("invalid tool_choice: %w", err)
		}
		return choice, nil
	}

	var choice map[string]any
	if err := kitutil.Unmarshal(raw, &choice); err != nil {
		return nil, fmt.Errorf("invalid tool_choice: %w", err)
	}
	if kitutil.Interface2String(choice["type"]) == "function" {
		name := strings.TrimSpace(kitutil.Interface2String(choice["name"]))
		if name != "" {
			return map[string]any{
				"type": "function",
				"function": map[string]any{
					"name": name,
				},
			}, nil
		}
	}
	return choice, nil
}

func RequestToolChoiceToChat(raw json.RawMessage) (any, error) {
	return responsesRequestToolChoiceToChat(raw)
}

func responsesRequestTextToChatResponseFormat(raw json.RawMessage) (*dto.ResponseFormat, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}

	var textConfig map[string]any
	if err := kitutil.Unmarshal(raw, &textConfig); err != nil {
		return nil, fmt.Errorf("invalid text config: %w", err)
	}
	format, ok := textConfig["format"].(map[string]any)
	if !ok {
		return nil, nil
	}

	formatType := strings.TrimSpace(kitutil.Interface2String(format["type"]))
	if formatType == "" {
		return nil, nil
	}

	out := &dto.ResponseFormat{Type: formatType}
	if formatType == "json_schema" {
		schemaRaw, err := kitutil.Marshal(format)
		if err != nil {
			return nil, err
		}
		out.JsonSchema = schemaRaw
	}
	return out, nil
}

func RequestTextToChatResponseFormat(raw json.RawMessage) (*dto.ResponseFormat, error) {
	return responsesRequestTextToChatResponseFormat(raw)
}

func responsesImagePartToChatImageURL(part map[string]any) any {
	if imageURL, ok := part["image_url"]; ok {
		return imageURL
	}
	imageURL := map[string]any{}
	for _, key := range []string{"url", "file_id", "detail"} {
		if value, ok := part[key]; ok {
			imageURL[key] = value
		}
	}
	if len(imageURL) == 0 {
		return part
	}
	return imageURL
}

// responsesFilePartToChat maps a Responses input_file onto Chat Completions,
// whose file part takes only PDF data or an uploaded file_id and no file URL.
// Files given by data or URL are loaded through the media resolver: PDF
// becomes a Chat file part with inline data and text files become a text
// part. A non-empty reason means Chat cannot carry the file.
func responsesFilePartToChat(ctx context.Context, part map[string]any) (map[string]any, string) {
	fields := part
	if nested, ok := part["file"].(map[string]any); ok {
		fields = nested
	}
	filename := strings.TrimSpace(kitutil.Interface2String(fields["filename"]))
	source := ContentPartToFileSource(part)
	if source == nil {
		fileID := strings.TrimSpace(kitutil.Interface2String(fields["file_id"]))
		if fileID == "" {
			return nil, "input_file carries no file_data, file_url, or file_id"
		}
		file := map[string]any{"file_id": fileID}
		if filename != "" {
			file["filename"] = filename
		}
		return map[string]any{"type": dto.ContentTypeFile, "file": file}, ""
	}
	base64Data, mimeType, err := relaymedia.ResolveBase64Data(ctx, source, "formatting Responses input file for Chat")
	if err != nil {
		return nil, fmt.Sprintf("input_file could not be loaded: %s", err.Error())
	}
	mediaType, _, _ := strings.Cut(strings.ToLower(strings.TrimSpace(mimeType)), ";")
	mediaType = strings.TrimSpace(mediaType)
	switch {
	case mediaType == "application/pdf":
		if filename == "" {
			filename = "document.pdf"
		}
		return map[string]any{"type": dto.ContentTypeFile, "file": map[string]any{
			"filename":  filename,
			"file_data": "data:application/pdf;base64," + base64Data,
		}}, ""
	case relaymedia.IsTextMimeType(mediaType):
		text, ok := relaymedia.DecodeText(base64Data)
		if !ok {
			return nil, fmt.Sprintf("input_file of MIME type %q could not be decoded as UTF-8 text", mimeType)
		}
		return map[string]any{"type": dto.ContentTypeText, "text": text}, ""
	}
	return nil, fmt.Sprintf("OpenAI Chat Completions file parts accept only PDF, not %q", mimeType)
}

func responsesVideoPartToChatVideoURL(part map[string]any) any {
	if videoURL, ok := part["video_url"]; ok {
		if videoURLMap, ok := videoURL.(map[string]any); ok {
			if url := kitutil.Interface2String(videoURLMap["url"]); url != "" {
				return url
			}
		}
		return videoURL
	}
	if url := kitutil.Interface2String(part["url"]); url != "" {
		return url
	}
	return responsesPartPayload(part, "video_url")
}

func responsesPartPayload(part map[string]any, key string) any {
	if value, ok := part[key]; ok {
		return value
	}
	payload := make(map[string]any, len(part))
	for k, value := range part {
		if k == "type" {
			continue
		}
		payload[k] = value
	}
	return payload
}

func responsesCallID(item map[string]any) string {
	callID := strings.TrimSpace(kitutil.Interface2String(item["call_id"]))
	if callID != "" {
		return callID
	}
	return strings.TrimSpace(kitutil.Interface2String(item["id"]))
}

func CallID(item map[string]any) string {
	return responsesCallID(item)
}

// responsesCallName is the upstream function name of a function_call or
// custom_tool_call item: a call made in a tool namespace uses the name its
// flattened definition was sent with.
func responsesCallName(item map[string]any) string {
	name := strings.TrimSpace(kitutil.Interface2String(item["name"]))
	if name == "" {
		return ""
	}
	return convmeta.NamespacedToolName(strings.TrimSpace(kitutil.Interface2String(item["namespace"])), name)
}

func responsesArgumentsString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	default:
		raw, err := kitutil.Marshal(v)
		if err != nil {
			return kitutil.Interface2String(v)
		}
		return string(raw)
	}
}

func responseToolOutputToChatContent(value any) any {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	default:
		raw, err := kitutil.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(raw)
	}
}

// responsesToolOutputToChat maps a function_call_output payload onto Chat Completions, where a
// tool message may only carry text. A Responses content-part array keeps its text on the tool
// message and returns the media parts in Chat shape for the caller to hoist into a user message;
// stringifying them instead would hand base64 image data to the upstream text tokenizer. Any
// other payload shape (string, object, plain JSON array) keeps the historical stringified form.
func responsesToolOutputToChat(ctx context.Context, value any) (any, []any) {
	rawParts, ok := value.([]any)
	if !ok || len(rawParts) == 0 {
		return responseToolOutputToChatContent(value), nil
	}

	texts := make([]string, 0, len(rawParts))
	mediaParts := make([]any, 0, len(rawParts))
	labels := make([]string, 0, len(rawParts))
	for _, rawPart := range rawParts {
		part, ok := rawPart.(map[string]any)
		if !ok {
			return responseToolOutputToChatContent(value), nil
		}
		partType := strings.TrimSpace(kitutil.Interface2String(part["type"]))
		switch partType {
		case "input_text", "output_text", "text":
			if text := kitutil.Interface2String(part["text"]); text != "" {
				texts = append(texts, text)
			}
		case "input_image", "input_file", "input_audio", "input_video":
			mediaParts = append(mediaParts, part)
			label := "[" + strings.TrimPrefix(partType, "input_") + "]"
			if !slices.Contains(labels, label) {
				labels = append(labels, label)
			}
		default:
			return responseToolOutputToChatContent(value), nil
		}
	}
	if len(mediaParts) == 0 {
		return strings.Join(texts, "\n"), nil
	}

	converted, err := responsesContentPartsToChatContent(ctx, mediaParts)
	if err != nil {
		return responseToolOutputToChatContent(value), nil
	}
	media, _ := converted.([]any)
	if len(texts) == 0 {
		// Upstreams reject empty tool content; the media itself rides on the hoisted user message.
		return strings.Join(labels, " "), media
	}
	return strings.Join(texts, "\n"), media
}

func responsesRawFloat(raw json.RawMessage) (*float64, error) {
	if !rawJSONPresent(raw) {
		return nil, nil
	}
	var value float64
	if err := kitutil.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func responsesJSONString(raw json.RawMessage) (string, error) {
	if kitutil.GetJsonType(raw) != "string" {
		return string(raw), nil
	}
	var value string
	if err := kitutil.Unmarshal(raw, &value); err != nil {
		return "", err
	}
	return value, nil
}

func rawJSONPresent(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	return kitutil.GetJsonType(raw) != "null"
}

func JSONString(raw json.RawMessage) (string, error) {
	return responsesJSONString(raw)
}

func RawJSONPresent(raw json.RawMessage) bool {
	return rawJSONPresent(raw)
}
