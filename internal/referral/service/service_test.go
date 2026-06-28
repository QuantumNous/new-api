package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	referralmodel "github.com/QuantumNous/new-api/internal/referral/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func referralTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&platformmodel.User{}, &referralmodel.ReferralRecord{}))
	return db
}

func withReferralConfig(t *testing.T, inviterReward int, inviteeReward int, maxRewards int) {
	t.Helper()
	oldKind := common.ReferralRewardKind
	oldInviter := common.ReferralInviterRewardQuota
	oldInvitee := common.ReferralInviteeRewardQuota
	oldCap := common.ReferralMaxRewardsPerInviter
	common.ReferralRewardKind = referralmodel.ReferralRewardKindQuota
	common.ReferralInviterRewardQuota = inviterReward
	common.ReferralInviteeRewardQuota = inviteeReward
	common.ReferralMaxRewardsPerInviter = maxRewards
	t.Cleanup(func() {
		common.ReferralRewardKind = oldKind
		common.ReferralInviterRewardQuota = oldInviter
		common.ReferralInviteeRewardQuota = oldInvitee
		common.ReferralMaxRewardsPerInviter = oldCap
	})
}

func createReferralUser(t *testing.T, db *gorm.DB, id int, username string, quota int, affCode string) {
	t.Helper()
	require.NoError(t, db.Create(&platformmodel.User{
		Id:       id,
		Username: username,
		Quota:    quota,
		AffCode:  affCode,
		Status:   common.UserStatusEnabled,
	}).Error)
}

func quotaForUser(t *testing.T, db *gorm.DB, id int) int {
	t.Helper()
	var user platformmodel.User
	require.NoError(t, db.Select("quota").Where("id = ?", id).First(&user).Error)
	return user.Quota
}

func TestGrantForConversionRewardsBothSidesOnce(t *testing.T) {
	db := referralTestDB(t)
	withReferralConfig(t, 700, 300, 10)
	createReferralUser(t, db, 1, "inviter", 1000, "ABCD")
	createReferralUser(t, db, 2, "invitee", 100, "EFGH")
	require.NoError(t, RecordSignup(db, 2, 1, "ABCD"))

	record, awarded, err := GrantForConversion(db, 2, referralmodel.ReferralConversionTopUp, "topup-1")
	require.NoError(t, err)
	require.True(t, awarded)
	require.NotNil(t, record)
	assert.Equal(t, referralmodel.ReferralStatusRewarded, record.Status)
	assert.Equal(t, int64(700), record.InviterRewardAmount)
	assert.Equal(t, int64(300), record.InviteeRewardAmount)
	assert.Equal(t, 1700, quotaForUser(t, db, 1))
	assert.Equal(t, 400, quotaForUser(t, db, 2))

	_, awarded, err = GrantForConversion(db, 2, referralmodel.ReferralConversionTopUp, "topup-1")
	require.NoError(t, err)
	assert.False(t, awarded)
	assert.Equal(t, 1700, quotaForUser(t, db, 1))
	assert.Equal(t, 400, quotaForUser(t, db, 2))
}

func TestGrantForConversionBlocksSelfReferral(t *testing.T) {
	db := referralTestDB(t)
	withReferralConfig(t, 700, 300, 10)
	createReferralUser(t, db, 3, "self", 100, "SELF")
	require.NoError(t, RecordSignup(db, 3, 3, "SELF"))

	record, awarded, err := GrantForConversion(db, 3, referralmodel.ReferralConversionTopUp, "topup-self")
	require.NoError(t, err)
	require.NotNil(t, record)
	assert.False(t, awarded)
	assert.Equal(t, referralmodel.ReferralStatusBlocked, record.Status)
	assert.Equal(t, referralmodel.ReferralBlockSelfReferral, record.BlockedReason)
	assert.Equal(t, 100, quotaForUser(t, db, 3))
}

func TestGrantForConversionBlocksFraudCap(t *testing.T) {
	db := referralTestDB(t)
	withReferralConfig(t, 700, 300, 1)
	createReferralUser(t, db, 10, "inviter", 0, "CAP")
	createReferralUser(t, db, 11, "first", 0, "ONE")
	createReferralUser(t, db, 12, "second", 0, "TWO")
	require.NoError(t, RecordSignup(db, 11, 10, "CAP"))
	require.NoError(t, RecordSignup(db, 12, 10, "CAP"))

	_, awarded, err := GrantForConversion(db, 11, referralmodel.ReferralConversionTopUp, "topup-first")
	require.NoError(t, err)
	require.True(t, awarded)

	record, awarded, err := GrantForConversion(db, 12, referralmodel.ReferralConversionTopUp, "topup-second")
	require.NoError(t, err)
	require.NotNil(t, record)
	assert.False(t, awarded)
	assert.Equal(t, referralmodel.ReferralStatusBlocked, record.Status)
	assert.Equal(t, referralmodel.ReferralBlockFraudCap, record.BlockedReason)
	assert.Equal(t, 700, quotaForUser(t, db, 10))
	assert.Equal(t, 0, quotaForUser(t, db, 12))
}
