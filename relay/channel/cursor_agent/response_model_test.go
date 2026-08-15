package cursor_agent

import (
	"io"
	"net/http"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestRewriteCursorResponseModelHidesInternalCatalogID(t *testing.T) {
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(
		"event: message_start\n" +
			`data: {"type":"message_start","message":{"model":"cursor-grok-4.6-high","content":[]}}` + "\n\n" +
			`data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"cursor-grok-4.6-high stays in content"}}` + "\n",
	))}
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-4.6",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "cursor-grok-4.6-high"},
	}

	rewriteCursorResponseModel(resp, info)
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	body := string(raw)
	if !strings.Contains(body, `"model":"grok-4.6"`) {
		t.Fatalf("public model missing: %s", body)
	}
	if !strings.Contains(body, "cursor-grok-4.6-high stays in content") {
		t.Fatalf("content was unexpectedly rewritten: %s", body)
	}
	if info.UpstreamModelName != "grok-4.6" {
		t.Fatalf("handler fallback model=%q", info.UpstreamModelName)
	}
}

func TestRewriteCursorResponseModelHandlesResponsesJSON(t *testing.T) {
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(
		`{"id":"resp_1","model":"cursor-grok-4.5-medium","output":[]}`,
	))}
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-4.5",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "cursor-grok-4.5-medium"},
	}
	rewriteCursorResponseModel(resp, info)
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"model":"grok-4.5"`) {
		t.Fatalf("rewritten response=%s", raw)
	}
}

func TestRewriteCursorResponseModelHidesEffortVariantAfterHandlerReset(t *testing.T) {
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(
		`data: {"model":"cursor-grok-4.6-high","choices":[{"delta":{"tool_calls":[]}}]}` + "\n",
	))}
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-4.6",
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "grok-4.6"},
	}
	rewriteCursorResponseModel(resp, info)
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	got := string(raw)
	if strings.Contains(got, "cursor-grok-4.6-high") {
		t.Fatalf("internal effort model leaked: %s", got)
	}
	if !strings.Contains(got, `"model":"grok-4.6"`) {
		t.Fatalf("public model missing: %s", got)
	}
}
