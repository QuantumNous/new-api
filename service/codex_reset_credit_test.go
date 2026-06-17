package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/google/uuid"
)

// uuidV4Pattern matches a canonical hyphenated UUID-v4 (8-4-4-4-12).
var uuidV4Pattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestConsumeCodexResetCreditSendsExpectedRequest(t *testing.T) {
	var (
		gotMethod   string
		gotPath     string
		gotHeaders  http.Header
		gotBodyKeys map[string]string
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotHeaders = r.Header.Clone()
		raw, _ := io.ReadAll(r.Body)
		_ = common.Unmarshal(raw, &gotBodyKeys)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":"ok","windows_reset":1}`))
	}))
	defer srv.Close()

	redeemID := uuid.NewString()
	status, body, err := ConsumeCodexResetCredit(
		context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", redeemID,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("method = %s, want POST", gotMethod)
	}
	if gotPath != "/backend-api/wham/rate-limit-reset-credits/consume" {
		t.Fatalf("path = %s", gotPath)
	}

	// Assert the full Codex Desktop header contract, verbatim.
	wantHeaders := map[string]string{
		"Authorization":      "Bearer tok-abc",
		"chatgpt-account-id": "acct-123",
		"content-type":       "application/json",
		"originator":         "Codex Desktop",
		"oai-language":       "zh-CN",
		"accept":             "application/json",
		"sec-fetch-site":     "none",
		"sec-fetch-mode":     "no-cors",
		"sec-fetch-dest":     "empty",
		"priority":           "u=4, i",
	}
	for name, want := range wantHeaders {
		if got := gotHeaders.Get(name); got != want {
			t.Fatalf("header %s = %q, want %q", name, got, want)
		}
	}

	// Body must be exactly one key: a canonical UUID-v4 redeem_request_id.
	if len(gotBodyKeys) != 1 {
		t.Fatalf("body should have exactly one key, got %#v", gotBodyKeys)
	}
	id := strings.TrimSpace(gotBodyKeys["redeem_request_id"])
	if id != redeemID {
		t.Fatalf("redeem_request_id = %q, want the caller-supplied id %q (echoed verbatim)", id, redeemID)
	}
	if !uuidV4Pattern.MatchString(id) {
		t.Fatalf("redeem_request_id = %q, want canonical hyphenated UUID-v4", id)
	}
	if !strings.Contains(string(body), "windows_reset") {
		t.Fatalf("body not passed through: %s", body)
	}
}

func TestConsumeCodexResetCreditValidatesArgs(t *testing.T) {
	rid := uuid.NewString()
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "", "tok", "acct", rid); err == nil {
		t.Fatal("expected error for empty baseURL")
	}
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "https://x", "", "acct", rid); err == nil {
		t.Fatal("expected error for empty accessToken")
	}
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "https://x", "tok", "", rid); err == nil {
		t.Fatal("expected error for empty accountID")
	}
	if _, _, err := ConsumeCodexResetCredit(context.Background(), http.DefaultClient, "https://x", "tok", "acct", "  "); err == nil {
		t.Fatal("expected error for empty redeemRequestID")
	}
}
