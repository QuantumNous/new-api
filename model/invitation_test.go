package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMaskInvitationIdentity(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		username string
		want     string
	}{
		{name: "email", email: "alice@example.com", username: "ignored", want: "a***@example.com"},
		{name: "empty username", want: "***"},
		{name: "one rune username", username: "猫", want: "*"},
		{name: "two rune username", username: "猫狗", want: "猫*"},
		{name: "three rune username", username: "猫狗鸟", want: "猫***鸟"},
		{name: "long username", username: "alpha", want: "a***a"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, MaskInvitationIdentity(tt.email, tt.username))
		})
	}
}

func setupInvitationModelTest(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/invitation.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &InviteRewardEvent{}, &InviteSubscriptionReward{}))

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})
}

func createInvitationTestUser(t *testing.T, user User) User {
	t.Helper()
	if user.Password == "" {
		user.Password = "password123"
	}
	if user.AffCode == "" {
		user.AffCode = user.Username
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestGetInvitationPage(t *testing.T) {
	t.Run("scopes counts ordering pagination and historical reward", func(t *testing.T) {
		setupInvitationModelTest(t)

		inviter := createInvitationTestUser(t, User{Id: 100, Username: "inviter", CreatedAt: 10})
		otherInviter := createInvitationTestUser(t, User{Id: 200, Username: "other-inviter", CreatedAt: 20})
		pending := createInvitationTestUser(t, User{
			Id:                 11,
			Username:           "pending-user",
			InviterId:          inviter.Id,
			InviteRewardStatus: InviteRewardStatusPending,
			CreatedAt:          400,
		})
		granted := createInvitationTestUser(t, User{
			Id:                      12,
			Username:                "granted-user",
			Email:                   "granted@example.com",
			InviterId:               inviter.Id,
			InviteRewardStatus:      InviteRewardStatusGranted,
			InviteRewardGrantedAt:   350,
			InviteRewardBlockReason: "must-not-leak",
			CreatedAt:               300,
		})
		blocked := createInvitationTestUser(t, User{
			Id:                      13,
			Username:                "blocked-user",
			InviterId:               inviter.Id,
			InviteRewardStatus:      InviteRewardStatusBlocked,
			InviteRewardBlockReason: InviteRewardBlockReasonInviterMissing,
			CreatedAt:               300,
		})
		abnormal := createInvitationTestUser(t, User{
			Id:                      14,
			Username:                "异常用户",
			InviterId:               inviter.Id,
			InviteRewardStatus:      "legacy_unknown",
			InviteRewardBlockReason: "internal_detail",
			CreatedAt:               100,
		})
		softDeleted := createInvitationTestUser(t, User{
			Id:                 15,
			Username:           "deleted-user",
			InviterId:          inviter.Id,
			InviteRewardStatus: InviteRewardStatusPending,
			CreatedAt:          500,
		})
		createInvitationTestUser(t, User{
			Id:                 16,
			Username:           "other-invitee",
			InviterId:          otherInviter.Id,
			InviteRewardStatus: InviteRewardStatusPending,
			CreatedAt:          600,
		})
		require.NoError(t, DB.Delete(&softDeleted).Error)
		require.NoError(t, DB.Create(&InviteRewardEvent{
			InviteeId:          granted.Id,
			InviterId:          inviter.Id,
			InviterRewardQuota: 321,
			Status:             InviteRewardEventStatusGranted,
			Reason:             InviteRewardBlockReasonInviterLimitReached,
			CreatedAt:          360,
		}).Error)

		firstPage, err := GetInvitationPage(inviter.Id, 0, 2)
		require.NoError(t, err)
		require.NotNil(t, firstPage.Items)
		require.EqualValues(t, 4, firstPage.Total)
		require.EqualValues(t, 1, firstPage.PendingCount)
		require.Len(t, firstPage.Items, 2)
		require.Equal(t, pending.Id, firstPage.Items[0].Id)
		require.Equal(t, "p***r", firstPage.Items[0].MaskedIdentity)
		require.Equal(t, int64(400), firstPage.Items[0].RegisteredAt)
		require.Equal(t, InviteRewardStatusPending, firstPage.Items[0].Status)
		require.Zero(t, firstPage.Items[0].RewardQuota)
		require.Empty(t, firstPage.Items[0].Reason)
		require.Equal(t, blocked.Id, firstPage.Items[1].Id)
		require.Equal(t, InviteRewardStatusBlocked, firstPage.Items[1].Status)
		require.Equal(t, InviteRewardBlockReasonInviterMissing, firstPage.Items[1].Reason)

		secondPage, err := GetInvitationPage(inviter.Id, 2, 2)
		require.NoError(t, err)
		require.EqualValues(t, 4, secondPage.Total)
		require.EqualValues(t, 1, secondPage.PendingCount)
		require.Len(t, secondPage.Items, 2)
		require.Equal(t, granted.Id, secondPage.Items[0].Id)
		require.Equal(t, "g***@example.com", secondPage.Items[0].MaskedIdentity)
		require.Equal(t, InviteRewardStatusGranted, secondPage.Items[0].Status)
		require.Equal(t, int64(350), secondPage.Items[0].GrantedAt)
		require.Equal(t, 321, secondPage.Items[0].RewardQuota)
		require.Equal(t, InviteRewardBlockReasonInviterLimitReached, secondPage.Items[0].Reason)
		require.Equal(t, abnormal.Id, secondPage.Items[1].Id)
		require.Equal(t, InviteRewardStatusBlocked, secondPage.Items[1].Status)
		require.Zero(t, secondPage.Items[1].RewardQuota)
		require.Equal(t, "unavailable", secondPage.Items[1].Reason)
	})

	t.Run("normalizes missing events and blocked reasons", func(t *testing.T) {
		setupInvitationModelTest(t)

		inviter := createInvitationTestUser(t, User{Id: 300, Username: "inviter", CreatedAt: 10})
		missingEvent := createInvitationTestUser(t, User{
			Id:                    31,
			Username:              "missing-event",
			InviterId:             inviter.Id,
			InviteRewardStatus:    InviteRewardStatusGranted,
			InviteRewardGrantedAt: 700,
			CreatedAt:             700,
		})
		unknownReason := createInvitationTestUser(t, User{
			Id:                      32,
			Username:                "unknown-reason",
			InviterId:               inviter.Id,
			InviteRewardStatus:      InviteRewardStatusBlocked,
			InviteRewardBlockReason: "fraud_score_97",
			CreatedAt:               600,
		})
		unavailableReason := createInvitationTestUser(t, User{
			Id:                      33,
			Username:                "unavailable-reason",
			InviterId:               inviter.Id,
			InviteRewardStatus:      InviteRewardStatusBlocked,
			InviteRewardBlockReason: "unavailable",
			CreatedAt:               500,
		})
		emptyBlockedReason := createInvitationTestUser(t, User{
			Id:                 34,
			Username:           "empty-blocked-reason",
			InviterId:          inviter.Id,
			InviteRewardStatus: InviteRewardStatusBlocked,
			CreatedAt:          400,
		})
		noneStatus := createInvitationTestUser(t, User{
			Id:                 35,
			Username:           "none-status",
			InviterId:          inviter.Id,
			InviteRewardStatus: InviteRewardStatusNone,
			CreatedAt:          300,
		})
		require.NoError(t, DB.Create(&InviteRewardEvent{
			InviteeId:          missingEvent.Id,
			InviterId:          inviter.Id + 1,
			InviterRewardQuota: 999,
			Status:             InviteRewardEventStatusGranted,
			CreatedAt:          710,
		}).Error)

		page, err := GetInvitationPage(inviter.Id, 0, 10)
		require.NoError(t, err)
		require.Len(t, page.Items, 5)
		require.Equal(t, missingEvent.Id, page.Items[0].Id)
		require.Equal(t, InviteRewardStatusGranted, page.Items[0].Status)
		require.Zero(t, page.Items[0].RewardQuota)
		require.Equal(t, "unavailable", page.Items[0].Reason)
		require.Equal(t, unknownReason.Id, page.Items[1].Id)
		require.Equal(t, InviteRewardStatusBlocked, page.Items[1].Status)
		require.Zero(t, page.Items[1].RewardQuota)
		require.Equal(t, "unavailable", page.Items[1].Reason)
		require.Equal(t, unavailableReason.Id, page.Items[2].Id)
		require.Equal(t, "unavailable", page.Items[2].Reason)
		require.Equal(t, emptyBlockedReason.Id, page.Items[3].Id)
		require.Equal(t, "unavailable", page.Items[3].Reason)
		require.Equal(t, noneStatus.Id, page.Items[4].Id)
		require.Equal(t, InviteRewardStatusBlocked, page.Items[4].Status)
		require.Zero(t, page.Items[4].RewardQuota)
		require.Equal(t, "unavailable", page.Items[4].Reason)

		emptyPage, err := GetInvitationPage(999, 0, 10)
		require.NoError(t, err)
		require.NotNil(t, emptyPage.Items)
		require.Empty(t, emptyPage.Items)
		require.Zero(t, emptyPage.Total)
		require.Zero(t, emptyPage.PendingCount)
	})
}
