package model

import (
	"errors"
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

func setupAuthIdentityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := DB
	oldDatabaseType := common.MainDatabaseType()
	databasePath := filepath.Join(t.TempDir(), fmt.Sprintf("auth_identity_%d.db", time.Now().UnixNano()))
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(30000)&_txlock=immediate", filepath.ToSlash(databasePath))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &AuthIdentity{}))
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

func createAuthIdentityTestUser(t *testing.T, db *gorm.DB, username string) User {
	t.Helper()
	user := User{Username: username, Password: "password", AffCode: username}
	require.NoError(t, db.Create(&user).Error)
	return user
}

func TestAuthIdentityEnforcesProviderSubjectOwnership(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	first := createAuthIdentityTestUser(t, db, "identity-first")
	second := createAuthIdentityTestUser(t, db, "identity-second")

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return CreateAuthIdentityWithTx(tx, first.Id, "GitHub", "subject-1")
	}))
	err := DB.Transaction(func(tx *gorm.DB) error {
		return CreateAuthIdentityWithTx(tx, second.Id, "github", "subject-1")
	})
	require.ErrorIs(t, err, ErrAuthIdentityAlreadyBound)

	boundUser, err := GetUserByAuthIdentity("GITHUB", "subject-1")
	require.NoError(t, err)
	assert.Equal(t, first.Id, boundUser.Id)
}

func TestAuthIdentityProviderSubjectComparisonIsCaseSensitive(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	first := createAuthIdentityTestUser(t, db, "identity-case-first")
	second := createAuthIdentityTestUser(t, db, "identity-case-second")

	require.NoError(t, EnsureAuthIdentity(first.Id, AuthIdentityProviderOIDC, "Case-Sensitive-Subject"))
	require.NoError(t, EnsureAuthIdentity(second.Id, AuthIdentityProviderOIDC, "case-sensitive-subject"))
	var storedIdentity AuthIdentity
	require.NoError(t, db.Where("user_id = ? AND provider_key = ?", first.Id, AuthIdentityProviderOIDC).Take(&storedIdentity).Error)
	assert.Len(t, storedIdentity.ProviderSubjectHash, 64)
	assert.NotEqual(t, "Case-Sensitive-Subject", storedIdentity.ProviderSubjectHash)

	firstOwner, err := GetUserByAuthIdentity(AuthIdentityProviderOIDC, "Case-Sensitive-Subject")
	require.NoError(t, err)
	secondOwner, err := GetUserByAuthIdentity(AuthIdentityProviderOIDC, "case-sensitive-subject")
	require.NoError(t, err)
	assert.Equal(t, first.Id, firstOwner.Id)
	assert.Equal(t, second.Id, secondOwner.Id)
}

func TestAuthIdentityRebindRollsBackWhenSubjectBelongsToAnotherUser(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	first := createAuthIdentityTestUser(t, db, "rebind-first")
	second := createAuthIdentityTestUser(t, db, "rebind-second")
	require.NoError(t, EnsureAuthIdentity(first.Id, AuthIdentityProviderOIDC, "first-subject"))
	require.NoError(t, EnsureAuthIdentity(second.Id, AuthIdentityProviderOIDC, "second-subject"))

	err := DB.Transaction(func(tx *gorm.DB) error {
		return SetAuthIdentityWithTx(tx, first.Id, AuthIdentityProviderOIDC, "second-subject")
	})
	require.ErrorIs(t, err, ErrAuthIdentityAlreadyBound)

	boundUser, err := GetUserByAuthIdentity(AuthIdentityProviderOIDC, "first-subject")
	require.NoError(t, err)
	assert.Equal(t, first.Id, boundUser.Id)
}

