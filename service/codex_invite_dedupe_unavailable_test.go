package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestSendCodexInviteErrorsWhenRedisDedupeUnavailable(t *testing.T) {
	prevEnabled, prevRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		common.RedisEnabled = prevEnabled
		common.RDB = prevRDB
	})

	requests := 0
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"}]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	_, _, err := SendCodexInvite(
		context.Background(),
		srv.Client(),
		srv.URL,
		"tok-abc",
		"acct-123",
		[]string{"a@example.com"},
	)
	if err == nil {
		t.Fatal("expected dedupe unavailable error")
	}
	if !strings.Contains(err.Error(), "codex invite dedupe is unavailable") {
		t.Fatalf("unexpected error: %v", err)
	}
	if requests != 0 {
		t.Fatalf("requests = %d, want 0", requests)
	}
}
