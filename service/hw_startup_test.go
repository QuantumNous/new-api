package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestHwAfterEnvCheck pins the start-up environment gate: an unsafe flag
// refuses the start, a valid development environment passes, and the
// batch-update warning alone never stops the process.
func TestHwAfterEnvCheck(t *testing.T) {
	t.Run("a valid development environment passes", func(t *testing.T) {
		t.Setenv("APP_ENV", "development")
		t.Setenv("HW_SKIP_PHONE_STEP", "")
		t.Setenv("HW_SIGNAL_SALT", "")
		t.Setenv("BATCH_UPDATE_ENABLED", "false")
		require.NoError(t, hwAfterEnvCheck())
	})

	t.Run("the phone-step skip outside development is refused", func(t *testing.T) {
		t.Setenv("APP_ENV", "production")
		t.Setenv("HW_SKIP_PHONE_STEP", "true")
		t.Setenv("HW_SIGNAL_SALT", "0123456789abcdef0123456789abcdef")
		require.ErrorIs(t, hwAfterEnvCheck(), common.ErrHwPhoneStepSkipOutsideDevelopment)
	})

	t.Run("a missing signal salt in production is refused", func(t *testing.T) {
		t.Setenv("APP_ENV", "production")
		t.Setenv("HW_SKIP_PHONE_STEP", "")
		t.Setenv("HW_SIGNAL_SALT", "short")
		require.ErrorIs(t, hwAfterEnvCheck(), common.ErrHwSignalSaltRequired)
	})

	t.Run("the batch-update warning does not stop the start", func(t *testing.T) {
		t.Setenv("APP_ENV", "development")
		t.Setenv("HW_SKIP_PHONE_STEP", "")
		t.Setenv("BATCH_UPDATE_ENABLED", "true")
		assert.NoError(t, hwAfterEnvCheck())
	})
}
