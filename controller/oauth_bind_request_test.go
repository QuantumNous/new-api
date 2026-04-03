package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
)

func newBindTestContext(method string, target string, contentType string, body string) *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, bytes.NewBufferString(body))
	if contentType != "" {
		ctx.Request.Header.Set("Content-Type", contentType)
	}
	return ctx
}

func TestReadEmailBindRequestReadsJSONBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newBindTestContext(
		http.MethodPost,
		"/api/oauth/email/bind",
		"application/json",
		`{"email":"json@example.com","code":"123456"}`,
	)

	req, err := readEmailBindRequest(ctx)
	if err != nil {
		t.Fatalf("expected json body to decode, got error: %v", err)
	}
	if req.Email != "json@example.com" || req.Code != "123456" {
		t.Fatalf("unexpected request payload: %#v", req)
	}
}

func TestReadEmailBindRequestFallsBackToFormAndQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newBindTestContext(
		http.MethodPost,
		"/api/oauth/email/bind?code=query-code",
		"application/x-www-form-urlencoded",
		"email=form@example.com",
	)

	req, err := readEmailBindRequest(ctx)
	if err != nil {
		t.Fatalf("expected form/query fallback to succeed, got error: %v", err)
	}
	if req.Email != "form@example.com" || req.Code != "query-code" {
		t.Fatalf("unexpected request payload: %#v", req)
	}
}

func TestReadWeChatBindRequestFallsBackToQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newBindTestContext(http.MethodGet, "/api/oauth/wechat/bind?code=query-code", "", "")

	req, err := readWeChatBindRequest(ctx)
	if err != nil {
		t.Fatalf("expected query fallback to succeed, got error: %v", err)
	}
	if req.Code != "query-code" {
		t.Fatalf("unexpected request payload: %#v", req)
	}
}

func TestEnsureBuiltInProviderBindingAvailableRejectsImplicitRebind(t *testing.T) {
	user := &model.User{GitHubId: "existing-user"}
	err := ensureBuiltInProviderBindingAvailable(user, &oauth.GitHubProvider{}, &oauth.OAuthUser{
		ProviderUserID: "new-user",
	})
	if err == nil {
		t.Fatal("expected implicit rebind to be rejected")
	}
	if _, ok := err.(*OAuthAlreadyBoundError); !ok {
		t.Fatalf("expected OAuthAlreadyBoundError, got %T", err)
	}
}

func TestEnsureBuiltInProviderBindingAvailableAllowsGitHubLegacyMigration(t *testing.T) {
	user := &model.User{GitHubId: "legacy-login"}
	err := ensureBuiltInProviderBindingAvailable(user, &oauth.GitHubProvider{}, &oauth.OAuthUser{
		ProviderUserID: "12345678",
		Extra: map[string]any{
			"legacy_id": "legacy-login",
		},
	})
	if err != nil {
		t.Fatalf("expected github legacy migration to remain allowed, got error: %v", err)
	}
}

func TestFirstNonEmptyRequestValueTrimsWhitespace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx := newBindTestContext(
		http.MethodPost,
		"/api/oauth/email/bind?code=query-code",
		"application/x-www-form-urlencoded",
		"email=%20form@example.com%20",
	)
	value := firstNonEmptyRequestValue(ctx, "email")
	if value != "form@example.com" {
		t.Fatalf("expected trimmed value, got %q", value)
	}
}
