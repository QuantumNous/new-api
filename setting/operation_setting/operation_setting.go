package operation_setting

import (
	"strings"
	"sync"
)

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

// businessErrorKeywordsMu guards BusinessErrorKeywords against torn
// reads. The classifier consults this slice on every upstream error
// (hot path), so a plain `var []string` is not safe: the previous
// FromString implementation cleared the global slice and then
// repopulated it, leaving concurrent readers with a partial or empty
// list mid-update — which silently misclassifies errors and changes
// cooldown behaviour. Writers build into a local slice, then swap
// under the lock; readers copy the slice header under the same lock
// before iterating.
var businessErrorKeywordsMu sync.RWMutex

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

// BusinessErrorKeywordsSnapshot returns a copy of the current
// BusinessErrorKeywords slice under the read lock. Callers iterate
// over the returned slice without holding the lock. The copy is O(n)
// and the read path is the hot path (every error classifier call),
// so this is the right trade-off: writers are rare (config reload)
// and pay an O(n) copy each, readers are common and pay a
// constant-time RLock.
func BusinessErrorKeywordsSnapshot() []string {
	businessErrorKeywordsMu.RLock()
	defer businessErrorKeywordsMu.RUnlock()
	out := make([]string, len(BusinessErrorKeywords))
	copy(out, BusinessErrorKeywords)
	return out
}

// SetBusinessErrorKeywordsForTest atomically replaces the keyword
// slice. Intended only for tests that need to pin the classifier to
// a known keyword list. The caller is responsible for restoring the
// previous value via t.Cleanup if the test mutates the slice in
// place; a non-empty `next` is taken over verbatim.
func SetBusinessErrorKeywordsForTest(next []string) {
	businessErrorKeywordsMu.Lock()
	BusinessErrorKeywords = next
	businessErrorKeywordsMu.Unlock()
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
	businessErrorKeywordsMu.RLock()
	defer businessErrorKeywordsMu.RUnlock()
	return strings.Join(BusinessErrorKeywords, "\n")
}

func BusinessErrorKeywordsFromString(s string) {
	ak := strings.Split(s, "\n")
	next := make([]string, 0, len(ak))
	for _, k := range ak {
		k = strings.TrimSpace(k)
		k = strings.ToLower(k)
		if k != "" {
			next = append(next, k)
		}
	}
	// Build the new slice into a local variable first, then swap under
	// the write lock. This prevents concurrent readers (the classifier
	// on every upstream error) from observing an empty or partially
	// populated global list.
	businessErrorKeywordsMu.Lock()
	BusinessErrorKeywords = next
	businessErrorKeywordsMu.Unlock()
}
