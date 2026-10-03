package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
)

func withZcodeCliOAuthTestServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(handler)
	original := zcodeCliOAuthBaseURL
	zcodeCliOAuthBaseURL = server.URL
	t.Cleanup(func() {
		zcodeCliOAuthBaseURL = original
		server.Close()
	})
	return server
}

func writeZcodeEnvelope(t *testing.T, w http.ResponseWriter, code int, data any) {
	t.Helper()
	raw, err := common.Marshal(data)
	if err != nil {
		t.Fatalf("marshal envelope data: %v", err)
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"code":%d,"msg":"","data":%s}`, code, string(raw))
}

func TestInitZcodeCliOAuthSuccess(t *testing.T) {
	var gotPath, gotAuth, gotProvider string
	withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		body, _ := io.ReadAll(r.Body)
		var payload struct {
			Provider string `json:"provider"`
		}
		if err := common.Unmarshal(body, &payload); err != nil {
			t.Errorf("invalid init body: %v", err)
		}
		gotProvider = payload.Provider
		writeZcodeEnvelope(t, w, 0, map[string]any{
			"flow_id":           "flow-1",
			"poll_token":        "server-poll-token",
			"authorize_url":     "https://chat.z.ai/oauth/device?flow=flow-1",
			"expires_at":        time.Now().Add(10 * time.Minute).UnixMilli(),
			"poll_interval_sec": 3,
		})
	})

	result, err := InitZcodeCliOAuth(context.Background(), "", "")
	if err != nil {
		t.Fatalf("InitZcodeCliOAuth returned error: %v", err)
	}
	if gotPath != "/oauth/cli/init" {
		t.Fatalf("init path = %q", gotPath)
	}
	if gotProvider != "zai" {
		t.Fatalf("provider = %q, want zai", gotProvider)
	}
	// 客户端生成的 pollToken：32 字节 hex，随请求 Bearer 上送。
	if len(gotAuth) != len("Bearer ")+64 {
		t.Fatalf("Authorization = %q, want client-generated 32-byte hex bearer", gotAuth)
	}
	if result.FlowID != "flow-1" || result.PollToken != "server-poll-token" {
		t.Fatalf("unexpected flow: %+v", result)
	}
	if result.AuthorizeURL == "" || result.PollIntervalSec != 3 || result.ExpiresAt == 0 {
		t.Fatalf("unexpected init result: %+v", result)
	}
}

func TestInitZcodeCliOAuthValidatesResponse(t *testing.T) {
	cases := []struct {
		name string
		data map[string]any
	}{
		{name: "missing flow_id", data: map[string]any{"poll_token": "p", "authorize_url": "https://a", "expires_at": 1, "poll_interval_sec": 1}},
		{name: "missing poll_token", data: map[string]any{"flow_id": "f", "authorize_url": "https://a", "expires_at": 1, "poll_interval_sec": 1}},
		{name: "missing authorize_url", data: map[string]any{"flow_id": "f", "poll_token": "p", "expires_at": 1, "poll_interval_sec": 1}},
		{name: "zero expires_at", data: map[string]any{"flow_id": "f", "poll_token": "p", "authorize_url": "https://a", "poll_interval_sec": 1}},
		{name: "zero poll_interval", data: map[string]any{"flow_id": "f", "poll_token": "p", "authorize_url": "https://a", "expires_at": 1}},
		{name: "non-https authorize_url", data: map[string]any{"flow_id": "f", "poll_token": "p", "authorize_url": "http://a", "expires_at": 1, "poll_interval_sec": 1}},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				writeZcodeEnvelope(t, w, 0, testCase.data)
			})
			if _, err := InitZcodeCliOAuth(context.Background(), "", ""); err == nil {
				t.Fatalf("expected validation error")
			}
		})
	}
}

func TestInitZcodeCliOAuthBusinessError(t *testing.T) {
	withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"code":4290,"msg":"rate limited","data":null}`)
	})
	_, err := InitZcodeCliOAuth(context.Background(), "", "")
	if err == nil || err.Error() != "rate limited" {
		t.Fatalf("err = %v, want business msg", err)
	}
}

