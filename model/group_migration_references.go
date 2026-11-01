package model

import (
	"encoding/json"
	"slices"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// Cache publishers hold the read side from their authoritative group read to
// publication. Migration holds the write side while refreshing committed views.
var groupViewMutex sync.RWMutex

type groupMigrationWriterKey struct{}
type groupMigrationWriter struct{ operation, owner string }

// migrateGroupReferences replaces exact group names in durable references,
// including restorable soft deletes, ordered token fallbacks and subscription
// snapshots. The caller owns the migration transaction and write barrier.
func migrateGroupReferences(tx *gorm.DB, op *GroupMigrationOperation) error {
	for _, resource := range []struct {
		model   any
		columns []string
	}{
		{&SubscriptionPlan{}, []string{"upgrade_group", "downgrade_group"}},
		{&UserSubscription{}, []string{"upgrade_group", "downgrade_group", "prev_user_group"}},
	} {
		for _, column := range resource.columns {
			if err := tx.Model(resource.model).Where(column+" = ?", op.Source).UpdateColumn(column, op.Target).Error; err != nil {
				return err
			}
		}
	}
	for _, resource := range []any{&User{}, &Token{}, &Ability{}} {
		if err := tx.Unscoped().Model(resource).Where(commonGroupCol+" = ?", op.Source).Update("group", op.Target).Error; err != nil {
			return err
		}
	}
	var tokens []Token
	if err := tx.Unscoped().Select("id", "auto_groups").Where("auto_groups <> ?", "").Find(&tokens).Error; err != nil {
		return err
	}
	for _, token := range tokens {
		var groups []string
		if err := common.UnmarshalJsonStr(token.AutoGroups, &groups); err != nil {
			return err
		}
		changed := false
		for i, group := range groups {
			if group == op.Source {
				groups[i], changed = op.Target, true
			}
		}
		if !changed {
			continue
		}
		encoded, err := common.Marshal(groups)
		if err != nil {
			return err
		}
		if err := tx.Unscoped().Model(&Token{}).Where("id = ?", token.Id).Update("auto_groups", string(encoded)).Error; err != nil {
			return err
		}
	}
	var channels []Channel
	if err := tx.Select("id", "group").Find(&channels).Error; err != nil {
		return err
	}
	for _, channel := range channels {
		groups := strings.Split(channel.Group, ",")
		changed := false
		for i, group := range groups {
			if strings.TrimSpace(group) == op.Source {
				groups[i], changed = op.Target, true
			}
		}
		if changed {
			if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("group", strings.Join(groups, ",")).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// RawMessage preserves administrator numbers and labels verbatim; only complete
// group keys and ordered array elements are renamed.
func migrateGroupConfiguration(inventory *GroupReferenceInventory, source, target string) (map[string]string, error) {
	values := map[string]string{}
	for entry, value := range inventory.configuration {
		key, effective := strings.CutPrefix(entry, "configuration:")
		if !effective {
			continue
		}
		if key == "AutoGroups" {
			var groups []string
			if err := common.UnmarshalJsonStr(value, &groups); err != nil {
				return nil, err
			}
			for i, group := range groups {
				if group == source {
					groups[i] = target
				}
			}
			encoded, err := common.Marshal(groups)
			if err != nil {
				return nil, err
			}
			values[key] = string(encoded)
			continue
		}
		var object map[string]json.RawMessage
		if err := common.UnmarshalJsonStr(value, &object); err != nil {
			return nil, err
		}
		if key == "GroupGroupRatio" || key == "GroupSpecialUsableGroup" {
			for outer, raw := range object {
				var nested map[string]json.RawMessage
				if err := common.Unmarshal(raw, &nested); err != nil {
					return nil, err
				}
				for _, prefix := range []string{"", "+:", "-:"} {
					if prefix != "" && key != "GroupSpecialUsableGroup" {
						continue
					}
					if original, exists := nested[prefix+source]; exists {
						nested[prefix+target] = original
						delete(nested, prefix+source)
					}
				}
				encoded, err := common.Marshal(nested)
				if err != nil {
					return nil, err
				}
				object[outer] = encoded
			}
		}
		if original, exists := object[source]; exists {
			object[target] = original
			delete(object, source)
		}
		encoded, err := common.Marshal(object)
		if err != nil {
			return nil, err
		}
		values[key] = string(encoded)
	}
	for alias, canonical := range groupOptionAliases {
		values[alias] = values[canonical]
	}
	return values, nil
}

// refreshGroupMigrationCaches refreshes shared routing/subscription caches and
// this node's channel/pricing view during single-node migration and recovery.
// Callers hold groupViewMutex for writing, with Redis initialized or disabled
// before the lazy subscription caches are first accessed.
func refreshGroupMigrationCaches(tx *gorm.DB, target string) error {
	if err := refreshGroupMigrationSharedCaches(tx, target); err != nil {
		return err
	}
	return initChannelCache(tx)
}

// refreshGroupMigrationSharedCaches invalidates subscription views and refreshes
// routing metadata in bounded database and Redis batches without overwriting
// cached quota. An empty target refreshes all users and tokens for recovery.
// With Redis disabled, subscription invalidation applies to this node's memory.
func refreshGroupMigrationSharedCaches(tx *gorm.DB, target string) error {
	if err := getSubscriptionPlanCache().Purge(); err != nil {
		return err
	}
	if err := getSubscriptionPlanInfoCache().Purge(); err != nil {
		return err
	}
	if common.RedisEnabled {
		const batchSize = 500
		ctx := tx.Statement.Context
		const userScript = `if redis.call('EXISTS', KEYS[1]) == 1 then redis.call('HSET', KEYS[1], 'Group', ARGV[1]) end return 1`
		for lastID := 0; ; {
			var users []User
			query := tx.Unscoped().Select("id", "group").Where("id > ?", lastID).Order("id").Limit(batchSize)
			if target != "" {
				query = query.Where(commonGroupCol+" = ?", target)
			}
			if err := query.Find(&users).Error; err != nil {
				return err
			}
			if len(users) == 0 {
				break
			}
			if _, err := common.RDB.Pipelined(ctx, func(pipe redis.Pipeliner) error {
				for _, user := range users {
					pipe.Eval(ctx, userScript, []string{getUserCacheKey(user.Id)}, user.Group)
				}
				return nil
			}); err != nil {
				return err
			}
			lastID = users[len(users)-1].Id
		}
		// Update routing metadata only: Redis balances may already include pending
		// quota deltas and must survive refresh and recovery retries unchanged.
		const tokenScript = `if redis.call('EXISTS', KEYS[1]) == 1 then redis.call('HSET', KEYS[1], 'Group', ARGV[1], 'AutoGroups', ARGV[2]) end return 1`
		for lastID := 0; ; {
			var tokens []Token
			query := tx.Unscoped().Select("id", "key", "group", "auto_groups").Where("id > ?", lastID).Order("id").Limit(batchSize)
			if target != "" {
				// AutoGroups is JSON stored as text on all supported databases.
				// Read candidates here, then compare decoded names exactly below.
				query = query.Where("("+commonGroupCol+" = ? OR auto_groups <> ?)", target, "")
			}
			if err := query.Find(&tokens).Error; err != nil {
				return err
			}
			if len(tokens) == 0 {
				break
			}
			if _, err := common.RDB.Pipelined(ctx, func(pipe redis.Pipeliner) error {
				for _, token := range tokens {
					if target != "" && token.Group != target {
						var groups []string
						if err := common.UnmarshalJsonStr(token.AutoGroups, &groups); err != nil {
							return err
						}
						if !slices.Contains(groups, target) {
							continue
						}
					}
					pipe.Eval(ctx, tokenScript, []string{getTokenCacheKey(token.Key)}, token.Group, token.AutoGroups)
				}
				return nil
			}); err != nil {
				return err
			}
			lastID = tokens[len(tokens)-1].Id
		}
	}
	return nil
}
