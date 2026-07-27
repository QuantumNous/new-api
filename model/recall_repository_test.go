package model

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func setupRecallRepositoryTestDB(t *testing.T) (*gorm.DB, *gorm.DB) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	mainDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	mainSQLDB, err := mainDB.DB()
	require.NoError(t, err)
	mainSQLDB.SetMaxOpenConns(1)
	logDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	logSQLDB, err := logDB.DB()
	require.NoError(t, err)
	logSQLDB.SetMaxOpenConns(1)
	DB = mainDB
	LOG_DB = logDB
	t.Cleanup(func() {
		_ = mainSQLDB.Close()
		_ = logSQLDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
	})

	require.NoError(t, DB.AutoMigrate(
		&User{},
		&RecallCampaign{},
		&RecallRecipient{},
		&RecallMessage{},
		&RecallEvent{},
	))
	return mainDB, logDB
}

func setupRecallRepositoryFileDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/recall.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	DB = db
	LOG_DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
	})

	require.NoError(t, DB.AutoMigrate(
		&RecallCampaign{},
		&RecallRecipient{},
		&RecallMessage{},
		&RecallEvent{},
	))
	return db
}

func newRecallRepositoryCampaign(name string) RecallCampaign {
	return RecallCampaign{
		Name:                name,
		Status:              RecallCampaignDraft,
		AudienceTemplate:    "inactive_users",
		AudienceConfig:      `{}`,
		ExecutionMode:       "manual",
		CouponSource:        "stripe",
		DiscountConfig:      `{}`,
		ProductScope:        `[]`,
		EmailSequenceConfig: `[]`,
	}
}

func TestRecallCampaignTypeDefaultsAndBackfill(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	legacy := newRecallRepositoryCampaign("legacy campaign type")
	legacy.CampaignType = ""
	require.NoError(t, CreateRecallCampaign(&legacy))
	require.Equal(t, RecallCampaignTypePromotion, legacy.CampaignType)

	explicit := newRecallRepositoryCampaign("content only campaign type")
	explicit.CampaignType = RecallCampaignTypeContentOnly
	require.NoError(t, CreateRecallCampaign(&explicit))
	storedExplicit, err := GetRecallCampaignByID(explicit.Id)
	require.NoError(t, err)
	require.Equal(t, RecallCampaignTypeContentOnly, storedExplicit.CampaignType)

	require.NoError(t, DB.Model(&RecallCampaign{}).
		Where("id = ?", legacy.Id).
		Update("campaign_type", "").Error)
	require.NoError(t, migrateRecallCampaignTypes())
	require.NoError(t, migrateRecallCampaignTypes())

	storedLegacy, err := GetRecallCampaignByID(legacy.Id)
	require.NoError(t, err)
	require.Equal(t, RecallCampaignTypePromotion, storedLegacy.CampaignType)
}

func TestRecallCampaignDraftUpdatePersistsCampaignType(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("draft campaign type")
	require.NoError(t, CreateRecallCampaign(&campaign))
	campaign.CampaignType = RecallCampaignTypeContentOnly

	won, err := UpdateRecallCampaignDraftWithContext(context.Background(), &campaign)
	require.NoError(t, err)
	require.True(t, won)

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, RecallCampaignTypeContentOnly, stored.CampaignType)
}

func TestRecallCampaignDraftUpdateDefaultsEmptyCampaignTypeToPromotion(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("draft campaign type default")
	require.NoError(t, CreateRecallCampaign(&campaign))
	campaign.CampaignType = ""

	won, err := UpdateRecallCampaignDraftWithContext(context.Background(), &campaign)
	require.NoError(t, err)
	require.True(t, won)

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, RecallCampaignTypePromotion, stored.CampaignType)
}

func createRecallRepositoryCandidateUser(t *testing.T, suffix string, createdAt int64, requestCount int) User {
	t.Helper()
	user := User{
		Username:        "recall_candidate_" + suffix,
		AffCode:         "recall_candidate_aff_" + suffix,
		Password:        "hashed-password",
		Status:          common.UserStatusEnabled,
		Email:           suffix + "@example.com",
		EmailVerifiedAt: createdAt,
		RequestCount:    requestCount,
		CreatedAt:       createdAt,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func recallRepositoryUserIDs(facts []RecallCandidateFact) []int {
	ids := make([]int, len(facts))
	for i := range facts {
		ids[i] = facts[i].User.Id
	}
	return ids
}

func requireRecallRunTablesEmpty(t *testing.T) {
	t.Helper()

	for _, table := range []any{&RecallRecipient{}, &RecallMessage{}, &RecallEvent{}} {
		var count int64
		require.NoError(t, DB.Model(table).Count(&count).Error)
		require.Zero(t, count)
	}
}

func TestListRecallCandidateFactsNewAudiencePredicates(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}, &UserSubscription{}))

	const startAt int64 = 1_000
	const endAt int64 = 2_000
	before := createRecallRepositoryCandidateUser(t, "registered_before", startAt-1, 0)
	start := createRecallRepositoryCandidateUser(t, "registered_start", startAt, 0)
	end := createRecallRepositoryCandidateUser(t, "registered_end", endAt, 0)
	after := createRecallRepositoryCandidateUser(t, "registered_after", endAt+1, 0)
	used := createRecallRepositoryCandidateUser(t, "registered_used", startAt+100, 1)
	paid := createRecallRepositoryCandidateUser(t, "registered_paid", startAt+200, 0)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId:          paid.Id,
		Money:           10,
		TradeNo:         "registered-paid-any-provider",
		PaymentProvider: PaymentProviderPaddle,
		CompleteTime:    startAt + 300,
		Status:          common.TopUpStatusSuccess,
	}).Error)

	var userSQL []string
	callbackName := "recall_candidate_registered_predicates_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			userSQL = append(userSQL, tx.Statement.SQL.String())
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	facts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:            "registered_only",
		Now:                 endAt,
		RegistrationStartAt: startAt,
		RegistrationEndAt:   endAt,
		AfterUserID:         before.Id,
		Limit:               10,
	})
	require.NoError(t, err)
	require.Equal(t, []int{start.Id, end.Id, paid.Id}, recallRepositoryUserIDs(facts))
	require.True(t, facts[2].HasPayment, "registered_only must load successful payments across providers")
	require.NotContains(t, recallRepositoryUserIDs(facts), before.Id)
	require.NotContains(t, recallRepositoryUserIDs(facts), after.Id)
	require.NotContains(t, recallRepositoryUserIDs(facts), used.Id)
	require.Len(t, userSQL, 1)
	require.Contains(t, userSQL[0], "created_at >= ?")
	require.Contains(t, userSQL[0], "created_at <= ?")
	require.Contains(t, userSQL[0], "request_count = ?")
	require.Contains(t, userSQL[0], "id > ?")
	require.Contains(t, userSQL[0], "ORDER BY id ASC")
	require.Contains(t, userSQL[0], "LIMIT")
}

func TestListRecallCandidateFactsRegistrationTimeRangeIncludesUsedAndPaidUsers(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}, &UserSubscription{}))

	const startAt int64 = 1_000
	const endAt int64 = 2_000
	before := createRecallRepositoryCandidateUser(t, "range_before", startAt-1, 0)
	start := createRecallRepositoryCandidateUser(t, "range_start", startAt, 0)
	used := createRecallRepositoryCandidateUser(t, "range_used", startAt+100, 9)
	paid := createRecallRepositoryCandidateUser(t, "range_paid", startAt+200, 1)
	end := createRecallRepositoryCandidateUser(t, "range_end", endAt, 3)
	after := createRecallRepositoryCandidateUser(t, "range_after", endAt+1, 0)
	require.NoError(t, DB.Create(&TopUp{
		UserId:          paid.Id,
		Money:           10,
		TradeNo:         "registration-range-paid-topup",
		PaymentProvider: PaymentProviderPaddle,
		CompleteTime:    startAt + 300,
		Status:          common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{
		UserId:          used.Id,
		Money:           20,
		TradeNo:         "registration-range-used-subscription",
		PaymentProvider: PaymentProviderStripe,
		CompleteTime:    startAt + 400,
		Status:          common.TopUpStatusSuccess,
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:  used.Id,
		PlanId:  1,
		EndTime: endAt + 10_000,
		Status:  "active",
	}).Error)

	var userSQL []string
	paymentFactQueries := 0
	callbackName := "recall_candidate_registration_range_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		switch tx.Statement.Table {
		case "users":
			userSQL = append(userSQL, tx.Statement.SQL.String())
		case "top_ups", "subscription_orders", "user_subscriptions":
			paymentFactQueries++
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	facts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:            "registration_time_range",
		Now:                 endAt,
		RegistrationStartAt: startAt,
		RegistrationEndAt:   endAt,
		AfterUserID:         before.Id,
		Limit:               10,
	})

	require.NoError(t, err)
	require.Equal(t, []int{start.Id, used.Id, paid.Id, end.Id}, recallRepositoryUserIDs(facts))
	require.NotContains(t, recallRepositoryUserIDs(facts), before.Id)
	require.NotContains(t, recallRepositoryUserIDs(facts), after.Id)
	for _, fact := range facts {
		require.False(t, fact.HasPayment, "registration_time_range should not load payment facts")
		require.Zero(t, fact.SubscriptionCount, "registration_time_range should not load subscription facts")
	}
	require.Len(t, userSQL, 1)
	require.Contains(t, userSQL[0], "created_at >= ?")
	require.Contains(t, userSQL[0], "created_at <= ?")
	require.NotContains(t, userSQL[0], "request_count = ?")
	require.Contains(t, userSQL[0], "id > ?")
	require.Zero(t, paymentFactQueries)
}

func TestListRecallCandidateFactsSpecifiedUnion(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}, &UserSubscription{}))

	idOnly := createRecallRepositoryCandidateUser(t, "specified_id", 100, 4)
	emailOnly := createRecallRepositoryCandidateUser(t, "specified_email", 100, 4)
	overlap := createRecallRepositoryCandidateUser(t, "specified_overlap", 100, 4)
	unknown := createRecallRepositoryCandidateUser(t, "specified_unknown", 100, 4)

	facts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:         "specified_users",
		SpecifiedUserIDs: []int{idOnly.Id, overlap.Id, 999_999},
		SpecifiedEmails:  []string{strings.ToUpper(emailOnly.Email), overlap.Email, "missing@example.com"},
		Limit:            10,
	})
	require.NoError(t, err)
	require.Equal(t, []int{idOnly.Id, emailOnly.Id, overlap.Id, 0}, recallRepositoryUserIDs(facts))
	require.True(t, facts[len(facts)-1].EmailOnly)
	require.Equal(t, "missing@example.com", facts[len(facts)-1].Email)
	require.NotContains(t, recallRepositoryUserIDs(facts), unknown.Id)

	pageOne, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:         "specified_users",
		SpecifiedUserIDs: []int{idOnly.Id, emailOnly.Id, overlap.Id},
		Limit:            2,
	})
	require.NoError(t, err)
	require.Equal(t, []int{idOnly.Id, emailOnly.Id, overlap.Id}, recallRepositoryUserIDs(pageOne))

	pageTwo, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:         "specified_users",
		SpecifiedUserIDs: []int{idOnly.Id, emailOnly.Id, overlap.Id},
		AfterUserID:      pageOne[len(pageOne)-1].User.Id,
		Limit:            2,
	})
	require.NoError(t, err)
	require.Empty(t, pageTwo)

	idFacts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:         "specified_users",
		SpecifiedUserIDs: []int{idOnly.Id},
		Limit:            10,
	})
	require.NoError(t, err)
	require.Equal(t, []int{idOnly.Id}, recallRepositoryUserIDs(idFacts))

	emailFacts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:        "specified_users",
		SpecifiedEmails: []string{strings.ToUpper(emailOnly.Email)},
		Limit:           10,
	})
	require.NoError(t, err)
	require.Equal(t, []int{emailOnly.Id}, recallRepositoryUserIDs(emailFacts))

	emptyFacts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template: "specified_users",
		Limit:    10,
	})
	require.NoError(t, err)
	require.Empty(t, emptyFacts)
}

