package fingerprint

import (
	"testing"

	"smart-router/api"
)

func TestComputeIsStableAcrossCapabilityOrder(t *testing.T) {
	first, err := Compute(Document{
		Provider: "ebond", Revision: "v1", Healthy: true,
		Models:    []string{"model-b", "model-a"},
		Protocols: []api.Protocol{api.ProtocolResponses, api.ProtocolChat},
	})
	if err != nil {
		t.Fatalf("Compute() error = %v", err)
	}
	second, err := Compute(Document{
		Provider: "ebond", Revision: "v1", Healthy: true,
		Models:    []string{"model-a", "model-b"},
		Protocols: []api.Protocol{api.ProtocolChat, api.ProtocolResponses},
	})
	if err != nil {
		t.Fatalf("Compute() reordered error = %v", err)
	}
	if first != second {
		t.Fatalf("fingerprints differ: %q != %q", first, second)
	}
	if len(first) != 64 {
		t.Fatalf("fingerprint length = %d, want 64", len(first))
	}
}

func TestComputeRejectsSensitiveOrEmptyProviderMetadata(t *testing.T) {
	tests := []Document{
		{Provider: "", Revision: "v1", Models: []string{"m"}},
		{Provider: "ebond", Revision: "v1", Models: []string{"m"}, Metadata: map[string]string{"token": "forbidden"}},
		{Provider: "ebond", Revision: "v1", Models: []string{"m"}, Metadata: map[string]string{"cookie_name": "forbidden"}},
	}
	for _, document := range tests {
		if _, err := Compute(document); err == nil {
			t.Fatalf("Compute(%#v) error = nil, want rejection", document)
		}
	}
}
