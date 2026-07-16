package setting

import "testing"

func TestUpdateUserUsableGroupsByJSONStringKeepsDefaultsOnEmpty(t *testing.T) {
	if err := UpdateUserUsableGroupsByJSONString(`{"default":"默认分组","vip":"vip分组"}`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := UpdateUserUsableGroupsByJSONString(`{}`); err != nil {
		t.Fatalf("empty: %v", err)
	}
	got := GetUserUsableGroupsCopy()
	if _, ok := got["default"]; !ok {
		t.Fatalf("expected default usable group, got %#v", got)
	}
}
