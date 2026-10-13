package main

import (
	"context"
	"strings"
	"testing"
)

func TestProbeUsesOnlySyntheticSanitizedFixtures(t *testing.T) {
	for _, provider := range []string{"ebond", "hualong", "leyi"} {
		observation, err := probe(context.Background(), provider)
		if err != nil {
			t.Fatalf("probe(%q) error = %v", provider, err)
		}
		if observation.Provider != provider || len(observation.Fingerprint) != 64 {
			t.Fatalf("probe(%q) = %#v", provider, observation)
		}
		encoded := observation.Provider + strings.Join(observation.Models, ",") +
			observation.Fingerprint
		for _, forbidden := range []string{"token", "cookie", "authorization", "prompt"} {
			if strings.Contains(strings.ToLower(encoded), forbidden) {
				t.Fatalf("probe(%q) disclosed forbidden field %q", provider, forbidden)
			}
		}
	}
	if _, err := probe(context.Background(), "unknown"); err == nil {
		t.Fatal("probe(unknown) error = nil, want unsupported provider")
	}
}
