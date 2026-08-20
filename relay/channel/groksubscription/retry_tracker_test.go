package groksubscription

import (
	"sync"
	"testing"
)

func TestTrackerNotStartedOnKeepalive(t *testing.T) {
	tr := NewSemanticOutputTracker()
	// heartbeat/comment/空 event/header flush 都不置位
	for _, ev := range []StreamEvent{
		{Kind: EventComment},
		{Kind: EventEmpty},
		{Kind: EventKeepalive},
		{Kind: EventHeaderFlush},
	} {
		tr.Observe(ev)
	}
	if tr.SemanticOutputStarted() {
		t.Fatalf("keepalive/comment/empty/header-flush must not set semantic_output_started")
	}
	if !tr.CanFailover() {
		t.Fatalf("must still allow failover before semantic output")
	}
}

func TestTrackerStartsOnFirstSemanticEvent(t *testing.T) {
	for _, kind := range []EventKind{
		EventResponsesText, EventResponsesReasoning, EventResponsesTool, EventResponsesUsage, EventResponsesError,
		EventChatDelta, EventChatTool, EventChatUsage, EventChatError,
		EventClaudeContent, EventClaudeTool, EventClaudeUsage, EventClaudeError,
	} {
		tr := NewSemanticOutputTracker()
		tr.Observe(StreamEvent{Kind: kind})
		if !tr.SemanticOutputStarted() {
			t.Fatalf("event kind %v must set semantic_output_started", kind)
		}
		if tr.CanFailover() {
			t.Fatalf("must not allow failover after semantic output for kind %v", kind)
		}
	}
}

func TestTrackerSetOnceIdempotentAndConcurrent(t *testing.T) {
	tr := NewSemanticOutputTracker()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); tr.Observe(StreamEvent{Kind: EventResponsesText}) }()
	}
	wg.Wait()
	if !tr.SemanticOutputStarted() {
		t.Fatalf("concurrent observes must set started")
	}
}

func TestEventKindExhaustiveClassification(t *testing.T) {
	nonSemantic := map[EventKind]struct{}{
		EventComment: {}, EventEmpty: {}, EventKeepalive: {}, EventHeaderFlush: {},
	}
	for k := EventComment; k < eventKindCount; k++ {
		_, isSemantic := semanticKinds[k]
		_, isNonSemantic := nonSemantic[k]
		if isSemantic == isNonSemantic { // 同真=重复登记；同假=漏登记（新增枚举未归类时必命中）
			t.Fatalf("EventKind(%d): semantic=%v, nonSemantic=%v — must belong to exactly one set", k, isSemantic, isNonSemantic)
		}
		tr := NewSemanticOutputTracker()
		tr.Observe(StreamEvent{Kind: k})
		if tr.SemanticOutputStarted() != isSemantic {
			t.Fatalf("EventKind(%d): Observe -> started=%v, want %v", k, tr.SemanticOutputStarted(), isSemantic)
		}
	}
}
