package responses

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

var responsesClaimedKeys = []string{
	"model", "input", "instructions", "stream", "temperature", "top_p",
	"max_output_tokens", "tools", "tool_choice", "reasoning", "parallel_tool_calls",
}

func FromRequest(req *dto.OpenAIResponsesRequest) (*ir.Request, error) {
	if req == nil {
		return nil, fmt.Errorf("responses request is nil")
	}
	out := &ir.Request{
		Model:  req.Model,
		Sample: samplingFromResponses(req),
		Think:  thinkFromResponses(req),
	}
	if req.Stream != nil {
		out.Stream = *req.Stream
	}
	if jsonx.Present(req.Instructions) {
		text := instructionsText(req.Instructions)
		out.Messages = append(out.Messages, ir.Message{Role: ir.RoleSystem, Blocks: []ir.Block{ir.Text(text)}})
	}
	messages, err := messagesFromResponsesInput(req.Input)
	if err != nil {
		return nil, err
	}
	out.Messages = append(out.Messages, messages...)
	tools, err := toolsFromResponses(req.Tools)
	if err != nil {
		return nil, err
	}
	out.Tools = tools
	choice, err := toolChoiceFromResponses(req.ToolChoice, req.ParallelToolCalls)
	if err != nil {
		return nil, err
	}
	out.ToolChoice = choice
	out.Format = formatFromResponsesText(req.Text)

	ext := &ir.ResponsesExt{
		PreviousResponseID: req.PreviousResponseID,
		Conversation:       jsonx.Clone(req.Conversation),
		Prompt:             jsonx.Clone(req.Prompt),
		Include:            jsonx.Clone(req.Include),
		Store:              jsonx.Clone(req.Store),
		Truncation:         jsonx.Clone(req.Truncation),
		ContextManagement:  jsonx.Clone(req.ContextManagement),
	}
	raw, err := jsonx.WithoutKeys(req, append(responsesClaimedKeys, "previous_response_id", "conversation", "prompt", "include", "store", "truncation", "context_management")...)
	if err != nil {
		return nil, err
	}
	ext.Raw = raw
	if ext.PreviousResponseID != "" || jsonx.Present(ext.Conversation) || jsonx.Present(ext.Prompt) ||
		jsonx.Present(ext.Include) || jsonx.Present(ext.Store) || jsonx.Present(ext.Truncation) ||
		jsonx.Present(ext.ContextManagement) || jsonx.Present(ext.Raw) {
		out.Extensions.Responses = ext
	}
	return out, nil
}