func TestListRecallCandidateFactsSpecifiedUnionIncludesUnmatchedEmails(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}, &UserSubscription{}))

	idSelected := createRecallRepositoryCandidateUser(t, "specified_unmatched_id", 100, 4)
	emailMatched := createRecallRepositoryCandidateUser(t, "specified_unmatched_email", 100, 4)
	overlap := createRecallRepositoryCandidateUser(t, "specified_unmatched_overlap", 100, 4)
	disabled := createRecallRepositoryCandidateUser(t, "specified_unmatched_disabled", 100, 4)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", disabled.Id).Update("status", common.UserStatusDisabled).Error)

	facts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template:         "specified_users",
		SpecifiedUserIDs: []int{idSelected.Id, overlap.Id},
		SpecifiedEmails: []string{
			strings.ToUpper(emailMatched.Email),
			strings.ToUpper(overlap.Email),
			strings.ToUpper(disabled.Email),
			"missing@example.com",
		},
		Limit: 5,
	})
	require.NoError(t, err)
	require.Len(t, facts, 5)
	require.Equal(t, []int{idSelected.Id, emailMatched.Id, overlap.Id, disabled.Id, 0}, recallRepositoryUserIDs(facts))

	missingFact := facts[4]
	require.Equal(t, "missing@example.com", missingFact.Email)
	require.Zero(t, missingFact.User.Id)
	require.True(t, missingFact.EmailOnly)
	require.Equal(t, fmt.Sprintf("email:%x", sha256.Sum256([]byte("missing@example.com"))), missingFact.RecipientIdentity)

	disabledEmailOnlyFallbacks := 0
	disabledRealFacts := 0
	for _, fact := range facts {
		if fact.Email != strings.ToLower(disabled.Email) {
			continue
		}
		if fact.EmailOnly {
			disabledEmailOnlyFallbacks++
			continue
		}
		if fact.User.Id == disabled.Id {
			disabledRealFacts++
		}
	}
	require.Equal(t, 1, disabledRealFacts)
	require.Zero(t, disabledEmailOnlyFallbacks)
}

func TestListRecallCandidateFactsSpecifiedUnionIgnoresSmallLimitForSafetyMatches(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &SubscriptionOrder{}, &UserSubscription{}))

	first := createRecallRepositoryCandidateUser(t, "specified_small_limit_first", 100, 4)
	second := createRecallRepositoryCandidateUser(t, "specified_small_limit_second", 100, 4)
	disabled := createRecallRepositoryCandidateUser(t, "specified_small_limit_disabled", 100, 4)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", disabled.Id).Update("status", common.UserStatusDisabled).Error)

	facts, err := ListRecallCandidateFacts(RecallCandidateQuery{
		Template: "specified_users",
		SpecifiedEmails: []string{
			strings.ToUpper(first.Email),
			strings.ToUpper(second.Email),
			strings.ToUpper(disabled.Email),
			"missing-small-limit@example.com",
		},
		Limit: 2,
	})
	require.NoError(t, err)
	require.Equal(t, []int{first.Id, second.Id, disabled.Id, 0}, recallRepositoryUserIDs(facts))

	disabledRealFacts := 0
	disabledEmailOnlyFallbacks := 0
	for _, fact := range facts {
		if fact.Email != strings.ToLower(disabled.Email) {
			continue
		}
		if fact.EmailOnly {
			disabledEmailOnlyFallbacks++
			continue
		}
		if fact.User.Id == disabled.Id {
			disabledRealFacts++
		}
	}
	require.Equal(t, 1, disabledRealFacts)
	require.Zero(t, disabledEmailOnlyFallbacks)
	require.Equal(t, "missing-small-limit@example.com", facts[len(facts)-1].Email)
	require.True(t, facts[len(facts)-1].EmailOnly)
}

func TestRecallRepositoryMigrationCreatesMainDBTablesAndUniqueIndexes(t *testing.T) {
	mainDB, logDB := setupRecallRepositoryTestDB(t)

	for _, table := range []any{&RecallCampaign{}, &RecallRecipient{}, &RecallMessage{}, &RecallEvent{}} {
		require.True(t, mainDB.Migrator().HasTable(table))
		require.False(t, logDB.Migrator().HasTable(table), "recall tables must never be migrated to LOG_DB")
	}

	recipient := RecallRecipient{
		CampaignId:          11,
		UserId:              22,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "first@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	require.NoError(t, mainDB.Create(&recipient).Error)
	duplicateRecipient := recipient
	duplicateRecipient.Id = 0
	duplicateRecipient.EmailSnapshot = "duplicate@example.com"
	require.Error(t, mainDB.Create(&duplicateRecipient).Error)

	message := RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  1,
		TemplateSnapshot: `{}`,
		State:            RecallMessageScheduled,
	}
	require.NoError(t, mainDB.Create(&message).Error)
	duplicateMessage := message
	duplicateMessage.Id = 0
	require.Error(t, mainDB.Create(&duplicateMessage).Error)

	event := RecallEvent{
		CampaignId:    recipient.CampaignId,
		RecipientId:   recipient.Id,
		EventType:     "campaign_run",
		Source:        "worker",
		SourceEventId: "run-1",
		EventData:     `{}`,
	}
	require.NoError(t, mainDB.Create(&event).Error)
	duplicateEvent := event
	duplicateEvent.Id = 0
	duplicateEvent.EventType = "duplicate"
	require.Error(t, mainDB.Create(&duplicateEvent).Error)
}

func TestRecallRecipientIdentityBeforeCreateAndUniqueness(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	firstEmailOnly := RecallRecipient{
		CampaignId:          41,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "first@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	secondEmailOnly := firstEmailOnly
	secondEmailOnly.EmailSnapshot = "second@example.com"
	require.NoError(t, DB.Create(&firstEmailOnly).Error)
	require.NoError(t, DB.Create(&secondEmailOnly).Error)
	require.Equal(t, RecallRecipientIdentityForEmail("first@example.com"), firstEmailOnly.RecipientIdentity)
	require.Equal(t, RecallRecipientIdentityForEmail("second@example.com"), secondEmailOnly.RecipientIdentity)

	spaceUpper := firstEmailOnly
	spaceUpper.Id = 0
	spaceUpper.CampaignId = 42
	spaceUpper.EmailSnapshot = " ONE@example.com "
	spaceUpper.RecipientIdentity = ""
	require.NoError(t, DB.Create(&spaceUpper).Error)
	require.Equal(t, RecallRecipientIdentityForEmail("one@example.com"), spaceUpper.RecipientIdentity)
	duplicateEmail := spaceUpper
	duplicateEmail.Id = 0
	duplicateEmail.EmailSnapshot = "one@example.com"
	duplicateEmail.RecipientIdentity = ""
	require.Error(t, DB.Create(&duplicateEmail).Error)

	userBacked := firstEmailOnly
	userBacked.Id = 0
	userBacked.CampaignId = 43
	userBacked.UserId = 77
	userBacked.EmailSnapshot = ""
	userBacked.RecipientIdentity = ""
	require.NoError(t, DB.Create(&userBacked).Error)
	require.Equal(t, "user:77", userBacked.RecipientIdentity)

	explicit := firstEmailOnly
	explicit.Id = 0
	explicit.CampaignId = 44
	explicit.UserId = 88
	explicit.EmailSnapshot = "explicit@example.com"
	explicit.RecipientIdentity = "email:precomputed"
	require.NoError(t, DB.Create(&explicit).Error)
	require.Equal(t, "email:precomputed", explicit.RecipientIdentity)

	missingIdentitySource := firstEmailOnly
	missingIdentitySource.Id = 0
	missingIdentitySource.CampaignId = 45
	missingIdentitySource.EmailSnapshot = ""
	missingIdentitySource.RecipientIdentity = ""
	require.Error(t, DB.Create(&missingIdentitySource).Error)

	displayName := firstEmailOnly
	displayName.Id = 0
	displayName.CampaignId = 46
	displayName.EmailSnapshot = "Display Name <one@example.com>"
	displayName.RecipientIdentity = ""
	require.Error(t, DB.Create(&displayName).Error)
}

func TestRecallRecipientJSONDoesNotExposeIdentity(t *testing.T) {
	recipient := RecallRecipient{
		CampaignId:          41,
		UserId:              77,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "hidden@example.com",
		RecipientIdentity:   RecallRecipientIdentityForUser(77),
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}

	payload, err := json.Marshal(recipient)

	require.NoError(t, err)
	require.NotContains(t, string(payload), "recipient_identity")
	require.NotContains(t, string(payload), "user:77")
}

func TestRecallRecipientBindCASMatchesNormalizedEmailAndPreservesIdentity(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          47,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "EmailBind@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	originalIdentity := recipient.RecipientIdentity

	bound, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7001, " emailbind@EXAMPLE.com ")

	require.NoError(t, err)
	require.True(t, inserted)
	require.Equal(t, 7001, bound.UserId)
	require.Equal(t, originalIdentity, bound.RecipientIdentity)
	require.Equal(t, "EmailBind@example.com", bound.EmailSnapshot)
}

func TestRecallRecipientBindCASRejectsMismatchAndOtherUserWithoutChangingIdentity(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          48,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "owner@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	originalIdentity := recipient.RecipientIdentity

	bound, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7002, "other@example.com")
	require.Error(t, err)
	require.False(t, inserted)
	require.Nil(t, bound)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Zero(t, stored.UserId)
	require.Equal(t, originalIdentity, stored.RecipientIdentity)

	first, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7003, "owner@example.com")
	require.NoError(t, err)
	require.True(t, inserted)
	require.Equal(t, 7003, first.UserId)
	second, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7004, "owner@example.com")
	require.Error(t, err)
	require.False(t, inserted)
	require.Nil(t, second)
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, 7003, stored.UserId)
	require.Equal(t, originalIdentity, stored.RecipientIdentity)
}

func TestRecallRecipientBindCASIsIdempotentForSameUser(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          49,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "repeat@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	first, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7005, "repeat@example.com")
	require.NoError(t, err)
	require.True(t, inserted)
	require.Equal(t, 7005, first.UserId)
	second, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7005, "repeat@example.com")
	require.NoError(t, err)
	require.False(t, inserted)
	require.Equal(t, 7005, second.UserId)
	require.Equal(t, first.RecipientIdentity, second.RecipientIdentity)
}

func TestRecallRecipientBindCASAllowsOnlyOneCompetingUser(t *testing.T) {
	setupRecallRepositoryFileDB(t)

	recipient := RecallRecipient{
		CampaignId:          50,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "race-bind@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	originalIdentity := recipient.RecipientIdentity

	start := make(chan struct{})
	type bindResult struct {
		userID   int
		bound    *RecallRecipient
		inserted bool
		err      error
	}
	results := make(chan bindResult, 2)
	var wg sync.WaitGroup
	for _, userID := range []int{7006, 7007} {
		userID := userID
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			bound, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, userID, "race-bind@example.com")
			results <- bindResult{userID: userID, bound: bound, inserted: inserted, err: err}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	winners := 0
	for result := range results {
		if result.inserted {
			winners++
			require.NoError(t, result.err)
			require.NotNil(t, result.bound)
			require.Equal(t, result.userID, result.bound.UserId)
			require.Equal(t, originalIdentity, result.bound.RecipientIdentity)
			continue
		}
		require.ErrorIs(t, result.err, ErrRecallRecipientBindingConflict)
		require.Nil(t, result.bound)
	}
	require.Equal(t, 1, winners)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Contains(t, []int{7006, 7007}, stored.UserId)
	require.Equal(t, originalIdentity, stored.RecipientIdentity)
}

func TestSuppressRecallRecipientOnlySuppressesUnboundRecipientAndCancelsPendingMessages(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	const now int64 = 1_721_000_000

	unbound := RecallRecipient{
		CampaignId:          50,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "local@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
		LeaseOwner:          "recipient-worker",
		LeaseExpiresAt:      now + 60,
	}
	other := RecallRecipient{
		CampaignId:          50,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "other-local@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&unbound).Error)
	require.NoError(t, DB.Create(&other).Error)

	states := []string{RecallMessageScheduled, RecallMessageRetryWait, RecallMessageLeased, RecallMessageSending, RecallMessageAccepted, RecallMessageFailed, RecallMessageCancelled}
	for index, state := range states {
		message := RecallMessage{
			RecipientId:      unbound.Id,
			StageNo:          index + 1,
			TemplateSnapshot: `{}`,
			State:            state,
			NextAttemptAt:    now + 10,
			LeaseOwner:       "message-worker",
			LeaseExpiresAt:   now + 30,
		}
		require.NoError(t, DB.Create(&message).Error)
	}
	otherMessage := RecallMessage{RecipientId: other.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageScheduled, NextAttemptAt: now + 10}
	require.NoError(t, DB.Create(&otherMessage).Error)

	suppressed, err := SuppressRecallRecipientWithContext(context.Background(), unbound.Id, now)

	require.NoError(t, err)
	require.True(t, suppressed)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, unbound.Id).Error)
	require.Equal(t, RecallRecipientSuppressed, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
	require.Zero(t, stored.UserId)

	var messages []RecallMessage
	require.NoError(t, DB.Where("recipient_id = ?", unbound.Id).Order("stage_no ASC").Find(&messages).Error)
	require.Len(t, messages, len(states))
	for index, message := range messages {
		switch states[index] {
		case RecallMessageScheduled, RecallMessageRetryWait, RecallMessageLeased, RecallMessageSending:
			require.Equal(t, RecallMessageCancelled, message.State)
			require.Equal(t, "recipient_unsubscribed", message.LastErrorCode)
			require.Equal(t, now, message.FailedAt)
			require.Zero(t, message.NextAttemptAt)
			require.Empty(t, message.LeaseOwner)
			require.Zero(t, message.LeaseExpiresAt)
		default:
			require.Equal(t, states[index], message.State)
		}
	}
	var storedOtherMessage RecallMessage
	require.NoError(t, DB.First(&storedOtherMessage, otherMessage.Id).Error)
	require.Equal(t, RecallMessageScheduled, storedOtherMessage.State)

	again, err := SuppressRecallRecipientWithContext(context.Background(), unbound.Id, now+1)
	require.NoError(t, err)
	require.True(t, again)
}

func TestSuppressRecallRecipientDoesNotLocallySuppressBoundRecipient(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          51,
		UserId:              7100,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "bound@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	suppressed, err := SuppressRecallRecipientWithContext(context.Background(), recipient.Id, 1_721_000_000)

	require.NoError(t, err)
	require.False(t, suppressed)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, 7100, stored.UserId)
	require.Equal(t, RecallRecipientContacting, stored.State)
}

