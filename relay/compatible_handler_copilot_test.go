package relay

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/tidwall/gjson"
)

func copilotRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: constant.ChannelTypeCopilot,
	}}
}

func TestCopilotAlwaysUsesConvertedTextRequest(t *testing.T) {
	info := copilotRelayInfo()
	info.ChannelSetting = dto.ChannelSettings{PassThroughBodyEnabled: true}
	if shouldPassThroughTextRequest(info, true) {
		t.Fatal("Copilot must ignore global and channel body pass-through")
	}

	openAIInfo := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType:    constant.ChannelTypeOpenAI,
		ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
	}}
	if !shouldPassThroughTextRequest(openAIInfo, false) {
		t.Fatal("non-Copilot channel pass-through behavior changed")
	}
}

func TestCopilotDisallowsChatCompletionsViaResponses(t *testing.T) {
	if allowsChatCompletionsViaResponses(copilotRelayInfo()) {
		t.Fatal("Copilot Chat Completions must not use the Responses bridge")
	}
	if !allowsChatCompletionsViaResponses(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI}}) {
		t.Fatal("non-Copilot Responses bridge eligibility changed")
	}
}

func TestCopilotRejectsNativeClaudeAndGeminiFormats(t *testing.T) {
	info := copilotRelayInfo()
	info.ChannelSetting = dto.ChannelSettings{PassThroughBodyEnabled: true}

	for _, endpoint := range []string{"/v1/messages", "Gemini", "Gemini embedding"} {
		err := rejectCopilotNonChatFormat(info, endpoint)
		if err == nil {
			t.Fatalf("Copilot accepted %s with pass-through enabled", endpoint)
		}
		if err.StatusCode != http.StatusBadRequest {
			t.Fatalf("%s status = %d, want 400", endpoint, err.StatusCode)
		}
		if !types.IsSkipRetryError(err) {
			t.Fatalf("%s rejection should skip retry", endpoint)
		}
	}

	if err := rejectCopilotNonChatFormat(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI}}, "/v1/messages"); err != nil {
		t.Fatalf("non-Copilot channel rejected: %v", err)
	}
}

func TestCopilotStreamOptionsRemovedAfterParamOverride(t *testing.T) {
	info := copilotRelayInfo()
	info.ParamOverride = map[string]interface{}{
		"stream_options": map[string]interface{}{"include_usage": true},
	}

	body, err := relaycommon.ApplyParamOverrideWithRelayInfo([]byte(`{"model":"gpt-4.1","stream":true}`), info)
	if err != nil {
		t.Fatal(err)
	}
	if !gjson.GetBytes(body, "stream_options").Exists() {
		t.Fatal("test setup did not add stream_options")
	}

	body, err = sanitizeTextRequestForChannel(body, info)
	if err != nil {
		t.Fatal(err)
	}
	if !gjson.ValidBytes(body) {
		t.Fatalf("sanitized body is invalid JSON: %s", body)
	}
	if gjson.GetBytes(body, "stream_options").Exists() {
		t.Fatalf("stream_options reached Copilot body: %s", body)
	}
}
