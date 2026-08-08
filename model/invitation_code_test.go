package model

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationCodeTest(t *testing.T) *User {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&InvitationCode{}))
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&InvitationCode{}).Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)
	user := &User{
		Username: "invitation-user",
		Password: "password",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&InvitationCode{}).Error)
		require.NoError(t, DB.Exec("DELETE FROM users").Error)
	})
	return user
}

func TestCreateInvitationCodesStoresOnlyHashAndPrefix(t *testing.T) {
	user := setupInvitationCodeTest(t)

	codes, err := CreateInvitationCodes("launch", 2, user.Id, 0)
	require.NoError(t, err)
	require.Len(t, codes, 2)
	assert.NotEqual(t, codes[0], codes[1])

	var rows []InvitationCode
	require.NoError(t, DB.Order("id").Find(&rows).Error)
	require.Len(t, rows, 2)
	for i, row := range rows {
		assert.True(t, strings.HasPrefix(codes[i], "INV-"))
		assert.Len(t, codes[i], 36)
		assert.NotEqual(t, codes[i], row.CodeHash)
		assert.Equal(t, HashInvitationCode(codes[i]), row.CodeHash)
		assert.Equal(t, codes[i][:invitationCodePrefixLength], row.CodePrefix)
		assert.NotContains(t, row.CodeHash, codes[i])
	}
	serialized, err := common.Marshal(rows[0])
	require.NoError(t, err)
	assert.NotContains(t, string(serialized), "code_hash")
	assert.NotContains(t, string(serialized), codes[0])
}

func TestConsumeInvitationCodeWithTxConsumesExactlyOnce(t *testing.T) {
	user := setupInvitationCodeTest(t)
	codes, err := CreateInvitationCodes("single-use", 1, user.Id, 0)
	require.NoError(t, err)

	var consumed *InvitationCode
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var consumeErr error
		consumed, consumeErr = ConsumeInvitationCodeWithTx(tx, strings.ToLower(codes[0]), user.Id)
		return consumeErr
	}))
	assert.Equal(t, common.InvitationCodeStatusUsed, consumed.Status)
	assert.Equal(t, user.Id, consumed.UsedUserId)
	assert.NotZero(t, consumed.UsedTime)

	err = DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeWithTx(tx, codes[0], user.Id)
		return consumeErr
	})
	require.ErrorIs(t, err, ErrInvitationCodeUsed)
}

func TestInvitationCodeReferenceResolvesWithoutConsumingAndUsesExplicitIDAPI(t *testing.T) {
	user := setupInvitationCodeTest(t)
	codes, err := CreateInvitationCodes("oauth-reference", 1, user.Id, 0)
	require.NoError(t, err)

	codeID, err := ResolveInvitationCodeReference(strings.ToLower(codes[0]))
	require.NoError(t, err)
	assert.Positive(t, codeID)
	unknownID, err := ResolveInvitationCodeReference("INV-NOT-FOUND")
	require.NoError(t, err)
	assert.Zero(t, unknownID)
	oversizedID, err := ResolveInvitationCodeReference(strings.Repeat("A", common.InvitationCodeMaxLength+1))
	require.NoError(t, err)
	assert.Zero(t, oversizedID)

	var before InvitationCode
	require.NoError(t, DB.First(&before, codeID).Error)
	assert.Equal(t, common.InvitationCodeStatusEnabled, before.Status)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeReferenceWithTx(tx, codeID, user.Id)
		return consumeErr
	}))
	var after InvitationCode
	require.NoError(t, DB.First(&after, codeID).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, after.Status)
	assert.Equal(t, user.Id, after.UsedUserId)
}

func TestConsumeInvitationCodeRollsBackWithRegistrationTransaction(t *testing.T) {
	user := setupInvitationCodeTest(t)
	codes, err := CreateInvitationCodes("rollback", 1, user.Id, 0)
	require.NoError(t, err)

	rollbackErr := errors.New("registration failed")
	err = DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeWithTx(tx, codes[0], user.Id)
		require.NoError(t, consumeErr)
		return rollbackErr
	})
	require.ErrorIs(t, err, rollbackErr)

	var row InvitationCode
	require.NoError(t, DB.Where("code_hash = ?", HashInvitationCode(codes[0])).First(&row).Error)
	assert.Equal(t, common.InvitationCodeStatusEnabled, row.Status)
	assert.Zero(t, row.UsedUserId)
	assert.Zero(t, row.UsedTime)
}

