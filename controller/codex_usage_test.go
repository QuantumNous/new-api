package controller

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestNewCodexLimitReportContextUsesSixtySecondDeadline(t *testing.T) {
	startedAt := time.Now()
	ctx, cancel := newCodexLimitReportContext(context.Background())
	defer cancel()

	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("expected codex limit report context to have a deadline")
	}

	timeout := deadline.Sub(startedAt)
	if timeout < 59*time.Second || timeout > 61*time.Second {
		t.Fatalf("codex limit report timeout = %s, want about 60s", timeout)
	}
	if codexLimitReportRequestTimeout != 60*time.Second {
		t.Fatalf("codexLimitReportRequestTimeout = %s, want 60s", codexLimitReportRequestTimeout)
	}
}

func TestRunCodexLimitReportRebuildsCacheOnceForConcurrentRefreshes(t *testing.T) {
	original := rebuildCodexChannelCache
	var rebuilds int32
	rebuildCodexChannelCache = func() { atomic.AddInt32(&rebuilds, 1) }
	t.Cleanup(func() { rebuildCodexChannelCache = original })

	channels := make([]*model.Channel, 10)
	for i := range channels {
		channels[i] = &model.Channel{Id: i + 1, Name: "Codex", Type: constant.ChannelTypeCodex}
	}

	// Every channel reports a refreshed key. The per-channel rebuilds must be
	// coalesced into a single rebuild after all concurrent fetches complete.
	refreshFetcher := func(ctx context.Context, channel *model.Channel) (int, []byte, bool, error) {
		return http.StatusOK, []byte(`{}`), true, nil
	}

	runCodexLimitReport(context.Background(), channels, refreshFetcher, nil, 0, 0)

	if got := atomic.LoadInt32(&rebuilds); got != 1 {
		t.Fatalf("rebuildCodexChannelCache called %d times, want 1", got)
	}
}

func TestRunCodexLimitReportSkipsCacheRebuildWithoutRefreshes(t *testing.T) {
	original := rebuildCodexChannelCache
	var rebuilds int32
	rebuildCodexChannelCache = func() { atomic.AddInt32(&rebuilds, 1) }
	t.Cleanup(func() { rebuildCodexChannelCache = original })

	channels := []*model.Channel{
		{Id: 1, Name: "Codex", Type: constant.ChannelTypeCodex},
		{Id: 2, Name: "Codex", Type: constant.ChannelTypeCodex},
	}

	refreshFetcher := func(ctx context.Context, channel *model.Channel) (int, []byte, bool, error) {
		return http.StatusOK, []byte(`{}`), false, nil
	}

	runCodexLimitReport(context.Background(), channels, refreshFetcher, nil, 0, 0)

	if got := atomic.LoadInt32(&rebuilds); got != 0 {
		t.Fatalf("rebuildCodexChannelCache called %d times, want 0", got)
	}
}

// The 401->refresh->retry path of codexChannelUpstreamWithRefresh exercises
// model.UpdateChannelKey + RefreshCodexOAuthTokenWithProxy (DB + network) and is
// covered by the byte-for-byte-preserved refactor plus manual verification. The
// tests below lock the DB-free contract of the shared wrapper: the type/multi-key
// guards short-circuit before any upstream call, and a 2xx response returns the
// injected result without a retry or a key refresh.

func TestCodexChannelUpstreamWithRefreshHappyPathNoRefresh(t *testing.T) {
	service.InitHttpClient()

	ch := &model.Channel{
		Id:   1,
		Type: constant.ChannelTypeCodex,
		Key:  `{"access_token":"at-123","account_id":"acct-123"}`,
	}
	calls := 0
	gotToken := ""
	gotAccount := ""
	status, body, refreshed, err := codexChannelUpstreamWithRefresh(
		context.Background(), ch,
		func(client *http.Client, accessToken, accountID string) (int, []byte, error) {
			calls++
			gotToken = accessToken
			gotAccount = accountID
			return http.StatusOK, []byte("pong"), nil
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status != http.StatusOK || string(body) != "pong" {
		t.Fatalf("status=%d body=%q, want 200/pong", status, body)
	}
	if refreshed {
		t.Fatal("refreshed should be false on a 200 response")
	}
	if calls != 1 {
		t.Fatalf("do called %d times, want 1 (no retry on 200)", calls)
	}
	if gotToken != "at-123" || gotAccount != "acct-123" {
		t.Fatalf("do received token=%q account=%q, want at-123/acct-123", gotToken, gotAccount)
	}
}

func TestCodexChannelUpstreamWithRefreshRejectsNonCodex(t *testing.T) {
	ch := &model.Channel{Id: 1, Type: constant.ChannelTypeOpenAI}
	called := false
	_, _, _, err := codexChannelUpstreamWithRefresh(
		context.Background(), ch,
		func(*http.Client, string, string) (int, []byte, error) {
			called = true
			return http.StatusOK, nil, nil
		},
	)
	if err == nil {
		t.Fatal("expected error for non-Codex channel")
	}
	if called {
		t.Fatal("do must not be called for a non-Codex channel")
	}
}

func TestCodexChannelUpstreamWithRefreshRejectsMultiKey(t *testing.T) {
	ch := &model.Channel{
		Id:          1,
		Type:        constant.ChannelTypeCodex,
		ChannelInfo: model.ChannelInfo{IsMultiKey: true},
	}
	called := false
	_, _, _, err := codexChannelUpstreamWithRefresh(
		context.Background(), ch,
		func(*http.Client, string, string) (int, []byte, error) {
			called = true
			return http.StatusOK, nil, nil
		},
	)
	if err == nil {
		t.Fatal("expected error for multi-key channel")
	}
	if called {
		t.Fatal("do must not be called for a multi-key channel")
	}
}

func TestEnsureCodexInviteRecipientConsentRequiresConfirmation(t *testing.T) {
	statusBody := []byte(`{"invite_eligibility":{"requires_explicit_confirmation":true}}`)
	if err := ensureCodexInviteRecipientConsent(statusBody, false); err == nil {
		t.Fatal("expected missing confirmation to be rejected")
	}
	if err := ensureCodexInviteRecipientConsent(statusBody, true); err != nil {
		t.Fatalf("confirmed consent rejected: %v", err)
	}
}

func TestSendCodexInviteRejectsOversizedBodyBeforeChannelLookup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body := `{"emails":["` + strings.Repeat("a", int(maxCodexInviteRequestBodyBytes)) + `@example.com"]}`
	req := httptest.NewRequest(http.MethodPost, "/api/channel/1/codex/invite", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "1"}}

	SendCodexInvite(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status code = %d, want %d", recorder.Code, http.StatusOK)
	}
	if !strings.Contains(recorder.Body.String(), "http: request body too large") {
		t.Fatalf("response body = %s", recorder.Body.String())
	}
}
