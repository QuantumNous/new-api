package gemini

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/ir"
	"github.com/QuantumNous/new-api/relaykit/ir/internal/jsonx"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

var geminiClaimedKeys = []string{"contents", "systemInstruction", "tools", "generationConfig"}

func FromRequest(req *dto.GeminiChatRequest) (*ir.Request, error) {
	if req == nil {
		return nil, fmt.Errorf("gemini request is nil")
	}
	out := &ir.Request{
		Sample: samplingFromGemini(req.GenerationConfig),
		Think:  thinkFromGemini(req.GenerationConfig.ThinkingConfig),
		Format: formatFromGemini(req.GenerationConfig),
	}
	if req.SystemInstructions != nil {
		blocks, err := blocksFromGeminiParts(req.SystemInstructions.Parts)
		if err != nil {
			return nil, err
		}
		if len(blocks) > 0 {
			out.Messages = append(out.Messages, ir.Message{Role: ir.RoleSystem, Blocks: blocks})
		}
	}
	for _, content := range req.Contents {
		blocks, err := blocksFromGeminiParts(content.Parts)
		if err != nil {
			return nil, err
		}
		out.Messages = append(out.Messages, ir.Message{
			Role:   geminiRoleToIR(content.Role),
			Blocks: blocks,
		})
	}
	assignGeminiToolIDs(out)
	tools, err := toolsFromGemini(req)
	if err != nil {
		return nil, err
	}
	out.Tools = tools
	out.ToolChoice = toolChoiceFromGemini(req.ToolConfig)

	ext := &ir.GeminiExt{
		CachedContent: req.CachedContent,
	}
	if len(req.SafetySettings) > 0 {
		raw, err := jsonx.Marshal(req.SafetySettings)
		if err != nil {
			return nil, err
		}
		ext.SafetySettings = raw
	}
	if req.ToolConfig != nil {
		raw, err := jsonx.Marshal(req.ToolConfig)
		if err != nil {
			return nil, err
		}
		ext.ToolConfig = raw
	}
	genRaw, err := jsonx.WithoutKeys(req.GenerationConfig, "temperature", "topP", "topK", "maxOutputTokens", "candidateCount", "stopSequences", "seed", "presencePenalty", "frequencyPenalty", "thinkingConfig", "responseMimeType", "responseSchema", "responseJsonSchema")
	if err != nil {
		return nil, err
	}
	ext.Raw = jsonx.Clone(genRaw)
	topRaw, err := jsonx.WithoutKeys(req, geminiClaimedKeys...)
	if err != nil {
		return nil, err
	}
	if jsonx.Present(topRaw) {
		// keep leftover request fields beside generation leftovers
		if jsonx.Present(ext.Raw) {
			merged := map[string]json.RawMessage{}
			_ = json.Unmarshal(ext.Raw, &merged)
			var top map[string]json.RawMessage
			_ = json.Unmarshal(topRaw, &top)
			for k, v := range top {
				merged["req."+k] = v
			}
			ext.Raw, _ = json.Marshal(merged)
		} else {
			ext.Raw = topRaw
		}
	}
	if ext.CachedContent != "" || jsonx.Present(ext.SafetySettings) || jsonx.Present(ext.ToolConfig) || jsonx.Present(ext.Raw) {
		out.Extensions.Gemini = ext
	}
	return out, nil
}

