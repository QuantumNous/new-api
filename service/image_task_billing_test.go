package service

import "testing"

func TestImageTaskTerminalFailure(t *testing.T) {
	if !imageTaskTerminalFailure("failed") {
		t.Fatal("expected failed")
	}
	if imageTaskTerminalFailure("in_progress") {
		t.Fatal("expected not terminal")
	}
}

func TestUpstreamImageTaskConfirmedUncharged_zeroCost(t *testing.T) {
	poll := ImageTaskPollResult{
		Status:       "failed",
		UpstreamCost: 0,
		CreditsCost:  0,
	}
	if poll.UpstreamCost > 0 || poll.CreditsCost > 0 {
		t.Fatal("expected zero cost")
	}
}
