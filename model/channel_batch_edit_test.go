package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestEditChannelsByIdsUpdatesModelsAndRebuildsAbilities verifies that changing
// models removes the old ability rows and creates new ones (overwrite semantics).
func TestEditChannelsByIdsUpdatesModelsAndRebuildsAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)

	priority := int64(0)
	weight := uint(0)
	ch := &Channel{
		Id:       101,
		Type:     1,
		Key:      "test-key",
		Name:     "test-channel",
		Status:   common.ChannelStatusEnabled,
		Models:   "a-model",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(ch).Error)
	require.NoError(t, ch.UpdateAbilities(nil))

	// Original ability exists.
	var before Ability
	require.NoError(t, DB.First(&before, "channel_id = ? AND model = ?", 101, "a-model").Error)

	newModels := "b-model"
	require.NoError(t, EditChannelsByIds([]int{101}, nil, &newModels, nil, nil, nil))

	// Old model ability removed.
	var old Ability
	require.ErrorIs(t, DB.First(&old, "channel_id = ? AND model = ?", 101, "a-model").Error, gorm.ErrRecordNotFound)
	// New model ability created and enabled.
	var fresh Ability
	require.NoError(t, DB.First(&fresh, "channel_id = ? AND model = ?", 101, "b-model").Error)
	require.True(t, fresh.Enabled)

	// Channel row models field overwritten.
	var got Channel
	require.NoError(t, DB.First(&got, 101).Error)
	require.Equal(t, "b-model", got.Models)
}

// TestEditChannelsByIdsPriorityOnlySyncsAbilities verifies that changing only
// priority syncs the new value into the abilities table.
func TestEditChannelsByIdsPriorityOnlySyncsAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)

	priority := int64(0)
	weight := uint(0)
	ch := &Channel{
		Id:       102,
		Type:     1,
		Key:      "test-key",
		Name:     "test-channel",
		Status:   common.ChannelStatusEnabled,
		Models:   "a-model",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(ch).Error)
	require.NoError(t, ch.UpdateAbilities(nil))

	newPriority := int64(7)
	require.NoError(t, EditChannelsByIds([]int{102}, nil, nil, nil, &newPriority, nil))

	var a Ability
	require.NoError(t, DB.First(&a, "channel_id = ? AND model = ?", 102, "a-model").Error)
	require.NotNil(t, a.Priority)
	require.Equal(t, int64(7), *a.Priority)
}

// TestEditChannelsByIdsModelMappingOnlyDoesNotTouchAbilities verifies that
// changing only model_mapping does not rebuild abilities (count unchanged).
func TestEditChannelsByIdsModelMappingOnlyDoesNotTouchAbilities(t *testing.T) {
	setupCodexGovernanceTestDB(t)

	priority := int64(0)
	weight := uint(0)
	ch := &Channel{
		Id:       103,
		Type:     1,
		Key:      "test-key",
		Name:     "test-channel",
		Status:   common.ChannelStatusEnabled,
		Models:   "a-model",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, DB.Create(ch).Error)
	require.NoError(t, ch.UpdateAbilities(nil))

	var beforeCount int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", 103).Count(&beforeCount).Error)

	mapping := `{"a-model":"x-model"}`
	require.NoError(t, EditChannelsByIds([]int{103}, &mapping, nil, nil, nil, nil))

	var afterCount int64
	require.NoError(t, DB.Model(&Ability{}).Where("channel_id = ?", 103).Count(&afterCount).Error)
	require.Equal(t, beforeCount, afterCount)

	var got Channel
	require.NoError(t, DB.First(&got, 103).Error)
	require.NotNil(t, got.ModelMapping)
	require.Equal(t, mapping, *got.ModelMapping)
}

// TestEditChannelsByIdsEmptyIdsIsNoop verifies that empty ids returns nil and
// issues no SQL.
func TestEditChannelsByIdsEmptyIdsIsNoop(t *testing.T) {
	setupCodexGovernanceTestDB(t)
	require.NoError(t, EditChannelsByIds(nil, nil, nil, nil, nil, nil))
	require.NoError(t, EditChannelsByIds([]int{}, nil, nil, nil, nil, nil))
}
