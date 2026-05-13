package controller

import (
	"github.com/gin-gonic/gin"
)

// AgentChat 处理 POST /api/agent/chat 请求
// 接收用户消息，调用Agent服务，返回SSE流式响应
func AgentChat(c *gin.Context) {
	// TODO: 后续实现
	// 1. 解析请求体
	// 2. 调用 service/agent/orchestrator
	// 3. 流式返回结果（SSE）
	c.JSON(200, gin.H{"message": "Agent service not implemented yet"})
}
