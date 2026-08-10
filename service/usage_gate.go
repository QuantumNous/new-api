package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

const (
	UsageLimitMonthly = "monthly"
	UsageLimitImages  = "images"
)

// UsageLimitMessage is the wall a user meets when an allowance runs out. Same
// contract as subscriptionPauseMessage: branded, translated, and carrying the
// exact refill date rather than "next cycle". When there is no date to name,
// a separate dateless message is used instead of substituting a phrase like
// "the next cycle" into the dated template — the rule is the exact date or
// nothing, never a stand-in.
func UsageLimitMessage(lang string, kind string, resetAt int64) string {
	key := i18n.MsgUsageMonthlyExhausted
	noDateKey := i18n.MsgUsageMonthlyExhaustedNoDate
	if kind == UsageLimitImages {
		key = i18n.MsgUsageImagesExhausted
		noDateKey = i18n.MsgUsageImagesExhaustedNoDate
	}
	date := formatPauseDate(resetAt, lang, time.Local)
	if date == "" {
		return i18n.Translate(lang, noDateKey)
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
			logger.LogWarn(context.Background(), fmt.Sprintf(
				"usage allowance check failed to read cost counter, allowing request (userId=%d, group=%s, op=GetUsage): %s",
				userId, group, err.Error()))
			return nil // a counter we cannot read must not block a paying request
		}
		if used >= limit {
			return errors.New(UsageLimitMessage(lang, UsageLimitMonthly, resetAt))
		}
	}

	// A group absent from the map has no configured image entitlement at all
	// and is uncapped, exactly like an absent cost-limit group (see the check
	// above): the option defaults to {}, and enforcing against a limit that
	// was never configured would 403 every image request for every group
	// until an operator fills the map in. Only a group actually present in
	// the map — including an explicit 0 — is enforced.
	if len(imageHashes) > 0 {
		if limit, found := setting.GetMonthlyImageLimit(group); found {
			if _, err := model.ReserveImages(userId, cycleStart, imageHashes, limit); err != nil {
				if errors.Is(err, model.ErrImageLimitReached) {
					if limit == 0 {
						// Explicitly configured at 0: this plan never had any
						// images to spend, so there is nothing to "refill".
						return errors.New(i18n.Translate(lang, i18n.MsgUsageImagesNotIncluded))
					}
					return errors.New(UsageLimitMessage(lang, UsageLimitImages, resetAt))
				}
				logger.LogWarn(context.Background(), fmt.Sprintf(
					"usage allowance check failed to reserve images, allowing request (userId=%d, group=%s, op=ReserveImages): %s",
					userId, group, err.Error()))
				return nil // a storage failure must not block the request
			}
		}
	}
	return nil
}
