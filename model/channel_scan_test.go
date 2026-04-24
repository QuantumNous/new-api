package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelInfoScanHandlesSQLiteString(t *testing.T) {
	var info ChannelInfo
	require.NoError(t, info.Scan(`{}`))
	require.False(t, info.IsMultiKey)
}

func TestChannelInfoScanHandlesNilAndEmpty(t *testing.T) {
	cases := []interface{}{nil, "", []byte{}}
	for _, input := range cases {
		var info ChannelInfo
		require.NoError(t, info.Scan(input))
		require.Equal(t, ChannelInfo{}, info)
	}
}

func TestChannelRoundTripWithChannelInfoOnSQLite(t *testing.T) {
	truncateTables(t)

	channel := &Channel{
		Type:   57,
		Key:    `{"access_token":"test","account_id":"acct"}`,
		Status: 1,
		Name:   "sqlite-scan",
		Models: "gpt-5",
		Group:  "default",
	}
	require.NoError(t, DB.Create(channel).Error)

	var loaded Channel
	require.NoError(t, DB.First(&loaded, channel.Id).Error)
	require.Equal(t, channel.Id, loaded.Id)
	require.Equal(t, ChannelInfo{}, loaded.ChannelInfo)
}
