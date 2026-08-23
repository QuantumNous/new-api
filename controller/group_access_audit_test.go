package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetUserGroupAccessAuditReportsStrictEffectiveAccess(t *testing.T) {
	db := setupTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Channel{}, &model.Ability{}))
	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["team-a"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"team-a":"Team A","team-b":"Team B"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	user := &model.User{Id: 901, Username: "audit-user", Password: "password", Group: "team-a", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(user).Error)
	allowIPs := "192.0.2.0/24"
	require.NoError(t, db.Create(&model.Token{
		UserId: user.Id, Key: "audit-safe", Name: "safe", Status: common.TokenStatusEnabled,
		ExpiredTime: -1, UnlimitedQuota: true, Group: "team-a", ModelLimitsEnabled: true,
		ModelLimits: "gpt-test", AllowIps: &allowIPs,
	}).Error)
	require.NoError(t, db.Create(&model.Token{
		UserId: user.Id, Key: "audit-unsafe", Name: "unsafe", Status: common.TokenStatusEnabled,
		ExpiredTime: -1, UnlimitedQuota: true, Group: "team-b", CrossGroupRetry: true,
	}).Error)

	priority := int64(0)
	weight := uint(100)
	for _, fixture := range []struct {
		id    int
		name  string
		group string
	}{
		{id: 9101, name: "channel-a", group: "team-a"},
		{id: 9102, name: "channel-b", group: "team-b"},
	} {
		require.NoError(t, db.Create(&model.Channel{
			Id: fixture.id, Type: constant.ChannelTypeOpenAI, Key: "channel-key", Status: common.ChannelStatusEnabled,
			Name: fixture.name, Weight: &weight, Models: "gpt-test", Group: fixture.group, Priority: &priority,
		}).Error)
		require.NoError(t, db.Create(&model.Ability{
			Group: fixture.group, Model: "gpt-test", ChannelId: fixture.id, Enabled: true, Priority: &priority, Weight: weight,
		}).Error)
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/user/901/group-access-audit", nil)
	ctx.Params = append(ctx.Params, gin.Param{Key: "id", Value: "901"})
	GetUserGroupAccessAudit(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	var data struct {
		StrictIsolation bool                       `json:"strict_isolation"`
		UsableGroups    []string                   `json:"usable_groups"`
		Tokens          []tokenGroupAccessAudit    `json:"tokens"`
		ChannelAccess   []model.GroupAccessAbility `json:"channel_access"`
	}
	require.NoError(t, common.Unmarshal(response.Data, &data))
	assert.True(t, data.StrictIsolation)
	assert.Equal(t, []string{"team-a"}, data.UsableGroups)
	require.Len(t, data.Tokens, 2)
	assert.True(t, data.Tokens[0].ConfigurationSafe)
	assert.True(t, data.Tokens[0].AccessReady)
	assert.True(t, data.Tokens[0].IPRestricted)
	assert.Equal(t, []string{"gpt-test"}, data.Tokens[0].ModelLimits)
	assert.Equal(t, []string{"gpt-test"}, data.Tokens[0].EffectiveModels)
	assert.Empty(t, data.Tokens[0].BlockingReasons)
	assert.False(t, data.Tokens[1].ConfigurationSafe)
	assert.False(t, data.Tokens[1].AccessReady)
	assert.ElementsMatch(t, []string{"unsafe_group_configuration", "no_enabled_model"}, data.Tokens[1].BlockingReasons)
	require.Len(t, data.ChannelAccess, 1)
	assert.Equal(t, "team-a", data.ChannelAccess[0].Group)
	assert.Equal(t, "channel-a", data.ChannelAccess[0].ChannelName)
}
