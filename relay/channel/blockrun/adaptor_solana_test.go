package blockrun

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	common2 "github.com/QuantumNous/new-api/common"
	rootconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
)

func TestBlockRunSolanaSupportsRequest_FullAllowlist(t *testing.T) {
	base := &relaycommon.RelayInfo{}
	tests := []struct {
		name   string
		path   string
		mode   int
		format types.RelayFormat
		want   bool
	}{
		{name: "chat", path: "/v1/chat/completions", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatOpenAI, want: true},
		{name: "chat with query", path: "/v1/chat/completions?xxx=yyy", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatOpenAI, want: true},
		{name: "messages", path: "/v1/messages", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatClaude, want: true},
		{name: "messages with query", path: "/v1/messages?beta=true", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatClaude, want: true},
		{name: "responses native format", path: "/v1/responses", mode: relayconstant.RelayModeResponses, format: types.RelayFormatOpenAIResponses, want: true},
		{name: "responses with query", path: "/v1/responses?include[]=usage", mode: relayconstant.RelayModeResponses, format: types.RelayFormatOpenAIResponses, want: true},
		{name: "responses handler format", path: "/v1/responses", mode: relayconstant.RelayModeResponses, format: types.RelayFormatOpenAI, want: true},
		{name: "chat wrong format", path: "/v1/chat/completions", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatClaude},
		{name: "prefixed chat with query", path: "/api/open-apis/v1/chat/completions?xxx=yyy", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatOpenAI},
		{name: "messages wrong mode", path: "/v1/messages", mode: relayconstant.RelayModeCompletions, format: types.RelayFormatClaude},
		{name: "completions", path: "/v1/completions", mode: relayconstant.RelayModeCompletions, format: types.RelayFormatOpenAI},
		{name: "embeddings", path: "/v1/embeddings", mode: relayconstant.RelayModeEmbeddings, format: types.RelayFormatEmbedding},
		{name: "moderations", path: "/v1/moderations", mode: relayconstant.RelayModeModerations, format: types.RelayFormatOpenAI},
		{name: "images generations", path: "/v1/images/generations", mode: relayconstant.RelayModeImagesGenerations, format: types.RelayFormatOpenAIImage},
		{name: "images edits", path: "/v1/images/edits", mode: relayconstant.RelayModeImagesEdits, format: types.RelayFormatOpenAIImage},
		{name: "audio", path: "/v1/audio/speech", mode: relayconstant.RelayModeAudioSpeech, format: types.RelayFormatOpenAIAudio},
		{name: "rerank", path: "/v1/rerank", mode: relayconstant.RelayModeRerank, format: types.RelayFormatRerank},
		{name: "realtime", path: "/v1/realtime", mode: relayconstant.RelayModeRealtime, format: types.RelayFormatOpenAIRealtime},
		{name: "responses compact", path: "/v1/responses/compact", mode: relayconstant.RelayModeResponsesCompact, format: types.RelayFormatOpenAIResponsesCompaction},
		{name: "gemini", path: "/v1beta/models/gemini:generateContent", mode: relayconstant.RelayModeGemini, format: types.RelayFormatGemini},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			*base = relaycommon.RelayInfo{RequestURLPath: tt.path, RelayMode: tt.mode, RelayFormat: tt.format}
			if got := blockRunSolanaSupportsRequest(base); got != tt.want {
				t.Fatalf("blockRunSolanaSupportsRequest() = %t, want %t", got, tt.want)
			}
		})
	}
}

