package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGroupDisplayNames(t *testing.T) {
	original := GroupDisplayNamesJSON()
	t.Cleanup(func() { require.NoError(t, UpdateGroupDisplayNames(original)) })
	require.NoError(t, UpdateGroupDisplayNames(`{"default":" 标准线路 ","vip":""}`))
	assert.Equal(t, map[string]string{"default": "标准线路"}, GetGroupDisplayNames())
	copy := GetGroupDisplayNames()
	copy["default"] = "modified"
	assert.Equal(t, "标准线路", GetGroupDisplayNames()["default"])
	for _, invalid := range []string{`null`, `[]`, `{"default":2}`, `{" ":"name"}`, `{" default":"name"}`} {
		require.Error(t, UpdateGroupDisplayNames(invalid))
		assert.Equal(t, "标准线路", GetGroupDisplayNames()["default"])
	}
	require.NoError(t, UpdateGroupDisplayNames(`{}`))
	assert.Empty(t, GetGroupDisplayNames())
}
