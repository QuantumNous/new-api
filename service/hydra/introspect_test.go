package hydra

import (
	"context"
	"errors"
	"testing"
)

func TestMockProvider_IntrospectToken_Active(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Setup: token is active
	mock.SetIntrospectedToken("valid-token", true, "user-123", "openid profile", "test-client")

	result, err := mock.IntrospectToken(ctx, "valid-token", "")
	if err != nil {
		t.Fatalf("IntrospectToken failed: %v", err)
	}

	if !result.GetActive() {
		t.Error("Expected token to be active")
	}
	if result.GetSub() != "user-123" {
		t.Errorf("Expected sub 'user-123', got '%s'", result.GetSub())
	}
	if result.GetScope() != "openid profile" {
		t.Errorf("Expected scope 'openid profile', got '%s'", result.GetScope())
	}
	if result.GetClientId() != "test-client" {
		t.Errorf("Expected client_id 'test-client', got '%s'", result.GetClientId())
	}
}

func TestMockProvider_IntrospectToken_Inactive(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Setup: token is inactive (expired/revoked)
	mock.SetIntrospectedToken("expired-token", false, "", "", "")

	result, err := mock.IntrospectToken(ctx, "expired-token", "")
	if err != nil {
		t.Fatalf("IntrospectToken failed: %v", err)
	}

	if result.GetActive() {
		t.Error("Expected token to be inactive")
	}
}

func TestMockProvider_IntrospectToken_NotFound(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Don't setup any token - should return inactive
	result, err := mock.IntrospectToken(ctx, "unknown-token", "")
	if err != nil {
		t.Fatalf("IntrospectToken failed: %v", err)
	}

	if result.GetActive() {
		t.Error("Expected unknown token to be inactive")
	}
}

func TestMockProvider_IntrospectToken_Error(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	// Inject error
	mock.IntrospectTokenErr = errors.New("hydra unavailable")

	_, err := mock.IntrospectToken(ctx, "any-token", "")
	if err == nil {
		t.Error("Expected error")
	}
}

func TestMockProvider_IntrospectToken_WithScope(t *testing.T) {
	ctx := context.Background()
	mock := NewMockProvider()

	mock.SetIntrospectedToken("scoped-token", true, "user-456", "openid balance:read tokens:write", "third-party-app")

	result, err := mock.IntrospectToken(ctx, "scoped-token", "balance:read")
	if err != nil {
		t.Fatalf("IntrospectToken failed: %v", err)
	}

	if !result.GetActive() {
		t.Error("Expected token to be active")
	}
	// Scope should contain the requested scope
	if result.GetScope() != "openid balance:read tokens:write" {
		t.Errorf("Expected full scope, got '%s'", result.GetScope())
	}
}
