package controller

import "testing"

func TestIsHiddenChannelDataModel(t *testing.T) {
	if !isHiddenChannelDataModel(" gemini-3.1-flash-lite ") {
		t.Fatal("gemini-3.1-flash-lite should be hidden from channel data and marketplace")
	}
	if isHiddenChannelDataModel("gemini-3.5-flash") {
		t.Fatal("gemini-3.5-flash should remain visible")
	}
}
