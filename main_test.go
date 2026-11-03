package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestInitResourcesRecoversCommittedGroupMigration exercises real startup in a
// fresh process so Redis globals and lazy subscription caches have not been warmed.
func TestInitResourcesRecoversCommittedGroupMigration(t *testing.T) {
	if os.Getenv("TEST_GROUP_MIGRATION_STARTUP_CHILD") == "true" {
		require.NoError(t, InitResources())
		assert.Equal(t, os.Getenv("REDIS_CONN_STRING") != "", common.RedisEnabled)
		t.Cleanup(func() { require.NoError(t, model.CloseDB()) })
		op, err := model.GetGroupMigration(context.Background(), "startup-recovery")
		require.NoError(t, err)
		assert.Equal(t, "completed", op.State)
		assert.False(t, ratio_setting.ContainsGroupRatio("old-group"))
		assert.Equal(t, 0.75, ratio_setting.GetGroupRatioCopy()["renamed"])
		assert.NoError(t, model.ValidateGroupReference("renamed", false, false))
		plan, err := model.GetSubscriptionPlanById(1)
		require.NoError(t, err)
		assert.Equal(t, "renamed", plan.UpgradeGroup)
		return
	}

	for _, mode := range []string{"redis_disabled", "redis_enabled"} {
		t.Run(mode, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "startup.db")
			db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.SubscriptionPlan{}, &model.Option{}, &model.GroupMigrationControl{}, &model.GroupMigrationOperation{}))
			require.NoError(t, db.Create(&model.User{Id: 1, Username: "startup-recovery", Group: "renamed"}).Error)
			require.NoError(t, db.Create(&model.SubscriptionPlan{Id: 1, Title: "Migrated plan", UpgradeGroup: "renamed"}).Error)
			require.NoError(t, db.Create(&model.Option{Key: "GroupRatio", Value: `{"default":1,"renamed":0.75}`}).Error)
			require.NoError(t, db.Create(&model.GroupMigrationOperation{
				ID: "startup-recovery", Source: "old-group", Target: "renamed", State: "committed",
				ProtocolVersion: 2, CoordinationVersion: 2,
				Values: `{"GroupRatio":"{\"default\":1,\"renamed\":0.75}"}`,
			}).Error)
			require.NoError(t, db.Create(&model.GroupMigrationControl{ID: 1, Owner: "previous-process", OperationID: "startup-recovery", CoordinationVersion: 2, Stage: "syncing"}).Error)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			require.NoError(t, sqlDB.Close())

			redisURL := ""
			var redisServer *miniredis.Miniredis
			if mode == "redis_enabled" {
				redisServer = miniredis.RunT(t)
				redisURL = "redis://" + redisServer.Addr()
				redisServer.HSet("user:1", "Group", "old-group", "Quota", "123")
			}
			t.Setenv("TEST_GROUP_MIGRATION_STARTUP_CHILD", "true")
			t.Setenv("SQLITE_PATH", path)
			t.Setenv("SQL_DSN", "")
			t.Setenv("LOG_SQL_DSN", "")
			t.Setenv("REDIS_CONN_STRING", redisURL)
			t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
			t.Setenv("GROUP_MIGRATION_NODES", "")
			t.Setenv("NODE_TYPE", "master")
			t.Setenv("MEMORY_CACHE_ENABLED", "false")
			t.Setenv("PASSWORD_LOGIN_ENCRYPTION_ENABLED", "false")
			binary, err := os.Executable()
			require.NoError(t, err)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			cmd := exec.CommandContext(ctx, binary, "-test.run=^TestInitResourcesRecoversCommittedGroupMigration$", "-test.v", "-log-dir="+filepath.Join(dir, "logs"))
			cmd.Dir = dir
			output, err := cmd.CombinedOutput()
			require.NoError(t, err, "%s", output)
			if redisServer != nil {
				assert.Equal(t, "renamed", redisServer.HGet("user:1", "Group"))
				assert.Equal(t, "123", redisServer.HGet("user:1", "Quota"))
			}
		})
	}
}
