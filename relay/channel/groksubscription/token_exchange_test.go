package groksubscription

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

// readForm 在 stub doer 里解析请求的 form body。
func readForm(t *testing.T, req *http.Request) url.Values {
	t.Helper()
	body, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("read request body err %v", err)
	}
	form, err := url.ParseQuery(string(body))
	if err != nil {
		t.Fatalf("parse form err %v", err)
	}
	return form
}

func TestExchangeTokenAuthorizationCodeSuccess(t *testing.T) {
	var gotForm url.Values
	var gotContentType string
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodPost {
			t.Fatalf("must POST, got %s", req.Method)
		}
		if req.URL.String() != OAuthToken {
			t.Fatalf("must hit token endpoint, got %s", req.URL.String())
		}
		gotContentType = req.Header.Get("Content-Type")
		gotForm = readForm(t, req)
		return jsonResponse(200, `{"access_token":"at-new","refresh_token":"rt-new","token_type":"Bearer","expires_in":3600}`), nil
	})
	cred, err := ExchangeToken(context.Background(), doer, "authorization_code", "the-code", "the-verifier", "", "https://newapi.example/callback")
	if err != nil {
		t.Fatalf("exchange err %v", err)
	}
	if gotContentType != "application/x-www-form-urlencoded" {
		t.Fatalf("content-type = %q", gotContentType)
	}
	if gotForm.Get("grant_type") != "authorization_code" {
		t.Fatalf("grant_type = %q", gotForm.Get("grant_type"))
	}
	if gotForm.Get("client_id") != OAuthClientID {
		t.Fatalf("client_id = %q", gotForm.Get("client_id"))
	}
	if gotForm.Get("code") != "the-code" {
		t.Fatalf("code = %q", gotForm.Get("code"))
	}
	if gotForm.Get("code_verifier") != "the-verifier" {
		t.Fatalf("code_verifier = %q", gotForm.Get("code_verifier"))
	}
	if gotForm.Get("redirect_uri") != "https://newapi.example/callback" {
		t.Fatalf("redirect_uri = %q", gotForm.Get("redirect_uri"))
	}
	if cred.AccessToken != "at-new" || cred.RefreshToken != "rt-new" || cred.TokenType != "Bearer" {
		t.Fatalf("credential not built from response: %+v", cred)
	}
	if cred.ExpiresAt <= 0 {
		t.Fatalf("expires_at must be now+expires_in, got %d", cred.ExpiresAt)
	}
	parsed, err := ParseCredential(mustSerialize(t, cred))
	if err != nil {
		t.Fatalf("exchanged credential must be ParseCredential-clean: %v", err)
	}
	if parsed.AccessToken != "at-new" {
		t.Fatalf("round-trip access_token = %q", parsed.AccessToken)
	}
}

func mustSerialize(t *testing.T, c Credential) string {
	t.Helper()
	s, err := c.Serialize()
	if err != nil {
		t.Fatalf("serialize err %v", err)
	}
	return s
}

// TestExchangeTokenRefreshGrantPreservesInputToken 守护 RFC 6749 §6：上游不轮换 refresh_token
// 时凭证保留输入的 refresh_token（镜像 Refresh 的语义）。
func TestExchangeTokenRefreshGrantPreservesInputToken(t *testing.T) {
	var gotForm url.Values
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		gotForm = readForm(t, req)
		// 上游只回新 access_token，不轮换 refresh_token，也不带 token_type。
		return jsonResponse(200, `{"access_token":"at-2","expires_in":1800}`), nil
	})
	cred, err := ExchangeToken(context.Background(), doer, "refresh_token", "", "", "imported-rt", "")
	if err != nil {
		t.Fatalf("exchange err %v", err)
	}
	if gotForm.Get("grant_type") != "refresh_token" {
		t.Fatalf("grant_type = %q", gotForm.Get("grant_type"))
	}
	if gotForm.Get("refresh_token") != "imported-rt" {
		t.Fatalf("refresh_token = %q", gotForm.Get("refresh_token"))
	}
	if gotForm.Get("code") != "" || gotForm.Get("code_verifier") != "" || gotForm.Get("redirect_uri") != "" {
		t.Fatalf("refresh grant must not carry authorization_code fields: %v", gotForm)
	}
	if cred.RefreshToken != "imported-rt" {
		t.Fatalf("refresh_token must be preserved when upstream omits it, got %q", cred.RefreshToken)
	}
	if cred.TokenType != "Bearer" {
		t.Fatalf("token_type default = %q, want Bearer", cred.TokenType)
	}
	if !cred.IsRefreshable() {
		t.Fatalf("imported credential must be refreshable")
	}
}

