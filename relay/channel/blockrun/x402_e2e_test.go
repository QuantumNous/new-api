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
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
)

const liveModel = "anthropic/claude-haiku-4.5" // cheapest of the Claude set

// liveURL is derived from the same constant the production adaptor uses so the
// test doesn't drift if the default base URL changes.
var liveURL = constant.ChannelBaseURLs[constant.ChannelTypeBlockRun] + "/v1/chat/completions"

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

	paymentB64, err := signX402Payment(firstResp, key, liveURL)
	if err != nil {
		t.Fatalf("signX402Payment: %v", err)
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
