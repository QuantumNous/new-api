package agent

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

type ToolExecutor func(ctx context.Context, userId int, args map[string]interface{}) (ToolResult, error)

type ToolResult struct {
	OK          bool        `json:"ok"`
	Data        interface{} `json:"data,omitempty"`
	Display     interface{} `json:"display,omitempty"`
	UserMessage string      `json:"user_message,omitempty"`
}

type PendingConfirmation struct {
	Token     string
	UserId    int
	SessionId int
	ToolName  string
	Args      map[string]interface{}
	ExpiresAt time.Time
}

type RunOptions struct {
	Stream       bool
	SystemPrompt string
}

type Orchestrator struct {
	registry *Registry
	maxSteps int
}

type SessionWithMessages struct {
	Session  *model.AgentSession
	Messages []model.AgentMessage
}

type Event = dto.AgentEvent
