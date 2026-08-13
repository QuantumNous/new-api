package relay

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/service"
)

// fakeSecondBillingAdaptor stands in for a task adaptor that reports a
// per-second billing failure.
type fakeSecondBillingAdaptor struct {
	err   error
	units map[string]float64
}

func (f *fakeSecondBillingAdaptor) SecondBillingRatios() (map[string]float64, error) {
	return f.units, f.err
}

func TestResolveSecondBillingRatios_PropagatesError(t *testing.T) {
	want := errors.New("no matching rule")
	got, err := resolveSecondBillingRatios(&fakeSecondBillingAdaptor{err: want})
	if !errors.Is(err, want) {
		t.Fatalf("err = %v, want %v", err, want)
	}
	if got != nil {
		t.Fatalf("ratios must be nil on error, got %v", got)
	}
}

func TestResolveSecondBillingRatios_ReturnsUnits(t *testing.T) {
	units := map[string]float64{"video_billing_units": 11.2}
	got, err := resolveSecondBillingRatios(&fakeSecondBillingAdaptor{units: units})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got["video_billing_units"] != 11.2 {
		t.Fatalf("units = %v, want 11.2", got)
	}
}

func TestResolveSecondBillingRatios_IgnoresNonImplementers(t *testing.T) {
	got, err := resolveSecondBillingRatios(struct{}{})
	if err != nil {
		t.Fatalf("a non-implementing adaptor must not error: %v", err)
	}
	if got != nil {
		t.Fatalf("ratios must be nil, got %v", got)
	}
}

func TestResolveSecondBillingRatios_NilAdaptor(t *testing.T) {
	got, err := resolveSecondBillingRatios(nil)
	if err != nil {
		t.Fatalf("a nil adaptor must not error: %v", err)
	}
	if got != nil {
		t.Fatalf("ratios must be nil, got %v", got)
	}
}

// An unpriceable request is a local configuration fault, not a channel fault.
// prepareTaskSubmit must therefore wrap it as a local TaskError: the controller
// hands every non-local TaskError to processChannelError, which logs a channel
// error and can auto-disable the channel on a keyword match ("permission
// denied", "operation not allowed", ...). A missing price rule would then take
// a healthy channel offline, and the same missing rule would do it again on
// every channel the retry loop tried.
func TestSecondBillingRejectionIsLocalNotChannelFault(t *testing.T) {
	taskErr := service.TaskErrorWrapperLocal(
		errors.New("no matching rule"), "video_price_not_configured", http.StatusBadRequest)

	if !taskErr.LocalError {
		t.Fatal("price-table rejection must be a local error, or it is blamed on the channel")
	}
	if taskErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", taskErr.StatusCode, http.StatusBadRequest)
	}
	if taskErr.Code != "video_price_not_configured" {
		t.Fatalf("code = %q, want video_price_not_configured", taskErr.Code)
	}
}

// TASK_PRICE_PATCH is a temporary escape hatch meaning "force pure per-call,
// skip every OtherRatios multiplier". A configured per-second price is a
// deliberate administrator decision and must outrank it: otherwise the
// multiplier is computed, stored in the billing snapshot, and then silently
// never applied, so a 30-second video bills at the base quota.
func TestShouldApplyOtherRatios(t *testing.T) {
	tests := []struct {
		name         string
		patched      bool
		secondRatios map[string]float64
		want         bool
	}{
		{"not patched, no per-second", false, nil, true},
		{"not patched, per-second", false, map[string]float64{"video_billing_units": 11.2}, true},
		{"patched, no per-second", true, nil, false},
		{"patched, per-second wins", true, map[string]float64{"video_billing_units": 11.2}, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldApplyOtherRatios(tc.patched, tc.secondRatios); got != tc.want {
				t.Fatalf("shouldApplyOtherRatios(%v, %v) = %v, want %v",
					tc.patched, tc.secondRatios, got, tc.want)
			}
		})
	}
}
