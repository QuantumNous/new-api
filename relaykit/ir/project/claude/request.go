package claude

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
)

func FromRequest(req *dto.ClaudeRequest) (*ir.Request, error) {
	if req == nil {
		return nil, fmt.Errorf("claude request is nil")
	}

	out := &ir.Request{
		Model:  req.Model,
		Sample: samplingFromClaude(req),
	}
	if req.Stream != nil {
		out.Stream = *req.Stream
	}

	systemBlocks, err := systemFromClaude(req.System)
	if err != nil {
		return nil, err
	}
	if len(systemBlocks) > 0 {
		out.Messages = append(out.Messages, ir.Message{Role: ir.RoleSystem, Blocks: systemBlocks})
	}

	for _, message := range req.Messages {
		blocks, err := blocksFromClaudeContent(message.Content)
		if err != nil {
			return nil, err
		}
		out.Messages = append(out.Messages, ir.Message{
			Role:   ir.Role(message.Role),
			Blocks: blocks,
		})
	}

	tools, err := toolsFromClaude(req.Tools)
	if err != nil {
		return nil, err
	}
	out.Tools = tools

	choice, err := toolChoiceFromClaude(req.ToolChoice)
	if err != nil {
		return nil, err
	}
	out.ToolChoice = choice
	out.Think = thinkFromClaude(req)

	ext, err := claudeExtFromRequest(req)
	if err != nil {
		return nil, err
	}
	if ext != nil {
		out.Extensions.Claude = ext
	}
	return out, nil
}

func ToRequest(req *ir.Request) (*dto.ClaudeRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ir request is nil")
	}

	out := &dto.ClaudeRequest{
		Model: req.Model,
	}
	if req.Stream {
		stream := true
		out.Stream = &stream
	}
	samplingToClaude(req.Sample, out)
	thinkToClaude(req.Think, req.Extensions.Claude, out)

	var systemBlocks []ir.Block
	messages := make([]dto.ClaudeMessage, 0, len(req.Messages))
	for _, message := range req.Messages {
		if message.Role == ir.RoleSystem {
			systemBlocks = append(systemBlocks, message.Blocks...)
			continue
		}
		content, err := blocksToClaudeContent(message.Blocks)
		if err != nil {
			return nil, err
		}
		role := string(message.Role)
		if message.Role == ir.RoleTool {
			role = "user"
		}
		messages = append(messages, dto.ClaudeMessage{
			Role:    role,
			Content: content,
		})
	}
	system, err := systemToClaude(systemBlocks)
	if err != nil {
		return nil, err
	}
	out.System = system
	out.Messages = messages

	tools, err := toolsToClaude(req.Tools)
	if err != nil {
		return nil, err
	}
	out.Tools = tools
	out.ToolChoice = toolChoiceToClaude(req.ToolChoice)
	applyClaudeExt(out, req.Extensions.Claude)
	return out, nil
}

func samplingFromClaude(req *dto.ClaudeRequest) ir.Sampling {
	sample := ir.Sampling{
		Temperature: req.Temperature,
		TopP:        req.TopP,
		TopK:        req.TopK,
		Stop:        append([]string(nil), req.StopSequences...),
	}
	if req.MaxTokens != nil {
		value := int(*req.MaxTokens)
		sample.MaxOutputTokens = &value
	}
	return sample
}

func samplingToClaude(sample ir.Sampling, out *dto.ClaudeRequest) {
	out.Temperature = sample.Temperature
	out.TopP = sample.TopP
	out.TopK = sample.TopK
	if len(sample.Stop) > 0 {
		out.StopSequences = append([]string(nil), sample.Stop...)
	}
	if sample.MaxOutputTokens != nil {
		value := uint(*sample.MaxOutputTokens)
		out.MaxTokens = &value
	}
}

func thinkFromClaude(req *dto.ClaudeRequest) *ir.ThinkConfig {
	var cfg *ir.ThinkConfig
	ensure := func() *ir.ThinkConfig {
		if cfg == nil {
			cfg = &ir.ThinkConfig{}
		}
		return cfg
	}
	if req.Thinking != nil {
		cfg = ensure()
		cfg.Display = req.Thinking.Display
		cfg.Budget = req.Thinking.BudgetTokens
		switch strings.ToLower(strings.TrimSpace(req.Thinking.Type)) {
		case "disabled", "none":
			cfg.Mode = ir.ThinkOff
		case "adaptive":
			cfg.Mode = ir.ThinkAuto
		case "enabled":
			cfg.Mode = ir.ThinkEnabled
		default:
			if req.Thinking.Type != "" {
				cfg.Mode = ir.ThinkEnabled
			}
		}
	}
	if effort := req.GetEfforts(); effort != "" {
		cfg = ensure()
		cfg.Level = effort
	}
	return cfg
}

