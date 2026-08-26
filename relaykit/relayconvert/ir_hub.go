package relayconvert

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/project"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	sharedclaude "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/claude"
	sharedgemini "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/shared/gemini"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func isTextRelayFormat(format types.RelayFormat) bool {
	return project.IsTextFormat(format)
}

func convertRequestIR(info convmeta.Meta, from, target types.RelayFormat, request any) (*RequestResult, error) {
	irReq, err := project.FromRequest(from, request)
	if err != nil {
		return nil, err
	}
	if err := rejectStatefulResponses(irReq, target); err != nil {
		return nil, err
	}
	fillToolResultNames(irReq)
	report := ir.RequestProjectionLosses(from, target, irReq)
	if target == types.RelayFormatGemini {
		filterIRForGemini(irReq, &report)
	}
	if target != types.RelayFormatOpenAIResponses {
		mergeAdjacentMessages(irReq)
	}
	if irReq.Model == "" {
		if name := convmeta.UpstreamModelName(info); name != "" {
			irReq.Model = name
		}
	}
	out, err := project.ToRequest(target, irReq)
	if err != nil {
		return nil, err
	}
	if err := adaptOutgoingRequest(info, target, irReq, out); err != nil {
		return nil, err
	}
	if info != nil {
		info.AppendRequestConversion(target)
	}
	converter, quality := requestRouteMeta(from, target)
	return &RequestResult{
		Value:     out,
		From:      from,
		To:        target,
		Converter: converter,
		Quality:   quality,
		Steps: []RequestStep{{
			Converter: converter,
			From:      from,
			To:        target,
		}},
		Report: report,
	}, nil
}

func convertStreamResponseIR(info convmeta.Meta, from, target types.RelayFormat, response any) (*ResponseResult, error) {
	state := ensureIRStream(info, ResponseStreamOptions{})
	values, usage, err := projectStream(info, from, target, response, state, false)
	if err != nil {
		return nil, err
	}
	converter, quality := responseRouteMeta(from, target)
	value := packStatelessStreamValue(target, values)
	if chat, ok := value.(*dto.ChatCompletionsStreamResponse); ok && usage != nil {
		chat.Usage = usage
	}
	return &ResponseResult{
		Value:     value,
		Usage:     usage,
		From:      from,
		To:        target,
		Converter: converter,
		Quality:   quality,
		Steps: []ResponseStep{{
			Converter: converter,
			From:      from,
			To:        target,
		}},
		Stream: true,
	}, nil
}

func newIRResponseStreamState(from, target types.RelayFormat, options ResponseStreamOptions) *ResponseStreamState {
	converter, quality := responseRouteMeta(from, target)
	stream := ir.NewStreamState(options.ID, options.Model)
	stream.Created = options.Created
	return &ResponseStreamState{
		From:      from,
		To:        target,
		Converter: converter,
		Quality:   quality,
		Steps: []ResponseStep{{
			Converter: converter,
			From:      from,
			To:        target,
		}},
		irState: stream,
	}
}

func convertStreamChunkIR(info convmeta.Meta, state *ResponseStreamState, response any, finalizeOneShot bool) ([]ResponseResult, error) {
	values, usage, err := projectStream(info, state.From, state.To, response, state.irState, finalizeOneShot)
	if err != nil {
		return nil, err
	}
	state.rememberUsage(usage)
	return responseStreamResults(state, values, usage), nil
}

func finalizeStreamIR(info convmeta.Meta, state *ResponseStreamState) ([]ResponseResult, error) {
	if state == nil || state.irState == nil {
		return nil, nil
	}
	events := state.irState.Finalize()
	if len(events) == 0 {
		return nil, nil
	}
	out, err := project.ToStream(state.To, events, state.irState)
	if err != nil {
		return nil, err
	}
	out = wrapStreamValues(state.To, out)
	markClaudeStreamDone(info, state)
	patchClaudeStreamUsage(info, out)
	usage := state.Usage()
	return responseStreamResults(state, out, usage), nil
}

