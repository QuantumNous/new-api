package openai

import (
	"fmt"

	"github.com/QuantumNous/new-api/internal/common"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"
)

// streamObserver accumulates everything the billing and terminal-state paths need
// from a chat-completions stream without materializing each chunk into a DTO.
//
// The slow path unmarshals every chunk twice — once to forward it and once to
// count tokens — then serializes it back out. When no format conversion is
// requested the forwarded bytes are byte-identical to the upstream bytes, so the
// fast path writes them through untouched and reads only the fields it needs:
// delta text and reasoning for local token counting, tool call names for tool
// billing, usage for upstream-reported billing, and finish_reason for #394's
// truncation check.
type streamObserver struct {
	relayMode int

	responseText strings.Builder
	toolCount    int
	toolNames    []string
	seenToolCall map[string]struct{}

	sawFinishReason bool
	sawTextContent  bool

	// usage holds the last valid upstream usage payload, matching the slow path
	// which reads usage off the final chunk.
	usage              *dto.Usage
	containStreamUsage bool
}

func newStreamObserver(relayMode int) *streamObserver {
	return &streamObserver{
		relayMode:    relayMode,
		seenToolCall: make(map[string]struct{}),
	}
}

// observe reads one SSE data payload. It never mutates or re-encodes the payload.
func (o *streamObserver) observe(data string) {
	if data == "" {
		return
	}
	root := gjson.Parse(data)
	if !root.IsObject() {
		return
	}

	if usage := root.Get("usage"); usage.Exists() && usage.IsObject() {
		o.readUsage(usage)
	}

	switch o.relayMode {
	case relayconstant.RelayModeChatCompletions:
		o.readChatChoices(root.Get("choices"))
	case relayconstant.RelayModeCompletions:
		root.Get("choices").ForEach(func(_, choice gjson.Result) bool {
			text := choice.Get("text").String()
			o.responseText.WriteString(text)
			if strings.TrimSpace(text) != "" {
				o.sawTextContent = true
			}
			if choice.Get("finish_reason").String() != "" {
				o.sawFinishReason = true
			}
			return true
		})
	}
}

// readChatChoices mirrors ProcessStreamResponse and collectStreamFunctionCallNames:
// billable text is content plus reasoning plus tool name/arguments, toolCount is
// the widest tool_calls array seen, and tool names are deduped per
// choice-index/tool-index pair.
func (o *streamObserver) readChatChoices(choices gjson.Result) {
	choices.ForEach(func(_, choice gjson.Result) bool {
		if choice.Get("finish_reason").String() != "" {
			o.sawFinishReason = true
		}

		delta := choice.Get("delta")
		o.responseText.WriteString(delta.Get("content").String())
		o.responseText.WriteString(deltaReasoning(delta))
		if strings.TrimSpace(delta.Get("content").String()) != "" {
			o.sawTextContent = true
		}

		toolCalls := delta.Get("tool_calls")
		if !toolCalls.IsArray() {
			return true
		}
		calls := toolCalls.Array()
		if len(calls) > o.toolCount {
			o.toolCount = len(calls)
		}
		choiceIndex := choice.Get("index").Int()
		for i, tc := range calls {
			fn := tc.Get("function")
			name := fn.Get("name").String()
			o.responseText.WriteString(name)
			o.responseText.WriteString(fn.Get("arguments").String())
			if name == "" {
				continue
			}
			toolIndex := int64(i)
			if idx := tc.Get("index"); idx.Exists() {
				toolIndex = idx.Int()
			}
			key := toolCallKey(choiceIndex, toolIndex)
			if _, ok := o.seenToolCall[key]; ok {
				continue
			}
			o.seenToolCall[key] = struct{}{}
			o.toolNames = append(o.toolNames, name)
		}
		return true
	})
}

// deltaReasoning mirrors GetReasoningContent: reasoning_content wins over
// reasoning when both are present. An explicit JSON null must fall through to
// reasoning, matching the slow path where null unmarshals to a nil pointer;
// gjson reports Exists() for null, so the type is checked too.
func deltaReasoning(delta gjson.Result) string {
	if v := delta.Get("reasoning_content"); v.Exists() && v.Type != gjson.Null {
		return v.String()
	}
	return delta.Get("reasoning").String()
}

func toolCallKey(choiceIndex, toolIndex int64) string {
	return fmt.Sprintf("%d-%d", choiceIndex, toolIndex)
}

// readUsage decodes the usage subtree through the shared JSON path so every
// dto.Usage field stays in sync with the slow path; hand-mapping fields here
// would silently drop cache/audio/billing details as dto.Usage grows. Usage
// appears once per stream, so the cost is negligible.
func (o *streamObserver) readUsage(usage gjson.Result) {
	var parsed dto.Usage
	if err := common.UnmarshalJsonStr(usage.Raw, &parsed); err != nil {
		return
	}
	if !relaycommon.ValidUsage(&parsed) {
		return
	}
	o.usage = &parsed
	o.containStreamUsage = true
}

// canCopyAndObserve reports whether a relay may take the passthrough fast path.
// Every transformation the slow path can apply — OpenAI-shape normalization
// (ForceFormat), reasoning-to-content rewriting (ThinkingToContent), and
// cross-protocol conversion (Claude/Gemini) — rewrites the forwarded bytes, so
// any of them forces the slow path. Audio models are excluded too: their usage
// comes from the second-to-last chunk, which the observer does not track.
func canCopyAndObserve(info *relaycommon.RelayInfo) bool {
	if info == nil || info.RelayFormat != types.RelayFormatOpenAI {
		return false
	}
	if info.ChannelSetting.ForceFormat || info.ChannelSetting.ThinkingToContent {
		return false
	}
	switch info.RelayMode {
	case relayconstant.RelayModeChatCompletions, relayconstant.RelayModeCompletions:
	default:
		return false
	}
	return !strings.Contains(strings.ToLower(info.UpstreamModelName), "audio")
}
