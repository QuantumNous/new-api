package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestGetChannelReportsNoChannelAfterLastAbilityDisabled reproduces what a client
// sees when auto-ban disables the last channel serving a model in its group while
// a request is still retrying: the retry re-queries the group, finds nothing, and
// must report "no available channel" rather than a database consistency failure.
func TestGetChannelReportsNoChannelAfterLastAbilityDisabled(t *testing.T) {
	prevMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = prevMemoryCache })

	require.NoError(t, DB.AutoMigrate(&Channel{}, &Ability{}))
	require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
	require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DELETE FROM abilities").Error)
		require.NoError(t, DB.Exec("DELETE FROM channels").Error)
	})

	priority := int64(100)
	require.NoError(t, DB.Create(&Channel{
		Id:       1,
		Status:   common.ChannelStatusEnabled,
		Name:     "only-channel",
		Group:    "chat",
		Models:   "gpt-test",
		Priority: &priority,
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "chat",
		Model:     "gpt-test",
		ChannelId: 1,
		Enabled:   true,
		Priority:  &priority,
	}).Error)

	channel, err := GetChannel("chat", "gpt-test", 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel, "the first attempt must find the only channel")

	// The channel fails and auto-ban disables it, exactly as UpdateAbilityStatus
	// does when a relay error trips the disable threshold.
	require.NoError(t, UpdateAbilityStatus(1, false))

	// The in-flight request now retries against a group that has become empty.
	channel, err = GetChannel("chat", "gpt-test", 1, "")
	assert.NoError(t, err, "an emptied group is an ordinary no-channel result, not a database consistency failure")
	assert.Nil(t, channel)
}
