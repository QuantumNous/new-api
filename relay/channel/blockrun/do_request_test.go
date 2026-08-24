package blockrun

import (
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type blockRunRecordedRequest struct {
	path      string
	body      string
	signature string
}

func TestBlockRunDoRequest_ResponsesX402DoubleHop(t *testing.T) {
	var (
		mu       sync.Mutex
		requests []blockRunRecordedRequest
	)
	baseURL := "http://blockrun.test"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		requests = append(requests, blockRunRecordedRequest{path: r.URL.Path, body: string(body), signature: r.Header.Get(headerPaymentSignature)})
		attempt := len(requests)
		mu.Unlock()

		if attempt == 1 {
			w.Header().Set(headerPaymentRequired, paymentRequiredHeader(t, baseURL+"/v1/responses"))
			w.WriteHeader(http.StatusPaymentRequired)
			_, _ = w.Write([]byte(`{"error":"payment required"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_paid","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	}))
	defer srv.Close()
	t.Cleanup(service.ResetProxyClientCache)

	body := `{"model":"openai/gpt-5.4","input":"ping","client_metadata":{"sequence":9007199254740993},"stream_options":{"include_usage":true}}`
	respAny, err := (&Adaptor{}).DoRequest(blockRunRequestContext(), blockRunResponsesRequestInfo(baseURL, srv.URL), strings.NewReader(body))
	if err != nil {
		t.Fatalf("BlockRun Responses x402 double hop: %v", err)
	}
	resp, ok := respAny.(*http.Response)
	if !ok {
		t.Fatalf("expected *http.Response, got %T", respAny)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("signed response status = %d, want 200", resp.StatusCode)
	}

	mu.Lock()
	got := append([]blockRunRecordedRequest(nil), requests...)
	mu.Unlock()
	if len(got) != 2 {
		t.Fatalf("request count = %d, want exactly 2", len(got))
	}
	for i, req := range got {
		if req.path != "/v1/responses" {
			t.Fatalf("request %d path = %q, want /v1/responses", i+1, req.path)
		}
		if strings.Contains(req.body, "stream_options") {
			t.Fatalf("request %d still contains stream_options: %s", i+1, req.body)
		}
		if !strings.Contains(req.body, `"sequence":9007199254740993`) {
			t.Fatalf("request %d changed large integer JSON literal: %s", i+1, req.body)
		}
	}
	if got[0].body != got[1].body {
		t.Fatalf("payment retry body changed:\n first %s\nsecond %s", got[0].body, got[1].body)
	}
	if got[0].signature != "" {
		t.Fatalf("first request unexpectedly carried payment signature")
	}
	if got[1].signature == "" {
		t.Fatalf("signed retry did not carry payment signature")
	}
}

func TestBlockRunDoRequest_ResponsesSecond402Stops(t *testing.T) {
	var (
		mu       sync.Mutex
		requests []blockRunRecordedRequest
	)
	baseURL := "http://blockrun.test"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		mu.Lock()
		requests = append(requests, blockRunRecordedRequest{path: r.URL.Path, body: string(body), signature: r.Header.Get(headerPaymentSignature)})
		attempt := len(requests)
		mu.Unlock()

		if attempt == 1 {
			w.Header().Set(headerPaymentRequired, paymentRequiredHeader(t, baseURL+"/v1/responses"))
		}
		w.WriteHeader(http.StatusPaymentRequired)
		responseBody, marshalErr := common.Marshal(map[string]any{
			"error": map[string]any{
				"message": "insufficient balance; Payment-Signature " + r.Header.Get(headerPaymentSignature),
				"code":    "PAYMENT_REJECTED",
				"reason":  "insufficient_funds",
			},
		})
		if marshalErr != nil {
			t.Errorf("marshal rejection response: %v", marshalErr)
			return
		}
		_, _ = w.Write(responseBody)
	}))
	defer srv.Close()
	t.Cleanup(service.ResetProxyClientCache)

	body := `{"model":"openai/gpt-5.4","input":"ping","stream_options":{"include_usage":true}}`
	ctx := blockRunRequestContext()
	resp, err := (&Adaptor{}).DoRequest(ctx, blockRunResponsesRequestInfo(baseURL, srv.URL), strings.NewReader(body))
	var apiErr *types.NewAPIError
	if err == nil || !errors.As(err, &apiErr) {
		t.Fatalf("expected typed signed 402 hard failure, got resp=%v err=%v", resp, err)
	}
	if apiErr.StatusCode != http.StatusPaymentRequired || apiErr.GetErrorCode() != types.ErrorCodeBadResponseStatusCode || !types.IsSkipRetryError(apiErr) {
		t.Fatalf("signed 402 error semantics changed: status=%d code=%s skip_retry=%t", apiErr.StatusCode, apiErr.GetErrorCode(), types.IsSkipRetryError(apiErr))
	}
	if !strings.Contains(err.Error(), "insufficient balance") ||
		!strings.Contains(err.Error(), "PAYMENT_REJECTED") ||
		!strings.Contains(err.Error(), "insufficient_funds") {
		t.Fatalf("signed 402 error omitted upstream rejection detail: %v", err)
	}
	if strings.Contains(err.Error(), "payment signature rejected by upstream") {
		t.Fatalf("signed 402 error kept the gateway fallback instead of upstream detail: %v", err)
	}

	mu.Lock()
	got := append([]blockRunRecordedRequest(nil), requests...)
	mu.Unlock()
	if len(got) != 2 {
		t.Fatalf("request count = %d, want exactly 2 with no third attempt", len(got))
	}
	if got[0].signature != "" || got[1].signature == "" {
		t.Fatalf("unexpected signature sequence: first=%t second=%t", got[0].signature != "", got[1].signature != "")
	}
	if strings.Contains(err.Error(), got[1].signature) {
		t.Fatalf("signed 402 error leaked payment signature: %v", err)
	}
	if got[0].body != got[1].body || strings.Contains(got[0].body, "stream_options") {
		t.Fatalf("request body changed across payment retry: %#v", got)
	}
	state, ok := relaycommon.GetBlockRunPaymentState(ctx)
	if !ok || state.Outcome != relaycommon.BlockRunPaymentOutcomeRejected {
		t.Fatalf("signed 402 payment state = %#v, want rejected", state)
	}
	if strings.Contains(state.Reconciliation, got[1].signature) || strings.Contains(string(state.Outcome), got[1].signature) {
		t.Fatalf("signed 402 loggable payment state leaked payment signature: %#v", state)
	}
}

func TestBlockRunDoRequest_ChatKeepsStreamOptions(t *testing.T) {
	var gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		gotBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chatcmpl-test","object":"chat.completion","choices":[]}`))
	}))
	defer srv.Close()
	t.Cleanup(service.ResetProxyClientCache)

	body := `{"model":"openai/gpt-5.4","messages":[],"stream_options":{"include_usage":true}}`
	respAny, err := (&Adaptor{}).DoRequest(blockRunRequestContext(), blockRunChatRequestInfo("http://blockrun.test", srv.URL), strings.NewReader(body))
	if err != nil {
		t.Fatalf("BlockRun Chat request: %v", err)
	}
	resp := respAny.(*http.Response)
	defer resp.Body.Close()
	if gotBody != body {
		t.Fatalf("Chat request body changed:\n got %s\nwant %s", gotBody, body)
	}
}