func ToRequest(req *ir.Request) (*dto.GeminiChatRequest, error) {
	if req == nil {
		return nil, fmt.Errorf("ir request is nil")
	}
	out := &dto.GeminiChatRequest{
		GenerationConfig: samplingToGemini(req.Model, req.Sample, req.Think, req.Format),
	}
	var contents []dto.GeminiChatContent
	for _, message := range req.Messages {
		groups := ir.PartitionByToolResult(message.Blocks)
		if len(groups) == 0 {
			groups = [][]ir.Block{message.Blocks}
		}
		for _, group := range groups {
			parts, err := blocksToGeminiParts(group)
			if err != nil {
				return nil, err
			}
			if len(parts) == 0 {
				continue
			}
			if message.Role == ir.RoleSystem {
				out.SystemInstructions = &dto.GeminiChatContent{Parts: parts}
				continue
			}
			contents = append(contents, dto.GeminiChatContent{
				Role:  irRoleToGemini(message.Role),
				Parts: parts,
			})
		}
	}
	out.Contents = contents
	tools, err := toolsToGemini(req.Tools)
	if err != nil {
		return nil, err
	}
	if len(tools) > 0 {
		out.SetTools(tools)
	}
	if ext := req.Extensions.Gemini; ext != nil {
		out.CachedContent = ext.CachedContent
		if jsonx.Present(ext.SafetySettings) {
			if err := json.Unmarshal(ext.SafetySettings, &out.SafetySettings); err != nil {
				return nil, err
			}
		}
		if jsonx.Present(ext.ToolConfig) {
			var cfg dto.ToolConfig
			if err := json.Unmarshal(ext.ToolConfig, &cfg); err != nil {
				return nil, err
			}
			out.ToolConfig = &cfg
		}
		if jsonx.Present(ext.Raw) {
			if err := jsonx.MergeInto(&out.GenerationConfig, generationRaw(ext.Raw)); err != nil {
				return nil, err
			}
			if err := jsonx.MergeInto(out, requestRaw(ext.Raw)); err != nil {
				return nil, err
			}
		}
	}
	if req.ToolChoice != nil && out.ToolConfig == nil {
		out.ToolConfig = toolChoiceToGemini(req.ToolChoice)
	}
	return out, nil
}

func generationRaw(raw json.RawMessage) json.RawMessage {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return raw
	}
	out := map[string]json.RawMessage{}
	for k, v := range fields {
		if strings.HasPrefix(k, "req.") {
			continue
		}
		out[k] = v
	}
	if len(out) == 0 {
		return nil
	}
	b, _ := json.Marshal(out)
	return b
}

