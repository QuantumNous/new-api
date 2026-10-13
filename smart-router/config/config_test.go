package config

import (
	"strings"
	"testing"
	"time"
)

func TestLoadUsesSafeDefaultsAndValidatesSigningKey(t *testing.T) {
	values := map[string]string{
		"SMART_ROUTER_SIGNING_KEY": strings.Repeat("k", 32),
	}
	configuration, err := Load(func(name string) string { return values[name] })
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if configuration.ListenAddress != "127.0.0.1:8080" {
		t.Fatalf("ListenAddress = %q, want loopback default", configuration.ListenAddress)
	}
	if configuration.DatabasePath != "smart-router.db" {
		t.Fatalf("DatabasePath = %q, want smart-router.db", configuration.DatabasePath)
	}
	if configuration.SnapshotTTL != 5*time.Minute {
		t.Fatalf("SnapshotTTL = %v, want 5m", configuration.SnapshotTTL)
	}
	if len(configuration.SigningKey) != 32 {
		t.Fatalf("SigningKey length = %d, want 32", len(configuration.SigningKey))
	}
}

func TestLoadRejectsUnsafeOrInvalidValues(t *testing.T) {
	tests := []struct {
		name   string
		values map[string]string
	}{
		{"missing signing key", map[string]string{}},
		{"short signing key", map[string]string{"SMART_ROUTER_SIGNING_KEY": "short"}},
		{
			"wildcard listen",
			map[string]string{
				"SMART_ROUTER_SIGNING_KEY": strings.Repeat("k", 32),
				"SMART_ROUTER_LISTEN":      ":8080",
			},
		},
		{
			"invalid ttl",
			map[string]string{
				"SMART_ROUTER_SIGNING_KEY":  strings.Repeat("k", 32),
				"SMART_ROUTER_SNAPSHOT_TTL": "forever",
			},
		},
		{
			"negative hysteresis",
			map[string]string{
				"SMART_ROUTER_SIGNING_KEY":           strings.Repeat("k", 32),
				"SMART_ROUTER_HYSTERESIS_MICROUNITS": "-1",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := Load(func(name string) string { return test.values[name] })
			if err == nil {
				t.Fatal("Load() error = nil, want validation failure")
			}
			if strings.Contains(err.Error(), strings.Repeat("k", 32)) {
				t.Fatal("Load() error disclosed signing key")
			}
		})
	}
}

func TestLoadAllowsExplicitContainerListenOptIn(t *testing.T) {
	values := map[string]string{
		"SMART_ROUTER_SIGNING_KEY":        strings.Repeat("k", 32),
		"SMART_ROUTER_LISTEN":             "0.0.0.0:8080",
		"SMART_ROUTER_ALLOW_NON_LOOPBACK": "true",
	}
	configuration, err := Load(func(name string) string { return values[name] })
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if configuration.ListenAddress != "0.0.0.0:8080" ||
		!configuration.AllowNonLoopback {
		t.Fatalf("container configuration = %#v", configuration)
	}
}

func TestPublicHashesAreStableAndDoNotIncludeSigningKey(t *testing.T) {
	first := Config{
		ListenAddress: "127.0.0.1:8080", DatabasePath: "one.db",
		SigningKey: []byte(strings.Repeat("a", 32)), SnapshotTTL: time.Minute,
		HysteresisMicrounits: 2,
	}
	second := first
	second.SigningKey = []byte(strings.Repeat("b", 32))

	firstConfig, firstPlugins, err := first.PublicHashes()
	if err != nil {
		t.Fatalf("PublicHashes() error = %v", err)
	}
	secondConfig, secondPlugins, err := second.PublicHashes()
	if err != nil {
		t.Fatalf("PublicHashes() second error = %v", err)
	}
	if firstConfig != secondConfig || firstPlugins != secondPlugins {
		t.Fatal("public hashes changed when only the signing key changed")
	}
	if len(firstConfig) != 64 || len(firstPlugins) != 64 {
		t.Fatalf("hash lengths = %d/%d, want 64/64", len(firstConfig), len(firstPlugins))
	}
}
