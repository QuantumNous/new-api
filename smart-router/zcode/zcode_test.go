package zcode

import (
	"encoding/json"
	"strings"
	"testing"

	"smart-router/api"
)

func TestBuildDryRunContainsOnlyOpaqueRouteData(t *testing.T) {
	snapshot := api.SignedSnapshot{
		Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
		IssuedAt: 1, ExpiresAt: 2, ConfigSHA256: strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64),
		Routes: []api.SnapshotRoute{{
			Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
			Bindings: []api.Binding{{
				BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
				ProtocolPlugin: "chat-v1", Rank: 1,
				CostMicrounits: 11,
			}},
		}},
		Signature: strings.Repeat("c", 43),
	}

	manifest, err := BuildDryRun(snapshot)
	if err != nil {
		t.Fatalf("BuildDryRun() error = %v", err)
	}
	if !manifest.DryRun || manifest.Apply {
		t.Fatalf("manifest mode = %#v, want dry-run only", manifest)
	}
	if manifest.RouteCount != 1 ||
		manifest.Routes[0].BindingIDs[0] != "bnd_AAAAAAAAAAAAAAAAAAAAAAAA" {
		t.Fatalf("manifest routes = %#v", manifest.Routes)
	}
	payload, err := json.Marshal(manifest)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	for _, forbidden := range []string{"source_id", "upstream", "token", "cookie", "provider_body"} {
		if strings.Contains(string(payload), forbidden) {
			t.Fatalf("manifest contains forbidden field %q: %s", forbidden, payload)
		}
	}
}

func TestBuildDryRunRejectsNonOpaqueBinding(t *testing.T) {
	snapshot := api.SignedSnapshot{
		Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
		IssuedAt: 1, ExpiresAt: 2, ConfigSHA256: strings.Repeat("a", 64),
		PluginManifestSHA256: strings.Repeat("b", 64),
		Routes: []api.SnapshotRoute{{
			Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
			Bindings: []api.Binding{{
				BindingID: "provider-name", ProtocolPlugin: "chat-v1", Rank: 1,
			}},
		}},
		Signature: strings.Repeat("c", 43),
	}
	if _, err := BuildDryRun(snapshot); err == nil {
		t.Fatal("BuildDryRun() error = nil, want non-opaque binding rejection")
	}
}