func TestConsumeInvitationCodeRejectsDisabledAndExpiredCodes(t *testing.T) {
	user := setupInvitationCodeTest(t)
	now := common.GetTimestamp()
	disabledRaw := "INV-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	expiredRaw := "INV-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
	require.NoError(t, DB.Create(&[]InvitationCode{
		{
			Name:        "disabled",
			CodeHash:    HashInvitationCode(disabledRaw),
			CodePrefix:  disabledRaw[:invitationCodePrefixLength],
			Status:      common.InvitationCodeStatusDisabled,
			CreatedTime: now,
		},
		{
			Name:        "expired",
			CodeHash:    HashInvitationCode(expiredRaw),
			CodePrefix:  expiredRaw[:invitationCodePrefixLength],
			Status:      common.InvitationCodeStatusEnabled,
			CreatedTime: now - 10,
			ExpiredTime: now - 1,
		},
	}).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeWithTx(tx, disabledRaw, user.Id)
		return consumeErr
	})
	require.ErrorIs(t, err, ErrInvitationCodeDisabled)

	err = DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeWithTx(tx, expiredRaw, user.Id)
		return consumeErr
	})
	require.ErrorIs(t, err, ErrInvitationCodeExpired)
}

func TestConsumeInvitationCodeRejectsOversizedInput(t *testing.T) {
	user := setupInvitationCodeTest(t)
	oversizedCode := strings.Repeat("A", common.InvitationCodeMaxLength+1)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, consumeErr := ConsumeInvitationCodeWithTx(tx, oversizedCode, user.Id)
		return consumeErr
	})
	require.ErrorIs(t, err, ErrInvitationCodeInvalid)
}

func TestSearchAndDeleteUsedInvitationCodes(t *testing.T) {
	user := setupInvitationCodeTest(t)
	now := common.GetTimestamp()
	rows := []InvitationCode{
		{Name: "alpha-enabled", CodeHash: HashInvitationCode("one"), CodePrefix: "INV-ONE1", Status: common.InvitationCodeStatusEnabled, CreatedTime: now},
		{Name: "alpha-expired", CodeHash: HashInvitationCode("two"), CodePrefix: "INV-TWO2", Status: common.InvitationCodeStatusEnabled, CreatedTime: now, ExpiredTime: now - 1},
		{Name: "beta-used", CodeHash: HashInvitationCode("three"), CodePrefix: "INV-THR3", Status: common.InvitationCodeStatusUsed, UsedUserId: user.Id, UsedTime: now, CreatedTime: now},
	}
	require.NoError(t, DB.Create(&rows).Error)

	used, total, err := SearchInvitationCodes("", "used", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, used, 1)
	assert.Equal(t, "used", used[0].State)
	assert.Equal(t, user.Username, used[0].UsedUsername)
	_, err = UpdateInvitationCode(used[0].Id, "", common.InvitationCodeStatusDisabled, 0, true)
	require.ErrorIs(t, err, ErrInvitationCodeUsed)
	var stillUsed InvitationCode
	require.NoError(t, DB.First(&stillUsed, used[0].Id).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, stillUsed.Status)

	expired, total, err := SearchInvitationCodes("alpha", "expired", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, expired, 1)
	assert.Equal(t, "expired", expired[0].State)

	deleted, err := DeleteUsedInvitationCodes()
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)
	_, total, err = SearchInvitationCodes("", "used", 0, 10)
	require.NoError(t, err)
	assert.Zero(t, total)
	var retainedUsed int64
	require.NoError(t, DB.Unscoped().Model(&InvitationCode{}).Where("status = ?", common.InvitationCodeStatusUsed).Count(&retainedUsed).Error)
	assert.Equal(t, int64(1), retainedUsed)
}
