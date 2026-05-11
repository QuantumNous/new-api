package constant

import (
	"testing"
)

func TestChannelTypeVolcAdapterRegistration(t *testing.T) {
	// Verify the constant value is 58 (next available after ChannelTypeCodex=57).
	if ChannelTypeVolcAdapter != 58 {
		t.Errorf("expected ChannelTypeVolcAdapter=58, got %d", ChannelTypeVolcAdapter)
	}

	// ChannelTypeDummy is explicitly assigned to equal ChannelTypeVolcAdapter
	// (the highest defined channel type). When adding a new channel type, append
	// it after the last existing one with an explicit numeric value, then update
	// ChannelTypeDummy to equal the new highest. The explicit assignment avoids
	// confusion with iota's implicit-repeat semantics.
	if ChannelTypeDummy != ChannelTypeVolcAdapter {
		t.Errorf("expected ChannelTypeDummy == ChannelTypeVolcAdapter (%d), got %d",
			ChannelTypeVolcAdapter, ChannelTypeDummy)
	}
}

func TestChannelTypeVolcAdapterDisplayName(t *testing.T) {
	name := GetChannelTypeName(ChannelTypeVolcAdapter)
	if name != "VolcAdapter" {
		t.Errorf("expected display name %q, got %q", "VolcAdapter", name)
	}
}

func TestChannelTypeVolcAdapterBaseURL(t *testing.T) {
	const wantURL = "https://ark.cn-beijing.volces.com"
	if ChannelTypeVolcAdapter >= len(ChannelBaseURLs) {
		t.Fatalf("ChannelBaseURLs too short: len=%d, ChannelTypeVolcAdapter=%d", len(ChannelBaseURLs), ChannelTypeVolcAdapter)
	}
	got := ChannelBaseURLs[ChannelTypeVolcAdapter]
	if got != wantURL {
		t.Errorf("expected base URL %q, got %q", wantURL, got)
	}
}

// TestChannelBaseURLsLength verifies the ChannelBaseURLs slice covers all channel
// types including ChannelTypeVolcAdapter, so no index-out-of-bounds can occur.
func TestChannelBaseURLsLength(t *testing.T) {
	// ChannelBaseURLs must have at least ChannelTypeVolcAdapter+1 entries (indices 0..ChannelTypeVolcAdapter).
	if len(ChannelBaseURLs) < ChannelTypeVolcAdapter+1 {
		t.Errorf("ChannelBaseURLs has %d entries but needs at least %d to cover ChannelTypeVolcAdapter=%d",
			len(ChannelBaseURLs), ChannelTypeVolcAdapter+1, ChannelTypeVolcAdapter)
	}
}

func TestChannelTypeVolcAdapterInNames(t *testing.T) {
	if _, ok := ChannelTypeNames[ChannelTypeVolcAdapter]; !ok {
		t.Errorf("ChannelTypeVolcAdapter (%d) not found in ChannelTypeNames map", ChannelTypeVolcAdapter)
	}
}
