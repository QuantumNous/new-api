package blockrun

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestIsStaleSolanaPaymentResponse(t *testing.T) {
	tests := []struct {
		name string
		body string
		want bool
	}{
		{name: "current OpenAI reason", body: `{"error":"Payment verification failed","code":"PAYMENT_INVALID","reason":"expired_signature"}`, want: true},
		{name: "Anthropic nested reason", body: `{"error":{"message":"Payment verification failed: expired_signature"}}`, want: true},
		{name: "legacy blockhash code", body: `{"code":"PAYMENT_BLOCKHASH_STALE"}`, want: true},
		{name: "legacy simulation detail", body: `{"code":"PAYMENT_INVALID","invalidMessage":"BlockhashNotFound"}`, want: true},
		{name: "insufficient funds", body: `{"code":"PAYMENT_INVALID","reason":"insufficient_funds"}`, want: false},
		{name: "settlement expired signature", body: `{"error":"Payment settlement failed","code":"SETTLEMENT_FAILED","reason":"expired_signature"}`, want: false},
		{name: "non JSON", body: `<html>BlockhashNotFound</html>`, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{StatusCode: http.StatusPaymentRequired, Body: io.NopCloser(strings.NewReader(tt.body))}
			if got := isStaleSolanaPaymentResponse(resp); got != tt.want {
				t.Fatalf("isStaleSolanaPaymentResponse() = %t, want %t", got, tt.want)
			}
			gotBody, err := io.ReadAll(resp.Body)
			if err != nil || string(gotBody) != tt.body {
				t.Fatalf("response body was not restored: %q, %v", gotBody, err)
			}
		})
	}
}

func TestIsStaleSolanaPaymentResponseRejectsOversizedBody(t *testing.T) {
	body := `{"code":"PAYMENT_BLOCKHASH_STALE","padding":"` + strings.Repeat("x", maxStalePaymentErrorBytes) + `"}`
	resp := &http.Response{StatusCode: http.StatusPaymentRequired, Body: io.NopCloser(strings.NewReader(body))}
	if isStaleSolanaPaymentResponse(resp) {
		t.Fatal("oversized rejection must not trigger a re-sign")
	}
	got, err := io.ReadAll(resp.Body)
	if err != nil || string(got) != body {
		t.Fatalf("oversized response body was not restored: %d bytes, %v", len(got), err)
	}
}