func TestGetRequestURL_SolanaRevalidatesConfigAndAllowedEndpoints(t *testing.T) {
	key, _, _, _ := solanaTestKeys()
	adaptor := &Adaptor{}
	allowed := []struct {
		path   string
		mode   int
		format types.RelayFormat
	}{
		{path: "/v1/chat/completions", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatOpenAI},
		{path: "/v1/messages", mode: relayconstant.RelayModeChatCompletions, format: types.RelayFormatClaude},
		{path: "/v1/responses", mode: relayconstant.RelayModeResponses, format: types.RelayFormatOpenAIResponses},
	}
	for _, endpoint := range allowed {
		info := solanaRequestInfo(key, endpoint.path, endpoint.mode, endpoint.format)
		got, err := adaptor.GetRequestURL(info)
		if err != nil || got != blockrunSDK.DefaultSolanaAPIURL+endpoint.path {
			t.Fatalf("GetRequestURL(%s) = %q, %v", endpoint.path, got, err)
		}
	}

	valid := solanaRequestInfo(key, "/v1/chat/completions", relayconstant.RelayModeChatCompletions, types.RelayFormatOpenAI)
	tests := []struct {
		name   string
		mutate func(*relaycommon.RelayInfo)
		want   string
	}{
		{name: "empty URL", mutate: func(info *relaycommon.RelayInfo) { info.ChannelBaseUrl = "" }, want: "base URL"},
		{name: "non-official URL", mutate: func(info *relaycommon.RelayInfo) { info.ChannelBaseUrl = "https://example.com" }, want: "base URL"},
		{name: "missing cap", mutate: func(info *relaycommon.RelayInfo) { info.ChannelOtherSettings.BlockRunMaxPaymentAtomic = "" }, want: "cap"},
		{name: "zero cap", mutate: func(info *relaycommon.RelayInfo) { info.ChannelOtherSettings.BlockRunMaxPaymentAtomic = "0" }, want: "cap"},
		{name: "malformed cap", mutate: func(info *relaycommon.RelayInfo) { info.ChannelOtherSettings.BlockRunMaxPaymentAtomic = "1.5" }, want: "cap"},
		{name: "invalid key", mutate: func(info *relaycommon.RelayInfo) { info.ApiKey = "not-base58" }, want: "wallet key"},
		{name: "unknown chain", mutate: func(info *relaycommon.RelayInfo) { info.ChannelOtherSettings.BlockRunPaymentChain = "polygon" }, want: "unsupported payment chain"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			copyInfo := *valid
			meta := *valid.ChannelMeta
			copyInfo.ChannelMeta = &meta
			tt.mutate(&copyInfo)
			if _, err := adaptor.GetRequestURL(&copyInfo); err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("error = %v, want %q", err, tt.want)
			}
		})
	}

	base := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeChatCompletions, RelayFormat: types.RelayFormatOpenAI, RequestURLPath: "/v1/chat/completions", ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"}}
	if got, err := adaptor.GetRequestURL(base); err != nil || got != "https://blockrun.ai/api/v1/chat/completions" {
		t.Fatalf("legacy Base default changed: url=%q err=%v", got, err)
	}
}

func TestSetupRequestHeader_SolanaAddsRoutingHeadersAndRejectsProtectedOverride(t *testing.T) {
	key, _, _, _ := solanaTestKeys()
	payer, err := blockrunSDK.GetSolanaPublicKey(key)
	if err != nil {
		t.Fatal(err)
	}
	info := solanaRequestInfo(key, "/v1/chat/completions", relayconstant.RelayModeChatCompletions, types.RelayFormatOpenAI)
	req := &http.Header{}
	if err := (&Adaptor{}).SetupRequestHeader(blockRunRequestContext(), req, info); err != nil {
		t.Fatal(err)
	}
	if got := req.Get(headerBlockRunFacilitator); got != blockRunFacilitator {
		t.Fatalf("facilitator = %q", got)
	}
	if got := req.Get(headerPayerWallet); got != payer {
		t.Fatalf("payer = %q, want %q", got, payer)
	}

	for _, name := range []string{"Payment-Signature", "X-Payment", "X-Blockrun-Facilitator", "X-Payer-Wallet"} {
		t.Run(name, func(t *testing.T) {
			copyInfo := *info
			meta := *info.ChannelMeta
			meta.HeadersOverride = map[string]any{name: "operator-controlled"}
			copyInfo.ChannelMeta = &meta
			if err := (&Adaptor{}).SetupRequestHeader(blockRunRequestContext(), &http.Header{}, &copyInfo); err == nil || !strings.Contains(err.Error(), "reserved") {
				t.Fatalf("expected protected override rejection, got %v", err)
			}
		})
	}

	base := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api", HeadersOverride: map[string]any{"X-Payer-Wallet": "legacy"}}}
	if err := (&Adaptor{}).SetupRequestHeader(blockRunRequestContext(), &http.Header{}, base); err == nil {
		t.Fatal("Type 100 Base protected override must also fail before payment")
	}
	base.ChannelMeta.HeadersOverride = nil
	baseHeaders := &http.Header{}
	if err := (&Adaptor{}).SetupRequestHeader(blockRunRequestContext(), baseHeaders, base); err != nil {
		t.Fatal(err)
	}
	if baseHeaders.Get(headerBlockRunFacilitator) != "" || baseHeaders.Get(headerPayerWallet) != "" {
		t.Fatalf("Base request received Solana headers: %#v", baseHeaders)
	}
}

