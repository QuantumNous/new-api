package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateAndGetGroupConcurrentLimit(t *testing.T) {
	err := UpdateModelConcurrentLimitGroupByJSONString(`{"default": 10, "vip": 0}`)
	require.NoError(t, err)

	limit, found := GetGroupConcurrentLimit("default")
	assert.True(t, found)
	assert.Equal(t, 10, limit)

	limit, found = GetGroupConcurrentLimit("vip")
	assert.True(t, found)
	assert.Equal(t, 0, limit)

	_, found = GetGroupConcurrentLimit("nonexistent")
	assert.False(t, found)
}

func TestCheckModelConcurrentLimitGroup(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		err := CheckModelConcurrentLimitGroup(`{"default": 5, "vip": 100}`)
		assert.NoError(t, err)
	})

	t.Run("negative rejected", func(t *testing.T) {
		err := CheckModelConcurrentLimitGroup(`{"bad": -1}`)
		assert.Error(t, err)
	})

	t.Run("over max rejected", func(t *testing.T) {
		err := CheckModelConcurrentLimitGroup(`{"bad": 2147483648}`)
		assert.Error(t, err)
	})

	t.Run("invalid json rejected", func(t *testing.T) {
		err := CheckModelConcurrentLimitGroup(`{invalid}`)
		assert.Error(t, err)
	})
}
