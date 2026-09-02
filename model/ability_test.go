package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAddAbilitiesAppliesModelPrefix(t *testing.T) {
	originalDB := DB
	t.Cleanup(func() { DB = originalDB })
	var err error
	DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, DB.AutoMigrate(&Ability{}, &Channel{}))

	channel := &Channel{
		Id:            1,
		Models:        "auto-beta,fusion",
		Group:         "default",
		Status:        common.ChannelStatusEnabled,
		OtherSettings: `{"model_prefix":"openrouter"}`,
	}
	require.NoError(t, channel.AddAbilities(nil))

	var abilities []Ability
	require.NoError(t, DB.Find(&abilities).Error)
	require.Len(t, abilities, 2)
	models := lo.Map(abilities, func(a Ability, _ int) string { return a.Model })
	require.ElementsMatch(t, []string{"openrouter/auto-beta", "openrouter/fusion"}, models)
}
