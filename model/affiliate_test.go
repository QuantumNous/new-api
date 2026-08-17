package model

import (
	"errors"
	"math"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAffiliateTest(t *testing.T) {
	t.Helper()
	previousDB := DB
	previousType := common.MainDatabaseType()
	previousEnabled := common.AffiliateEnabled
	previousActivatedAt := common.AffiliateActivatedAt
	previousRate := common.AffiliateRebateRateBps
	previousFreeze := common.AffiliateFreezeHours
	previousDuration := common.AffiliateDurationDays
	previousCap := common.AffiliatePerInviteeCap
	previousQuotaPerUnit := common.QuotaPerUnit
	previousQuotaForNewUser := common.QuotaForNewUser
	previousQuotaForInviter := common.QuotaForInviter
	previousQuotaForInvitee := common.QuotaForInvitee
	previousPayment := *operation_setting.GetPaymentSetting()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &AffiliateLedger{}, &Option{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.AffiliateEnabled = true
	common.AffiliateActivatedAt = time.Now().Add(-time.Hour).Unix()
	common.AffiliateRebateRateBps = 1000
	common.AffiliateFreezeHours = 168
	common.AffiliateDurationDays = 0
	common.AffiliatePerInviteeCap = 100
	common.QuotaPerUnit = 500_000
	common.QuotaForNewUser = 0
	common.QuotaForInviter = 0
	common.QuotaForInvitee = 0
	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
		common.AffiliateEnabled = previousEnabled
		common.AffiliateActivatedAt = previousActivatedAt
		common.AffiliateRebateRateBps = previousRate
		common.AffiliateFreezeHours = previousFreeze
		common.AffiliateDurationDays = previousDuration
		common.AffiliatePerInviteeCap = previousCap
		common.QuotaPerUnit = previousQuotaPerUnit
		common.QuotaForNewUser = previousQuotaForNewUser
		common.QuotaForInviter = previousQuotaForInviter
		common.QuotaForInvitee = previousQuotaForInvitee
		*operation_setting.GetPaymentSetting() = previousPayment
	})
}

func createAffiliateTestUser(t *testing.T, username, code string, inviterId int) *User {
	t.Helper()
	user := &User{
		Username: username, AffCode: code, AffCodeEnabled: true,
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
		InviterId: inviterId,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func applyAffiliateTestReward(t *testing.T, source AffiliateRewardSource) {
	t.Helper()
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return ApplyAffiliateRewardTx(tx, source)
	}))
}

func TestAffiliateBaseQuotaUsesPaidAmountAndFloors(t *testing.T) {
	setupAffiliateTest(t)

	quota, err := AffiliateBaseQuotaFromPayment(9.99, 2)
	require.NoError(t, err)
	assert.EqualValues(t, 2_497_500, quota)

	_, err = AffiliateBaseQuotaFromPayment(0, 1)
	assert.Error(t, err)
}

func TestAffiliatePeriodEndUnixRejectsOverflow(t *testing.T) {
	_, err := affiliatePeriodEndUnix(math.MaxInt64-10, 1, 60*60)
	assert.Error(t, err)

	_, err = affiliatePeriodEndUnix(0, math.MaxInt, 24*60*60)
	assert.Error(t, err)
}

func TestEnsureAffiliateCodeEnablesGeneratedCode(t *testing.T) {
	setupAffiliateTest(t)
	user := &User{Username: "missing-code", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)

	code, err := EnsureAffiliateCode(user.Id)
	require.NoError(t, err)
	assert.Len(t, code, affiliateCodeLength)

	var updated User
	require.NoError(t, DB.First(&updated, user.Id).Error)
	assert.Equal(t, code, updated.AffCode)
	assert.True(t, updated.AffCodeEnabled)
}

func TestGenerateUniqueAffiliateCodeDoesNotReuseSoftDeletedCode(t *testing.T) {
	setupAffiliateTest(t)
	previousAlphabet := affiliateCodeAlphabet
	affiliateCodeAlphabet = []byte("A")
	t.Cleanup(func() { affiliateCodeAlphabet = previousAlphabet })

	user := &User{Username: "deleted-code", AffCode: "AAAAAAAAAAAA"}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, DB.Delete(user).Error)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := GenerateUniqueAffiliateCodeTx(tx)
		return err
	})
	assert.Error(t, err)
}