func TestRecallRecipientBindCASDoesNotBindAlreadySuppressedRecipient(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          52,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "suppressed-bind@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	suppressed, err := SuppressRecallRecipientWithContext(context.Background(), recipient.Id, 1_721_000_000)
	require.NoError(t, err)
	require.True(t, suppressed)

	bound, inserted, err := BindRecallRecipientUserWithContext(context.Background(), recipient.Id, 7200, "suppressed-bind@example.com")

	require.Error(t, err)
	require.False(t, inserted)
	require.Nil(t, bound)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Zero(t, stored.UserId)
	require.Equal(t, RecallRecipientSuppressed, stored.State)
}

func TestListRecallOfferCandidatesForUserFiltersAndBindsExactEmailMatches(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const now int64 = 1_800_000_000
	user := User{
		Username: "recall-offer-user", Password: "password", Status: common.UserStatusEnabled,
		Email: "OfferOwner@example.com", AffCode: "recall-offer-user-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	disabled := User{
		Username: "recall-offer-disabled", Password: "password", Status: common.UserStatusDisabled,
		Email: "disabled-offer@example.com", AffCode: "recall-offer-disabled-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&disabled).Error)

	createCampaign := func(status string) RecallCampaign {
		campaign := newRecallRepositoryCampaign("offer " + status)
		campaign.Status = status
		require.NoError(t, DB.Create(&campaign).Error)
		return campaign
	}
	campaigns := map[string]RecallCampaign{}
	for _, status := range []string{RecallCampaignScheduled, RecallCampaignRunning, RecallCampaignPaused, RecallCampaignCompleted, RecallCampaignDraft, RecallCampaignCancelled} {
		campaigns[status] = createCampaign(status)
	}
	promotionID := func(id string) *string { return &id }
	createRecipient := func(campaign RecallCampaign, userID int, email string, state string, promotionIDValue *string, code string, expiresAt int64, issuedAt int64, createdAt int64) RecallRecipient {
		recipient := RecallRecipient{
			CampaignId: campaign.Id, UserId: userID, EligibilitySnapshot: `{}`, EmailSnapshot: email,
			LanguageSnapshot: "en", State: state, StripePromotionCodeId: promotionIDValue,
			PromotionCode: code, PromotionExpiresAt: expiresAt, PromotionIssuedAt: issuedAt, CreatedAt: createdAt,
		}
		require.NoError(t, DB.Create(&recipient).Error)
		return recipient
	}

	bound := createRecipient(campaigns[RecallCampaignRunning], user.Id, "legacy@example.com", RecallRecipientContacting, promotionID("promo_bound"), "BOUND123", now+100, 0, now-90)
	emailOnly := createRecipient(campaigns[RecallCampaignPaused], 0, strings.ToLower(user.Email), RecallRecipientCodeReady, promotionID("promo_email"), "EMAIL123", now+200, now-50, now-80)
	conflict := createRecipient(campaigns[RecallCampaignScheduled], 0, strings.ToLower(user.Email), RecallRecipientCodeReady, promotionID("promo_conflict"), "CONFLICT123", now+200, now-40, now-70)
	var conflictOnce sync.Once
	callbackName := "recall_offer_candidate_conflict_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "recall_recipients" || !strings.Contains(tx.Statement.SQL.String(), "JOIN recall_campaigns") {
			return
		}
		conflictOnce.Do(func() {
			require.NoError(t, DB.Exec("UPDATE recall_recipients SET user_id = ? WHERE id = ? AND user_id = 0", user.Id+1000, conflict.Id).Error)
		})
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })
	for index, status := range []string{RecallCampaignScheduled, RecallCampaignCompleted} {
		createRecipient(campaigns[status], user.Id, "status-usable@example.com", RecallRecipientContacting, promotionID(fmt.Sprintf("promo_status_%d", index)), fmt.Sprintf("STATUS%d", index), now+100, now+int64(index+1), now-60+int64(index))
	}
	createRecipient(campaigns[RecallCampaignDraft], user.Id, "draft@example.com", RecallRecipientContacting, promotionID("promo_draft"), "DRAFT123", now+100, now+1, now-10)
	createRecipient(campaigns[RecallCampaignCancelled], user.Id, "cancelled@example.com", RecallRecipientContacting, promotionID("promo_cancelled"), "CANCEL123", now+100, now+1, now-10)
	for _, state := range []string{RecallRecipientConverted, RecallRecipientSuppressed, RecallRecipientIneligible, RecallRecipientExpired, RecallRecipientFailed} {
		createRecipient(createCampaign(RecallCampaignRunning), user.Id, state+"@example.com", state, promotionID("promo_"+state), "STATE123", now+100, now+1, now-10)
	}
	createRecipient(createCampaign(RecallCampaignRunning), user.Id, "missing-id@example.com", RecallRecipientContacting, nil, "NOID123", now+100, now+1, now-10)
	createRecipient(createCampaign(RecallCampaignRunning), user.Id, "missing-code@example.com", RecallRecipientContacting, promotionID("promo_missing_code"), "", now+100, now+1, now-10)
	createRecipient(createCampaign(RecallCampaignRunning), user.Id, "expired-code@example.com", RecallRecipientContacting, promotionID("promo_expired_code"), "EXPIRED123", now, now+1, now-10)

	candidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), user.Id, strings.ToLower(user.Email), now)

	require.NoError(t, err)
	require.Len(t, candidates, 4)
	ids := make([]int64, 0, len(candidates))
	for _, candidate := range candidates {
		ids = append(ids, candidate.Recipient.Id)
		require.NotContains(t, []string{RecallCampaignDraft, RecallCampaignCancelled}, candidate.Campaign.Status)
		require.NotContains(t, []string{RecallRecipientConverted, RecallRecipientSuppressed, RecallRecipientIneligible, RecallRecipientExpired, RecallRecipientFailed}, candidate.Recipient.State)
		require.NotEmpty(t, candidate.Recipient.PromotionCode)
		require.NotNil(t, candidate.Recipient.StripePromotionCodeId)
		require.Greater(t, candidate.Recipient.PromotionExpiresAt, now)
		require.Equal(t, user.Id, candidate.Recipient.UserId)
	}
	require.Contains(t, ids, bound.Id)
	require.Contains(t, ids, emailOnly.Id)
	require.NotContains(t, ids, conflict.Id)
	require.Equal(t, bound.CreatedAt, candidates[0].EffectiveIssuedAt())
	for _, candidate := range candidates {
		if candidate.Recipient.Id == emailOnly.Id {
			require.Equal(t, emailOnly.PromotionIssuedAt, candidate.EffectiveIssuedAt())
		}
	}

	disabledCandidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), disabled.Id, strings.ToLower(disabled.Email), now)
	require.NoError(t, err)
	require.Empty(t, disabledCandidates)
}

func TestListRecallOfferCandidatesUsesSetBasedFinalLoad(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const now int64 = 1_800_000_000
	user := User{
		Username: "recall-offer-query-user", Password: "password", Status: common.UserStatusEnabled,
		Email: "query-owner@example.com", AffCode: "recall-offer-query-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	for index := 0; index < 3; index++ {
		campaign := newRecallRepositoryCampaign(fmt.Sprintf("offer query %d", index))
		campaign.Status = RecallCampaignRunning
		require.NoError(t, DB.Create(&campaign).Error)
		promotionID := fmt.Sprintf("promo_query_%d", index)
		require.NoError(t, DB.Create(&RecallRecipient{
			CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
			LanguageSnapshot: "en", State: RecallRecipientContacting, StripePromotionCodeId: &promotionID,
			PromotionCode: fmt.Sprintf("QUERY%d", index), PromotionExpiresAt: now + 100, CreatedAt: now - int64(index+1),
		}).Error)
	}

	queryCount := 0
	callbackName := "recall_offer_query_count_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(*gorm.DB) {
		queryCount++
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	candidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), user.Id, strings.ToLower(user.Email), now)

	require.NoError(t, err)
	require.Len(t, candidates, 3)
	require.LessOrEqual(t, queryCount, 4, "candidate loading must not add recipient and campaign queries per offer")
}

func TestListRecallOfferCandidatesChunksLargeSetBasedFinalLoads(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const (
		now            int64 = 1_800_000_000
		candidateCount       = 501
	)
	user := User{
		Username: "recall-offer-chunk-user", Password: "password", Status: common.UserStatusEnabled,
		Email: "chunk-owner@example.com", AffCode: "recall-offer-chunk-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	campaigns := make([]RecallCampaign, 0, candidateCount)
	for index := 0; index < candidateCount; index++ {
		campaign := newRecallRepositoryCampaign(fmt.Sprintf("offer chunk %d", index))
		campaign.Status = RecallCampaignRunning
		campaigns = append(campaigns, campaign)
	}
	require.NoError(t, DB.CreateInBatches(&campaigns, 25).Error)
	recipients := make([]RecallRecipient, 0, candidateCount)
	for index := range campaigns {
		promotionID := fmt.Sprintf("promo_chunk_%d", index)
		recipients = append(recipients, RecallRecipient{
			CampaignId: campaigns[index].Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
			LanguageSnapshot: "en", State: RecallRecipientContacting, StripePromotionCodeId: &promotionID,
			PromotionCode: fmt.Sprintf("CHUNK%d", index), PromotionExpiresAt: now + 100, CreatedAt: now - int64(index+1),
		})
	}
	require.NoError(t, DB.CreateInBatches(&recipients, 25).Error)

	queryCounts := map[string]int{}
	callbackName := "recall_offer_chunk_query_count_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil {
			return
		}
		queryCounts[tx.Statement.Schema.Name]++
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	candidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), user.Id, strings.ToLower(user.Email), now)

	require.NoError(t, err)
	require.Len(t, candidates, candidateCount)
	require.Equal(t, 3, queryCounts["RecallRecipient"], "initial lookup plus two bounded final recipient loads")
	require.Equal(t, 2, queryCounts["RecallCampaign"], "campaign hydration must use the same bounded batching")
}

func TestListRecallOfferCandidatesDropsEmailMatchTransitionedBeforeBind(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const now int64 = 1_800_000_000
	user := User{
		Username: "recall-offer-transition-user", Password: "password", Status: common.UserStatusEnabled,
		Email: "transition-owner@example.com", AffCode: "recall-offer-transition-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	campaign := newRecallRepositoryCampaign("offer transition")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, DB.Create(&campaign).Error)
	promotionID := "promo_transition"
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
		LanguageSnapshot: "en", State: RecallRecipientCodeReady, StripePromotionCodeId: &promotionID,
		PromotionCode: "TRANSITION123", PromotionExpiresAt: now + 100, CreatedAt: now - 50,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	var transitionOnce sync.Once
	callbackName := "recall_offer_transition_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "recall_recipients" || !strings.Contains(tx.Statement.SQL.String(), "JOIN recall_campaigns") {
			return
		}
		transitionOnce.Do(func() {
			require.NoError(t, DB.Exec("UPDATE recall_recipients SET state = ? WHERE id = ?", RecallRecipientConverted, recipient.Id).Error)
		})
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	candidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), user.Id, strings.ToLower(user.Email), now)

	require.NoError(t, err)
	require.Empty(t, candidates)
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Zero(t, stored.UserId)
	require.Equal(t, RecallRecipientConverted, stored.State)
}