func ToRequest(req *ir.Request) (*dto.OpenAIResponsesRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ir request is nil")
	}
	out := &dto.OpenAIResponsesRequest{Model: req.Model}
	if req.Stream {
		stream := true
		out.Stream = &stream
	}
	samplingToResponses(req.Sample, out)
	thinkToResponses(req.Think, out)
	text, err := formatToResponsesText(req.Format)
	if err != nil {
		return nil, err
	}
	out.Text = text
	if req.ToolChoice != nil && req.ToolChoice.Parallel != nil {
		raw, err := json.Marshal(*req.ToolChoice.Parallel)
		if err != nil {
			return nil, err
		}
		out.ParallelToolCalls = raw
	}
	choice, err := toolChoiceToResponses(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	out.ToolChoice = choice
	tools, err := toolsToResponses(req.Tools)
	if err != nil {
		return nil, err
	}
	out.Tools = tools

	var system []ir.Block
	var inputItems []any
	for _, message := range req.Messages {
		if message.Role == ir.RoleSystem {
			system = append(system, message.Blocks...)
			continue
		}
		items, err := messageToResponsesItems(message)
		if err != nil {
			return nil, err
		}
		inputItems = append(inputItems, items...)
	}
	if len(system) > 0 {
		if len(system) == 1 && system[0].Kind == ir.BlockKindText && system[0].Text != nil {
			raw, err := json.Marshal(system[0].Text.Text)
			if err != nil {
				return nil, err
			}
			out.Instructions = raw
		} else {
			raw, err := jsonx.Marshal(system[0].Text)
			if err != nil {
				return nil, err
			}
			out.Instructions = raw
		}
	}
	if len(inputItems) > 0 {
		raw, err := json.Marshal(inputItems)
		if err != nil {
			return nil, err
		}
		out.Input = raw
	}
	if ext := req.Extensions.Responses; ext != nil {
		out.PreviousResponseID = ext.PreviousResponseID
		out.Conversation = jsonx.Clone(ext.Conversation)
		out.Prompt = jsonx.Clone(ext.Prompt)
		out.Include = jsonx.Clone(ext.Include)
		out.Store = jsonx.Clone(ext.Store)
		out.Truncation = jsonx.Clone(ext.Truncation)
		out.ContextManagement = jsonx.Clone(ext.ContextManagement)
		if err := jsonx.MergeInto(out, ext.Raw); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func samplingFromResponses(req *dto.OpenAIResponsesRequest) ir.Sampling {
	sample := ir.Sampling{Temperature: req.Temperature, TopP: req.TopP}
	if req.MaxOutputTokens != nil {
		v := int(*req.MaxOutputTokens)
		sample.MaxOutputTokens = &v
	}
	return sample
}

func samplingToResponses(sample ir.Sampling, out *dto.OpenAIResponsesRequest) {
	out.Temperature = sample.Temperature
	out.TopP = sample.TopP
	if sample.MaxOutputTokens != nil {
		v := uint(*sample.MaxOutputTokens)
		out.MaxOutputTokens = &v
	}
}

func thinkFromResponses(req *dto.OpenAIResponsesRequest) *ir.ThinkConfig {
	if req.Reasoning == nil && !jsonx.Present(req.EnableThinking) {
		return nil
	}
	cfg := &ir.ThinkConfig{Mode: ir.ThinkEnabled}
	if req.Reasoning != nil {
		cfg.Level = reasoning.NormalizeThinkingLevel(req.Reasoning.Effort)
		if cfg.Level == reasoning.LevelNone {
			cfg.Mode = ir.ThinkOff
			cfg.Level = ""
		}
		cfg.Display = ir.ThinkDisplayMode(reasoning.NormalizeThinkDisplay(req.Reasoning.Summary))
		switch cfg.Display {
		case ir.ThinkDisplayAuto, ir.ThinkDisplayConcise, ir.ThinkDisplayDetailed:
			cfg.Include = boolPtr(true)
		case ir.ThinkDisplayHidden:
			cfg.Include = boolPtr(false)
		}
		return cfg
	}

	intent := reasoning.IntentFromChatRequest(dto.GeneralOpenAIRequest{EnableThinking: req.EnableThinking})
	if intent.Disabled {
		cfg.Mode = ir.ThinkOff
		cfg.Include = boolPtr(false)
		cfg.Display = ir.ThinkDisplayHidden
		return cfg
	}
	cfg.Level = intent.Level
	cfg.Include = boolPtr(intent.Include)
	if intent.Include {
		cfg.Display = ir.ThinkDisplayAuto
	}
	return cfg
}

func thinkToResponses(cfg *ir.ThinkConfig, out *dto.OpenAIResponsesRequest) {
	if cfg == nil {
		return
	}
	if cfg.Mode == ir.ThinkOff {
		out.Reasoning = &dto.Reasoning{Effort: reasoning.LevelNone}
		return
	}
	out.Reasoning = &dto.Reasoning{
		Effort:  reasoning.OpenAIReasoningEffort(cfg.Level),
		Summary: reasoning.ResponsesSummaryMode(string(cfg.Display)),
	}
	if out.Reasoning.Effort == "" && out.Reasoning.Summary == "" {
		out.Reasoning = nil
	}
}

func boolPtr(v bool) *bool {
	return &v
}

func instructionsText(raw json.RawMessage) string {
	if jsonx.RawJSONType(raw) == "string" {
		var s string
		_ = json.Unmarshal(raw, &s)
		return s
	}
	return string(raw)
}

func formatFromResponsesText(raw json.RawMessage) *ir.ResponseFormat {
	if !jsonx.Present(raw) {
		return nil
	}
	m, ok := jsonx.AsMap(raw)
	if !ok {
		return &ir.ResponseFormat{Schema: jsonx.Clone(raw)}
	}
	format := &ir.ResponseFormat{}
	if inner, ok := jsonx.AsMap(m["format"]); ok {
		format.Type = jsonx.MapString(inner, "type")
		format.Name = jsonx.MapString(inner, "name")
		schema, _ := jsonx.Marshal(inner["schema"])
		format.Schema = schema
	}
	if format.Type == "" && format.Name == "" && !jsonx.Present(format.Schema) {
		return nil
	}
	return format
}

func formatToResponsesText(format *ir.ResponseFormat) (json.RawMessage, error) {
	if format == nil {
		return nil, nil
	}
	inner := map[string]any{}
	jsonx.PutIfNotEmpty(inner, "type", format.Type)
	jsonx.PutIfNotEmpty(inner, "name", format.Name)
	jsonx.PutRaw(inner, "schema", format.Schema)
	return json.Marshal(map[string]any{"format": inner})
}

func toolsFromResponses(raw json.RawMessage) ([]ir.Tool, error) {
	if !jsonx.Present(raw) {
		return nil, nil
	}
	items, ok := jsonx.AsSlice(raw)
	if !ok {
		return nil, fmt.Errorf("responses tools: expected array")
	}
	out := make([]ir.Tool, 0, len(items))
	for _, item := range items {
		m, ok := jsonx.AsMap(item)
		if !ok {
			continue
		}
		full, err := jsonx.Marshal(m)
		if err != nil {
			return nil, err
		}
		typ := jsonx.MapString(m, "type")
		switch typ {
		case "", "function":
			schema, err := jsonx.Marshal(m["parameters"])
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{
				Kind:        ir.ToolFunction,
				Name:        jsonx.MapString(m, "name"),
				Description: jsonx.MapString(m, "description"),
				Schema:      schema,
			})
		case "web_search", "web_search_preview":
			out = append(out, ir.Tool{Kind: ir.ToolWebSearch, Extra: full})
		case "file_search":
			out = append(out, ir.Tool{Kind: ir.ToolFileSearch, Extra: full})
		case "code_interpreter":
			out = append(out, ir.Tool{Kind: ir.ToolCodeExecution, Extra: full})
		case "image_generation":
			out = append(out, ir.Tool{Kind: ir.ToolImageGen, Extra: full})
		case "computer", "computer_use":
			out = append(out, ir.Tool{Kind: ir.ToolComputer, Extra: full})
		default:
			out = append(out, ir.Tool{Kind: ir.ToolCustom, Extra: full})
		}
	}
	return out, nil
}

func toolsToResponses(tools []ir.Tool) (json.RawMessage, error) {
	if len(tools) == 0 {
		return nil, nil
	}
	items := make([]any, 0, len(tools))
	for _, tool := range tools {
		if jsonx.Present(tool.Extra) && tool.Kind != ir.ToolFunction {
			var v any
			if err := json.Unmarshal(tool.Extra, &v); err != nil {
				return nil, err
			}
			items = append(items, v)
			continue
		}
		item := map[string]any{"type": "function"}
		jsonx.PutIfNotEmpty(item, "name", tool.Name)
		jsonx.PutIfNotEmpty(item, "description", tool.Description)
		jsonx.PutRaw(item, "parameters", tool.Schema)
		items = append(items, item)
	}
	return json.Marshal(items)
}

func toolChoiceFromResponses(raw json.RawMessage, parallel json.RawMessage) (*ir.ToolChoice, error) {
	var parallelPtr *bool
	if jsonx.Present(parallel) && jsonx.RawJSONType(parallel) == "boolean" {
		var v bool
		if err := json.Unmarshal(parallel, &v); err == nil {
			parallelPtr = &v
		}
	}
	if !jsonx.Present(raw) {
		if parallelPtr == nil {
			return nil, nil
		}
		return &ir.ToolChoice{Mode: ir.ToolChoiceAuto, Parallel: parallelPtr}, nil
	}
	if jsonx.RawJSONType(raw) == "string" {
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, err
		}
		choice := &ir.ToolChoice{Parallel: parallelPtr}
		switch s {
		case "required":
			choice.Mode = ir.ToolChoiceRequired
		case "none":
			choice.Mode = ir.ToolChoiceNone
		default:
			choice.Mode = ir.ToolChoiceAuto
		}
		return choice, nil
	}
	m, ok := jsonx.AsMap(raw)
	if !ok {
		return nil, nil
	}
	choice := &ir.ToolChoice{Parallel: parallelPtr, Name: jsonx.MapString(m, "name")}
	switch jsonx.MapString(m, "type") {
	case "required":
		choice.Mode = ir.ToolChoiceRequired
	case "none":
		choice.Mode = ir.ToolChoiceNone
	case "function":
		choice.Mode = ir.ToolChoiceNamed
		if fn, ok := jsonx.AsMap(m["function"]); ok {
			choice.Name = jsonx.MapString(fn, "name")
		}
	default:
		choice.Mode = ir.ToolChoiceAuto
	}
	return choice, nil
}

func toolChoiceToResponses(choice *ir.ToolChoice) (json.RawMessage, error) {
	if choice == nil {
		return nil, nil
	}
	switch choice.Mode {
	case ir.ToolChoiceRequired:
		return json.Marshal("required")
	case ir.ToolChoiceNone:
		return json.Marshal("none")
	case ir.ToolChoiceNamed:
		return json.Marshal(map[string]any{
			"type":     "function",
			"function": map[string]any{"name": choice.Name},
		})
	default:
		return json.Marshal("auto")
	}
}
