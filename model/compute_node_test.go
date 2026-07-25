package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// TestComputeNodeWhitelabelSerialization asserts that the internal provider
// fields are NEVER serialized into a client-facing JSON response, while the
// public flatkey-branded fields always are.
func TestComputeNodeWhitelabelSerialization(t *testing.T) {
	node := ComputeNode{
		Id:          7,
		Label:       "flatkey-compute-1",
		GpuName:     "RTX 4090",
		CostPerHour: 0.42,
		ModelServed: "flatkey-compute-fast",
		Status:      ComputeNodeStatusRunning,
		ChannelId:   99,
		CreatedTime: 1720000000,

		// Internal-only — must not appear anywhere in the JSON.
		Provider:           ComputeProviderVast,
		ProviderContractID: "1234567",
		HostIP:             "203.0.113.7",
		HostPort:           41022,
		UpstreamKey:        "sk-upstream-secret-should-never-leak",
	}

	raw, err := common.Marshal(node)
	if err != nil {
		t.Fatalf("marshal compute node: %v", err)
	}
	out := string(raw)

	// Public fields must be present.
	for _, want := range []string{
		`"label":"flatkey-compute-1"`,
		`"gpu_name":"RTX 4090"`,
		`"cost_per_hour":0.42`,
		`"model_served":"flatkey-compute-fast"`,
		`"status":"running"`,
		`"channel_id":99`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("expected public field %s in serialized output, got: %s", want, out)
		}
	}

	// Internal / provider-identifying values must be absent (whitelabel).
	for _, leak := range []string{
		"vast",
		"provider",
		"1234567",
		"203.0.113.7",
		"41022",
		"sk-upstream-secret-should-never-leak",
		"upstream_key",
		"host_ip",
		"contract",
	} {
		if strings.Contains(strings.ToLower(out), strings.ToLower(leak)) {
			t.Errorf("whitelabel leak: serialized compute node contains %q: %s", leak, out)
		}
	}
}
