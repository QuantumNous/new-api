package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Partner channels (for example a YouTuber) get an admin-granted credit package
// with a long validity. A channel needs no table of its own: it is the account
// that holds an admin package whose order reference starts with
// hwChannelRefPrefix, and the signups, paying customers and earned affiliate
// credit come from the invite and ledger data that exist anyway. The balance of
// the account is the only spending limit; its API keys are ordinary keys.
const (
	HwChannelCreditUSD = 250
	HwChannelBonusTRY  = 250

	hwChannelValiditySeconds = 90 * 24 * 3600
	hwChannelRefPrefix       = "channel:"
	hwChannelBonusRefPrefix  = "channel-bonus:"
)

var (
	ErrHwChannelRateMissing = errors.New("the TRY rate is not set, the TRY bonus cannot be converted")
	ErrHwChannelUserMissing = errors.New("channel account not found")
)

// HwChannelGrantResult reports what one grant call changed. The call can be
// repeated: a part that was granted before reports false.
type HwChannelGrantResult struct {
	CreditGranted bool `json:"credit_granted"`
	BonusGranted  bool `json:"bonus_granted"`
	// BonusPending is true while the account has not shared its phone number in
	// the phone step; the bonus follows that step by itself.
	BonusPending bool `json:"bonus_pending"`
}

// HwChannelRow is one line of the channel overview.
type HwChannelRow struct {
	UserId          int    `json:"user_id"`
	Username        string `json:"username"`
	DisplayName     string `json:"display_name"`
	GrantedAt       int64  `json:"granted_at"`
	ExpiresAt       int64  `json:"expires_at"`
	Signups         int    `json:"signups"`
	PayingCustomers int    `json:"paying_customers"`
	// EarnedQuota is the affiliate credit ever granted to the channel; a reward
	// taken back after a refund stays in the sum.
	EarnedQuota int `json:"earned_quota"`
}

// hwChannelBonusQuota converts the TRY bonus into quota with the published daily
// rate, so the customer gets the same value the price page shows.
func hwChannelBonusQuota() (int, error) {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[HwTryPerUsdOption]
	common.OptionMapRWMutex.RUnlock()
	rate, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || rate <= 0 {
		return 0, ErrHwChannelRateMissing
	}
	return common.QuotaFromFloat(HwChannelBonusTRY / rate * common.QuotaPerUnit), nil
}

// HwGrantChannel gives a partner account the channel credit (HwChannelCreditUSD,
// 90 days). The TRY bonus follows only once the account has done the phone step
// itself (see HwGrantChannelBonus), so the free steps come first. Every part is
// idempotent on its order reference, so the call can be repeated.
func HwGrantChannel(userID int, now int64) (HwChannelGrantResult, error) {
	var result HwChannelGrantResult
	if userID <= 0 || now <= 0 {
		return result, ErrHwInvalidCreditGrant
	}
	var count int64
	if err := DB.Model(&User{}).Where("id = ?", userID).Count(&count).Error; err != nil {
		return result, err
	}
	if count == 0 {
		return result, ErrHwChannelUserMissing
	}
	granted, err := GrantCreditPackage(nil, userID, common.QuotaFromFloat(HwChannelCreditUSD*common.QuotaPerUnit), HwSourceAdmin, hwChannelRefPrefix+strconv.Itoa(userID), now)
	if err != nil {
		return result, err
	}
	result.CreditGranted = granted
	result.BonusGranted, result.BonusPending, err = HwGrantChannelBonus(userID, now)
	return result, err
}

