package service

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/shopspring/decimal"
)

// hwFreeTrialQuotaEnv names a dollar override of the free trial amount, used
// only while no daily rate is known. Part A caps whatever comes out at its hard
// maximum anyway.
const hwFreeTrialQuotaEnv = "HW_FREE_TRIAL_QUOTA"

// hwFreeTrialTry is the free trial credit the customer sees: 250 TL. The
// ledger keeps dollars, so the amount is converted against the daily rate that
// the price snapshot job publishes in HwTryPerUsd.
const hwFreeTrialTry = 250

// hwFreeTrialDefaultDollars is the free trial fallback while no daily rate has
// been published yet: five dollars, about what 250 TL is worth at the current
// rate and half of part A's ten-dollar cap, so an unknown rate stays on the safe
// side. The cap only bites below a rate of 25 TL/USD.
const hwFreeTrialDefaultDollars = 5

// Bounds of an accepted X-HW-Device token: long enough to be a stable signal,
// short enough to stay a header value and nothing else.
const (
	hwDeviceTokenMinLen = 16
	hwDeviceTokenMaxLen = 128
)

var (
	// ErrHwInvalidDeviceToken rejects an X-HW-Device header that is neither a
	// hex string nor base64, or is too short to be a stable device signal.
	ErrHwInvalidDeviceToken = errors.New("invalid device header")
	hwHexTokenRe            = regexp.MustCompile(`^[0-9a-fA-F]+$`)
)

// HwFreeTrialQuota converts the free trial credit to quota units and clamps the
// result to part A's hard cap, so no setting can hand out more than the cap
// allows.
//
// The credit is hwFreeTrialTry lira against the daily USD/TRY rate, the same
// rate every other lira amount of the site is derived from. While no rate has
// been published the dollar fallback applies, so a fresh installation still
// hands out a trial instead of nothing.
func HwFreeTrialQuota() int {
	if rate, err := decimal.NewFromString(strings.TrimSpace(hwOptionValue(model.HwTryPerUsdOption))); err == nil && rate.IsPositive() {
		dollars := decimal.NewFromInt(hwFreeTrialTry).Div(rate)
		quota := common.QuotaFromDecimal(dollars.Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
		return min(quota, model.HwMaxFreeTrialQuota())
	}
	dollars := float64(hwFreeTrialDefaultDollars)
	if raw := strings.TrimSpace(os.Getenv(hwFreeTrialQuotaEnv)); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil && parsed >= 0 {
			dollars = parsed
		}
	}
	quota := common.QuotaFromFloat(dollars * float64(common.QuotaPerUnit))
	return min(quota, model.HwMaxFreeTrialQuota())
}

// HwNormalizeDeviceToken validates the X-HW-Device header: at most 128
// characters, at least 16, and either hexadecimal or standard base64. Hex is
// lowercased because its notation is case-insensitive; base64 stays as given
// because it is case-sensitive. An absent header yields an empty token and no
// error: old clients simply register without a device signal.
func HwNormalizeDeviceToken(header string) (string, error) {
	token := strings.TrimSpace(header)
	if token == "" {
		return "", nil
	}
	if len(token) < hwDeviceTokenMinLen || len(token) > hwDeviceTokenMaxLen {
		return "", ErrHwInvalidDeviceToken
	}
	if hwHexTokenRe.MatchString(token) {
		return strings.ToLower(token), nil
	}
	if _, err := base64.StdEncoding.DecodeString(token); err == nil {
		return token, nil
	}
	return "", ErrHwInvalidDeviceToken
}

// HwCompleteTelegramPhoneStep records the Telegram identity of an account as
// the weak Telegram signal, asks the bot to prompt for the phone number and
// then tries the free trial credit. Without a number shared through the bot the
// grant answers "unverified": a Telegram login alone proves an account, not a
// phone number, and the same SIM can start a new Telegram account. The grant
// still passes the frozen flag, the confirmed-email gate and every part A
// check; the return is (granted, reason) with the same reason strings as part A
// plus "frozen" and "email_unverified". Nothing but the outcome is logged.
func HwCompleteTelegramPhoneStep(userID int, telegramID string) (granted bool, reason string, err error) {
	if err := model.HwRecordTelegramPhoneStep(userID, telegramID); err != nil {
		return false, "", err
	}
	// The Telegram login proves the account, not a phone number, so the credit
	// still waits for the number shared through the bot. The bot may only write
	// to a chat the customer opened itself, so this prompt reaches the customers
	// who started the bot before; for everyone else the same prompt answers the
	// /start that opens the chat. The prompt leaves in the background: a chat
	// that never answers must cost a goroutine and a timeout, never the login.
	hwPromptForPhoneStep(userID, telegramID)
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return false, "", err
	}
	return hwMaybeGrantFreeTrialCredit(user)
}

