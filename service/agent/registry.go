package agent

// ToolDefinition 工具定义
type ToolDefinition struct {
	Name              string                 // 工具名称
	Description       string                 // 工具描述
	Parameters        map[string]interface{} // JSON Schema参数定义
	NeedsConfirmation bool                   // 是否需要二次确认
	Executor          ToolExecutor           // 执行器函数
}

// ToolExecutor 工具执行器函数类型
type ToolExecutor func(userId int, args map[string]interface{}) (interface{}, error)

// Registry 工具注册表，管理所有可用工具的JSON schema和执行器
type Registry struct {
	tools map[string]*ToolDefinition
}

// NewRegistry 创建工具注册表实例
func NewRegistry() *Registry {
	return &Registry{
		tools: make(map[string]*ToolDefinition),
	}
}

// RegisterTool 注册一个工具
func (r *Registry) RegisterTool(tool *ToolDefinition) {
	// TODO: 后续实现
}

// GetTool 获取工具定义
func (r *Registry) GetTool(name string) (*ToolDefinition, bool) {
	// TODO: 后续实现
	return nil, false
}
