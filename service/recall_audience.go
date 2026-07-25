package service

import (
	"context"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const recallDaySeconds int64 = 24 * 60 * 60
const recallSpecifiedAudienceIdentifierLimit = 500

var recallAudienceExclusionKeys = []string{
	"payment_exists",
	"recent_api_activity",
	"active_subscription",
	"opted_out",
	"invalid_email",
	"unverified_email",
	"group_filtered",
	"threshold_not_met",
}

type RecallAudienceSelector struct {
	MainBatchSize int
	LogBatchSize  int
}

func NewRecallAudienceSelector() *RecallAudienceSelector {
	return &RecallAudienceSelector{MainBatchSize: 500, LogBatchSize: 200}
}

func ValidateRecallAudience(template string, cfg RecallAudienceConfig) error {
	switch template {
	case "first_purchase", "lapsed_payer", "expired_subscription":
		return validateRecallLegacyAudienceConfig(cfg)
	case "registered_only":
		if cfg.RegistrationStartAt <= 0 || cfg.RegistrationEndAt <= 0 || cfg.RegistrationEndAt < cfg.RegistrationStartAt {
			return fmt.Errorf("recall audience registration time range must have positive start and end with end at or after start")
		}
		return validateRecallAudienceGroups(cfg)
	case "specified_users":
		return validateRecallSpecifiedAudience(cfg)
	default:
		return fmt.Errorf("unknown recall audience template %q", template)
	}
}

func validateRecallLegacyAudienceConfig(cfg RecallAudienceConfig) error {
	if cfg.RegistrationAgeDays < 0 || cfg.MinRequestCount < 0 || cfg.MaxQuota < 0 ||
		cfg.MinPaidAmount < 0 || cfg.LastAPICallAgeDays < 0 || cfg.LastPaymentAgeDays < 0 ||
		cfg.SubscriptionExpiredDays < 0 || cfg.MinSubscriptionAmount < 0 || cfg.MinSubscriptionCount < 0 {
		return fmt.Errorf("recall audience thresholds must not be negative")
	}
	if err := validateRecallAudienceGroups(cfg); err != nil {
		return err
	}
	for _, provider := range cfg.PaymentProviders {
		if strings.TrimSpace(provider) == "" {
			return fmt.Errorf("recall audience payment providers must not contain empty values")
		}
	}
	return nil
}

func validateRecallAudienceGroups(cfg RecallAudienceConfig) error {
	if cfg.GroupMode != "" && cfg.GroupMode != "allow" && cfg.GroupMode != "block" {
		return fmt.Errorf("unknown recall audience group mode %q", cfg.GroupMode)
	}
	if len(cfg.Groups) == 0 && cfg.GroupMode != "" {
		return fmt.Errorf("recall audience group mode requires groups")
	}
	if len(cfg.Groups) > 0 && cfg.GroupMode == "" {
		return fmt.Errorf("recall audience groups require a group mode")
	}
	for _, group := range cfg.Groups {
		if strings.TrimSpace(group) == "" {
			return fmt.Errorf("recall audience groups must not contain empty values")
		}
	}
	return nil
}

func validateRecallSpecifiedAudience(cfg RecallAudienceConfig) error {
	for _, userID := range cfg.SpecifiedUserIDs {
		if userID <= 0 {
			return fmt.Errorf("recall specified audience user IDs must be positive")
		}
	}
	for _, email := range cfg.SpecifiedEmails {
		if _, ok := recallAudienceEmail(strings.ToLower(strings.TrimSpace(email))); !ok {
			return fmt.Errorf("recall specified audience email is invalid")
		}
	}
	userIDs := normalizeRecallUserIDs(cfg.SpecifiedUserIDs)
	emails := normalizeRecallEmails(cfg.SpecifiedEmails)
	identifierCount := len(userIDs) + len(emails)
	if identifierCount == 0 {
		return fmt.Errorf("recall specified audience requires at least one user ID or email")
	}
	if identifierCount > recallSpecifiedAudienceIdentifierLimit {
		return fmt.Errorf("recall specified audience must contain at most %d identifiers", recallSpecifiedAudienceIdentifierLimit)
	}
	return nil
}

func normalizeRecallUserIDs(values []int) []int {
	normalized := make([]int, 0, len(values))
	seen := make(map[int]struct{}, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func normalizeRecallEmails(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func (selector *RecallAudienceSelector) Preview(ctx context.Context, draft RecallCampaignDraft, sampleSize int, now time.Time) (RecallAudiencePreview, error) {
	preview := RecallAudiencePreview{
		Sample:     make([]RecallAudienceCandidate, 0),
		Exclusions: newRecallAudienceExclusions(),
	}
	if sampleSize < 0 {
		return preview, fmt.Errorf("recall audience sample size must not be negative")
	}
	exclusions, err := selector.iterate(ctx, draft, now.Unix(), func(selection recallAudienceSelection) bool {
		candidate := selection.Candidate
		preview.EligibleTotal++
		if len(preview.Sample) < sampleSize {
			candidate.SnapshotJSON = ""
			preview.Sample = append(preview.Sample, candidate)
		}
		return true
	})
	preview.Exclusions = exclusions
	return preview, err
}

func (selector *RecallAudienceSelector) Snapshot(ctx context.Context, draft RecallCampaignDraft, limit int, now time.Time) ([]model.RecallRecipient, map[string]int64, error) {
	recipients := make([]model.RecallRecipient, 0)
	if limit < 0 {
		return nil, nil, fmt.Errorf("recall audience snapshot limit must not be negative")
	}
	exclusions, err := selector.iterate(ctx, draft, now.Unix(), func(selection recallAudienceSelection) bool {
		if len(recipients) < limit {
			candidate := selection.Candidate
			recipients = append(recipients, model.RecallRecipient{
				UserId:              candidate.UserID,
				EligibilitySnapshot: candidate.SnapshotJSON,
				EmailSnapshot:       selection.Email,
				RecipientIdentity:   selection.RecipientIdentity,
				LanguageSnapshot:    candidate.Language,
				State:               model.RecallRecipientQueued,
			})
		}
		return true
	})
	return recipients, exclusions, err
}

func (selector *RecallAudienceSelector) iterate(
	ctx context.Context,
	draft RecallCampaignDraft,
	now int64,
	onEligible func(recallAudienceSelection) bool,
) (map[string]int64, error) {
	exclusions := newRecallAudienceExclusions()
	if selector == nil || selector.MainBatchSize <= 0 || selector.LogBatchSize <= 0 {
		return exclusions, fmt.Errorf("recall audience batch sizes must be positive")
	}
	if err := ValidateRecallAudience(draft.AudienceTemplate, draft.Audience); err != nil {
		return exclusions, err
	}
	query := recallCandidateQuery(draft, now, selector.MainBatchSize)
	for {
		if err := ctx.Err(); err != nil {
			return exclusions, err
		}
		facts, err := model.ListRecallCandidateFactsWithContext(ctx, query)
		if err != nil {
			return exclusions, err
		}
		if len(facts) == 0 {
			return exclusions, nil
		}

		candidates := make([]recallAudienceSelection, 0, len(facts))
		for _, fact := range facts {
			if err := ctx.Err(); err != nil {
				return exclusions, err
			}
			candidate, reason, err := recallAudienceCandidate(draft, fact, now)
			if err != nil {
				return exclusions, err
			}
			if reason != "" {
				exclusions[reason]++
				continue
			}
			candidates = append(candidates, candidate)
		}

		recentlyActive := make(map[int]struct{})
		if recallAudienceUsesRecentAPILookup(draft.AudienceTemplate) && draft.Audience.LastAPICallAgeDays > 0 && len(candidates) > 0 {
			userIDs := make([]int, 0, len(candidates))
			for i := range candidates {
				if candidates[i].Candidate.UserID > 0 {
					userIDs = append(userIDs, candidates[i].Candidate.UserID)
				}
			}
			if len(userIDs) > 0 {
				if err := ctx.Err(); err != nil {
					return exclusions, err
				}
				recentlyActive, err = model.FindRecentlyActiveRecallUserIDsWithContext(
					ctx,
					userIDs,
					now-int64(draft.Audience.LastAPICallAgeDays)*recallDaySeconds,
					selector.LogBatchSize,
				)
				if err != nil {
					return exclusions, err
				}
			}
		}
		for _, candidate := range candidates {
			if _, active := recentlyActive[candidate.Candidate.UserID]; active {
				exclusions["recent_api_activity"]++
				continue
			}
			if !onEligible(candidate) {
				return exclusions, nil
			}
		}

		query.AfterUserID = facts[len(facts)-1].User.Id
		if len(facts) < selector.MainBatchSize {
			return exclusions, nil
		}
		if draft.AudienceTemplate == "specified_users" {
			return exclusions, nil
		}
	}
}

func recallAudienceUsesRecentAPILookup(template string) bool {
	switch template {
	case "first_purchase", "lapsed_payer", "expired_subscription":
		return true
	default:
		return false
	}
}

func newRecallAudienceExclusions() map[string]int64 {
	exclusions := make(map[string]int64, len(recallAudienceExclusionKeys)+1)
	for _, key := range recallAudienceExclusionKeys {
		exclusions[key] = 0
	}
	exclusions["disabled"] = 0
	return exclusions
}

func recallCandidateQuery(draft RecallCampaignDraft, now int64, limit int) model.RecallCandidateQuery {
	cfg := draft.Audience
	paymentProviders := make([]string, len(cfg.PaymentProviders))
	for i, provider := range cfg.PaymentProviders {
		paymentProviders[i] = strings.TrimSpace(provider)
	}
	query := model.RecallCandidateQuery{
		Template:              draft.AudienceTemplate,
		Now:                   now,
		RegistrationBefore:    now - int64(cfg.RegistrationAgeDays)*recallDaySeconds,
		RegistrationStartAt:   cfg.RegistrationStartAt,
		RegistrationEndAt:     cfg.RegistrationEndAt,
		LastPaymentBefore:     now - int64(cfg.LastPaymentAgeDays)*recallDaySeconds,
		SubscriptionBefore:    now - int64(cfg.SubscriptionExpiredDays)*recallDaySeconds,
		MaxQuota:              cfg.MaxQuota,
		MinRequestCount:       cfg.MinRequestCount,
		MinPaidAmount:         cfg.MinPaidAmount,
		MinSubscriptionAmount: cfg.MinSubscriptionAmount,
		MinSubscriptionCount:  cfg.MinSubscriptionCount,
		PaymentProviders:      paymentProviders,
		SpecifiedUserIDs:      normalizeRecallUserIDs(cfg.SpecifiedUserIDs),
		SpecifiedEmails:       normalizeRecallEmails(cfg.SpecifiedEmails),
		Groups:                append([]string(nil), cfg.Groups...),
		GroupMode:             cfg.GroupMode,
		Limit:                 limit,
	}
	if draft.AudienceTemplate == "specified_users" {
		query.Limit = len(query.SpecifiedUserIDs) + len(query.SpecifiedEmails)
	}
	return query
}

type recallEligibilitySnapshot struct {
	Template              string  `json:"template"`
	UserID                int     `json:"user_id"`
	RegisteredAt          int64   `json:"registered_at"`
	Quota                 int     `json:"quota"`
	RequestCount          int     `json:"request_count"`
	PaidAmount            float64 `json:"paid_amount"`
	LastPaymentAt         int64   `json:"last_payment_at"`
	SubscriptionAmount    float64 `json:"subscription_amount"`
	SubscriptionCount     int64   `json:"subscription_count"`
	LastSubscriptionEndAt int64   `json:"last_subscription_end_at"`
}

type recallAudienceSelection struct {
	Candidate         RecallAudienceCandidate
	Email             string
	RecipientIdentity string
}

func recallAudienceCandidate(draft RecallCampaignDraft, fact model.RecallCandidateFact, now int64) (recallAudienceSelection, string, error) {
	if fact.EmailOnly {
		email, ok := recallAudienceEmail(fact.Email)
		if !ok {
			return recallAudienceSelection{}, "invalid_email", nil
		}
		snapshot, err := common.Marshal(recallEligibilitySnapshot{
			Template: draft.AudienceTemplate,
			UserID:   0,
		})
		if err != nil {
			return recallAudienceSelection{}, "", err
		}
		return recallAudienceSelection{
			Candidate: RecallAudienceCandidate{
				UserID:       0,
				EmailMasked:  model.MaskInvitationIdentity(email, ""),
				Language:     "en",
				SnapshotJSON: string(snapshot),
			},
			Email:             email,
			RecipientIdentity: fact.RecipientIdentity,
		}, "", nil
	}
	user := fact.User
	if user.Status != common.UserStatusEnabled {
		return recallAudienceSelection{}, "disabled", nil
	}
	email, ok := recallAudienceEmail(user.Email)
	if !ok {
		return recallAudienceSelection{}, "invalid_email", nil
	}
	setting := user.GetSetting()
	if setting.RecallMarketingOptOut {
		return recallAudienceSelection{}, "opted_out", nil
	}
	if draft.Audience.RequireVerifiedEmail && user.EmailVerifiedAt <= 0 {
		return recallAudienceSelection{}, "unverified_email", nil
	}
	if draft.AudienceTemplate != "specified_users" && !recallAudienceGroupAllowed(user.Group, draft.Audience.Groups, draft.Audience.GroupMode) {
		return recallAudienceSelection{}, "group_filtered", nil
	}
	if reason := recallTemplateExclusion(draft, fact, now); reason != "" {
		return recallAudienceSelection{}, reason, nil
	}
	snapshot, err := common.Marshal(recallEligibilitySnapshot{
		Template:              draft.AudienceTemplate,
		UserID:                user.Id,
		RegisteredAt:          user.CreatedAt,
		Quota:                 user.Quota,
		RequestCount:          user.RequestCount,
		PaidAmount:            fact.PaidAmount,
		LastPaymentAt:         fact.LastPaymentAt,
		SubscriptionAmount:    fact.SubscriptionAmount,
		SubscriptionCount:     fact.SubscriptionCount,
		LastSubscriptionEndAt: fact.LastSubscriptionEndAt,
	})
	if err != nil {
		return recallAudienceSelection{}, "", err
	}
	return recallAudienceSelection{
		Candidate: RecallAudienceCandidate{
			UserID:       user.Id,
			EmailMasked:  model.MaskInvitationIdentity(email, ""),
			Language:     recallAudienceLanguage(setting.Language, user.BrowserLang),
			SnapshotJSON: string(snapshot),
		},
		Email:             email,
		RecipientIdentity: fact.RecipientIdentity,
	}, "", nil
}

func recallTemplateExclusion(draft RecallCampaignDraft, fact model.RecallCandidateFact, now int64) string {
	cfg := draft.Audience
	switch draft.AudienceTemplate {
	case "first_purchase":
		if fact.HasPayment {
			return "payment_exists"
		}
		if fact.User.CreatedAt > now-int64(cfg.RegistrationAgeDays)*recallDaySeconds ||
			fact.User.Quota > cfg.MaxQuota || fact.User.RequestCount < cfg.MinRequestCount {
			return "threshold_not_met"
		}
	case "lapsed_payer":
		if !fact.HasPayment || fact.PaidAmount < cfg.MinPaidAmount || fact.User.Quota > cfg.MaxQuota ||
			fact.LastPaymentAt > now-int64(cfg.LastPaymentAgeDays)*recallDaySeconds {
			return "threshold_not_met"
		}
	case "expired_subscription":
		if fact.HasActiveSubscription {
			return "active_subscription"
		}
		if fact.SubscriptionCount < int64(cfg.MinSubscriptionCount) ||
			fact.SubscriptionAmount < cfg.MinSubscriptionAmount ||
			fact.LastSubscriptionEndAt == 0 ||
			fact.LastSubscriptionEndAt > now-int64(cfg.SubscriptionExpiredDays)*recallDaySeconds ||
			(len(cfg.PaymentProviders) > 0 && fact.SubscriptionAmount <= 0) {
			return "threshold_not_met"
		}
	case "registered_only":
		if fact.HasPayment {
			return "payment_exists"
		}
		if fact.User.CreatedAt < cfg.RegistrationStartAt ||
			fact.User.CreatedAt > cfg.RegistrationEndAt ||
			fact.User.RequestCount != 0 {
			return "threshold_not_met"
		}
	}
	return ""
}

func recallAudienceEmail(stored string) (string, bool) {
	trimmed := strings.TrimSpace(stored)
	if trimmed == "" {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed {
		return "", false
	}
	return trimmed, true
}

func recallAudienceGroupAllowed(userGroup string, groups []string, mode string) bool {
	if len(groups) == 0 {
		return true
	}
	matched := false
	for _, group := range groups {
		if strings.TrimSpace(group) == strings.TrimSpace(userGroup) {
			matched = true
			break
		}
	}
	if mode == "allow" {
		return matched
	}
	return !matched
}

func recallAudienceLanguage(settingLanguage string, browserLanguage string) string {
	if language := recallAudiencePrimaryLanguage(settingLanguage); language != "" {
		return language
	}
	if language := recallAudiencePrimaryLanguage(browserLanguage); language != "" {
		return language
	}
	return "en"
}

func recallAudiencePrimaryLanguage(language string) string {
	language = strings.TrimSpace(strings.ToLower(language))
	if language == "" {
		return ""
	}
	parts := strings.FieldsFunc(language, func(r rune) bool { return r == '-' || r == '_' })
	if len(parts) == 0 {
		return ""
	}
	return parts[0]
}
