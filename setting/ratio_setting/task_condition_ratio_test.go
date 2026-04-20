package ratio_setting

import "testing"

func TestUpdateTaskConditionRatioByJSONStringAndLookup(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateTaskConditionRatioByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	jsonStr := `{"video_input":{"doubao-seedance-1-0-pro-250528":0.5}}`

	if err := UpdateTaskConditionRatioByJSONString(jsonStr); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ratio, ok := GetTaskConditionRatio("video_input", "doubao-seedance-1-0-pro-250528")
	if !ok {
		t.Fatalf("expected configured condition ratio")
	}
	if ratio != 0.5 {
		t.Fatalf("expected ratio 0.5, got %v", ratio)
	}
}

func TestGetTaskConditionRatioMissingCondition(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateTaskConditionRatioByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	if err := UpdateTaskConditionRatioByJSONString(`{"video_input":{"model-a":0.5}}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := GetTaskConditionRatio("seconds", "model-a"); ok {
		t.Fatalf("expected missing condition lookup to fail")
	}
}