func requestRaw(raw json.RawMessage) json.RawMessage {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil
	}
	out := map[string]json.RawMessage{}
	for k, v := range fields {
		if strings.HasPrefix(k, "req.") {
			out[k[4:]] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	b, _ := json.Marshal(out)
	return b
}

func samplingFromGemini(cfg dto.GeminiChatGenerationConfig) ir.Sampling {
	sample := ir.Sampling{
		Temperature: cfg.Temperature,
		TopP:        cfg.TopP,
		Stop:        append([]string(nil), cfg.StopSequences...),
		Seed:        cfg.Seed,
		N:           cfg.CandidateCount,
	}
	if cfg.TopK != nil {
		k := int(*cfg.TopK)
		sample.TopK = &k
	}
	if cfg.MaxOutputTokens != nil {
		v := int(*cfg.MaxOutputTokens)
		sample.MaxOutputTokens = &v
	}
	if cfg.FrequencyPenalty != nil {
		v := float64(*cfg.FrequencyPenalty)
		sample.FrequencyPenalty = &v
	}
	if cfg.PresencePenalty != nil {
		v := float64(*cfg.PresencePenalty)
		sample.PresencePenalty = &v
	}
	return sample
}

func samplingToGemini(model string, sample ir.Sampling, think *ir.ThinkConfig, format *ir.ResponseFormat) dto.GeminiChatGenerationConfig {
	cfg := dto.GeminiChatGenerationConfig{
		Temperature:    sample.Temperature,
		TopP:           sample.TopP,
		StopSequences:  append([]string(nil), sample.Stop...),
		Seed:           sample.Seed,
		CandidateCount: sample.N,
		ThinkingConfig: thinkToGemini(model, think),
	}
	if sample.TopK != nil {
		k := float64(*sample.TopK)
		cfg.TopK = &k
	}
	if sample.MaxOutputTokens != nil {
		v := uint(*sample.MaxOutputTokens)
		cfg.MaxOutputTokens = &v
	}
	if sample.FrequencyPenalty != nil {
		v := float32(*sample.FrequencyPenalty)
		cfg.FrequencyPenalty = &v
	}
	if sample.PresencePenalty != nil {
		v := float32(*sample.PresencePenalty)
		cfg.PresencePenalty = &v
	}
	if format != nil {
		switch format.Type {
		case "json", "json_object", "application/json":
			cfg.ResponseMimeType = "application/json"
		default:
			cfg.ResponseMimeType = format.Type
		}
		if jsonx.Present(format.Schema) {
			cfg.ResponseJsonSchema = jsonx.Clone(format.Schema)
		}
	}
	return cfg
}

func thinkFromGemini(cfg *dto.GeminiThinkingConfig) *ir.ThinkConfig {
	if cfg == nil {
		return nil
	}
	out := &ir.ThinkConfig{
		Budget:  cfg.ThinkingBudget,
		Level:   reasoning.ParseGeminiThinkingLevel(cfg.ThinkingLevel),
		Include: boolPtr(cfg.IncludeThoughts),
		Display: ir.ThinkDisplayHidden,
	}
	if cfg.ThinkingBudget != nil && *cfg.ThinkingBudget == 0 {
		out.Mode = ir.ThinkOff
		out.Level = ""
	} else {
		out.Mode = ir.ThinkEnabled
		if cfg.ThinkingBudget != nil && *cfg.ThinkingBudget > 0 && out.Level == "" {
			// A numeric budget has no exact Chat/Responses equivalent. High is
			// the canonical semantic fallback while Budget preserves the source.
			out.Level = reasoning.LevelHigh
		}
		if cfg.IncludeThoughts {
			out.Display = ir.ThinkDisplayAuto
		}
	}
	return out
}

func thinkToGemini(model string, cfg *ir.ThinkConfig) *dto.GeminiThinkingConfig {
	if cfg == nil {
		return nil
	}
	projection := reasoning.ProjectGeminiThinking(
		model,
		cfg.Mode == ir.ThinkOff,
		cfg.Budget,
		cfg.Level,
		cfg.Include,
		string(cfg.Display),
	)
	if projection.ThinkingBudget == nil && projection.ThinkingLevel == "" && !projection.IncludeThoughts {
		return nil
	}
	return &dto.GeminiThinkingConfig{
		IncludeThoughts: projection.IncludeThoughts,
		ThinkingBudget:  projection.ThinkingBudget,
		ThinkingLevel:   projection.ThinkingLevel,
	}
}

func formatFromGemini(cfg dto.GeminiChatGenerationConfig) *ir.ResponseFormat {
	if cfg.ResponseMimeType == "" && cfg.ResponseSchema == nil && !jsonx.Present(cfg.ResponseJsonSchema) {
		return nil
	}
	out := &ir.ResponseFormat{Type: cfg.ResponseMimeType}
	if jsonx.Present(cfg.ResponseJsonSchema) {
		out.Schema = jsonx.Clone(cfg.ResponseJsonSchema)
	} else if cfg.ResponseSchema != nil {
		raw, _ := jsonx.Marshal(cfg.ResponseSchema)
		out.Schema = raw
	}
	return out
}

func toolsFromGemini(req *dto.GeminiChatRequest) ([]ir.Tool, error) {
	var out []ir.Tool
	for _, tool := range req.GetTools() {
		if tool.FunctionDeclarations != nil {
			items, ok := jsonx.AsSlice(tool.FunctionDeclarations)
			if !ok {
				items = []any{tool.FunctionDeclarations}
			}
			for _, item := range items {
				m, ok := jsonx.AsMap(item)
				if !ok {
					continue
				}
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
			}
		}
		if tool.GoogleSearch != nil || tool.GoogleSearchRetrieval != nil {
			raw, err := jsonx.Marshal(tool)
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{Kind: ir.ToolGoogleSearch, Extra: raw})
		}
		if tool.CodeExecution != nil {
			raw, err := jsonx.Marshal(tool)
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{Kind: ir.ToolCodeExecution, Extra: raw})
		}
		if tool.URLContext != nil {
			raw, err := jsonx.Marshal(tool)
			if err != nil {
				return nil, err
			}
			out = append(out, ir.Tool{Kind: ir.ToolCustom, Extra: raw})
		}
	}
	return out, nil
}

