package operation_setting

import "strings"

var DemoSiteEnabled = false
var SelfUseModeEnabled = false

// TempErrorCooldownSeconds is the duration a channel is skipped by the
// selector after a temporary upstream error (e.g. 5xx, 408, 429) before
// being considered again. 0 disables cooldown for temporary errors.
var TempErrorCooldownSeconds = 30

// BusinessErrorCooldownSeconds is the duration a channel is skipped by the
// selector after a business error (e.g. 400 overdue-payment, 402 payment
// required, quota keywords) before being considered again. 0 falls back to
// the legacy behaviour (permanent AutoDisabled). Negative values disable
// cooldown entirely (channel is kept enabled but error is still recorded).
var BusinessErrorCooldownSeconds = 3600

var AutomaticDisableKeywords = []string{
	"Your credit balance is too low",
	"This organization has been disabled.",
	"You exceeded your current quota",
	"Permission denied",
	"The security token included in the request is invalid",
	"Operation not allowed",
	"Your account is not authorized",
}

// BusinessErrorKeywords are matched (case-insensitive) against the upstream
// error message to classify an error as a business error. Business errors
// are short-circuited (no retry, no other channel for the same error type)
// and routed through the long cooldown / disable path.
var BusinessErrorKeywords = []string{
	"overdue",
	"overdue-payment",
	"insufficient balance",
	"insufficient credit",
	"insufficient quota",
	"quota exceeded",
	"credit balance",
	"account is not active",
	"account has been disabled",
	"account in good standing",
	"plan does not include",
	"plan expired",
	"plan not subscribed",
	"please make sure your account is in good standing",
	"please recharge",
	"please top up",
	"please upgrade",
	"please add payment method",
	"billing issue",
	"unpaid",
	"payment required",
	"suspended",
	"terminated",
}

func AutomaticDisableKeywordsToString() string {
	return strings.Join(AutomaticDisableKeywords, "\n")
}

func AutomaticDisableKeywordsFromString(s string) {
	AutomaticDisableKeywords = []string{}
	ak := strings.Split(s, "\n")
	for _, k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			AutomaticDisableKeywords = append(AutomaticDisableKeywords, k)
		}
	}
}

func BusinessErrorKeywordsToString() string {
	return strings.Join(BusinessErrorKeywords, "\n")
}

func BusinessErrorKeywordsFromString(s string) {
	BusinessErrorKeywords = []string{}
	ak := strings.Split(s, "\n")
	for _, k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			BusinessErrorKeywords = append(BusinessErrorKeywords, k)
		}
	}
}
