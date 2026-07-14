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

func TestLoadFromJsonStringTreatsBlankInputAsNoOp(t *testing.T) {
	// A stored option value that was never configured is persisted as an
	// empty/whitespace string. Unmarshaling that yields "unexpected end of
	// JSON input", which the 60s option sync would otherwise log forever.
	// Blank input must be a no-op that preserves the current contents.
	for _, blank := range []string{"", "   ", "\n\t"} {
		m := NewRWMap[string, int]()
		m.Set("existing", 1)

		err := LoadFromJsonString(m, blank)

		require.NoError(t, err)
		require.Equal(t, map[string]int{"existing": 1}, m.ReadAll())
	}
}

func TestLoadFromJsonStringWithCallbackSkipsCallbackOnBlankInput(t *testing.T) {
	m := NewRWMap[string, int]()
	m.Set("existing", 1)
	callbackCount := 0

	err := LoadFromJsonStringWithCallback(m, "", func() {
		callbackCount++
	})

	require.NoError(t, err)
	require.Equal(t, map[string]int{"existing": 1}, m.ReadAll())
	require.Zero(t, callbackCount)
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
