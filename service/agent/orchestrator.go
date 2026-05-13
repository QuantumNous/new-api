package agent

import (
	"context"
)

// Orchestrator 负责 Agent 的核心编排循环（ReAct 模式）
// 调用 LLM -> 解析 tool_calls -> 执行工具 -> 塞回结果 -> 再调 LLM
type Orchestrator struct {
	// TODO: 后续补全字段
}

// NewOrchestrator 创建编排器实例
func NewOrchestrator() *Orchestrator {
	return &Orchestrator{}
}

// RunConversationTurn 执行一轮对话
// ctx: 上下文
// userId: 用户ID
// userMessage: 用户消息
// 返回: Agent回复内容和错误
func (o *Orchestrator) RunConversationTurn(ctx context.Context, userId int, userMessage string) (string, error) {
	// TODO: 后续实现
	return "", nil
}
