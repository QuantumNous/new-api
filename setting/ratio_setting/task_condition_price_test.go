package ratio_setting

import "testing"

func TestUpdateTaskConditionPriceByJSONStringAndLookup(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	jsonStr := `{
		"doubao-seedance-2-0": {
			"720p": {
				"input_text_only": 46,
				"input_with_video": 28
			},
			"1080p": {
				"input_text_only": 51,
				"input_with_video": 31
			}
		}
	}`

	if err := UpdateTaskConditionPriceByJSONString(jsonStr); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	price, ok := GetTaskConditionalInputPrice("doubao-seedance-2-0", "720p", false)
	if !ok {
		t.Fatalf("expected configured task condition price")
	}
	if price != 46 {
		t.Fatalf("expected price 46, got %v", price)
	}

	videoPrice, ok := GetTaskConditionalInputPrice("doubao-seedance-2-0", "1080p", true)
	if !ok {
		t.Fatalf("expected configured video-input price")
	}
	if videoPrice != 31 {
		t.Fatalf("expected price 31, got %v", videoPrice)
	}
}

func TestGetTaskConditionalInputPriceNormalizes480p(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	if err := UpdateTaskConditionPriceByJSONString(`{
		"doubao-seedance-2-0": {
			"720p": {
				"input_text_only": 46,
				"input_with_video": 28
			}
		}
	}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	price, ok := GetTaskConditionalInputPrice("doubao-seedance-2-0", "480p", true)
	if !ok {
		t.Fatalf("expected 480p to fall back to 720p pricing")
	}
	if price != 28 {
		t.Fatalf("expected price 28, got %v", price)
	}
}

func TestGetTaskConditionalInputPriceFallsBackTo720pForUnknownResolution(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateTaskConditionPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup failed: %v", err)
		}
	})

	if err := UpdateTaskConditionPriceByJSONString(`{
		"doubao-seedance-2-0": {
			"720p": {
				"input_text_only": 46,
				"input_with_video": 28
			}
		}
	}`); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	price, ok := GetTaskConditionalInputPrice("doubao-seedance-2-0", "2k", false)
	if !ok {
		t.Fatalf("expected unknown resolution to fall back to 720p pricing")
	}
	if price != 46 {
		t.Fatalf("expected price 46, got %v", price)
	}
}
