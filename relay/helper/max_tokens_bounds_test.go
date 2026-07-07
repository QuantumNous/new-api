package helper

import (
	"math"
	"testing"
)

func TestExceedsMaxTokensLimitChecksAllFields(t *testing.T) {
	valid := uint(maxTokensLimit)
	invalid := uint(math.MaxInt32)

	if exceedsMaxTokensLimit(&valid) {
		t.Fatal("limit value should be accepted")
	}
	if !exceedsMaxTokensLimit(nil, &invalid) {
		t.Fatal("oversized max token value should be rejected")
	}
}
