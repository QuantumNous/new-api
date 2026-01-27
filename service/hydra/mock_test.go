package hydra

import (
	"context"
	"fmt"
	"testing"
)

func TestMockProvider_LoginFlow(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	challenge := "login-challenge-123"
	mock.SetLoginRequest(challenge, "test-client", "Test App", []string{"openid", "profile"}, false, "")

	// Test GetLoginRequest
	loginReq, err := mock.GetLoginRequest(ctx, challenge)
	if err != nil {
		t.Fatalf("GetLoginRequest failed: %v", err)
	}
	if loginReq.GetChallenge() != challenge {
		t.Errorf("Expected challenge %s, got %s", challenge, loginReq.GetChallenge())
	}
	if loginReq.Client.GetClientId() != "test-client" {
		t.Errorf("Expected client_id test-client, got %s", loginReq.Client.GetClientId())
	}

	// Test AcceptLogin
	redirect, err := mock.AcceptLogin(ctx, challenge, "user-123", true, 3600)
	if err != nil {
		t.Fatalf("AcceptLogin failed: %v", err)
	}
	if redirect.RedirectTo == "" {
		t.Error("Expected redirect URL")
	}

	// Verify login was accepted
	if subject, ok := mock.AcceptedLogins[challenge]; !ok || subject != "user-123" {
		t.Error("Login should be accepted with subject user-123")
	}
}

func TestMockProvider_ConsentFlow(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	challenge := "consent-challenge-456"
	mock.SetConsentRequest(challenge, "test-client", "Test App", "user-123", []string{"openid", "profile", "email"}, false)

	// Test GetConsentRequest
	consentReq, err := mock.GetConsentRequest(ctx, challenge)
	if err != nil {
		t.Fatalf("GetConsentRequest failed: %v", err)
	}
	if consentReq.GetSubject() != "user-123" {
		t.Errorf("Expected subject user-123, got %s", consentReq.GetSubject())
	}

	// Test AcceptConsent
	grantScope := []string{"openid", "profile"}
	redirect, err := mock.AcceptConsent(ctx, challenge, grantScope, true, 3600, nil)
	if err != nil {
		t.Fatalf("AcceptConsent failed: %v", err)
	}
	if redirect.RedirectTo == "" {
		t.Error("Expected redirect URL")
	}

	// Verify consent was accepted
	if scopes, ok := mock.AcceptedConsents[challenge]; !ok || len(scopes) != 2 {
		t.Error("Consent should be accepted with granted scopes")
	}
}

func TestMockProvider_RejectFlow(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	challenge := "login-challenge-789"
	mock.SetLoginRequest(challenge, "test-client", "Test App", []string{"openid"}, false, "")

	// Test RejectLogin
	redirect, err := mock.RejectLogin(ctx, challenge, "access_denied", "User denied access")
	if err != nil {
		t.Fatalf("RejectLogin failed: %v", err)
	}
	if redirect.RedirectTo == "" {
		t.Error("Expected redirect URL")
	}

	// Verify login was rejected
	if errorID, ok := mock.RejectedLogins[challenge]; !ok || errorID != "access_denied" {
		t.Error("Login should be rejected with access_denied error")
	}
}

func TestMockProvider_SkipLogin(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Simulate skip=true (user already authenticated)
	challenge := "login-challenge-skip"
	mock.SetLoginRequest(challenge, "test-client", "Test App", []string{"openid"}, true, "existing-user-123")

	loginReq, err := mock.GetLoginRequest(ctx, challenge)
	if err != nil {
		t.Fatalf("GetLoginRequest failed: %v", err)
	}

	if !loginReq.GetSkip() {
		t.Error("Expected skip=true")
	}
	if loginReq.GetSubject() != "existing-user-123" {
		t.Errorf("Expected subject existing-user-123, got %s", loginReq.GetSubject())
	}
}

func TestMockProvider_LogoutFlow(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	challenge := "logout-challenge-123"
	mock.SetLogoutRequest(challenge, "user-123", "session-456")

	// Test GetLogoutRequest
	logoutReq, err := mock.GetLogoutRequest(ctx, challenge)
	if err != nil {
		t.Fatalf("GetLogoutRequest failed: %v", err)
	}
	if logoutReq.GetSubject() != "user-123" {
		t.Errorf("Expected subject user-123, got %s", logoutReq.GetSubject())
	}

	// Test AcceptLogout
	redirect, err := mock.AcceptLogout(ctx, challenge)
	if err != nil {
		t.Fatalf("AcceptLogout failed: %v", err)
	}
	if redirect.RedirectTo == "" {
		t.Error("Expected redirect URL")
	}
}

func TestMockProvider_NotFound(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Try to get non-existent login request
	_, err := mock.GetLoginRequest(ctx, "non-existent")
	if err == nil {
		t.Error("Expected error for non-existent challenge")
	}
}

func TestMockProvider_ErrorInjection(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	mock.GetLoginRequestErr = fmt.Errorf("simulated error")

	_, err := mock.GetLoginRequest(ctx, "any-challenge")
	if err == nil {
		t.Error("Expected injected error")
	}
}
