package model

import "testing"

func TestChannelModelLookupCandidatesSeedanceAliases(t *testing.T) {
	candidates := ChannelModelLookupCandidates("Seedance-2.0")
	want := map[string]bool{
		"Seedance-2.0": true,
		"Seedance 2.0": true,
	}
	for _, c := range candidates {
		if !want[c] && c != "Seedance-2.0" {
			// FormatMatchingModelName may add variants; ensure aliases are present
			continue
		}
		delete(want, c)
	}
	if len(want) != 0 {
		t.Fatalf("missing candidates: %v from %v", want, candidates)
	}
}

func TestTrimChannelList(t *testing.T) {
	got := TrimChannelList("vyro-seedance-2-fast, Seedance 2.0 ")
	want := []string{"vyro-seedance-2-fast", "Seedance 2.0"}
	if len(got) != len(want) {
		t.Fatalf("TrimChannelList() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("TrimChannelList()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
