package zzdh

import "testing"

func TestNormalizeTier_FromResolution(t *testing.T) {
	if got := normalizeTier("1080P", ""); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
	if got := normalizeTier("2K", ""); got != "2k" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_PreferResolutionOverSize(t *testing.T) {
	if got := normalizeTier("1080p", "720p"); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_FromSizeWxH(t *testing.T) {
	if got := normalizeTier("", "1920x1080"); got != "1080p" {
		t.Fatalf("got=%q", got)
	}
	if got := normalizeTier("", "1280x720"); got != "720p" {
		t.Fatalf("got=%q", got)
	}
	if got := normalizeTier("", "2560x1440"); got != "2k" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_Default720p(t *testing.T) {
	if got := normalizeTier("", ""); got != "720p" {
		t.Fatalf("got=%q", got)
	}
}

func TestResolveUpstreamModel_LogicH3(t *testing.T) {
	id, err := resolveUpstreamModel("zzdh-Minimax-h3", "1080p")
	if err != nil || id != "zzdh-Minimax-h3-1080p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	id, err = resolveUpstreamModel("zzdh-Minimax-h3", "2k")
	if err != nil || id != "zzdh-Minimax-h3-2k" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_DefaultTier(t *testing.T) {
	id, err := resolveUpstreamModel("zzdh-Minimax-h3", "")
	if err != nil || id != "zzdh-Minimax-h3-720p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_LegacyPassthrough(t *testing.T) {
	id, err := resolveUpstreamModel("zzdh-Minimax-h3-480p", "1080p")
	if err != nil || id != "zzdh-Minimax-h3-480p" {
		t.Fatalf("legacy should ignore request tier: id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_RejectUnknown(t *testing.T) {
	_, err := resolveUpstreamModel("unknown-model", "720p")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestResolveUpstreamModel_RejectBadTier(t *testing.T) {
	_, err := resolveUpstreamModel("zzdh-Minimax-h3", "4k")
	if err == nil {
		t.Fatal("expected error for 4k")
	}
}
