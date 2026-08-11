package mao

import (
	"strings"
	"testing"
)

func TestNormalizeTier_FromResolution(t *testing.T) {
	if got := normalizeTier("1080P", ""); got != "1080p" {
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
	if got := normalizeTier("", "3840x2160"); got != "4k" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_Default720p(t *testing.T) {
	if got := normalizeTier("", ""); got != "720p" {
		t.Fatalf("got=%q", got)
	}
}

func TestNormalizeTier_ResolutionWxHOverSizeLabel(t *testing.T) {
	if got := normalizeTier("1920x1080", "720p"); got != "1080p" {
		t.Fatalf("got=%q want 1080p", got)
	}
}

func TestResolveUpstreamModel_Seedance20(t *testing.T) {
	id, err := resolveUpstreamModel("guanzhuan-seedance2.0", "1080p")
	if err != nil || id != "sd-2-0-1080p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
	id, err = resolveUpstreamModel("guanzhuan-seedance2.0", "4k")
	if err != nil || id != "sd-2-0-4k" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_MiniRejects1080p(t *testing.T) {
	_, err := resolveUpstreamModel("guanzhuan-seedance2.0-mini", "1080p")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestResolveUpstreamModel_25Rejects4k(t *testing.T) {
	_, err := resolveUpstreamModel("guanzhuan-seedance2.5", "4k")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestResolveUpstreamModel_MiniOK(t *testing.T) {
	id, err := resolveUpstreamModel("guanzhuan-seedance2.0-mini", "480p")
	if err != nil || id != "sd-2-0-mini-480p" {
		t.Fatalf("id=%q err=%v", id, err)
	}
}

func TestResolveUpstreamModel_UnknownLogic(t *testing.T) {
	_, err := resolveUpstreamModel("unknown-model", "720p")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "guanzhuan-seedance2.0") {
		t.Fatalf("error should list supported models, got=%v", err)
	}
}

func TestValidateDuration_Mini(t *testing.T) {
	if err := validateDuration("guanzhuan-seedance2.0-mini", 3); err == nil {
		t.Fatal("expected error for <4s")
	}
	if err := validateDuration("guanzhuan-seedance2.0-mini", 16); err == nil {
		t.Fatal("expected error for >15s")
	}
	if err := validateDuration("guanzhuan-seedance2.0-mini", 10); err != nil {
		t.Fatal(err)
	}
}

func TestValidateDuration_25Max30(t *testing.T) {
	if err := validateDuration("guanzhuan-seedance2.5", 31); err == nil {
		t.Fatal("expected error")
	}
	if err := validateDuration("guanzhuan-seedance2.5", 30); err != nil {
		t.Fatal(err)
	}
}

func TestSupportsCameraFixed(t *testing.T) {
	if supportsCameraFixed("guanzhuan-seedance2.0-mini") {
		t.Fatal("mini must not support camera_fixed")
	}
	if !supportsCameraFixed("guanzhuan-seedance2.0") {
		t.Fatal("2.0 should support camera_fixed")
	}
}