func toolsToGemini(tools []ir.Tool) ([]dto.GeminiChatTool, error) {
	if len(tools) == 0 {
		return nil, nil
	}
	var functions []any
	var out []dto.GeminiChatTool
	for _, tool := range tools {
		switch tool.Kind {
		case ir.ToolFunction:
			fn := map[string]any{}
			jsonx.PutIfNotEmpty(fn, "name", tool.Name)
			jsonx.PutIfNotEmpty(fn, "description", tool.Description)
			jsonx.PutRaw(fn, "parameters", tool.Schema)
			functions = append(functions, fn)
		case ir.ToolGoogleSearch, ir.ToolCodeExecution:
			if !jsonx.Present(tool.Extra) {
				continue
			}
			var item dto.GeminiChatTool
			if err := json.Unmarshal(tool.Extra, &item); err != nil {
				return nil, err
			}
			out = append(out, item)
		}
	}
	if len(functions) > 0 {
		out = append([]dto.GeminiChatTool{{FunctionDeclarations: functions}}, out...)
	}
	return out, nil
}

func toolChoiceFromGemini(cfg *dto.ToolConfig) *ir.ToolChoice {
	if cfg == nil || cfg.FunctionCallingConfig == nil {
		return nil
	}
	choice := &ir.ToolChoice{}
	switch cfg.FunctionCallingConfig.Mode {
	case "NONE":
		choice.Mode = ir.ToolChoiceNone
	case "ANY":
		choice.Mode = ir.ToolChoiceRequired
		if len(cfg.FunctionCallingConfig.AllowedFunctionNames) == 1 {
			choice.Mode = ir.ToolChoiceNamed
			choice.Name = cfg.FunctionCallingConfig.AllowedFunctionNames[0]
		}
	default:
		choice.Mode = ir.ToolChoiceAuto
	}
	return choice
}

func toolChoiceToGemini(choice *ir.ToolChoice) *dto.ToolConfig {
	if choice == nil {
		return nil
	}
	cfg := &dto.FunctionCallingConfig{}
	switch choice.Mode {
	case ir.ToolChoiceNone:
		cfg.Mode = "NONE"
	case ir.ToolChoiceRequired:
		cfg.Mode = "ANY"
	case ir.ToolChoiceNamed:
		cfg.Mode = "ANY"
		cfg.AllowedFunctionNames = []string{choice.Name}
	default:
		cfg.Mode = "AUTO"
	}
	return &dto.ToolConfig{FunctionCallingConfig: cfg}
}

func boolPtr(v bool) *bool { return &v }

func assignGeminiToolIDs(req *ir.Request) {
	if req == nil {
		return
	}
	n := 0
	var pending []string
	for i := range req.Messages {
		for j := range req.Messages[i].Blocks {
			block := &req.Messages[i].Blocks[j]
			if block.ToolUse != nil {
				if block.ToolUse.ID == "" {
					n++
					name := block.ToolUse.Name
					if name == "" {
						name = "tool"
					}
					block.ToolUse.ID = fmt.Sprintf("call_%s_%d", name, n)
				}
				pending = append(pending, block.ToolUse.ID)
			}
			if block.ToolResult != nil && block.ToolResult.ToolUseID == "" && len(pending) > 0 {
				block.ToolResult.ToolUseID = pending[0]
				pending = pending[1:]
			}
		}
	}
}
