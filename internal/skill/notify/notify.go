package notify

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	platformservice "github.com/QuantumNous/new-api/service"
	"gorm.io/gorm"
)

const (
	NotificationKindWeeklyDigest = "weekly_digest"
	NotificationKindSavedPromo   = "saved_skill_promo"
	NotificationKindLapsedUsage  = "lapsed_usage"
)

type Sender interface {
	Send(user platformmodel.User, notification dto.Notify) error
}

type SenderFunc func(user platformmodel.User, notification dto.Notify) error

func (f SenderFunc) Send(user platformmodel.User, notification dto.Notify) error {
	return f(user, notification)
}

var DefaultSender Sender = SenderFunc(func(user platformmodel.User, notification dto.Notify) error {
	return platformservice.NotifyUser(user.Id, user.Email, user.GetSetting(), notification)
})

type Options struct {
	Now       time.Time
	Window    time.Duration
	Limit     int
	Sender    Sender
	Campaign  string
	Threshold time.Duration
}

type DigestResult struct {
	UserID     int64
	Sent       bool
	Suppressed bool
	Items      []DigestItem
	Err        error
}

type DigestItem struct {
	SkillID string
	Slug    string
	Name    string
	Reason  string
	Score   float64
}

type PromoInput struct {
	SkillID       string
	PromoLabel    string
	OriginalPrice float64
	PromoPrice    float64
}

type ReengagementResult struct {
	UserID     int64
	SkillID    string
	Kind       string
	Sent       bool
	Suppressed bool
	Err        error
}

func SendWeeklyTopSkillsDigest(db *gorm.DB, opts Options) ([]DigestResult, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	opts = normalizeOptions(opts)
	users, err := optedUsers(db)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}
	start := opts.Now.Add(-opts.Window)
	previousStart := start.Add(-opts.Window)
	weekly, err := weeklySkillScores(db, previousStart, start, opts.Now)
	if err != nil {
		return nil, err
	}

	results := make([]DigestResult, 0, len(users))
	for _, user := range users {
		items, err := digestItemsForUser(db, int64(user.Id), weekly, opts.Limit)
		result := DigestResult{UserID: int64(user.Id), Items: items}
		if err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		if len(items) == 0 {
			result.Suppressed = true
			results = append(results, result)
			continue
		}
		notification := dto.NewNotify(dto.NotifyTypeChannelUpdate, "Top Skills this week", digestContent(items), nil)
		if err := opts.Sender.Send(user, notification); err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		if err := skillmodel.EmitSkillNotificationEvent(db, int64(user.Id), nil, enums.SkillUsageEventTypeNotificationSent, enums.EntryPointDigest, map[string]any{
			"notification_kind": NotificationKindWeeklyDigest,
			"campaign":          opts.Campaign,
			"skill_count":       len(items),
		}); err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		result.Sent = true
		results = append(results, result)
	}
	return results, nil
}

func SendSavedSkillPromoReengagement(db *gorm.DB, promos []PromoInput, opts Options) ([]ReengagementResult, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	opts = normalizeOptions(opts)
	results := make([]ReengagementResult, 0)
	for _, promo := range promos {
		promo.SkillID = strings.TrimSpace(promo.SkillID)
		if promo.SkillID == "" {
			continue
		}
		var skill skillmodel.Skill
		if err := db.Where("id = ?", promo.SkillID).
			Where("status = ? AND monetization_type = ?", enums.SkillStatusPublished, enums.MonetizationTypeOneTime).
			First(&skill).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return nil, err
		}
		var rows []skillmodel.UserEnabledSkill
		if err := db.Where("skill_id = ? AND enabled = ? AND removed_at IS NULL", skill.ID, true).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			result := ReengagementResult{UserID: row.UserID, SkillID: skill.ID, Kind: NotificationKindSavedPromo}
			user, ok, err := optedUserByID(db, row.UserID)
			if err != nil {
				result.Err = err
				results = append(results, result)
				continue
			}
			if !ok {
				result.Suppressed = true
				results = append(results, result)
				continue
			}
			notification := dto.NewNotify(dto.NotifyTypeChannelUpdate, "Saved Skill promo", promoContent(skill.Name, promo), nil)
			if err := opts.Sender.Send(user, notification); err != nil {
				result.Err = err
				results = append(results, result)
				continue
			}
			if err := emitReengagementSent(db, row.UserID, skill.ID, NotificationKindSavedPromo, opts.Campaign); err != nil {
				result.Err = err
				results = append(results, result)
				continue
			}
			result.Sent = true
			results = append(results, result)
		}
	}
	return results, nil
}

