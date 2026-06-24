package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
)

type codexInviteRoundTripFunc func(*http.Request) (*http.Response, error)

func (f codexInviteRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestNormalizeCodexInviteEmails(t *testing.T) {
	got, err := NormalizeCodexInviteEmails([]string{"a@example.com, b@example.com", "A@example.com", " c@example.com\n"})
	if err != nil {
		t.Fatalf("NormalizeCodexInviteEmails() error = %v", err)
	}
	want := []string{"a@example.com", "b@example.com", "c@example.com"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("NormalizeCodexInviteEmails() = %#v, want %#v", got, want)
	}
}

func TestNormalizeCodexInviteEmailsRejectsInvalidAndTooMany(t *testing.T) {
	if _, err := NormalizeCodexInviteEmails([]string{"bad-email"}); err == nil {
		t.Fatal("expected invalid email error")
	}
	if _, err := NormalizeCodexInviteEmails([]string{"a@e.com", "b@e.com", "c@e.com", "d@e.com", "e@e.com", "f@e.com"}); err == nil {
		t.Fatal("expected too many emails error")
	}
}

func TestSendCodexInviteSendsExpectedRequest(t *testing.T) {
	var gotPath string
	var gotHeaders http.Header
	var gotBody map[string]any

	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotHeaders = r.Header.Clone()
		if err := common.DecodeJson(r.Body, &gotBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"}],"message":"ok"}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, body, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("status = %d", status)
	}
	if gotPath != "/backend-api/wham/referrals/invite" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotHeaders.Get("Authorization") != "Bearer tok-abc" {
		t.Fatalf("Authorization = %q", gotHeaders.Get("Authorization"))
	}
	if gotHeaders.Get("chatgpt-account-id") != "acct-123" {
		t.Fatalf("chatgpt-account-id = %q", gotHeaders.Get("chatgpt-account-id"))
	}
	if gotHeaders.Get("User-Agent") != "Codex Desktop/0.0.0 (Linux; x86_64)" {
		t.Fatalf("User-Agent = %q", gotHeaders.Get("User-Agent"))
	}
	if gotHeaders.Get("X-OpenAI-Attach-Auth") != "1" || gotHeaders.Get("X-OpenAI-Attach-Integrity-State") != "1" {
		t.Fatalf("missing attach headers: %#v", gotHeaders)
	}
	if gotBody["referral_key"] != "codex_referral_persistent_invite" {
		t.Fatalf("referral_key = %#v", gotBody["referral_key"])
	}
	if !strings.Contains(string(body), "a@example.com") {
		t.Fatalf("body = %s", body)
	}
}

func TestFetchCodexInviteStatusAggregatesEligibilityAndRules(t *testing.T) {
	var paths []string
	var queries []string
	var userAgents []string

	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		queries = append(queries, r.URL.RawQuery)
		userAgents = append(userAgents, r.Header.Get("User-Agent"))
		if r.Header.Get("Authorization") != "Bearer tok-abc" {
			t.Fatalf("Authorization = %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("chatgpt-account-id") != "acct-123" {
			t.Fatalf("chatgpt-account-id = %q", r.Header.Get("chatgpt-account-id"))
		}
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/backend-api/referrals/invite/eligibility":
			_, _ = w.Write([]byte(`{"should_show":false,"requires_explicit_confirmation":true}`))
		case "/backend-api/wham/referrals/eligibility_rules":
			_, _ = w.Write([]byte(`{"rules":[{"text":"friend must send first Codex message"}]}`))
		default:
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, body, err := FetchCodexInviteStatus(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123")
	if err != nil {
		t.Fatalf("FetchCodexInviteStatus() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("status = %d", status)
	}
	if !reflect.DeepEqual(paths, []string{"/backend-api/referrals/invite/eligibility", "/backend-api/wham/referrals/eligibility_rules"}) {
		t.Fatalf("paths = %#v", paths)
	}
	for _, rawQuery := range queries {
		if rawQuery != "referral_key=codex_referral_persistent_invite" {
			t.Fatalf("query = %q", rawQuery)
		}
	}
	for _, ua := range userAgents {
		if ua != "Codex Desktop/0.0.0 (Linux; x86_64)" {
			t.Fatalf("User-Agent = %q", ua)
		}
	}
	if !strings.Contains(string(body), "friend must send first Codex message") {
		t.Fatalf("aggregated body missing rules: %s", body)
	}
}

func TestFetchCodexInviteStatusRejectsInvalidJSON(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`not-json`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, body, err := FetchCodexInviteStatus(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123")
	if err != nil {
		t.Fatalf("FetchCodexInviteStatus() error = %v", err)
	}
	if status != http.StatusBadGateway {
		t.Fatalf("status = %d", status)
	}
	if !strings.Contains(string(body), "status_errors") {
		t.Fatalf("expected status_errors in body: %s", body)
	}
}

func TestFetchCodexInviteStatusKeepsPartialStatus(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/backend-api/referrals/invite/eligibility":
			_, _ = w.Write([]byte(`{"requires_explicit_confirmation":true}`))
		case "/backend-api/wham/referrals/eligibility_rules":
			http.Error(w, "rules unavailable", http.StatusBadGateway)
		default:
			t.Fatalf("unexpected path %q", r.URL.Path)
		}
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, body, err := FetchCodexInviteStatus(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123")
	if err != nil {
		t.Fatalf("FetchCodexInviteStatus() error = %v", err)
	}
	if status != http.StatusBadGateway {
		t.Fatalf("status = %d", status)
	}
	if !strings.Contains(string(body), "requires_explicit_confirmation") || !strings.Contains(string(body), "status_errors") {
		t.Fatalf("expected partial status body: %s", body)
	}
}

func TestSendCodexInviteUsesRedisDedupe(t *testing.T) {
	withCodexInviteRedis(t)
	var requests int
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"}]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("first status = %d", status)
	}
	status, body, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusConflict {
		t.Fatalf("second status = %d body=%s", status, body)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestSendCodexInviteDedupeIgnoresEmailOrder(t *testing.T) {
	withCodexInviteRedis(t)
	var requests int
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"},{"email":"b@example.com"}]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com", "b@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("first status = %d", status)
	}
	status, body, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"B@example.com", "A@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusConflict {
		t.Fatalf("second status = %d body=%s", status, body)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestSendCodexInviteDedupeScopesByUpstreamIdentity(t *testing.T) {
	withCodexInviteRedis(t)
	var requests int
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"}]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("first status = %d", status)
	}
	status, _, err = SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-other", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("second status = %d", status)
	}
	if requests != 2 {
		t.Fatalf("requests = %d, want 2", requests)
	}
}

func TestSendCodexInviteRetainsDedupeOnFailure(t *testing.T) {
	withCodexInviteRedis(t)
	var requests int
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		if requests == 1 {
			http.Error(w, "temporary failure", http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{"invites":[{"email":"a@example.com"}]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusBadGateway {
		t.Fatalf("first status = %d", status)
	}
	status, body, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusConflict {
		t.Fatalf("second status = %d body=%s", status, body)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestSendCodexInviteRetainsDedupeOnPartialFailureResponse(t *testing.T) {
	withCodexInviteRedis(t)
	var requests int
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"failed_emails":["a@example.com"]}`))
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusOK {
		t.Fatalf("first status = %d", status)
	}
	status, body, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusConflict {
		t.Fatalf("second status = %d body=%s", status, body)
	}
	if requests != 1 {
		t.Fatalf("requests = %d, want 1", requests)
	}
}

func TestSendCodexInviteRetainsDedupeWithCanceledRequestContext(t *testing.T) {
	withCodexInviteRedis(t)
	trustCodexInviteTestHost(t, "chatgpt.test")
	ctx, cancel := context.WithCancel(context.Background())
	failClient := &http.Client{Transport: codexInviteRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		cancel()
		return &http.Response{
			StatusCode: http.StatusBadGateway,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader("temporary failure")),
			Request:    req,
		}, nil
	})}
	status, _, err := SendCodexInvite(ctx, failClient, "https://chatgpt.test", "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("first SendCodexInvite() error = %v", err)
	}
	if status != http.StatusBadGateway {
		t.Fatalf("first status = %d", status)
	}

	okClient := &http.Client{Transport: codexInviteRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"invites":[{"email":"a@example.com"}]}`)),
			Request:    req,
		}, nil
	})}
	status, body, err := SendCodexInvite(context.Background(), okClient, "https://chatgpt.test", "tok-abc", "acct-123", []string{"a@example.com"})
	if err != nil {
		t.Fatalf("second SendCodexInvite() error = %v", err)
	}
	if status != http.StatusConflict {
		t.Fatalf("second status = %d body=%s", status, body)
	}
}

func TestCodexInviteRequiresRecipientConsent(t *testing.T) {
	requires, err := CodexInviteRequiresRecipientConsent([]byte(`{"invite_eligibility":{"requires_explicit_confirmation":true}}`))
	if err != nil {
		t.Fatalf("CodexInviteRequiresRecipientConsent() error = %v", err)
	}
	if !requires {
		t.Fatal("requires consent = false, want true")
	}
	requires, err = CodexInviteRequiresRecipientConsent([]byte(`{"invite_eligibility":{"requires_explicit_confirmation":false}}`))
	if err != nil {
		t.Fatalf("CodexInviteRequiresRecipientConsent(false) error = %v", err)
	}
	if requires {
		t.Fatal("requires consent = true, want false")
	}
}

func TestBuildCodexInviteURLRejectsUntrustedTargets(t *testing.T) {
	if _, err := buildCodexInviteURL("http://chatgpt.com", "/backend-api/wham/referrals/invite", nil); err == nil {
		t.Fatal("expected non-https scheme to be rejected")
	}
	if _, err := buildCodexInviteURL("https://127.0.0.1", "/backend-api/wham/referrals/invite", nil); err == nil {
		t.Fatal("expected loopback host to be rejected")
	}
	if _, err := buildCodexInviteURL("https://evil.example", "/backend-api/wham/referrals/invite", nil); err == nil {
		t.Fatal("expected untrusted host to be rejected")
	}
}

func TestCodexInviteRedirectRejectsUntrustedTarget(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://evil.example/backend-api/wham/referrals/invite", http.StatusFound)
	}))
	defer srv.Close()
	trustCodexInviteTestServer(t, srv)

	status, _, err := SendCodexInvite(context.Background(), srv.Client(), srv.URL, "tok-abc", "acct-123", []string{"a@example.com"})
	if err == nil {
		t.Fatalf("expected redirect error, got status %d", status)
	}
	if !strings.Contains(err.Error(), "untrusted codex invite URL host") {
		t.Fatalf("redirect error = %v", err)
	}
}

func withCodexInviteRedis(t *testing.T) {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("miniredis: %v", err)
	}
	prevEnabled, prevRDB := common.RedisEnabled, common.RDB
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RedisEnabled = prevEnabled
		common.RDB = prevRDB
		mr.FastForward(codexInviteDedupeTTL + time.Second)
		mr.Close()
	})
}

func trustCodexInviteTestServer(t *testing.T, srv *httptest.Server) {
	t.Helper()
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatalf("parse test server URL: %v", err)
	}
	trustCodexInviteTestHost(t, u.Hostname())
}

func trustCodexInviteTestHost(t *testing.T, host string) {
	t.Helper()
	previous := append([]string(nil), codexInviteTrustedHostsForTest...)
	codexInviteTrustedHostsForTest = append(codexInviteTrustedHostsForTest, strings.ToLower(strings.TrimSpace(host)))
	t.Cleanup(func() {
		codexInviteTrustedHostsForTest = previous
	})
}
