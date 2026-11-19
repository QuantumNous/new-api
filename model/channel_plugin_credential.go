package model

import (
	"errors"
	"slices"
	"sort"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ErrChannelKeyChanged reports a channel key that changed while a locked
// update waited, which only a write outside UpdateChannelLocked can do.
var ErrChannelKeyChanged = errors.New("channel key changed during the credential update")

// SQLite serves one node, so process locks stand in for its row locks.
var (
	sqliteChannelKeyLocks sync.Map // channel id -> *sync.Mutex
)

func sqliteChannelKeyLock(channelID int) *sync.Mutex {
	lock, _ := sqliteChannelKeyLocks.LoadOrStore(channelID, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

// UpdateChannelLocked lets update change a channel's key while no other node
// or goroutine can: MySQL and PostgreSQL hold the channel row lock across
// update, and SQLite holds a process lock. update must not wait on the
// network, because every request of a multi-key channel waits on this lock.
// Every write of a channel's key goes through here or through
// never writes it. So the key update reads is the stored one, never a copy a
// refresh has replaced since.
// update receives the stored channel and may change its Key, Status,
// OtherInfo and ChannelInfo; the changed ones are written together. The
// stored channel afterwards is returned, a new key is published to this
// node's channel cache, and a new status to the channel's abilities.
func UpdateChannelLocked(channelID int, update func(channel *Channel) error) (*Channel, error) {
	var channel Channel
	var keyChanged, statusChanged, written bool
	// changes runs update on channel and returns the columns it changed.
	changes := func() (map[string]any, error) {
		key, status, otherInfo := channel.Key, channel.Status, channel.OtherInfo
		info, err := common.Marshal(channel.ChannelInfo)
		if err != nil {
			return nil, err
		}
		if err := update(&channel); err != nil {
			return nil, err
		}
		channel.Keys = nil
		updates := map[string]any{}
		if channel.Key != key {
			updates["key"], keyChanged = channel.Key, true
		}
		if channel.Status != status {
			updates["status"], statusChanged = channel.Status, true
		}
		if channel.OtherInfo != otherInfo {
			updates["other_info"] = channel.OtherInfo
		}
		if next, err := common.Marshal(channel.ChannelInfo); err != nil {
			return nil, err
		} else if string(next) != string(info) {
			updates["channel_info"] = channel.ChannelInfo
		}
		return updates, nil
	}
	if common.UsingMainDatabase(common.DatabaseTypeSQLite) {
		lock := sqliteChannelKeyLock(channelID)
		lock.Lock()
		defer lock.Unlock()
		if err := DB.Where("id = ?", channelID).First(&channel).Error; err != nil {
			return nil, err
		}
		stored := channel.Key
		updates, err := changes()
		if err != nil {
			return nil, err
		}
		if len(updates) > 0 {
			result := DB.Model(&Channel{}).Where("id = ?", channelID).Where(map[string]any{"key": stored}).Updates(updates)
			if result.Error != nil {
				return nil, result.Error
			}
			if result.RowsAffected != 1 {
				return nil, ErrChannelKeyChanged
			}
			written = true
		}
	} else {
		err := DB.Transaction(func(tx *gorm.DB) error {
			if err := lockForUpdate(tx).Where("id = ?", channelID).First(&channel).Error; err != nil {
				return err
			}
			updates, err := changes()
			if err != nil || len(updates) == 0 {
				return err
			}
			written = true
			return tx.Model(&Channel{}).Where("id = ?", channelID).Updates(updates).Error
		})
		if err != nil {
			return nil, err
		}
	}
	if written {
		defer BumpSyncTopic(SyncTopicChannels)
	}
	if keyChanged {
		CacheUpdateChannelKey(channelID, channel.Key)
	}
	if statusChanged {
		if err := UpdateAbilityStatus(channelID, channel.Status == common.ChannelStatusEnabled); err != nil {
			return nil, err
		}
	}
	return &channel, nil
}

func CacheUpdateChannelKey(id int, key string) {
	if !common.MemoryCacheEnabled {
		return
	}
	channelSyncLock.Lock()
	defer channelSyncLock.Unlock()
	cached, ok := channelsIDM[id]
	if !ok {
		return
	}
	updated := *cached
	updated.Key = key
	updated.Keys = nil
	updated.Keys = updated.GetKeys()
	channelsIDM[id] = &updated
}

