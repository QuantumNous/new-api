package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestAddTokenUsesCustomKey(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	customKey := "customApiKey123"
	body := map[string]any{
		"name":                 "custom-token",
		"key":                  "sk-" + customKey,
		"expired_time":         -1,
		"remain_quota":         100,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                "default",
		"cross_group_retry":    false,
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", body, 1)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected custom key token creation to succeed, got message: %s", response.Message)
	}

	var inserted model.Token
	if err := db.First(&inserted, "user_id = ? AND name = ?", 1, "custom-token").Error; err != nil {
		t.Fatalf("failed to fetch inserted token: %v", err)
	}
	if inserted.Key != customKey {
		t.Fatalf("expected custom key %q, got %q", customKey, inserted.Key)
	}
}
