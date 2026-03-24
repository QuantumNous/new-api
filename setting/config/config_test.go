package config

import (
	"encoding/json"
	"testing"
)

type cloneConfigValueFixture struct {
	Values map[string]any `json:"values"`
}

type cloneConfigValueUnsupportedFixture struct {
	Fn func()
}

func TestCloneConfigValueCreatesDetachedSnapshot(t *testing.T) {
	original := &cloneConfigValueFixture{
		Values: map[string]any{
			"answer": 42,
		},
	}

	clonedValue, err := cloneConfigValue(original)
	if err != nil {
		t.Fatalf("cloneConfigValue should clone supported config: %v", err)
	}

	cloned, ok := clonedValue.(*cloneConfigValueFixture)
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

func TestCloneConfigValueReturnsErrorForUnsupportedStruct(t *testing.T) {
	cloned, err := cloneConfigValue(&cloneConfigValueUnsupportedFixture{
		Fn: func() {},
	})
	if err == nil {
		t.Fatal("cloneConfigValue should fail for unsupported struct fields")
	}
	if cloned != nil {
		t.Fatalf("cloneConfigValue should not return live config on error, got %#v", cloned)
	}
}
