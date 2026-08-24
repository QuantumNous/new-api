package types

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadFromJsonStringPreservesExistingDataOnInvalidJSON(t *testing.T) {
	values := NewRWMap[string, int]()
	values.Set("existing", 1)
	callbackCalled := false

	err := LoadFromJsonStringWithCallback(values, "{", func() {
		callbackCalled = true
	})

	require.Error(t, err)
	require.Equal(t, map[string]int{"existing": 1}, values.ReadAll())
	require.False(t, callbackCalled)
}

func TestLoadFromJsonStringReplacesDataAfterSuccessfulParse(t *testing.T) {
	values := NewRWMap[string, int]()
	values.Set("existing", 1)

	err := LoadFromJsonString(values, `{"replacement":2}`)

	require.NoError(t, err)
	require.Equal(t, map[string]int{"replacement": 2}, values.ReadAll())
}
