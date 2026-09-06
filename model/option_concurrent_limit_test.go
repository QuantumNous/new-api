package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsInvalidConcurrentLimitOptions(t *testing.T) {
	for _, value := range []string{"", "TRUE", "1", "yes", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue("ModelConcurrentLimitEnabled", value))
		})
	}
	require.NoError(t, validateOptionValue("ModelConcurrentLimitEnabled", "true"))
	require.NoError(t, validateOptionValue("ModelConcurrentLimitEnabled", "false"))

	for _, value := range []string{"", "-1", "1.5", "2147483648", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue("ModelConcurrentLimit", value))
		})
	}
	require.NoError(t, validateOptionValue("ModelConcurrentLimit", "0"))
	require.NoError(t, validateOptionValue("ModelConcurrentLimit", "2147483647"))
}
