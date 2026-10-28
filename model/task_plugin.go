package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TaskPluginChannelRef struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
}

func GetTaskPluginUsage(key string) ([]TaskPluginChannelRef, int64, error) {
	var channels []Channel
	if err := DB.Where("type = ? AND status = ?", constant.ChannelTypeTaskPlugin, common.ChannelStatusEnabled).Find(&channels).Error; err != nil {
		return nil, 0, err
	}
	refs := make([]TaskPluginChannelRef, 0)
	for _, channel := range channels {
		if channel.GetSetting().TaskPluginKey == key {
			refs = append(refs, TaskPluginChannelRef{Id: channel.Id, Name: channel.Name})
		}
	}
	var inFlight int64
	err := DB.Model(&Task{}).Where("platform = ? AND status NOT IN ?", key, []TaskStatus{TaskStatusSuccess, TaskStatusFailure}).Count(&inFlight).Error
	return refs, inFlight, err
}

type TaskPlugin struct {
	Id         int64  `json:"id"`
	Key        string `json:"key" gorm:"size:128;not null;uniqueIndex:uk_task_plugin_key_version,priority:1"`
	APIVersion int    `json:"api_version" gorm:"not null"`
	Version    string `json:"version" gorm:"size:64;not null;uniqueIndex:uk_task_plugin_key_version,priority:2"`
	Source     string `json:"source" gorm:"type:text;not null"`
	SourceHash string `json:"source_hash" gorm:"size:64;not null"`
	Enabled    bool   `json:"enabled" gorm:"not null"`
	Active     bool   `json:"active" gorm:"not null;index"`
	CreatedAt  int64  `json:"created_at" gorm:"not null"`
	Remark     string `json:"remark" gorm:"type:text"`
}

func SaveTaskPlugin(plugin *TaskPlugin) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var existing TaskPlugin
		err := tx.Where(&TaskPlugin{Key: plugin.Key, Version: plugin.Version}).First(&existing).Error
		if err == nil {
			if existing.SourceHash != plugin.SourceHash {
				return errors.New("plugin key and version already exist with different source")
			}
			if err = tx.Model(&existing).Updates(map[string]any{"enabled": plugin.Enabled, "remark": plugin.Remark}).Error; err != nil {
				return err
			}
			existing.Enabled = plugin.Enabled
			existing.Remark = plugin.Remark
			*plugin = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		plugin.CreatedAt = time.Now().Unix()
		var count int64
		if err = tx.Model(&TaskPlugin{}).Where(&TaskPlugin{Key: plugin.Key, Active: true}).Count(&count).Error; err != nil {
			return err
		}
		plugin.Active = count == 0
		return tx.Create(plugin).Error
	})
}

func ListTaskPluginVersions(key string) ([]TaskPlugin, error) {
	var plugins []TaskPlugin
	err := DB.Where(&TaskPlugin{Key: key}).Order("created_at DESC, id DESC").Find(&plugins).Error
	return plugins, err
}

func ListTaskPlugins() ([]TaskPlugin, error) {
	var plugins []TaskPlugin
	err := DB.
		Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "created_at"}, Desc: true}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "id"}, Desc: true}).
		Find(&plugins).Error
	return plugins, err
}

func GetTaskPluginVersion(key, version string) (*TaskPlugin, error) {
	var plugin TaskPlugin
	query := DB.Where(&TaskPlugin{Key: key})
	if version == "" {
		query = query.Where(&TaskPlugin{Active: true})
	} else {
		query = query.Where(&TaskPlugin{Version: version})
	}
	if err := query.First(&plugin).Error; err != nil {
		return nil, err
	}
	return &plugin, nil
}

func ListActiveTaskPlugins() ([]TaskPlugin, error) {
	snapshot, err := GetTaskPluginSyncSnapshot()
	return snapshot.Plugins, err
}

type TaskPluginSyncSnapshot struct {
	Plugins  []TaskPlugin
	Revision string
}

// GetTaskPluginSyncSnapshot returns the enabled override set together with a
// deterministic revision of every active database override. Nodes can compare
// the revision even though their local routing-generation counters differ.
func GetTaskPluginSyncSnapshot() (TaskPluginSyncSnapshot, error) {
	var activePlugins []TaskPlugin
	if err := DB.Where(&TaskPlugin{Active: true}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "key"}}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "version"}}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "id"}}).
		Find(&activePlugins).Error; err != nil {
		return TaskPluginSyncSnapshot{}, err
	}

	type revisionEntry struct {
		Key        string `json:"key"`
		APIVersion int    `json:"api_version"`
		Version    string `json:"version"`
		SourceHash string `json:"source_hash"`
		Enabled    bool   `json:"enabled"`
	}
	entries := make([]revisionEntry, 0, len(activePlugins))
	enabledPlugins := make([]TaskPlugin, 0, len(activePlugins))
	for _, plugin := range activePlugins {
		entries = append(entries, revisionEntry{
			Key:        plugin.Key,
			APIVersion: plugin.APIVersion,
			Version:    plugin.Version,
			SourceHash: plugin.SourceHash,
			Enabled:    plugin.Enabled,
		})
		if plugin.Enabled {
			enabledPlugins = append(enabledPlugins, plugin)
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Key != entries[j].Key {
			return entries[i].Key < entries[j].Key
		}
		return entries[i].Version < entries[j].Version
	})
	payload, err := common.Marshal(entries)
	if err != nil {
		return TaskPluginSyncSnapshot{}, err
	}
	digest := sha256.Sum256(payload)
	return TaskPluginSyncSnapshot{
		Plugins:  enabledPlugins,
		Revision: hex.EncodeToString(digest[:]),
	}, nil
}

func ActivateTaskPlugin(key, version string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var target TaskPlugin
		if err := tx.Where(&TaskPlugin{Key: key, Version: version}).First(&target).Error; err != nil {
			return err
		}
		if err := tx.Model(&TaskPlugin{}).Where(&TaskPlugin{Key: key}).Update("active", false).Error; err != nil {
			return err
		}
		return tx.Model(&target).Updates(map[string]any{"active": true, "enabled": true}).Error
	})
}

func SetTaskPluginEnabled(key string, enabled bool) error {
	result := DB.Model(&TaskPlugin{}).Where(&TaskPlugin{Key: key, Active: true}).Update("enabled", enabled)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

type TaskPluginDeleteResult struct {
	DeletedActive bool
	Promoted      *TaskPlugin
}

func DeleteTaskPluginVersion(key, version string) (TaskPluginDeleteResult, error) {
	result := TaskPluginDeleteResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var plugin TaskPlugin
		if err := lockForUpdate(tx).Where(&TaskPlugin{Key: key, Version: version}).First(&plugin).Error; err != nil {
			return err
		}
		result.DeletedActive = plugin.Active
		if err := tx.Delete(&plugin).Error; err != nil {
			return err
		}
		if !plugin.Active {
			return nil
		}

		var promoted TaskPlugin
		err := lockForUpdate(tx).
			Where(&TaskPlugin{Key: key}).
			Order("created_at DESC, id DESC").
			First(&promoted).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if err = tx.Model(&promoted).Update("active", true).Error; err != nil {
			return err
		}
		promoted.Active = true
		result.Promoted = &promoted
		return nil
	})
	return result, err
}
