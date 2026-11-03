package model

import (
	"strconv"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwMarkVerified gives a user a unique device signal, which counts as verified
// for the affiliate reward.
func hwMarkVerified(t *testing.T, userID int) {
	t.Helper()
	require.NoError(t, UpsertHwUserSignals(userID, HwUserSignals{DeviceToken: "device-" + common.GetRandomString(8)}))
}

func createHwTestInvitee(t *testing.T, quota int, inviterID int) User {
	t.Helper()
	user := createHwTestUser(t, quota)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("inviter_id", inviterID).Error)
	user.InviterId = inviterID
	return user
}

func TestHwGrantAffiliateReward(t *testing.T) {
	now := int64(1_700_000_000)

	t.Run("gives the inviter five percent of a paid purchase", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		hwMarkVerified(t, buyer.Id)
		hwMarkVerified(t, inviter.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-1", now)
		require.NoError(t, err)

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-1", now)
		require.NoError(t, err)
		require.True(t, granted, "reason: %s", reason)
		assert.Empty(t, reason)
		assert.Equal(t, 50, getUserQuotaFromDB(t, inviter.Id))

		var pkg HwCreditPackage
		require.NoError(t, DB.Where("user_id = ? AND source = ?", inviter.Id, HwSourceAffiliate).First(&pkg).Error)
		assert.Equal(t, 50, pkg.GrantedQuota)
		assert.Equal(t, "aff:ord-1", pkg.OrderRef)
		assert.Equal(t, now+hwCreditPackageValiditySeconds, pkg.ExpiresAt)

		granted, reason, err = HwGrantAffiliateReward(buyer.Id, 1000, "ord-1", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateAlreadyGranted, reason)
		assert.Equal(t, 50, getUserQuotaFromDB(t, inviter.Id))
	})

	t.Run("rejects a shared device", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-2", now)
		require.NoError(t, err)
		require.NoError(t, UpsertHwUserSignals(buyer.Id, HwUserSignals{DeviceToken: "device-shared"}))
		require.NoError(t, UpsertHwUserSignals(inviter.Id, HwUserSignals{DeviceToken: "device-shared"}))

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-2", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, "shared_device", reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, inviter.Id))
	})

	t.Run("rejects a shared ip address", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-3", now)
		require.NoError(t, err)
		hwMarkVerified(t, buyer.Id)
		hwMarkVerified(t, inviter.Id)
		require.NoError(t, UpsertHwUserSignals(buyer.Id, HwUserSignals{Ip: "iphash-shared"}))
		require.NoError(t, UpsertHwUserSignals(inviter.Id, HwUserSignals{Ip: "iphash-shared"}))

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-3", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, "shared_ip", reason)
	})

	t.Run("rejects a shared card", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-4", now)
		require.NoError(t, err)
		hwMarkVerified(t, buyer.Id)
		hwMarkVerified(t, inviter.Id)
		require.NoError(t, UpsertHwUserSignals(buyer.Id, HwUserSignals{CardFingerprint: "card-shared"}))
		require.NoError(t, UpsertHwUserSignals(inviter.Id, HwUserSignals{CardFingerprint: "card-shared"}))

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-4", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, "shared_card", reason)
	})

	t.Run("never rewards free credit", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		hwMarkPhoneVerified(t, buyer.Id)
		granted, _, err := HwGrantFreeTrialCredit(buyer.Id, 100, now)
		require.NoError(t, err)
		require.True(t, granted)

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 100, "free:"+strconv.Itoa(buyer.Id), now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateNotPaidPurchase, reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, inviter.Id))
	})

	t.Run("a buyer without inviter earns nothing", func(t *testing.T) {
		hwCreditTestSetup(t)
		buyer := createHwTestUser(t, 0)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-5", now)
		require.NoError(t, err)

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-5", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateNoInviter, reason)
	})

	t.Run("needs a verified signal on both sides", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		hwMarkVerified(t, buyer.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-7", now)
		require.NoError(t, err)

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-7", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateUnverifiedSignals, reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, inviter.Id))

		// One device record is not enough when only an IP address was seen.
		require.NoError(t, UpsertHwUserSignals(inviter.Id, HwUserSignals{Ip: "iphash-inviter"}))
		granted, reason, err = HwGrantAffiliateReward(buyer.Id, 1000, "ord-7", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateUnverifiedSignals, reason)

		hwMarkVerified(t, inviter.Id)
		granted, reason, err = HwGrantAffiliateReward(buyer.Id, 1000, "ord-7", now)
		require.NoError(t, err)
		assert.True(t, granted, "reason: %s", reason)
		assert.Equal(t, 50, getUserQuotaFromDB(t, inviter.Id))
	})

	t.Run("a disabled inviter earns nothing", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		require.NoError(t, DB.Model(&User{}).Where("id = ?", inviter.Id).Update("status", 2).Error)
		buyer := createHwTestInvitee(t, 0, inviter.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-6", now)
		require.NoError(t, err)

		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-6", now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwAffiliateInviterInactive, reason)
	})
}

