package model

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func openModelCostFXTestDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var db *gorm.DB
	var err error
	switch dialect {
	case "sqlite":
		db, err = gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "model-cost-fx.db")), &gorm.Config{})
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN is not configured")
		}
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN is not configured")
		}
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported test dialect %q", dialect)
	}
	require.NoError(t, err)
	previousType := common.MainDatabaseType()
	switch dialect {
	case "mysql":
		common.SetMainDatabaseType(common.DatabaseTypeMySQL)
	case "postgres":
		common.SetMainDatabaseType(common.DatabaseTypePostgreSQL)
	default:
		common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	}
	t.Cleanup(func() { common.SetMainDatabaseType(previousType) })
	require.NoError(t, db.AutoMigrate(&ModelCostFXRow{}))
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(&ModelCostFXRow{})
		sqlDB, closeErr := db.DB()
		if closeErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func withModelCostFXDB(t *testing.T, db *gorm.DB) {
	t.Helper()
	previous := DB
	DB = db
	modelCostFXState.Lock()
	modelCostFXState.snapshots = nil
	modelCostFXState.Unlock()
	t.Cleanup(func() {
		DB = previous
		modelCostFXState.Lock()
		modelCostFXState.snapshots = nil
		modelCostFXState.Unlock()
	})
}

func modelCostFXTestSnapshot(effective, fetched int64, rate float64) ModelCostFXSnapshot {
	return ModelCostFXSnapshot{Source: "test-source", EffectiveAt: effective, FetchedAt: fetched, Rates: map[string]float64{"USD": rate}}
}

func TestModelCostFXPersistenceContracts(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openModelCostFXTestDB(t, dialect)
			withModelCostFXDB(t, db)
			ctx := context.Background()
			first := modelCostFXTestSnapshot(100, 110, 90)
			first.Source = "TEST-SOURCE"
			require.NoError(t, SaveModelCostFX(ctx, first, 0))
			first.Rates["USD"] = 1
			current, err := CurrentModelCostFX("test-source")
			require.NoError(t, err)
			assert.Equal(t, int64(1), current.Version)
			assert.Equal(t, 90.0, current.Rates["USD"])
			current.Rates["USD"] = 1
			again, err := CurrentModelCostFX("test-source")
			require.NoError(t, err)
			assert.Equal(t, 90.0, again.Rates["USD"])
			failedDB, openErr := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, openErr)
			DB = failedDB
			assert.Error(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(101, 111, 91), 1))
			DB = db
			assert.Equal(t, 90.0, mustCurrentModelCostFX(t).Rates["USD"])

			assert.ErrorIs(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(101, 111, 91), 0), ErrModelCostFXVersionConflict)
			assert.ErrorIs(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(99, 112, 91), 1), ErrModelCostFXStale)
			assert.ErrorIs(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(100, 110, 91), 1), ErrModelCostFXStale)
			for _, invalid := range []float64{0, -1, math.NaN(), math.Inf(1)} {
				assert.Error(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(101, 112, invalid), 1))
			}
			var row ModelCostFXRow
			require.NoError(t, db.First(&row).Error)
			assert.Equal(t, int64(1), row.Version)

			require.NoError(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(101, 113, 91), 1))
			modelCostFXState.Lock()
			modelCostFXState.snapshots = nil
			modelCostFXState.Unlock()
			require.NoError(t, LoadModelCostFX(ctx, "test-source"))
			assert.Equal(t, int64(2), mustCurrentModelCostFX(t).Version)
			assert.NoError(t, db.Model(&ModelCostFXRow{}).Where("source = ?", "test-source").Update("rates_json", "{").Error)
			assert.Error(t, LoadModelCostFX(ctx, "test-source"))
			assert.Equal(t, 91.0, mustCurrentModelCostFX(t).Rates["USD"])
		})
	}
}

