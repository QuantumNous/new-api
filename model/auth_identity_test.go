package model

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
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

func TestCustomOAuthProviderKeysIsolateConfigurationIDs(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	first := createAuthIdentityTestUser(t, db, "custom-provider-first")
	second := createAuthIdentityTestUser(t, db, "custom-provider-second")
	firstKey, err := AuthIdentityProviderKeyForCustomOAuth(77)
	require.NoError(t, err)
	secondKey, err := AuthIdentityProviderKeyForCustomOAuth(78)
	require.NoError(t, err)
	assert.NotEqual(t, firstKey, secondKey)
	require.NoError(t, EnsureAuthIdentity(first.Id, firstKey, "shared-custom-subject"))
	require.NoError(t, EnsureAuthIdentity(second.Id, secondKey, "shared-custom-subject"))

	firstOwner, err := GetUserByAuthIdentity(firstKey, "shared-custom-subject")
	require.NoError(t, err)
	secondOwner, err := GetUserByAuthIdentity(secondKey, "shared-custom-subject")
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

func TestBackfillBuiltInAuthIdentitiesSkipsKnownConflictsAndContinuesAcrossBatches(t *testing.T) {
	db := setupAuthIdentityTestDB(t)

	users := make([]User, authIdentityBackfillBatchSize+4)
	for index := range users {
		legacySubject := fmt.Sprintf("legacy-conflict-%d", index)
		switch index {
		case authIdentityBackfillBatchSize, authIdentityBackfillBatchSize + 2:
			legacySubject = "shared-legacy-subject"
		case authIdentityBackfillBatchSize + 1:
			legacySubject = "soft-deleted-subject"
		case authIdentityBackfillBatchSize + 3:
			legacySubject = "after-conflict-subject"
		}
		users[index] = User{
			Username: fmt.Sprintf("legacy-backfill-%d", index),
			Password: "password",
			AffCode:  fmt.Sprintf("legacy-backfill-%d", index),
			GitHubId: legacySubject,
		}
	}
	require.NoError(t, db.Select("username", "password", "aff_code", "github_id").CreateInBatches(&users, 50).Error)

	preboundIdentities := make([]AuthIdentity, authIdentityBackfillBatchSize)
	for index := range preboundIdentities {
		preboundIdentities[index] = AuthIdentity{
			UserId:              users[index].Id,
			ProviderKey:         AuthIdentityProviderGitHub,
			ProviderSubjectHash: hashAuthIdentitySubject(fmt.Sprintf("prebound-subject-%d", index)),
		}
	}
	require.NoError(t, db.CreateInBatches(&preboundIdentities, 50).Error)

	softDeletedUser := users[authIdentityBackfillBatchSize+1]
	require.NoError(t, db.Delete(&softDeletedUser).Error)

	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	oldDefaultWriter := gin.DefaultWriter
	gin.DefaultWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = oldDefaultWriter
		common.LogWriterMu.Unlock()
	})

	require.NoError(t, backfillBuiltInAuthIdentities())

	var identityCount int64
	require.NoError(t, db.Model(&AuthIdentity{}).Count(&identityCount).Error)
	assert.Equal(t, int64(authIdentityBackfillBatchSize+3), identityCount)

	sharedSubjectWinner, err := GetUserByAuthIdentity(AuthIdentityProviderGitHub, "shared-legacy-subject")
	require.NoError(t, err)
	assert.Equal(t, users[authIdentityBackfillBatchSize].Id, sharedSubjectWinner.Id)
	assert.Less(t, users[authIdentityBackfillBatchSize].Id, users[authIdentityBackfillBatchSize+2].Id)

	var duplicateUserIdentityCount int64
	require.NoError(t, db.Model(&AuthIdentity{}).
		Where("user_id = ? AND provider_key = ?", users[authIdentityBackfillBatchSize+2].Id, AuthIdentityProviderGitHub).
		Count(&duplicateUserIdentityCount).Error)
	assert.Zero(t, duplicateUserIdentityCount)

	softDeletedOwner, err := GetUserByAuthIdentity(AuthIdentityProviderGitHub, "soft-deleted-subject")
	require.NoError(t, err)
	assert.Equal(t, softDeletedUser.Id, softDeletedOwner.Id)
	assert.True(t, softDeletedOwner.DeletedAt.Valid)

	afterConflictOwner, err := GetUserByAuthIdentity(AuthIdentityProviderGitHub, "after-conflict-subject")
	require.NoError(t, err)
	assert.Equal(t, users[authIdentityBackfillBatchSize+3].Id, afterConflictOwner.Id)

	preboundOwner, err := GetUserByAuthIdentity(AuthIdentityProviderGitHub, "prebound-subject-0")
	require.NoError(t, err)
	assert.Equal(t, users[0].Id, preboundOwner.Id)
	_, err = GetUserByAuthIdentity(AuthIdentityProviderGitHub, "legacy-conflict-0")
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)

	require.NoError(t, backfillBuiltInAuthIdentities())
	var identityCountAfterSecondRun int64
	require.NoError(t, db.Model(&AuthIdentity{}).Count(&identityCountAfterSecondRun).Error)
	assert.Equal(t, identityCount, identityCountAfterSecondRun)

	assert.Contains(t, logOutput.String(), "skipped 500 known conflicts")
	assert.NotContains(t, logOutput.String(), "legacy-conflict-")
	assert.NotContains(t, logOutput.String(), "shared-legacy-subject")
	assert.NotContains(t, logOutput.String(), "soft-deleted-subject")
	assert.NotContains(t, logOutput.String(), "after-conflict-subject")
}

