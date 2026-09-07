package attemptlog

// Time to first token must be measured from the first chunk that actually
// carries generated content, not from the first chunk that arrives. Upstreams
// routinely open a stream with metadata: OpenAI sends a role-only delta,
// Anthropic sends message_start followed by content_block_start and periodic
// ping events, and several providers emit a usage-only chunk. Stamping TTFT on
// any of those understates latency, and because the same signal feeds outcome
// classification it also turns a stream that produced nothing into
// stream_interrupted instead of empty_response.
//
// Classification works on the raw upstream payload by shape rather than by the
// request's relay format: a channel may speak Claude upstream while the client
// asked for OpenAI, so the client-facing format is not a reliable guide.

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// chunkKind is the three-way result of inspecting one stream chunk. The
// unknown case is what keeps this safe to deploy across 40+ providers: a shape
// we cannot read must not be reported as "no content ever arrived", because
// that would silently drop TTFT for every channel with a bespoke envelope.
type chunkKind int

const (
	// chunkUnknown means the payload matched no envelope we recognize.
	chunkUnknown chunkKind = iota
	// chunkNoContent means we recognized the envelope and it carries no
	// generated content: a role opener, a ping, a usage-only chunk.
	chunkNoContent
	// chunkContent means the payload carries generated content.
	chunkContent
)

// NoteChunk records one upstream stream chunk against the attempt on the
// context. It is a no-op when telemetry is off, and it stops classifying once
// content has been seen, so the steady-state cost on a long stream is one
// mutex acquisition and one boolean test per chunk.
func NoteChunk(c *gin.Context, data string) {
	attempt := fromContext(c)
	if attempt == nil {
		return
	}

	now := time.Now()

	attempt.mu.Lock()
	defer attempt.mu.Unlock()

	if attempt.firstChunkTime.IsZero() {
		attempt.firstChunkTime = now
	}
	if !attempt.firstContentTime.IsZero() {
		return
	}

	switch classifyChunk(data) {
	case chunkContent:
		attempt.firstContentTime = now
	case chunkUnknown:
		attempt.sawUnknownChunk = true
	}
}

// classifyChunk reports whether one raw stream chunk carries generated content.
func classifyChunk(payload string) chunkKind {
	if !gjson.Valid(payload) {
		return chunkUnknown
	}

	if choices := gjson.Get(payload, "choices"); choices.IsArray() {
		return openAIChoicesKind(choices)
	}
	if candidates := gjson.Get(payload, "candidates"); candidates.IsArray() {
		return geminiCandidatesKind(candidates)
	}
	if eventType := gjson.Get(payload, "type"); eventType.Type == gjson.String {
		return typedEventKind(payload, eventType.String())
	}

	return chunkUnknown
}

// openAIChoicesKind covers OpenAI chat completions and the legacy completions
// shape. The role-only opening delta is the single most common false positive
// this whole file exists to reject.
func openAIChoicesKind(choices gjson.Result) chunkKind {
	// A usage-only chunk carries "choices": [], which is a recognized envelope
	// with nothing generated in it.
	hasContent := false
	choices.ForEach(func(_, choice gjson.Result) bool {
		if choiceHasContent(choice) {
			hasContent = true
			return false
		}
		return true
	})
	if hasContent {
		return chunkContent
	}
	return chunkNoContent
}

func choiceHasContent(choice gjson.Result) bool {
	// Legacy /v1/completions puts the text directly on the choice.
	if text := choice.Get("text"); text.Type == gjson.String && text.String() != "" {
		return true
	}

	delta := choice.Get("delta")
	if !delta.Exists() {
		return false
	}
	// Reasoning counts as content: a reasoning model that thinks for ten
	// seconds before its first visible token has genuinely started producing.
	for _, key := range []string{"content", "reasoning_content", "reasoning"} {
		if r := delta.Get(key); r.Exists() && r.Type != gjson.Null && r.String() != "" {
			return true
		}
	}
	for _, key := range []string{"tool_calls", "function_call", "audio"} {
		if r := delta.Get(key); r.Exists() && r.Type != gjson.Null && r.Raw != "[]" && r.Raw != "{}" {
			return true
		}
	}
	return false
}

// geminiCandidatesKind covers Gemini's native envelope. A chunk carrying only
// promptFeedback or usageMetadata has no candidates content and is rejected.
func geminiCandidatesKind(candidates gjson.Result) chunkKind {
	hasContent := false
	candidates.ForEach(func(_, candidate gjson.Result) bool {
		candidate.Get("content.parts").ForEach(func(_, part gjson.Result) bool {
			if partHasContent(part) {
				hasContent = true
				return false
			}
			return true
		})
		return !hasContent
	})
	if hasContent {
		return chunkContent
	}
	return chunkNoContent
}

func partHasContent(part gjson.Result) bool {
	if text := part.Get("text"); text.Type == gjson.String && text.String() != "" {
		return true
	}
	for _, key := range []string{"inlineData", "inline_data", "functionCall", "function_call", "executableCode", "executable_code"} {
		if r := part.Get(key); r.Exists() && r.Type != gjson.Null && r.Raw != "{}" {
			return true
		}
	}
	return false
}

// typedEventKind covers the event-per-chunk families: Anthropic messages,
// OpenAI Responses, and the realtime websocket protocol. They share the
// convention that incremental output arrives on an event whose type ends in
// ".delta", with Anthropic's content_block_delta as the named exception.
func typedEventKind(payload string, eventType string) chunkKind {
	switch eventType {
	case "content_block_delta":
		delta := gjson.Get(payload, "delta")
		for _, key := range []string{"text", "thinking", "partial_json"} {
			if r := delta.Get(key); r.Exists() && r.Type != gjson.Null && r.String() != "" {
				return chunkContent
			}
		}
		return chunkNoContent
	case "content_block_start":
		// A tool_use block opens with an empty input that is filled in by
		// later partial_json deltas, but the block itself already commits the
		// model to a tool call, so a named tool_use block counts as content.
		block := gjson.Get(payload, "content_block")
		if text := block.Get("text"); text.Type == gjson.String && text.String() != "" {
			return chunkContent
		}
		if name := block.Get("name"); name.Type == gjson.String && name.String() != "" {
			return chunkContent
		}
		return chunkNoContent
	}

	// response.output_text.delta, response.audio.delta, response.function_call
	// _arguments.delta and friends. The delta may be a string or an object
	// depending on the event.
	if len(eventType) > 6 && eventType[len(eventType)-6:] == ".delta" {
		delta := gjson.Get(payload, "delta")
		if delta.Exists() && delta.Type != gjson.Null && delta.String() != "" && delta.Raw != "{}" {
			return chunkContent
		}
		return chunkNoContent
	}

	// ping, message_start, message_delta, message_stop, content_block_stop,
	// response.created, response.completed, error, and anything else in these
	// families: a recognized envelope with no generated content.
	return chunkNoContent
}
