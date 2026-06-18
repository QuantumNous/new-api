package common

import "testing"

func TestUpstreamTraceSampleRate_RoundTripAndClamp(t *testing.T) {
	defer SetUpstreamTraceSampleRate(1.0) // restore default for other tests

	SetUpstreamTraceSampleRate(0.5)
	if got := GetUpstreamTraceSampleRate(); got != 0.5 {
		t.Errorf("Get after Set(0.5) = %v, want 0.5", got)
	}
	SetUpstreamTraceSampleRate(1.5) // clamp high
	if got := GetUpstreamTraceSampleRate(); got != 1.0 {
		t.Errorf("clamp high: got %v, want 1.0", got)
	}
	SetUpstreamTraceSampleRate(-0.3) // clamp low
	if got := GetUpstreamTraceSampleRate(); got != 0 {
		t.Errorf("clamp low: got %v, want 0", got)
	}
}

func TestUpstreamTraceSampleHit_Boundaries(t *testing.T) {
	defer SetUpstreamTraceSampleRate(1.0)

	SetUpstreamTraceSampleRate(1.0)
	for i := 0; i < 200; i++ {
		if !UpstreamTraceSampleHit() {
			t.Fatal("rate 1.0 must always hit")
		}
	}
	SetUpstreamTraceSampleRate(0.0)
	for i := 0; i < 200; i++ {
		if UpstreamTraceSampleHit() {
			t.Fatal("rate 0.0 must never hit")
		}
	}
}

func TestUpstreamTraceSampleHit_PartialIsProbabilistic(t *testing.T) {
	defer SetUpstreamTraceSampleRate(1.0)

	SetUpstreamTraceSampleRate(0.5)
	hits := 0
	const n = 3000
	for i := 0; i < n; i++ {
		if UpstreamTraceSampleHit() {
			hits++
		}
	}
	if hits == 0 || hits == n {
		t.Fatalf("rate 0.5 over %d runs hit %d times — not sampling", n, hits)
	}
}
