package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestValidateModels_BadBody_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/validate_models",
		"not-an-object", nil, common.RoleRootUser)
	ValidateModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestValidateModels_ChannelNotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/validate_models",
		ValidateModelsRequest{ChannelId: 9999, Models: []string{"gpt-4o-mini"}},
		nil, common.RoleRootUser)
	ValidateModels(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestValidateModels_NoModels_400(t *testing.T) {
	openChannelControllerTestDB(t)
	// create mode (no channel id) with empty model list => nothing to validate
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/validate_models",
		ValidateModelsRequest{Type: 1, Key: "sk-test", BaseURL: "https://example.com"},
		nil, common.RoleRootUser)
	ValidateModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestDedupeTrimModels(t *testing.T) {
	in := []string{" gpt-4o ", "gpt-4o", "", "  ", "claude", "claude"}
	got := dedupeTrimModels(in)
	want := []string{"gpt-4o", "claude"}
	if len(got) != len(want) {
		t.Fatalf("len got %d want %d (%v)", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("idx %d: got %q want %q", i, got[i], want[i])
		}
	}
}