// HwGrantChannelBonus grants the TRY bonus of a channel account once the account
// has shared its phone number in the phone step. The device token that every
// registration stores does not count: the browser supplies it, so it proves no
// step the account took. An account without channel credit gets nothing and is
// not pending. The phone step calls this after recording the number, and the
// order reference "channel-bonus:<id>" keeps the bonus to one grant.
func HwGrantChannelBonus(userID int, now int64) (granted bool, pending bool, err error) {
	if userID <= 0 || now <= 0 {
		return false, false, ErrHwInvalidCreditGrant
	}
	ref := strconv.Itoa(userID)
	var channelPackages int64
	if err := DB.Model(&HwCreditPackage{}).
		Where("user_id = ? AND source = ? AND order_ref = ?", userID, HwSourceAdmin, hwChannelRefPrefix+ref).
		Count(&channelPackages).Error; err != nil {
		return false, false, err
	}
	if channelPackages == 0 {
		return false, false, nil
	}
	hasPhone, err := HwUserHasPhoneSignal(userID)
	if err != nil {
		return false, false, err
	}
	if !hasPhone {
		return false, true, nil
	}
	bonus, err := hwChannelBonusQuota()
	if err != nil {
		return false, false, err
	}
	granted, err = GrantCreditPackage(nil, userID, bonus, HwSourceAdmin, hwChannelBonusRefPrefix+ref, now)
	if errors.Is(err, ErrHwOrderRefConflict) {
		// The bonus was granted before at another daily rate; that grant stands.
		return false, false, nil
	}
	return granted, false, err
}

type hwChannelCount struct {
	InviterId int
	N         int
}

// HwListChannels returns every channel with its signups, paying customers and
// earned credit.
func HwListChannels() ([]HwChannelRow, error) {
	var pkgs []HwCreditPackage
	if err := DB.Where("source = ? AND order_ref LIKE ?", HwSourceAdmin, hwChannelRefPrefix+"%").
		Order("id").Find(&pkgs).Error; err != nil {
		return nil, err
	}
	rows := make([]HwChannelRow, 0, len(pkgs))
	if len(pkgs) == 0 {
		return rows, nil
	}
	ids := make([]int, 0, len(pkgs))
	for _, pkg := range pkgs {
		ids = append(ids, pkg.UserId)
	}
	var users []User
	if err := DB.Select("id", "username", "display_name").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	names := make(map[int]User, len(users))
	for _, user := range users {
		names[user.Id] = user
	}
	var signups, paying []hwChannelCount
	if err := DB.Model(&User{}).Select("inviter_id, count(*) as n").
		Where("inviter_id IN ?", ids).Group("inviter_id").Scan(&signups).Error; err != nil {
		return nil, err
	}
	if err := DB.Table("hw_credit_packages AS p").
		Select("u.inviter_id AS inviter_id, count(DISTINCT p.user_id) AS n").
		Joins("JOIN users AS u ON u.id = p.user_id").
		Where("p.source = ? AND u.inviter_id IN ?", HwSourcePurchase, ids).
		Group("u.inviter_id").Scan(&paying).Error; err != nil {
		return nil, err
	}
	var earned []hwChannelCount
	if err := DB.Model(&HwCreditPackage{}).Select("user_id AS inviter_id, sum(granted_quota) AS n").
		Where("source = ? AND user_id IN ?", HwSourceAffiliate, ids).Group("user_id").Scan(&earned).Error; err != nil {
		return nil, err
	}
	index := func(counts []hwChannelCount) map[int]int {
		out := make(map[int]int, len(counts))
		for _, count := range counts {
			out[count.InviterId] = count.N
		}
		return out
	}
	signupBy, payingBy, earnedBy := index(signups), index(paying), index(earned)
	for _, pkg := range pkgs {
		rows = append(rows, HwChannelRow{
			UserId:          pkg.UserId,
			Username:        names[pkg.UserId].Username,
			DisplayName:     names[pkg.UserId].DisplayName,
			GrantedAt:       pkg.CreatedAt,
			ExpiresAt:       pkg.ExpiresAt,
			Signups:         signupBy[pkg.UserId],
			PayingCustomers: payingBy[pkg.UserId],
			EarnedQuota:     earnedBy[pkg.UserId],
		})
	}
	return rows, nil
}
