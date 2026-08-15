package cursor_agent

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestConvertClaudeRequestMapsSonnet46AndAllowsTools(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	mt := uint(64)
	stream := false
	req := &dto.ClaudeRequest{
		Model:     "cursor-agent/claude-sonnet-4-6",
		MaxTokens: &mt,
		Stream:    &stream,
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
		},
		Tools: []any{
			map[string]any{
				"name":         "get_weather",
				"description":  "weather",
				"input_schema": map[string]any{"type": "object"},
			},
		},
		ToolChoice: map[string]any{"type": "any"},
	}

	out, err := a.ConvertClaudeRequest(nil, info, req)
	if err != nil {
		t.Fatalf("ConvertClaudeRequest: %v", err)
	}
	claude, ok := out.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest (native passthrough), got %T", out)
	}
	if claude.Model != "claude-sonnet-4-6" {
		t.Fatalf("model=%q want claude-sonnet-4-6", claude.Model)
	}
	if info.UpstreamModelName != "claude-sonnet-4-6" {
		t.Fatalf("UpstreamModelName=%q", info.UpstreamModelName)
	}
	if info.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat=%q", info.FinalRequestRelayFormat)
	}
	if claude.Stream == nil || *claude.Stream {
		t.Fatal("expected client stream=false to be preserved")
	}
	if info.IsStream {
		t.Fatal("expected non-stream relay to stay non-stream")
	}
	if claude.Tools == nil {
		t.Fatal("expected tools preserved")
	}
}