func markClaudeStreamDone(info convmeta.Meta, state *ResponseStreamState) {
	if info == nil || state == nil || state.To != types.RelayFormatClaude {
		return
	}
	if state.irState != nil && (state.irState.Done || state.irState.TerminalSent) {
		info.EnsureClaudeConvertInfo().Done = true
	}
}

func patchClaudeStreamUsage(info convmeta.Meta, values []any) {
	if info == nil {
		return
	}
	usage := info.EnsureClaudeConvertInfo().Usage
	if usage == nil {
		return
	}
	for _, value := range values {
		resp, ok := value.(*dto.ClaudeResponse)
		if !ok || resp == nil || resp.Type != "message_delta" {
			continue
		}
		resp.Usage = &dto.ClaudeUsage{
			InputTokens:  usage.PromptTokens,
			OutputTokens: usage.CompletionTokens,
		}
	}
}

func projectStream(info convmeta.Meta, from, target types.RelayFormat, chunk any, state *ir.StreamState, oneShot bool) ([]any, *dto.Usage, error) {
	if state == nil {
		state = ir.NewStreamState("", "")
	}
	if state.Model == "" {
		if name := convmeta.UpstreamModelName(info); name != "" {
			state.Model = name
		}
	}
	events, err := project.FromStream(from, chunk, state)
	if err != nil {
		return nil, nil, err
	}
	if oneShot {
		events = append(events, state.TerminalEvents()...)
	}
	out, err := project.ToStream(target, events, state)
	if err != nil {
		return nil, nil, err
	}
	out = wrapStreamValues(target, out)
	if target == types.RelayFormatClaude && state.Done {
		markClaudeStreamDone(info, &ResponseStreamState{To: target, irState: state})
	}
	return out, canonicalUsageFromResponse(chunk), nil
}

func ensureIRStream(info convmeta.Meta, options ResponseStreamOptions) *ir.StreamState {
	if info != nil {
		if state, ok := info.GetStreamHub().(*ir.StreamState); ok && state != nil {
			return state
		}
	}
	state := ir.NewStreamState(options.ID, options.Model)
	if info != nil {
		info.SetStreamHub(state)
	}
	return state
}

func wrapStreamValues(target types.RelayFormat, values []any) []any {
	if target != types.RelayFormatOpenAIResponses {
		return values
	}
	wrapped := make([]any, 0, len(values))
	for _, value := range values {
		switch event := value.(type) {
		case dto.ResponsesStreamResponse:
			wrapped = append(wrapped, ChatToResponsesStreamEvent{Type: event.Type, Payload: event})
		case *dto.ResponsesStreamResponse:
			wrapped = append(wrapped, ChatToResponsesStreamEvent{Type: event.Type, Payload: *event})
		default:
			wrapped = append(wrapped, value)
		}
	}
	return wrapped
}

func packStatelessStreamValue(target types.RelayFormat, values []any) any {
	switch target {
	case types.RelayFormatClaude:
		list := make([]*dto.ClaudeResponse, 0, len(values))
		for _, value := range values {
			switch typed := value.(type) {
			case *dto.ClaudeResponse:
				list = append(list, typed)
			case dto.ClaudeResponse:
				item := typed
				list = append(list, &item)
			}
		}
		return list
	case types.RelayFormatOpenAI:
		var last *dto.ChatCompletionsStreamResponse
		for _, value := range values {
			switch typed := value.(type) {
			case *dto.ChatCompletionsStreamResponse:
				last = typed
			case dto.ChatCompletionsStreamResponse:
				item := typed
				last = &item
			}
		}
		if last != nil && last.Choices != nil && last.Choices[0].FinishReason != nil {
			for _, value := range values {
				switch typed := value.(type) {
				case dto.ChatCompletionsStreamResponse:
					if typed.Choices[0].Delta.GetContentString() != "" {
						item := typed
						return &item
					}
				case *dto.ChatCompletionsStreamResponse:
					if typed != nil && typed.Choices[0].Delta.GetContentString() != "" {
						return typed
					}
				}
			}
		}
		return last
	case types.RelayFormatGemini:
		for _, value := range values {
			switch typed := value.(type) {
			case *dto.GeminiChatResponse:
				return typed
			case dto.GeminiChatResponse:
				item := typed
				return &item
			}
		}
	}
	if len(values) == 1 {
		return values[0]
	}
	return values
}

