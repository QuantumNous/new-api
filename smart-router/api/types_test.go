package api

import (
	"strings"
	"testing"
)

func TestValidateProvisionalMessages(t *testing.T) {
	binding := Binding{
		BindingID:      "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		ProtocolPlugin: "openai-chat-v1",
		Rank:           1,
		CostMicrounits: 12,
	}

	tests := []struct {
		name    string
		message Validatable
	}{
		{
			name: "route request",
			message: RouteRequest{
				Kind: "route_request", SchemaVersion: 1, RequestID: "req-1",
				Group: "default", Model: "model-a", Protocol: ProtocolChat,
				AttemptLimit: 5, Bindings: []Binding{binding},
			},
		},
		{
			name: "route response",
			message: RouteResponse{
				Kind: "route_response", SchemaVersion: 1, RequestID: "req-1",
				SnapshotRevision: "rev-1", ExpiresAt: 10, Bindings: []Binding{binding},
				Signature: strings.Repeat("a", 43),
			},
		},
		{
			name: "signed snapshot",
			message: SignedSnapshot{
				Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1",
				IssuedAt: 1, ExpiresAt: 10, ConfigSHA256: strings.Repeat("a", 64),
				PluginManifestSHA256: strings.Repeat("b", 64),
				Routes: []SnapshotRoute{{
					Group: "default", Model: "model-a", Protocol: ProtocolChat,
					Bindings: []Binding{binding},
				}},
				Signature: strings.Repeat("c", 43),
			},
		},
		{
			name: "attempt outcome",
			message: AttemptOutcome{
				Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
				RequestID: "req-1", BindingID: binding.BindingID,
				Protocol: ProtocolResponses, Outcome: OutcomeSuccess,
			},
		},
		{
			name: "contract error",
			message: ContractError{
				Kind: "error", SchemaVersion: 1, Code: ErrorInvalidRequest,
				Retryable: false, RequestID: "req-1",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.message.Validate(); err != nil {
				t.Fatalf("Validate() error = %v", err)
			}
		})
	}
}

