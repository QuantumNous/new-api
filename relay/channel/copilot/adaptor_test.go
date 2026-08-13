package copilot

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func chatInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            42,
			ChannelMultiKeyIndex: 3,
			ChannelBaseUrl:       "https://attacker.example",
			ApiKey:               "gho_github-credential",
			ChannelSetting:       dto.ChannelSettings{Proxy: "socks5://proxy.example:1080"},
		},
	}
}

func TestGetRequestURLUsesOfficialChatEndpoint(t *testing.T) {
	got, err := (&Adaptor{}).GetRequestURL(chatInfo())
	if err != nil {
		t.Fatal(err)
	}
	if got != chatCompletionsURL {
		t.Fatalf("URL = %q, want %q", got, chatCompletionsURL)
	}

	unsupported := chatInfo()
	unsupported.RelayMode = relayconstant.RelayModeResponses
	if _, err := (&Adaptor{}).GetRequestURL(unsupported); !errors.Is(err, errUnsupportedEndpoint) {
		t.Fatalf("unsupported URL error = %v", err)
	}
}

func TestGetRequestURLUsesNativeClaudeMessagesEndpoint(t *testing.T) {
	info := chatInfo()
	info.RelayFormat = types.RelayFormatClaude
	got, err := (&Adaptor{}).GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if got != claudeMessagesURL {
		t.Fatalf("URL = %q, want %q", got, claudeMessagesURL)
	}
}

func TestSetupRequestHeaderUsesDeviceFlowCredentialDirectly(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	header := http.Header{}
	if err := (&Adaptor{}).SetupRequestHeader(c, &header, chatInfo()); err != nil {
		t.Fatal(err)
	}

	wants := map[string]string{
		"Authorization":        "Bearer gho_github-credential",
		"Accept":               "application/json",
		"Content-Type":         "application/json",
		"User-Agent":           userAgent,
		"Openai-Intent":        openAIIntent,
		"X-GitHub-Api-Version": githubAPIVersion,
		"x-initiator":          "user",
	}
	for name, want := range wants {
		if got := header.Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	if header.Get("X-Request-Id") == "" {
		t.Fatal("X-Request-Id is missing")
	}
}

func TestSetupRequestHeaderUsesClaudeCopilotHeaders(t *testing.T) {
	info := chatInfo()
	info.RelayFormat = types.RelayFormatClaude
	req := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader("{}"))
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	header := http.Header{}
	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &header, info))
	require.Equal(t, "text/event-stream", header.Get("Accept"))
	require.Equal(t, "2023-06-01", header.Get("anthropic-version"))
	require.Equal(t, "Bearer gho_github-credential", header.Get("Authorization"))
}

func TestConvertClaudeRequestUsesNativePassthrough(t *testing.T) {
	info := chatInfo()
	info.RelayFormat = types.RelayFormatClaude
	request := &dto.ClaudeRequest{Model: "claude-sonnet-4"}
	converted, err := (&Adaptor{}).ConvertClaudeRequest(nil, info, request)
	require.NoError(t, err)
	require.Same(t, request, converted)
}

func TestUnsupportedConversionsFailClearly(t *testing.T) {
	a := &Adaptor{}
	if _, err := a.ConvertEmbeddingRequest(nil, chatInfo(), dto.EmbeddingRequest{}); !errors.Is(err, errUnsupportedEndpoint) {
		t.Fatalf("embedding error = %v", err)
	}
	if _, err := a.ConvertOpenAIResponsesRequest(nil, chatInfo(), dto.OpenAIResponsesRequest{}); !errors.Is(err, errUnsupportedEndpoint) {
		t.Fatalf("responses error = %v", err)
	}
}