func TestConvertRequestsApplyGrokReasoningEffort(t *testing.T) {
	a := &Adaptor{}

	chatInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-sdk.test"}}
	chat, err := a.ConvertOpenAIRequest(nil, chatInfo, &dto.GeneralOpenAIRequest{
		Model:           "grok-4.6",
		ReasoningEffort: "high",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := chat.(*dto.ClaudeRequest).Model; got != "cursor-grok-4.6-high" {
		t.Fatalf("chat model=%q", got)
	}

	claudeInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-sdk.test"}}
	claude, err := a.ConvertClaudeRequest(nil, claudeInfo, &dto.ClaudeRequest{
		Model:        "grok-4.5",
		OutputConfig: json.RawMessage(`{"effort":"high"}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := claude.(*dto.ClaudeRequest).Model; got != "cursor-grok-4.5-high" {
		t.Fatalf("claude model=%q", got)
	}

	responsesInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-sdk.test"}}
	responses, err := a.ConvertOpenAIResponsesRequest(nil, responsesInfo, dto.OpenAIResponsesRequest{
		Model:     "grok-4.6",
		Reasoning: &dto.Reasoning{Effort: "xhigh"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := responses.(*dto.ClaudeRequest).Model; got != "cursor-grok-4.6-xhigh" {
		t.Fatalf("responses model=%q", got)
	}
	if responsesInfo.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat=%q", responsesInfo.FinalRequestRelayFormat)
	}
}

func TestMapSDKModelWithEffortRejectsUnsupportedGrok45Level(t *testing.T) {
	if _, err := MapSDKModelWithEffort("grok-4.5", "bogus"); err == nil {
		t.Fatal("expected unsupported effort error")
	}
}

func TestAllSupportedRequestsUseMessagesEndpoint(t *testing.T) {
	a := &Adaptor{}
	for _, test := range []struct {
		name string
		mode int
	}{
		{name: "chat", mode: relayconstant.RelayModeChatCompletions},
		{name: "responses", mode: relayconstant.RelayModeResponses},
	} {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayMode: test.mode,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: "http://cursor-sdk.test",
				},
			}
			got, err := a.GetRequestURL(info)
			if err != nil {
				t.Fatal(err)
			}
			if got != "http://cursor-sdk.test/v1/messages" {
				t.Fatalf("url=%q", got)
			}
		})
	}
}

func TestConvertClaudeRequestTextOnlyPassthrough(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
	mt := uint(32)
	req := &dto.ClaudeRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: &mt,
		Messages:  []dto.ClaudeMessage{{Role: "user", Content: "hi"}},
	}
	out, err := a.ConvertClaudeRequest(nil, info, req)
	if err != nil {
		t.Fatal(err)
	}
	claude := out.(*dto.ClaudeRequest)
	if claude.Model != "claude-sonnet-4-6" {
		t.Fatalf("model=%q", claude.Model)
	}
}

func TestGetRequestURLUsesCustomSDKBase(t *testing.T) {
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", "")
	a := &Adaptor{}
	base := "http://cursor-sdk.internal:9000"

	claudeInfo := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: base,
			ChannelType:    62,
		},
		FinalRequestRelayFormat: types.RelayFormatClaude,
	}
	url, err := a.GetRequestURL(claudeInfo)
	if err != nil {
		t.Fatal(err)
	}
	if url != base+"/v1/messages" {
		t.Fatalf("claude url=%q", url)
	}

}

func TestGetRequestURLPrefersImmutableRuntimeBase(t *testing.T) {
	t.Setenv("CURSOR_AGENT_SIDECAR_BASE_URL", "http://cursor-sdk-runtime:3927")
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://legacy-sidecar:3927"},
	}
	url, err := a.GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if url != "http://cursor-sdk-runtime:3927/v1/messages" {
		t.Fatalf("url=%q", url)
	}
}

func TestConvertOpenAIRequestAllowsToolsAndMapsModel(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-sdk.test"}}
	stream := false
	req := &dto.GeneralOpenAIRequest{
		Model:  "claude-sonnet-4-6",
		Stream: &stream,
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
		},
		Tools: []dto.ToolCallRequest{
			{Type: "function", Function: dto.FunctionRequest{Name: "get_weather"}},
		},
	}
	out, err := a.ConvertOpenAIRequest(nil, info, req)
	if err != nil {
		t.Fatal(err)
	}
	converted := out.(*dto.ClaudeRequest)
	if converted.Model != "claude-sonnet-4-6" {
		t.Fatalf("model=%q", converted.Model)
	}
	if converted.Stream != nil && *converted.Stream {
		t.Fatal("expected stream=false preserved for tools")
	}
	if info.IsStream {
		t.Fatal("expected non-stream relay")
	}
}

func TestOfficialSDKHarnessConvertsChatToolsToMessages(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-agent-sidecar:3927"},
		RelayFormat: types.RelayFormatOpenAI,
	}
	req := &dto.GeneralOpenAIRequest{
		Model:    "grok-4.6",
		Messages: []dto.Message{{Role: "user", Content: "look it up"}},
		Tools: []dto.ToolCallRequest{{
			Type: "function",
			Function: dto.FunctionRequest{
				Name: "lookup",
				Parameters: map[string]any{
					"type":       "object",
					"properties": map[string]any{},
				},
			},
		}},
	}
	out, err := a.ConvertOpenAIRequest(nil, info, req)
	if err != nil {
		t.Fatal(err)
	}
	claudeReq, ok := out.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest, got %T", out)
	}
	if claudeReq.Model != "cursor-grok-4.6-medium" {
		t.Fatalf("model=%q", claudeReq.Model)
	}
	if len(claudeReq.GetTools()) != 1 {
		t.Fatalf("tools=%d", len(claudeReq.GetTools()))
	}
	if info.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat=%q", info.FinalRequestRelayFormat)
	}
	url, err := a.GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if url != "http://cursor-agent-sidecar:3927/v1/messages" {
		t.Fatalf("url=%q", url)
	}
}

func TestOfficialSDKHarnessNormalizesSchemaLessAndLegacyChatTools(t *testing.T) {
	a := &Adaptor{}
	for _, req := range []*dto.GeneralOpenAIRequest{
		{
			Model:    "composer-2.5",
			Messages: []dto.Message{{Role: "user", Content: "use it"}},
			Tools: []dto.ToolCallRequest{{
				Type:     "function",
				Function: dto.FunctionRequest{Name: "schema_less"},
			}},
		},
		{
			Model:        "composer-2.5",
			Messages:     []dto.Message{{Role: "user", Content: "use it"}},
			Functions:    json.RawMessage(`[{"name":"legacy_tool"}]`),
			FunctionCall: json.RawMessage(`{"name":"legacy_tool"}`),
		},
	} {
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: ""}}
		out, err := a.ConvertOpenAIRequest(nil, info, req)
		if err != nil {
			t.Fatal(err)
		}
		claudeReq := out.(*dto.ClaudeRequest)
		tools, err := common.Any2Type[[]dto.Tool](claudeReq.Tools)
		if err != nil {
			t.Fatal(err)
		}
		if len(tools) != 1 || tools[0].InputSchema["type"] != "object" || tools[0].InputSchema["properties"] == nil {
			t.Fatalf("normalized tools=%#v", tools)
		}
		if info.FinalRequestRelayFormat != types.RelayFormatClaude {
			t.Fatalf("FinalRequestRelayFormat=%q", info.FinalRequestRelayFormat)
		}
	}
}

func TestOfficialSDKHarnessConvertsResponsesToolsToMessages(t *testing.T) {
	a := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "http://cursor-agent-sidecar:3927"},
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAIResponses,
	}
	out, err := a.ConvertOpenAIResponsesRequest(nil, info, dto.OpenAIResponsesRequest{
		Model: "composer-2.5",
		Input: json.RawMessage(`[{"role":"user","content":[{"type":"input_text","text":"look it up"}]}]`),
		Tools: json.RawMessage(`[{"type":"function","name":"lookup","description":"lookup"}]`),
	})
	if err != nil {
		t.Fatal(err)
	}
	claudeReq, ok := out.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest, got %T", out)
	}
	if claudeReq.Model != "composer-2.5" || len(claudeReq.GetTools()) != 1 {
		t.Fatalf("model=%q tools=%d", claudeReq.Model, len(claudeReq.GetTools()))
	}
	tools, err := common.Any2Type[[]dto.Tool](claudeReq.Tools)
	if err != nil {
		t.Fatal(err)
	}
	if tools[0].InputSchema["type"] != "object" || tools[0].InputSchema["properties"] == nil {
		t.Fatalf("schema=%#v", tools[0].InputSchema)
	}
	if info.FinalRequestRelayFormat != types.RelayFormatClaude {
		t.Fatalf("FinalRequestRelayFormat=%q", info.FinalRequestRelayFormat)
	}
}

func TestOfficialSDKHarnessRejectsResponsesCompaction(t *testing.T) {
	a := &Adaptor{}
	_, err := a.GetRequestURL(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponsesCompact,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "http://cursor-agent-sidecar:3927",
		},
	})
	if err == nil || !strings.Contains(err.Error(), "compaction") {
		t.Fatalf("err=%v", err)
	}
}
