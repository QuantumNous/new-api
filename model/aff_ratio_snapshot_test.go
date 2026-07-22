package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAffRatioSnapshotTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldAffRatio := common.AffRatio
	oldQuotaForNewUser := common.QuotaForNewUser
	oldQuotaForInvitee := common.QuotaForInvitee
	oldQuotaForInviter := common.QuotaForInviter

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &AffLog{}))
	DB = db
	common.AffRatio = 10
	common.QuotaForNewUser = 0
	common.QuotaForInvitee = 0
	common.QuotaForInviter = 0

	t.Cleanup(func() {
		DB = oldDB
		common.AffRatio = oldAffRatio
		common.QuotaForNewUser = oldQuotaForNewUser
		common.QuotaForInvitee = oldQuotaForInvitee
		common.QuotaForInviter = oldQuotaForInviter
	})
}

func intPtr(v int) *int {
	return &v
}

func TestUserInsertFreezesAffRatioSnapshot(t *testing.T) {
	setupAffRatioSnapshotTestDB(t)

	require.NoError(t, DB.Create(&User{Id: 1, Username: "inviter", AffCode: "a001"}).Error)

	inherited := &User{Username: "invitee-inherited"}
	require.NoError(t, inherited.Insert(1))
	require.NotNil(t, inherited.AffRatioSnapshot)
	require.Equal(t, 10, *inherited.AffRatioSnapshot)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", 1).Update("aff_ratio_override", 30).Error)
	overridden := &User{Username: "invitee-overridden"}
	require.NoError(t, overridden.Insert(1))
	require.NotNil(t, overridden.AffRatioSnapshot)
	require.Equal(t, 30, *overridden.AffRatioSnapshot)

	require.NoError(t, DB.Model(&User{}).Where("id = ?", 1).Update("aff_ratio_override", 0).Error)
	disabled := &User{Username: "invitee-disabled"}
	require.NoError(t, disabled.Insert(1))
	require.NotNil(t, disabled.AffRatioSnapshot)
	require.Equal(t, 0, *disabled.AffRatioSnapshot)

	noInviter := &User{Username: "invitee-none"}
	require.NoError(t, noInviter.Insert(0))
	require.Nil(t, noInviter.AffRatioSnapshot)
}

func TestProcessAffCommissionUsesFrozenSnapshot(t *testing.T) {
	setupAffRatioSnapshotTestDB(t)
	common.AffRatio = 30

	require.NoError(t, DB.Create(&User{Id: 1, Username: "inviter", AffCode: "a001"}).Error)
	require.NoError(t, DB.Create(&User{Id: 2, Username: "invitee", AffCode: "a002", InviterId: 1, AffRatioSnapshot: intPtr(10)}).Error)

	ProcessAffCommission(2, 1000)

	var inviter User
	require.NoError(t, DB.First(&inviter, 1).Error)
	require.Equal(t, 100, inviter.AffQuota)
	require.Equal(t, 100, inviter.AffHistoryQuota)

	var log AffLog
	require.NoError(t, DB.First(&log, "invitee_id = ?", 2).Error)
	require.Equal(t, 100, log.Commission)
}

func TestProcessAffCommissionSnapshotZeroDisablesCommission(t *testing.T) {
	setupAffRatioSnapshotTestDB(t)

	require.NoError(t, DB.Create(&User{Id: 1, Username: "inviter", AffCode: "a001"}).Error)
	require.NoError(t, DB.Create(&User{Id: 2, Username: "invitee", AffCode: "a002", InviterId: 1, AffRatioSnapshot: intPtr(0)}).Error)

	ProcessAffCommission(2, 1000)

	var inviter User
	require.NoError(t, DB.First(&inviter, 1).Error)
	require.Equal(t, 0, inviter.AffQuota)

	var count int64
	require.NoError(t, DB.Model(&AffLog{}).Count(&count).Error)
	require.Equal(t, int64(0), count)
}

func TestProcessAffCommissionHistoricalSnapshotFallsBackToGlobal(t *testing.T) {
	setupAffRatioSnapshotTestDB(t)
	common.AffRatio = 15

	require.NoError(t, DB.Create(&User{Id: 1, Username: "inviter", AffCode: "a001"}).Error)
	require.NoError(t, DB.Create(&User{Id: 2, Username: "historical-invitee", AffCode: "a002", InviterId: 1}).Error)

	ProcessAffCommission(2, 1000)

	var inviter User
	require.NoError(t, DB.First(&inviter, 1).Error)
	require.Equal(t, 150, inviter.AffQuota)
}
