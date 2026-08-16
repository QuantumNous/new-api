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
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const ChannelImportSourceClipboard = "clipboard"

// ensureChannelImportIDUniqueIndex enforces uniqueness of channels.import_id
// through a separately created index. GORM folds a single-column unique index
// into an inline UNIQUE column constraint, which SQLite rejects when altering
// an existing table, so the tag must stay index-free and the index is created
// here instead.
func ensureChannelImportIDUniqueIndex(db *gorm.DB) error {
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		// MySQL has no IF NOT EXISTS for CREATE INDEX.
		var count int64
		if err := db.Raw(
			"SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'channels' AND index_name = 'idx_channels_import_id'",
		).Scan(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return nil
		}
	}
	return db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_import_id ON channels (import_id)").Error
}

func GetChannelByImportID(importID string) (*Channel, error) {
	if strings.TrimSpace(importID) == "" {
		return nil, gorm.ErrRecordNotFound
	}

	var channel Channel
	err := DB.Where("import_id = ?", importID).First(&channel).Error
	if err != nil {
		return nil, err
	}
	return &channel, nil
}

// DisableExpiredChannels changes only currently enabled channels. Keeping the
// status transition in UpdateChannelStatus preserves multi-key state,
// abilities, cache invalidation, and the normal status audit metadata.
func DisableExpiredChannels(now int64) (int, error) {
	if now <= 0 {
		return 0, errors.New("current timestamp is required")
	}

	var channelIDs []int
	if err := DB.Model(&Channel{}).
		Where("expires_at > ? AND expires_at <= ? AND status = ?", 0, now, common.ChannelStatusEnabled).
		Pluck("id", &channelIDs).Error; err != nil {
		return 0, err
	}

	disabled := 0
	for _, channelID := range channelIDs {
		if UpdateChannelStatus(channelID, "", common.ChannelStatusAutoDisabled, "clipboard import expired") {
			disabled++
		}
	}
	return disabled, nil
}
