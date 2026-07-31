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

func TestBytePlusRealPersonSessionCASOnlyCurrentActivatesProfile(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{PublicId: "rph_cas", UserId: 7, Name: "A", ChannelId: 101, Status: BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&profile).Error)
	oldSession := BytePlusVisualValidationSession{PublicId: "rvs_old", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64), Status: BytePlusVisualValidationSessionStatusPending, CreatedTime: 100, UpdatedTime: 100}
	newSession := BytePlusVisualValidationSession{PublicId: "rvs_new", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("b", 64), Status: BytePlusVisualValidationSessionStatusPending, CreatedTime: 101, UpdatedTime: 101}
	require.NoError(t, DB.Create(&oldSession).Error)
	require.NoError(t, DB.Create(&newSession).Error)
	require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", newSession.Id).Error)

	ok, err := ActivateBytePlusRealPersonProfile(profile.Id, oldSession.Id, "group-old", 200)
	require.NoError(t, err)
	require.False(t, ok)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusPendingVerification, profile.Status)
	require.Nil(t, profile.UpstreamGroupId)

	ok, err = ActivateBytePlusRealPersonProfile(profile.Id, newSession.Id, " group-new ", 201)
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusActive, profile.Status)
	require.NotNil(t, profile.UpstreamGroupId)
	require.Equal(t, "group-new", *profile.UpstreamGroupId)
	require.NoError(t, DB.First(&newSession, newSession.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusSucceeded, newSession.Status)
}

func TestBytePlusRealPersonSessionCASClaimLeaseIsExclusiveAndTerminalDoesNotRegress(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	session := BytePlusVisualValidationSession{PublicId: "rvs_claim", ProfileId: 1, CallbackTokenHash: strings.Repeat("c", 64), Status: BytePlusVisualValidationSessionStatusPending, LeaseUpdatedTime: 10, CreatedTime: 10, UpdatedTime: 10}
	require.NoError(t, DB.Create(&session).Error)

	claimed, owner, err := ClaimBytePlusVisualValidationSession(session.Id, 100, 50)
	require.NoError(t, err)
	require.True(t, owner)
	require.Equal(t, BytePlusVisualValidationSessionStatusChecking, claimed.Status)

	_, owner, err = ClaimBytePlusVisualValidationSession(session.Id, 101, 50)
	require.NoError(t, err)
	require.False(t, owner)

	require.NoError(t, DB.Model(&BytePlusVisualValidationSession{}).Where("id = ?", session.Id).Updates(map[string]any{
		"status":       BytePlusVisualValidationSessionStatusSucceeded,
		"updated_time": int64(102),
	}).Error)
	require.Error(t, CompleteBytePlusVisualValidationSession(session.Id, "byted", "h5", "req-late", 500, 103))
	require.NoError(t, DB.First(&session, session.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusSucceeded, session.Status)
	require.Empty(t, session.BytedTokenCiphertext)
}

func TestBytePlusRealPersonPendingSessionClaimHonorsRetryBackoff(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	session := BytePlusVisualValidationSession{PublicId: "rvs_claim_backoff", ProfileId: 1, CallbackTokenHash: strings.Repeat("c", 64), Status: BytePlusVisualValidationSessionStatusPending, LeaseUpdatedTime: 0, CreatedTime: 10, UpdatedTime: 2060}
	require.NoError(t, DB.Create(&session).Error)

	claimed, owner, err := ClaimBytePlusVisualValidationSession(session.Id, 2000, 1900)
	require.NoError(t, err)
	require.False(t, owner)
	require.Equal(t, BytePlusVisualValidationSessionStatusPending, claimed.Status)
	require.Equal(t, int64(2060), claimed.UpdatedTime)

	claimed, owner, err = ClaimBytePlusVisualValidationSession(session.Id, 2060, 1960)
	require.NoError(t, err)
	require.True(t, owner)
	require.Equal(t, BytePlusVisualValidationSessionStatusChecking, claimed.Status)
	require.Equal(t, int64(2060), claimed.LeaseUpdatedTime)
}

func TestBytePlusRealPersonSessionCASActivateRollsBackProfileWhenSessionTerminal(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{PublicId: "rph_activate_terminal", UserId: 7, Name: "A", ChannelId: 101, Status: BytePlusRealPersonProfileStatusVerifying, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&profile).Error)
	session := BytePlusVisualValidationSession{PublicId: "rvs_activate_terminal", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("1", 64), Status: BytePlusVisualValidationSessionStatusFailed, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&session).Error)
	require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)

	changed, err := ActivateBytePlusRealPersonProfile(profile.Id, session.Id, "group-late", 200)
	require.ErrorIs(t, err, ErrAPIIdempotencyCASLost)
	require.False(t, changed)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusVerifying, profile.Status)
	require.Nil(t, profile.UpstreamGroupId)
	require.NoError(t, DB.First(&session, session.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusFailed, session.Status)
}

