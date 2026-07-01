package vyroseedance

import "testing"

func TestUsesJSONAPI(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{"Seedance-2.0", true},
		{"Seedance 2.0", true},
		{"seedance-2.0", true},
		{"vyro-seedance-2-fast", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := UsesJSONAPI(tt.model); got != tt.want {
			t.Errorf("UsesJSONAPI(%q) = %v, want %v", tt.model, got, tt.want)
		}
	}
}

func TestUpstreamJSONModelName(t *testing.T) {
	if got := UpstreamJSONModelName("Seedance 2.0"); got != "Seedance-2.0" {
		t.Fatalf("UpstreamJSONModelName() = %q, want Seedance-2.0", got)
	}
}

func TestGetModelListIncludesSeedance20(t *testing.T) {
	a := &TaskAdaptor{}
	found := false
	for _, m := range a.GetModelList() {
		if m == "Seedance-2.0" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("GetModelList() should include Seedance-2.0")
	}
}