// TestExchangeTokenNon200SanitizedToGrantCategory 守护脱敏铁律：非 200 的 error 只带
// OAuth 错误类别码（如 invalid_grant），绝不夹带 error_description / body 原文。
func TestExchangeTokenNon200SanitizedToGrantCategory(t *testing.T) {
	const secret = "upstream-secret-description-must-not-leak"
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(400, `{"error":"invalid_grant","error_description":"`+secret+`"}`), nil
	})
	_, err := ExchangeToken(context.Background(), doer, "refresh_token", "", "", "imported-rt", "")
	if err == nil {
		t.Fatalf("non-200 must return error")
	}
	var gre *GrantRejectedError
	if !errors.As(err, &gre) {
		t.Fatalf("want GrantRejectedError, got %T %v", err, err)
	}
	if gre.Code != "invalid_grant" {
		t.Fatalf("code = %q, want invalid_grant", gre.Code)
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("error must NOT leak upstream body, got %q", err.Error())
	}
	if strings.Contains(err.Error(), "imported-rt") {
		t.Fatalf("error must NOT leak request secret, got %q", err.Error())
	}
}

// TestExchangeTokenNon200UnparseableBody：body 不是合法 JSON / 无 error 字段时仍须是
// GrantRejectedError（类别 unknown），不 echo body。
func TestExchangeTokenNon200UnparseableBody(t *testing.T) {
	const junk = "<html>totally not json</html>"
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(500, junk), nil
	})
	_, err := ExchangeToken(context.Background(), doer, "authorization_code", "c", "v", "", "https://r")
	if err == nil {
		t.Fatalf("non-200 must return error")
	}
	var gre *GrantRejectedError
	if !errors.As(err, &gre) {
		t.Fatalf("want GrantRejectedError, got %T %v", err, err)
	}
	if gre.Code != "" {
		t.Fatalf("unparseable body must yield empty code, got %q", gre.Code)
	}
	if strings.Contains(err.Error(), junk) {
		t.Fatalf("error must NOT leak body, got %q", err.Error())
	}
}

// TestExchangeTokenRejectsInvalidGrantArgs：非法 grant / 缺必填字段在发请求前就拒绝。
func TestExchangeTokenRejectsInvalidGrantArgs(t *testing.T) {
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		t.Fatalf("must not call token endpoint for invalid args")
		return nil, nil
	})
	cases := []struct {
		name                                                 string
		grantType, code, verifier, refreshToken, redirectURI string
	}{
		{"bad grant", "password", "c", "v", "", "https://r"},
		{"auth code missing code", "authorization_code", "", "v", "", "https://r"},
		{"auth code missing verifier", "authorization_code", "c", "", "", "https://r"},
		{"auth code missing redirect", "authorization_code", "c", "v", "", ""},
		{"refresh missing token", "refresh_token", "", "", "", ""},
	}
	for _, tc := range cases {
		if _, err := ExchangeToken(context.Background(), doer, tc.grantType, tc.code, tc.verifier, tc.refreshToken, tc.redirectURI); err == nil {
			t.Fatalf("%s: must be rejected", tc.name)
		}
	}
	if _, err := ExchangeToken(context.Background(), nil, "refresh_token", "", "", "rt", ""); err == nil {
		t.Fatalf("nil doer must be rejected")
	}
}

func TestExchangeTokenEmptyAccessTokenRejected(t *testing.T) {
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `{"token_type":"Bearer","expires_in":100}`), nil
	})
	if _, err := ExchangeToken(context.Background(), doer, "refresh_token", "", "", "rt", ""); err == nil {
		t.Fatalf("empty access_token must be rejected")
	}
	doer2 := doerFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(200, `not json`), nil
	})
	if _, err := ExchangeToken(context.Background(), doer2, "refresh_token", "", "", "rt", ""); err == nil {
		t.Fatalf("invalid json must be rejected")
	}
}
