package groksubscription

import "sync/atomic"

type EventKind int

const (
	// 非语义事件（不置位）
	EventComment EventKind = iota
	EventEmpty
	EventKeepalive
	EventHeaderFlush
	// Responses 语义事件
	EventResponsesText
	EventResponsesReasoning
	EventResponsesTool
	EventResponsesUsage
	EventResponsesError
	// Chat 语义事件
	EventChatDelta
	EventChatTool
	EventChatUsage
	EventChatError
	// Claude 语义事件
	EventClaudeContent
	EventClaudeTool
	EventClaudeUsage
	EventClaudeError
	eventKindCount // 哨兵：新增枚举必须登记进 semanticKinds 或确认非语义（见 exhaustive 测试）
)

// semanticKinds 是会置位 semantic_output_started 的事件集合。
var semanticKinds = map[EventKind]struct{}{
	EventResponsesText: {}, EventResponsesReasoning: {}, EventResponsesTool: {}, EventResponsesUsage: {}, EventResponsesError: {},
	EventChatDelta: {}, EventChatTool: {}, EventChatUsage: {}, EventChatError: {},
	EventClaudeContent: {}, EventClaudeTool: {}, EventClaudeUsage: {}, EventClaudeError: {},
}

// StreamEvent 是分类后的流事件（分类逻辑在各协议 handler 里做，tracker 只认 Kind）。
type StreamEvent struct {
	Kind EventKind
}

// SemanticOutputTracker 是请求级、并发安全的一次性置位器。
type SemanticOutputTracker struct {
	started atomic.Bool
}

func NewSemanticOutputTracker() *SemanticOutputTracker {
	return &SemanticOutputTracker{}
}

// Observe 在写出该事件前调用；语义事件原子置位（幂等）。
// 时序契约：tracker 看不到实际 write，无法自证时序——若接线方先 write 后 Observe，
// failover 判定窗口内已写出语义内容但未置位，违反不可换账号契约；该不变量全靠接线方遵守。
func (t *SemanticOutputTracker) Observe(ev StreamEvent) {
	if _, ok := semanticKinds[ev.Kind]; ok {
		t.started.Store(true)
	}
}

// SemanticOutputStarted 是否已写出语义内容。
func (t *SemanticOutputTracker) SemanticOutputStarted() bool {
	return t.started.Load()
}

// CanFailover 仅在尚未写出语义内容时允许 Grok 换账号。
func (t *SemanticOutputTracker) CanFailover() bool {
	return !t.started.Load()
}
