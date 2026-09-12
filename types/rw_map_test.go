package types

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRWMapUnmarshalJSONPreservesExistingDataOnDecodeError(t *testing.T) {
	m := NewRWMap[string, int]()
	m.Set("existing", 1)

	err := m.UnmarshalJSON([]byte(`{"replacement":2,"invalid":"not-an-int"}`))

	require.Error(t, err)
	require.Equal(t, map[string]int{"existing": 1}, m.ReadAll())
}

func TestLoadFromJsonStringPreservesExistingDataOnDecodeError(t *testing.T) {
	m := NewRWMap[string, int]()
	m.Set("existing", 1)

	err := LoadFromJsonString(m, `{"replacement":2,"invalid":"not-an-int"}`)

	require.Error(t, err)
	require.Equal(t, map[string]int{"existing": 1}, m.ReadAll())
}

func TestLoadFromJsonStringWithCallbackCommitsAtomically(t *testing.T) {
	t.Run("success replaces data and invokes callback once", func(t *testing.T) {
		m := NewRWMap[string, int]()
		m.Set("existing", 1)
		callbackCount := 0

		err := LoadFromJsonStringWithCallback(m, `{"replacement":2}`, func() {
			callbackCount++
		})

		require.NoError(t, err)
		require.Equal(t, map[string]int{"replacement": 2}, m.ReadAll())
		require.Equal(t, 1, callbackCount)
	})

	t.Run("failure preserves data and skips callback", func(t *testing.T) {
		m := NewRWMap[string, int]()
		m.Set("existing", 1)
		callbackCount := 0

		err := LoadFromJsonStringWithCallback(m, `{"replacement":2,"invalid":"not-an-int"}`, func() {
			callbackCount++
		})

		require.Error(t, err)
		require.Equal(t, map[string]int{"existing": 1}, m.ReadAll())
		require.Zero(t, callbackCount)
	})

	t.Run("nil callback still loads successfully", func(t *testing.T) {
		m := NewRWMap[string, int]()
		m.Set("existing", 1)

		err := LoadFromJsonStringWithCallback(m, `{"replacement":2}`, nil)

		require.NoError(t, err)
		require.Equal(t, map[string]int{"replacement": 2}, m.ReadAll())
	})
}