func TestListRecallOfferCandidatesDoesNotBindEmailMatchCancelledBeforeBind(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const now int64 = 1_800_000_000
	user := User{
		Username: "recall-offer-cancel-user", Password: "password", Status: common.UserStatusEnabled,
		Email: "cancel-owner@example.com", AffCode: "recall-offer-cancel-aff", CreatedAt: now - 100,
	}
	require.NoError(t, DB.Create(&user).Error)
	campaign := newRecallRepositoryCampaign("offer cancel")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, DB.Create(&campaign).Error)
	promotionID := "promo_cancel_race"
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email,
		LanguageSnapshot: "en", State: RecallRecipientContacting, StripePromotionCodeId: &promotionID,
		PromotionCode: "CANCELRACE123", PromotionExpiresAt: now + 100, CreatedAt: now - 50,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	var cancelOnce sync.Once
	callbackName := "recall_offer_cancel_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "recall_recipients" || !strings.Contains(tx.Statement.SQL.String(), "JOIN recall_campaigns") {
			return
		}
		cancelOnce.Do(func() {
			require.NoError(t, DB.Exec("UPDATE recall_campaigns SET status = ? WHERE id = ?", RecallCampaignCancelled, campaign.Id).Error)
		})
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	candidates, err := ListRecallOfferCandidatesForUserWithContext(context.Background(), user.Id, strings.ToLower(user.Email), now)

	require.NoError(t, err)
	require.Empty(t, candidates)
	var stored RecallCampaign
	require.NoError(t, DB.First(&stored, campaign.Id).Error)
	require.Equal(t, RecallCampaignCancelled, stored.Status)
	var storedRecipient RecallRecipient
	require.NoError(t, DB.First(&storedRecipient, recipient.Id).Error)
	require.Zero(t, storedRecipient.UserId)
}

func TestRecallOfferCandidateEffectiveIssuedAtFallsBackToCreatedAt(t *testing.T) {
	candidate := RecallOfferCandidate{Recipient: RecallRecipient{PromotionIssuedAt: 0, CreatedAt: 123}}
	require.Equal(t, int64(123), candidate.EffectiveIssuedAt())
	candidate.Recipient.PromotionIssuedAt = 456
	require.Equal(t, int64(456), candidate.EffectiveIssuedAt())
}

func TestPersistRecallRecipientPromotionSetsImmutableIssuedAt(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          53,
		UserId:              7101,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "issued-once@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientCustomerReady,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	persisted, err := PersistRecallRecipientPromotion(context.Background(), recipient.Id, "promo_once", "ONCE123", 1_800_000_000)
	require.NoError(t, err)
	require.True(t, persisted)
	persisted, err = PersistRecallRecipientPromotion(context.Background(), recipient.Id, "promo_once", "ONCE123", 1_800_000_999)
	require.NoError(t, err)
	require.True(t, persisted)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, "promo_once", *stored.StripePromotionCodeId)
	require.Equal(t, "ONCE123", stored.PromotionCode)
	require.Equal(t, int64(1_800_000_000), stored.PromotionIssuedAt)

	conflict, err := PersistRecallRecipientPromotion(context.Background(), recipient.Id, "promo_other", "OTHER123", 1_800_001_000)
	require.NoError(t, err)
	require.False(t, conflict)
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, int64(1_800_000_000), stored.PromotionIssuedAt)
}

func TestPersistRecallRecipientPromotionInitializesLegacyNullIssuedAt(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          54,
		UserId:              7102,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "legacy-null-issued-at@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientCustomerReady,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	require.NoError(t, DB.Exec("UPDATE recall_recipients SET promotion_issued_at = NULL WHERE id = ?", recipient.Id).Error)

	persisted, err := PersistRecallRecipientPromotion(context.Background(), recipient.Id, "promo_legacy", "LEGACY123", 1_800_000_100)
	require.NoError(t, err)
	require.True(t, persisted)

	var issuedAt sql.NullInt64
	require.NoError(t, DB.Raw("SELECT promotion_issued_at FROM recall_recipients WHERE id = ?", recipient.Id).Row().Scan(&issuedAt))
	require.True(t, issuedAt.Valid)
	require.Equal(t, int64(1_800_000_100), issuedAt.Int64)

	persisted, err = PersistRecallRecipientPromotion(context.Background(), recipient.Id, "promo_legacy", "LEGACY123", 1_800_000_999)
	require.NoError(t, err)
	require.True(t, persisted)
	require.NoError(t, DB.Raw("SELECT promotion_issued_at FROM recall_recipients WHERE id = ?", recipient.Id).Row().Scan(&issuedAt))
	require.Equal(t, int64(1_800_000_100), issuedAt.Int64)
}

func TestListRecallCampaignRecipientKeysWithContext(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("recipient keys")
	require.NoError(t, CreateRecallCampaign(&campaign))
	otherCampaign := newRecallRepositoryCampaign("other keys")
	require.NoError(t, CreateRecallCampaign(&otherCampaign))
	recipients := []RecallRecipient{
		{
			CampaignId:          campaign.Id,
			UserId:              0,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       " EmailOnly@example.com ",
			RecipientIdentity:   RecallRecipientIdentityForEmail("emailonly@example.com"),
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		},
		{
			CampaignId:          campaign.Id,
			UserId:              77,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "Bound@example.com",
			RecipientIdentity:   RecallRecipientIdentityForUser(77),
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		},
		{
			CampaignId:          campaign.Id,
			UserId:              0,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "Display Name <invalid@example.com>",
			RecipientIdentity:   "email:invalid-snapshot",
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		},
		{
			CampaignId:          otherCampaign.Id,
			UserId:              88,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "other@example.com",
			RecipientIdentity:   RecallRecipientIdentityForUser(88),
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		},
	}
	require.NoError(t, DB.Create(&recipients).Error)

	keys, err := ListRecallCampaignRecipientKeysWithContext(context.Background(), campaign.Id)

	require.NoError(t, err)
	require.NotNil(t, keys.Identities)
	require.NotNil(t, keys.UserIDs)
	require.NotNil(t, keys.Emails)
	require.Contains(t, keys.Identities, RecallRecipientIdentityForEmail("emailonly@example.com"))
	require.Contains(t, keys.Identities, RecallRecipientIdentityForUser(77))
	require.Contains(t, keys.Identities, "email:invalid-snapshot")
	require.NotContains(t, keys.Identities, RecallRecipientIdentityForUser(88))
	require.Contains(t, keys.UserIDs, 77)
	require.NotContains(t, keys.UserIDs, 0)
	require.NotContains(t, keys.UserIDs, 88)
	require.Contains(t, keys.Emails, "emailonly@example.com")
	require.Contains(t, keys.Emails, "bound@example.com")
	require.NotContains(t, keys.Emails, "Display Name <invalid@example.com>")
}

func TestListRecallCampaignRecipientKeysWithContextReturnsNonNilEmptyMaps(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	keys, err := ListRecallCampaignRecipientKeysWithContext(context.Background(), 999)

	require.NoError(t, err)
	require.NotNil(t, keys.Identities)
	require.NotNil(t, keys.UserIDs)
	require.NotNil(t, keys.Emails)
	require.Empty(t, keys.Identities)
	require.Empty(t, keys.UserIDs)
	require.Empty(t, keys.Emails)
}

func TestRecallRecipientMigrationRequiresDisabledCampaignsBeforeSchemaSwap(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Create(&Option{Key: "recall_campaign_setting.enabled", Value: "true"}).Error)

	err = migrateRecallRecipientIdentity()
	require.Error(t, err)
	require.Contains(t, err.Error(), "recall_campaign_setting.enabled=false")
	require.Contains(t, err.Error(), "drain")
	require.False(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))

	require.NoError(t, DB.Model(&Option{}).Where(&Option{Key: "recall_campaign_setting.enabled"}).Update("value", "not-a-bool").Error)
	err = migrateRecallRecipientIdentity()
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid stored value")
	require.False(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))

	require.NoError(t, DB.Model(&Option{}).Where(&Option{Key: "recall_campaign_setting.enabled"}).Update("value", "false").Error)
	require.NoError(t, migrateRecallRecipientIdentity())
	require.True(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))
}

func TestRecallRecipientMigrationRejectsActiveRecipientLeaseBeforeSchemaSwap(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL,
		lease_owner varchar(96) NOT NULL DEFAULT '',
		lease_expires_at bigint NOT NULL DEFAULT 0
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO recall_recipients (campaign_id, user_id, eligibility_snapshot, email_snapshot, language_snapshot, state, lease_owner, lease_expires_at) VALUES
		(73, 701, '{}', 'leased-recipient@example.com', 'en', 'queued', 'worker-a', ?)`, time.Now().Unix()+3600).Error)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Create(&Option{Key: "recall_campaign_setting.enabled", Value: "false"}).Error)

	err = migrateRecallRecipientIdentity()
	require.Error(t, err)
	require.Contains(t, err.Error(), "active recall recipient/message leases")
	require.False(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
}

func TestRecallRecipientMigrationRejectsActiveMessageLeaseBeforeSchemaSwap(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL,
		lease_owner varchar(96) NOT NULL DEFAULT '',
		lease_expires_at bigint NOT NULL DEFAULT 0
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO recall_recipients (campaign_id, user_id, eligibility_snapshot, email_snapshot, language_snapshot, state) VALUES
		(74, 701, '{}', 'message-recipient@example.com', 'en', 'contacting')`).Error)
	require.NoError(t, DB.Exec(`CREATE TABLE recall_messages (
		id integer PRIMARY KEY AUTOINCREMENT,
		recipient_id bigint NOT NULL,
		stage_no integer NOT NULL,
		template_snapshot text NOT NULL,
		state varchar(24) NOT NULL,
		lease_owner varchar(96) NOT NULL DEFAULT '',
		lease_expires_at bigint NOT NULL DEFAULT 0
	)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO recall_messages (recipient_id, stage_no, template_snapshot, state, lease_owner, lease_expires_at) VALUES
		(1, 1, '{}', 'leased', 'worker-a', ?)`, time.Now().Unix()+3600).Error)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Create(&Option{Key: "recall_campaign_setting.enabled", Value: "false"}).Error)

	err = migrateRecallRecipientIdentity()
	require.Error(t, err)
	require.Contains(t, err.Error(), "active recall recipient/message leases")
	require.False(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
}

func TestMigrateDBRunsRecallIdentityGuardBeforeOtherMigrations(t *testing.T) {
	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	common.UsingSQLite = false
	common.UsingMySQL = true
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.Exec(`CREATE TABLE tokens (
		id integer PRIMARY KEY AUTOINCREMENT,
		model_limits varchar(1024) NOT NULL DEFAULT ''
	)`).Error)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Create(&Option{Key: "recall_campaign_setting.enabled", Value: "true"}).Error)

	err = migrateDB()
	require.Error(t, err)
	require.Contains(t, err.Error(), "recall_campaign_setting.enabled=false")
	require.False(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
}