func paymentRequiredHeader(t *testing.T, resourceURL string) string {
	t.Helper()
	requirement := blockrunSDK.PaymentRequirement{
		X402Version: 2,
		Accepts: []blockrunSDK.PaymentOption{
			{
				Scheme:            "exact",
				Network:           expectedNetworkBase,
				Amount:            "3000",
				Asset:             expectedAssetUSDCBase,
				PayTo:             "0x000000000000000000000000000000000000dEaD",
				MaxTimeoutSeconds: maxAuthorizationWindowSeconds,
				Extra:             map[string]any{"name": "USD Coin", "version": "2"},
			},
		},
		Resource: blockrunSDK.ResourceInfo{
			URL:         resourceURL,
			Description: "BlockRun native Responses test",
			MimeType:    "application/json",
		},
	}
	data, err := common.Marshal(requirement)
	if err != nil {
		t.Fatalf("marshal payment requirement: %v", err)
	}
	return base64.StdEncoding.EncodeToString(data)
}

func blockRunRequestContext() *gin.Context {
	c := newTestContext(http.MethodPost, "/v1/responses", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func blockRunResponsesRequestInfo(baseURL, proxyURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeResponses,
		RelayFormat:    types.RelayFormatOpenAI,
		RequestURLPath: "/v1/responses",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: baseURL,
			ApiKey:         fakeWalletKey,
			ChannelSetting: dto.ChannelSettings{Proxy: proxyURL},
		},
	}
}

func blockRunChatRequestInfo(baseURL, proxyURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatOpenAI,
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: baseURL,
			ChannelSetting: dto.ChannelSettings{Proxy: proxyURL},
		},
	}
}
