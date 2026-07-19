package model

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupOAuthStateGrantTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := DB
	oldDatabaseType := common.MainDatabaseType()
	databasePath := filepath.Join(t.TempDir(), fmt.Sprintf("oauth_state_%d.db", time.Now().UnixNano()))
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(30000)&_txlock=immediate", filepath.ToSlash(databasePath))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&OAuthStateGrant{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			require.NoError(t, sqlDB.Close())
		}
		DB = oldDB
		common.SetMainDatabaseType(oldDatabaseType)
	})
	return db
}

func TestOAuthStateGrantStoresOnlyDigestAndClaimsOnce(t *testing.T) {
	db := setupOAuthStateGrantTestDB(t)
	state := "CSPRNG-STATE-MUST-NOT-BE-STORED"
	now := time.Now().UTC().Truncate(time.Second)

	require.NoError(t, CreateOAuthStateGrant(state, "GitHub", now.Add(time.Minute)))
	var grant OAuthStateGrant
	require.NoError(t, db.First(&grant).Error)
	assert.NotEqual(t, state, grant.StateHash)
	assert.Equal(t, 64, len(grant.StateHash))
	assert.Equal(t, "github", grant.Provider)

	require.NoError(t, ClaimOAuthStateGrant(state, "GITHUB", now))
	require.ErrorIs(t, ClaimOAuthStateGrant(state, "github", now), ErrOAuthStateGrantInvalid)
}

func TestOAuthStateGrantRejectsExpiredState(t *testing.T) {
	setupOAuthStateGrantTestDB(t)
	now := time.Now().UTC().Truncate(time.Second)

	require.NoError(t, CreateOAuthStateGrant("expired-state", "oidc", now.Add(time.Second)))
	require.ErrorIs(
		t,
		ClaimOAuthStateGrant("expired-state", "oidc", now.Add(2*time.Second)),
		ErrOAuthStateGrantInvalid,
	)
}

func TestOAuthStateGrantConcurrentClaimHasExactlyOneWinner(t *testing.T) {
	setupOAuthStateGrantTestDB(t)
	now := time.Now().UTC().Truncate(time.Second)
	require.NoError(t, CreateOAuthStateGrant("single-use-state", "linuxdo", now.Add(time.Minute)))

	const claimCount = 16
	start := make(chan struct{})
	results := make(chan error, claimCount)
	var waitGroup sync.WaitGroup
	for index := 0; index < claimCount; index++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			results <- ClaimOAuthStateGrant("single-use-state", "linuxdo", now)
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	successes := 0
	replays := 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case err == ErrOAuthStateGrantInvalid:
			replays++
		default:
			assert.Failf(t, "unexpected claim error", "%v", err)
		}
		assert.False(t, IsSQLiteBusyError(err), "SQLite lock error leaked from atomic claim: %v", err)
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, claimCount-1, replays)
}

func runExternalOAuthStateGrantConcurrencyTest(t *testing.T, databaseType common.DatabaseType, dsn string) {
	t.Helper()
	var (
		db  *gorm.DB
		err error
	)
	switch databaseType {
	case common.DatabaseTypeMySQL:
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case common.DatabaseTypePostgreSQL:
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported database type %q", databaseType)
	}
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(16)
	sqlDB.SetMaxIdleConns(16)
	if db.Migrator().HasTable(&OAuthStateGrant{}) {
		require.NoError(t, sqlDB.Close())
		t.Skipf("refusing to run OAuth state concurrency test because %s table already exists", databaseType)
	}
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	t.Cleanup(func() {
		if db.Migrator().HasTable(&OAuthStateGrant{}) {
			require.NoError(t, db.Migrator().DropTable(&OAuthStateGrant{}))
		}
	})
	useInvitationConcurrencyDB(t, db, databaseType)
	require.NoError(t, db.AutoMigrate(&OAuthStateGrant{}))

	now := time.Now().UTC().Truncate(time.Second)
	require.NoError(t, CreateOAuthStateGrant("external-single-use-state", "oidc", now.Add(time.Minute)))
	const claimCount = 16
	start := make(chan struct{})
	results := make(chan error, claimCount)
	var waitGroup sync.WaitGroup
	for index := 0; index < claimCount; index++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			results <- ClaimOAuthStateGrant("external-single-use-state", "oidc", now)
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	successes := 0
	replays := 0
	for resultErr := range results {
		switch {
		case resultErr == nil:
			successes++
		case resultErr == ErrOAuthStateGrantInvalid:
			replays++
		default:
			assert.Failf(t, "unexpected OAuth state claim error", "%v", resultErr)
		}
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, claimCount-1, replays)
}

func TestOAuthStateGrantConcurrentClaimMySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL OAuth state concurrency test")
	}
	runExternalOAuthStateGrantConcurrencyTest(t, common.DatabaseTypeMySQL, dsn)
}

func TestOAuthStateGrantConcurrentClaimPostgreSQL(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL OAuth state concurrency test")
	}
	runExternalOAuthStateGrantConcurrencyTest(t, common.DatabaseTypePostgreSQL, dsn)
}
