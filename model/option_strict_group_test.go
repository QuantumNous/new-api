package model

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateOptionValueRejectsUnknownStrictIsolationGroups(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"team-a":1}`))
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})

	require.NoError(t, validateOptionValue("StrictGroupIsolationGroups", `[" team-a ","team-a",""]`))

	err := validateOptionValue("StrictGroupIsolationGroups", `["unknown-b","team-a","unknown-a","unknown-b"]`)
	require.Error(t, err)
	assert.Equal(t, "strict isolation groups are not configured in GroupRatio: unknown-a, unknown-b", err.Error())
}
