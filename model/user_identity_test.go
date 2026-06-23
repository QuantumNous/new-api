package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUserToBaseUserDerivesEnterpriseFromGroup(t *testing.T) {
	plg := (&User{Id: 1, Username: "plg", Group: common.PLGGroup, Role: common.RoleCommonUser}).ToBaseUser()
	require.Equal(t, common.PLGGroup, plg.Group)
	require.False(t, plg.IsEnterprise)

	legacyDefault := (&User{Id: 2, Username: "default", Group: common.LegacyDefaultGroup, Role: common.RoleCommonUser}).ToBaseUser()
	require.Equal(t, common.PLGGroup, legacyDefault.Group)
	require.False(t, legacyDefault.IsEnterprise)

	vip := (&User{Id: 3, Username: "vip", Group: "vip", Role: common.RoleCommonUser}).ToBaseUser()
	require.Equal(t, "vip", vip.Group)
	require.True(t, vip.IsEnterprise)

	admin := (&User{Id: 4, Username: "admin", Group: common.PLGGroup, Role: common.RoleAdminUser}).ToBaseUser()
	require.True(t, admin.IsEnterprise)
}

func TestBackfillEnterpriseFlagMigratesDefaultIdentityToPLG(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key = ?", "PlgDefaultGroupMigrated").Delete(&Option{}).Error)

	defaultUser := &User{Username: "legacy_default", Group: common.LegacyDefaultGroup, AffCode: "id01"}
	emptyUser := &User{Username: "legacy_empty", Group: common.PLGGroup, AffCode: "id02"}
	vipUser := &User{Username: "enterprise_vip", Group: "vip", IsEnterprise: true, AffCode: "id03"}
	require.NoError(t, DB.Create(defaultUser).Error)
	require.NoError(t, DB.Create(emptyUser).Error)
	require.NoError(t, DB.Model(emptyUser).Update("group", "").Error)
	require.NoError(t, DB.Create(vipUser).Error)
	require.NoError(t, DB.Create(&Option{Key: "TopupGroupRatio", Value: `{"default":0.9,"vip":1}`}).Error)
	require.NoError(t, DB.Create(&Option{Key: "GroupRatio", Value: `{"default":0.8,"plg":0.9,"standard":1}`}).Error)
	require.NoError(t, DB.Create(&Option{Key: "group_ratio_setting.group_ratio", Value: `{"default":0.7}`}).Error)
	require.NoError(t, DB.Create(&Option{Key: "GroupGroupRatio", Value: `{"default":{"economy":0.6},"plg":{"standard":0.8}}`}).Error)
	require.NoError(t, DB.Create(&Option{Key: "group_ratio_setting.group_group_ratio", Value: `{"default":{"economy":0.6}}`}).Error)
	require.NoError(t, DB.Create(&Option{Key: "group_ratio_setting.group_special_usable_group", Value: `{"default":{"economy":"Economy"}}`}).Error)

	require.NoError(t, backfillEnterpriseFlag())
	require.NoError(t, backfillEnterpriseFlag())

	var gotDefault User
	require.NoError(t, DB.Where("username = ?", "legacy_default").First(&gotDefault).Error)
	require.Equal(t, common.PLGGroup, gotDefault.Group)
	require.False(t, gotDefault.IsEnterprise)

	var gotEmpty User
	require.NoError(t, DB.Where("username = ?", "legacy_empty").First(&gotEmpty).Error)
	require.Equal(t, common.PLGGroup, gotEmpty.Group)
	require.False(t, gotEmpty.IsEnterprise)

	var gotVIP User
	require.NoError(t, DB.Where("username = ?", "enterprise_vip").First(&gotVIP).Error)
	require.Equal(t, "vip", gotVIP.Group)
	require.True(t, gotVIP.IsEnterprise)

	var markerCount int64
	require.NoError(t, DB.Model(&Option{}).Where("key = ?", "PlgDefaultGroupMigrated").Count(&markerCount).Error)
	require.EqualValues(t, 1, markerCount)

	assertOptionJSON(t, "TopupGroupRatio", `{"plg":0.9,"vip":1}`)
	assertOptionJSON(t, "GroupRatio", `{"plg":0.9,"standard":1}`)
	assertOptionJSON(t, "group_ratio_setting.group_ratio", `{"plg":0.7}`)
	assertOptionJSON(t, "GroupGroupRatio", `{"plg":{"economy":0.6,"standard":0.8}}`)
	assertOptionJSON(t, "group_ratio_setting.group_group_ratio", `{"plg":{"economy":0.6}}`)
	assertOptionJSON(t, "group_ratio_setting.group_special_usable_group", `{"plg":{"economy":"Economy"}}`)
}

func assertOptionJSON(t *testing.T, key string, want string) {
	t.Helper()

	var option Option
	require.NoError(t, DB.Where("key = ?", key).First(&option).Error)
	require.JSONEq(t, want, option.Value)
}

func TestUserEditNormalizesIdentityAndDerivesEnterprise(t *testing.T) {
	truncateTables(t)

	user := &User{
		Username:     "identity_edit",
		DisplayName:  "Identity Edit",
		Group:        "vip",
		Role:         common.RoleCommonUser,
		IsEnterprise: true,
		AffCode:      "id04",
		Email:        "identity-edit@example.com",
		Status:       common.UserStatusEnabled,
		Quota:        42,
	}
	require.NoError(t, DB.Create(user).Error)

	user.Group = common.LegacyDefaultGroup
	require.NoError(t, user.Edit(false))

	var got User
	require.NoError(t, DB.Where("username = ?", "identity_edit").First(&got).Error)
	require.Equal(t, common.PLGGroup, got.Group)
	require.False(t, got.IsEnterprise)
	require.Equal(t, 42, got.Quota)
	require.Equal(t, common.UserStatusEnabled, got.Status)
	require.Equal(t, "identity-edit@example.com", got.Email)
}
