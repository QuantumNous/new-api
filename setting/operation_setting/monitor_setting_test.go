package operation_setting

import "testing"

func TestMonitorSettingGetAutoTestChannelExcludedIDMap(t *testing.T) {
	setting := &MonitorSetting{
		AutoTestChannelExcludedIds: "3, 5，8\n10\r\nabc\t0,-2,  15 ",
	}

	excluded := setting.GetAutoTestChannelExcludedIDMap()
	expected := []int{3, 5, 8, 10, 15}

	if len(excluded) != len(expected) {
		t.Fatalf("expected %d ids, got %d: %#v", len(expected), len(excluded), excluded)
	}

	for _, id := range expected {
		if !excluded[id] {
			t.Fatalf("expected id %d to be included, got %#v", id, excluded)
		}
	}

	for _, id := range []int{0, -2, 11} {
		if excluded[id] {
			t.Fatalf("did not expect id %d to be included, got %#v", id, excluded)
		}
	}
}
