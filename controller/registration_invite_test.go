package controller

import (
	"errors"
	"testing"
)

func TestResolveRegistrationInviterOptional(t *testing.T) {
	lookup := func(code string) (int, error) {
		if code == "VALID" {
			return 42, nil
		}
		return 0, errors.New("not found")
	}

	inviterID, err := resolveRegistrationInviter("optional", "", lookup)
	if err != nil || inviterID != 0 {
		t.Fatalf("empty optional code = (%d, %v), want (0, nil)", inviterID, err)
	}

	inviterID, err = resolveRegistrationInviter("optional", " VALID ", lookup)
	if err != nil || inviterID != 42 {
		t.Fatalf("valid optional code = (%d, %v), want (42, nil)", inviterID, err)
	}

	_, err = resolveRegistrationInviter("optional", "INVALID", lookup)
	if !errors.Is(err, errRegistrationInviteCodeInvalid) {
		t.Fatalf("invalid optional code error = %v, want errRegistrationInviteCodeInvalid", err)
	}
}

func TestResolveRegistrationInviterRequired(t *testing.T) {
	lookup := func(code string) (int, error) {
		if code == "VALID" {
			return 7, nil
		}
		return 0, errors.New("not found")
	}

	_, err := resolveRegistrationInviter("required", "  ", lookup)
	if !errors.Is(err, errRegistrationInviteCodeRequired) {
		t.Fatalf("empty required code error = %v, want errRegistrationInviteCodeRequired", err)
	}

	_, err = resolveRegistrationInviter("required", "INVALID", lookup)
	if !errors.Is(err, errRegistrationInviteCodeInvalid) {
		t.Fatalf("invalid required code error = %v, want errRegistrationInviteCodeInvalid", err)
	}

	inviterID, err := resolveRegistrationInviter("required", "VALID", lookup)
	if err != nil || inviterID != 7 {
		t.Fatalf("valid required code = (%d, %v), want (7, nil)", inviterID, err)
	}
}

func TestResolveRegistrationInviterHidden(t *testing.T) {
	lookup := func(code string) (int, error) {
		if code == "VALID" {
			return 9, nil
		}
		return 0, errors.New("not found")
	}

	inviterID, err := resolveRegistrationInviter("hidden", "VALID", lookup)
	if err != nil || inviterID != 0 {
		t.Fatalf("valid hidden link code = (%d, %v), want (0, nil)", inviterID, err)
	}

	inviterID, err = resolveRegistrationInviter("hidden", "STALE", lookup)
	if err != nil || inviterID != 0 {
		t.Fatalf("invalid hidden link code = (%d, %v), want (0, nil)", inviterID, err)
	}
}

func TestNormalizeRegistrationInviteMode(t *testing.T) {
	for _, mode := range []string{"optional", "required", "hidden"} {
		if got := normalizeRegistrationInviteMode(mode); got != mode {
			t.Fatalf("normalizeRegistrationInviteMode(%q) = %q", mode, got)
		}
	}

	if got := normalizeRegistrationInviteMode("unexpected"); got != "optional" {
		t.Fatalf("invalid mode normalized to %q, want optional", got)
	}
}
