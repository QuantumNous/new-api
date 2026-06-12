package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseIntSetEnv(t *testing.T) {
	const key = "ANTHROPIC_RECALC_INPUT_TOKENS_CHANNELS"

	t.Run("empty", func(t *testing.T) {
		t.Setenv(key, "")
		set := parseIntSetEnv(key)
		assert.NotNil(t, set)
		assert.Len(t, set, 0)
	})

	t.Run("csv with spaces and junk", func(t *testing.T) {
		t.Setenv(key, " 7, 14 ,,abc,21")
		set := parseIntSetEnv(key)
		assert.Len(t, set, 3)
		for _, id := range []int{7, 14, 21} {
			_, ok := set[id]
			assert.True(t, ok, "expected channel id %d in set", id)
		}
		_, ok := set[99]
		assert.False(t, ok)
	})
}
