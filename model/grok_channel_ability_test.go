package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestGrokAbilityStaysDisabledUntilCredentialIsStored mirrors the Copilot
// symmetry: a Grok Subscription channel is created empty-key (pending OAuth),
// so its abilities must stay disabled until the credential is written back,
// then re-enable automatically. Without the empty-credential guard in
// buildAbilities, a pending Grok channel with Status=enabled would be routable
// and every request would fail on the missing credential.
func TestGrokAbilityStaysDisabledUntilCredentialIsStored(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })

	channel := Channel{
		Type:   constant.ChannelTypeGrokSubscription,
		Name:   "grok",
		Models: "grok-4.6",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, DB.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))

	// Pending (empty key): ability must be disabled even though Status=enabled.
	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.False(t, ability.Enabled)

	// Credential written back via OAuth complete -> ability re-enables.
	require.NoError(t, UpdateChannelKeyForType(channel.Id, constant.ChannelTypeGrokSubscription, "grok-credential-json"))
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.True(t, ability.Enabled)

	// A later rebuild carrying a blank in-memory key must read the stored key
	// from the DB and keep the ability enabled (no accidental re-disable).
	partialChannel := Channel{
		Id:     channel.Id,
		Type:   constant.ChannelTypeGrokSubscription,
		Models: channel.Models,
		Group:  channel.Group,
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, partialChannel.UpdateAbilities(nil))
	require.NoError(t, DB.Where("channel_id = ?", channel.Id).First(&ability).Error)
	require.True(t, ability.Enabled)

	var stored Channel
	require.NoError(t, DB.First(&stored, channel.Id).Error)
	require.Equal(t, "grok-credential-json", stored.Key)
}
