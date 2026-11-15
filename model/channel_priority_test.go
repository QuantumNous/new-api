package model

import (
	"errors"
	"os"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestChannelPriorityPlan(t *testing.T) {
	for _, tc := range []struct {
		name       string
		values     []int64
		id, target int
		position   string
		want       map[int]int64
	}{
		{"midpoint", []int64{100, 80, 0}, 3, 2, "before", map[int]int64{3: 90}},
		{"top preserves peers", []int64{0, 0, 0}, 3, 1, "before", map[int]int64{3: 10}},
		{"bottom", []int64{0, 0, 0}, 1, 3, "after", map[int]int64{1: -10}},
		{"same tier", []int64{100, 80, 0}, 3, 2, "same", map[int]int64{3: 80}},
		{"same slot", []int64{100, 80, 0}, 2, 1, "after", map[int]int64{}},
		{"same tier no op", []int64{0, 0}, 1, 2, "same", map[int]int64{}},
		{"shift smaller upper tier", []int64{100, 99, 99, 0}, 4, 2, "before", map[int]int64{1: 101, 4: 100}},
		{"shift smaller lower tier", []int64{100, 100, 99, 0}, 4, 3, "before", map[int]int64{3: 98, 4: 99}},
		{"shift complete adjacent tiers", []int64{102, 101, 100, 99, 0}, 5, 3, "after", map[int]int64{4: 98, 5: 99}},
		{"upper safe bound", []int64{maxSortablePriority, 0}, 2, 1, "before", map[int]int64{1: maxSortablePriority - 1, 2: maxSortablePriority}},
		{"lower safe bound", []int64{-maxSortablePriority, 0}, 2, 1, "after", map[int]int64{1: -maxSortablePriority + 1, 2: -maxSortablePriority}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			items := make([]ChannelPriority, len(tc.values))
			for i, value := range tc.values {
				items[i] = ChannelPriority{ID: i + 1, Priority: &value}
			}
			changes, err := planChannelPriorityMove(items, ChannelPriorityMove{ID: tc.id, TargetID: tc.target, Position: tc.position})
			require.NoError(t, err)
			got := map[int]int64{}
			for _, change := range changes {
				require.NotNil(t, change.Priority)
				got[change.ID] = *change.Priority
			}
			assert.Equal(t, tc.want, got)
		})
	}
	_, err := planChannelPriorityMove([]ChannelPriority{{ID: 1}, {ID: 2}}, ChannelPriorityMove{ID: 1, TargetID: 2, Position: "invalid"})
	assert.ErrorIs(t, err, ErrChannelPriorityInvalid)
}

func TestChannelPriorityDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var driver gorm.Dialector
			switch dialect {
			case "sqlite":
				driver = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN not configured")
				}
				driver = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN not configured")
				}
				driver = postgres.Open(dsn)
			}
			db, err := gorm.Open(driver, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "priority_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			previousDB, previousType := DB, common.MainDatabaseType()
			DB = db
			common.SetMainDatabaseType(common.DatabaseType(dialect))
			initCol()
			t.Cleanup(func() {
				require.NoError(t, db.Migrator().DropTable(&Ability{}, &Channel{}))
				DB = previousDB
				common.SetMainDatabaseType(previousType)
				initCol()
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
			var version string
			query := "SELECT version()"
			if dialect == "sqlite" {
				query = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(query).Scan(&version).Error)
			t.Logf("database version: %s", version)
			high, low, zero := int64(100), int64(99), int64(0)
			w1, w2, w3, w4 := uint(11), uint(22), uint(33), uint(44)
			channels := []Channel{
				{Name: "high", Priority: &high, Weight: &w1, Key: "preserved", Status: 1},
				{Name: "low", Priority: &low, Weight: &w2, Status: 1},
				{Name: "peer", Priority: &low, Weight: &w3, Status: 1},
				{Name: "moving", Priority: &zero, Weight: &w4, Status: 1},
			}
			require.NoError(t, db.Create(&channels).Error)
			for _, channel := range channels {
				for _, group := range []string{"default", "second"} {
					require.NoError(t, db.Create(&Ability{Group: group, Model: "test", ChannelId: channel.Id, Priority: channel.Priority, Weight: uint(*channel.Weight), Enabled: true}).Error)
				}
			}
			initial, err := GetChannelPriorityOrder()
			require.NoError(t, err)
			move := ChannelPriorityMove{Revision: initial.Revision, ID: channels[3].Id, TargetID: channels[1].Id, Position: "before", Preview: true}
			preview, err := ReorderChannelPriority(move)
			require.NoError(t, err)
			require.Len(t, preview.Changes, 2)
			unchanged, err := GetChannelPriorityOrder()
			require.NoError(t, err)
			assert.Equal(t, initial, unchanged, "preview does not persist")
			move.Preview = false
			applied, err := ReorderChannelPriority(move)
			require.NoError(t, err)
			assert.Equal(t, preview, applied)
			for _, change := range applied.Changes {
				var abilities []Ability
				require.NoError(t, db.Where("channel_id = ?", change.ID).Find(&abilities).Error)
				require.Len(t, abilities, 2)
				for _, ability := range abilities {
					assert.Equal(t, change.Priority, ability.Priority)
					assert.True(t, ability.Enabled)
				}
			}
			var saved Channel
			require.NoError(t, db.First(&saved, channels[0].Id).Error)
			assert.Equal(t, "preserved", saved.Key)
			assert.Equal(t, channels[0].Weight, saved.Weight)
			_, err = ReorderChannelPriority(move)
			assert.ErrorIs(t, err, ErrChannelPriorityConflict)
			undo := ChannelPriorityMove{Revision: applied.Revision}
			for _, change := range applied.Changes {
				undo.Restore = append(undo.Restore, ChannelPriorityChange{ID: change.ID, Previous: change.Priority, Priority: change.Previous})
			}
			restored, err := ReorderChannelPriority(undo)
			require.NoError(t, err)
			assert.Equal(t, initial.Items, restored.Items)
			assert.Equal(t, initial.Revision, restored.Revision)
			if dialect != "sqlite" {
				sqlDB.SetMaxOpenConns(2)
			}
			start := make(chan struct{})
			errorsCh := make(chan error, 2)
			var workers sync.WaitGroup
			for range 2 {
				workers.Go(func() { <-start; _, moveErr := ReorderChannelPriority(move); errorsCh <- moveErr })
			}
			close(start)
			workers.Wait()
			close(errorsCh)
			succeeded, conflicted := 0, 0
			for moveErr := range errorsCh {
				if moveErr == nil {
					succeeded++
				} else {
					require.ErrorIs(t, moveErr, ErrChannelPriorityConflict)
					conflicted++
				}
			}
			assert.Equal(t, 1, succeeded)
			assert.Equal(t, 1, conflicted)
			_, err = ReorderChannelPriority(undo)
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			// An ability write failure must roll back every channel change too.
			require.NoError(t, db.Callback().Update().Before("gorm:update").Register("priority_test_failure", func(tx *gorm.DB) {
				if tx.Statement.Table == "priority_test_abilities" {
					tx.AddError(errors.New("forced routing write failure"))
				}
			}))
			_, err = ReorderChannelPriority(move)
			require.ErrorContains(t, err, "forced routing write failure")
			require.NoError(t, db.Callback().Update().Remove("priority_test_failure"))
			unchanged, err = GetChannelPriorityOrder()
			require.NoError(t, err)
			assert.Equal(t, initial, unchanged)
			// Null priority is an effective zero and undo must restore the null itself.
			require.NoError(t, db.Model(&Channel{}).Where("id = ?", channels[3].Id).Update("priority", nil).Error)
			nullable, err := GetChannelPriorityOrder()
			require.NoError(t, err)
			var sorted []ChannelPriority
			require.NoError(t, NewChannelSortOptions("priority", "asc", false).Apply(db.Model(&Channel{}).Select("id", "priority")).Find(&sorted).Error)
			assert.Equal(t, []int{channels[3].Id, channels[2].Id, channels[1].Id, channels[0].Id}, []int{sorted[0].ID, sorted[1].ID, sorted[2].ID, sorted[3].ID})
			move.Revision = nullable.Revision
			applied, err = ReorderChannelPriority(move)
			require.NoError(t, err)
			undo = ChannelPriorityMove{Revision: applied.Revision}
			for _, change := range applied.Changes {
				undo.Restore = append(undo.Restore, ChannelPriorityChange{ID: change.ID, Previous: change.Priority, Priority: change.Previous})
			}
			restored, err = ReorderChannelPriority(undo)
			require.NoError(t, err)
			assert.Equal(t, nullable.Items, restored.Items)
		})
	}
}
