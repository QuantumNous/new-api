package agent

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/agent_setting"
)

func NewOrchestrator() *Orchestrator {
	return &Orchestrator{
		registry: NewRegistry(),
		maxSteps: agent_setting.GetAgentSetting().ReactMaxStepsPerTurn,
	}
}

func (o *Orchestrator) RunConversationTurn(ctx context.Context, userId int, userMessage string) (string, error) {
	events, err := o.RunStream(ctx, userId, 0, userMessage, RunOptions{})
	if err != nil {
		return "", err
	}
	var b strings.Builder
	for event := range events {
		if event.Type == constant.AgentEventTextDelta || event.Type == constant.AgentEventDone {
			b.WriteString(event.Delta)
			b.WriteString(event.Message)
		}
	}
	return strings.TrimSpace(b.String()), nil
}

func (o *Orchestrator) RunStream(ctx context.Context, userId int, sessionId int, userMessage string, opt RunOptions) (<-chan dto.AgentEvent, error) {
	if err := GuardIn(ctx, userId); err != nil {
		return nil, err
	}
	session, err := LoadOrCreateSession(ctx, userId, sessionId, userMessage)
	if err != nil {
		return nil, err
	}
	if err := AppendMessage(ctx, userId, session.Id, constant.AgentRoleUser, userMessage, "", ""); err != nil {
		return nil, err
	}
	events := make(chan dto.AgentEvent, 16)
	go func() {
		defer close(events)
		toolName, args := o.planTool(userMessage)
		if toolName == "" {
			reply := "I can help you check balance, list models, review API keys and logs, search help content, create or delete keys after confirmation, and prepare guarded top-up actions."
			_ = AppendMessage(ctx, userId, session.Id, constant.AgentRoleAssistant, reply, "", "")
			events <- dto.AgentEvent{Type: constant.AgentEventTextDelta, SessionId: session.Id, Delta: reply}
			events <- dto.AgentEvent{Type: constant.AgentEventDone, SessionId: session.Id, Done: true}
			return
		}
		tool, ok := o.registry.GetTool(toolName)
		if !ok {
			reply := "This assistant does not have that tool enabled."
			_ = AppendMessage(ctx, userId, session.Id, constant.AgentRoleAssistant, reply, "", "")
			events <- dto.AgentEvent{Type: constant.AgentEventError, SessionId: session.Id, Message: reply}
			return
		}
		if !IsToolEnabled(ctx, tool.Name) {
			reply := "This tool is currently disabled by an administrator."
			_ = AppendMessage(ctx, userId, session.Id, constant.AgentRoleAssistant, reply, "", "")
			events <- dto.AgentEvent{Type: constant.AgentEventError, SessionId: session.Id, ToolName: tool.Name, Message: reply}
			return
		}
		events <- dto.AgentEvent{Type: constant.AgentEventToolCallStart, SessionId: session.Id, ToolName: tool.Name, Message: tool.DisplayName}
		if tool.NeedsConfirmation {
			pending := CreateConfirmation(userId, session.Id, tool.Name, args)
			_ = model.DB.WithContext(ctx).Model(&model.AgentSession{}).Where("id = ? AND user_id = ?", session.Id, userId).Update("pending_confirm_token", pending.Token).Error
			argsBytes, _ := common.Marshal(args)
			_ = AppendMessage(ctx, userId, session.Id, constant.AgentRoleAssistant, "Waiting for confirmation: "+tool.DisplayName, tool.Name, string(argsBytes))
			events <- dto.AgentEvent{
				Type:         constant.AgentEventConfirmNeeded,
				SessionId:    session.Id,
				ToolName:     tool.Name,
				ConfirmToken: pending.Token,
				RiskLevel:    tool.RiskLevel,
				Message:      "Please confirm: " + tool.DisplayName,
				Data:         args,
			}
			return
		}
		o.executeTool(ctx, events, userId, session.Id, tool, args, false)
		events <- dto.AgentEvent{Type: constant.AgentEventDone, SessionId: session.Id, Done: true}
	}()
	return events, nil
}

func (o *Orchestrator) Confirm(ctx context.Context, userId int, sessionId int, token string, accept bool) (<-chan dto.AgentEvent, error) {
	if err := GuardConfirm(userId); err != nil {
		return nil, err
	}
	pending, err := TakeConfirmation(userId, sessionId, token)
	if err != nil {
		return nil, err
	}
	events := make(chan dto.AgentEvent, 8)
	go func() {
		defer close(events)
		tool, ok := o.registry.GetTool(pending.ToolName)
		if !ok {
			events <- dto.AgentEvent{Type: constant.AgentEventError, SessionId: sessionId, Message: "Tool is no longer available."}
			return
		}
		if !IsToolEnabled(ctx, tool.Name) {
			events <- dto.AgentEvent{Type: constant.AgentEventError, SessionId: sessionId, ToolName: tool.Name, Message: "This tool is currently disabled by an administrator."}
			return
		}
		if !accept {
			WriteAudit(ctx, userId, sessionId, pending.ToolName, pending.Args, nil, constant.AgentAuditRefused, "", tool.NeedsConfirmation, false, time.Now())
			events <- dto.AgentEvent{Type: constant.AgentEventDone, SessionId: sessionId, Message: "Cancelled.", Done: true}
			return
		}
		o.executeTool(ctx, events, userId, sessionId, tool, pending.Args, true)
		events <- dto.AgentEvent{Type: constant.AgentEventDone, SessionId: sessionId, Done: true}
	}()
	return events, nil
}