func TestHwGrantFreeTrialCredit(t *testing.T) {
	hwCreditTestSetup(t)
	now := int64(1_700_000_000)
	user := createHwTestUser(t, 0)

	hwMarkPhoneVerified(t, user.Id)
	granted, reason, err := HwGrantFreeTrialCredit(user.Id, 100, now)
	require.NoError(t, err)
	require.True(t, granted, "reason: %s", reason)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	pkg := hwTestPackageByOrderRef(t, "free:"+strconv.Itoa(user.Id))
	assert.Equal(t, HwSourceFree, pkg.Source)
	assert.Equal(t, 100, pkg.GrantedQuota)
	assert.Equal(t, now+hwFreeCreditValiditySeconds, pkg.ExpiresAt)

	var group string
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Select(commonGroupCol).Find(&group).Error)
	assert.Equal(t, hwGroupFree, group)

	granted, reason, err = HwGrantFreeTrialCredit(user.Id, 100, now)
	require.NoError(t, err)
	assert.False(t, granted)
	assert.Equal(t, HwFreeTrialAlreadyGranted, reason)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	// The first paid purchase upgrades the free group to paid.
	_, err = GrantCreditPackage(nil, user.Id, 500, HwSourcePurchase, "ord-paid", now)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Select(commonGroupCol).Find(&group).Error)
	assert.Equal(t, hwGroupPaid, group)
}

func TestHwGrantFreeTrialCreditAnotherDayAnotherAmount(t *testing.T) {
	hwCreditTestSetup(t)
	firstDay := int64(1_700_000_000)
	nextDay := firstDay + 24*3600
	user := createHwTestUser(t, 0)
	hwMarkPhoneVerified(t, user.Id)

	granted, _, err := HwGrantFreeTrialCredit(user.Id, 100, firstDay)
	require.NoError(t, err)
	require.True(t, granted)

	// A repeated call on another day converts the TRY amount against another
	// rate; it must be a quiet repeat, not a conflict on the order reference,
	// and the granted package keeps its original amount.
	granted, reason, err := HwGrantFreeTrialCredit(user.Id, 120, nextDay)
	require.NoError(t, err, "another daily rate is not an order reference conflict")
	assert.False(t, granted)
	assert.Equal(t, HwFreeTrialAlreadyGranted, reason)
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))

	// The group move still runs for the repeat: a first call that failed after
	// its commit must not leave the user in the default group.
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update(commonGroupCol, hwGroupDefault).Error)
	granted, reason, err = HwGrantFreeTrialCredit(user.Id, 120, nextDay)
	require.NoError(t, err)
	assert.False(t, granted)
	assert.Equal(t, HwFreeTrialAlreadyGranted, reason)

	var group string
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Select(commonGroupCol).Find(&group).Error)
	assert.Equal(t, hwGroupFree, group, "a repeat in the default group still moves to the free group")
	assert.Equal(t, 100, getUserQuotaFromDB(t, user.Id))
}