func convertResponseIR(info convmeta.Meta, from, target types.RelayFormat, response any) (*ResponseResult, error) {
	irResp, err := project.FromResponse(from, response)
	if err != nil {
		return nil, err
	}
	adaptIRResponse(info, irResp)
	out, err := project.ToResponse(target, irResp)
	if err != nil {
		return nil, err
	}
	applyResponseUsage(from, target, response, out)
	applyResponseWireMeta(target, irResp, out)
	converter, quality := responseRouteMeta(from, target)
	return &ResponseResult{
		Value:     out,
		Usage:     resultUsage(target, out),
		From:      from,
		To:        target,
		Converter: converter,
		Quality:   quality,
		Steps: []ResponseStep{{
			Converter: converter,
			From:      from,
			To:        target,
		}},
		Stream: false,
		Report: ir.ResponseProjectionLosses(from, target, irResp),
	}, nil
}

func responseRouteMeta(from, to types.RelayFormat) (string, ResponseConverterQuality) {
	if route, ok := lookupTextRoute(from, to); ok {
		return route.ID, ResponseConverterQuality(route.Quality)
	}
	return fmt.Sprintf("ir:%s_to_%s", from, to), ResponseConverterQualityFair
}

func adaptIRResponse(info convmeta.Meta, resp *ir.Response) {
	if resp == nil {
		return
	}
	if resp.ID == "" {
		resp.ID = "chatcmpl-" + kitutil.GetUUID()
	}
	if resp.Model == "" {
		if name := convmeta.UpstreamModelName(info); name != "" {
			resp.Model = name
		}
	}
	for i := range resp.Blocks {
		if resp.Blocks[i].ToolUse == nil || resp.Blocks[i].ToolUse.ID != "" {
			continue
		}
		resp.Blocks[i].ToolUse.ID = fmt.Sprintf("call_%s", kitutil.GetUUID())
	}
	if responseHasToolUse(resp) && (resp.Finish == "" || resp.Finish == ir.FinishStop || resp.Finish == ir.FinishUnknown) {
		resp.Finish = ir.FinishTool
	}
}

func responseHasToolUse(resp *ir.Response) bool {
	if resp == nil {
		return false
	}
	for _, block := range resp.Blocks {
		if block.Kind == ir.BlockKindToolUse {
			return true
		}
	}
	return false
}

func sourceCanonicalUsage(from types.RelayFormat, response any) *dto.Usage {
	switch from {
	case types.RelayFormatOpenAI:
		switch resp := response.(type) {
		case *dto.OpenAITextResponse:
			return UsageFromChatUsage(&resp.Usage)
		case dto.OpenAITextResponse:
			return UsageFromChatUsage(&resp.Usage)
		}
	case types.RelayFormatClaude:
		switch resp := response.(type) {
		case *dto.ClaudeResponse:
			return UsageFromClaudeAPIUsage(resp.Usage)
		case dto.ClaudeResponse:
			return UsageFromClaudeAPIUsage(resp.Usage)
		}
	case types.RelayFormatGemini:
		switch resp := response.(type) {
		case *dto.GeminiChatResponse:
			return UsageFromGeminiMetadata(resp.GetUsageMetadata(), 0)
		case dto.GeminiChatResponse:
			return UsageFromGeminiMetadata(resp.GetUsageMetadata(), 0)
		}
	case types.RelayFormatOpenAIResponses:
		switch resp := response.(type) {
		case *dto.OpenAIResponsesResponse:
			return UsageFromResponsesUsage(resp.Usage)
		case dto.OpenAIResponsesResponse:
			return UsageFromResponsesUsage(resp.Usage)
		}
	}
	return canonicalUsageFromResponse(response)
}