func TestCreateUserWithAffiliateValidatesCodeAndLimit(t *testing.T) {
	setupAffiliateTest(t)
	limit := 1
	inviter := createAffiliateTestUser(t, "inviter", "Legacy-Mixed", 0)
	require.NoError(t, DB.Model(inviter).Update("aff_invite_limit", limit).Error)

	var first User
	err := DB.Transaction(func(tx *gorm.DB) error {
		first = User{Username: "first"}
		_, err := CreateUserWithAffiliateTx(tx, &first, "Legacy-Mixed", true)
		return err
	})
	require.NoError(t, err)
	assert.Equal(t, inviter.Id, first.InviterId)

	err = DB.Transaction(func(tx *gorm.DB) error {
		second := User{Username: "second"}
		_, err := CreateUserWithAffiliateTx(tx, &second, "Legacy-Mixed", true)
		return err
	})
	assert.ErrorIs(t, err, ErrAffiliateCodeLimit)

	err = DB.Transaction(func(tx *gorm.DB) error {
		missing := User{Username: "missing"}
		_, err := CreateUserWithAffiliateTx(tx, &missing, "", true)
		return err
	})
	assert.ErrorIs(t, err, ErrAffiliateCodeRequired)

	err = DB.Transaction(func(tx *gorm.DB) error {
		invalid := User{Username: "invalid"}
		_, err := CreateUserWithAffiliateTx(tx, &invalid, "NO-SUCH-CODE", false)
		return err
	})
	assert.ErrorIs(t, err, ErrAffiliateCodeInvalid)
}

func TestApplyAffiliateRewardIsIdempotentAndFrozen(t *testing.T) {
	setupAffiliateTest(t)
	inviter := createAffiliateTestUser(t, "inviter", "INVITER01", 0)
	invitee := createAffiliateTestUser(t, "invitee", "INVITEE01", inviter.Id)
	source := AffiliateRewardSource{
		Type: AffiliateSourceTopUp, Id: 1, TradeNo: "topup-1",
		InviteeId: invitee.Id, BaseQuota: 500_000,
		CreatedAt: common.AffiliateActivatedAt + 1,
	}

	applyAffiliateTestReward(t, source)
	applyAffiliateTestReward(t, source)

	require.NoError(t, DB.First(inviter, inviter.Id).Error)
	assert.Equal(t, 0, inviter.AffQuota)
	assert.Equal(t, 50_000, inviter.AffFrozenQuota)
	assert.Equal(t, 50_000, inviter.AffHistoryQuota)

	var ledgers []AffiliateLedger
	require.NoError(t, DB.Where("source_event_key = ?", "topup:1").Find(&ledgers).Error)
	require.Len(t, ledgers, 1)
	assert.Equal(t, AffiliateActionAccrue, ledgers[0].Action)
	assert.Equal(t, 1000, ledgers[0].RateBps)
	assert.Greater(t, ledgers[0].FrozenUntil, time.Now().Unix())
}

func TestApplyAffiliateRewardUsesCustomRateAndPerInviteeCap(t *testing.T) {
	setupAffiliateTest(t)
	customRate := 2500
	inviter := createAffiliateTestUser(t, "inviter", "INVITER02", 0)
	require.NoError(t, DB.Model(inviter).Update("aff_rebate_rate_bps", customRate).Error)
	invitee := createAffiliateTestUser(t, "invitee", "INVITEE02", inviter.Id)
	common.AffiliateFreezeHours = 0
	common.AffiliatePerInviteeCap = 0.10

	for id := int64(1); id <= 3; id++ {
		applyAffiliateTestReward(t, AffiliateRewardSource{
			Type: AffiliateSourceSubscription, Id: id, InviteeId: invitee.Id,
			BaseQuota: 160_000, CreatedAt: common.AffiliateActivatedAt + id,
		})
	}

	require.NoError(t, DB.First(inviter, inviter.Id).Error)
	assert.Equal(t, 50_000, inviter.AffQuota)
	assert.Equal(t, 50_000, inviter.AffHistoryQuota)

	var rows []AffiliateLedger
	require.NoError(t, DB.Order("id").Find(&rows).Error)
	require.Len(t, rows, 3)
	assert.EqualValues(t, 40_000, rows[0].RewardQuota)
	assert.EqualValues(t, 10_000, rows[1].RewardQuota)
	assert.Equal(t, AffiliateActionSkip, rows[2].Action)
	assert.Equal(t, "invitee_cap_reached", rows[2].Reason)
}

func TestApplyAffiliateRewardSkipsInactiveInviter(t *testing.T) {
	setupAffiliateTest(t)
	inviter := createAffiliateTestUser(t, "inviter", "INVITER03", 0)
	invitee := createAffiliateTestUser(t, "invitee", "INVITEE03", inviter.Id)
	require.NoError(t, DB.Model(inviter).Update("status", common.UserStatusDisabled).Error)

	applyAffiliateTestReward(t, AffiliateRewardSource{
		Type: AffiliateSourceTopUp, Id: 3, InviteeId: invitee.Id,
		BaseQuota: 500_000, CreatedAt: common.AffiliateActivatedAt + 1,
	})

	var ledger AffiliateLedger
	require.NoError(t, DB.Where("source_event_key = ?", "topup:3").First(&ledger).Error)
	assert.Equal(t, AffiliateActionSkip, ledger.Action)
	assert.Equal(t, "inviter_inactive", ledger.Reason)
}

