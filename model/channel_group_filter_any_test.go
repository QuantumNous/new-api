package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newChannelFilterTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}))
	t.Cleanup(func() {
		require.NoError(t, db.Exec("DROP TABLE channels").Error)
	})
	return db
}

func seedChannel(t *testing.T, db *gorm.DB, id int, name, group string) {
	t.Helper()
	require.NoError(t, db.Create(&Channel{Id: id, Name: name, Group: group, Status: 1}).Error)
}

func channelIDs(channels []*Channel) []int {
	ids := make([]int, 0, len(channels))
	for _, ch := range channels {
		ids = append(ids, ch.Id)
	}
	return ids
}

func TestApplyChannelGroupFilterAnyMatchesAnyGroup(t *testing.T) {
	db := newChannelFilterTestDB(t)
	seedChannel(t, db, 1, "a", "default")
	seedChannel(t, db, 2, "b", "vip,svip")
	seedChannel(t, db, 3, "c", "svip")

	var got []*Channel
	err := ApplyChannelGroupFilterAny(db.Model(&Channel{}), []string{"default", "vip"}).Find(&got).Error
	require.NoError(t, err)
	assert.ElementsMatch(t, []int{1, 2}, channelIDs(got))
}

func TestApplyChannelGroupFilterAnyEmptyIsFailClosed(t *testing.T) {
	db := newChannelFilterTestDB(t)
	seedChannel(t, db, 1, "a", "default")

	var got []*Channel
	err := ApplyChannelGroupFilterAny(db.Model(&Channel{}), nil).Find(&got).Error
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestApplyChannelGroupFilterAnyNormalizesToEmptyIsFailClosed(t *testing.T) {
	db := newChannelFilterTestDB(t)
	seedChannel(t, db, 1, "a", "default")

	// Entries that all normalize to "" (whitespace / "all" / "null") must
	// fail-closed, never fall through to returning every channel.
	var got []*Channel
	err := ApplyChannelGroupFilterAny(db.Model(&Channel{}), []string{"  ", "all", "null"}).Find(&got).Error
	require.NoError(t, err)
	assert.Empty(t, got)
}
