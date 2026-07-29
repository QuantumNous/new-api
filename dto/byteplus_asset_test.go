package dto

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestBytePlusAssetResponseOmitsPrivateFields(t *testing.T) {
	resp := BytePlusAssetResponse{
		ID:        "ast_123",
		Object:    "asset",
		AssetType: "Video",
		Status:    "Processing",
		Moderation: BytePlusAssetModeration{
			Strategy: "Default",
		},
		CreatedAt: 1785292000,
	}

	raw, err := common.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	text := string(raw)
	for _, forbidden := range []string{"group", "channel", "upstream", "project", "source", "access", "secret"} {
		if strings.Contains(strings.ToLower(text), forbidden) {
			t.Fatalf("response leaked %q in %s", forbidden, text)
		}
	}
	for _, required := range []string{`"id":"ast_123"`, `"object":"asset"`, `"asset_type":"Video"`, `"status":"Processing"`, `"created_at":1785292000`} {
		if !strings.Contains(text, required) {
			t.Fatalf("response missing %s in %s", required, text)
		}
	}
}

func TestBytePlusAssetCreateRequestJSONTags(t *testing.T) {
	raw := []byte(`{"url":"https://example.com/a.mp4","asset_type":"Video","moderation":{"strategy":"Skip"}}`)
	var req BytePlusAssetCreateRequest
	if err := common.Unmarshal(raw, &req); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	if req.URL != "https://example.com/a.mp4" || req.AssetType != "Video" || req.Moderation == nil || req.Moderation.Strategy != "Skip" {
		t.Fatalf("request = %+v", req)
	}
}