func TestBackfillBuiltInAuthIdentitiesReturnsUnexpectedDatabaseErrors(t *testing.T) {
	db := setupAuthIdentityTestDB(t)
	user := createAuthIdentityTestUser(t, db, "legacy-fatal-error")
	require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("github_id", "fatal-error-subject").Error)
	require.NoError(t, db.Migrator().DropTable(&AuthIdentity{}))

	err := backfillBuiltInAuthIdentities()
	require.Error(t, err)
	assert.NotErrorIs(t, err, ErrAuthIdentityAlreadyBound)
	assert.NotErrorIs(t, err, ErrAuthIdentityProviderAlreadyBound)
	assert.Contains(t, err.Error(), "cannot backfill github identity")
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

// TestAuthIdentityPostgreSQLConflictKeepsTransactionUsable proves that a unique
// AuthIdentity conflict resolved via ON CONFLICT DO NOTHING returns the known
// sentinel ErrAuthIdentityAlreadyBound without aborting the PostgreSQL
// transaction, so later queries/writes in the same transaction still succeed.
func TestAuthIdentityPostgreSQLConflictKeepsTransactionUsable(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL auth identity transaction usability test")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	if db.Migrator().HasTable(&User{}) || db.Migrator().HasTable(&AuthIdentity{}) {
		require.NoError(t, sqlDB.Close())
		t.Skip("refusing to run PostgreSQL auth identity transaction test because test tables already exist")
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

	useInvitationConcurrencyDB(t, db, common.DatabaseTypePostgreSQL)
	require.NoError(t, db.AutoMigrate(&User{}, &AuthIdentity{}))

	owner := createAuthIdentityTestUser(t, db, "pg-tx-owner")
	challenger := createAuthIdentityTestUser(t, db, "pg-tx-challenger")
	const subject = "pg-tx-shared-subject"
	require.NoError(t, EnsureAuthIdentity(owner.Id, AuthIdentityProviderGitHub, subject))

	var postConflictOwnerID int
	err = db.Transaction(func(tx *gorm.DB) error {
		claimErr := CreateAuthIdentityWithTx(tx, challenger.Id, AuthIdentityProviderGitHub, subject)
		if !errors.Is(claimErr, ErrAuthIdentityAlreadyBound) {
			return fmt.Errorf("expected ErrAuthIdentityAlreadyBound, got %w", claimErr)
		}
		// Same transaction must remain usable after the sentinel conflict.
		bound := &AuthIdentity{}
		if takeErr := tx.Where(
			"provider_key = ? AND provider_subject = ?",
			AuthIdentityProviderGitHub,
			hashAuthIdentitySubject(subject),
		).Take(bound).Error; takeErr != nil {
			return fmt.Errorf("post-conflict read failed (transaction aborted?): %w", takeErr)
		}
		postConflictOwnerID = bound.UserId
		// A follow-up write in the same transaction must also succeed.
		if saveErr := tx.Model(&User{}).
			Where("id = ?", challenger.Id).
			Update("display_name", "pg-tx-challenger-ok").Error; saveErr != nil {
			return fmt.Errorf("post-conflict write failed (transaction aborted?): %w", saveErr)
		}
		return nil
	})
	require.NoError(t, err, "transaction must commit after AuthIdentity conflict sentinel")
	assert.Equal(t, owner.Id, postConflictOwnerID)

	var displayName string
	require.NoError(t, db.Model(&User{}).Select("display_name").Where("id = ?", challenger.Id).Scan(&displayName).Error)
	assert.Equal(t, "pg-tx-challenger-ok", displayName)
}