func TestBytePlusRealPersonSessionCASFailAndExpireRollbackProfileWhenSessionTerminal(t *testing.T) {
	for _, tc := range []struct {
		name       string
		transition func(profileID, sessionID int64, now int64) (bool, error)
	}{
		{name: "fail", transition: func(profileID, sessionID int64, now int64) (bool, error) {
			return FailBytePlusRealPersonSession(profileID, sessionID, "upstream_failed", now)
		}},
		{name: "expire", transition: func(profileID, sessionID int64, now int64) (bool, error) {
			return ExpireBytePlusRealPersonSession(profileID, sessionID, now)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			newBytePlusRealPersonTestDB(t)
			profile := BytePlusRealPersonProfile{PublicId: "rph_" + tc.name + "_terminal", UserId: 7, Name: "A", ChannelId: 101, Status: BytePlusRealPersonProfileStatusVerifying, CreatedTime: 100, UpdatedTime: 100}
			require.NoError(t, DB.Create(&profile).Error)
			session := BytePlusVisualValidationSession{PublicId: "rvs_" + tc.name + "_terminal", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("2", 64), Status: BytePlusVisualValidationSessionStatusSucceeded, CreatedTime: 100, UpdatedTime: 100}
			require.NoError(t, DB.Create(&session).Error)
			require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)

			changed, err := tc.transition(profile.Id, session.Id, 200)
			require.ErrorIs(t, err, ErrAPIIdempotencyCASLost)
			require.False(t, changed)
			require.NoError(t, DB.First(&profile, profile.Id).Error)
			require.Equal(t, BytePlusRealPersonProfileStatusVerifying, profile.Status)
			require.Empty(t, profile.ErrorCode)
			require.NoError(t, DB.First(&session, session.Id).Error)
			require.Equal(t, BytePlusVisualValidationSessionStatusSucceeded, session.Status)
		})
	}
}

func TestBytePlusRealPersonSessionCASOldSessionCanFailWithoutChangingCurrentProfile(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	originalErrorCode := "current_error"
	profile := BytePlusRealPersonProfile{PublicId: "rph_old_fail", UserId: 7, Name: "A", ChannelId: 101, Status: BytePlusRealPersonProfileStatusVerifying, ErrorCode: originalErrorCode, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&profile).Error)
	oldSession := BytePlusVisualValidationSession{PublicId: "rvs_old_fail", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("3", 64), CallbackTokenCiphertext: "callback-old", BytedTokenCiphertext: "byted-old", H5LinkCiphertext: "h5-old", Status: BytePlusVisualValidationSessionStatusChecking, CreatedTime: 100, UpdatedTime: 100}
	newSession := BytePlusVisualValidationSession{PublicId: "rvs_new_fail", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("4", 64), Status: BytePlusVisualValidationSessionStatusPending, CreatedTime: 101, UpdatedTime: 101}
	require.NoError(t, DB.Create(&oldSession).Error)
	require.NoError(t, DB.Create(&newSession).Error)
	require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", newSession.Id).Error)

	changed, err := FailBytePlusRealPersonSession(profile.Id, oldSession.Id, "old_failed", 200)
	require.NoError(t, err)
	require.False(t, changed)
	require.NoError(t, DB.First(&oldSession, oldSession.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusFailed, oldSession.Status)
	require.Empty(t, oldSession.CallbackTokenCiphertext)
	require.Empty(t, oldSession.BytedTokenCiphertext)
	require.Empty(t, oldSession.H5LinkCiphertext)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusVerifying, profile.Status)
	require.Equal(t, originalErrorCode, profile.ErrorCode)
	require.NotNil(t, profile.CurrentValidationSessionId)
	require.Equal(t, newSession.Id, *profile.CurrentValidationSessionId)
}

