package model

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// TestGroupMigrationProtocolUpgrade starts twice against genuinely missing
// protocol columns. Idle history survives; active legacy barriers and name-only
// confirmations never become authority for either abort or committed recovery.
func TestGroupMigrationProtocolUpgrade(t *testing.T) {
	var driver gorm.Dialector = sqlite.Open(filepath.Join(t.TempDir(), "protocol-upgrade.db"))
	databaseType := common.DatabaseTypeSQLite
	switch os.Getenv("TEST_GROUP_MIGRATION_DIALECT") {
	case "mysql":
		driver, databaseType = mysql.Open(os.Getenv("TEST_MYSQL_DSN")), common.DatabaseTypeMySQL
	case "postgres":
		driver, databaseType = postgres.Open(os.Getenv("TEST_POSTGRES_DSN")), common.DatabaseTypePostgreSQL
	}
	db, err := gorm.Open(driver, &gorm.Config{})
	require.NoError(t, err)
	previousDB, previousMain, previousLog := DB, common.MainDatabaseType(), common.LogDatabaseType()
	previousName := common.NodeName
	groupMigrationTraffic.Lock()
	previousOwner, previousRecovery := groupMigrationTraffic.owner, groupMigrationTraffic.recoveryOwner
	previousOperation, previousSource, previousTarget := groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target
	previousObservation, previousReady, previousConflict := groupMigrationTraffic.observation, groupMigrationTraffic.ready, groupMigrationTraffic.conflicted
	previousEpoch, previousChanged := groupMigrationTraffic.epoch, groupMigrationTraffic.changed
	groupMigrationTraffic.changed = map[string]uint64{}
	groupMigrationTraffic.Unlock()
	previousRevision := groupMigrationNodeRevision.Load()
	DB, common.NodeName = db, "legacy-a"
	common.SetMainDatabaseType(databaseType)
	initCol()
	t.Setenv("GROUP_MIGRATION_SINGLE_NODE", "true")
	t.Setenv("GROUP_MIGRATION_NODES", "")
	t.Cleanup(func() {
		DB, common.NodeName = previousDB, previousName
		common.SetDatabaseTypes(previousMain, previousLog)
		initCol()
		groupMigrationNodeRevision.Store(previousRevision)
		groupMigrationTraffic.Lock()
		groupMigrationTraffic.owner, groupMigrationTraffic.recoveryOwner = previousOwner, previousRecovery
		groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = previousOperation, previousSource, previousTarget
		groupMigrationTraffic.observation, groupMigrationTraffic.ready, groupMigrationTraffic.conflicted = previousObservation, previousReady, previousConflict
		groupMigrationTraffic.epoch, groupMigrationTraffic.changed = previousEpoch, previousChanged
		groupMigrationTraffic.Unlock()
		sqlDB, err := db.DB()
		require.NoError(t, err)
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, db.AutoMigrate(&SystemInstance{}))
	for _, state := range []string{"idle", "paused", "committed"} {
		t.Run(state, func(t *testing.T) {
			// These are only the three coordination tables in a disposable test DB.
			require.NoError(t, db.Migrator().DropTable(&GroupMigrationNode{}, &GroupMigrationOperation{}, &GroupMigrationControl{}))
			require.NoError(t, db.AutoMigrate(&GroupMigrationControl{}, &GroupMigrationOperation{}, &GroupMigrationNode{}))
			op := GroupMigrationOperation{ID: "legacy-operation", Source: "source", Target: "target", State: state, Participants: `["legacy-a","legacy-b"]`, Values: `{}`}
			control := GroupMigrationControl{ID: 1, Revision: 9, LastOperationID: op.ID}
			if state != "idle" {
				control.OperationID, control.Owner = op.ID, "previous-owner"
			} else {
				op.State = "completed"
			}
			require.NoError(t, db.Create(&op).Error)
			require.NoError(t, db.Create(&control).Error)
			require.NoError(t, db.Create(&GroupMigrationNode{Name: "legacy-a", Generation: "previous-owner", Roster: "legacy-a,legacy-b", OperationID: op.ID, Phase: "synced", Revision: 9}).Error)
			for _, removal := range []struct {
				model  any
				column string
			}{
				{&GroupMigrationControl{}, "CoordinationVersion"}, {&GroupMigrationControl{}, "Stage"},
				{&GroupMigrationOperation{}, "CoordinationVersion"}, {&GroupMigrationOperation{}, "ProtocolVersion"},
				{&GroupMigrationNode{}, "CoordinationVersion"}, {&GroupMigrationNode{}, "ProtocolVersion"},
			} {
				require.NoError(t, db.Migrator().DropColumn(removal.model, removal.column))
			}
			for range 2 {
				require.NoError(t, InitGroupMigrations(context.Background()))
				var actual GroupMigrationControl
				require.NoError(t, db.First(&actual, 1).Error)
				assert.Equal(t, control.Revision, actual.Revision)
				assert.Equal(t, control.OperationID, actual.OperationID)
				assert.Equal(t, control.Owner, actual.Owner)
				if state == "idle" {
					assert.EqualValues(t, 1, actual.CoordinationVersion)
					assert.Equal(t, "idle", actual.Stage)
					continue
				}
				assert.Zero(t, actual.CoordinationVersion)
				status := readGroupMigrationCoordination(db)
				assert.False(t, status.Ready)
				assert.Equal(t, errGroupMigrationLegacyProtocol.Error(), status.Reason)
				_, err := AdmitGroupRequest("source")
				require.ErrorIs(t, err, ErrGroupMigrationPaused)
				_, err = ResumeGroupMigration(t.Context(), op.ID)
				require.ErrorIs(t, err, errGroupMigrationLegacyProtocol)
			}
			var retained GroupMigrationOperation
			require.NoError(t, db.First(&retained, "id = ?", op.ID).Error)
			assert.Equal(t, op.State, retained.State)
			assert.Equal(t, op.Participants, retained.Participants)
			assert.Zero(t, retained.ProtocolVersion)
			if state != "idle" {
				t.Setenv("GROUP_MIGRATION_NODES", "legacy-a,legacy-b")
				t.Setenv("GROUP_MIGRATION_REPLACE_GENERATION", "previous-owner")
				require.ErrorIs(t, InitGroupMigrations(t.Context()), errGroupMigrationLegacyProtocol)
				var node GroupMigrationNode
				require.NoError(t, db.First(&node, "name = ?", "legacy-a").Error)
				assert.Equal(t, "previous-owner", node.Generation)
				assert.Zero(t, node.ProtocolVersion)
			}
		})
	}
}