func resultUsage(target types.RelayFormat, out any) *dto.Usage {
	switch target {
	case types.RelayFormatOpenAI:
		resp, ok := out.(*dto.OpenAITextResponse)
		if !ok {
			break
		}
		clone := resp.Usage
		clone.BillingUsage = dto.CloneBillingUsage(resp.Usage.BillingUsage)
		return &clone
	case types.RelayFormatOpenAIResponses:
		resp, ok := out.(*dto.OpenAIResponsesResponse)
		if !ok || resp.Usage == nil {
			break
		}
		clone := *resp.Usage
		clone.BillingUsage = dto.CloneBillingUsage(resp.Usage.BillingUsage)
		return &clone
	}
	return canonicalUsageFromResponse(out)
}

func applyResponseUsage(from, target types.RelayFormat, original, out any) {
	usage := sourceCanonicalUsage(from, original)
	if usage == nil {
		return
	}
	switch target {
	case types.RelayFormatOpenAI:
		resp, ok := out.(*dto.OpenAITextResponse)
		if !ok {
			return
		}
		resp.Usage = *usage
	case types.RelayFormatClaude:
		resp, ok := out.(*dto.ClaudeResponse)
		if !ok {
			return
		}
		resp.Usage = BuildClaudeUsageFromOpenAIUsage(usage)
	case types.RelayFormatGemini:
		resp, ok := out.(*dto.GeminiChatResponse)
		if !ok {
			return
		}
		resp.UsageMetadata = GeminiUsageFromOpenAIChatUsage(usage)
		resp.HasUsageMetadata = true
	case types.RelayFormatOpenAIResponses:
		resp, ok := out.(*dto.OpenAIResponsesResponse)
		if !ok {
			return
		}
		resp.Usage = usage
	}
}

func applyResponseWireMeta(target types.RelayFormat, irResp *ir.Response, out any) {
	switch target {
	case types.RelayFormatOpenAI:
		resp, ok := out.(*dto.OpenAITextResponse)
		if !ok {
			return
		}
		if resp.Object == "" {
			resp.Object = "chat.completion"
		}
		if resp.Created == nil {
			resp.Created = int64(0)
		}
		if len(resp.Choices) > 0 {
			resp.Choices[0].FinishReason = chatFinishReason(irResp)
		}
	case types.RelayFormatClaude:
		resp, ok := out.(*dto.ClaudeResponse)
		if !ok {
			return
		}
		resp.StopReason = claudeStopReason(irResp)
	case types.RelayFormatGemini:
		resp, ok := out.(*dto.GeminiChatResponse)
		if !ok {
			return
		}
		if len(resp.Candidates) > 0 {
			reason := geminiFinishReason(irResp)
			resp.Candidates[0].FinishReason = &reason
		}
	case types.RelayFormatOpenAIResponses:
		resp, ok := out.(*dto.OpenAIResponsesResponse)
		if !ok {
			return
		}
		if len(resp.Status) == 0 || string(resp.Status) == "null" {
			status, _ := ResponsesStatusFromChatFinishReason(chatFinishReason(irResp))
			raw, _ := json.Marshal(status)
			resp.Status = raw
		}
	}
}

func chatFinishReason(resp *ir.Response) string {
	if responseHasToolUse(resp) {
		return "tool_calls"
	}
	switch strings.ToLower(resp.ProviderFinish) {
	case "stop", "length", "tool_calls", "content_filter":
		return strings.ToLower(resp.ProviderFinish)
	}
	if resp.Finish != "" {
		return resp.Finish.ToChatFinishReason()
	}
	return "stop"
}

func claudeStopReason(resp *ir.Response) string {
	if responseHasToolUse(resp) {
		return "tool_use"
	}
	switch strings.ToLower(resp.ProviderFinish) {
	case "end_turn", "stop_sequence", "max_tokens", "tool_use", "refusal":
		return strings.ToLower(resp.ProviderFinish)
	}
	if resp.Finish != "" {
		return resp.Finish.ToClaudeStopReason()
	}
	return "end_turn"
}

