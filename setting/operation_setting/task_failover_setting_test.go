package operation_setting

import "testing"

func TestUpdateTaskModelChannelOrderByJSONString(t *testing.T) {
	t.Cleanup(func() {
		_ = UpdateTaskModelChannelOrderByJSONString("{}")
	})

	if err := UpdateTaskModelChannelOrderByJSONString(`{"seedance2":[3,1,2]}`); err != nil {
		t.Fatal(err)
	}
	got := GetTaskModelChannelOrder("seedance2")
	if len(got) != 3 || got[0] != 3 || got[1] != 1 || got[2] != 2 {
		t.Fatalf("got=%v", got)
	}
	if GetTaskModelChannelOrder("missing") != nil {
		t.Fatal("expected nil for missing model")
	}
}

func TestUpdateTaskModelChannelOrderByJSONString_Invalid(t *testing.T) {
	t.Cleanup(func() {
		_ = UpdateTaskModelChannelOrderByJSONString("{}")
	})
	if err := UpdateTaskModelChannelOrderByJSONString(`not-json`); err == nil {
		t.Fatal("expected error")
	}
}

func TestUpdateTaskModelChannelOrderByJSONString_Empty(t *testing.T) {
	if err := UpdateTaskModelChannelOrderByJSONString(""); err != nil {
		t.Fatal(err)
	}
	if len(GetAllTaskModelChannelOrder()) != 0 {
		t.Fatal("expected empty map")
	}
}