func TestPollZcodeCliOAuthStatuses(t *testing.T) {
	var gotPath, gotAuth string
	withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		writeZcodeEnvelope(t, w, 0, map[string]any{"status": "pending"})
	})

	result, err := PollZcodeCliOAuth(context.Background(), "", "flow-9", "tok-9", "")
	if err != nil {
		t.Fatalf("PollZcodeCliOAuth returned error: %v", err)
	}
	if gotPath != "/oauth/cli/poll/flow-9" {
		t.Fatalf("poll path = %q", gotPath)
	}
	if gotAuth != "Bearer tok-9" {
		t.Fatalf("poll auth = %q", gotAuth)
	}
	if result.Status != "pending" {
		t.Fatalf("status = %q", result.Status)
	}
}

func TestPollZcodeCliOAuthReadyValidation(t *testing.T) {
	readyPayload := func() map[string]any {
		return map[string]any{
			"status": "ready",
			"token":  "header.payload.sig",
			"user":   map[string]any{"user_id": "u-1", "name": "n", "email": "e@x", "avatar": "a"},
			"zai":    map[string]any{"access_token": "zai-token"},
		}
	}

	withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		writeZcodeEnvelope(t, w, 0, readyPayload())
	})
	result, err := PollZcodeCliOAuth(context.Background(), "", "f", "t", "")
	if err != nil {
		t.Fatalf("ready poll returned error: %v", err)
	}
	if result.Token != "header.payload.sig" || result.UserID != "u-1" || result.ZaiAccessToken != "zai-token" {
		t.Fatalf("unexpected ready result: %+v", result)
	}

	// ready 但缺 token / user_id / zai.access_token 均按协议判无效。
	for _, mutate := range []func(map[string]any){
		func(p map[string]any) { p["token"] = "" },
		func(p map[string]any) { delete(p, "user") },
		func(p map[string]any) { p["user"] = map[string]any{"name": "n"} },
		func(p map[string]any) { delete(p, "zai") },
		func(p map[string]any) { p["zai"] = map[string]any{} },
	} {
		payload := readyPayload()
		mutate(payload)
		withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
			writeZcodeEnvelope(t, w, 0, payload)
		})
		if _, err := PollZcodeCliOAuth(context.Background(), "", "f", "t", ""); err == nil {
			t.Fatalf("expected validation error for mutated ready payload %+v", payload)
		}
	}
}

func TestZcodeCliOAuthProviderFlows(t *testing.T) {
	for _, provider := range []string{ZcodeOAuthProviderZai, ZcodeOAuthProviderBigModel} {
		t.Run(provider, func(t *testing.T) {
			withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodPost {
					var payload struct {
						Provider string `json:"provider"`
					}
					if err := common.DecodeJson(r.Body, &payload); err != nil || payload.Provider != provider {
						t.Errorf("init provider = %q, err = %v", payload.Provider, err)
					}
					writeZcodeEnvelope(t, w, 0, map[string]any{
						"flow_id": provider + "-flow", "poll_token": "poll-token",
						"authorize_url": "https://example.com/login", "expires_at": 1, "poll_interval_sec": 3,
					})
					return
				}
				if r.URL.Path != "/oauth/cli/poll/"+provider+"-flow" || r.Header.Get("Authorization") != "Bearer poll-token" {
					t.Errorf("poll did not use the initialized flow")
				}
				writeZcodeEnvelope(t, w, 0, map[string]any{
					"status": "ready", "token": "zcode-jwt", "user": map[string]string{"user_id": "user"},
					provider: map[string]string{"access_token": "business-token"},
				})
			})
			flow, err := InitZcodeCliOAuth(context.Background(), "", provider)
			if err != nil {
				t.Fatal(err)
			}
			result, err := PollZcodeCliOAuth(context.Background(), "", flow.FlowID, flow.PollToken, provider)
			if err != nil {
				t.Fatal(err)
			}
			if result.Token != "zcode-jwt" {
				t.Fatal("expected the ZCode JWT, not the business access token")
			}
			if provider == ZcodeOAuthProviderBigModel && result.BigModelAccessToken != "business-token" {
				t.Fatal("missing BigModel business token")
			}
		})
	}
}