func thinkToClaude(cfg *ir.ThinkConfig, ext *ir.ClaudeExt, out *dto.ClaudeRequest) {
	if ext != nil && rawPresent(ext.OutputConfig) {
		out.OutputConfig = cloneRaw(ext.OutputConfig)
	} else if cfg != nil && cfg.Level != "" {
		raw, err := json.Marshal(map[string]string{"effort": cfg.Level})
		if err == nil {
			out.OutputConfig = raw
		}
	}
	if cfg == nil {
		return
	}
	thinking := &dto.Thinking{
		Display:      cfg.Display,
		BudgetTokens: cfg.Budget,
	}
	switch cfg.Mode {
	case ir.ThinkOff:
		thinking.Type = "disabled"
	case ir.ThinkAuto:
		thinking.Type = "adaptive"
	case ir.ThinkEnabled:
		thinking.Type = "enabled"
	}
	if thinking.Type != "" || thinking.BudgetTokens != nil || thinking.Display != "" {
		out.Thinking = thinking
	}
}

func claudeExtFromRequest(req *dto.ClaudeRequest) (*ir.ClaudeExt, error) {
	ext := &ir.ClaudeExt{
		CacheControl:      cloneRaw(req.CacheControl),
		InferenceGeo:      req.InferenceGeo,
		Speed:             cloneRaw(req.Speed),
		MCPServers:        cloneRaw(req.McpServers),
		Container:         cloneRaw(req.Container),
		OutputConfig:      cloneRaw(req.OutputConfig),
		OutputFormat:      cloneRaw(req.OutputFormat),
		ContextManagement: cloneRaw(req.ContextManagement),
		Metadata:          cloneRaw(req.Metadata),
		ServiceTier:       req.ServiceTier,
		Prompt:            req.Prompt,
		MaxTokensToSample: req.MaxTokensToSample,
	}
	if ext.CacheControl == nil &&
		ext.InferenceGeo == "" &&
		ext.Speed == nil &&
		ext.MCPServers == nil &&
		ext.Container == nil &&
		ext.OutputConfig == nil &&
		ext.OutputFormat == nil &&
		ext.ContextManagement == nil &&
		ext.Metadata == nil &&
		ext.ServiceTier == "" &&
		ext.Prompt == "" &&
		ext.MaxTokensToSample == nil {
		return nil, nil
	}
	return ext, nil
}

func applyClaudeExt(out *dto.ClaudeRequest, ext *ir.ClaudeExt) {
	if ext == nil {
		return
	}
	if rawPresent(ext.CacheControl) {
		out.CacheControl = cloneRaw(ext.CacheControl)
	}
	out.InferenceGeo = ext.InferenceGeo
	out.Speed = cloneRaw(ext.Speed)
	out.McpServers = cloneRaw(ext.MCPServers)
	out.Container = cloneRaw(ext.Container)
	if rawPresent(ext.OutputConfig) {
		out.OutputConfig = cloneRaw(ext.OutputConfig)
	}
	out.OutputFormat = cloneRaw(ext.OutputFormat)
	out.ContextManagement = cloneRaw(ext.ContextManagement)
	out.Metadata = cloneRaw(ext.Metadata)
	out.ServiceTier = ext.ServiceTier
	out.Prompt = ext.Prompt
	out.MaxTokensToSample = ext.MaxTokensToSample
}

func toolsFromClaude(tools any) ([]ir.Tool, error) {
	if tools == nil {
		return nil, nil
	}
	items, ok := asSlice(tools)
	if !ok {
		return nil, fmt.Errorf("claude tools: expected array, got %T", tools)
	}
	out := make([]ir.Tool, 0, len(items))
	for _, item := range items {
		m, ok := asMap(item)
		if !ok {
			raw, err := marshalRaw(item)
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{Kind: ir.ToolCustom, Extra: raw})
			continue
		}
		tool, err := toolFromClaudeMap(m)
		if err != nil {
			return nil, err
		}
		out = append(out, tool)
	}
	return out, nil
}

func toolFromClaudeMap(m map[string]any) (ir.Tool, error) {
	raw, err := marshalRaw(m)
	if err != nil {
		return ir.Tool{}, err
	}
	if looksLikeWebSearchTool(m) {
		return ir.Tool{
			Kind:  ir.ToolWebSearch,
			Name:  mapString(m, "name"),
			Extra: raw,
		}, nil
	}
	if _, hasSchema := m["input_schema"]; hasSchema || mapString(m, "name") != "" && mapString(m, "type") == "" {
		schema, err := marshalRaw(m["input_schema"])
		if err != nil {
			return ir.Tool{}, err
		}
		return ir.Tool{
			Kind:         ir.ToolFunction,
			Name:         mapString(m, "name"),
			Description:  mapString(m, "description"),
			Schema:       schema,
			CacheControl: cacheControlFromAny(m["cache_control"]),
			Extra:        functionToolExtra(m),
		}, nil
	}
	return ir.Tool{Kind: ir.ToolCustom, Name: mapString(m, "name"), Extra: raw}, nil
}

func functionToolExtra(m map[string]any) json.RawMessage {
	extra := map[string]any{}
	for key, value := range m {
		switch key {
		case "name", "description", "input_schema", "cache_control":
			continue
		default:
			extra[key] = value
		}
	}
	if len(extra) == 0 {
		return nil
	}
	raw, err := marshalRaw(extra)
	if err != nil {
		return nil
	}
	return raw
}

