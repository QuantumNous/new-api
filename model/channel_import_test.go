/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestDisableExpiredChannelsDisablesOnlyDueEnabledChannels(t *testing.T) {
	setupChannelStatusTest(t)
	now := int64(10_000)

	due := Channel{
		Name:      "due clipboard channel",
		Key:       "sk-due",
		Status:    common.ChannelStatusEnabled,
		ExpiresAt: now,
		Models:    "gpt-test",
		Group:     "default",
	}
	future := Channel{
		Name:      "future clipboard channel",
		Key:       "sk-future",
		Status:    common.ChannelStatusEnabled,
		ExpiresAt: now + 60,
	}
	permanent := Channel{
		Name:   "permanent channel",
		Key:    "sk-permanent",
		Status: common.ChannelStatusEnabled,
	}
	alreadyDisabled := Channel{
		Name:      "already disabled",
		Key:       "sk-disabled",
		Status:    common.ChannelStatusManuallyDisabled,
		ExpiresAt: now - 1,
	}
	for _, channel := range []*Channel{&due, &future, &permanent, &alreadyDisabled} {
		require.NoError(t, DB.Create(channel).Error)
	}
	require.NoError(t, due.AddAbilities(nil))

	disabled, err := DisableExpiredChannels(now)

	require.NoError(t, err)
	assert.Equal(t, 1, disabled)

	var stored []Channel
	require.NoError(t, DB.Order("id").Find(&stored).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored[0].Status)
	assert.Equal(t, common.ChannelStatusEnabled, stored[1].Status)
	assert.Equal(t, common.ChannelStatusEnabled, stored[2].Status)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored[3].Status)

	var ability Ability
	require.NoError(t, DB.Where("channel_id = ?", due.Id).First(&ability).Error)
	assert.False(t, ability.Enabled)
	assert.Equal(t, "clipboard import expired", stored[0].GetOtherInfo()["status_reason"])
}

func TestGetChannelByImportIDDoesNotTreatBlankAsAnIdentifier(t *testing.T) {
	setupChannelStatusTest(t)

	_, err := GetChannelByImportID("  ")

	require.Error(t, err)
}

// legacyChannelRow mirrors the channels table before the clipboard-import
// columns existed, so migration tests can exercise real upgrade paths.
type legacyChannelRow struct {
	Id          int    `gorm:"primaryKey"`
	Type        int    `gorm:"default:0"`
	Key         string `gorm:"type:text"`
	Status      int    `gorm:"default:0"`
	Name        string `gorm:"type:varchar(255)"`
	Weight      uint   `gorm:"default:0"`
	CreatedTime int64  `gorm:"bigint;default:0"`
	TestModel   bool   `gorm:"default:false"`
	Open        bool   `gorm:"default:true"`
	OtherInfo   string `gorm:"type:text"`
	Models      string `gorm:"type:text"`
	Group       string `gorm:"type:varchar(64);default:'default'"`
}

func (legacyChannelRow) TableName() string { return "channels" }

// Regressions guard for upgrading an existing database: SQLite rejects
// ALTER TABLE ... ADD COLUMN with an inline UNIQUE constraint, so the import
// identifier must be unique through a separately created index instead.
func TestChannelAutoMigrateUpgradesLegacyTableWithUniqueImportID(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&legacyChannelRow{}))
	require.NoError(t, db.Exec(`INSERT INTO channels (name, "key") VALUES ('legacy', 'sk-legacy')`).Error)

	require.NoError(t, db.AutoMigrate(&Channel{}))
	require.NoError(t, ensureChannelImportIDUniqueIndex(db))
	// Re-running the migration must stay idempotent.
	require.NoError(t, ensureChannelImportIDUniqueIndex(db))

	importID := "clipboard:legacy-upgrade"
	first := Channel{Name: "first", Key: "sk-first", ImportID: &importID}
	second := Channel{Name: "second", Key: "sk-second", ImportID: &importID}
	require.NoError(t, db.Create(&first).Error)
	require.Error(t, db.Create(&second).Error)

	var legacy Channel
	require.NoError(t, db.Where("name = ?", "legacy").First(&legacy).Error)
	assert.Zero(t, legacy.ExpiresAt)
}