func TestBlockRunDoRequest_MarksAttemptBeforeSignedTransportError(t *testing.T) {
	service.InitHttpClient()
	var attempts int
	baseURL := "http://blockrun.test"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			w.Header().Set(headerPaymentRequired, paymentRequiredHeader(t, baseURL+"/v1/responses"))
			w.WriteHeader(http.StatusPaymentRequired)
			return
		}
		hijacker, ok := w.(http.Hijacker)
		if !ok {
			t.Fatal("response writer does not support hijacking")
		}
		conn, _, err := hijacker.Hijack()
		if err != nil {
			t.Fatal(err)
		}
		_ = conn.Close()
	}))
	defer server.Close()
	t.Cleanup(service.ResetProxyClientCache)

	ctx := blockRunRequestContext()
	ctx.Set(common2.RequestIdKey, "request-safe-id")
	info := blockRunResponsesRequestInfo(baseURL, server.URL)
	info.ChannelType = rootconstant.ChannelTypeBlockRun
	info.ChannelId = 42
	_, err := (&Adaptor{}).DoRequest(ctx, info, strings.NewReader(`{"model":"test","input":"ping"}`))
	if err == nil {
		t.Fatal("expected signed transport error")
	}
	state, ok := relaycommon.GetBlockRunPaymentState(ctx)
	if !ok || !state.Attempted || state.Outcome != relaycommon.BlockRunPaymentOutcomeSigned {
		t.Fatalf("payment state was not marked before transport error: %#v", state)
	}
	if state.Chain != dto.BlockRunPaymentChainBase || state.ChannelID != 42 {
		t.Fatalf("unexpected payment state: %#v", state)
	}
	if strings.Contains(state.Reconciliation, fakeWalletKey) || !strings.Contains(state.Reconciliation, "payload_sha256=") || !strings.Contains(state.Reconciliation, "request_id=request-safe-id") {
		t.Fatalf("unsafe or incomplete reconciliation: %q", state.Reconciliation)
	}
	if attempts != 2 {
		t.Fatalf("attempts = %d, want unsigned + one signed attempt", attempts)
	}
}

func TestBlockRunDoRequest_SolanaRejectsUnsupportedBeforeUnsignedRequest(t *testing.T) {
	key, _, _, _ := solanaTestKeys()
	var hits int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits++ }))
	defer server.Close()
	info := solanaRequestInfo(key, "/v1/images/generations", relayconstant.RelayModeImagesGenerations, types.RelayFormatOpenAIImage)
	info.ChannelSetting.Proxy = server.URL
	_, err := (&Adaptor{}).DoRequest(blockRunRequestContext(), info, strings.NewReader(`{}`))
	if err == nil || hits != 0 {
		t.Fatalf("unsupported Solana request must fail before upstream: hits=%d err=%v", hits, err)
	}
}

func solanaRequestInfo(key, path string, mode int, format types.RelayFormat) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:      mode,
		RelayFormat:    format,
		RequestURLPath: path,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    rootconstant.ChannelTypeBlockRun,
			ChannelBaseUrl: blockrunSDK.DefaultSolanaAPIURL,
			ApiKey:         key,
			ChannelOtherSettings: dto.ChannelOtherSettings{
				BlockRunPaymentChain:     dto.BlockRunPaymentChainSolana,
				BlockRunMaxPaymentAtomic: "1000",
			},
		},
	}
}