// hwPhonePromptCooldown is how long one Telegram chat waits before the login
// sends it the phone prompt again; hwPhonePromptSent holds the last send per
// chat. A burst of logins on one account then costs one goroutine and one
// outbound call instead of one per login.
const hwPhonePromptCooldown = time.Minute

var hwPhonePromptSent sync.Map

// hwPhonePromptDue reserves the prompt for this chat and reports whether it may
// leave now; concurrent logins race on the same entry and only one wins.
func hwPhonePromptDue(telegramID string) bool {
	now := time.Now()
	previous, loaded := hwPhonePromptSent.LoadOrStore(telegramID, now)
	if loaded {
		if now.Sub(previous.(time.Time)) < hwPhonePromptCooldown {
			return false
		}
		if !hwPhonePromptSent.CompareAndSwap(telegramID, previous, now) {
			return false
		}
	}
	time.AfterFunc(hwPhonePromptCooldown, func() { hwPhonePromptSent.CompareAndDelete(telegramID, now) })
	return true
}

// hwPromptForPhoneStep asks the bot to show the share-contact button, outside
// the login and with its own deadline. Nothing waits for it: the customer's
// language is not known here, so the site default (Turkish) is used, and a
// failed prompt only means the /start of the chat has to carry it instead. An
// account that already shared a number is not asked again, because the prompt
// would invite a second number nobody needs.
func hwPromptForPhoneStep(userID int, telegramID string) {
	if !hwPhonePromptDue(telegramID) {
		return
	}
	go func() {
		// A panic here must not take the process down: the login would otherwise
		// be a way to crash the service.
		defer func() {
			if r := recover(); r != nil {
				common.SysLog("hw phone step prompt recovered from a panic")
			}
		}()
		hasPhone, err := model.HwUserHasPhoneSignal(userID)
		if err != nil || hasPhone {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), hwTelegramRequestTimeout)
		defer cancel()
		texts := hwTelegramTextsFor("tr")
		hwAnswerTelegramChat(ctx, telegramID, texts.Prompt, texts.Button)
	}()
}

// HwGrantFreeCreditIfPhoneStepSkipped is the local smoke-test path: only when
// HW_SKIP_PHONE_STEP is active outside production, a fresh registration gets a
// per-user dev phone signal and the free trial credit attempt. In production
// this returns phone_step_required and does nothing.
func HwGrantFreeCreditIfPhoneStepSkipped(userID int) (granted bool, reason string, err error) {
	if !common.HwPhoneStepSkipped() {
		return false, "phone_step_required", nil
	}
	if err := model.HwRecordDevPhoneStep(userID); err != nil {
		return false, "", err
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return false, "", err
	}
	return hwMaybeGrantFreeTrialCredit(user)
}

// HwRetryFreeCreditAfterEmailBind runs the grant again once an email address
// is confirmed: a customer who shared the phone number before binding an
// email would otherwise stay at zero credit for good. Without a recorded phone
// step the grant answers "unverified" and nothing changes. Outside production
// the skip flag records the step first, like at signup.
func HwRetryFreeCreditAfterEmailBind(userID int) (granted bool, reason string, err error) {
	if common.HwPhoneStepSkipped() {
		return HwGrantFreeCreditIfPhoneStepSkipped(userID)
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		return false, "", err
	}
	return hwMaybeGrantFreeTrialCredit(user)
}

// hwMaybeGrantFreeTrialCredit runs the gates that sit in front of part A's
// grant: a frozen account gets nothing (the review hold), and without a
// confirmed email address nothing either. Logging carries amounts and user
// IDs only, never a signal value.
func hwMaybeGrantFreeTrialCredit(user *model.User) (granted bool, reason string, err error) {
	if user.Role != common.RoleCommonUser {
		return false, "not_common_user", nil
	}
	frozen, err := model.HwAccountFrozen(user.Id)
	if err != nil {
		return false, "", err
	}
	if frozen {
		return false, "frozen", nil
	}
	// A channel account earns its TRY bonus with its own phone step, apart from
	// the free trial: a failed bonus is logged and leaves the trial untouched,
	// and an admin repeat of the channel grant retries it.
	if bonus, _, err := model.HwGrantChannelBonus(user.Id, common.GetTimestamp()); err != nil {
		common.SysError(common.LogText("hw: channel bonus failed for user %d (rate missing %t)", user.Id, errors.Is(err, model.ErrHwChannelRateMissing)))
	} else if bonus {
		common.SysLog(common.LogText("hw: channel bonus granted to user %d after the phone step", user.Id))
	}
	if user.Email == "" {
		return false, "email_unverified", nil
	}
	granted, reason, err = model.HwGrantFreeTrialCredit(user.Id, HwFreeTrialQuota(), common.GetTimestamp())
	if err != nil {
		return false, "", err
	}
	if granted {
		common.SysLog(common.LogText("hw: free trial credit granted to user %d", user.Id))
	}
	return granted, reason, nil
}
