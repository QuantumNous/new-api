package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func setupTokenGroupVisibilityTestDB(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.Token{}, &model.User{}, &model.TokenGroupVisibility{}, &model.TokenGroupVisibilityTarget{}); err != nil {
		t.Fatalf("failed to migrate token visibility tables: %v", err)
	}
}

func TestAddTokenEnforcesTargetedVisibility(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	if err := model.DB.Create(&model.User{Username: "alice", Password: "password", Group: "default", AffCode: "alice-aff", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Create(&model.User{Username: "bob", Password: "password", Group: "default", AffCode: "bob-aff", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, Usernames: []string{"alice"},
	}); err != nil {
		t.Fatal(err)
	}

	ctx, rejected := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "not-allowed", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 2)
	AddToken(ctx)
	if decodeAPIResponse(t, rejected).Success {
		t.Fatal("expected targeted policy to reject forged token group")
	}

	ctx, allowed := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "allowed", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 1)
	AddToken(ctx)
	if !decodeAPIResponse(t, allowed).Success {
		t.Fatalf("expected targeted user to create token: %s", allowed.Body.String())
	}
}

func TestAddTokenVisibilityFlagDisabledPreservesLegacyBehavior(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	if err := model.DB.Create(&model.User{Username: "legacy", Password: "password", Group: "default", AffCode: "legacy-aff", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityHidden,
	}); err != nil {
		t.Fatal(err)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "legacy", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 1)
	AddToken(ctx)
	if !decodeAPIResponse(t, recorder).Success {
		t.Fatalf("expected legacy behavior while disabled: %s", recorder.Body.String())
	}
}
