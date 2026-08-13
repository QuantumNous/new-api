package copilot

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func chatInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId:            42,
			ChannelMultiKeyIndex: 3,
			ChannelBaseUrl:       "https://attacker.example",
			ApiKey:               "github-credential",
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

func TestSetupRequestHeaderUsesResolvedTokenAndCopilotIdentity(t *testing.T) {
	original := resolveAccessToken
	t.Cleanup(func() { resolveAccessToken = original })
	resolveAccessToken = func(ctx context.Context, channelID, keyIndex int, credential, proxyURL string) (string, error) {
		if channelID != 42 || keyIndex != 3 || credential != "github-credential" || proxyURL != "socks5://proxy.example:1080" {
			t.Fatalf("unexpected resolver args: channel=%d key=%d credential=%q proxy=%q", channelID, keyIndex, credential, proxyURL)
		}
		return "short-copilot-token", nil
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = req
	header := http.Header{}
	if err := (&Adaptor{}).SetupRequestHeader(c, &header, chatInfo()); err != nil {
		t.Fatal(err)
	}

	wants := map[string]string{
		"Authorization":          "Bearer short-copilot-token",
		"Accept":                 "application/json",
		"Content-Type":           "application/json",
		"User-Agent":             userAgent,
		"Editor-Version":         editorVersion,
		"Editor-Plugin-Version":  editorPlugin,
		"Copilot-Integration-Id": integrationID,
	}
	for name, want := range wants {
		if got := header.Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	if strings.Contains(header.Get("Authorization"), "github-credential") {
		t.Fatal("GitHub credential leaked into upstream authorization header")
	}
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
