package signing

import (
	"testing"

	"smart-router/api"
)

func TestSignIsDeterministicAndIgnoresSignatureField(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	response := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
		SnapshotRevision: "rev-1", ExpiresAt: 123,
		Bindings: []api.Binding{{
			BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
			ProtocolPlugin: "chat-v1", Rank: 1,
		}},
	}

	first, err := Sign(response, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	response.Signature = "different-existing-value"
	second, err := Sign(response, key)
	if err != nil {
		t.Fatalf("Sign() second error = %v", err)
	}

	if first != second {
		t.Fatalf("Sign() is not deterministic: %q != %q", first, second)
	}
	if len(first) < 32 {
		t.Fatalf("signature length = %d, want contract-compatible length", len(first))
	}
}

func TestVerifyRejectsTampering(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	response := api.RouteResponse{
		Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
		SnapshotRevision: "rev-1", ExpiresAt: 123,
		Bindings: []api.Binding{{
			BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
			ProtocolPlugin: "chat-v1", Rank: 1,
		}},
	}
	signature, err := Sign(response, key)
	if err != nil {
		t.Fatalf("Sign() error = %v", err)
	}
	response.Signature = signature
	if err := Verify(response, key, signature); err != nil {
		t.Fatalf("Verify() error = %v", err)
	}

	response.Bindings[0].BindingID = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"
	if err := Verify(response, key, signature); err == nil {
		t.Fatal("Verify() error = nil, want tamper rejection")
	}
}

func TestSignRejectsShortKeys(t *testing.T) {
	_, err := Sign(map[string]string{"safe": "value"}, []byte("short"))
	if err == nil {
		t.Fatal("Sign() error = nil, want short-key rejection")
	}
}