func toolsToClaude(tools []ir.Tool) (any, error) {
	if len(tools) == 0 {
		return nil, nil
	}
	out := make([]any, 0, len(tools))
	for _, tool := range tools {
		item, err := toolToClaudeValue(tool)
		if err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, nil
}

func toolToClaudeValue(tool ir.Tool) (any, error) {
	switch tool.Kind {
	case ir.ToolWebSearch:
		return webSearchToolToClaude(tool)
	case ir.ToolFunction:
		m := map[string]any{}
		putIfNotEmpty(m, "name", tool.Name)
		putIfNotEmpty(m, "description", tool.Description)
		putRaw(m, "input_schema", tool.Schema)
		if cc := cacheControlToMap(tool.CacheControl); cc != nil {
			m["cache_control"] = cc
		}
		if rawPresent(tool.Extra) {
			var extra map[string]any
			if err := json.Unmarshal(tool.Extra, &extra); err == nil {
				for key, value := range extra {
					if _, exists := m[key]; !exists {
						m[key] = value
					}
				}
			}
		}
		return m, nil
	default:
		if rawPresent(tool.Extra) {
			var v any
			if err := json.Unmarshal(tool.Extra, &v); err != nil {
				return nil, err
			}
			return v, nil
		}
		m := map[string]any{}
		putIfNotEmpty(m, "name", tool.Name)
		putIfNotEmpty(m, "description", tool.Description)
		return m, nil
	}
}

const (
	webSearchMaxUsesLow    = 1
	webSearchMaxUsesMedium = 5
	webSearchMaxUsesHigh   = 10
)

func webSearchToolToClaude(tool ir.Tool) (any, error) {
	if !rawPresent(tool.Extra) {
		m := map[string]any{"type": "web_search_20250305"}
		putIfNotEmpty(m, "name", tool.Name)
		return m, nil
	}
	var extra map[string]any
	if err := json.Unmarshal(tool.Extra, &extra); err != nil {
		return nil, err
	}
	switch mapString(extra, "type") {
	case "web_search_options":
		m := map[string]any{"type": "web_search_20250305", "name": "web_search"}
		switch mapString(extra, "search_context_size") {
		case "low":
			m["max_uses"] = webSearchMaxUsesLow
		case "medium":
			m["max_uses"] = webSearchMaxUsesMedium
		case "high":
			m["max_uses"] = webSearchMaxUsesHigh
		}
		if loc, ok := extra["user_location"]; ok && loc != nil {
			m["user_location"] = claudeUserLocationFromChat(loc)
		}
		return m, nil
	default:
		return extra, nil
	}
}

func claudeUserLocationFromChat(loc any) any {
	m, ok := asMap(loc)
	if !ok {
		return loc
	}
	out := map[string]any{"type": "approximate"}
	source := m
	if nested, ok := asMap(m["approximate"]); ok {
		source = nested
	}
	for _, key := range []string{"timezone", "country", "region", "city"} {
		putIfNotEmpty(out, key, mapString(source, key))
	}
	return out
}

func toolChoiceFromClaude(v any) (*ir.ToolChoice, error) {
	if v == nil {
		return nil, nil
	}
	if s, ok := v.(string); ok {
		switch strings.ToLower(s) {
		case "auto":
			return &ir.ToolChoice{Mode: ir.ToolChoiceAuto}, nil
		case "any", "required":
			return &ir.ToolChoice{Mode: ir.ToolChoiceRequired}, nil
		case "none":
			return &ir.ToolChoice{Mode: ir.ToolChoiceNone}, nil
		default:
			return &ir.ToolChoice{Mode: ir.ToolChoiceNamed, Name: s}, nil
		}
	}
	m, ok := asMap(v)
	if !ok {
		return nil, fmt.Errorf("claude tool_choice: unsupported type %T", v)
	}
	choice := &ir.ToolChoice{Name: mapString(m, "name")}
	switch mapString(m, "type") {
	case "auto":
		choice.Mode = ir.ToolChoiceAuto
	case "any":
		choice.Mode = ir.ToolChoiceRequired
	case "none":
		choice.Mode = ir.ToolChoiceNone
	case "tool":
		choice.Mode = ir.ToolChoiceNamed
	default:
		if choice.Name != "" {
			choice.Mode = ir.ToolChoiceNamed
		} else {
			choice.Mode = ir.ToolChoiceAuto
		}
	}
	if disable, ok := mapBool(m, "disable_parallel_tool_use"); ok {
		parallel := !disable
		choice.Parallel = &parallel
	}
	return choice, nil
}

func toolChoiceToClaude(choice *ir.ToolChoice) any {
	if choice == nil {
		return nil
	}
	m := map[string]any{}
	switch choice.Mode {
	case ir.ToolChoiceRequired:
		m["type"] = "any"
	case ir.ToolChoiceNone:
		m["type"] = "none"
	case ir.ToolChoiceNamed:
		m["type"] = "tool"
		putIfNotEmpty(m, "name", choice.Name)
	default:
		m["type"] = "auto"
	}
	if choice.Parallel != nil {
		m["disable_parallel_tool_use"] = !*choice.Parallel
	}
	return m
}
