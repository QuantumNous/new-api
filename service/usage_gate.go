package service

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

const (
	UsageLimitMonthly = "monthly"
	UsageLimitImages  = "images"
)

// UsageLimitMessage is the wall a user meets when an allowance runs out. Same
// contract as subscriptionPauseMessage: branded, translated, and carrying the
// exact refill date rather than "next cycle".
func UsageLimitMessage(lang string, kind string, resetAt int64) string {
	key := i18n.MsgUsageMonthlyExhausted
	if kind == UsageLimitImages {
		key = i18n.MsgUsageImagesExhausted
	}
	date := formatPauseDate(resetAt, lang, time.Local)
	if date == "" {
		date = i18n.Translate(lang, i18n.MsgUsageNoDate)
	}
	return i18n.Translate(lang, key, map[string]any{"Date": date})
}

// RequestImageHashes pulls the distinct images out of a relay request.
// RelayInfo.Request carries the parsed body (see relay/compatible_handler.go:28
// for the same assertion), so the gate needs nothing threaded into it.
func RequestImageHashes(req dto.Request) []string {
	general, ok := req.(*dto.GeneralOpenAIRequest)
	if !ok || general == nil {
		return nil
	}
	return ImageHashes(general.Messages)
}

// CheckUsageAllowance refuses a request that would exceed the caller's monthly
// cost allowance or image entitlement, and reserves the images it accepts.
// Called before pre-consume, so a refusal costs nothing.
func CheckUsageAllowance(userId int, group string, lang string, sub *model.UserSubscription, imageHashes []string, now time.Time) error {
	cycleStart, resetAt := UsageCycle(CycleMonth, sub, now)

	if limit := setting.GetMonthlyCostLimit(group); limit > 0 {
		used, _, _, err := model.GetUsage(userId, CycleMonth, cycleStart)
		if err != nil {
			return nil // a counter we cannot read must not block a paying request
		}
		if used >= limit {
			return errors.New(UsageLimitMessage(lang, UsageLimitMonthly, resetAt))
		}
	}

	if len(imageHashes) > 0 {
		limit := setting.GetMonthlyImageLimit(group)
		if _, err := model.ReserveImages(userId, cycleStart, imageHashes, limit); err != nil {
			if errors.Is(err, model.ErrImageLimitReached) {
				return errors.New(UsageLimitMessage(lang, UsageLimitImages, resetAt))
			}
			return nil // a storage failure must not block the request
		}
	}
	return nil
}
