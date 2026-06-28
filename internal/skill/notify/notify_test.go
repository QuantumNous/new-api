package notify

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type capturedSend struct {
	UserID int
	Title  string
	Body   string
}

func TestSendWeeklyTopSkillsDigestPersonalizesAndSuppressesOptOut(t *testing.T) {
	db := notifyTestDB(t)
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	optedIn := createNotifyUser(t, db, 1, true)
	createNotifyUser(t, db, 2, false)

	writing := createNotifySkill(t, db, "writing-helper", "Writing Helper", "writing", enums.MonetizationTypeFree, now.Add(-48*time.Hour))
	coding := createNotifySkill(t, db, "coding-helper", "Coding Helper", "coding", enums.MonetizationTypeFree, now.Add(-24*time.Hour))
	require.NoError(t, skillmodel.EnableSkillForUser(db, int64(optedIn.Id), int64(optedIn.Id), writing.ID, "marketplace"))
	emitEnableEvent(t, db, now.Add(-2*time.Hour), int64(optedIn.Id), writing.ID)
	emitEnableEvent(t, db, now.Add(-3*time.Hour), 88, coding.ID)
	emitEnableEvent(t, db, now.Add(-4*time.Hour), 89, coding.ID)
	emitEnableEvent(t, db, now.Add(-5*time.Hour), 90, coding.ID)

	var sends []capturedSend
	results, err := SendWeeklyTopSkillsDigest(db, Options{
		Now:   now,
		Limit: 2,
		Sender: SenderFunc(func(user platformmodel.User, notification dto.Notify) error {
			sends = append(sends, capturedSend{UserID: user.Id, Title: notification.Title, Body: notification.Content})
			return nil
		}),
		Campaign: "dr103",
	})

	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.True(t, results[0].Sent)
	require.Len(t, results[0].Items, 2)
	assert.Equal(t, writing.ID, results[0].Items[0].SkillID, "category affinity should boost the user's writing skill above generic popularity")
	require.Len(t, sends, 1)
	assert.Equal(t, optedIn.Id, sends[0].UserID)
	assert.Contains(t, sends[0].Body, "Writing Helper")
	assert.Contains(t, sends[0].Body, "Coding Helper")

	var sentEvents int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND entry_point = ?", enums.SkillUsageEventTypeNotificationSent, enums.EntryPointDigest).
		Count(&sentEvents).Error)
	assert.Equal(t, int64(1), sentEvents)
}

func TestReengagementSendsSavedPromoAndLapsedUsageOnlyForOptedInUsers(t *testing.T) {
	db := notifyTestDB(t)
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	createNotifyUser(t, db, 1, true)
	createNotifyUser(t, db, 2, false)
	promoSkill := createNotifySkill(t, db, "promo-skill", "Promo Skill", "writing", enums.MonetizationTypeOneTime, now.Add(-10*24*time.Hour))
	lapsedSkill := createNotifySkill(t, db, "lapsed-skill", "Lapsed Skill", "coding", enums.MonetizationTypeFree, now.Add(-10*24*time.Hour))

	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    1,
		TenantID:  1,
		SkillID:   promoSkill.ID,
		Enabled:   true,
		EnabledAt: now.Add(-8 * 24 * time.Hour),
		Source:    "marketplace",
	}).Error)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:    2,
		TenantID:  2,
		SkillID:   promoSkill.ID,
		Enabled:   true,
		EnabledAt: now.Add(-8 * 24 * time.Hour),
		Source:    "marketplace",
	}).Error)
	oldUse := now.Add(-30 * 24 * time.Hour)
	require.NoError(t, db.Create(&skillmodel.UserEnabledSkill{
		UserID:     1,
		TenantID:   1,
		SkillID:    lapsedSkill.ID,
		Enabled:    true,
		EnabledAt:  now.Add(-40 * 24 * time.Hour),
		LastUsedAt: &oldUse,
		Source:     "marketplace",
	}).Error)

	var sends []capturedSend
	opts := Options{
		Now: now,
		Sender: SenderFunc(func(user platformmodel.User, notification dto.Notify) error {
			sends = append(sends, capturedSend{UserID: user.Id, Title: notification.Title, Body: notification.Content})
			return nil
		}),
		Campaign:  "dr103",
		Threshold: 14 * 24 * time.Hour,
	}
	promoResults, err := SendSavedSkillPromoReengagement(db, []PromoInput{{
		SkillID:       promoSkill.ID,
		PromoLabel:    "launch promo",
		OriginalPrice: 2,
		PromoPrice:    1,
	}}, opts)
	require.NoError(t, err)
	lapsedResults, err := SendLapsedUsageReengagement(db, opts)
	require.NoError(t, err)

	require.Len(t, promoResults, 2)
	assert.True(t, promoResults[0].Sent)
	assert.True(t, promoResults[1].Suppressed)
	require.Len(t, lapsedResults, 1)
	assert.True(t, lapsedResults[0].Sent)
	require.Len(t, sends, 2)
	assert.True(t, strings.Contains(sends[0].Body, "2.00 -> 1.00 USD") || strings.Contains(sends[1].Body, "2.00 -> 1.00 USD"))
	assert.True(t, strings.Contains(sends[0].Body, "Pick up where you left off") || strings.Contains(sends[1].Body, "Pick up where you left off"))

	var reengageEvents int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND entry_point = ?", enums.SkillUsageEventTypeNotificationSent, enums.EntryPointReengage).
		Count(&reengageEvents).Error)
	assert.Equal(t, int64(2), reengageEvents)
}

