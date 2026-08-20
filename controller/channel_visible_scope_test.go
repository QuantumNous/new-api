package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newChannelScopeDB(t *testing.T) *gorm.DB {
	t.Helper()
	initModelListColumnNames(t)
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	require.NoError(t, db.Create(&model.Channel{Id: 1, Name: "a", Group: "default", Status: 1}).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 2, Name: "b", Group: "vip", Status: 1}).Error)
	require.NoError(t, db.Create(&model.Channel{Id: 3, Name: "c", Group: "svip", Status: 1}).Error)
	t.Cleanup(func() { require.NoError(t, db.Exec("DROP TABLE channels").Error) })
	return db
}

func countScoped(t *testing.T, q *gorm.DB, ok bool) int64 {
	t.Helper()
	if !ok {
		return 0
	}
	var n int64
	require.NoError(t, q.Count(&n).Error)
	return n
}

func TestScopedChannelGroupQueryRootSeesAll(t *testing.T) {
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleRootUser, "default", "")
	assert.Equal(t, int64(3), countScoped(t, q, ok))
}

func TestScopedChannelGroupQueryRestrictedSeesOnlyVisible(t *testing.T) {
	configureVisibleGroupsForChannelTest(t) // 可见 {default, vip}
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "")
	assert.Equal(t, int64(2), countScoped(t, q, ok))
}

func TestScopedChannelGroupQueryRejectsOutOfScopeRequestedGroup(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	db := newChannelScopeDB(t)
	_, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "svip")
	assert.False(t, ok)
}

func TestScopedChannelGroupQueryRestrictedHonorsInScopeRequestedGroup(t *testing.T) {
	configureVisibleGroupsForChannelTest(t)
	db := newChannelScopeDB(t)
	q, ok := scopedChannelGroupQuery(db.Model(&model.Channel{}), common.RoleAdminUser, "default", "vip")
	assert.Equal(t, int64(1), countScoped(t, q, ok))
}

func configureVisibleGroupsForChannelTest(t *testing.T) {
	t.Helper()
	original := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(original))
	})
}
