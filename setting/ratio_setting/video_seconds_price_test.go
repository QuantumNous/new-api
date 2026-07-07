package ratio_setting

import "testing"

func TestGetVideoSecondsPriceSelectsDefault(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateVideoSecondsPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup video seconds price failed: %v", err)
		}
	})

	if err := UpdateVideoSecondsPriceByJSONString(`{
		"happyhorse-1.1-r2v": {
			"720p": {"default": 0.9}
		}
	}`); err != nil {
		t.Fatalf("update video seconds price failed: %v", err)
	}
	price, ok := GetVideoSecondsPrice("happyhorse-1.1-r2v", "720p", false)
	if !ok {
		t.Fatalf("expected configured price")
	}
	if price != 0.9 {
		t.Fatalf("expected 0.9, got %v", price)
	}
}

func TestGetVideoSecondsPriceSelectsSilent(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateVideoSecondsPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup video seconds price failed: %v", err)
		}
	})

	if err := UpdateVideoSecondsPriceByJSONString(`{
		"happyhorse-1.1-r2v": {
			"720p": {"default": 0.9, "silent": 0.6}
		}
	}`); err != nil {
		t.Fatalf("update video seconds price failed: %v", err)
	}
	price, ok := GetVideoSecondsPrice("happyhorse-1.1-r2v", "720p", false)
	if !ok || price != 0.6 {
		t.Fatalf("expected silent price 0.6, got ok=%v price=%v", ok, price)
	}
}

func TestGetVideoSecondsPriceSelectsAudio(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateVideoSecondsPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup video seconds price failed: %v", err)
		}
	})

	if err := UpdateVideoSecondsPriceByJSONString(`{
		"kling/kling-v3-video-generation": {
			"1080p": {"default": 1.2, "audio": 1.5}
		}
	}`); err != nil {
		t.Fatalf("update video seconds price failed: %v", err)
	}
	price, ok := GetVideoSecondsPrice("kling/kling-v3-video-generation", "1080p", true)
	if !ok || price != 1.5 {
		t.Fatalf("expected audio price 1.5, got ok=%v price=%v", ok, price)
	}
}

func TestGetVideoSecondsPriceFallsBackToDefault(t *testing.T) {
	t.Cleanup(func() {
		if err := UpdateVideoSecondsPriceByJSONString(`{}`); err != nil {
			t.Fatalf("cleanup video seconds price failed: %v", err)
		}
	})

	if err := UpdateVideoSecondsPriceByJSONString(`{
		"kling/kling-v3-video-generation": {
			"1080p": {"default": 1.2}
		}
	}`); err != nil {
		t.Fatalf("update video seconds price failed: %v", err)
	}
	price, ok := GetVideoSecondsPrice("kling/kling-v3-video-generation", "1080p", true)
	if !ok || price != 1.2 {
		t.Fatalf("expected fallback price 1.2, got ok=%v price=%v", ok, price)
	}
}
