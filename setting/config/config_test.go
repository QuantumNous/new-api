package config

import (
	"encoding/json"
	"testing"
)

type cloneConfigValueFixture struct {
	Values map[string]any `json:"values"`
}

func TestCloneConfigValueCreatesDetachedSnapshot(t *testing.T) {
	original := &cloneConfigValueFixture{
		Values: map[string]any{
			"answer": 42,
		},
	}

	cloned, ok := cloneConfigValue(original).(*cloneConfigValueFixture)
	if !ok {
		t.Fatal("cloneConfigValue should return a cloned struct pointer")
	}

	number, ok := cloned.Values["answer"].(json.Number)
	if !ok {
		t.Fatalf("expected json.Number in cloned snapshot, got %T", cloned.Values["answer"])
	}
	if number.String() != "42" {
		t.Fatalf("expected cloned number to equal 42, got %s", number.String())
	}

	cloned.Values["answer"] = json.Number("43")
	if original.Values["answer"] != 42 {
		t.Fatalf("expected original config to remain unchanged, got %#v", original.Values["answer"])
	}
}