func TestHwRevokeAffiliateReward(t *testing.T) {
	now := int64(1_700_000_000)

	t.Run("takes back what is left after partial spending", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		_, err := GrantCreditPackage(nil, inviter.Id, 50, HwSourceAffiliate, "aff:ord-1", now)
		require.NoError(t, err)
		require.NoError(t, DecreaseUserQuota(inviter.Id, 20, true))
		require.Equal(t, 30, getUserQuotaFromDB(t, inviter.Id))

		_, err = HwRevokeAffiliateReward(nil, "ord-1", now)
		require.NoError(t, err)
		assert.Equal(t, 0, getUserQuotaFromDB(t, inviter.Id), "only the unspent 30 is taken back")

		var pkg HwCreditPackage
		require.NoError(t, DB.Where("order_ref = ?", "aff:ord-1").First(&pkg).Error)
		assert.Equal(t, now, pkg.RetiredAt)
		assert.Equal(t, 30, pkg.RetiredRemaining)

		_, err = HwRevokeAffiliateReward(nil, "ord-1", now)
		require.NoError(t, err)
		assert.Equal(t, 0, getUserQuotaFromDB(t, inviter.Id), "a second revocation changes nothing")

		_, err = HwRevokeAffiliateReward(nil, "ord-unknown", now)
		require.NoError(t, err, "an unknown reference is not an error")
	})

	t.Run("leaves quota that belongs to another package alone", func(t *testing.T) {
		hwCreditTestSetup(t)
		inviter := createHwTestUser(t, 0)
		// The affiliate package expires first, so a later package is filled with
		// the whole balance and this package holds nothing.
		_, err := GrantCreditPackage(nil, inviter.Id, 50, HwSourceAffiliate, "aff:ord-2", now)
		require.NoError(t, err)
		_, err = GrantCreditPackage(nil, inviter.Id, 100, HwSourcePurchase, "ord-2", now+1)
		require.NoError(t, err)
		require.Equal(t, 150, getUserQuotaFromDB(t, inviter.Id))
		require.NoError(t, DecreaseUserQuota(inviter.Id, 50, true))
		require.Equal(t, 100, getUserQuotaFromDB(t, inviter.Id))

		_, err = HwRevokeAffiliateReward(nil, "ord-2", now)
		require.NoError(t, err)
		assert.Equal(t, 100, getUserQuotaFromDB(t, inviter.Id), "the package held nothing, so nothing is taken back")

		var pkg HwCreditPackage
		require.NoError(t, DB.Where("order_ref = ?", "aff:ord-2").First(&pkg).Error)
		assert.Equal(t, now, pkg.RetiredAt)
		assert.Zero(t, pkg.RetiredRemaining)
	})
}

