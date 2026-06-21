package taskcommon

import "testing"

func TestVideoResolutionSizeRatio(t *testing.T) {
	if got := VideoResolutionSizeRatio("720p"); got != 1.0 {
		t.Fatalf("720p: got %v", got)
	}
	if got := VideoResolutionSizeRatio("1024p"); got != 1.666667 {
		t.Fatalf("1024p: got %v", got)
	}
	if got := VideoResolutionSizeRatio("1080p"); got != 2.333333 {
		t.Fatalf("1080p: got %v", got)
	}
}

func TestVideoOpenAISizeRatio(t *testing.T) {
	if got := VideoOpenAISizeRatio("1280x720"); got != 1.0 {
		t.Fatalf("1280x720: got %v", got)
	}
	if got := VideoOpenAISizeRatio("1792x1024"); got != 1.666667 {
		t.Fatalf("1792x1024: got %v", got)
	}
	if got := VideoOpenAISizeRatio("1920x1080"); got != 2.333333 {
		t.Fatalf("1920x1080: got %v", got)
	}
}