func geminiFinishReason(resp *ir.Response) string {
	switch strings.ToUpper(resp.ProviderFinish) {
	case "STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER":
		return strings.ToUpper(resp.ProviderFinish)
	}
	switch resp.Finish {
	case ir.FinishLength:
		return "MAX_TOKENS"
	case ir.FinishFilter:
		return "SAFETY"
	default:
		return "STOP"
	}
}

func isNonStreamTextResponse(response any) bool {
	switch response.(type) {
	case *dto.OpenAITextResponse, dto.OpenAITextResponse,
		*dto.ClaudeResponse, dto.ClaudeResponse,
		*dto.GeminiChatResponse, dto.GeminiChatResponse,
		*dto.OpenAIResponsesResponse, dto.OpenAIResponsesResponse:
		return true
	default:
		return false
	}
}

func requestRouteMeta(from, to types.RelayFormat) (string, RequestConverterQuality) {
	if route, ok := lookupTextRoute(from, to); ok {
		return route.ID, RequestConverterQuality(route.Quality)
	}
	return fmt.Sprintf("ir:%s_to_%s", from, to), RequestConverterQualityFair
}

func mergeAdjacentMessages(req *ir.Request) {
	if req == nil || len(req.Messages) < 2 {
		return
	}
	merged := make([]ir.Message, 0, len(req.Messages))
	for _, message := range req.Messages {
		if n := len(merged); n > 0 && merged[n-1].Role == message.Role && message.Role != ir.RoleSystem {
			merged[n-1].Blocks = append(merged[n-1].Blocks, message.Blocks...)
			continue
		}
		merged = append(merged, message)
	}
	req.Messages = merged
}

func fillToolResultNames(req *ir.Request) {
	if req == nil {
		return
	}
	names := map[string]string{}
	for i := range req.Messages {
		for _, block := range req.Messages[i].Blocks {
			if block.ToolUse != nil && block.ToolUse.ID != "" {
				names[block.ToolUse.ID] = block.ToolUse.Name
			}
		}
	}
	for i := range req.Messages {
		for _, block := range req.Messages[i].Blocks {
			if block.ToolResult != nil && block.ToolResult.Name == "" {
				block.ToolResult.Name = names[block.ToolResult.ToolUseID]
			}
		}
	}
}

func rejectStatefulResponses(req *ir.Request, target types.RelayFormat) error {
	if req == nil || target == types.RelayFormatOpenAIResponses {
		return nil
	}
	ext := req.Extensions.Responses
	if ext == nil {
		return nil
	}
	unsupported := make([]string, 0, 4)
	if rawPresent(ext.Conversation) {
		unsupported = append(unsupported, "conversation")
	}
	if strings.TrimSpace(ext.PreviousResponseID) != "" {
		unsupported = append(unsupported, "previous_response_id")
	}
	if rawPresent(ext.Prompt) {
		unsupported = append(unsupported, "prompt")
	}
	if rawPresent(ext.ContextManagement) {
		unsupported = append(unsupported, "context_management")
	}
	if len(unsupported) == 0 {
		return nil
	}
	return fmt.Errorf("responses to %s conversion does not support stateful fields: %s", target, strings.Join(unsupported, ", "))
}