func TestRecallRecipientMigrationBackfillsIdentityAndReplacesLegacyIndex(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO recall_recipients (campaign_id, user_id, eligibility_snapshot, email_snapshot, language_snapshot, state) VALUES
		(70, 701, '{}', 'old-one@example.com', 'en', 'queued'),
		(70, 702, '{}', 'old-two@example.com', 'en', 'queued')`).Error)

	require.NoError(t, migrateRecallRecipientIdentity())
	require.True(t, DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))

	var stored []RecallRecipient
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	require.Equal(t, "user:701", stored[0].RecipientIdentity)
	require.Equal(t, "user:702", stored[1].RecipientIdentity)

	require.NoError(t, migrateRecallRecipientIdentity())
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))
}

func TestRecallRecipientMigrationBackfillsIdentityInKeysetBatches(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	const keysetRows = 501
	for i := 1; i <= keysetRows; i++ {
		require.NoError(t, DB.Exec(`INSERT INTO recall_recipients (campaign_id, user_id, eligibility_snapshot, email_snapshot, language_snapshot, state) VALUES (?, ?, '{}', ?, 'en', 'queued')`, 72, i, fmt.Sprintf("batch-%d@example.com", i)).Error)
	}

	var backfillSelects []string
	callbackName := "recall_identity_keyset_test"
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		sql := tx.Statement.SQL.String()
		if strings.Contains(sql, "FROM `recall_recipients`") && strings.Contains(sql, "recipient_identity") && strings.Contains(sql, "user_id") {
			backfillSelects = append(backfillSelects, sql)
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Query().Remove(callbackName))
	})

	require.NoError(t, migrateRecallRecipientIdentity())

	require.GreaterOrEqual(t, len(backfillSelects), 2)
	for _, sql := range backfillSelects {
		require.Contains(t, sql, "id >")
		require.Contains(t, sql, "LIMIT")
	}
	var missing int64
	require.NoError(t, DB.Table("recall_recipients").Where("recipient_identity = '' OR recipient_identity IS NULL").Count(&missing).Error)
	require.Zero(t, missing)
}

func TestRecallRecipientMigrationKeepsLegacyIndexWhenIdentityIndexFails(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, DB.Exec(`CREATE TABLE recall_recipients (
		id integer PRIMARY KEY AUTOINCREMENT,
		campaign_id bigint NOT NULL,
		recipient_identity varchar(80) NOT NULL DEFAULT '',
		user_id integer NOT NULL,
		eligibility_snapshot text NOT NULL,
		email_snapshot varchar(254) NOT NULL,
		language_snapshot varchar(16) NOT NULL,
		state varchar(24) NOT NULL
	)`).Error)
	require.NoError(t, DB.Exec(`CREATE UNIQUE INDEX idx_recall_campaign_user ON recall_recipients (campaign_id, user_id)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO recall_recipients (campaign_id, recipient_identity, user_id, eligibility_snapshot, email_snapshot, language_snapshot, state) VALUES
		(71, 'email:duplicate', 701, '{}', 'first@example.com', 'en', 'queued'),
		(71, 'email:duplicate', 702, '{}', 'second@example.com', 'en', 'queued')`).Error)

	err = migrateRecallRecipientIdentity()
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to create recall campaign identity index")
	require.False(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity"))
	require.True(t, DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user"))
}

func TestRecallRecipientMigrationMissingTableNoop(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
	})

	require.NoError(t, migrateRecallRecipientIdentity())
	require.False(t, DB.Migrator().HasTable(&RecallRecipient{}))
}

func TestRecallRepositoryCampaignCRUDAndConditionalTransition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("draft campaign")
	require.NoError(t, CreateRecallCampaign(&campaign))
	require.NotZero(t, campaign.Id)

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.Name, stored.Name)

	campaign.Name = "updated draft"
	require.NoError(t, UpdateRecallCampaignDraft(&campaign))
	stored, err = GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, "updated draft", stored.Name)

	transitioned, err := TransitionRecallCampaign(campaign.Id, []string{RecallCampaignRunning}, RecallCampaignPaused, nil)
	require.NoError(t, err)
	require.False(t, transitioned)

	transitioned, err = TransitionRecallCampaign(campaign.Id, []string{RecallCampaignDraft}, RecallCampaignScheduled, map[string]any{
		"scheduled_at": int64(1234),
		"next_run_at":  int64(2345),
	})
	require.NoError(t, err)
	require.True(t, transitioned)
	stored, err = GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, RecallCampaignScheduled, stored.Status)
	require.Equal(t, int64(1234), stored.ScheduledAt)
	require.Equal(t, int64(2345), stored.NextRunAt)

	campaign.Name = "must not update after scheduling"
	require.NoError(t, UpdateRecallCampaignDraft(&campaign))
	stored, err = GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, "updated draft", stored.Name)
}

func TestRecallRepositoryDraftUpdateUsesConfigRevisionFence(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("revisioned draft")
	require.NoError(t, CreateRecallCampaign(&campaign))
	require.EqualValues(t, 1, campaign.ConfigRevision)

	first := campaign
	first.Name = "first edit"
	second := campaign
	second.Name = "stale edit"

	won, err := UpdateRecallCampaignDraftWithContext(context.Background(), &first)
	require.NoError(t, err)
	require.True(t, won)

	won, err = UpdateRecallCampaignDraftWithContext(context.Background(), &second)
	require.NoError(t, err)
	require.False(t, won)

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, "first edit", stored.Name)
	require.EqualValues(t, 2, stored.ConfigRevision)
}

func TestRecallRepositoryActiveEmailUpdateUsesConfigRevisionFence(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("revisioned email")
	require.NoError(t, CreateRecallCampaign(&campaign))
	transitioned, err := TransitionRecallCampaign(
		campaign.Id,
		[]string{RecallCampaignDraft},
		RecallCampaignRunning,
		nil,
	)
	require.NoError(t, err)
	require.True(t, transitioned)

	won, err := UpdateRecallCampaignEmailSequenceWithContext(
		context.Background(), campaign.Id, campaign.ConfigRevision, "first email", `[{"version":2}]`,
	)
	require.NoError(t, err)
	require.True(t, won)

	won, err = UpdateRecallCampaignEmailSequenceWithContext(
		context.Background(), campaign.Id, campaign.ConfigRevision, "stale email", `[{"version":2,"stale":true}]`,
	)
	require.NoError(t, err)
	require.False(t, won)

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, "first email", stored.Name)
	require.Equal(t, `[{"version":2}]`, stored.EmailSequenceConfig)
	require.EqualValues(t, 2, stored.ConfigRevision)
}

func TestRecallRepositoryDraftUpdatePersistsZeroValuesAndPreservesImmutableFields(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("draft with values")
	campaign.AudienceTemplate = "previous_template"
	campaign.AudienceConfig = `{"days":90}`
	campaign.ExecutionMode = "scheduled"
	campaign.ScheduledAt = 101
	campaign.RecurrenceConfig = `{"interval":"weekly"}`
	campaign.NextRunAt = 202
	campaign.CouponSource = "stripe"
	campaign.StripeCouponId = "coupon_old"
	campaign.DiscountConfig = `{"percent":25}`
	campaign.ProductScope = `["pro"]`
	campaign.PromotionExpiryMode = "relative"
	campaign.PromotionExpiresAt = 302
	campaign.PromotionValidSeconds = 303
	campaign.EmailSequenceConfig = `[{"stage":1}]`
	campaign.EnrollmentLimit = 404
	campaign.WorkerConcurrency = 5
	campaign.CreatedBy = 606
	campaign.CreatedAt = 707
	campaign.ActivatedAt = 808
	campaign.CompletedAt = 909
	require.NoError(t, CreateRecallCampaign(&campaign))

	update := RecallCampaign{
		Id:             campaign.Id,
		ConfigRevision: campaign.ConfigRevision,
		Status:         RecallCampaignRunning,
		CreatedBy:      999,
		CreatedAt:      999,
		ActivatedAt:    999,
		CompletedAt:    999,
	}
	require.NoError(t, UpdateRecallCampaignDraft(&update))

	stored, err := GetRecallCampaignByID(campaign.Id)
	require.NoError(t, err)
	require.Equal(t, campaign.Id, stored.Id)
	require.Equal(t, RecallCampaignDraft, stored.Status)
	require.Equal(t, 606, stored.CreatedBy)
	require.Equal(t, int64(707), stored.CreatedAt)
	require.Equal(t, int64(808), stored.ActivatedAt)
	require.Equal(t, int64(909), stored.CompletedAt)
	require.Empty(t, stored.Name)
	require.Empty(t, stored.AudienceTemplate)
	require.Empty(t, stored.AudienceConfig)
	require.Empty(t, stored.ExecutionMode)
	require.Zero(t, stored.ScheduledAt)
	require.Empty(t, stored.RecurrenceConfig)
	require.Equal(t, int64(202), stored.NextRunAt)
	require.Empty(t, stored.CouponSource)
	require.Empty(t, stored.StripeCouponId)
	require.Empty(t, stored.DiscountConfig)
	require.Empty(t, stored.ProductScope)
	require.Empty(t, stored.PromotionExpiryMode)
	require.Zero(t, stored.PromotionExpiresAt)
	require.Zero(t, stored.PromotionValidSeconds)
	require.Empty(t, stored.EmailSequenceConfig)
	require.Zero(t, stored.EnrollmentLimit)
	require.Zero(t, stored.WorkerConcurrency)
}

func TestRecallRepositoryTransitionRejectsUnsafeMetadata(t *testing.T) {
	for _, field := range []string{"id", "created_at", "created_by", "status", "updated_at"} {
		t.Run(field, func(t *testing.T) {
			setupRecallRepositoryTestDB(t)
			campaign := newRecallRepositoryCampaign("protected transition")
			campaign.CreatedBy = 41
			campaign.CreatedAt = 42
			require.NoError(t, CreateRecallCampaign(&campaign))

			transitioned, err := TransitionRecallCampaign(
				campaign.Id,
				[]string{RecallCampaignDraft},
				RecallCampaignScheduled,
				map[string]any{field: 999},
			)
			require.Error(t, err)
			require.False(t, transitioned)

			stored, err := GetRecallCampaignByID(campaign.Id)
			require.NoError(t, err)
			require.Equal(t, RecallCampaignDraft, stored.Status)
			require.Equal(t, 41, stored.CreatedBy)
			require.Equal(t, int64(42), stored.CreatedAt)
		})
	}
}

func TestRecallRepositoryInsertAndListRecipients(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("recipient campaign")
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{CampaignId: campaign.Id, UserId: 101, EligibilitySnapshot: `{}`, EmailSnapshot: "one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{CampaignId: campaign.Id, UserId: 102, EligibilitySnapshot: `{}`, EmailSnapshot: "two@example.com", LanguageSnapshot: "zh", State: RecallRecipientQueued},
	}
	runEvent := RecallEvent{CampaignId: campaign.Id, EventType: "campaign_run", Source: "worker", SourceEventId: "run-1", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, nil, runEvent)
	require.NoError(t, err)
	require.Equal(t, 2, inserted)

	inserted, err = InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, nil, RecallEvent{
		CampaignId: campaign.Id, EventType: "campaign_run", Source: "worker", SourceEventId: "run-2", EventData: `{}`,
	})
	require.NoError(t, err)
	require.Zero(t, inserted)

	page, total, err := ListRecallRecipients(campaign.Id, 1, 1)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	require.Len(t, page, 1)
	require.Equal(t, 102, page[0].UserId)

	inserted, err = InsertRecallRecipientsAndRunEvent(campaign.Id, []RecallRecipient{
		{CampaignId: campaign.Id, UserId: 103, EligibilitySnapshot: `{}`, EmailSnapshot: "three@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}, nil, runEvent)
	require.NoError(t, err)
	require.Zero(t, inserted)
	_, total, err = ListRecallRecipients(campaign.Id, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total, "a duplicate run event must roll back recipient inserts")
}

func TestRecallRepositoryReadListsAreBoundedAndExportUsesSnapshotKeyset(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaigns := make([]RecallCampaign, 101)
	for i := range campaigns {
		campaigns[i] = newRecallRepositoryCampaign("bounded campaign")
	}
	require.NoError(t, DB.Create(&campaigns).Error)
	target := campaigns[0]

	recipients := make([]RecallRecipient, 101)
	events := make([]RecallEvent, 101)
	for i := range recipients {
		recipients[i] = RecallRecipient{
			CampaignId:          target.Id,
			UserId:              10_000 + i,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "bounded@example.com",
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		}
		events[i] = RecallEvent{
			CampaignId:    target.Id,
			EventType:     "bounded_event",
			Source:        "bounded_test",
			SourceEventId: strconv.Itoa(i),
			EventData:     `{}`,
		}
	}
	require.NoError(t, DB.Create(&recipients).Error)
	require.NoError(t, DB.Create(&events).Error)

	for _, limit := range []int{-1, 0} {
		campaignPage, total, err := ListRecallCampaignsWithContext(context.Background(), "", 0, limit)
		require.NoError(t, err)
		require.Equal(t, int64(101), total)
		require.Empty(t, campaignPage)

		recipientPage, total, err := ListRecallRecipientsWithContext(context.Background(), target.Id, 0, limit, "")
		require.NoError(t, err)
		require.Equal(t, int64(101), total)
		require.Empty(t, recipientPage)

		eventPage, total, err := ListRecallEventsWithContext(context.Background(), target.Id, 0, limit)
		require.NoError(t, err)
		require.Equal(t, int64(101), total)
		require.Empty(t, eventPage)
	}

	campaignPage, _, err := ListRecallCampaignsWithContext(context.Background(), "", 0, 1_000)
	require.NoError(t, err)
	require.Len(t, campaignPage, 100)
	recipientPage, _, err := ListRecallRecipientsWithContext(context.Background(), target.Id, 0, 1_000, "")
	require.NoError(t, err)
	require.Len(t, recipientPage, 100)
	eventPage, _, err := ListRecallEventsWithContext(context.Background(), target.Id, 0, 1_000)
	require.NoError(t, err)
	require.Len(t, eventPage, 100)

	snapshot, err := GetRecallRecipientExportSnapshotWithContext(context.Background(), target.Id)
	require.NoError(t, err)
	require.Equal(t, int64(101), snapshot.Total)
	require.Equal(t, recipients[len(recipients)-1].Id, snapshot.MaxID)

	postSnapshot := RecallRecipient{
		CampaignId:          target.Id,
		UserId:              20_000,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "post-snapshot@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	require.NoError(t, DB.Create(&postSnapshot).Error)

	firstPage, err := ListRecallRecipientsForExportWithContext(context.Background(), target.Id, 0, snapshot.MaxID, 60)
	require.NoError(t, err)
	require.Len(t, firstPage, 60)
	secondPage, err := ListRecallRecipientsForExportWithContext(context.Background(), target.Id, firstPage[len(firstPage)-1].Id, snapshot.MaxID, 60)
	require.NoError(t, err)
	require.Len(t, secondPage, 41)
	require.Equal(t, snapshot.MaxID, secondPage[len(secondPage)-1].Id)
	require.NotEqual(t, postSnapshot.Id, secondPage[len(secondPage)-1].Id)
}

func TestRecallRepositoryMaskPromotionCode(t *testing.T) {
	require.Equal(t, "ABCD****YZ", MaskPromotionCode("ABCDEFGHIJKLYZ"))
	require.Equal(t, "........", MaskPromotionCode("ABCDEFGH"))
	require.Equal(t, "........", MaskPromotionCode("short"))
}

func TestRecallLeaseMessageHasOneWinnerAndRecoversAfterExpiry(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := RecallMessage{
		RecipientId:      101,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      1_721_000_000,
		State:            RecallMessageScheduled,
	}
	require.NoError(t, DB.Create(&message).Error)

	now := int64(1_721_000_000)
	won, err := LeaseRecallMessage(message.Id, "node-a", now, now+60)
	require.NoError(t, err)
	require.True(t, won)

	won, err = LeaseRecallMessage(message.Id, "node-b", now, now+60)
	require.NoError(t, err)
	require.False(t, won)

	won, err = LeaseRecallMessage(message.Id, "node-b", now+61, now+121)
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageLeased, stored.State)
	require.Equal(t, "node-b", stored.LeaseOwner)
	require.Equal(t, now+121, stored.LeaseExpiresAt)
}

func TestRecallLeaseRecipientHasExactlyOneConcurrentWinner(t *testing.T) {
	setupRecallRepositoryFileDB(t)

	recipient := RecallRecipient{
		CampaignId:          1,
		UserId:              201,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "lease@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	type leaseResult struct {
		owner string
		won   bool
		err   error
	}
	start := make(chan struct{})
	results := make(chan leaseResult, 2)
	var workers sync.WaitGroup
	for _, owner := range []string{"node-a", "node-b"} {
		workers.Add(1)
		go func(owner string) {
			defer workers.Done()
			<-start
			won, err := LeaseRecallRecipient(recipient.Id, owner, 1_721_000_000, 1_721_000_060)
			results <- leaseResult{owner: owner, won: won, err: err}
		}(owner)
	}
	close(start)
	workers.Wait()
	close(results)

	winners := make([]string, 0, 1)
	for result := range results {
		require.NoError(t, result.err)
		if result.won {
			winners = append(winners, result.owner)
		}
	}
	require.Len(t, winners, 1)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallRecipientQueued, stored.State, "a lease must not become durable workflow state")
	require.Equal(t, winners[0], stored.LeaseOwner)

	require.NoError(t, ReleaseRecallRecipientLease(recipient.Id, "not-the-owner", 1_721_000_060))
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, winners[0], stored.LeaseOwner)
	require.NoError(t, ReleaseRecallRecipientLease(recipient.Id, winners[0], 1_721_000_060))
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallCampaignCapacityLeaseSerializesDistinctRecipientsOnSQLite(t *testing.T) {
	setupRecallRepositoryFileDB(t)

	for iteration := 0; iteration < 20; iteration++ {
		campaign := newRecallRepositoryCampaign("campaign capacity lease")
		campaign.WorkerConcurrency = 1
		require.NoError(t, DB.Create(&campaign).Error)
		recipients := []RecallRecipient{
			{
				CampaignId: campaign.Id, UserId: iteration*2 + 1, EligibilitySnapshot: `{}`,
				EmailSnapshot: "capacity-a@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued,
			},
			{
				CampaignId: campaign.Id, UserId: iteration*2 + 2, EligibilitySnapshot: `{}`,
				EmailSnapshot: "capacity-b@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued,
			},
		}
		require.NoError(t, DB.Create(&recipients).Error)

		type leaseResult struct {
			won bool
			err error
		}
		start := make(chan struct{})
		results := make(chan leaseResult, len(recipients))
		var workers sync.WaitGroup
		for i := range recipients {
			recipient := recipients[i]
			owner := "node-a"
			if i == 1 {
				owner = "node-b"
			}
			workers.Add(1)
			go func() {
				defer workers.Done()
				<-start
				won, err := TryLeaseRecallRecipientWithinCampaignCapacity(
					context.Background(), recipient.Id, owner, 1_721_000_000, 1_721_000_060,
				)
				results <- leaseResult{won: won, err: err}
			}()
		}
		close(start)
		workers.Wait()
		close(results)

		winners := 0
		for result := range results {
			require.NoError(t, result.err)
			if result.won {
				winners++
			}
		}
		require.Equal(t, 1, winners)
	}
}

func TestRecallLeaseRecipientFencesSameOwnerReacquisition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipient := RecallRecipient{
		CampaignId:          1,
		UserId:              251,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "fence@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	requireLease, err := LeaseRecallRecipient(recipient.Id, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, requireLease)
	requireLease, err = LeaseRecallRecipient(recipient.Id, "node-a", 161, 221)
	require.NoError(t, err)
	require.True(t, requireLease)

	require.NoError(t, ReleaseRecallRecipientLease(recipient.Id, "node-a", 160))
	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, "node-a", stored.LeaseOwner)
	require.Equal(t, int64(221), stored.LeaseExpiresAt)

	require.NoError(t, ReleaseRecallRecipientLease(recipient.Id, "node-a", 221))
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallLeaseListsOnlyDueProvisioningAndMessageWork(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	now := int64(1_721_000_000)
	recipients := []RecallRecipient{
		{CampaignId: 1, UserId: 301, EligibilitySnapshot: `{}`, EmailSnapshot: "queued@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{CampaignId: 1, UserId: 302, EligibilitySnapshot: `{}`, EmailSnapshot: "customer@example.com", LanguageSnapshot: "en", State: RecallRecipientCustomerReady, LeaseOwner: "old", LeaseExpiresAt: now - 1},
		{CampaignId: 1, UserId: 303, EligibilitySnapshot: `{}`, EmailSnapshot: "code@example.com", LanguageSnapshot: "en", State: RecallRecipientCodeReady, LeaseOwner: "live", LeaseExpiresAt: now + 1},
		{CampaignId: 1, UserId: 304, EligibilitySnapshot: `{}`, EmailSnapshot: "contacting@example.com", LanguageSnapshot: "en", State: RecallRecipientContacting},
		{CampaignId: 1, UserId: 305, EligibilitySnapshot: `{}`, EmailSnapshot: "terminal@example.com", LanguageSnapshot: "en", State: RecallRecipientConverted},
	}
	require.NoError(t, DB.Create(&recipients).Error)

	recipientIDs, err := ListDueRecallRecipientIDs(now, 1)
	require.NoError(t, err)
	require.Equal(t, []int64{recipients[0].Id}, recipientIDs)
	recipientIDs, err = ListDueRecallRecipientIDs(now, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{recipients[0].Id, recipients[1].Id}, recipientIDs)

	messages := []RecallMessage{
		{RecipientId: recipients[0].Id, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now, State: RecallMessageScheduled},
		{RecipientId: recipients[0].Id, StageNo: 2, TemplateSnapshot: `{}`, ScheduledAt: now + 1, State: RecallMessageScheduled},
		{RecipientId: recipients[1].Id, StageNo: 1, TemplateSnapshot: `{}`, NextAttemptAt: now, State: RecallMessageRetryWait},
		{RecipientId: recipients[1].Id, StageNo: 2, TemplateSnapshot: `{}`, NextAttemptAt: now + 1, State: RecallMessageRetryWait},
		{RecipientId: recipients[2].Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "old", LeaseExpiresAt: now - 1},
		{RecipientId: recipients[2].Id, StageNo: 2, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "live", LeaseExpiresAt: now + 1},
		{RecipientId: recipients[3].Id, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now, State: RecallMessageAccepted},
		{RecipientId: recipients[4].Id, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now, State: RecallMessageCancelled},
		{RecipientId: recipients[4].Id, StageNo: 2, TemplateSnapshot: `{}`, State: RecallMessageSending, LeaseOwner: "sender", LeaseExpiresAt: now - 1},
	}
	require.NoError(t, DB.Create(&messages).Error)

	messageIDs, err := ListDueRecallMessageIDs(now, 2)
	require.NoError(t, err)
	require.Equal(t, []int64{messages[0].Id, messages[2].Id}, messageIDs)
	messageIDs, err = ListDueRecallMessageIDs(now, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{messages[0].Id, messages[2].Id, messages[4].Id}, messageIDs)
	won, err := LeaseRecallMessage(messages[8].Id, "new-sender", now, now+60)
	require.NoError(t, err)
	require.False(t, won)
}

func TestListDueRecallMessagesOrdersByEffectiveDueTimeThenID(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	now := int64(1_721_000_000)
	messages := []RecallMessage{
		{RecipientId: 501, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now - 10, State: RecallMessageScheduled},
		{RecipientId: 502, StageNo: 1, TemplateSnapshot: `{}`, NextAttemptAt: now - 30, State: RecallMessageRetryWait},
		{RecipientId: 503, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "old", LeaseExpiresAt: now - 20},
		{RecipientId: 504, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now - 30, State: RecallMessageScheduled},
	}
	require.NoError(t, DB.Create(&messages).Error)

	due, err := ListDueRecallMessages(now, 10)
	require.NoError(t, err)
	require.Equal(t, []RecallDueMessage{
		{ID: messages[1].Id, State: RecallMessageRetryWait, EffectiveDueAt: now - 30},
		{ID: messages[3].Id, State: RecallMessageScheduled, EffectiveDueAt: now - 30},
		{ID: messages[2].Id, State: RecallMessageLeased, EffectiveDueAt: now - 20, PreviousLeaseExpires: now - 20},
		{ID: messages[0].Id, State: RecallMessageScheduled, EffectiveDueAt: now - 10},
	}, due)
}

func TestReleaseRecallMessageLeaseRestoresScheduledAndRetryStates(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	now := int64(1_721_000_000)
	messages := []RecallMessage{
		{RecipientId: 511, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: now - 30, State: RecallMessageScheduled, AttemptCount: 1},
		{RecipientId: 512, StageNo: 1, TemplateSnapshot: `{}`, NextAttemptAt: now - 20, State: RecallMessageRetryWait, AttemptCount: 2},
		{RecipientId: 513, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "expired-owner", LeaseExpiresAt: now - 10, AttemptCount: 3},
	}
	require.NoError(t, DB.Create(&messages).Error)
	due, err := ListDueRecallMessages(now, 10)
	require.NoError(t, err)
	require.Len(t, due, len(messages))
	expectedAttempts := make(map[int64]int, len(messages))
	for _, message := range messages {
		expectedAttempts[message.Id] = message.AttemptCount
	}

	for _, candidate := range due {
		leaseUntil := now + 60 + candidate.ID
		won, err := LeaseDueRecallMessage(candidate, "quota-worker", now, leaseUntil)
		require.NoError(t, err)
		require.True(t, won)

		released, err := ReleaseRecallMessageLeaseWithContext(
			context.Background(), candidate.ID, "quota-worker", leaseUntil, candidate,
		)
		require.NoError(t, err)
		require.True(t, released)

		var stored RecallMessage
		require.NoError(t, DB.First(&stored, candidate.ID).Error)
		if candidate.State == RecallMessageLeased {
			require.Equal(t, RecallMessageRetryWait, stored.State)
			require.Equal(t, leaseUntil, stored.NextAttemptAt)
		} else {
			require.Equal(t, candidate.State, stored.State)
		}
		require.Empty(t, stored.LeaseOwner)
		require.Zero(t, stored.LeaseExpiresAt)
		require.Equal(t, expectedAttempts[candidate.ID], stored.AttemptCount)
	}

	require.Equal(t, now-30, loadRecallMessageForRepositoryTest(t, messages[0].Id).ScheduledAt)
	require.Equal(t, now-20, loadRecallMessageForRepositoryTest(t, messages[1].Id).NextAttemptAt)
}

func loadRecallMessageForRepositoryTest(t *testing.T, id int64) RecallMessage {
	t.Helper()
	var message RecallMessage
	require.NoError(t, DB.First(&message, id).Error)
	return message
}

func TestRecallLeaseMessageRejectsStaleListingAfterFutureRetryTransition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	now := int64(1_721_000_000)
	message := RecallMessage{
		RecipientId:      351,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      now,
		State:            RecallMessageScheduled,
	}
	require.NoError(t, DB.Create(&message).Error)
	dueIDs, err := ListDueRecallMessageIDs(now, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{message.Id}, dueIDs)

	require.NoError(t, DB.Model(&RecallMessage{}).
		Where("id = ?", message.Id).
		Updates(map[string]any{
			"state":           RecallMessageRetryWait,
			"next_attempt_at": now + 60,
		}).Error)
	won, err := LeaseRecallMessage(message.Id, "stale-worker", now, now+30)
	require.NoError(t, err)
	require.False(t, won)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageRetryWait, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallRunIdempotencyInsertsRecipientsMessagesAndEventOnce(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("idempotent run")
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{UserId: 401, EligibilitySnapshot: `{}`, EmailSnapshot: "one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 402, EligibilitySnapshot: `{}`, EmailSnapshot: "two@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"subject":"one"}`, ScheduledAt: 1_721_000_000, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"subject":"two"}`, ScheduledAt: 1_721_000_000, State: RecallMessageScheduled},
	}
	runEvent := RecallEvent{
		EventType:     "campaign_run",
		Source:        "scheduler",
		SourceEventId: "recurring:7:1721000000",
		EventData:     `{}`,
	}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.NoError(t, err)
	require.Equal(t, 2, inserted)
	inserted, err = InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.NoError(t, err)
	require.Zero(t, inserted)

	var storedRecipients []RecallRecipient
	require.NoError(t, DB.Order("id ASC").Find(&storedRecipients).Error)
	require.Len(t, storedRecipients, 2)
	require.Equal(t, campaign.Id, storedRecipients[0].CampaignId)
	require.Equal(t, campaign.Id, storedRecipients[1].CampaignId)
	var storedMessages []RecallMessage
	require.NoError(t, DB.Order("id ASC").Find(&storedMessages).Error)
	require.Len(t, storedMessages, 2)
	require.Equal(t, storedRecipients[0].Id, storedMessages[0].RecipientId)
	require.Equal(t, storedRecipients[1].Id, storedMessages[1].RecipientId)
	var eventCount int64
	require.NoError(t, DB.Model(&RecallEvent{}).Count(&eventCount).Error)
	require.Equal(t, int64(1), eventCount)
}

func TestRecallRunIdempotencyMixedRecipientConflictBindsMessagesByUser(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("mixed recipient run")
	require.NoError(t, CreateRecallCampaign(&campaign))
	existing := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              451,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "existing@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientQueued,
	}
	require.NoError(t, DB.Create(&existing).Error)
	recipients := []RecallRecipient{
		{UserId: existing.UserId, EligibilitySnapshot: `{}`, EmailSnapshot: existing.EmailSnapshot, LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 452, EligibilitySnapshot: `{}`, EmailSnapshot: "new@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"recipient":"existing"}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"recipient":"new"}`, State: RecallMessageScheduled},
	}
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "recurring:mixed:1721000000", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.NoError(t, err)
	require.Equal(t, 1, inserted)

	var storedRecipients []RecallRecipient
	require.NoError(t, DB.Where("campaign_id = ?", campaign.Id).Find(&storedRecipients).Error)
	recipientByID := make(map[int64]RecallRecipient, len(storedRecipients))
	for _, recipient := range storedRecipients {
		recipientByID[recipient.Id] = recipient
	}
	var storedMessages []RecallMessage
	require.NoError(t, DB.Order("id ASC").Find(&storedMessages).Error)
	require.Len(t, storedMessages, 2)
	messageUsers := make(map[string]int, len(storedMessages))
	for _, message := range storedMessages {
		messageUsers[message.TemplateSnapshot] = recipientByID[message.RecipientId].UserId
	}
	require.Equal(t, existing.UserId, messageUsers[`{"recipient":"existing"}`])
	require.Equal(t, 452, messageUsers[`{"recipient":"new"}`])
}