func TestRecordNotificationEngagementWritesOpenAndClickEvents(t *testing.T) {
	db := notifyTestDB(t)
	createNotifyUser(t, db, 1, true)
	skill := createNotifySkill(t, db, "tracked-skill", "Tracked Skill", "writing", enums.MonetizationTypeFree, time.Now().UTC())

	require.NoError(t, RecordNotificationEngagement(db, 1, nil, enums.EntryPointDigest, false, "dr103"))
	require.NoError(t, RecordNotificationEngagement(db, 1, &skill.ID, enums.EntryPointReengage, true, "dr103"))
	require.Error(t, RecordNotificationEngagement(db, 1, nil, enums.EntryPointMarketplaceCard, false, "bad"))

	var opened int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND entry_point = ?", enums.SkillUsageEventTypeNotificationOpened, enums.EntryPointDigest).
		Count(&opened).Error)
	assert.Equal(t, int64(1), opened)
	var clicked int64
	require.NoError(t, db.Model(&skillmodel.SkillUsageEvent{}).
		Where("event_type = ? AND entry_point = ? AND skill_id = ?", enums.SkillUsageEventTypeNotificationClicked, enums.EntryPointReengage, skill.ID).
		Count(&clicked).Error)
	assert.Equal(t, int64(1), clicked)
}

func notifyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}))
	require.NoError(t, skillmodel.MigrateSkills(db))
	require.NoError(t, skillmodel.MigrateUserEnabledSkills(db))
	require.NoError(t, skillmodel.MigrateSkillUsageEvents(db))
	return db
}

func createNotifyUser(t *testing.T, db *gorm.DB, id int, optedIn bool) platformmodel.User {
	t.Helper()
	user := platformmodel.User{
		Id:          id,
		Username:    "user-" + string(rune('a'+id)),
		Password:    "password123",
		DisplayName: "User",
		Email:       "user@example.com",
		Group:       "default",
		AffCode:     fmt.Sprintf("aff-%d", id),
	}
	user.SetSetting(dto.UserSetting{MarketingEmails: optedIn, NotifyType: dto.NotifyTypeEmail})
	require.NoError(t, db.Create(&user).Error)
	return user
}

func createNotifySkill(t *testing.T, db *gorm.DB, slug, name, category string, monetization enums.MonetizationType, publishedAt time.Time) skillmodel.Skill {
	t.Helper()
	skill := skillmodel.Skill{
		Slug:                 slug,
		Status:               enums.SkillStatusPublished,
		Category:             category,
		DefaultLocale:        "en",
		Name:                 name,
		ShortDescription:     name + " short",
		Description:          name + " description",
		RequiredPlan:         enums.RequiredPlanFree,
		MonetizationType:     monetization,
		ModelWhitelist:       skillmodel.SkillJSONB(`[]`),
		TimeoutSeconds:       45,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		CreatedBy:            1,
		PublishedAt:          &publishedAt,
	}
	require.NoError(t, db.Create(&skill).Error)
	return skill
}

func emitEnableEvent(t *testing.T, db *gorm.DB, occurredAt time.Time, userID int64, skillID string) {
	t.Helper()
	require.NoError(t, skillmodel.EmitSkillUsageEvent(db, skillmodel.SkillUsageEvent{
		EventType:  enums.SkillUsageEventTypeEnabled,
		OccurredAt: occurredAt,
		UserID:     &userID,
		TenantID:   &userID,
		SkillID:    &skillID,
		EntryPoint: enums.EntryPointMarketplaceCard,
		Metadata:   skillmodel.SkillJSONB(`{}`),
	}))
}
