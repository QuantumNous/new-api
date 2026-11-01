package model

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// migrationCacheRefreshHook observes routing-cache network batches and can fail
// one batch before transmission to exercise an interrupted refresh and retry.
type migrationCacheRefreshHook struct {
	singles   int
	batches   []int
	keys      []string
	failBatch int
	scans     int
	failSet   bool
}

func (hook *migrationCacheRefreshHook) BeforeProcess(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
	if cmd.Name() == "scan" {
		hook.scans++
	}
	if cmd.Name() == "set" && hook.failSet {
		return ctx, errors.New("interrupted cache completion write")
	}
	if cmd.Name() == "eval" {
		hook.singles++
		hook.keys = append(hook.keys, cmd.Args()[3].(string))
	}
	return ctx, nil
}

func (*migrationCacheRefreshHook) AfterProcess(context.Context, redis.Cmder) error { return nil }

func (hook *migrationCacheRefreshHook) BeforeProcessPipeline(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
	count := 0
	for _, cmd := range cmds {
		if cmd.Name() == "eval" {
			count++
			hook.keys = append(hook.keys, cmd.Args()[3].(string))
		}
	}
	if count > 0 {
		hook.batches = append(hook.batches, count)
		if len(hook.batches) == hook.failBatch {
			return ctx, errors.New("interrupted migration cache batch")
		}
	}
	return ctx, nil
}

func (*migrationCacheRefreshHook) AfterProcessPipeline(context.Context, []redis.Cmder) error {
	return nil
}

