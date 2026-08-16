package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ReplaceMultiKeyKeys preserves per-key health state for credentials that
// remain present after an append or replacement operation.
func (channel *Channel) ReplaceMultiKeyKeys(keys string) {
	if channel == nil {
		return
	}
	previous := *channel
	parsed := (&Channel{Key: keys}).GetKeys()
	cleanKeys := make([]string, 0, len(parsed))
	for _, key := range parsed {
		if IsUsableChannelKey(key) {
			cleanKeys = append(cleanKeys, strings.TrimSpace(key))
		}
	}
	channel.Key = strings.Join(cleanKeys, "\n")
	channel.Keys = nil
	remapMultiKeyStateByKey(channel, &previous)
}

// UpdateChannelAtomically applies an update intent to the latest persisted
// channel state and rebuilds its abilities in the same transaction.
func UpdateChannelAtomically(channelID int, apply func(*Channel) error) (*Channel, error) {
	if channelID <= 0 || apply == nil {
		return nil, fmt.Errorf("invalid channel update")
	}

	channel := &Channel{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		// SQLite has no SELECT FOR UPDATE. Acquire its single writer lock before
		// reading so a competing writer cannot commit between the read and write.
		if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
			if err := tx.Model(&Channel{}).
				Where("id = ?", channelID).
				UpdateColumn("status", gorm.Expr("status")).Error; err != nil {
				return err
			}
		}
		if err := lockForUpdate(tx).Where("id = ?", channelID).First(channel).Error; err != nil {
			return err
		}

		channel.Keys = nil
		if err := apply(channel); err != nil {
			return err
		}
		channel.Id = channelID
		channel.Keys = nil
		channel.normalizeMultiKeyAvailability()

		if err := tx.Model(&Channel{}).
			Where("id = ?", channelID).
			Select("*").
			Omit("id").
			Updates(channel).Error; err != nil {
			return err
		}
		return channel.UpdateAbilities(tx)
	})
	if err != nil {
		return nil, err
	}
	return channel, nil
}
