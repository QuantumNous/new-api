package model

import (
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var bytePlusRealPersonTestDBSeq atomic.Uint64

func TestBytePlusRealPersonSchemaSupportsMultiplePendingProfilesAndUniqueGroup(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)

	first := BytePlusRealPersonProfile{
		PublicId: "rph_first", UserId: 7, Name: "Person A", ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusPendingVerification,
	}
	second := BytePlusRealPersonProfile{
		PublicId: "rph_second", UserId: 7, Name: "Person B", ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusPendingVerification,
	}
	require.NoError(t, db.Create(&first).Error)
	require.NoError(t, db.Create(&second).Error)

	groupID := "group-1"
	require.NoError(t, db.Model(&first).Update("upstream_group_id", groupID).Error)
	duplicate := BytePlusRealPersonProfile{
		PublicId: "rph_third", UserId: 7, Name: "Person C", ChannelId: 101,
		UpstreamGroupId: &groupID, Status: BytePlusRealPersonProfileStatusActive,
	}
	require.Error(t, db.Create(&duplicate).Error)
}

func TestBytePlusRealPersonDialectMigrations(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := openBytePlusRealPersonDialectDB(t, dialect)
			require.NoError(t, db.AutoMigrate(
				&BytePlusRealPersonProfile{}, &BytePlusVisualValidationSession{},
				&APIIdempotencyRecord{}, &BytePlusAssetTempObject{}, &BytePlusAsset{},
			))
			require.True(t, db.Migrator().HasColumn(&BytePlusAssetTempObject{}, "asset_id"))
			require.True(t, db.Migrator().HasColumn(&BytePlusAsset{}, "real_person_profile_id"))
		})
	}
}

func newBytePlusRealPersonTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := openBytePlusRealPersonSQLiteDB(t)
	require.NoError(t, db.AutoMigrate(
		&BytePlusRealPersonProfile{}, &BytePlusVisualValidationSession{},
		&APIIdempotencyRecord{}, &BytePlusAssetTempObject{}, &BytePlusAsset{},
	))
	oldDB := DB
	DB = db
	t.Cleanup(func() {
		DB = oldDB
	})
	return db
}

func openBytePlusRealPersonDialectDB(t *testing.T, dialect string) *gorm.DB {
	t.Helper()

	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "sqlite":
		db = openBytePlusRealPersonSQLiteDB(t)
	case "mysql":
		dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
		if dsn == "" {
			t.Skip("set TEST_MYSQL_DSN to run MySQL BytePlus real person migration smoke test")
		}
		db, err = gorm.Open(mysql.Open(ensureMySQLDSNDefaults(dsn)), &gorm.Config{})
	case "postgres":
		dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
		if dsn == "" {
			t.Skip("set TEST_POSTGRES_DSN to run PostgreSQL BytePlus real person migration smoke test")
		}
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unknown dialect %q", dialect)
	}
	require.NoError(t, err)

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	models := []interface{}{
		&BytePlusRealPersonProfile{}, &BytePlusVisualValidationSession{},
		&APIIdempotencyRecord{}, &BytePlusAssetTempObject{}, &BytePlusAsset{},
	}
	for _, model := range models {
		if db.Migrator().HasTable(model) {
			require.NoError(t, sqlDB.Close())
			t.Fatalf("target test table already exists for %s: %T", dialect, model)
		}
	}
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(models...)
		_ = sqlDB.Close()
	})
	return db
}

func openBytePlusRealPersonSQLiteDB(t *testing.T) *gorm.DB {
	t.Helper()
	seq := bytePlusRealPersonTestDBSeq.Add(1)
	db, err := gorm.Open(sqlite.Open("file:byteplus_real_person_"+strings.ReplaceAll(t.Name(), "/", "_")+"_"+strconv.FormatUint(seq, 10)+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		_ = sqlDB.Close()
	})
	return db
}
