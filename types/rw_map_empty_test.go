package types

import "testing"

// Empty/blank option values must be treated as "no entries" rather than
// producing "unexpected end of JSON input" during option sync.
func TestLoadFromJsonStringEmpty(t *testing.T) {
	for _, in := range []string{"", "   ", "\n\t "} {
		m := NewRWMap[string, float64]()
		if err := LoadFromJsonString(m, in); err != nil {
			t.Fatalf("LoadFromJsonString(%q) returned error: %v", in, err)
		}
		if got := m.Len(); got != 0 {
			t.Fatalf("LoadFromJsonString(%q) expected empty map, got len=%d", in, got)
		}
	}
}

func TestLoadFromJsonStringWithCallbackEmpty(t *testing.T) {
	called := false
	m := NewRWMap[string, float64]()
	if err := LoadFromJsonStringWithCallback(m, "", func() { called = true }); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !called {
		t.Fatal("expected onSuccess callback to be invoked for empty input")
	}
	if m.Len() != 0 {
		t.Fatalf("expected empty map, got len=%d", m.Len())
	}
}

// Non-empty valid JSON must still load normally.
func TestLoadFromJsonStringValid(t *testing.T) {
	m := NewRWMap[string, float64]()
	if err := LoadFromJsonString(m, `{"a":1.5}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v, ok := m.Get("a"); !ok || v != 1.5 {
		t.Fatalf("expected a=1.5, got %v ok=%v", v, ok)
	}
}
