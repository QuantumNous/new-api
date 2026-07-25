package compute

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// TestOfferWhitelabelSerialization asserts a proxied offer exposes only GPU /
// price / spec fields — never the upstream contract / host / machine / provider
// identifiers.
func TestOfferWhitelabelSerialization(t *testing.T) {
	offer := Offer{
		GpuName:     "RTX 4090",
		NumGpus:     2,
		GpuRamGB:    24,
		CostPerHour: 0.55,
		CpuCores:    16,
		RamGB:       64,
		DiskGB:      200,
		Reliability: 0.987,

		// Internal-only — must not leak.
		ContractID: 987654,
		HostID:     55123,
		MachineID:  44001,
		Datacenter: "US-CA",
	}

	raw, err := common.Marshal(offer)
	if err != nil {
		t.Fatalf("marshal offer: %v", err)
	}
	out := string(raw)

	for _, want := range []string{
		`"gpu_name":"RTX 4090"`,
		`"cost_per_hour":0.55`,
		`"num_gpus":2`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("expected public field %s, got: %s", want, out)
		}
	}

	for _, leak := range []string{"987654", "55123", "44001", "US-CA", "contract", "host_id", "machine"} {
		if strings.Contains(strings.ToLower(out), strings.ToLower(leak)) {
			t.Errorf("whitelabel leak: offer JSON contains %q: %s", leak, out)
		}
	}
}

func TestBuildOffersQuery(t *testing.T) {
	q, err := buildOffersQuery("RTX 4090")
	if err != nil {
		t.Fatalf("buildOffersQuery: %v", err)
	}
	if !strings.Contains(q, `"gpu_name"`) || !strings.Contains(q, "RTX 4090") {
		t.Errorf("expected gpu_name filter in query, got: %s", q)
	}
	if !strings.Contains(q, `"rentable"`) {
		t.Errorf("expected rentable filter in query, got: %s", q)
	}

	// Empty gpu name → no gpu_name filter, still valid.
	q2, err := buildOffersQuery("")
	if err != nil {
		t.Fatalf("buildOffersQuery empty: %v", err)
	}
	if strings.Contains(q2, "gpu_name") {
		t.Errorf("did not expect gpu_name filter for empty input, got: %s", q2)
	}
}

// TestConnectionWhitelabelSerialization asserts the owner-facing Connection
// exposes ssh host/port (their own rented card) but keeps the internal
// persistence mirrors and provider identity out of the JSON.
func TestConnectionWhitelabelSerialization(t *testing.T) {
	conn := Connection{
		SSHHost:  "ssh5.example.net",
		SSHPort:  41022,
		Status:   "running",
		Username: "root",
		HostIP:   "ssh5.example.net",
		HostPort: 41022,
	}
	raw, err := common.Marshal(conn)
	if err != nil {
		t.Fatalf("marshal connection: %v", err)
	}
	out := string(raw)
	for _, want := range []string{`"ssh_host":"ssh5.example.net"`, `"ssh_port":41022`, `"status":"running"`} {
		if !strings.Contains(out, want) {
			t.Errorf("expected owner-visible field %s, got: %s", want, out)
		}
	}
	// Internal persistence mirrors and any provider name must not appear as keys.
	for _, leak := range []string{"host_ip", "hostport", "vast", "contract"} {
		if strings.Contains(strings.ToLower(out), strings.ToLower(leak)) {
			t.Errorf("whitelabel leak: connection JSON contains %q: %s", leak, out)
		}
	}
}

func TestLooksLikeSSHPublicKey(t *testing.T) {
	valid := []string{
		"ssh-rsa AAAAB3NzaC1yc2E user@host",
		"ssh-ed25519 AAAAC3NzaC1lZDI1 user@host",
		"ecdsa-sha2-nistp256 AAAA...",
	}
	for _, k := range valid {
		if !looksLikeSSHPublicKey(k) {
			t.Errorf("expected %q to be recognized as an SSH public key", k)
		}
	}
	invalid := []string{"", "not a key", "rm -rf /", "AAAAB3NzaC1yc2E"}
	for _, k := range invalid {
		if looksLikeSSHPublicKey(k) {
			t.Errorf("did not expect %q to be recognized as an SSH public key", k)
		}
	}
}

func TestBuildAuthorizedKeysOnStart(t *testing.T) {
	key := "ssh-ed25519 AAAAC3NzaC1lZDI1 user@host"
	script := buildAuthorizedKeysOnStart(key)
	if !strings.Contains(script, key) {
		t.Errorf("onstart script should embed the public key, got: %s", script)
	}
	if !strings.Contains(script, "authorized_keys") {
		t.Errorf("onstart script should write authorized_keys, got: %s", script)
	}
	// Single quotes in the key must be stripped so they cannot break the
	// single-quoted shell command.
	inj := buildAuthorizedKeysOnStart("ssh-rsa AAA'; rm -rf / #")
	if strings.Contains(inj, "'; rm -rf") {
		t.Errorf("onstart script must strip single quotes to prevent injection, got: %s", inj)
	}
}

func TestMapUpstreamStatus(t *testing.T) {
	cases := map[string]string{
		"running": "running",
		"exited":  "stopped",
		"offline": "stopped",
		"created": "provisioning",
		"loading": "provisioning",
		"":        "provisioning",
		"weird":   "error",
	}
	for in, want := range cases {
		if got := mapUpstreamStatus(in); got != want {
			t.Errorf("mapUpstreamStatus(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCustomerHourlyPrice_MarksUpAndNeverLoses(t *testing.T) {
	for _, raw := range []float64{0.10, 0.40, 0.55, 2.99} {
		got := CustomerHourlyPrice(raw)
		want := raw * ComputeRentalMarkup
		d := got - want
		if d < 0 {
			d = -d
		}
		if d > 1e-9 {
			t.Fatalf("CustomerHourlyPrice(%v) = %v, want %v", raw, got, want)
		}
		// Core invariant: the customer always pays more than our upstream cost.
		if got <= raw {
			t.Fatalf("customer price %v must exceed raw cost %v", got, raw)
		}
	}
	if ComputeRentalMarkup < 1.30 {
		t.Fatalf("markup %v is below the required 30%%", ComputeRentalMarkup)
	}
}