func TestZcodeCliOAuthRejectsInvalidProviderBeforeRequest(t *testing.T) {
	requests := 0
	withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) { requests++ })
	for _, provider := range []string{"unknown", "ZAI"} {
		if _, err := InitZcodeCliOAuth(context.Background(), "", provider); err == nil {
			t.Fatal("accepted invalid init provider")
		}
		if _, err := PollZcodeCliOAuth(context.Background(), "", "flow", "poll-token", provider); err == nil {
			t.Fatal("accepted invalid poll provider")
		}
	}
	if requests != 0 {
		t.Fatal("invalid provider reached upstream")
	}
}

func TestZcodeCliOAuthReadyProviderValidation(t *testing.T) {
	cases := []struct {
		name, provider, payloadProvider, field, value string
		valid                                         bool
	}{
		{"domestic snake case", "bigmodel", "bigmodel", "access_token", "token", true},
		{"domestic camel case", "bigmodel", "bigmodel", "accessToken", "token", true},
		{"domestic missing token", "bigmodel", "bigmodel", "access_token", "", false},
		{"domestic blank token", "bigmodel", "bigmodel", "access_token", "  ", false},
		{"domestic with international response", "bigmodel", "zai", "access_token", "token", false},
		{"international with domestic response", "zai", "bigmodel", "access_token", "token", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			withZcodeCliOAuthTestServer(t, func(w http.ResponseWriter, r *http.Request) {
				writeZcodeEnvelope(t, w, 0, map[string]any{
					"status": "ready", "token": "jwt", "user": map[string]string{"user_id": "u"},
					tc.payloadProvider: map[string]string{tc.field: tc.value},
				})
			})
			_, err := PollZcodeCliOAuth(context.Background(), "", "flow", "poll-token", tc.provider)
			if (err == nil) != tc.valid {
				t.Fatalf("valid = %v, err = %v", tc.valid, err)
			}
		})
	}
}

func TestExtractZcodeJWTExpiration(t *testing.T) {
	makeJWT := func(payload string) string {
		encode := func(s string) string {
			return base64.RawURLEncoding.EncodeToString([]byte(s))
		}
		return encode(`{"alg":"HS256"}`) + "." + encode(payload) + ".sig"
	}

	exp := time.Now().Add(24 * time.Hour).Unix()
	if got, ok := ExtractZcodeJWTExpiration(makeJWT(fmt.Sprintf(`{"exp":%d}`, exp))); !ok || got != exp {
		t.Fatalf("exp = %d, ok = %v, want %d", got, ok, exp)
	}
	// 带 padding 的 base64url 同样可解（对齐 ZCode 宽松解码）。
	padded := base64.URLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"exp":%d}`, exp)))
	if got, ok := ExtractZcodeJWTExpiration("h." + padded + ".s"); !ok || got != exp {
		t.Fatalf("padded exp = %d, ok = %v", got, ok)
	}
	for _, invalid := range []string{"", "not-a-jwt", "a.b", "a.!!!.c", makeJWT(`{"exp":"x"}`), makeJWT(`{"exp":0}`), makeJWT(`{}`)} {
		if _, ok := ExtractZcodeJWTExpiration(invalid); ok {
			t.Fatalf("token %q should not yield exp", invalid)
		}
	}
}

func TestZcodeJWTRemainingSeconds(t *testing.T) {
	makeJWT := func(exp int64) string {
		encode := func(s string) string {
			return base64.RawURLEncoding.EncodeToString([]byte(s))
		}
		return encode(`{"alg":"none"}`) + "." + encode(fmt.Sprintf(`{"exp":%d}`, exp)) + "."
	}
	now := time.Unix(1_800_000_000, 0)
	if remaining, ok := ZcodeJWTRemainingSeconds(makeJWT(now.Unix()+3600), now); !ok || remaining != 3600 {
		t.Fatalf("remaining = %d, ok = %v", remaining, ok)
	}
	if remaining, ok := ZcodeJWTRemainingSeconds(makeJWT(now.Unix()-10), now); !ok || remaining != -10 {
		t.Fatalf("expired remaining = %d, ok = %v", remaining, ok)
	}
	if _, ok := ZcodeJWTRemainingSeconds("bad", now); ok {
		t.Fatalf("bad token should not resolve")
	}
}
