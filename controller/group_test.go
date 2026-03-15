package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func TestGetGroupsReturnsSortedGroupNames(t *testing.T) {
	originalGroupRatioJSON := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatioJSON))
	})

	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{
		"vip": 1,
		"group-z": 1,
		"default": 1,
		"group-b": 1,
		"group-y": 1,
		"group-a": 1,
		"svip": 1
	}`))

	expected := []string{
		"default",
		"group-a",
		"group-b",
		"group-y",
		"group-z",
		"svip",
		"vip",
	}

	for range 20 {
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/group", nil, 1)

		GetGroups(ctx)

		response := decodeAPIResponse(t, recorder)
		require.True(t, response.Success)

		var groups []string
		require.NoError(t, common.Unmarshal(response.Data, &groups))
		require.Equal(t, expected, groups)
	}
}
