//go:build e2e_blockrun

// This file is gated behind the `e2e_blockrun` build tag and is NEVER compiled
// in regular CI or `go test ./...` runs. To execute:
//
//	BLOCKRUN_TEST_WALLET_KEY=0x... \
//	  go test -tags=e2e_blockrun -v ./relay/channel/blockrun/...
//
// It performs a real HTTP round-trip against https://blockrun.ai with the
// wallet key provided via env var (we never commit private keys). Each
// invocation spends a small amount of USDC on Base mainnet — keep test
// budgets in mind.

package blockrun

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

const liveModel = "anthropic/claude-haiku-4.5" // cheapest of the Claude set

// liveURL is derived from the same constant the production adaptor uses so the
// test doesn't drift if the default base URL changes.
var liveURL = constant.ChannelBaseURLs[constant.ChannelTypeBlockRun] + "/v1/chat/completions"

var liveResponsesURL = constant.ChannelBaseURLs[constant.ChannelTypeBlockRun] + "/v1/responses"

func TestX402LiveRoundTrip(t *testing.T) {
	key := os.Getenv("BLOCKRUN_TEST_WALLET_KEY")
	if key == "" {
		t.Skip("set BLOCKRUN_TEST_WALLET_KEY to run the live x402 e2e test")
	}

	body, _ := json.Marshal(map[string]any{
		"model":      liveModel,
		"messages":   []map[string]string{{"role": "user", "content": "Reply with exactly one word: pong"}},
		"max_tokens": 20,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, liveURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build first request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{Timeout: 90 * time.Second}
	firstResp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("first request: %v", err)
	}
	if firstResp.StatusCode != http.StatusPaymentRequired {
		_ = firstResp.Body.Close()
		t.Fatalf("expected 402 on first request, got %d", firstResp.StatusCode)
	}
	_, _ = io.Copy(io.Discard, firstResp.Body)
	_ = firstResp.Body.Close()

	paymentB64, err := SignX402Payment(firstResp, key, liveURL)
	if err != nil {
		t.Fatalf("SignX402Payment: %v", err)
	}
	if paymentB64 == "" {
		t.Fatalf("empty payment payload")
	}

	retry, err := http.NewRequestWithContext(ctx, http.MethodPost, liveURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build retry request: %v", err)
	}
	retry.Header.Set("Content-Type", "application/json")
	retry.Header.Set(headerPaymentSignature, paymentB64)

	resp, err := httpClient.Do(retry)
	if err != nil {
		t.Fatalf("retry request: %v", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 after payment, got %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		t.Fatalf("decode response: %v\nbody: %s", err, string(respBody))
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		t.Fatalf("empty choices in response: %s", string(respBody))
	}

	settle := resp.Header.Get("payment-response")
	if settle != "" {
		t.Logf("payment-response header (base64 settlement receipt): %s", settle)
	}
	t.Logf("model reply: %q", strings.TrimSpace(parsed.Choices[0].Message.Content))
}

func TestX402LiveResponsesRoundTrip(t *testing.T) {
	key := os.Getenv("BLOCKRUN_TEST_WALLET_KEY")
	if key == "" {
		t.Skip("set BLOCKRUN_TEST_WALLET_KEY to run the live x402 e2e test")
	}

	body, err := common.Marshal(map[string]any{
		"model": "openai/gpt-5.4",
		"input": "Use the shell tool to run: printf pong",
		"tools": []map[string]any{
			{
				"type":        "custom",
				"name":        "shell",
				"description": "Run a shell command",
				"format":      map[string]any{"type": "text"},
			},
		},
		"tool_choice": map[string]any{"type": "custom", "name": "shell"},
	})
	if err != nil {
		t.Fatalf("marshal Responses request: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	httpClient := &http.Client{Timeout: 90 * time.Second}

	firstReq, err := http.NewRequestWithContext(ctx, http.MethodPost, liveResponsesURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build first Responses request: %v", err)
	}
	firstReq.Header.Set("Content-Type", "application/json")
	firstResp, err := httpClient.Do(firstReq)
	if err != nil {
		t.Fatalf("first Responses request: %v", err)
	}
	if firstResp.StatusCode != http.StatusPaymentRequired {
		_ = firstResp.Body.Close()
		t.Fatalf("expected 402 on first Responses request, got %d", firstResp.StatusCode)
	}
	paymentRequired, err := extractPaymentRequired(firstResp)
	if err != nil {
		_ = firstResp.Body.Close()
		t.Fatalf("parse Responses payment requirement: %v", err)
	}
	if paymentRequired.Resource.URL != liveResponsesURL {
		_ = firstResp.Body.Close()
		t.Fatalf("payment resource URL = %q, want %q", paymentRequired.Resource.URL, liveResponsesURL)
	}
	paymentB64, err := SignX402Payment(firstResp, key, liveResponsesURL)
	_, _ = io.Copy(io.Discard, firstResp.Body)
	_ = firstResp.Body.Close()
	if err != nil {
		t.Fatalf("sign Responses payment: %v", err)
	}

	retry, err := http.NewRequestWithContext(ctx, http.MethodPost, liveResponsesURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build signed Responses request: %v", err)
	}
	retry.Header.Set("Content-Type", "application/json")
	retry.Header.Set(headerPaymentSignature, paymentB64)
	resp, err := httpClient.Do(retry)
	if err != nil {
		t.Fatalf("signed Responses request: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 after Responses payment, got %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed struct {
		ID     string `json:"id"`
		Object string `json:"object"`
		Output []struct {
			Type  string `json:"type"`
			Name  string `json:"name"`
			Input string `json:"input"`
		} `json:"output"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
			TotalTokens  int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := common.Unmarshal(respBody, &parsed); err != nil {
		t.Fatalf("decode native Responses body: %v\nbody: %s", err, string(respBody))
	}
	if !strings.HasPrefix(parsed.ID, "resp_") || parsed.Object != "response" {
		t.Fatalf("unexpected native Responses envelope: id=%q object=%q", parsed.ID, parsed.Object)
	}
	if parsed.Usage.InputTokens <= 0 || parsed.Usage.OutputTokens <= 0 || parsed.Usage.TotalTokens <= 0 {
		t.Fatalf("native Responses usage missing: %#v", parsed.Usage)
	}
	foundCustomTool := false
	for _, output := range parsed.Output {
		if output.Type == "custom_tool_call" && output.Name == "shell" && output.Input != "" {
			foundCustomTool = true
			break
		}
	}
	if !foundCustomTool {
		t.Fatalf("native custom_tool_call not preserved: %s", string(respBody))
	}
}

func TestX402LiveResponsesStreamUsage(t *testing.T) {
	key := os.Getenv("BLOCKRUN_TEST_WALLET_KEY")
	if key == "" {
		t.Skip("set BLOCKRUN_TEST_WALLET_KEY to run the live x402 e2e test")
	}

	body, err := common.Marshal(map[string]any{
		"model":  "openai/gpt-5.4",
		"input":  "Reply with exactly one word: pong",
		"stream": true,
	})
	if err != nil {
		t.Fatalf("marshal streaming Responses request: %v", err)
	}
	if bytes.Contains(body, []byte("stream_options")) {
		t.Fatalf("streaming paid fixture must not send stream_options")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	resp := paidLiveResponsesRequest(t, ctx, key, body)
	defer resp.Body.Close()

	var (
		createdID    string
		completedID  string
		inputTokens  int
		outputTokens int
		totalTokens  int
		sawCreated   bool
		sawTextDelta bool
		sawCompleted bool
	)
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}
		var event struct {
			Type     string `json:"type"`
			Delta    string `json:"delta"`
			Response *struct {
				ID    string `json:"id"`
				Usage *struct {
					InputTokens  int `json:"input_tokens"`
					OutputTokens int `json:"output_tokens"`
					TotalTokens  int `json:"total_tokens"`
				} `json:"usage"`
			} `json:"response"`
		}
		if err := common.Unmarshal([]byte(data), &event); err != nil {
			t.Fatalf("decode native Responses SSE event: %v\ndata: %s", err, data)
		}
		switch event.Type {
		case "response.created":
			sawCreated = true
			if event.Response != nil {
				createdID = event.Response.ID
			}
		case "response.output_text.delta":
			if event.Delta != "" {
				sawTextDelta = true
			}
		case "response.completed":
			sawCompleted = true
			if event.Response != nil {
				completedID = event.Response.ID
				if event.Response.Usage != nil {
					inputTokens = event.Response.Usage.InputTokens
					outputTokens = event.Response.Usage.OutputTokens
					totalTokens = event.Response.Usage.TotalTokens
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read native Responses SSE: %v", err)
	}
	if !sawCreated || !sawTextDelta || !sawCompleted {
		t.Fatalf("missing native Responses SSE lifecycle: created=%t text_delta=%t completed=%t", sawCreated, sawTextDelta, sawCompleted)
	}
	if !strings.HasPrefix(createdID, "resp_") || completedID != createdID {
		t.Fatalf("unexpected response ids: created=%q completed=%q", createdID, completedID)
	}
	if inputTokens <= 0 || outputTokens <= 0 || totalTokens <= 0 {
		t.Fatalf("response.completed usage missing: input=%d output=%d total=%d", inputTokens, outputTokens, totalTokens)
	}
}

func paidLiveResponsesRequest(t *testing.T, ctx context.Context, key string, body []byte) *http.Response {
	t.Helper()
	httpClient := &http.Client{Timeout: 90 * time.Second}
	firstReq, err := http.NewRequestWithContext(ctx, http.MethodPost, liveResponsesURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build first streaming Responses request: %v", err)
	}
	firstReq.Header.Set("Content-Type", "application/json")
	firstResp, err := httpClient.Do(firstReq)
	if err != nil {
		t.Fatalf("first streaming Responses request: %v", err)
	}
	if firstResp.StatusCode != http.StatusPaymentRequired {
		_ = firstResp.Body.Close()
		t.Fatalf("expected 402 on first streaming Responses request, got %d", firstResp.StatusCode)
	}
	paymentRequired, err := extractPaymentRequired(firstResp)
	if err != nil {
		_ = firstResp.Body.Close()
		t.Fatalf("parse streaming Responses payment requirement: %v", err)
	}
	if paymentRequired.Resource.URL != liveResponsesURL {
		_ = firstResp.Body.Close()
		t.Fatalf("streaming payment resource URL = %q, want %q", paymentRequired.Resource.URL, liveResponsesURL)
	}
	paymentB64, err := SignX402Payment(firstResp, key, liveResponsesURL)
	_, _ = io.Copy(io.Discard, firstResp.Body)
	_ = firstResp.Body.Close()
	if err != nil {
		t.Fatalf("sign streaming Responses payment: %v", err)
	}

	retry, err := http.NewRequestWithContext(ctx, http.MethodPost, liveResponsesURL, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build signed streaming Responses request: %v", err)
	}
	retry.Header.Set("Content-Type", "application/json")
	retry.Header.Set("Accept", "text/event-stream")
	retry.Header.Set(headerPaymentSignature, paymentB64)
	resp, err := httpClient.Do(retry)
	if err != nil {
		t.Fatalf("signed streaming Responses request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		t.Fatalf("expected 200 after streaming Responses payment, got %d: %s", resp.StatusCode, string(respBody))
	}
	return resp
}
