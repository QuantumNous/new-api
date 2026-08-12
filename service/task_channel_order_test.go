package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestFilterTriedChannelIDs(t *testing.T) {
	got := FilterTriedChannelIDs([]int{1, 2, 3, 4}, []int{2, 4})
	if len(got) != 2 || got[0] != 1 || got[1] != 3 {
		t.Fatalf("got=%v", got)
	}
}

func TestChannelIndexInOrder(t *testing.T) {
	if ChannelIndexInOrder([]int{10, 20, 30}, 20) != 2 {
		t.Fatal("expected 2")
	}
	if ChannelIndexInOrder([]int{10, 20}, 99) != 0 {
		t.Fatal("expected 0")
	}
}

func TestResolveTaskFailoverChannelIDs_OverrideNeedsAvailable(t *testing.T) {
	t.Cleanup(func() {
		_ = operation_setting.UpdateTaskModelChannelOrderByJSONString("{}")
	})
	if err := operation_setting.UpdateTaskModelChannelOrderByJSONString(`{"m":[1,2]}`); err != nil {
		t.Fatal(err)
	}
	// No ability cache / DB rows for model m → override IDs filtered out.
	got := ResolveTaskFailoverChannelIDs("default", "m")
	if len(got) != 0 {
		t.Fatalf("expected empty without available channels, got=%v", got)
	}
}