func SendLapsedUsageReengagement(db *gorm.DB, opts Options) ([]ReengagementResult, error) {
	if db == nil {
		return nil, errors.New("db is nil")
	}
	opts = normalizeOptions(opts)
	cutoff := opts.Now.Add(-opts.Threshold)
	var rows []skillmodel.UserEnabledSkill
	if err := db.Where("enabled = ? AND removed_at IS NULL", true).
		Where("(last_used_at IS NOT NULL AND last_used_at < ?) OR (last_used_at IS NULL AND enabled_at < ?)", cutoff, cutoff).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	results := make([]ReengagementResult, 0, len(rows))
	for _, row := range rows {
		result := ReengagementResult{UserID: row.UserID, SkillID: row.SkillID, Kind: NotificationKindLapsedUsage}
		user, ok, err := optedUserByID(db, row.UserID)
		if err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		if !ok {
			result.Suppressed = true
			results = append(results, result)
			continue
		}
		var skill skillmodel.Skill
		if err := db.Where("id = ? AND status = ?", row.SkillID, enums.SkillStatusPublished).First(&skill).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				result.Suppressed = true
				results = append(results, result)
				continue
			}
			result.Err = err
			results = append(results, result)
			continue
		}
		notification := dto.NewNotify(dto.NotifyTypeChannelUpdate, "Continue using "+skill.Name, "Pick up where you left off with "+skill.Name+".", nil)
		if err := opts.Sender.Send(user, notification); err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		if err := emitReengagementSent(db, row.UserID, skill.ID, NotificationKindLapsedUsage, opts.Campaign); err != nil {
			result.Err = err
			results = append(results, result)
			continue
		}
		result.Sent = true
		results = append(results, result)
	}
	return results, nil
}

func RecordNotificationEngagement(db *gorm.DB, userID int64, skillID *string, entryPoint enums.EntryPoint, clicked bool, campaign string) error {
	eventType := enums.SkillUsageEventTypeNotificationOpened
	action := "open"
	if clicked {
		eventType = enums.SkillUsageEventTypeNotificationClicked
		action = "click"
	}
	return skillmodel.EmitSkillNotificationEvent(db, userID, skillID, eventType, entryPoint, map[string]any{
		"action":   action,
		"campaign": campaign,
	})
}

type weeklySkillScore struct {
	Skill  skillmodel.Skill
	Score  float64
	Reason string
}

func normalizeOptions(opts Options) Options {
	if opts.Now.IsZero() {
		opts.Now = time.Now().UTC()
	} else {
		opts.Now = opts.Now.UTC()
	}
	if opts.Window <= 0 {
		opts.Window = 7 * 24 * time.Hour
	}
	if opts.Limit <= 0 {
		opts.Limit = 5
	}
	if opts.Sender == nil {
		opts.Sender = DefaultSender
	}
	if opts.Campaign == "" {
		opts.Campaign = "weekly"
	}
	if opts.Threshold <= 0 {
		opts.Threshold = 14 * 24 * time.Hour
	}
	return opts
}

func optedUsers(db *gorm.DB) ([]platformmodel.User, error) {
	var users []platformmodel.User
	if err := db.Find(&users).Error; err != nil {
		return nil, err
	}
	out := make([]platformmodel.User, 0, len(users))
	for _, user := range users {
		if user.GetSetting().MarketingEmails {
			out = append(out, user)
		}
	}
	return out, nil
}

func optedUserByID(db *gorm.DB, userID int64) (platformmodel.User, bool, error) {
	var user platformmodel.User
	if err := db.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return user, false, nil
		}
		return user, false, err
	}
	return user, user.GetSetting().MarketingEmails, nil
}

