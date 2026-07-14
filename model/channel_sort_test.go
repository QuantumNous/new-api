package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAllChannelsUsesIDAsStablePageTiebreaker(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	priority10 := int64(10)
	priority5 := int64(5)
	require.NoError(t, DB.Create([]*Channel{
		{Id: 11, Name: "beta", Priority: &priority10},
		{Id: 20, Name: "beta", Priority: &priority5},
		{Id: 12, Name: "alpha", Priority: &priority10},
		{Id: 15, Name: "alpha", Priority: &priority10},
	}).Error)

	firstPage, err := GetAllChannels(0, 2, false, false)
	require.NoError(t, err)
	require.Len(t, firstPage, 2)
	assert.Equal(t, []int{15, 12}, []int{firstPage[0].Id, firstPage[1].Id})

	secondPage, err := GetAllChannels(2, 2, false, false)
	require.NoError(t, err)
	require.Len(t, secondPage, 2)
	assert.Equal(t, []int{11, 20}, []int{secondPage[0].Id, secondPage[1].Id})

	byName, err := GetAllChannels(0, 4, false, false, NewChannelSortOptions("name", "asc", false))
	require.NoError(t, err)
	require.Len(t, byName, 4)
	assert.Equal(t, []int{15, 12, 20, 11}, []int{byName[0].Id, byName[1].Id, byName[2].Id, byName[3].Id})
}

func TestSearchTagsReturnsStableAlphabeticalOrder(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	zeta := "zeta"
	alpha := "alpha"
	beta := "beta"
	priority30 := int64(30)
	priority20 := int64(20)
	priority10 := int64(10)
	require.NoError(t, DB.Create([]*Channel{
		{Id: 31, Name: "channel-zeta", Priority: &priority30, Tag: &zeta},
		{Id: 32, Name: "channel-alpha", Priority: &priority20, Tag: &alpha},
		{Id: 33, Name: "channel-beta", Priority: &priority10, Tag: &beta},
	}).Error)

	tags, err := SearchTags("", "", "", false)
	require.NoError(t, err)
	require.Len(t, tags, 3)
	assert.Equal(t, []string{"alpha", "beta", "zeta"}, []string{*tags[0], *tags[1], *tags[2]})
}
