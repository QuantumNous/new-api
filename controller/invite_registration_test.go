package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationInviteTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := model.DB
	oldLogDB := model.LOG_DB
	db := openTokenControllerTestDB(t)
	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
	})
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.InviteCode{}))

	oldInviteOnly := common.InviteOnlyRegisterEnabled
	common.InviteOnlyRegisterEnabled = false
	t.Cleanup(func() {
		common.InviteOnlyRegisterEnabled = oldInviteOnly
	})

	return db
}

func createRegistrationInviteTestUser(t *testing.T, db *gorm.DB, id int, username string, affCode string) {
	t.Helper()
	require.NoError(t, db.Create(&model.User{
		Id:       id,
		Username: username,
		AffCode:  affCode,
		Status:   common.UserStatusEnabled,
	}).Error)
}

func createRegistrationInviteTestCode(t *testing.T, db *gorm.DB, code string, inviterId int) {
	t.Helper()
	require.NoError(t, db.Create(&model.InviteCode{
		Code:      code,
		Name:      "test",
		CreatorId: inviterId,
		InviterId: inviterId,
		Status:    common.InviteCodeStatusEnabled,
		MaxUses:   1,
	}).Error)
}

func TestRegistrationInviteContext_AffOnlyUsesAffEvenWhenInviteCodeValueCollides(t *testing.T) {
	db := setupRegistrationInviteTestDB(t)
	createRegistrationInviteTestUser(t, db, 1, "aff_inviter", "same-code")
	createRegistrationInviteTestUser(t, db, 2, "invite_inviter", "other-code")
	createRegistrationInviteTestCode(t, db, "same-code", 2)

	inviterId, err := getInviterIdForRegistrationWithTx(db, registrationInviteContext{
		AffCode: "same-code",
	})
	require.NoError(t, err)
	assert.Equal(t, 1, inviterId)

	require.NoError(t, model.ConsumeRegistrationInviteCodeWithTx(db, "", 100))
	var inviteCode model.InviteCode
	require.NoError(t, db.Where("code = ?", "same-code").First(&inviteCode).Error)
	assert.Zero(t, inviteCode.UsedCount)
	assert.Zero(t, inviteCode.UsedUserId)
}

func TestRegistrationInviteContext_InviteCodeAndAffUseInviteForAccessAndAffForAttribution(t *testing.T) {
	db := setupRegistrationInviteTestDB(t)
	createRegistrationInviteTestUser(t, db, 1, "aff_inviter", "aff-code")
	createRegistrationInviteTestUser(t, db, 2, "invite_inviter", "invite-owner")
	createRegistrationInviteTestCode(t, db, "invite-code", 2)

	inviterId, err := getInviterIdForRegistrationWithTx(db, registrationInviteContext{
		InviteCode: "invite-code",
		AffCode:    "aff-code",
	})
	require.NoError(t, err)
	assert.Equal(t, 1, inviterId)

	require.NoError(t, model.ConsumeRegistrationInviteCodeWithTx(db, "invite-code", 100))
	var inviteCode model.InviteCode
	require.NoError(t, db.Where("code = ?", "invite-code").First(&inviteCode).Error)
	assert.Equal(t, 1, inviteCode.UsedCount)
	assert.Equal(t, 100, inviteCode.UsedUserId)
}

func TestRegistrationInviteContext_InviteOnlyRequiresInviteCodeEvenWithAff(t *testing.T) {
	db := setupRegistrationInviteTestDB(t)
	common.InviteOnlyRegisterEnabled = true
	createRegistrationInviteTestUser(t, db, 1, "aff_inviter", "aff-code")

	inviterId, err := getInviterIdForRegistrationWithTx(db, registrationInviteContext{
		AffCode: "aff-code",
	})
	assert.ErrorIs(t, err, errInviteCodeRequired)
	assert.Zero(t, inviterId)
}

func TestRegistrationInviteContext_InviteCodeFieldDoesNotFallbackToAff(t *testing.T) {
	db := setupRegistrationInviteTestDB(t)
	createRegistrationInviteTestUser(t, db, 1, "aff_inviter", "aff-code")

	inviterId, err := getInviterIdForRegistrationWithTx(db, registrationInviteContext{
		InviteCode: "aff-code",
	})
	assert.ErrorIs(t, err, errInviteCodeInvalid)
	assert.Zero(t, inviterId)
}