func TestRecallRunIdentityAlignsEmailOnlyRecipientsAndReplays(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("email identity run")
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "alpha@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "beta@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"recipient":"alpha"}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"recipient":"beta"}`, State: RecallMessageScheduled},
	}
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "identity:insert", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.NoError(t, err)
	require.Equal(t, 2, inserted)
	inserted, err = InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.NoError(t, err)
	require.Zero(t, inserted)

	var storedRecipients []RecallRecipient
	require.NoError(t, DB.Where("campaign_id = ?", campaign.Id).Find(&storedRecipients).Error)
	require.Len(t, storedRecipients, 2)
	recipientByID := make(map[int64]RecallRecipient, len(storedRecipients))
	for _, recipient := range storedRecipients {
		recipientByID[recipient.Id] = recipient
	}
	var storedMessages []RecallMessage
	require.NoError(t, DB.Order("id ASC").Find(&storedMessages).Error)
	require.Len(t, storedMessages, 2)
	messageIdentities := make(map[string]string, len(storedMessages))
	for _, message := range storedMessages {
		messageIdentities[message.TemplateSnapshot] = recipientByID[message.RecipientId].RecipientIdentity
	}
	require.Equal(t, RecallRecipientIdentityForEmail("alpha@example.com"), messageIdentities[`{"recipient":"alpha"}`])
	require.Equal(t, RecallRecipientIdentityForEmail("beta@example.com"), messageIdentities[`{"recipient":"beta"}`])
}

func TestRecallRunRejectsDuplicateIdentityInputsBeforeWrites(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("duplicate identity run")
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "duplicate@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: " DUPLICATE@example.com ", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"recipient":"first"}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"recipient":"second"}`, State: RecallMessageScheduled},
	}
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "identity:duplicate", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(campaign.Id, recipients, messages, runEvent)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate recipient identity")
	require.Zero(t, inserted)
	requireRecallRunTablesEmpty(t)
}

