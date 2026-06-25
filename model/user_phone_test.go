package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUserPhoneUniqueIndexAllowsMultipleNullPhones(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create(&User{
		Username: "null-phone-1",
		AffCode:  "null-phone-aff-1",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Username: "null-phone-2",
		AffCode:  "null-phone-aff-2",
		Status:   common.UserStatusEnabled,
	}).Error)
}

func TestUserPhoneUniqueIndexRejectsDuplicatePhones(t *testing.T) {
	truncateTables(t)

	phone := "+8613812345678"
	require.NoError(t, DB.Create(&User{
		Username: "phone-user-1",
		Phone:    &phone,
		AffCode:  "phone-aff-1",
		Status:   common.UserStatusEnabled,
	}).Error)

	duplicatePhone := phone
	require.Error(t, DB.Create(&User{
		Username: "phone-user-2",
		Phone:    &duplicatePhone,
		AffCode:  "phone-aff-2",
		Status:   common.UserStatusEnabled,
	}).Error)
}