func filterIRForGemini(req *ir.Request, report *ir.Report) {
	if req == nil {
		return
	}
	tools := make([]ir.Tool, 0, len(req.Tools))
	for _, tool := range req.Tools {
		switch tool.Kind {
		case ir.ToolFunction, ir.ToolGoogleSearch, ir.ToolCodeExecution:
			tools = append(tools, tool)
		default:
			report.AddOnce(ir.LossDropped, "tools."+string(tool.Kind), "Gemini does not accept this tool kind")
		}
	}
	req.Tools = tools
	skippedCalls := map[string]struct{}{}
	for _, message := range req.Messages {
		for _, block := range message.Blocks {
			if block.Kind != ir.BlockKindRaw || block.Raw == nil {
				continue
			}
			if block.Raw.Type != "custom_tool_call" {
				continue
			}
			var item map[string]any
			if err := json.Unmarshal(block.Raw.JSON, &item); err != nil {
				continue
			}
			if id, _ := item["call_id"].(string); id != "" {
				skippedCalls[id] = struct{}{}
			}
		}
	}
	messages := make([]ir.Message, 0, len(req.Messages))
	for _, message := range req.Messages {
		blocks := make([]ir.Block, 0, len(message.Blocks))
		for _, block := range message.Blocks {
			if block.Kind == ir.BlockKindRaw && block.Raw != nil {
				switch block.Raw.Type {
				case "custom_tool_call", "custom_tool_call_output":
					report.AddOnce(ir.LossDropped, block.Raw.Type, "Gemini does not accept Responses custom tools")
					continue
				}
			}
			if block.Kind == ir.BlockKindToolResult && block.ToolResult != nil {
				if _, skip := skippedCalls[block.ToolResult.ToolUseID]; skip {
					continue
				}
			}
			blocks = append(blocks, block)
		}
		if len(blocks) == 0 && message.Role != ir.RoleSystem {
			continue
		}
		message.Blocks = blocks
		messages = append(messages, message)
	}
	req.Messages = messages
}

func adaptOutgoingRequest(info convmeta.Meta, target types.RelayFormat, irReq *ir.Request, out any) error {
	switch target {
	case types.RelayFormatClaude:
		req, ok := out.(*dto.ClaudeRequest)
		if !ok {
			return fmt.Errorf("expected Anthropic Messages request, got %T", out)
		}
		return adaptClaudeRequest(info, irReq, req)
	case types.RelayFormatGemini:
		req, ok := out.(*dto.GeminiChatRequest)
		if !ok {
			return fmt.Errorf("expected Gemini generateContent request, got %T", out)
		}
		adaptGeminiRequest(info, irReq, req)
	}
	return nil
}

func adaptClaudeRequest(info convmeta.Meta, irReq *ir.Request, req *dto.ClaudeRequest) error {
	opts := convmeta.OptionsOf(info)
	model := req.Model
	if name := convmeta.UpstreamModelName(info); name != "" {
		model = name
	}
	sharedclaude.ApplyModelThinking(
		req,
		model,
		opts.Claude.ThinkingAdapterEnabled,
		opts.ShouldPreserveThinkingSuffix(model),
	)
	if irReq != nil && irReq.Think != nil && irReq.Think.Level != "" && irReq.Think.Budget == nil {
		sharedclaude.ApplyThinkingLevel(req, req.Model, irReq.Think.Level)
	}
	if req.MaxTokens != nil && *req.MaxTokens > 0 {
		return nil
	}
	if defaultMaxTokens, configured := opts.Claude.DefaultMaxTokensFor(req.Model); configured {
		value := uint(defaultMaxTokens)
		req.MaxTokens = &value
		return nil
	}
	if req.Thinking != nil {
		sharedclaude.EnsureMaxTokensForThinking(req)
		if req.MaxTokens != nil {
			return nil
		}
	}
	return sharedclaude.ErrMissingMaxTokens
}

func adaptGeminiRequest(info convmeta.Meta, irReq *ir.Request, req *dto.GeminiChatRequest) {
	opts := convmeta.OptionsOf(info)
	oai := dto.GeneralOpenAIRequest{}
	if irReq != nil {
		oai.Model = irReq.Model
		if irReq.Think != nil {
			if irReq.Think.Mode == ir.ThinkOff {
				oai.ReasoningEffort = reasoning.LevelNone
			} else {
				oai.ReasoningEffort = irReq.Think.Level
			}
		}
	}
	sharedgemini.ApplyThinkingConfig(req, info, oai)
	normalizeGeminiJSONSchema(req)
	cleanGeminiFunctionParameters(req)
	normalizeGeminiFunctionArgs(req)
	mergeAdjacentGeminiContents(req)
	if len(req.SafetySettings) == 0 {
		for _, category := range sharedgemini.SafetySettingCategories {
			threshold := opts.Gemini.SafetySettingFor(category)
			if threshold == "" {
				continue
			}
			req.SafetySettings = append(req.SafetySettings, dto.GeminiChatSafetySettings{
				Category:  category,
				Threshold: threshold,
			})
		}
	}
	if irReq != nil && opts.Gemini.SupportsImagineModel(convmeta.UpstreamModelName(info), irReq.Model) {
		req.GenerationConfig.ResponseModalities = []string{"TEXT", "IMAGE"}
	}
	attachGeminiThoughtSignatures(opts, req)
}

