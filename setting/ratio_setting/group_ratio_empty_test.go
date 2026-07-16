package ratio_setting

import (
	"testing"
)

func TestUpdateGroupRatioByJSONStringKeepsDefaultsOnEmpty(t *testing.T) {
	// Ensure defaults are present first.
	if err := UpdateGroupRatioByJSONString(`{"default":1,"vip":1,"svip":1}`); err != nil {
		t.Fatalf("seed defaults: %v", err)
	}
	if err := UpdateGroupRatioByJSONString(`{}`); err != nil {
		t.Fatalf("empty update: %v", err)
	}
	got := GetGroupRatioCopy()
	if len(got) == 0 {
		t.Fatalf("expected defaults after empty update, got empty map")
	}
	if _, ok := got["default"]; !ok {
		t.Fatalf("expected default group after empty update, got %#v", got)
	}
}

func TestUpdateGroupRatioByJSONStringAcceptsCustom(t *testing.T) {
	if err := UpdateGroupRatioByJSONString(`{"default":1,"pro":1.2}`); err != nil {
		t.Fatalf("custom update: %v", err)
	}
	got := GetGroupRatioCopy()
	if got["pro"] != 1.2 {
		t.Fatalf("expected pro=1.2, got %#v", got)
	}
	if _, ok := got["default"]; !ok {
		t.Fatalf("expected default retained/set, got %#v", got)
	}
}

func TestUpdateGroupRatioInjectsDefaultWhenMissing(t *testing.T) {
	if err := UpdateGroupRatioByJSONString(`{"pro":1.5}`); err != nil {
		t.Fatalf("update without default: %v", err)
	}
	got := GetGroupRatioCopy()
	if _, ok := got["default"]; !ok {
		t.Fatalf("expected default injected, got %#v", got)
	}
	if got["pro"] != 1.5 {
		t.Fatalf("pro lost: %#v", got)
	}
}

func TestUpdateGroupRatioRejectsNegative(t *testing.T) {
	if err := UpdateGroupRatioByJSONString(`{"default":-1}`); err == nil {
		t.Fatal("expected error for negative ratio")
	}
}

func TestUpdateGroupGroupRatioEmptyClears(t *testing.T) {
	if err := UpdateGroupGroupRatioByJSONString(`{"vip":{"default":0.9}}`); err != nil {
		t.Fatalf("seed nested: %v", err)
	}
	if err := UpdateGroupGroupRatioByJSONString(`{}`); err != nil {
		t.Fatalf("empty nested: %v", err)
	}
	if r, ok := GetGroupGroupRatio("vip", "default"); ok {
		t.Fatalf("expected cleared nested map, still got %v", r)
	}
}

func TestUpdateGroupGroupRatioRejectsNegative(t *testing.T) {
	if err := UpdateGroupGroupRatioByJSONString(`{"vip":{"default":-0.1}}`); err == nil {
		t.Fatal("expected negative nested ratio error")
	}
}

func TestCheckGroupRatioAllowsEmpty(t *testing.T) {
	if err := CheckGroupRatio(`{}`); err != nil {
		t.Fatalf("empty should pass check: %v", err)
	}
	if err := CheckGroupRatio(`{"default":1}`); err != nil {
		t.Fatalf("valid should pass: %v", err)
	}
	if err := CheckGroupRatio(`{"default":-2}`); err == nil {
		t.Fatal("negative should fail check")
	}
}