// TestRefreshGroupMigrationCaches protects bounded network/database batches,
// exact routing selection, recovery and balances ahead of database snapshots.
func TestRefreshGroupMigrationCaches(t *testing.T) {
	var driver gorm.Dialector = sqlite.Open(filepath.Join(t.TempDir(), "cache-refresh.db"))
	databaseType := common.DatabaseTypeSQLite
	switch os.Getenv("TEST_GROUP_MIGRATION_DIALECT") {
	case "mysql":
		driver, databaseType = mysql.Open(os.Getenv("TEST_MYSQL_DSN")), common.DatabaseTypeMySQL
	case "postgres":
		driver, databaseType = postgres.Open(os.Getenv("TEST_POSTGRES_DSN")), common.DatabaseTypePostgreSQL
	}
	db, err := gorm.Open(driver, &gorm.Config{})
	require.NoError(t, err)
	previousDB, previousMainType, previousLogType := DB, common.MainDatabaseType(), common.LogDatabaseType()
	DB = db
	common.SetMainDatabaseType(databaseType)
	initCol()
	t.Cleanup(func() {
		DB = previousDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		initCol()
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, DB.AutoMigrate(&User{}, &Token{}))
	server := useUserCacheMiniRedis(t)
	previousMemory := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	previousPlans, previousInfo := getSubscriptionPlanCache(), getSubscriptionPlanInfoCache()
	subscriptionPlanCache = cachex.NewHybridCache(cachex.HybridCacheConfig[SubscriptionPlan]{
		Namespace: cachex.Namespace(subscriptionPlanCacheNamespace), Redis: common.RDB, RedisCodec: cachex.JSONCodec[SubscriptionPlan]{},
		RedisEnabled: func() bool { return common.RedisEnabled },
	})
	subscriptionPlanInfoCache = cachex.NewHybridCache(cachex.HybridCacheConfig[SubscriptionPlanInfo]{
		Namespace: cachex.Namespace(subscriptionPlanInfoCacheNamespace), Redis: common.RDB, RedisCodec: cachex.JSONCodec[SubscriptionPlanInfo]{},
		RedisEnabled: func() bool { return common.RedisEnabled },
	})
	t.Cleanup(func() {
		subscriptionPlanCache, subscriptionPlanInfoCache = previousPlans, previousInfo
		common.MemoryCacheEnabled = previousMemory
	})

	// Cross a 500-record page with gaps in IDs and a soft delete on the last page.
	users := make([]User, 501)
	tokens := make([]Token, 501)
	deleted := gorm.DeletedAt{Time: time.Now(), Valid: true}
	for i := range users {
		users[i] = User{Id: 10 + 2*i, Username: fmt.Sprintf("cache-user-%d", i), AffCode: fmt.Sprintf("cache-aff-%d", i), Group: "vip"}
		tokens[i] = Token{Id: 10 + 2*i, Key: fmt.Sprintf("cache-token-%d", i), Group: "vip"}
	}
	users[500].DeletedAt, tokens[500].DeletedAt = deleted, deleted
	users = append(users, User{Id: 2000, Username: "unrelated", AffCode: "unrelated", Group: "other"}, User{Id: 2001, Username: "cold", AffCode: "cold", Group: "vip"})
	tokens = append(tokens,
		Token{Id: 2000, Key: "auto-escaped", Group: "auto", AutoGroups: `["other","\u0076ip"]`},
		Token{Id: 2001, Key: "auto-deleted", Group: "auto", AutoGroups: `["vip"]`, DeletedAt: deleted},
		Token{Id: 2002, Key: "auto-unrelated", Group: "auto", AutoGroups: `["vip-extra"]`},
		Token{Id: 2003, Key: "fixed-unrelated", Group: "other"},
		Token{Id: 2004, Key: "inherited", Group: ""},
		Token{Id: 2005, Key: "cold", Group: "vip"},
	)
	require.NoError(t, DB.CreateInBatches(users, 100).Error)
	require.NoError(t, DB.CreateInBatches(tokens, 100).Error)
	for _, user := range users {
		if user.Id == 2001 {
			continue
		}
		key := getUserCacheKey(user.Id)
		server.HSet(key, "Group", "before-refresh", "Quota", "888", "AuthVersion", "9", "Status", "2")
		server.SetTTL(key, 5*time.Minute)
	}
	for _, token := range tokens {
		if token.Id == 2005 {
			continue
		}
		key := getTokenCacheKey(token.Key)
		server.HSet(key, "Group", "before-refresh", "AutoGroups", "[]", "RemainQuota", "777", "UsedQuota", "333", "Status", "2")
		server.SetTTL(key, 5*time.Minute)
	}

	var userPages, tokenPages []int
	var queriedTokenKeys []string
	failChannels := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register("test:migration-cache-pages", func(tx *gorm.DB) {
		switch rows := tx.Statement.Dest.(type) {
		case *[]User:
			userPages = append(userPages, len(*rows))
		case *[]Token:
			tokenPages = append(tokenPages, len(*rows))
			for _, token := range *rows {
				queriedTokenKeys = append(queriedTokenKeys, token.Key)
			}
		case *[]*Channel:
			if failChannels {
				tx.AddError(errors.New("local channel sync failed"))
			}
		}
	}))
	t.Cleanup(func() { require.NoError(t, DB.Callback().Query().Remove("test:migration-cache-pages")) })
	hook := &migrationCacheRefreshHook{}
	common.RDB.AddHook(hook)

	for _, target := range []string{"vip", ""} {
		t.Run("target="+target, func(t *testing.T) {
			*hook = migrationCacheRefreshHook{}
			userPages, tokenPages, queriedTokenKeys = nil, nil, nil
			groupViewMutex.Lock()
			err := DB.WithContext(t.Context()).Transaction(func(tx *gorm.DB) error { return refreshGroupMigrationCaches(tx, target) })
			groupViewMutex.Unlock()
			require.NoError(t, err)
			assert.Zero(t, hook.singles, "routing updates must use network batches")
			assert.Greater(t, len(hook.batches), 1)
			for _, count := range hook.batches {
				assert.Less(t, count, len(tokens), "do not queue the entire population in one pipeline")
			}
			for _, pages := range [][]int{userPages, tokenPages} {
				assert.Greater(t, len(pages), 1, "read bounded pages instead of loading every row")
				for _, count := range pages {
					assert.Less(t, count, 501)
				}
			}
			if target != "" {
				assert.NotContains(t, queriedTokenKeys, "fixed-unrelated")
				assert.NotContains(t, queriedTokenKeys, "inherited")
				assert.NotContains(t, hook.keys, getTokenCacheKey("auto-unrelated"))
			}
			for _, user := range users {
				key := getUserCacheKey(user.Id)
				if user.Id == 2001 {
					assert.False(t, server.Exists(key), "cold caches must remain cold")
					continue
				}
				expected := user.Group
				if target != "" && user.Group != target {
					expected = "before-refresh"
				}
				assert.Equal(t, expected, server.HGet(key, "Group"))
				assert.Equal(t, "888", server.HGet(key, "Quota"))
				assert.Equal(t, "9", server.HGet(key, "AuthVersion"))
				assert.Equal(t, "2", server.HGet(key, "Status"))
				assert.Equal(t, 5*time.Minute, server.TTL(key))
			}
			for _, token := range tokens {
				key := getTokenCacheKey(token.Key)
				if token.Id == 2005 {
					assert.False(t, server.Exists(key))
					continue
				}
				expectedGroup, expectedAuto := token.Group, token.AutoGroups
				if target != "" && token.Group != target && token.Id != 2000 && token.Id != 2001 {
					expectedGroup, expectedAuto = "before-refresh", "[]"
				}
				assert.Equal(t, expectedGroup, server.HGet(key, "Group"), token.Key)
				assert.Equal(t, expectedAuto, server.HGet(key, "AutoGroups"), token.Key)
				assert.Equal(t, "777", server.HGet(key, "RemainQuota"))
				assert.Equal(t, "333", server.HGet(key, "UsedQuota"))
				assert.Equal(t, "2", server.HGet(key, "Status"))
				assert.Equal(t, 5*time.Minute, server.TTL(key))
			}
		})
	}

	server.HSet(getTokenCacheKey(tokens[0].Key), "Group", "interrupted")
	server.HSet(getTokenCacheKey(tokens[500].Key), "Group", "interrupted")
	// Two user batches and the first token batch succeed before interruption.
	*hook = migrationCacheRefreshHook{failBatch: 4}
	groupViewMutex.Lock()
	err = refreshGroupMigrationCaches(DB.WithContext(t.Context()), "vip")
	groupViewMutex.Unlock()
	require.ErrorContains(t, err, "interrupted migration cache batch")
	assert.Equal(t, "vip", server.HGet(getTokenCacheKey(tokens[0].Key), "Group"))
	assert.Equal(t, "interrupted", server.HGet(getTokenCacheKey(tokens[500].Key), "Group"))
	hook.failBatch = 0
	groupViewMutex.Lock()
	err = refreshGroupMigrationCaches(DB.WithContext(t.Context()), "vip")
	groupViewMutex.Unlock()
	require.NoError(t, err)
	assert.Equal(t, "vip", server.HGet(getTokenCacheKey(tokens[500].Key), "Group"))
	assert.Equal(t, "777", server.HGet(getTokenCacheKey(tokens[0].Key), "RemainQuota"))
	assert.Equal(t, "888", server.HGet(getUserCacheKey(users[0].Id), "Quota"))

	t.Run("shared refresh across node generations", func(t *testing.T) {
		require.NoError(t, DB.AutoMigrate(&GroupMigrationControl{}, &GroupMigrationOperation{}, &GroupMigrationNode{}, &Option{}, &Channel{}, &Ability{}))
		t.Setenv("GROUP_MIGRATION_NODES", "cache-a,cache-b")
		previousName, previousRevision := common.NodeName, groupMigrationNodeRevision.Load()
		groupMigrationTraffic.Lock()
		previousOwner, previousOperation := groupMigrationTraffic.owner, groupMigrationTraffic.operation
		previousSource, previousTarget := groupMigrationTraffic.source, groupMigrationTraffic.target
		previousEpoch, previousChanged := groupMigrationTraffic.epoch, groupMigrationTraffic.changed
		previousInflight := groupMigrationTraffic.inflight
		previousObservation, previousReady := groupMigrationTraffic.observation, groupMigrationTraffic.ready
		previousConflicted := groupMigrationTraffic.conflicted
		groupMigrationTraffic.changed = map[string]uint64{}
		groupMigrationTraffic.inflight = map[string]int{}
		groupMigrationTraffic.Unlock()
		previousGroups, previousChannels, previousAdvanced := group2model2channels, channelsIDM, channel2advancedCustomConfig
		t.Cleanup(func() {
			common.NodeName, common.MemoryCacheEnabled = previousName, false
			groupMigrationNodeRevision.Store(previousRevision)
			groupMigrationTraffic.Lock()
			groupMigrationTraffic.owner, groupMigrationTraffic.operation = previousOwner, previousOperation
			groupMigrationTraffic.source, groupMigrationTraffic.target = previousSource, previousTarget
			groupMigrationTraffic.epoch, groupMigrationTraffic.changed = previousEpoch, previousChanged
			groupMigrationTraffic.inflight = previousInflight
			groupMigrationTraffic.observation, groupMigrationTraffic.ready = previousObservation, previousReady
			groupMigrationTraffic.conflicted = previousConflicted
			groupMigrationTraffic.Unlock()
			group2model2channels, channelsIDM, channel2advancedCustomConfig = previousGroups, previousChannels, previousAdvanced
		})
		common.MemoryCacheEnabled = true
		require.NoError(t, DB.Create(&Channel{Id: 1, Group: "vip", Models: "cache-model", Status: common.ChannelStatusEnabled}).Error)
		require.NoError(t, DB.Create(&Ability{ChannelId: 1, Group: "vip", Model: "cache-model", Enabled: true}).Error)
		op := GroupMigrationOperation{ID: "cache-operation", Source: "old", Target: "vip", State: "committed", Values: `{}`, ProtocolVersion: groupMigrationProtocolVersion, CoordinationVersion: 1, Participants: `[{"name":"cache-a","generation":"cache-a"},{"name":"cache-b","generation":"cache-b"}]`}
		require.NoError(t, DB.Create(&op).Error)
		require.NoError(t, DB.Create(&GroupMigrationControl{ID: 1, Revision: 1, OperationID: op.ID, CoordinationVersion: 1, Stage: "syncing"}).Error)
		for _, name := range []string{"cache-a", "cache-b"} {
			require.NoError(t, DB.Create(&GroupMigrationNode{Name: name, Generation: name, Roster: "cache-a,cache-b", Revision: -1, ProtocolVersion: groupMigrationProtocolVersion}).Error)
		}
		// Each call starts with independent local routing/revision state, as on
		// separate processes or replacement generations sharing the same Redis.
		syncNode := func(name string) error {
			common.NodeName = name
			groupMigrationTraffic.Lock()
			groupMigrationTraffic.owner = name
			groupMigrationTraffic.observation, groupMigrationTraffic.ready = nil, false
			groupMigrationTraffic.conflicted = false
			groupMigrationTraffic.Unlock()
			groupMigrationNodeRevision.Store(-1)
			group2model2channels, channelsIDM = nil, nil
			userPages, tokenPages = nil, nil
			return SyncGroupMigrationNode(t.Context())
		}
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-a"))
		assert.NotEmpty(t, hook.batches)
		assert.NotEmpty(t, userPages)
		assert.NotEmpty(t, tokenPages)
		assert.Equal(t, []int{1}, group2model2channels["vip"]["cache-model"])
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-b"))
		assert.Empty(t, hook.batches, "another node must reuse successful shared Redis refresh")
		assert.Zero(t, hook.scans, "shared subscription caches must not be purged again")
		assert.Empty(t, userPages)
		assert.Empty(t, tokenPages)
		assert.Equal(t, []int{1}, group2model2channels["vip"]["cache-model"], "every node must rebuild its own routing")

		// A later revision fails partway through; it must not publish completion
		// or acknowledge the node, and another participant must be able to retry.
		require.NoError(t, DB.Model(&GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"revision": 2, "coordination_version": 2}).Error)
		require.NoError(t, DB.Model(&op).Update("coordination_version", 2).Error)
		server.HSet(getTokenCacheKey(tokens[0].Key), "Group", "interrupted")
		*hook = migrationCacheRefreshHook{failBatch: 3}
		require.ErrorContains(t, syncNode("cache-a"), "interrupted migration cache batch")
		var node GroupMigrationNode
		require.NoError(t, DB.First(&node, "name = ?", "cache-a").Error)
		assert.EqualValues(t, 1, node.Revision)
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-b"))
		assert.NotEmpty(t, hook.batches)
		assert.Equal(t, "vip", server.HGet(getTokenCacheKey(tokens[0].Key), "Group"))
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-a"))
		assert.Empty(t, hook.batches)

		require.NoError(t, DB.Model(&GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"revision": 3, "coordination_version": 3}).Error)
		require.NoError(t, DB.Model(&op).Update("coordination_version", 3).Error)
		*hook = migrationCacheRefreshHook{failSet: true}
		require.ErrorContains(t, syncNode("cache-a"), "interrupted cache completion write")
		*hook = migrationCacheRefreshHook{}
		failChannels = true
		require.ErrorContains(t, syncNode("cache-b"), "local channel sync failed")
		assert.NotEmpty(t, hook.batches, "a failed completion write must not suppress recovery")
		node = GroupMigrationNode{}
		require.NoError(t, DB.First(&node, "name = ?", "cache-b").Error)
		assert.EqualValues(t, 2, node.Revision, "local rebuild failures must not acknowledge sync")
		failChannels = false
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-b"))
		assert.Empty(t, hook.batches, "successful shared refresh survives a local rebuild failure")
		assert.Equal(t, []int{1}, group2model2channels["vip"]["cache-model"])

		// An aborted operation can share the prior revision. Its recovery must
		// not reuse a completion belonging to a different operation.
		op.ID, op.State = "cache-aborted", "aborted"
		require.NoError(t, DB.Create(&op).Error)
		require.NoError(t, DB.Model(&GroupMigrationControl{}).Where("id = ?", 1).Updates(map[string]any{"operation_id": "", "last_operation_id": op.ID, "coordination_version": 4, "stage": "idle"}).Error)
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-b"))
		assert.NotEmpty(t, hook.batches)

		server.FlushAll()
		server.HSet(getTokenCacheKey(tokens[0].Key), "Group", "stale", "RemainQuota", "777")
		*hook = migrationCacheRefreshHook{}
		require.NoError(t, syncNode("cache-a"))
		assert.NotEmpty(t, hook.batches, "a lost completion marker requires full recovery")
		assert.Equal(t, "vip", server.HGet(getTokenCacheKey(tokens[0].Key), "Group"))
		assert.Equal(t, "777", server.HGet(getTokenCacheKey(tokens[0].Key), "RemainQuota"))
		server.SetError("cache unavailable")
		require.Error(t, syncNode("cache-b"), "Redis errors must fail closed even when previously refreshed")
		server.SetError("")

		common.RedisEnabled = false
		defer func() { common.RedisEnabled = true }()
		for _, name := range []string{"cache-a", "cache-b"} {
			require.NoError(t, getSubscriptionPlanCache().SetWithTTL("local-plan", SubscriptionPlan{Id: 1}, time.Minute))
			require.NoError(t, getSubscriptionPlanInfoCache().SetWithTTL("local-info", SubscriptionPlanInfo{}, time.Minute))
			require.NoError(t, syncNode(name))
			_, found, err := getSubscriptionPlanCache().Get("local-plan")
			require.NoError(t, err)
			assert.False(t, found, "without Redis, each node must purge its local subscription cache")
			_, found, err = getSubscriptionPlanInfoCache().Get("local-info")
			require.NoError(t, err)
			assert.False(t, found)
			assert.Equal(t, []int{1}, group2model2channels["vip"]["cache-model"])
		}

		// The approved observation seam deterministically delivers an older idle
		// snapshot after a new barrier. Real cache publication remains in use.
		idle, err := readGroupMigrationNodeObservation(DB, &GroupMigrationControl{ID: 1, CoordinationVersion: 4, Revision: 3, LastOperationID: op.ID, Stage: "idle"})
		require.NoError(t, err)
		barrier := *idle
		barrier.operation = &GroupMigrationOperation{ID: "ordered-barrier", Source: "vip", Target: "next", State: "paused"}
		barrier.control.OperationID, barrier.control.Stage, barrier.control.CoordinationVersion = barrier.operation.ID, "draining", 5
		groupMigrationTraffic.Lock()
		groupMigrationTraffic.inflight["vip"] = 1
		groupMigrationTraffic.Unlock()
		phase, err := barrier.applyLocalState(DB)
		require.NoError(t, err)
		assert.Equal(t, "draining", phase)
		epoch := GroupRequestVersion()
		_, err = barrier.applyLocalState(DB)
		require.NoError(t, err)
		assert.Equal(t, epoch, GroupRequestVersion(), "same observation must be idempotent")
		_, err = idle.applyLocalState(DB)
		require.ErrorIs(t, err, ErrGroupMigrationPaused)
		_, err = admitGroupRequest(GroupRequestVersion(), "vip")
		require.ErrorIs(t, err, ErrGroupMigrationPaused, "delayed idle must not reopen admission")
		conflict := barrier
		conflict.control.Revision++
		_, err = conflict.applyLocalState(DB)
		require.ErrorIs(t, err, ErrGroupMigrationPaused)
		_, err = barrier.applyLocalState(DB)
		require.ErrorIs(t, err, ErrGroupMigrationPaused, "same-version retries cannot erase a conflict")
		groupMigrationTraffic.Lock()
		groupMigrationTraffic.inflight["vip"] = 0
		groupMigrationTraffic.Unlock()
		barrier.control.CoordinationVersion++
		phase, err = barrier.applyLocalState(DB)
		require.NoError(t, err)
		assert.Equal(t, "drained", phase)
		_, err = admitGroupRequest(GroupRequestVersion(), "vip")
		require.ErrorIs(t, err, ErrGroupMigrationPaused, "restored view alone cannot release a barrier")
		done, err := admitGroupRequest(GroupRequestVersion(), "unrelated")
		require.NoError(t, err)
		done()
		idle.control.CoordinationVersion = 7
		_, err = idle.applyLocalState(DB)
		require.NoError(t, err)
		_, err = barrier.applyLocalState(DB)
		require.ErrorIs(t, err, ErrGroupMigrationPaused)
		done, err = admitGroupRequest(GroupRequestVersion(), "vip")
		require.NoError(t, err, "newer durable release remains authoritative")
		done()
	})
}
