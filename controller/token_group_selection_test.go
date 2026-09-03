package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// configureTokenGroupSelectionTest sets the two independent gates a group must
// pass to be selectable, matching what TokenAuth enforces at relay time:
// presence in the user-usable allowlist, and a ratio entry in the pricing table.
func configureTokenGroupSelectionTest(t *testing.T, usableGroups string, groupRatios string) {
	t.Helper()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalRatios := ratio_setting.GroupRatio2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(usableGroups))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(groupRatios))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
}

func setupTokenGroupSelectionTest(t *testing.T, userGroup string) *model.User {
	t.Helper()
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	user := &model.User{
		Id:       202,
		Username: "token-group-user",
		Password: "password",
		Group:    userGroup,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, db.Create(user).Error)
	return user
}

func tokenGroupRequest(name string, group string) map[string]any {
	return map[string]any{
		"name":                 name,
		"expired_time":         -1,
		"remain_quota":         0,
		"unlimited_quota":      true,
		"model_limits_enabled": false,
		"model_limits":         "",
		"group":                group,
		"cross_group_retry":    false,
	}
}

func newTokenGroupSelectionContext(t *testing.T, method string, body any, userID int, userGroup string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	ctx, recorder := newAuthenticatedContext(t, method, "/api/token/", body, userID)
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, userGroup)
	return ctx, recorder
}

func TestAddTokenPinsOmittedGroupToCurrentUserGroup(t *testing.T) {
	configureTokenGroupSelectionTest(t, `{"default":"Default","vip":"VIP"}`, `{"default":1,"vip":1}`)
	user := setupTokenGroupSelectionTest(t, "vip")
	request := tokenGroupRequest("pinned-key", "")

	ctx, recorder := newTokenGroupSelectionContext(t, http.MethodPost, request, user.Id, user.Group)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var token model.Token
	require.NoError(t, model.DB.Where("name = ?", request["name"]).First(&token).Error)
	assert.Equal(t, "vip", token.Group)
}

func TestAddTokenFallsBackToDefaultWhenUserGroupHasNoRatio(t *testing.T) {
	configureTokenGroupSelectionTest(t, `{"default":"Default"}`, `{"default":1}`)
	user := setupTokenGroupSelectionTest(t, "retired")
	request := tokenGroupRequest("default-fallback-key", "")

	ctx, recorder := newTokenGroupSelectionContext(t, http.MethodPost, request, user.Id, user.Group)
	AddToken(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var token model.Token
	require.NoError(t, model.DB.Where("name = ?", request["name"]).First(&token).Error)
	assert.Equal(t, "default", token.Group)
}

func TestAddTokenRejectsOmittedGroupWhenNoSelectableGroupExists(t *testing.T) {
	configureTokenGroupSelectionTest(t, `{}`, `{"vip":1}`)
	user := setupTokenGroupSelectionTest(t, "retired")
	request := tokenGroupRequest("unresolved-key", "")

	ctx, recorder := newTokenGroupSelectionContext(t, http.MethodPost, request, user.Id, user.Group)
	AddToken(ctx)

	assert.False(t, decodeAPIResponse(t, recorder).Success)
	var count int64
	require.NoError(t, model.DB.Model(&model.Token{}).Where("name = ?", request["name"]).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAddTokenRejectsGroupTheUserCannotUse(t *testing.T) {
	tests := []struct {
		name         string
		usableGroups string
		groupRatios  string
		group        string
	}{
		{
			name:         "outside the usable allowlist",
			usableGroups: `{"default":"Default"}`,
			groupRatios:  `{"default":1,"vip":1}`,
			group:        "vip",
		},
		{
			name:         "allowed but missing from the pricing table",
			usableGroups: `{"default":"Default","vip":"VIP"}`,
			groupRatios:  `{"default":1}`,
			group:        "vip",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			configureTokenGroupSelectionTest(t, test.usableGroups, test.groupRatios)
			user := setupTokenGroupSelectionTest(t, "default")
			request := tokenGroupRequest("rejected-key", test.group)

			ctx, recorder := newTokenGroupSelectionContext(t, http.MethodPost, request, user.Id, user.Group)
			AddToken(ctx)

			assert.False(t, decodeAPIResponse(t, recorder).Success)
			var count int64
			require.NoError(t, model.DB.Model(&model.Token{}).Where("name = ?", request["name"]).Count(&count).Error)
			assert.Zero(t, count, "a rejected group must not create a key")
		})
	}
}

func TestUpdateTokenGroupChangeIsValidatedAndPinned(t *testing.T) {
	tests := []struct {
		name          string
		storedGroup   string
		requestGroup  string
		expectSuccess bool
		expectedGroup string
	}{
		{
			name:          "pins a newly chosen group",
			storedGroup:   "default",
			requestGroup:  "vip",
			expectSuccess: true,
			expectedGroup: "vip",
		},
		{
			name:          "normalizes a legacy empty key when it is saved",
			storedGroup:   "",
			requestGroup:  "",
			expectSuccess: true,
			expectedGroup: "vip",
		},
		{
			name:          "pins a group onto a legacy empty key",
			storedGroup:   "",
			requestGroup:  "vip",
			expectSuccess: true,
			expectedGroup: "vip",
		},
		{
			name:          "rejects a group the user cannot use",
			storedGroup:   "default",
			requestGroup:  "svip",
			expectSuccess: false,
			expectedGroup: "default",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			configureTokenGroupSelectionTest(t, `{"default":"Default","vip":"VIP"}`, `{"default":1,"vip":1}`)
			user := setupTokenGroupSelectionTest(t, "vip")
			token := seedToken(t, model.DB, user.Id, "editable-key", "editable-key-secret")
			token.Group = test.storedGroup
			require.NoError(t, model.DB.Save(token).Error)

			request := tokenGroupRequest("editable-key", test.requestGroup)
			request["id"] = token.Id
			request["status"] = common.TokenStatusEnabled

			ctx, recorder := newTokenGroupSelectionContext(t, http.MethodPut, request, user.Id, user.Group)
			UpdateToken(ctx)

			response := decodeAPIResponse(t, recorder)
			assert.Equal(t, test.expectSuccess, response.Success, response.Message)
			var updated model.Token
			require.NoError(t, model.DB.First(&updated, token.Id).Error)
			assert.Equal(t, test.expectedGroup, updated.Group)
		})
	}
}
