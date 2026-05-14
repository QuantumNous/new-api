package agent

import "sort"

type ToolDefinition struct {
	Name              string                 `json:"name"`
	DisplayName       string                 `json:"display_name"`
	Description       string                 `json:"description"`
	Parameters        map[string]interface{} `json:"parameters"`
	NeedsConfirmation bool                   `json:"needs_confirmation"`
	RiskLevel         string                 `json:"risk_level"`
	Executor          ToolExecutor           `json:"-"`
}

type Registry struct {
	tools map[string]*ToolDefinition
}

func NewRegistry() *Registry {
	r := &Registry{tools: make(map[string]*ToolDefinition)}
	RegisterAll(r)
	return r
}

func RegisterAll(r *Registry) {
	r.RegisterTool(toolGetBalance())
	r.RegisterTool(toolListMyModels())
	r.RegisterTool(toolQueryPricing())
	r.RegisterTool(toolRecommendModel())
	r.RegisterTool(toolListMyTokens())
	r.RegisterTool(toolQueryMyLogs())
	r.RegisterTool(toolExplainError())
	r.RegisterTool(toolSearchKnowledge())
	r.RegisterTool(toolCreateToken())
	r.RegisterTool(toolDeleteToken())
	r.RegisterTool(toolTriggerTopup())
	r.RegisterTool(toolGetTopupLink())
	r.RegisterTool(toolGetDocLink())
	r.RegisterTool(toolClarify())
}

func (r *Registry) RegisterTool(tool *ToolDefinition) {
	if r == nil || tool == nil || tool.Name == "" {
		return
	}
	r.tools[tool.Name] = tool
}

func (r *Registry) GetTool(name string) (*ToolDefinition, bool) {
	if r == nil {
		return nil, false
	}
	tool, ok := r.tools[name]
	return tool, ok
}

func (r *Registry) ListTools() []*ToolDefinition {
	if r == nil {
		return nil
	}
	names := make([]string, 0, len(r.tools))
	for name := range r.tools {
		names = append(names, name)
	}
	sort.Strings(names)
	tools := make([]*ToolDefinition, 0, len(names))
	for _, name := range names {
		tools = append(tools, r.tools[name])
	}
	return tools
}