func TestRecallRunCommitIdentityAlignsEmailOnlyRecipientsAndReplays(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("email identity commit")
	campaign.Status = RecallCampaignScheduled
	campaign.NextRunAt = 1_721_000_000
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "commit-alpha@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "commit-beta@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"recipient":"commit-alpha"}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"recipient":"commit-beta"}`, State: RecallMessageScheduled},
	}
	expectedNextRunAt := campaign.NextRunAt
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "identity:commit", EventData: `{}`}

	committed, inserted, err := CommitRecallCampaignRun(
		context.Background(),
		campaign.Id,
		[]string{RecallCampaignScheduled},
		RecallCampaignRunning,
		&expectedNextRunAt,
		campaign.ConfigRevision,
		map[string]any{"next_run_at": int64(0)},
		recipients,
		messages,
		runEvent,
	)
	require.NoError(t, err)
	require.True(t, committed)
	require.Equal(t, 2, inserted)

	committed, inserted, err = CommitRecallCampaignRun(
		context.Background(),
		campaign.Id,
		[]string{RecallCampaignScheduled},
		RecallCampaignRunning,
		&expectedNextRunAt,
		campaign.ConfigRevision,
		map[string]any{"next_run_at": int64(0)},
		recipients,
		messages,
		runEvent,
	)
	require.NoError(t, err)
	require.False(t, committed)
	require.Zero(t, inserted)

	var storedRecipients []RecallRecipient
	require.NoError(t, DB.Where("campaign_id = ?", campaign.Id).Find(&storedRecipients).Error)
	require.Len(t, storedRecipients, 2)
	recipientByID := make(map[int64]RecallRecipient, len(storedRecipients))
	for _, recipient := range storedRecipients {
		recipientByID[recipient.Id] = recipient
	}
	var storedMessages []RecallMessage
	require.NoError(t, DB.Order("id ASC").Find(&storedMessages).Error)
	require.Len(t, storedMessages, 2)
	messageIdentities := make(map[string]string, len(storedMessages))
	for _, message := range storedMessages {
		messageIdentities[message.TemplateSnapshot] = recipientByID[message.RecipientId].RecipientIdentity
	}
	require.Equal(t, RecallRecipientIdentityForEmail("commit-alpha@example.com"), messageIdentities[`{"recipient":"commit-alpha"}`])
	require.Equal(t, RecallRecipientIdentityForEmail("commit-beta@example.com"), messageIdentities[`{"recipient":"commit-beta"}`])
}

func TestRecallCampaignRunRejectsDuplicateIdentityInputsBeforeWrites(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("duplicate identity commit")
	campaign.Status = RecallCampaignScheduled
	campaign.NextRunAt = 1_721_000_000
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipients := []RecallRecipient{
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: "commit-duplicate@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 0, EligibilitySnapshot: `{}`, EmailSnapshot: " COMMIT-DUPLICATE@example.com ", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{
		{StageNo: 1, TemplateSnapshot: `{"recipient":"first"}`, State: RecallMessageScheduled},
		{StageNo: 1, TemplateSnapshot: `{"recipient":"second"}`, State: RecallMessageScheduled},
	}
	expectedNextRunAt := campaign.NextRunAt
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "identity:duplicate-commit", EventData: `{}`}

	committed, inserted, err := CommitRecallCampaignRun(
		context.Background(),
		campaign.Id,
		[]string{RecallCampaignScheduled},
		RecallCampaignRunning,
		&expectedNextRunAt,
		campaign.ConfigRevision,
		map[string]any{"next_run_at": int64(0)},
		recipients,
		messages,
		runEvent,
	)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate recipient identity")
	require.False(t, committed)
	require.Zero(t, inserted)

	var storedCampaign RecallCampaign
	require.NoError(t, DB.First(&storedCampaign, campaign.Id).Error)
	require.Equal(t, RecallCampaignScheduled, storedCampaign.Status)
	requireRecallRunTablesEmpty(t)
}

func TestRecallRunIdempotencyCommitsLargeSnapshotsInBoundedBatches(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("large snapshot run")
	campaign.Status = RecallCampaignScheduled
	campaign.NextRunAt = 1_721_000_000
	require.NoError(t, CreateRecallCampaign(&campaign))
	const total = 3000
	recipients := make([]RecallRecipient, total)
	messages := make([]RecallMessage, total)
	for i := 0; i < total; i++ {
		recipients[i] = RecallRecipient{
			UserId:              i + 1,
			EligibilitySnapshot: `{}`,
			EmailSnapshot:       "large@example.com",
			LanguageSnapshot:    "en",
			State:               RecallRecipientQueued,
		}
		messages[i] = RecallMessage{
			StageNo:          1,
			TemplateVersion:  1,
			TemplateSnapshot: `{"subject":"large"}`,
			State:            RecallMessageScheduled,
		}
	}
	expectedNextRunAt := campaign.NextRunAt
	committed, inserted, err := CommitRecallCampaignRun(
		context.Background(),
		campaign.Id,
		[]string{RecallCampaignScheduled},
		RecallCampaignRunning,
		&expectedNextRunAt,
		campaign.ConfigRevision,
		map[string]any{"next_run_at": int64(0)},
		recipients,
		messages,
		RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "large:run", EventData: `{}`},
	)

	require.NoError(t, err)
	require.True(t, committed)
	require.Equal(t, total, inserted)
	for _, table := range []any{&RecallRecipient{}, &RecallMessage{}} {
		var count int64
		require.NoError(t, DB.Model(table).Count(&count).Error)
		require.EqualValues(t, total, count)
	}
	var eventCount int64
	require.NoError(t, DB.Model(&RecallEvent{}).Count(&eventCount).Error)
	require.EqualValues(t, 1, eventCount)
}

func TestRecallRunIdempotencyRejectsAmbiguousMessageMapping(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	recipients := []RecallRecipient{
		{UserId: 501, EligibilitySnapshot: `{}`, EmailSnapshot: "one@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
		{UserId: 502, EligibilitySnapshot: `{}`, EmailSnapshot: "two@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued},
	}
	messages := []RecallMessage{{StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageScheduled}}
	runEvent := RecallEvent{EventType: "campaign_run", Source: "scheduler", SourceEventId: "recurring:8:1721000000", EventData: `{}`}

	inserted, err := InsertRecallRecipientsAndRunEvent(8, recipients, messages, runEvent)
	require.Error(t, err)
	require.Zero(t, inserted)
	for _, table := range []any{&RecallRecipient{}, &RecallMessage{}, &RecallEvent{}} {
		var count int64
		require.NoError(t, DB.Model(table).Count(&count).Error)
		require.Zero(t, count)
	}
}

func TestRecallRunIdempotencySchedulesNextStagesOnce(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	messages := []RecallMessage{
		{RecipientId: 999, StageNo: 2, TemplateSnapshot: `{"stage":2}`, State: RecallMessageScheduled},
		{StageNo: 3, TemplateSnapshot: `{"stage":3}`, State: RecallMessageScheduled},
	}
	require.NoError(t, ScheduleNextRecallStages(601, messages))
	require.NoError(t, ScheduleNextRecallStages(601, messages))

	var stored []RecallMessage
	require.NoError(t, DB.Order("stage_no ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	require.Equal(t, 601, int(stored[0].RecipientId))
	require.Equal(t, 601, int(stored[1].RecipientId))
}

func TestRecallRunIdempotencyMySQLUsesInsertIgnoreForRunOwnership(t *testing.T) {
	sqliteDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := sqliteDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	require.NoError(t, err)

	result := insertRecallRunEvent(mysqlDB, &RecallEvent{
		CampaignId:    9,
		EventType:     "campaign_run",
		Source:        "scheduler",
		SourceEventId: "recurring:9:1721000000",
		EventData:     `{}`,
	})
	require.NoError(t, result.Error)
	sql := result.Statement.SQL.String()
	require.Contains(t, sql, "INSERT IGNORE INTO")
	require.NotContains(t, sql, "ON DUPLICATE KEY UPDATE")
}

func TestRecallTransitionCampaignRequiresExpectedState(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("conditional transition")
	require.NoError(t, CreateRecallCampaign(&campaign))

	won, err := TransitionRecallCampaign(campaign.Id, []string{RecallCampaignRunning}, RecallCampaignPaused, nil)
	require.NoError(t, err)
	require.False(t, won)
	won, err = TransitionRecallCampaign(campaign.Id, []string{RecallCampaignDraft}, RecallCampaignScheduled, map[string]any{"next_run_at": int64(701)})
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallCampaign
	require.NoError(t, DB.First(&stored, campaign.Id).Error)
	require.Equal(t, RecallCampaignScheduled, stored.Status)
	require.Equal(t, int64(701), stored.NextRunAt)
}

func TestRecallTransitionMessageRequiresLeaseOwnerAndExactState(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := RecallMessage{RecipientId: 701, StageNo: 1, TemplateSnapshot: `{}`, ScheduledAt: 800, State: RecallMessageScheduled}
	require.NoError(t, DB.Create(&message).Error)
	won, err := LeaseRecallMessage(message.Id, "node-a", 800, 860)
	require.NoError(t, err)
	require.True(t, won)

	won, err = CompleteRecallMessageLease(message.Id, "node-b", 860, RecallMessageLeased, RecallMessageAccepted, map[string]any{"accepted_at": int64(810)})
	require.NoError(t, err)
	require.False(t, won)
	won, err = CompleteRecallMessageLease(message.Id, "node-a", 860, RecallMessageScheduled, RecallMessageAccepted, map[string]any{"accepted_at": int64(810)})
	require.NoError(t, err)
	require.False(t, won)
	won, err = CompleteRecallMessageLease(message.Id, "node-a", 860, RecallMessageLeased, RecallMessageAccepted, map[string]any{
		"accepted_at":         int64(810),
		"provider_message_id": "provider-701",
	})
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageAccepted, stored.State)
	require.Equal(t, int64(810), stored.AcceptedAt)
	require.Equal(t, "provider-701", stored.ProviderMessageId)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallTransitionMessageFencesSameOwnerReacquisition(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	message := RecallMessage{
		RecipientId:      725,
		StageNo:          1,
		TemplateSnapshot: `{}`,
		ScheduledAt:      100,
		State:            RecallMessageScheduled,
	}
	require.NoError(t, DB.Create(&message).Error)
	won, err := LeaseRecallMessage(message.Id, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, won)
	won, err = LeaseRecallMessage(message.Id, "node-a", 161, 221)
	require.NoError(t, err)
	require.True(t, won)

	won, err = CompleteRecallMessageLease(message.Id, "node-a", 160, RecallMessageLeased, RecallMessageAccepted, map[string]any{"accepted_at": int64(170)})
	require.NoError(t, err)
	require.False(t, won)
	var stored RecallMessage
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageLeased, stored.State)
	require.Equal(t, "node-a", stored.LeaseOwner)
	require.Equal(t, int64(221), stored.LeaseExpiresAt)
	require.Zero(t, stored.AcceptedAt)

	won, err = CompleteRecallMessageLease(message.Id, "node-a", 221, RecallMessageLeased, RecallMessageAccepted, map[string]any{"accepted_at": int64(170)})
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageAccepted, stored.State)
	require.Equal(t, int64(170), stored.AcceptedAt)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallEmailWorkItemLoadsEmailOnlyRecipientWithoutUserRow(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	campaign := newRecallRepositoryCampaign("email only work item")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, DB.Create(&campaign).Error)
	recipient := RecallRecipient{
		CampaignId:          campaign.Id,
		UserId:              0,
		EligibilitySnapshot: `{}`,
		EmailSnapshot:       "email-only-work-item@example.com",
		LanguageSnapshot:    "en",
		State:               RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{
		RecipientId:      recipient.Id,
		StageNo:          1,
		TemplateVersion:  1,
		TemplateSnapshot: `{"en":{"subject":"Return","body_text":"Body"}}`,
		State:            RecallMessageLeased,
		LeaseOwner:       "email-worker",
		LeaseExpiresAt:   1_721_000_060,
	}
	require.NoError(t, DB.Create(&message).Error)

	item, err := GetRecallEmailWorkItemForLeaseWithContext(context.Background(), message.Id, "email-worker")

	require.NoError(t, err)
	require.Equal(t, message.Id, item.Message.Id)
	require.Equal(t, recipient.Id, item.Recipient.Id)
	require.Equal(t, campaign.Id, item.Campaign.Id)
	require.Zero(t, item.User.Id)

	boundRecipient := recipient
	boundRecipient.Id = 0
	boundRecipient.RecipientIdentity = ""
	boundRecipient.UserId = 999_999
	boundRecipient.EmailSnapshot = "missing-bound-user@example.com"
	require.NoError(t, DB.Create(&boundRecipient).Error)
	boundMessage := message
	boundMessage.Id = 0
	boundMessage.RecipientId = boundRecipient.Id
	require.NoError(t, DB.Create(&boundMessage).Error)

	_, err = GetRecallEmailWorkItemForLeaseWithContext(context.Background(), boundMessage.Id, "email-worker")
	require.Error(t, err)
}

func TestRecallTransitionMessageRejectsUnsupportedCompletionFieldsWithoutWrite(t *testing.T) {
	for _, field := range []string{
		"id",
		"recipient_id",
		"stage_no",
		"template_version",
		"template_snapshot",
		"scheduled_at",
		"state",
		"lease_owner",
		"lease_expires_at",
		"created_at",
		"updated_at",
	} {
		t.Run(field, func(t *testing.T) {
			setupRecallRepositoryTestDB(t)

			message := RecallMessage{
				RecipientId:       751,
				StageNo:           1,
				TemplateVersion:   2,
				TemplateSnapshot:  `{"subject":"original"}`,
				ScheduledAt:       700,
				State:             RecallMessageLeased,
				LeaseOwner:        "node-a",
				LeaseExpiresAt:    760,
				LastErrorCode:     "original_code",
				LastErrorMessage:  "original message",
				ProviderMessageId: "original-provider",
			}
			require.NoError(t, DB.Create(&message).Error)
			var before RecallMessage
			require.NoError(t, DB.First(&before, message.Id).Error)

			won, err := CompleteRecallMessageLease(
				message.Id,
				"node-a",
				760,
				RecallMessageLeased,
				RecallMessageAccepted,
				map[string]any{field: 999},
			)
			require.Error(t, err)
			require.False(t, won)

			var after RecallMessage
			require.NoError(t, DB.First(&after, message.Id).Error)
			require.Equal(t, before, after)
		})
	}
}

func TestRecallTransitionCancelsAllUnsentMessagesAndClearsRetryMetadata(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	states := []string{
		RecallMessageScheduled,
		RecallMessageRetryWait,
		RecallMessageLeased,
		RecallMessageSending,
		RecallMessageAccepted,
		RecallMessageUncertain,
		RecallMessageFailed,
		RecallMessageCancelled,
	}
	messages := make([]RecallMessage, 0, len(states))
	for i, state := range states {
		messages = append(messages, RecallMessage{
			RecipientId:       801,
			StageNo:           i + 1,
			TemplateSnapshot:  `{}`,
			State:             state,
			NextAttemptAt:     850,
			LeaseOwner:        "node-a",
			LeaseExpiresAt:    875,
			LastErrorMessage:  "stale",
			ProviderMessageId: "provider-id",
		})
	}
	require.NoError(t, DB.Create(&messages).Error)

	cancelled, err := CancelPendingRecallMessages(801, "recipient_converted", 900)
	require.NoError(t, err)
	require.Equal(t, int64(4), cancelled)

	var stored []RecallMessage
	require.NoError(t, DB.Order("stage_no ASC").Find(&stored).Error)
	for _, message := range stored[:4] {
		require.Equal(t, RecallMessageCancelled, message.State)
		require.Equal(t, "recipient_converted", message.LastErrorCode)
		require.Equal(t, int64(900), message.FailedAt)
		require.Zero(t, message.NextAttemptAt)
		require.Empty(t, message.LeaseOwner)
		require.Zero(t, message.LeaseExpiresAt)
		require.Empty(t, message.LastErrorMessage)
	}
	for i, state := range states[4:] {
		require.Equal(t, state, stored[i+4].State)
	}
}

func TestRecallManualRetrySendingRequiresAcknowledgementAndExpiredLease(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	messages := []RecallMessage{
		{RecipientId: 851, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageSending, LeaseOwner: "active", LeaseExpiresAt: 1_000},
		{RecipientId: 852, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageSending, LeaseOwner: "expired", LeaseExpiresAt: 998},
		{RecipientId: 853, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageSending},
	}
	require.NoError(t, DB.Create(&messages).Error)

	won, err := ManualRetryRecallMessageWithContext(context.Background(), messages[0].Id, true, 999)
	require.NoError(t, err)
	require.False(t, won, "an active sender must remain fenced")
	won, err = ManualRetryRecallMessageWithContext(context.Background(), messages[1].Id, false, 999)
	require.NoError(t, err)
	require.False(t, won, "an uncertain send requires explicit acknowledgement")
	won, err = ManualRetryRecallMessageWithContext(context.Background(), messages[1].Id, true, 999)
	require.NoError(t, err)
	require.True(t, won)
	won, err = ManualRetryRecallMessageWithContext(context.Background(), messages[2].Id, true, 999)
	require.NoError(t, err)
	require.False(t, won, "a missing lease is not an expired sending lease")

	var retried RecallMessage
	require.NoError(t, DB.First(&retried, messages[1].Id).Error)
	require.Equal(t, RecallMessageRetryWait, retried.State)
	require.Equal(t, int64(999), retried.NextAttemptAt)
	require.Empty(t, retried.LeaseOwner)
	require.Zero(t, retried.LeaseExpiresAt)
}

func TestRecallManualRetryExpiredSendingWritesAdminEventAndFencesActiveLease(t *testing.T) {
	setupRecallRepositoryTestDB(t)

	const now = int64(999)
	messages := []RecallMessage{
		{RecipientId: 861, StageNo: 1, TemplateVersion: 7, TemplateSnapshot: `{"en":{"subject":"snapshot"}}`, State: RecallMessageSending, LeaseOwner: "expired", LeaseExpiresAt: now - 1, UpdatedAt: 901},
		{RecipientId: 862, StageNo: 1, TemplateVersion: 8, TemplateSnapshot: `{"en":{"subject":"active"}}`, State: RecallMessageSending, LeaseOwner: "active", LeaseExpiresAt: now + 1, UpdatedAt: 902},
		{RecipientId: 863, StageNo: 1, TemplateVersion: 9, TemplateSnapshot: `{"en":{"subject":"missing"}}`, State: RecallMessageSending, UpdatedAt: 903},
	}
	require.NoError(t, DB.Create(&messages).Error)

	expiredEvent := RecallEvent{
		CampaignId:    41,
		RecipientId:   messages[0].RecipientId,
		EventType:     "recipient_retry",
		Source:        "admin",
		SourceEventId: "retry-expired-sending",
		EventData:     `{"previous_state":"sending","acknowledge_uncertain":true}`,
		CreatedAt:     now,
	}
	won, err := ManualRetryRecallMessageAndAdminEventWithContext(context.Background(), messages[0].Id, RecallMessageSending, messages[0].UpdatedAt, now, expiredEvent)
	require.NoError(t, err)
	require.True(t, won)

	activeEvent := expiredEvent
	activeEvent.RecipientId = messages[1].RecipientId
	activeEvent.SourceEventId = "retry-active-sending"
	won, err = ManualRetryRecallMessageAndAdminEventWithContext(context.Background(), messages[1].Id, RecallMessageSending, messages[1].UpdatedAt, now, activeEvent)
	require.NoError(t, err)
	require.False(t, won)

	missingEvent := expiredEvent
	missingEvent.RecipientId = messages[2].RecipientId
	missingEvent.SourceEventId = "retry-missing-sending-lease"
	won, err = ManualRetryRecallMessageAndAdminEventWithContext(context.Background(), messages[2].Id, RecallMessageSending, messages[2].UpdatedAt, now, missingEvent)
	require.NoError(t, err)
	require.False(t, won)

	var retried RecallMessage
	require.NoError(t, DB.First(&retried, messages[0].Id).Error)
	require.Equal(t, RecallMessageRetryWait, retried.State)
	require.Equal(t, now, retried.NextAttemptAt)
	require.Equal(t, 7, retried.TemplateVersion)
	require.Equal(t, messages[0].TemplateSnapshot, retried.TemplateSnapshot)
	require.Empty(t, retried.LeaseOwner)
	require.Zero(t, retried.LeaseExpiresAt)

	var active RecallMessage
	require.NoError(t, DB.First(&active, messages[1].Id).Error)
	require.Equal(t, RecallMessageSending, active.State)
	require.Equal(t, "active", active.LeaseOwner)
	require.Equal(t, now+1, active.LeaseExpiresAt)

	var events []RecallEvent
	require.NoError(t, DB.Order("id ASC").Find(&events).Error)
	require.Len(t, events, 1)
	require.Equal(t, expiredEvent.SourceEventId, events[0].SourceEventId)
}