func TestBytePlusRealPersonListUsesUserScopedStableCursor(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	insertProfile := func(publicID string, userID int, created int64) {
		require.NoError(t, DB.Create(&BytePlusRealPersonProfile{
			PublicId: publicID, UserId: userID, Name: publicID, ChannelId: 101,
			Status: BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: created, UpdatedTime: created,
		}).Error)
	}
	insertProfile("rph_newer", 7, 300)
	insertProfile("rph_tie_low", 7, 200)
	insertProfile("rph_tie_high", 7, 200)
	insertProfile("rph_other", 8, 400)

	first, hasMore, err := ListBytePlusRealPersonProfilesForUser(7, 2, "")
	require.NoError(t, err)
	require.True(t, hasMore)
	require.Equal(t, []string{"rph_newer", "rph_tie_high"}, profilePublicIDs(first))

	second, hasMore, err := ListBytePlusRealPersonProfilesForUser(7, 2, "rph_tie_high")
	require.NoError(t, err)
	require.False(t, hasMore)
	require.Equal(t, []string{"rph_tie_low"}, profilePublicIDs(second))
}

func TestBytePlusRealPersonCreateBindCASRollbackLeavesNoProfileOrSession(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{UserId: 7, Route: "real_person_create", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceVerificationSession, LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&record).Error)

	_, _, err := CreateBytePlusRealPersonProfileAndSessionForIdempotency(record.Id, 99,
		BytePlusRealPersonProfile{PublicId: "rph_rollback", UserId: 7, Name: "Alice", ChannelId: 101, Status: BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100},
		BytePlusVisualValidationSession{PublicId: "rvs_rollback", CallbackTokenHash: strings.Repeat("c", 64), Status: BytePlusVisualValidationSessionStatusCreating, CreatedTime: 100, UpdatedTime: 100},
		101,
	)
	require.ErrorIs(t, err, ErrAPIIdempotencyCASLost)
	var profileCount int64
	require.NoError(t, DB.Model(&BytePlusRealPersonProfile{}).Count(&profileCount).Error)
	require.Equal(t, int64(0), profileCount)
	var sessionCount int64
	require.NoError(t, DB.Model(&BytePlusVisualValidationSession{}).Count(&sessionCount).Error)
	require.Equal(t, int64(0), sessionCount)
}

func TestBytePlusRealPersonVerificationCompleteSessionCASRejectsTerminalOverwrite(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	session := BytePlusVisualValidationSession{PublicId: "rvs_terminal", ProfileId: 1, CallbackTokenHash: strings.Repeat("d", 64), Status: BytePlusVisualValidationSessionStatusFailed, CreatedTime: 100, UpdatedTime: 100}
	require.NoError(t, DB.Create(&session).Error)

	err := CompleteBytePlusVisualValidationSession(session.Id, "byted", "h5", "req", 500, 200)
	require.Error(t, err)
	require.NoError(t, DB.First(&session, session.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusFailed, session.Status)
	require.Empty(t, session.BytedTokenCiphertext)
	require.Empty(t, session.H5LinkCiphertext)
}

func TestBytePlusRealPersonVerificationOutcomeUnknownCanFailOldSessionWithoutRewritingCurrentProfile(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	originalErrorCode := "original_error"
	profile := BytePlusRealPersonProfile{
		PublicId: "rph_outcome_unknown", UserId: 7, Name: "A", ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusVerifying, ErrorCode: originalErrorCode,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&profile).Error)
	oldSession := BytePlusVisualValidationSession{
		PublicId: "rvs_outcome_old", ProfileId: profile.Id,
		CallbackTokenHash: strings.Repeat("e", 64), CallbackTokenCiphertext: "callback-old",
		BytedTokenCiphertext: "byted-old", H5LinkCiphertext: "h5-old",
		Status: BytePlusVisualValidationSessionStatusCreating, CreatedTime: 100, UpdatedTime: 100,
	}
	newSession := BytePlusVisualValidationSession{
		PublicId: "rvs_outcome_new", ProfileId: profile.Id,
		CallbackTokenHash: strings.Repeat("f", 64),
		Status:            BytePlusVisualValidationSessionStatusPending, CreatedTime: 101, UpdatedTime: 101,
	}
	require.NoError(t, DB.Create(&oldSession).Error)
	require.NoError(t, DB.Create(&newSession).Error)
	require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", newSession.Id).Error)
	record := APIIdempotencyRecord{
		UserId: 7, Route: "real_person_reverify", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64),
		Status: APIIdempotencyStatusCallingUpstream, ResourceType: APIIdempotencyResourceVerificationSession, ResourcePublicId: oldSession.PublicId,
		LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&record).Error)

	require.NoError(t, MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, 100, profile.Id, oldSession.Id, "verification_outcome_unknown", 200))

	require.NoError(t, DB.First(&record, record.Id).Error)
	require.Equal(t, APIIdempotencyStatusOutcomeUnknown, record.Status)
	require.NoError(t, DB.First(&oldSession, oldSession.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusFailed, oldSession.Status)
	require.Empty(t, oldSession.CallbackTokenCiphertext)
	require.Empty(t, oldSession.BytedTokenCiphertext)
	require.Empty(t, oldSession.H5LinkCiphertext)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusVerifying, profile.Status)
	require.Equal(t, originalErrorCode, profile.ErrorCode)
	require.NotNil(t, profile.CurrentValidationSessionId)
	require.Equal(t, newSession.Id, *profile.CurrentValidationSessionId)
}

