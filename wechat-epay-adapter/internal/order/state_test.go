package order

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanTransitionAllowsDesignedStateMachine(t *testing.T) {
	tests := []struct {
		from Status
		to   Status
	}{
		{StatusCreating, StatusPayable},
		{StatusCreating, StatusCreateUnknown},
		{StatusCreateUnknown, StatusCreateFailed},
		{StatusCreateFailed, StatusCreating},
		{StatusPayable, StatusPaidPendingNotify},
		{StatusPaidPendingNotify, StatusNotified},
		{StatusExpired, StatusManualReview},
	}
	for _, test := range tests {
		assert.True(t, CanTransition(test.from, test.to), "%s -> %s", test.from, test.to)
	}
}

func TestValidateTransitionRejectsTerminalStateOverwrite(t *testing.T) {
	assert.Error(t, ValidateTransition(StatusNotified, StatusPayable))
	assert.Error(t, ValidateTransition(StatusManualReview, StatusPaidPendingNotify))
	assert.False(t, CanTransition(StatusExpired, StatusNotified))
}

func TestIsPaid(t *testing.T) {
	assert.True(t, IsPaid(StatusPaidPendingNotify))
	assert.True(t, IsPaid(StatusNotified))
	assert.False(t, IsPaid(StatusPayable))
}