func mustCurrentModelCostFX(t *testing.T) ModelCostFXSnapshot {
	t.Helper()
	snapshot, err := CurrentModelCostFX("test-source")
	require.NoError(t, err)
	return snapshot
}

func TestModelCostFXConcurrentCAS(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openModelCostFXTestDB(t, dialect)
			withModelCostFXDB(t, db)
			ctx := context.Background()
			require.NoError(t, SaveModelCostFX(ctx, modelCostFXTestSnapshot(100, 100, 90), 0))
			start := make(chan struct{})
			var wg sync.WaitGroup
			results := make(chan error, 2)
			for _, rate := range []float64{91, 92} {
				wg.Add(1)
				go func(rate float64) {
					defer wg.Done()
					<-start
					results <- SaveModelCostFX(ctx, modelCostFXTestSnapshot(101, 101, rate), 1)
				}(rate)
			}
			close(start)
			wg.Wait()
			close(results)
			var successes int
			for err := range results {
				if err == nil {
					successes++
				} else {
					assert.NotErrorIs(t, err, nil)
				}
			}
			assert.Equal(t, 1, successes)
			var row ModelCostFXRow
			require.NoError(t, db.First(&row).Error)
			assert.Equal(t, int64(2), row.Version)
			assert.Equal(t, row.RatesJSON, mustCurrentModelCostFX(t).ratesJSONForTest())
		})
	}
}

func TestModelCostFXRAMNeverRollsBack(t *testing.T) {
	t.Cleanup(func() {
		modelCostFXState.Lock()
		modelCostFXState.snapshots = nil
		modelCostFXState.Unlock()
	})
	modelCostFXState.Lock()
	modelCostFXState.snapshots = nil
	modelCostFXState.Unlock()
	newer := modelCostFXTestSnapshot(101, 101, 91)
	newer.Version = 2
	older := modelCostFXTestSnapshot(100, 100, 90)
	older.Version = 1
	publishModelCostFX(newer)
	publishModelCostFX(older)
	assert.Equal(t, 91.0, mustCurrentModelCostFX(t).Rates["USD"])
}

func TestModelCostFXSourcesAreIndependent(t *testing.T) {
	db := openModelCostFXTestDB(t, "sqlite")
	withModelCostFXDB(t, db)
	ctx := context.Background()
	usd := modelCostFXTestSnapshot(100, 100, 90)
	eur := modelCostFXTestSnapshot(100, 100, 95)
	eur.Source = "other-source"
	require.NoError(t, SaveModelCostFX(ctx, usd, 0))
	require.NoError(t, SaveModelCostFX(ctx, eur, 0))
	assert.Equal(t, 90.0, mustCurrentModelCostFX(t).Rates["USD"])
	other, err := CurrentModelCostFX("other-source")
	require.NoError(t, err)
	assert.Equal(t, 95.0, other.Rates["USD"])
	require.NoError(t, LoadModelCostFX(ctx, "other-source"))
	reloaded, err := CurrentModelCostFX("other-source")
	require.NoError(t, err)
	assert.Equal(t, 95.0, reloaded.Rates["USD"])
}

func TestModelCostFXConcurrentFirstCreate(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openModelCostFXTestDB(t, dialect)
			withModelCostFXDB(t, db)
			start := make(chan struct{})
			results := make(chan error, 2)
			for _, rate := range []float64{90, 91} {
				go func(rate float64) {
					<-start
					results <- SaveModelCostFX(context.Background(), modelCostFXTestSnapshot(100, 100, rate), 0)
				}(rate)
			}
			close(start)
			first, second := <-results, <-results
			assert.NotEqual(t, first == nil, second == nil)
			var rows []ModelCostFXRow
			require.NoError(t, db.Find(&rows).Error)
			assert.Len(t, rows, 1)
			assert.Equal(t, int64(1), rows[0].Version)
		})
	}
}

func (snapshot ModelCostFXSnapshot) ratesJSONForTest() string {
	encoded, _ := common.Marshal(snapshot.Rates)
	return string(encoded)
}
