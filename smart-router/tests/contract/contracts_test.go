package contract_test

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"smart-router/api"
)

func TestProvisionalContractsRoundTripWithoutProviderDetails(t *testing.T) {
	messages := []api.Validatable{
		api.RouteRequest{
			Kind: "route_request", SchemaVersion: 1, RequestID: "req-1",
			Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
			AttemptLimit: 1,
		},
		api.RouteResponse{
			Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
			SnapshotRevision: "rev-1", ExpiresAt: 2,
			Bindings: []api.Binding{{
				BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
				ProtocolPlugin: "chat-v1", Rank: 1,
			}},
			Signature: strings.Repeat("s", 43),
		},
		api.SignedSnapshot{
			Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
			IssuedAt: 1, ExpiresAt: 2, ConfigSHA256: strings.Repeat("a", 64),
			PluginManifestSHA256: strings.Repeat("b", 64),
			Routes: []api.SnapshotRoute{{
				Group: "default", Model: "model-a", Protocol: api.ProtocolChat,
				Bindings: []api.Binding{{
					BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
					ProtocolPlugin: "chat-v1", Rank: 1,
				}},
			}},
			Signature: strings.Repeat("s", 43),
		},
		api.AttemptOutcome{
			Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
			RequestID: "req-1", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
			Protocol: api.ProtocolChat, Outcome: api.OutcomeSuccess,
		},
		api.ContractError{
			Kind: "error", SchemaVersion: 1, Code: api.ErrorInvalidRequest,
		},
	}

	for _, message := range messages {
		if err := message.Validate(); err != nil {
			t.Fatalf("%T.Validate() error = %v", message, err)
		}
		payload, err := json.Marshal(message)
		if err != nil {
			t.Fatalf("marshal %T: %v", message, err)
		}
		lower := strings.ToLower(string(payload))
		for _, forbidden := range []string{
			"source_id", "endpoint", "authorization", "provider_response", "token",
		} {
			if strings.Contains(lower, forbidden) {
				t.Fatalf("%T JSON contains forbidden field %q: %s", message, forbidden, payload)
			}
		}
	}
}

func TestStrictDecoderRejectsTrailingAndUnknownData(t *testing.T) {
	inputs := [][]byte{
		[]byte(`{"kind":"route_request","schema_version":1,"request_id":"r","group":"g","model":"m","protocol":"chat","attempt_limit":1} {}`),
		[]byte(`{"kind":"route_request","schema_version":1,"request_id":"r","group":"g","model":"m","protocol":"chat","attempt_limit":1,"extra":true}`),
	}
	for _, input := range inputs {
		var request api.RouteRequest
		if err := api.DecodeStrict(bytes.NewReader(input), &request); err == nil {
			t.Fatalf("DecodeStrict(%s) error = nil", input)
		}
	}
}