func weeklySkillScores(db *gorm.DB, previousStart, start, end time.Time) ([]weeklySkillScore, error) {
	var skills []skillmodel.Skill
	if err := db.Where("status = ?", enums.SkillStatusPublished).Find(&skills).Error; err != nil {
		return nil, err
	}
	current, err := enableCounts(db, start, end)
	if err != nil {
		return nil, err
	}
	previous, err := enableCounts(db, previousStart, start)
	if err != nil {
		return nil, err
	}
	scores := make([]weeklySkillScore, 0, len(skills))
	for _, skill := range skills {
		score := float64(current[skill.ID]) * 10
		reason := "top_downloaded"
		if skill.PublishedAt != nil && !skill.PublishedAt.Before(start) && skill.PublishedAt.Before(end) {
			score += 50
			reason = "new"
		}
		growth := current[skill.ID] - previous[skill.ID]
		if growth > 0 {
			score += float64(growth) * 8
			if reason != "new" {
				reason = "trending"
			}
		}
		if score > 0 {
			scores = append(scores, weeklySkillScore{Skill: skill, Score: score, Reason: reason})
		}
	}
	sortWeeklyScores(scores)
	return scores, nil
}

func enableCounts(db *gorm.DB, start, end time.Time) (map[string]int64, error) {
	type row struct {
		SkillID string
		Count   int64
	}
	var rows []row
	if err := db.Model(&skillmodel.SkillUsageEvent{}).
		Select("skill_id, COUNT(*) AS count").
		Where("event_type = ? AND occurred_at >= ? AND occurred_at < ? AND skill_id IS NOT NULL", enums.SkillUsageEventTypeEnabled, start, end).
		Group("skill_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
}

func digestItemsForUser(db *gorm.DB, userID int64, weekly []weeklySkillScore, limit int) ([]DigestItem, error) {
	affinity, err := userCategoryAffinity(db, userID)
	if err != nil {
		return nil, err
	}
	scored := make([]weeklySkillScore, len(weekly))
	copy(scored, weekly)
	for i := range scored {
		scored[i].Score += float64(affinity[scored[i].Skill.Category]) * 50
	}
	sortWeeklyScores(scored)
	if len(scored) > limit {
		scored = scored[:limit]
	}
	items := make([]DigestItem, 0, len(scored))
	for _, row := range scored {
		items = append(items, DigestItem{
			SkillID: row.Skill.ID,
			Slug:    row.Skill.Slug,
			Name:    row.Skill.Name,
			Reason:  row.Reason,
			Score:   row.Score,
		})
	}
	return items, nil
}

func userCategoryAffinity(db *gorm.DB, userID int64) (map[string]int, error) {
	type row struct {
		Category string
		Count    int
	}
	var rows []row
	if err := db.Table("user_enabled_skills AS ues").
		Select("skills.category AS category, COUNT(*) AS count").
		Joins("JOIN skills ON skills.id = ues.skill_id").
		Where("ues.user_id = ? AND ues.enabled = ? AND ues.removed_at IS NULL", userID, true).
		Group("skills.category").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]int, len(rows))
	for _, row := range rows {
		out[row.Category] = row.Count
	}
	return out, nil
}

func sortWeeklyScores(scores []weeklySkillScore) {
	sort.SliceStable(scores, func(i, j int) bool {
		if scores[i].Score == scores[j].Score {
			return scores[i].Skill.Name < scores[j].Skill.Name
		}
		return scores[i].Score > scores[j].Score
	})
}

func digestContent(items []DigestItem) string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.Name)
	}
	return "Top Skills this week: " + strings.Join(names, ", ")
}

func promoContent(skillName string, promo PromoInput) string {
	label := strings.TrimSpace(promo.PromoLabel)
	if label == "" {
		label = "promo"
	}
	if promo.OriginalPrice > 0 && promo.PromoPrice >= 0 && promo.PromoPrice < promo.OriginalPrice {
		return fmt.Sprintf("%s is on %s: %.2f -> %.2f USD.", skillName, label, promo.OriginalPrice, promo.PromoPrice)
	}
	return fmt.Sprintf("%s has a new %s.", skillName, label)
}

func emitReengagementSent(db *gorm.DB, userID int64, skillID string, kind, campaign string) error {
	return skillmodel.EmitSkillNotificationEvent(db, userID, &skillID, enums.SkillUsageEventTypeNotificationSent, enums.EntryPointReengage, map[string]any{
		"notification_kind": kind,
		"campaign":          campaign,
	})
}
