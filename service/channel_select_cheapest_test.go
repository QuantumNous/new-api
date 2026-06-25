package service

import "testing"

func TestAutoCheapestGroupName(t *testing.T) {
	if AutoCheapestGroup != "default" {
		t.Fatalf("AutoCheapestGroup = %q, want default", AutoCheapestGroup)
	}
}