func (o *Orchestrator) executeTool(ctx context.Context, events chan<- dto.AgentEvent, userId int, sessionId int, tool *ToolDefinition, args map[string]interface{}, confirmed bool) {
	start := time.Now()
	result, err := tool.Executor(ctx, userId, args)
	status := constant.AgentAuditSuccess
	errMsg := ""
	if err != nil {
		status = constant.AgentAuditFailed
		errMsg = err.Error()
		result = ToolResult{OK: false, UserMessage: TranslateError(err)}
	}
	WriteAudit(ctx, userId, sessionId, tool.Name, args, result, status, errMsg, tool.NeedsConfirmation, confirmed, start)
	ConsumeAgentStep(ctx, userId)
	resultBytes, _ := common.Marshal(result)
	_ = AppendMessage(ctx, userId, sessionId, constant.AgentRoleTool, string(resultBytes), tool.Name, "")
	events <- dto.AgentEvent{Type: constant.AgentEventToolCallResult, SessionId: sessionId, ToolName: tool.Name, Data: result}
	if result.UserMessage != "" {
		_ = AppendMessage(ctx, userId, sessionId, constant.AgentRoleAssistant, result.UserMessage, "", "")
		events <- dto.AgentEvent{Type: constant.AgentEventTextDelta, SessionId: sessionId, Delta: result.UserMessage}
	}
}

func (o *Orchestrator) planTool(message string) (string, map[string]interface{}) {
	text := strings.ToLower(message)
	args := map[string]interface{}{}
	switch {
	case containsAny(text, "balance", "quota", "余额", "额度"):
		return "get_balance", args
	case containsAny(text, "model", "price", "模型", "价格", "倍率"):
		if containsAny(text, "recommend", "推荐", "选择", "选哪个") {
			args["task_type"] = "chat"
			return "recommend_model", args
		}
		if containsAny(text, "price", "价格", "倍率", "多少钱") {
			args["models"] = []string{}
			return "query_pricing", args
		}
		return "list_my_models", args
	case containsAny(text, "token", "key", "api key", "令牌", "密钥"):
		if containsAny(text, "create", "new", "generate", "新建", "创建", "生成") {
			args["name"] = extractQuotedOrDefault(message, "agent-created")
			return "create_token", args
		}
		if containsAny(text, "delete", "remove", "revoke", "删除", "吊销") {
			args["token_id"] = extractFirstInt(message)
			return "delete_token", args
		}
		return "list_my_tokens", args
	case containsAny(text, "log", "error", "429", "日志", "失败", "错误", "报错"):
		if containsAny(text, "explain", "why", "reason", "解释", "原因", "报错", "error") {
			args["error_text"] = message
			return "explain_error", args
		}
		return "query_my_logs", args
	case containsAny(text, "topup", "pay", "充值", "支付"):
		if containsAny(text, "link", "page", "how", "链接", "页面", "怎么") {
			return "get_topup_link", args
		}
		args["amount_cny"] = float64(10)
		return "trigger_topup", args
	case containsAny(text, "doc", "help", "tutorial", "faq", "文档", "帮助", "教程", "怎么"):
		args["query"] = message
		return "search_knowledge", args
	case containsAny(text, "clarify", "澄清"):
		args["question"] = "Could you share a little more detail about what you want to do?"
		return "clarify", args
	default:
		return "", args
	}
}

func containsAny(text string, parts ...string) bool {
	for _, part := range parts {
		if strings.Contains(text, strings.ToLower(part)) {
			return true
		}
	}
	return false
}

func extractQuotedOrDefault(s string, fallback string) string {
	for _, pair := range [][2]string{{"\"", "\""}, {"'", "'"}, {"“", "”"}, {"『", "』"}} {
		start := strings.Index(s, pair[0])
		if start >= 0 {
			end := strings.Index(s[start+len(pair[0]):], pair[1])
			if end >= 0 {
				val := strings.TrimSpace(s[start+len(pair[0]) : start+len(pair[0])+end])
				if val != "" {
					return val
				}
			}
		}
	}
	return fallback
}

func extractFirstInt(s string) int {
	var v int
	_, _ = fmt.Sscanf(s, "%d", &v)
	return v
}