func TestAuthIdentityConcurrentClaimHasExactlyOneOwner(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	const userCount = 12
	users := make([]User, 0, userCount)
	for index := 0; index < userCount; index++ {
		users = append(users, createAuthIdentityTestUser(t, db, fmt.Sprintf("identity-race-%d", index)))
	}

	start := make(chan struct{})
	results := make(chan error, userCount)
	var waitGroup sync.WaitGroup
	for _, user := range users {
		user := user
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			results <- DB.Transaction(func(tx *gorm.DB) error {
				return CreateAuthIdentityWithTx(tx, user.Id, AuthIdentityProviderDiscord, "shared-subject")
			})
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	successes := 0
	conflicts := 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrAuthIdentityAlreadyBound):
			conflicts++
		default:
			assert.Failf(t, "unexpected identity error", "%v", err)
		}
		assert.False(t, IsSQLiteBusyError(err), "SQLite lock error leaked from identity claim: %v", err)
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, userCount-1, conflicts)

	caseFirst := createAuthIdentityTestUser(t, db, "external-case-first")
	caseSecond := createAuthIdentityTestUser(t, db, "external-case-second")
	require.NoError(t, EnsureAuthIdentity(caseFirst.Id, AuthIdentityProviderOIDC, "Case-Sensitive-Subject"))
	require.NoError(t, EnsureAuthIdentity(caseSecond.Id, AuthIdentityProviderOIDC, "case-sensitive-subject"))
	firstOwner, err := GetUserByAuthIdentity(AuthIdentityProviderOIDC, "Case-Sensitive-Subject")
	require.NoError(t, err)
	secondOwner, err := GetUserByAuthIdentity(AuthIdentityProviderOIDC, "case-sensitive-subject")
	require.NoError(t, err)
	assert.Equal(t, caseFirst.Id, firstOwner.Id)
	assert.Equal(t, caseSecond.Id, secondOwner.Id)
}

func TestBackfillBuiltInAuthIdentitiesRejectsAmbiguousLegacyOwnership(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	first := createAuthIdentityTestUser(t, db, "legacy-first")
	second := createAuthIdentityTestUser(t, db, "legacy-second")
	require.NoError(t, db.Model(&User{}).Where("id IN ?", []int{first.Id, second.Id}).Update("github_id", "duplicate-legacy-id").Error)

	err := backfillBuiltInAuthIdentities()
	require.ErrorIs(t, err, ErrAuthIdentityAlreadyBound)
}

func runExternalAuthIdentityConcurrencyTest(t *testing.T, databaseType common.DatabaseType, dsn string) {
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
	if db.Migrator().HasTable(&User{}) || db.Migrator().HasTable(&AuthIdentity{}) {
		require.NoError(t, sqlDB.Close())
		t.Skipf("refusing to run auth identity concurrency test because %s test tables already exist", databaseType)
	}
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	t.Cleanup(func() {
		if db.Migrator().HasTable(&AuthIdentity{}) {
			require.NoError(t, db.Migrator().DropTable(&AuthIdentity{}))
		}
		if db.Migrator().HasTable(&User{}) {
			require.NoError(t, db.Migrator().DropTable(&User{}))
		}
	})
	useInvitationConcurrencyDB(t, db, databaseType)
	require.NoError(t, db.AutoMigrate(&User{}, &AuthIdentity{}))

	const userCount = 12
	users := make([]User, 0, userCount)
	for index := 0; index < userCount; index++ {
		users = append(users, createAuthIdentityTestUser(t, db, fmt.Sprintf("external-identity-%d", index)))
	}
	start := make(chan struct{})
	results := make(chan error, userCount)
	var waitGroup sync.WaitGroup
	for _, user := range users {
		user := user
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			results <- db.Transaction(func(tx *gorm.DB) error {
				return CreateAuthIdentityWithTx(tx, user.Id, AuthIdentityProviderGitHub, "external-shared-subject")
			})
		}()
	}
	close(start)
	waitGroup.Wait()
	close(results)

	successes := 0
	conflicts := 0
	for resultErr := range results {
		switch {
		case resultErr == nil:
			successes++
		case errors.Is(resultErr, ErrAuthIdentityAlreadyBound):
			conflicts++
		default:
			assert.Failf(t, "unexpected identity error", "%v", resultErr)
		}
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, userCount-1, conflicts)
}

func TestAuthIdentityConcurrentClaimMySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL auth identity concurrency test")
	}
	runExternalAuthIdentityConcurrencyTest(t, common.DatabaseTypeMySQL, dsn)
}

func TestAuthIdentityConcurrentClaimPostgreSQL(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL auth identity concurrency test")
	}
	runExternalAuthIdentityConcurrencyTest(t, common.DatabaseTypePostgreSQL, dsn)
}