func TestBytePlusRealPersonVerificationOutcomeUnknownLedgerSurvivesLocalCASLoss(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{
		PublicId: "rph_outcome_terminal", UserId: 7, Name: "A", ChannelId: 101,
		Status: BytePlusRealPersonProfileStatusVerifying, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&profile).Error)
	session := BytePlusVisualValidationSession{
		PublicId: "rvs_outcome_terminal", ProfileId: profile.Id,
		CallbackTokenHash: strings.Repeat("5", 64), Status: BytePlusVisualValidationSessionStatusSucceeded,
		CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&session).Error)
	require.NoError(t, DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)
	record := APIIdempotencyRecord{
		UserId: 7, Route: "real_person_reverify", KeyHash: strings.Repeat("c", 64), RequestHash: strings.Repeat("d", 64),
		Status: APIIdempotencyStatusCallingUpstream, ResourceType: APIIdempotencyResourceVerificationSession, ResourcePublicId: session.PublicId,
		LeaseUpdatedTime: 100, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, DB.Create(&record).Error)

	err := MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(record.Id, 100, profile.Id, session.Id, "verification_outcome_unknown", 200)
	require.ErrorIs(t, err, ErrAPIIdempotencyCASLost)
	require.NoError(t, DB.First(&record, record.Id).Error)
	require.Equal(t, APIIdempotencyStatusOutcomeUnknown, record.Status)
	require.NoError(t, DB.First(&profile, profile.Id).Error)
	require.Equal(t, BytePlusRealPersonProfileStatusVerifying, profile.Status)
	require.NoError(t, DB.First(&session, session.Id).Error)
	require.Equal(t, BytePlusVisualValidationSessionStatusSucceeded, session.Status)
}

func TestBytePlusRealPersonSessionTerminalTransitionsUseOneOrderedHelper(t *testing.T) {
	source, err := os.ReadFile("byteplus_real_person.go")
	require.NoError(t, err)
	text := string(source)
	for _, functionName := range []string{"ActivateBytePlusRealPersonProfile", "FailBytePlusRealPersonSession", "ExpireBytePlusRealPersonSession"} {
		functionStart := strings.Index(text, "func "+functionName)
		require.NotEqual(t, -1, functionStart, functionName)
		nextFunction := strings.Index(text[functionStart+len("func "):], "\nfunc ")
		require.NotEqual(t, -1, nextFunction, functionName)
		body := text[functionStart : functionStart+len("func ")+nextFunction]
		require.Contains(t, body, "transitionBytePlusRealPersonSessionTerminal(", functionName)
	}
	helperStart := strings.Index(text, "func transitionBytePlusRealPersonSessionTerminal")
	require.NotEqual(t, -1, helperStart)
	helperEnd := strings.Index(text[helperStart+len("func "):], "\nfunc ")
	require.NotEqual(t, -1, helperEnd)
	helper := text[helperStart : helperStart+len("func ")+helperEnd]
	require.Less(t, strings.Index(helper, "updatedProfile :="), strings.Index(helper, "updatedSession :="))
	require.Contains(t, helper, "requireOneRealPersonCAS(updatedProfile)")
	require.Contains(t, helper, "requireOneRealPersonCAS(updatedSession)")
}

func profilePublicIDs(profiles []BytePlusRealPersonProfile) []string {
	ids := make([]string, 0, len(profiles))
	for _, profile := range profiles {
		ids = append(ids, profile.PublicId)
	}
	return ids
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
