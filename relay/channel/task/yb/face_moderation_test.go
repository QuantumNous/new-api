package yb

import "testing"

func TestNormalizeAssetRef(t *testing.T) {
	cases := map[string]string{
		"asset://asset-xxx": "asset://asset-xxx",
		"asset-xxx":         "asset://asset-xxx",
		"assetId://asset-1": "asset://asset-1",
		"assetId://1":       "asset://asset-1",
	}
	for in, want := range cases {
		if got := normalizeAssetRef(in); got != want {
			t.Fatalf("normalizeAssetRef(%q)=%q want %q", in, got, want)
		}
	}
}

func TestNeedsFaceModeration(t *testing.T) {
	if !needsFaceModeration("https://cdn.example.com/a.jpg") {
		t.Fatal("https should need moderation")
	}
	if !needsFaceModeration("data:image/jpeg;base64,aaa") {
		t.Fatal("data url should need moderation")
	}
	if needsFaceModeration("asset://asset-xxx") {
		t.Fatal("asset ref should skip")
	}
}

func TestExtractAssetRef(t *testing.T) {
	m := map[string]any{
		"status":    "Active",
		"asset_ref": "asset://asset-abc",
	}
	if got := extractAssetRef(m); got != "asset://asset-abc" {
		t.Fatalf("got=%q", got)
	}
}