func normalizeGeminiJSONSchema(req *dto.GeminiChatRequest) {
	if req == nil {
		return
	}
	switch req.GenerationConfig.ResponseMimeType {
	case "json", "json_object", "json_schema", "application/json":
		req.GenerationConfig.ResponseMimeType = "application/json"
	}
	if jsonxPresent := req.GenerationConfig.ResponseJsonSchema; len(jsonxPresent) > 0 {
		var schema any
		if err := json.Unmarshal(jsonxPresent, &schema); err == nil {
			req.GenerationConfig.ResponseSchema = sharedgemini.RemoveAdditionalProperties(schema, 0)
			req.GenerationConfig.ResponseJsonSchema = nil
		}
	} else if req.GenerationConfig.ResponseSchema != nil {
		req.GenerationConfig.ResponseSchema = sharedgemini.RemoveAdditionalProperties(req.GenerationConfig.ResponseSchema, 0)
	}
}

func cleanGeminiFunctionParameters(req *dto.GeminiChatRequest) {
	if req == nil {
		return
	}
	tools := req.GetTools()
	for i := range tools {
		raw, err := json.Marshal(tools[i].FunctionDeclarations)
		if err != nil || len(raw) == 0 || string(raw) == "null" {
			continue
		}
		var decls []map[string]any
		if err := json.Unmarshal(raw, &decls); err != nil {
			continue
		}
		for _, decl := range decls {
			if params, ok := decl["parameters"].(map[string]any); ok {
				if props, hasProps := params["properties"].(map[string]any); hasProps && len(props) == 0 {
					decl["parameters"] = nil
					continue
				}
			}
			decl["parameters"] = sharedgemini.CleanFunctionParameters(decl["parameters"])
		}
		tools[i].FunctionDeclarations = decls
	}
	req.SetTools(tools)
}

func normalizeGeminiFunctionArgs(req *dto.GeminiChatRequest) {
	if req == nil {
		return
	}
	for i := range req.Contents {
		for j := range req.Contents[i].Parts {
			part := &req.Contents[i].Parts[j]
			if part.FunctionCall == nil {
				continue
			}
			s, ok := part.FunctionCall.Arguments.(string)
			if !ok {
				continue
			}
			var value any
			if err := json.Unmarshal([]byte(s), &value); err == nil {
				part.FunctionCall.Arguments = value
			}
		}
	}
}

func mergeAdjacentGeminiContents(req *dto.GeminiChatRequest) {
	if req == nil || len(req.Contents) < 2 {
		return
	}
	merged := make([]dto.GeminiChatContent, 0, len(req.Contents))
	for _, content := range req.Contents {
		if len(content.Parts) == 0 {
			continue
		}
		if n := len(merged); n > 0 && merged[n-1].Role == content.Role {
			merged[n-1].Parts = append(merged[n-1].Parts, content.Parts...)
			continue
		}
		merged = append(merged, content)
	}
	req.Contents = merged
}

func attachGeminiThoughtSignatures(opts *convmeta.Options, req *dto.GeminiChatRequest) {
	if req == nil || !sharedgemini.ShouldAttachThoughtSignature(opts) {
		return
	}
	for i := range req.Contents {
		if req.Contents[i].Role != "model" {
			continue
		}
		parts := req.Contents[i].Parts
		attached := false
		for j := range parts {
			if sharedgemini.AttachFunctionCallThoughtSignature(opts, &parts[j]) {
				attached = true
			}
		}
		if !attached {
			sharedgemini.AttachFirstTextThoughtSignature(opts, parts)
		}
		req.Contents[i].Parts = parts
	}
}

func rawPresent(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null"))
}
