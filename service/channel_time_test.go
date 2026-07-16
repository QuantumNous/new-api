package service

import (
	"testing"
	"time"
)

func TestChannelNotifyTimeStringUsesBeijingTime(t *testing.T) {
	got := channelNotifyTimeString(time.Date(2026, 7, 15, 23, 57, 22, 0, time.UTC))
	want := "2026-07-16 07:57:22"
	if got != want {
		t.Fatalf("channelNotifyTimeString() = %q, want %q", got, want)
	}
}
