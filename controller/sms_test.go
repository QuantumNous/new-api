package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSmsControllerTestDB(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = originalDB
	})
}

func TestShouldSendSmsVerificationHonorsRegistrationAndStatus(t *testing.T) {
	setupSmsControllerTestDB(t)

	originalRegisterEnabled := common.RegisterEnabled
	t.Cleanup(func() {
		common.RegisterEnabled = originalRegisterEnabled
	})

	phone := "+8613812345678"

	common.RegisterEnabled = false
	shouldSend, err := shouldSendSmsVerification(phone)
	require.NoError(t, err)
	require.False(t, shouldSend)

	common.RegisterEnabled = true
	shouldSend, err = shouldSendSmsVerification(phone)
	require.NoError(t, err)
	require.True(t, shouldSend)

	require.NoError(t, model.DB.Create(&model.User{
		Username: "sms-disabled-user",
		Phone:    &phone,
		AffCode:  "sms-disabled-aff",
		Status:   common.UserStatusDisabled,
	}).Error)

	shouldSend, err = shouldSendSmsVerification(phone)
	require.NoError(t, err)
	require.False(t, shouldSend)

	require.NoError(t, model.DB.Model(&model.User{}).Where("phone = ?", phone).Update("status", common.UserStatusEnabled).Error)
	shouldSend, err = shouldSendSmsVerification(phone)
	require.NoError(t, err)
	require.True(t, shouldSend)
}