func TestApplyAffiliateRewardSkipsWhenComplianceIsUnconfirmed(t *testing.T) {
	setupAffiliateTest(t)
	inviter := createAffiliateTestUser(t, "inviter", "INVITER05", 0)
	invitee := createAffiliateTestUser(t, "invitee", "INVITEE05", inviter.Id)
	operation_setting.GetPaymentSetting().ComplianceConfirmed = false

	applyAffiliateTestReward(t, AffiliateRewardSource{
		Type: AffiliateSourceTopUp, Id: 5, InviteeId: invitee.Id,
		BaseQuota: 500_000, CreatedAt: common.AffiliateActivatedAt + 1,
	})

	var ledger AffiliateLedger
	require.NoError(t, DB.Where("source_event_key = ?", "topup:5").First(&ledger).Error)
	assert.Equal(t, AffiliateActionSkip, ledger.Action)
	assert.Equal(t, "compliance_unconfirmed", ledger.Reason)
}

func TestThawAndPartialTransferAffiliateQuota(t *testing.T) {
	setupAffiliateTest(t)
	user := createAffiliateTestUser(t, "inviter", "INVITER04", 0)
	require.NoError(t, DB.Model(user).Update("aff_frozen_quota", 600_000).Error)
	require.NoError(t, DB.Create(&AffiliateLedger{
		UserId: user.Id, Action: AffiliateActionAccrue,
		SourceEventKey: "topup:expired", RewardQuota: 600_000,
		FrozenUntil: time.Now().Add(-time.Minute).Unix(),
	}).Error)

	thawed, err := ThawAffiliateQuota(user.Id)
	require.NoError(t, err)
	assert.EqualValues(t, 600_000, thawed)

	transferred, balance, err := TransferAffiliateQuota(user.Id, 500_000)
	require.NoError(t, err)
	assert.Equal(t, 500_000, transferred)
	assert.Equal(t, 500_000, balance)

	require.NoError(t, DB.First(user, user.Id).Error)
	assert.Equal(t, 500_000, user.Quota)
	assert.Equal(t, 100_000, user.AffQuota)
	assert.Zero(t, user.AffFrozenQuota)

	var transfer AffiliateLedger
	require.NoError(t, DB.Where("user_id = ? AND action = ?", user.Id, AffiliateActionTransfer).First(&transfer).Error)
	assert.EqualValues(t, 500_000, transfer.RewardQuota)
}

func TestInitializeAffiliateLedgerIsIdempotent(t *testing.T) {
	setupAffiliateTest(t)
	user := createAffiliateTestUser(t, "legacy", "LEGACY01", 0)
	require.NoError(t, DB.Model(user).Updates(map[string]any{
		"quota": 300, "aff_quota": 100, "aff_history": 250,
	}).Error)

	require.NoError(t, InitializeAffiliateLedger())
	require.NoError(t, InitializeAffiliateLedger())

	var count int64
	require.NoError(t, DB.Model(&AffiliateLedger{}).
		Where("source_event_key = ?", "legacy:user:"+strconv.Itoa(user.Id)).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestValidateAffiliateCodeRejectsDisabledCode(t *testing.T) {
	setupAffiliateTest(t)
	user := createAffiliateTestUser(t, "disabled", "DISABLED01", 0)
	require.NoError(t, DB.Model(user).Update("aff_code_enabled", false).Error)

	err := ValidateAffiliateCode("DISABLED01")
	assert.True(t, errors.Is(err, ErrAffiliateCodeDisabled))
}

func TestAffiliateBooleanColumnsMigrateAndBackfillExistingUsers(t *testing.T) {
	type legacyUser struct {
		Id        int
		Username  string
		AffCode   string
		DeletedAt gorm.DeletedAt
	}

	previousDB := DB
	previousType := common.MainDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Table("users").AutoMigrate(&legacyUser{}))
	require.NoError(t, db.Table("users").Create(&legacyUser{Username: "legacy", AffCode: "OLD-CODE"}).Error)
	require.NoError(t, db.Migrator().AddColumn(&User{}, "AffCodeEnabled"))
	require.NoError(t, db.Migrator().AddColumn(&User{}, "AffCodeCustom"))
	require.NoError(t, db.AutoMigrate(&Option{}))
	DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		DB = previousDB
		common.SetMainDatabaseType(previousType)
	})

	require.NoError(t, BackfillAffiliateCodeEnabled())
	var migrated User
	require.NoError(t, db.Select("aff_code_enabled", "aff_code_custom").Where("username = ?", "legacy").First(&migrated).Error)
	assert.True(t, migrated.AffCodeEnabled)
	assert.False(t, migrated.AffCodeCustom)
}
