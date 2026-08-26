package chat

import (
	"encoding/json"
	"fmt"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

var chatClaimedKeys = []string{
	"model", "messages", "stream", "temperature", "top_p", "top_k", "n", "stop",
	"seed", "max_completion_tokens", "frequency_penalty", "presence_penalty",
	"tools", "tool_choice", "reasoning_effort", "response_format", "parallel_tool_calls",
	"web_search_options",
}

func FromRequest(req *dto.GeneralOpenAIRequest) (*ir.Request, error) {
	if req == nil {
		return nil, fmt.Errorf("chat request is nil")
	}
	out := &ir.Request{
		Model:  req.Model,
		Sample: samplingFromChat(req),
	}
	if req.Stream != nil {
		out.Stream = *req.Stream
	}
	for _, message := range req.Messages {
		blocks, err := blocksFromChatMessage(message)
		if err != nil {
			return nil, err
		}
		irMsg := ir.Message{
			Role:   ir.Role(message.Role),
			Blocks: blocks,
		}
		if message.Name != nil {
			irMsg.Name = *message.Name
		}
		extra, err := messageExtraFromChat(message)
		if err != nil {
			return nil, err
		}
		irMsg.Extra = extra
		out.Messages = append(out.Messages, irMsg)
	}
	tools, err := toolsFromChat(req.Tools)
	if err != nil {
		return nil, err
	}
	if req.WebSearchOptions != nil {
		searchTool, err := webSearchToolFromChat(req.WebSearchOptions)
		if err != nil {
			return nil, err
		}
		tools = append(tools, searchTool)
	}
	out.Tools = tools
	choice, err := toolChoiceFromChat(req.ToolChoice, req.ParallelTooCalls)
	if err != nil {
		return nil, err
	}
	out.ToolChoice = choice
	out.Think = thinkFromChat(*req)
	out.Format = formatFromChat(req.ResponseFormat)
	raw, err := jsonx.WithoutKeys(req, chatClaimedKeys...)
	if err != nil {
		return nil, err
	}
	if jsonx.Present(raw) {
		out.Extensions.Chat = &ir.ChatExt{Raw: raw}
	}
	return out, nil
}

func ToRequest(req *ir.Request) (*dto.GeneralOpenAIRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ir request is nil")
	}
	out := &dto.GeneralOpenAIRequest{Model: req.Model}
	if req.Stream {
		stream := true
		out.Stream = &stream
	}
	samplingToChat(req.Sample, out)
	thinkToChat(req.Think, out)
	out.ResponseFormat = formatToChat(req.Format)
	if req.ToolChoice != nil && req.ToolChoice.Parallel != nil {
		out.ParallelTooCalls = req.ToolChoice.Parallel
	}
	choice, err := toolChoiceToChat(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	out.ToolChoice = choice
	tools, search, err := toolsToChat(req.Tools)
	if err != nil {
		return nil, err
	}
	out.Tools = tools
	out.WebSearchOptions = search
	for _, message := range req.Messages {
		chatMsgs, err := blocksToChatMessages(message)
		if err != nil {
			return nil, err
		}
		out.Messages = append(out.Messages, chatMsgs...)
	}
	if req.Extensions.Chat != nil {
		if err := jsonx.MergeInto(out, req.Extensions.Chat.Raw); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func samplingFromChat(req *dto.GeneralOpenAIRequest) ir.Sampling {
	sample := ir.Sampling{
		Temperature:      req.Temperature,
		TopP:             req.TopP,
		TopK:             req.TopK,
		N:                req.N,
		FrequencyPenalty: req.FrequencyPenalty,
		PresencePenalty:  req.PresencePenalty,
	}
	if maxTokens := req.GetMaxTokens(); maxTokens > 0 {
		value := int(maxTokens)
		sample.MaxOutputTokens = &value
	}
	if req.Seed != nil {
		seed := int64(*req.Seed)
		sample.Seed = &seed
	}
	switch stop := req.Stop.(type) {
	case string:
		if stop != "" {
			sample.Stop = []string{stop}
		}
	default:
		if items, ok := jsonx.AsSlice(req.Stop); ok {
			for _, item := range items {
				if s := jsonx.AsString(item); s != "" {
					sample.Stop = append(sample.Stop, s)
				}
			}
		}
	}
	return sample
}

func samplingToChat(sample ir.Sampling, out *dto.GeneralOpenAIRequest) {
	out.Temperature = sample.Temperature
	out.TopP = sample.TopP
	out.TopK = sample.TopK
	out.N = sample.N
	out.FrequencyPenalty = sample.FrequencyPenalty
	out.PresencePenalty = sample.PresencePenalty
	if sample.MaxOutputTokens != nil {
		value := uint(*sample.MaxOutputTokens)
		out.MaxCompletionTokens = &value
	}
	if sample.Seed != nil {
		seed := float64(*sample.Seed)
		out.Seed = &seed
	}
	switch len(sample.Stop) {
	case 0:
	case 1:
		out.Stop = sample.Stop[0]
	default:
		out.Stop = append([]string(nil), sample.Stop...)
	}
}

func thinkFromChat(req dto.GeneralOpenAIRequest) *ir.ThinkConfig {
	intent := reasoning.IntentFromChatRequest(req)
	if !intent.Disabled && intent.Level == "" && !intent.Include {
		return nil
	}
	cfg := &ir.ThinkConfig{Level: intent.Level, Include: boolPtr(intent.Include)}
	if intent.Disabled {
		cfg.Mode = ir.ThinkOff
		return cfg
	}
	cfg.Mode = ir.ThinkEnabled
	if intent.Include {
		cfg.Display = "auto"
	}
	return cfg
}

func thinkToChat(cfg *ir.ThinkConfig, out *dto.GeneralOpenAIRequest) {
	if cfg == nil {
		return
	}
	if cfg.Mode == ir.ThinkOff {
		out.ReasoningEffort = "none"
		return
	}
	if cfg.Level != "" {
		out.ReasoningEffort = cfg.Level
	}
}

func formatFromChat(format *dto.ResponseFormat) *ir.ResponseFormat {
	if format == nil {
		return nil
	}
	out := &ir.ResponseFormat{Type: format.Type}
	if jsonx.Present(format.JsonSchema) {
		out.Schema = jsonx.Clone(format.JsonSchema)
	}
	return out
}

func formatToChat(format *ir.ResponseFormat) *dto.ResponseFormat {
	if format == nil {
		return nil
	}
	return &dto.ResponseFormat{Type: format.Type, JsonSchema: jsonx.Clone(format.Schema)}
}

func toolsFromChat(tools []dto.ToolCallRequest) ([]ir.Tool, error) {
	if len(tools) == 0 {
		return nil, nil
	}
	out := make([]ir.Tool, 0, len(tools))
	for _, tool := range tools {
		raw, err := jsonx.Marshal(tool)
		if err != nil {
			return nil, err
		}
		switch tool.Type {
		case "", "function":
			schema, err := jsonx.Marshal(tool.Function.Parameters)
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{
				Kind:        ir.ToolFunction,
				Name:        tool.Function.Name,
				Description: tool.Function.Description,
				Schema:      schema,
			})
		case "web_search", "web_search_preview":
			out = append(out, ir.Tool{Kind: ir.ToolWebSearch, Name: tool.Function.Name, Extra: raw})
		default:
			out = append(out, ir.Tool{Kind: ir.ToolCustom, Name: tool.Function.Name, Extra: raw})
		}
	}
	return out, nil
}

func webSearchToolFromChat(opts *dto.WebSearchOptions) (ir.Tool, error) {
	extra, err := jsonx.Marshal(map[string]any{
		"type":                "web_search_options",
		"search_context_size": opts.SearchContextSize,
		"user_location":       opts.UserLocation,
	})
	if err != nil {
		return ir.Tool{}, err
	}
	return ir.Tool{Kind: ir.ToolWebSearch, Name: "web_search", Extra: extra}, nil
}

func toolsToChat(tools []ir.Tool) ([]dto.ToolCallRequest, *dto.WebSearchOptions, error) {
	if len(tools) == 0 {
		return nil, nil, nil
	}
	out := make([]dto.ToolCallRequest, 0, len(tools))
	var search *dto.WebSearchOptions
	for _, tool := range tools {
		if tool.Kind == ir.ToolWebSearch {
			opts, ok, err := webSearchOptionsFromTool(tool)
			if err != nil {
				return nil, nil, err
			}
			if ok {
				search = opts
				continue
			}
		}
		if jsonx.Present(tool.Extra) && tool.Kind != ir.ToolFunction {
			var item dto.ToolCallRequest
			if err := json.Unmarshal(tool.Extra, &item); err != nil {
				return nil, nil, err
			}
			out = append(out, item)
			continue
		}
		item := dto.ToolCallRequest{Type: "function"}
		item.Function.Name = tool.Name
		item.Function.Description = tool.Description
		if jsonx.Present(tool.Schema) {
			var parameters any
			if err := json.Unmarshal(tool.Schema, &parameters); err != nil {
				return nil, nil, err
			}
			item.Function.Parameters = parameters
		}
		out = append(out, item)
	}
	return out, search, nil
}

func webSearchOptionsFromTool(tool ir.Tool) (*dto.WebSearchOptions, bool, error) {
	if !jsonx.Present(tool.Extra) {
		return &dto.WebSearchOptions{}, true, nil
	}
	m, ok := jsonx.AsMap(tool.Extra)
	if !ok {
		var parsed map[string]any
		if err := json.Unmarshal(tool.Extra, &parsed); err != nil {
			return nil, false, err
		}
		m = parsed
	}
	if jsonx.MapString(m, "type") != "web_search_options" {
		return nil, false, nil
	}
	opts := &dto.WebSearchOptions{SearchContextSize: jsonx.MapString(m, "search_context_size")}
	if loc := m["user_location"]; loc != nil {
		raw, err := jsonx.Marshal(loc)
		if err != nil {
			return nil, false, err
		}
		opts.UserLocation = raw
	}
	return opts, true, nil
}

func toolChoiceFromChat(v any, parallel *bool) (*ir.ToolChoice, error) {
	if v == nil && parallel == nil {
		return nil, nil
	}
	choice := &ir.ToolChoice{Mode: ir.ToolChoiceAuto, Parallel: parallel}
	if v == nil {
		return choice, nil
	}
	if s, ok := v.(string); ok {
		switch s {
		case "auto":
			choice.Mode = ir.ToolChoiceAuto
		case "required":
			choice.Mode = ir.ToolChoiceRequired
		case "none":
			choice.Mode = ir.ToolChoiceNone
		default:
			choice.Mode = ir.ToolChoiceNamed
			choice.Name = s
		}
		return choice, nil
	}
	m, ok := jsonx.AsMap(v)
	if !ok {
		return nil, fmt.Errorf("chat tool_choice: unsupported type %T", v)
	}
	switch jsonx.MapString(m, "type") {
	case "auto":
		choice.Mode = ir.ToolChoiceAuto
	case "required":
		choice.Mode = ir.ToolChoiceRequired
	case "none":
		choice.Mode = ir.ToolChoiceNone
	case "function":
		choice.Mode = ir.ToolChoiceNamed
		if fn, ok := jsonx.AsMap(m["function"]); ok {
			choice.Name = jsonx.MapString(fn, "name")
		}
	}
	return choice, nil
}

func toolChoiceToChat(choice *ir.ToolChoice) (any, error) {
	if choice == nil {
		return nil, nil
	}
	switch choice.Mode {
	case ir.ToolChoiceRequired:
		return "required", nil
	case ir.ToolChoiceNone:
		return "none", nil
	case ir.ToolChoiceNamed:
		return map[string]any{
			"type":     "function",
			"function": map[string]any{"name": choice.Name},
		}, nil
	default:
		if choice.Parallel != nil {
			return "auto", nil
		}
		return "auto", nil
	}
}

func boolPtr(v bool) *bool { return &v }
