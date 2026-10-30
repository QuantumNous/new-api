package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedisHashToObjDestination(t *testing.T) {
	type entry struct {
		ID int
	}
	var typedNil *entry
	for _, test := range []struct {
		name string
		obj  any
	}{
		{name: "nil interface", obj: nil},
		{name: "typed nil pointer", obj: typedNil},
		{name: "non-pointer struct", obj: entry{}},
		{name: "pointer to non-struct", obj: new(int)},
	} {
		t.Run(test.name, func(t *testing.T) {
			var err error
			require.NotPanics(t, func() {
				err = RedisHashToObj(map[string]string{"ID": "7"}, test.obj)
			})
			require.Error(t, err)
		})
	}

	t.Run("valid destination", func(t *testing.T) {
		var obj entry
		require.NoError(t, RedisHashToObj(map[string]string{"ID": "7"}, &obj))
		assert.Equal(t, 7, obj.ID)
	})
}