func TestValidationRejectsContractViolations(t *testing.T) {
	validBinding := Binding{
		BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", ProtocolPlugin: "chat-v1", Rank: 1,
	}
	tests := []struct {
		name    string
		message Validatable
	}{
		{
			name: "unknown protocol",
			message: RouteRequest{
				Kind: "route_request", SchemaVersion: 1, RequestID: "r",
				Group: "g", Model: "m", Protocol: "completion", AttemptLimit: 1,
			},
		},
		{
			name: "attempt limit over five",
			message: RouteRequest{
				Kind: "route_request", SchemaVersion: 1, RequestID: "r",
				Group: "g", Model: "m", Protocol: ProtocolChat, AttemptLimit: 6,
			},
		},
		{
			name: "binding rank over five",
			message: RouteResponse{
				Kind: "route_response", SchemaVersion: 1, RequestID: "r",
				SnapshotRevision: "rev", ExpiresAt: 1,
				Bindings:  []Binding{{BindingID: "b", ProtocolPlugin: "p", Rank: 6}},
				Signature: strings.Repeat("a", 43),
			},
		},
		{
			name: "invalid outcome",
			message: AttemptOutcome{
				Kind: "attempt_outcome", SchemaVersion: 1, EventID: "e",
				RequestID: "r", BindingID: "b", Protocol: ProtocolChat,
				Outcome: "maybe",
			},
		},
		{
			name: "missing snapshot routes are allowed but expiry ordering is not",
			message: SignedSnapshot{
				Kind: "signed_snapshot", SchemaVersion: 1, Revision: "r",
				IssuedAt: 10, ExpiresAt: 9, ConfigSHA256: strings.Repeat("a", 64),
				PluginManifestSHA256: strings.Repeat("b", 64),
				Signature:            strings.Repeat("c", 43),
			},
		},
		{
			name: "binding count over five",
			message: SnapshotRoute{
				Group: "g", Model: "m", Protocol: ProtocolChat,
				Bindings: []Binding{
					validBinding, validBinding, validBinding,
					validBinding, validBinding, validBinding,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.message.Validate(); err == nil {
				t.Fatal("Validate() error = nil, want contract violation")
			}
		})
	}
}

func TestValidationRejectsProviderDerivedBindingIDsAtEveryContractBoundary(t *testing.T) {
	tests := []struct {
		name    string
		message Validatable
	}{
		{
			name: "route request provider name",
			message: RouteRequest{
				Kind: "route_request", SchemaVersion: 1, RequestID: "r",
				Group: "g", Model: "m", Protocol: ProtocolChat, AttemptLimit: 1,
				Bindings: []Binding{{
					BindingID: "ebond", ProtocolPlugin: "chat-v1", Rank: 1,
				}},
			},
		},
		{
			name: "route response provider URL",
			message: RouteResponse{
				Kind: "route_response", SchemaVersion: 1, RequestID: "r",
				SnapshotRevision: "rev", ExpiresAt: 1,
				Bindings: []Binding{{
					BindingID:      "https://api.provider.example/v1",
					ProtocolPlugin: "chat-v1", Rank: 1,
				}},
				Signature: strings.Repeat("a", 43),
			},
		},
		{
			name: "snapshot provider name",
			message: SignedSnapshot{
				Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev",
				IssuedAt: 1, ExpiresAt: 2, ConfigSHA256: strings.Repeat("a", 64),
				PluginManifestSHA256: strings.Repeat("b", 64),
				Routes: []SnapshotRoute{{
					Group: "g", Model: "m", Protocol: ProtocolChat,
					Bindings: []Binding{{
						BindingID: "hualong", ProtocolPlugin: "chat-v1", Rank: 1,
					}},
				}},
				Signature: strings.Repeat("c", 43),
			},
		},
		{
			name: "attempt outcome provider URL",
			message: AttemptOutcome{
				Kind: "attempt_outcome", SchemaVersion: 1, EventID: "e",
				RequestID: "r", BindingID: "https://provider.example/endpoint",
				Protocol: ProtocolChat, Outcome: OutcomeSuccess,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.message.Validate(); err == nil {
				t.Fatal("Validate() error = nil, want noncanonical binding ID rejection")
			}
		})
	}
}

func TestAttemptOutcomeRetryAfterBounds(t *testing.T) {
	base := AttemptOutcome{
		Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1",
		RequestID: "req-1", BindingID: "bnd_AAAAAAAAAAAAAAAAAAAAAAAA",
		Protocol: ProtocolChat, Outcome: OutcomeRateLimited429,
	}
	const maximumRetryAfterMS = int64((24 * 60 * 60 * 1000))

	atLimit := base
	atLimit.RetryAfterMS = maximumRetryAfterMS
	if err := atLimit.Validate(); err != nil {
		t.Fatalf("Validate() at 24-hour limit error = %v", err)
	}

	overLimit := base
	overLimit.RetryAfterMS = maximumRetryAfterMS + 1
	if err := overLimit.Validate(); err == nil {
		t.Fatal("Validate() above 24-hour limit error = nil, want fail-closed rejection")
	}

	negative := base
	negative.RetryAfterMS = -1
	if err := negative.Validate(); err == nil {
		t.Fatal("Validate() negative retry-after error = nil, want fail-closed rejection")
	}
}

func TestDecodeStrictRejectsUnknownFields(t *testing.T) {
	body := strings.NewReader(`{
		"kind":"route_request",
		"schema_version":1,
		"request_id":"req-1",
		"group":"default",
		"model":"model-a",
		"protocol":"chat",
		"attempt_limit":1,
		"secret":"must-not-pass"
	}`)

	var request RouteRequest
	if err := DecodeStrict(body, &request); err == nil {
		t.Fatal("DecodeStrict() error = nil, want unknown-field rejection")
	}
}