func TestHwGrantFreeTrialCreditGuards(t *testing.T) {
	now := int64(1_700_000_000)

	t.Run("refuses an account without a device or phone signal", func(t *testing.T) {
		hwCreditTestSetup(t)
		user := createHwTestUser(t, 0)
		require.NoError(t, UpsertHwUserSignals(user.Id, HwUserSignals{Ip: "203.0.113.9"}))

		granted, reason, err := HwGrantFreeTrialCredit(user.Id, 100, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwFreeTrialUnverified, reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))

		var count int64
		require.NoError(t, DB.Model(&HwCreditPackage{}).Where("user_id = ?", user.Id).Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("refuses an account with only a device token", func(t *testing.T) {
		hwCreditTestSetup(t)
		user := createHwTestUser(t, 0)
		// A device token comes from the browser and is renewable per account, so
		// it may not verify a person on its own.
		require.NoError(t, UpsertHwUserSignals(user.Id, HwUserSignals{DeviceToken: "device-browser-token"}))

		granted, reason, err := HwGrantFreeTrialCredit(user.Id, 100, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwFreeTrialUnverified, reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))

		var count int64
		require.NoError(t, DB.Model(&HwCreditPackage{}).Where("user_id = ?", user.Id).Count(&count).Error)
		assert.Zero(t, count, "no free package is issued on a device token alone")
	})

	t.Run("a copied device token refuses and blocks no other account", func(t *testing.T) {
		hwCreditTestSetup(t)
		victim := createHwTestUser(t, 0)
		attacker := createHwTestUser(t, 0)
		hwMarkPhoneVerified(t, victim.Id)
		hwMarkPhoneVerified(t, attacker.Id)
		// The attacker copies the browser-chosen token of the victim into its own
		// account; that must neither deny the victim's credit nor freeze anyone.
		require.NoError(t, UpsertHwUserSignals(victim.Id, HwUserSignals{DeviceToken: "device-copied"}))
		require.NoError(t, UpsertHwUserSignals(attacker.Id, HwUserSignals{DeviceToken: "device-copied"}))

		granted, reason, err := HwGrantFreeTrialCredit(victim.Id, 100, now)
		require.NoError(t, err)
		require.True(t, granted, "reason: %s", reason)

		granted, reason, err = HwGrantFreeTrialCredit(attacker.Id, 100, now)
		require.NoError(t, err)
		assert.True(t, granted, "a shared device token is no refusal: %s", reason)

		assert.Equal(t, 100, getUserQuotaFromDB(t, victim.Id), "the victim keeps the free credit")
		frozen, err := HwAccountFrozen(victim.Id)
		require.NoError(t, err)
		assert.False(t, frozen, "a copied token must not freeze the account that owns it")
	})

	t.Run("refuses a card another account already used for the free credit", func(t *testing.T) {
		hwCreditTestSetup(t)
		first := createHwTestUser(t, 0)
		second := createHwTestUser(t, 0)
		hwMarkPhoneVerified(t, first.Id)
		hwMarkPhoneVerified(t, second.Id)
		require.NoError(t, UpsertHwUserSignals(first.Id, HwUserSignals{CardFingerprint: "fp-free"}))
		require.NoError(t, UpsertHwUserSignals(second.Id, HwUserSignals{CardFingerprint: "fp-free"}))

		granted, _, err := HwGrantFreeTrialCredit(first.Id, 100, now)
		require.NoError(t, err)
		require.True(t, granted)

		granted, reason, err := HwGrantFreeTrialCredit(second.Id, 100, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwFreeTrialSharedSignal+"card", reason)
	})

	t.Run("the phone claim row refuses a second account even without shared history", func(t *testing.T) {
		hwCreditTestSetup(t)
		first := createHwTestUser(t, 0)
		second := createHwTestUser(t, 0)
		require.NoError(t, UpsertHwUserSignals(first.Id, HwUserSignals{Phone: "0555 111 22 33"}))
		require.NoError(t, UpsertHwUserSignals(second.Id, HwUserSignals{Phone: "+90 555 111 22 33"}))

		granted, _, err := HwGrantFreeTrialCredit(first.Id, 100, now)
		require.NoError(t, err)
		require.True(t, granted)

		// The history check reads signals before either account wrote its claim;
		// only the unique claim row closes that window. Drop the first account's
		// signal history so the history check alone would find nothing shared.
		require.NoError(t, DB.Where("user_id = ?", first.Id).Delete(&HwUserSignal{}).Error)

		granted, reason, err := HwGrantFreeTrialCredit(second.Id, 100, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwFreeTrialSharedSignal+"phone", reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, second.Id))

		var claims int64
		require.NoError(t, DB.Model(&HwFreeCreditClaim{}).Where("phone_hash <> ''").Count(&claims).Error)
		assert.Equal(t, int64(1), claims, "one phone hash keeps one claim row")
	})

	t.Run("refuses an amount above the hard cap", func(t *testing.T) {
		hwCreditTestSetup(t)
		user := createHwTestUser(t, 0)
		hwMarkPhoneVerified(t, user.Id)
		aboveCap := HwMaxFreeTrialQuota() + 1

		granted, reason, err := HwGrantFreeTrialCredit(user.Id, aboveCap, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.Equal(t, HwFreeTrialQuotaTooHigh, reason)
		assert.Equal(t, 0, getUserQuotaFromDB(t, user.Id))

		var count int64
		require.NoError(t, DB.Model(&HwCreditPackage{}).Where("user_id = ?", user.Id).Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("two accounts with the same phone race for one claim", func(t *testing.T) {
		hwCreditTestSetup(t)
		first := createHwTestUser(t, 0)
		second := createHwTestUser(t, 0)
		require.NoError(t, UpsertHwUserSignals(first.Id, HwUserSignals{Phone: "0555 987 65 43"}))
		require.NoError(t, UpsertHwUserSignals(second.Id, HwUserSignals{Phone: "+90 555 987 65 43"}))

		// SQLite in this suite runs on a single connection, so these goroutines
		// queue instead of writing concurrently. The case still pins the
		// contract: whichever account reaches the phone claim first wins, the
		// other is refused with shared_phone, and the credit is granted once.
		var wg sync.WaitGroup
		grantedFlags := make([]bool, 2)
		reasons := make([]string, 2)
		errs := make([]error, 2)
		for i, id := range []int{first.Id, second.Id} {
			wg.Go(func() {
				grantedFlags[i], reasons[i], errs[i] = HwGrantFreeTrialCredit(id, 100, now)
			})
		}
		wg.Wait()

		granted := 0
		for i := range grantedFlags {
			require.NoError(t, errs[i])
			if grantedFlags[i] {
				granted++
				assert.Empty(t, reasons[i])
			} else {
				assert.Equal(t, HwFreeTrialSharedSignal+"phone", reasons[i])
			}
		}
		assert.Equal(t, 1, granted)
		assert.Equal(t, 100, getUserQuotaFromDB(t, first.Id)+getUserQuotaFromDB(t, second.Id), "exactly one free package exists")
	})

	t.Run("the cap itself is allowed", func(t *testing.T) {
		hwCreditTestSetup(t)
		user := createHwTestUser(t, 0)
		hwMarkPhoneVerified(t, user.Id)

		granted, reason, err := HwGrantFreeTrialCredit(user.Id, HwMaxFreeTrialQuota(), now)
		require.NoError(t, err)
		assert.True(t, granted, "reason: %s", reason)
		assert.Equal(t, HwMaxFreeTrialQuota(), getUserQuotaFromDB(t, user.Id))
	})
}

func TestHwFreeTrialCreditLeavesOperatorAccountsAlone(t *testing.T) {
	hwCreditTestSetup(t)
	now := int64(1_700_000_000)
	admin := createHwTestUser(t, 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", admin.Id).Update("role", common.RoleAdminUser).Error)

	hwMarkPhoneVerified(t, admin.Id)
	granted, reason, err := HwGrantFreeTrialCredit(admin.Id, 100, now)
	require.NoError(t, err)
	require.True(t, granted, "reason: %s", reason)

	var group string
	require.NoError(t, DB.Model(&User{}).Where("id = ?", admin.Id).Select(commonGroupCol).Find(&group).Error)
	assert.Equal(t, hwGroupDefault, group)
}

func TestHwChannelGrantAndOverview(t *testing.T) {
	now := int64(1_700_000_000)
	hwCreditTestSetup(t)
	common.OptionMapRWMutex.Lock()
	previousMap := common.OptionMap
	common.OptionMap = map[string]string{HwTryPerUsdOption: "40"}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousMap
		common.OptionMapRWMutex.Unlock()
	})

	channel := createHwTestUser(t, 0)

	t.Run("credit first, bonus after the phone step", func(t *testing.T) {
		result, err := HwGrantChannel(channel.Id, now)
		require.NoError(t, err)
		assert.True(t, result.CreditGranted)
		assert.False(t, result.BonusGranted)
		assert.True(t, result.BonusPending)

		creditQuota := common.QuotaFromFloat(HwChannelCreditUSD * common.QuotaPerUnit)
		assert.Equal(t, creditQuota, getUserQuotaFromDB(t, channel.Id))
		var pkg HwCreditPackage
		require.NoError(t, DB.Where("user_id = ? AND source = ?", channel.Id, HwSourceAdmin).First(&pkg).Error)
		assert.Equal(t, now+90*24*3600, pkg.ExpiresAt)
	})

	t.Run("a device token alone leaves the bonus pending", func(t *testing.T) {
		// Every registration stores a device token, so it proves no step the
		// account took itself.
		hwMarkVerified(t, channel.Id)
		result, err := HwGrantChannel(channel.Id, now)
		require.NoError(t, err)
		assert.False(t, result.CreditGranted)
		assert.False(t, result.BonusGranted)
		assert.True(t, result.BonusPending)
		assert.Equal(t, common.QuotaFromFloat(HwChannelCreditUSD*common.QuotaPerUnit), getUserQuotaFromDB(t, channel.Id))
	})

	t.Run("the phone step brings the bonus once and only once", func(t *testing.T) {
		require.NoError(t, HwRecordPhoneSignal(channel.Id, "+90 555 321 00 11"))
		granted, pending, err := HwGrantChannelBonus(channel.Id, now)
		require.NoError(t, err)
		assert.True(t, granted)
		assert.False(t, pending)

		bonus := common.QuotaFromFloat(float64(HwChannelBonusTRY) / 40 * common.QuotaPerUnit)
		assert.Equal(t, common.QuotaFromFloat(HwChannelCreditUSD*common.QuotaPerUnit)+bonus, getUserQuotaFromDB(t, channel.Id))

		// A repeat by the admin or a later phone step at another daily rate grants
		// nothing more.
		result, err := HwGrantChannel(channel.Id, now)
		require.NoError(t, err)
		assert.False(t, result.CreditGranted)
		assert.False(t, result.BonusGranted)
		assert.False(t, result.BonusPending)
		common.OptionMapRWMutex.Lock()
		common.OptionMap[HwTryPerUsdOption] = "41"
		common.OptionMapRWMutex.Unlock()
		granted, pending, err = HwGrantChannelBonus(channel.Id, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.False(t, pending)
		common.OptionMapRWMutex.Lock()
		common.OptionMap[HwTryPerUsdOption] = "40"
		common.OptionMapRWMutex.Unlock()
		assert.Equal(t, common.QuotaFromFloat(HwChannelCreditUSD*common.QuotaPerUnit)+bonus, getUserQuotaFromDB(t, channel.Id))
	})

	t.Run("an account without channel credit gets no bonus from its phone step", func(t *testing.T) {
		other := createHwTestUser(t, 0)
		require.NoError(t, HwRecordPhoneSignal(other.Id, "+90 555 321 00 22"))
		granted, pending, err := HwGrantChannelBonus(other.Id, now)
		require.NoError(t, err)
		assert.False(t, granted)
		assert.False(t, pending)
		assert.Zero(t, getUserQuotaFromDB(t, other.Id))
	})

	t.Run("overview counts signups, paying customers and earned credit", func(t *testing.T) {
		buyer := createHwTestInvitee(t, 0, channel.Id)
		createHwTestInvitee(t, 0, channel.Id)
		hwMarkVerified(t, buyer.Id)
		_, err := GrantCreditPackage(nil, buyer.Id, 1000, HwSourcePurchase, "ord-ch", now)
		require.NoError(t, err)
		granted, reason, err := HwGrantAffiliateReward(buyer.Id, 1000, "ord-ch", now)
		require.NoError(t, err)
		require.True(t, granted, reason)

		rows, err := HwListChannels()
		require.NoError(t, err)
		require.Len(t, rows, 1)
		assert.Equal(t, channel.Id, rows[0].UserId)
		assert.Equal(t, 2, rows[0].Signups)
		assert.Equal(t, 1, rows[0].PayingCustomers)
		assert.Equal(t, 50, rows[0].EarnedQuota)
		assert.Equal(t, now+90*24*3600, rows[0].ExpiresAt)
	})
}
