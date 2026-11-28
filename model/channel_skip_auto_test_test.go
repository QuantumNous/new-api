package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannel_GetSkipAutoTest(t *testing.T) {
	t.Run("nil returns false", func(t *testing.T) {
		channel := &Channel{}
		require.False(t, channel.GetSkipAutoTest())
	})

	t.Run("zero returns false", func(t *testing.T) {
		val := 0
		channel := &Channel{SkipAutoTest: &val}
		require.False(t, channel.GetSkipAutoTest())
	})

	t.Run("one returns true", func(t *testing.T) {
		val := 1
		channel := &Channel{SkipAutoTest: &val}
		require.True(t, channel.GetSkipAutoTest())
	})
}
