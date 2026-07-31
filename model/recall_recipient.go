package model

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/mail"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrRecallRecipientBindingConflict = errors.New("recall recipient binding conflict")

const (
	RecallRecipientQueued        = "queued"
	RecallRecipientCustomerReady = "customer_ready"
	RecallRecipientCodeReady     = "code_ready"
	RecallRecipientContacting    = "contacting"
	RecallRecipientConverted     = "converted"
	RecallRecipientSuppressed    = "suppressed"
	RecallRecipientIneligible    = "ineligible"
	RecallRecipientExpired       = "expired"
	RecallRecipientFailed        = "failed"

	RecallConversionDirect   = "direct"
	RecallConversionAssisted = "assisted"
	RecallConversionNoCoupon = "no_coupon"

	RecallPromotionRevocationPending   = "pending"
	RecallPromotionRevocationCompleted = "completed"
	RecallPromotionRevocationFailed    = "failed"

	recallOfferCandidateIDBatchSize = 500
	recallOfferCandidateLimit       = 100
)

type RecallRecipient struct {
	Id                                int64   `json:"id" gorm:"primaryKey"`
	CampaignId                        int64   `json:"campaign_id" gorm:"uniqueIndex:idx_recall_campaign_identity,priority:1;index"`
	RecipientIdentity                 string  `json:"-" gorm:"type:varchar(80);not null;default:'';uniqueIndex:idx_recall_campaign_identity,priority:2"`
	UserId                            int     `json:"user_id" gorm:"default:0;index"`
	EligibilitySnapshot               string  `json:"eligibility_snapshot" gorm:"type:text;not null"`
	EmailSnapshot                     string  `json:"email_snapshot" gorm:"type:varchar(254);not null"`
	LanguageSnapshot                  string  `json:"language_snapshot" gorm:"type:varchar(16);not null"`
	State                             string  `json:"state" gorm:"type:varchar(24);not null;index"`
	LeaseOwner                        string  `json:"-" gorm:"type:varchar(96);index"`
	LeaseExpiresAt                    int64   `json:"-" gorm:"index"`
	StripeCustomerId                  string  `json:"stripe_customer_id" gorm:"type:varchar(128)"`
	StripePromotionCodeId             *string `json:"-" gorm:"type:varchar(128);uniqueIndex"`
	PromotionCode                     string  `json:"-" gorm:"type:varchar(64)"`
	PromotionExpiresAt                int64   `json:"promotion_expires_at" gorm:"index"`
	PromotionIssuedAt                 int64   `json:"promotion_issued_at" gorm:"index"`
	PromotionRevocationState          string  `json:"promotion_revocation_state" gorm:"type:varchar(16);not null;default:'';index"`
	PromotionRevocationAttemptCount   int     `json:"promotion_revocation_attempt_count" gorm:"not null;default:0"`
	PromotionRevocationNextAttemptAt  int64   `json:"promotion_revocation_next_attempt_at" gorm:"index"`
	PromotionRevocationLeaseOwner     string  `json:"-" gorm:"type:varchar(96);index"`
	PromotionRevocationLeaseExpiresAt int64   `json:"-" gorm:"index"`
	PromotionRevokedAt                int64   `json:"promotion_revoked_at" gorm:"index"`
	PromotionRevocationLastErrorCode  string  `json:"promotion_revocation_last_error_code" gorm:"type:varchar(64)"`
	ClaimTokenHash                    *string `json:"-" gorm:"type:char(64);uniqueIndex"`
	FirstSentAt                       int64   `json:"first_sent_at"`
	LastSentAt                        int64   `json:"last_sent_at"`
	ClickedAt                         int64   `json:"clicked_at"`
	ConvertedAt                       int64   `json:"converted_at"`
	ConversionKind                    string  `json:"conversion_kind" gorm:"type:varchar(16)"`
	ConversionTradeNo                 string  `json:"conversion_trade_no" gorm:"type:varchar(128);index"`
	ConversionCurrency                string  `json:"conversion_currency" gorm:"type:varchar(8)"`
	ConversionAmount                  int64   `json:"conversion_amount"`
	DiscountAmount                    int64   `json:"discount_amount"`
	LastErrorCode                     string  `json:"last_error_code" gorm:"type:varchar(64)"`
	LastErrorMessage                  string  `json:"last_error_message" gorm:"type:varchar(512)"`
	CreatedAt                         int64   `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                         int64   `json:"updated_at" gorm:"autoUpdateTime"`
}

func (recipient *RecallRecipient) BeforeCreate(tx *gorm.DB) error {
	return normalizeRecallRecipientIdentity(recipient)
}

type RecallRecipientExportSnapshot struct {
	MaxID int64 `gorm:"column:max_id"`
	Total int64 `gorm:"column:total"`
}

type RecallClaimRecord struct {
	Recipient      RecallRecipient
	Campaign       RecallCampaign
	ClaimTokenHash string
}

type RecallOfferCandidate struct {
	Recipient RecallRecipient `json:"-"`
	Campaign  RecallCampaign  `json:"-"`
}

type RecallOfferCandidatePage struct {
	Candidates           []RecallOfferCandidate
	NextAfterRecipientID int64
	HasMore              bool
}

func (candidate RecallOfferCandidate) EffectiveIssuedAt() int64 {
	if candidate.Recipient.PromotionIssuedAt > 0 {
		return candidate.Recipient.PromotionIssuedAt
	}
	return candidate.Recipient.CreatedAt
}

type RecallRecipientWorkItem struct {
	Id                int64 `gorm:"column:id"`
	CampaignId        int64 `gorm:"column:campaign_id"`
	WorkerConcurrency int   `gorm:"-"`
}

type RecallPromotionRevocationWorkItem struct {
	Id         int64 `gorm:"column:id"`
	CampaignId int64 `gorm:"column:campaign_id"`
}

type RecallPromotionPersistenceOutcome struct {
	Persisted bool
	Cancelled bool
}

type RecallAPIActivityCheck struct {
	MessageId int64
	UserId    int
	After     int64
}

type RecallAttributionCandidate struct {
	TradeNo           string
	UserId            int
	CheckoutSessionId string
	OrderCreatedAt    int64
	EnrolledAt        int64
}

func GetRecallRecipientByPromotionCodeWithContext(ctx context.Context, userID int, promotionCodeID string) (*RecallRecipient, bool, error) {
	recipient := RecallRecipient{}
	err := DB.WithContext(ctx).
		Where("user_id = ? AND stripe_promotion_code_id = ?", userID, strings.TrimSpace(promotionCodeID)).
		First(&recipient).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &recipient, true, nil
}

func GetRecallRecipientByClaimWithContext(ctx context.Context, userID int, campaignID int64, recipientID int64) (*RecallRecipient, bool, error) {
	recipient := RecallRecipient{}
	err := DB.WithContext(ctx).
		Where("id = ? AND campaign_id = ? AND user_id = ?", recipientID, campaignID, userID).
		First(&recipient).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &recipient, true, nil
}

func GetRecallRecipientByCampaignWithContext(ctx context.Context, campaignID int64, recipientID int64) (*RecallRecipient, error) {
	recipient := &RecallRecipient{}
	if err := DB.WithContext(ctx).
		Where("id = ? AND campaign_id = ?", recipientID, campaignID).
		First(recipient).Error; err != nil {
		return nil, err
	}
	return recipient, nil
}

func GetRecallRecipientByIDWithContext(ctx context.Context, recipientID int64) (*RecallRecipient, bool, error) {
	if recipientID <= 0 {
		return nil, false, nil
	}
	recipient := &RecallRecipient{}
	if err := DB.WithContext(ctx).First(recipient, recipientID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return recipient, true, nil
}

func GetRecallClaimUserWithContext(ctx context.Context, userID int) (*User, bool, error) {
	if userID <= 0 {
		return nil, false, nil
	}
	user, err := GetUserByIdWithContext(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}
	return user, true, nil
}

func BindRecallRecipientUserWithContext(ctx context.Context, recipientID int64, userID int, normalizedEmail string) (*RecallRecipient, bool, error) {
	if recipientID <= 0 {
		return nil, false, gorm.ErrRecordNotFound
	}
	if userID <= 0 {
		return nil, false, fmt.Errorf("recall recipient bind requires a positive user id")
	}
	email, ok := normalizeRecallRecipientEmail(normalizedEmail)
	if !ok {
		return nil, false, fmt.Errorf("recall recipient bind requires a normalized email")
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND user_id = 0 AND LOWER(email_snapshot) = ? AND state <> ?", recipientID, email, RecallRecipientSuppressed).
		Update("user_id", userID)
	if result.Error != nil {
		return nil, false, result.Error
	}
	var stored RecallRecipient
	if err := DB.WithContext(ctx).First(&stored, recipientID).Error; err != nil {
		return nil, false, err
	}
	if result.RowsAffected == 1 {
		return &stored, true, nil
	}
	if stored.UserId == userID {
		return &stored, false, nil
	}
	return nil, false, ErrRecallRecipientBindingConflict
}

func ListRecallOfferCandidatesForUserWithContext(ctx context.Context, userID int, normalizedEmail string, now int64) ([]RecallOfferCandidate, error) {
	page, err := listRecallOfferCandidatePageForUserWithContext(ctx, userID, normalizedEmail, now, 0, recallOfferCandidateLimit, recallOfferCandidateOrderClause("recall_recipients"), false)
	if err != nil {
		return nil, err
	}
	sortRecallOfferCandidates(page.Candidates)
	return page.Candidates, nil
}

func ListRecallOfferCandidatePageForUserWithContext(ctx context.Context, userID int, normalizedEmail string, now int64, afterRecipientID int64, limit int) (RecallOfferCandidatePage, error) {
	return listRecallOfferCandidatePageForUserWithContext(ctx, userID, normalizedEmail, now, afterRecipientID, limit, "recall_recipients.id ASC", true)
}

func listRecallOfferCandidatePageForUserWithContext(ctx context.Context, userID int, normalizedEmail string, now int64, afterRecipientID int64, limit int, orderClause string, allowPaging bool) (RecallOfferCandidatePage, error) {
	page := RecallOfferCandidatePage{Candidates: make([]RecallOfferCandidate, 0)}
	if err := ctx.Err(); err != nil {
		return page, err
	}
	if userID <= 0 {
		return page, nil
	}
	email, hasEmail := normalizeRecallRecipientEmail(normalizedEmail)
	if limit <= 0 {
		return page, nil
	}
	if allowPaging {
		if limit > recallOfferCandidateIDBatchSize {
			limit = recallOfferCandidateIDBatchSize
		}
	} else if limit > recallOfferCandidateLimit {
		limit = recallOfferCandidateLimit
	}
	var user User
	result := DB.WithContext(ctx).
		Where("id = ? AND status = ?", userID, common.UserStatusEnabled).
		Limit(1).
		Find(&user)
	if result.Error != nil {
		return page, result.Error
	}
	if result.RowsAffected == 0 {
		return page, nil
	}
	if hasEmail && strings.ToLower(strings.TrimSpace(user.Email)) != email {
		return page, nil
	}

	usableStatuses := recallOfferUsableCampaignStatuses()
	var recipients []RecallRecipient
	query := DB.WithContext(ctx).
		Model(&RecallRecipient{}).
		Select("recall_recipients.*").
		Joins("JOIN recall_campaigns ON recall_campaigns.id = recall_recipients.campaign_id").
		Where("recall_campaigns.campaign_type = ?", RecallCampaignTypePromotion).
		Where("recall_campaigns.status IN ?", usableStatuses)
	if hasEmail {
		query = query.Where("(recall_recipients.user_id = ? OR (recall_recipients.user_id = 0 AND LOWER(recall_recipients.email_snapshot) = ?))", userID, email)
	} else {
		query = query.Where("recall_recipients.user_id = ?", userID)
	}
	if afterRecipientID > 0 {
		query = query.Where("recall_recipients.id > ?", afterRecipientID)
	}
	query = applyRecallOfferRecipientFilters(query, "recall_recipients", now)
	err := query.
		Order(orderClause).
		Limit(limit).
		Find(&recipients).Error
	if err != nil {
		return page, err
	}
	if len(recipients) > 0 {
		page.NextAfterRecipientID = recipients[len(recipients)-1].Id
		page.HasMore = allowPaging && len(recipients) == limit
	}
	recipientIDs := make([]int64, 0, len(recipients))
	for _, recipient := range recipients {
		if recipient.UserId == 0 {
			if !hasEmail {
				continue
			}
			_, _, bindErr := bindRecallOfferCandidateRecipientUserWithContext(ctx, recipient.Id, userID, email, now)
			if bindErr != nil {
				if errors.Is(bindErr, ErrRecallRecipientBindingConflict) || errors.Is(bindErr, gorm.ErrRecordNotFound) {
					continue
				}
				return page, bindErr
			}
		}
		recipientIDs = append(recipientIDs, recipient.Id)
	}
	if len(recipientIDs) == 0 {
		return page, nil
	}

	finalRecipientsByID := make(map[int64]RecallRecipient, len(recipientIDs))
	for start := 0; start < len(recipientIDs); start += recallOfferCandidateIDBatchSize {
		end := start + recallOfferCandidateIDBatchSize
		if end > len(recipientIDs) {
			end = len(recipientIDs)
		}
		var batch []RecallRecipient
		finalQuery := DB.WithContext(ctx).
			Model(&RecallRecipient{}).
			Select("recall_recipients.*").
			Joins("JOIN recall_campaigns ON recall_campaigns.id = recall_recipients.campaign_id").
			Where("recall_recipients.id IN ? AND recall_recipients.user_id = ?", recipientIDs[start:end], userID).
			Where("recall_campaigns.campaign_type = ?", RecallCampaignTypePromotion).
			Where("recall_campaigns.status IN ?", usableStatuses)
		finalQuery = applyRecallOfferRecipientFilters(finalQuery, "recall_recipients", now)
		if err := finalQuery.Order("recall_recipients.id ASC").Find(&batch).Error; err != nil {
			return page, err
		}
		for _, recipient := range batch {
			finalRecipientsByID[recipient.Id] = recipient
		}
	}
	finalRecipients := make([]RecallRecipient, 0, len(recipientIDs))
	for _, recipientID := range recipientIDs {
		recipient, ok := finalRecipientsByID[recipientID]
		if !ok {
			continue
		}
		finalRecipients = append(finalRecipients, recipient)
	}
	if len(finalRecipients) == 0 {
		return page, nil
	}

	campaignIDs := make([]int64, 0, len(finalRecipients))
	seenCampaignIDs := make(map[int64]struct{}, len(finalRecipients))
	for _, recipient := range finalRecipients {
		if _, exists := seenCampaignIDs[recipient.CampaignId]; exists {
			continue
		}
		seenCampaignIDs[recipient.CampaignId] = struct{}{}
		campaignIDs = append(campaignIDs, recipient.CampaignId)
	}
	campaigns := make([]RecallCampaign, 0, len(campaignIDs))
	for start := 0; start < len(campaignIDs); start += recallOfferCandidateIDBatchSize {
		end := start + recallOfferCandidateIDBatchSize
		if end > len(campaignIDs) {
			end = len(campaignIDs)
		}
		var batch []RecallCampaign
		if err := DB.WithContext(ctx).
			Where("id IN ? AND campaign_type = ? AND status IN ?", campaignIDs[start:end], RecallCampaignTypePromotion, usableStatuses).
			Find(&batch).Error; err != nil {
			return page, err
		}
		campaigns = append(campaigns, batch...)
	}
	campaignsByID := make(map[int64]RecallCampaign, len(campaigns))
	for _, campaign := range campaigns {
		campaignsByID[campaign.Id] = campaign
	}
	for _, recipient := range finalRecipients {
		campaign, ok := campaignsByID[recipient.CampaignId]
		if !ok {
			continue
		}
		page.Candidates = append(page.Candidates, RecallOfferCandidate{Recipient: recipient, Campaign: campaign})
	}
	return page, nil
}

func recallOfferCandidateOrderClause(table string) string {
	prefix := ""
	if table != "" {
		prefix = table + "."
	}
	return fmt.Sprintf("CASE WHEN %spromotion_issued_at > 0 THEN %spromotion_issued_at ELSE %screated_at END DESC, %sid ASC", prefix, prefix, prefix, prefix)
}

func sortRecallOfferCandidates(candidates []RecallOfferCandidate) {
	sort.SliceStable(candidates, func(i, j int) bool {
		left := candidates[i]
		right := candidates[j]
		if left.EffectiveIssuedAt() != right.EffectiveIssuedAt() {
			return left.EffectiveIssuedAt() > right.EffectiveIssuedAt()
		}
		return left.Recipient.Id < right.Recipient.Id
	})
}

func recallOfferUsableCampaignStatuses() []string {
	return []string{RecallCampaignScheduled, RecallCampaignRunning, RecallCampaignPaused, RecallCampaignCompleted}
}

func recallOfferExcludedRecipientStates() []string {
	return []string{
		RecallRecipientConverted,
		RecallRecipientSuppressed,
		RecallRecipientIneligible,
		RecallRecipientExpired,
		RecallRecipientFailed,
	}
}

func applyRecallOfferRecipientFilters(query *gorm.DB, table string, now int64) *gorm.DB {
	column := func(name string) string {
		if table == "" {
			return name
		}
		return table + "." + name
	}
	return query.
		Where(column("state")+" NOT IN ?", recallOfferExcludedRecipientStates()).
		Where(column("stripe_promotion_code_id")+" IS NOT NULL AND "+column("stripe_promotion_code_id")+" <> ''").
		Where(column("promotion_code")+" <> ''").
		Where(column("promotion_expires_at")+" > ?", now)
}

func bindRecallOfferCandidateRecipientUserWithContext(ctx context.Context, recipientID int64, userID int, normalizedEmail string, now int64) (*RecallRecipient, bool, error) {
	if recipientID <= 0 {
		return nil, false, gorm.ErrRecordNotFound
	}
	if userID <= 0 {
		return nil, false, fmt.Errorf("recall offer candidate bind requires a positive user id")
	}
	email, ok := normalizeRecallRecipientEmail(normalizedEmail)
	if !ok {
		return nil, false, fmt.Errorf("recall offer candidate bind requires a normalized email")
	}
	query := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND user_id = 0 AND LOWER(email_snapshot) = ?", recipientID, email).
		Where(
			"EXISTS (SELECT 1 FROM recall_campaigns WHERE recall_campaigns.id = recall_recipients.campaign_id AND recall_campaigns.campaign_type = ? AND recall_campaigns.status IN ?)",
			RecallCampaignTypePromotion,
			recallOfferUsableCampaignStatuses(),
		)
	query = applyRecallOfferRecipientFilters(query, "", now)
	result := query.Update("user_id", userID)
	if result.Error != nil {
		return nil, false, result.Error
	}
	var stored RecallRecipient
	if err := DB.WithContext(ctx).First(&stored, recipientID).Error; err != nil {
		return nil, false, err
	}
	if result.RowsAffected == 1 {
		return &stored, true, nil
	}
	if stored.UserId == userID {
		return &stored, false, nil
	}
	return nil, false, ErrRecallRecipientBindingConflict
}

func ListDueRecallRecipientIDs(now int64, limit int) ([]int64, error) {
	ids := make([]int64, 0)
	if limit <= 0 {
		return ids, nil
	}
	err := DB.Model(&RecallRecipient{}).
		Where("state IN ? AND (lease_expires_at = 0 OR lease_expires_at < ?)", []string{
			RecallRecipientQueued,
			RecallRecipientCustomerReady,
			RecallRecipientCodeReady,
		}, now).
		Order("id ASC").
		Limit(limit).
		Pluck("id", &ids).Error
	return ids, err
}

func ListDueRecallRecipientWorkItems(ctx context.Context, now int64, afterID int64, limit int, excludedCampaignIDs []int64) ([]RecallRecipientWorkItem, error) {
	items := make([]RecallRecipientWorkItem, 0)
	if limit <= 0 {
		return items, nil
	}
	query := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Select("id", "campaign_id").
		Where("state IN ? AND (lease_expires_at = 0 OR lease_expires_at < ?)", []string{
			RecallRecipientQueued,
			RecallRecipientCustomerReady,
			RecallRecipientCodeReady,
		}, now)
	if afterID > 0 {
		query = query.Where("id > ?", afterID)
	}
	if len(excludedCampaignIDs) > 0 {
		query = query.Where("campaign_id NOT IN ?", excludedCampaignIDs)
	}
	if err := query.
		Order("id ASC").
		Limit(limit).
		Scan(&items).Error; err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return items, nil
	}

	campaignIDs := make([]int64, 0, len(items))
	seenCampaigns := make(map[int64]struct{}, len(items))
	for _, item := range items {
		if _, ok := seenCampaigns[item.CampaignId]; ok {
			continue
		}
		seenCampaigns[item.CampaignId] = struct{}{}
		campaignIDs = append(campaignIDs, item.CampaignId)
	}
	var campaigns []RecallCampaign
	if err := DB.WithContext(ctx).Model(&RecallCampaign{}).
		Select("id", "worker_concurrency").
		Where("id IN ?", campaignIDs).
		Find(&campaigns).Error; err != nil {
		return nil, err
	}
	concurrencyByCampaign := make(map[int64]int, len(campaigns))
	for _, campaign := range campaigns {
		concurrencyByCampaign[campaign.Id] = campaign.WorkerConcurrency
	}
	for i := range items {
		items[i].WorkerConcurrency = concurrencyByCampaign[items[i].CampaignId]
	}
	return items, nil
}

func LeaseRecallRecipient(id int64, owner string, now int64, leaseUntil int64) (bool, error) {
	result := DB.Model(&RecallRecipient{}).
		Where("id = ? AND state IN ? AND (lease_expires_at = 0 OR lease_expires_at < ?)", id, []string{
			RecallRecipientQueued,
			RecallRecipientCustomerReady,
			RecallRecipientCodeReady,
		}, now).
		Updates(map[string]any{
			"lease_owner":      owner,
			"lease_expires_at": leaseUntil,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func TryLeaseRecallRecipientWithinCampaignCapacity(ctx context.Context, recipientID int64, owner string, now int64, leaseUntil int64) (bool, error) {
	// Read the immutable routing key first so SQLite can acquire its write lock as the transaction's first statement.
	var recipient RecallRecipient
	if err := DB.WithContext(ctx).Select("campaign_id").First(&recipient, recipientID).Error; err != nil {
		return false, err
	}

	leased := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// This portable no-op write serializes admissions for one campaign on SQLite, MySQL, and PostgreSQL.
		if err := tx.Model(&RecallCampaign{}).
			Where("id = ?", recipient.CampaignId).
			UpdateColumn("id", gorm.Expr("id")).Error; err != nil {
			return err
		}

		var campaign RecallCampaign
		if err := tx.Select("worker_concurrency").First(&campaign, recipient.CampaignId).Error; err != nil {
			return err
		}
		capacity := campaign.WorkerConcurrency
		if capacity < 1 {
			capacity = 1
		}
		var activeLeases int64
		if err := tx.Model(&RecallRecipient{}).
			Where("campaign_id = ? AND lease_owner <> '' AND lease_expires_at > ?", recipient.CampaignId, now).
			Count(&activeLeases).Error; err != nil {
			return err
		}
		if activeLeases >= int64(capacity) {
			return nil
		}

		result := tx.Model(&RecallRecipient{}).
			Where("id = ? AND campaign_id = ? AND state IN ? AND (lease_expires_at = 0 OR lease_expires_at < ?)", recipientID, recipient.CampaignId, []string{
				RecallRecipientQueued,
				RecallRecipientCustomerReady,
				RecallRecipientCodeReady,
			}, now).
			Updates(map[string]any{
				"lease_owner":      owner,
				"lease_expires_at": leaseUntil,
			})
		if result.Error != nil {
			return result.Error
		}
		leased = result.RowsAffected == 1
		return nil
	})
	return leased, err
}

func ReleaseRecallRecipientLease(id int64, owner string, expectedLeaseUntil int64) error {
	return DB.Model(&RecallRecipient{}).
		Where("id = ? AND lease_owner = ? AND lease_expires_at = ?", id, owner, expectedLeaseUntil).
		Updates(map[string]any{
			"lease_owner":      "",
			"lease_expires_at": int64(0),
		}).Error
}

func GetRecallRecipientForLease(id int64, owner string) (*RecallRecipient, error) {
	return GetRecallRecipientForLeaseWithContext(context.Background(), id, owner)
}

func GetRecallRecipientForLeaseWithContext(ctx context.Context, id int64, owner string) (*RecallRecipient, error) {
	recipient := &RecallRecipient{}
	if err := DB.WithContext(ctx).
		Where("id = ? AND lease_owner = ? AND lease_expires_at > 0", id, owner).
		First(recipient).Error; err != nil {
		return nil, err
	}
	return recipient, nil
}

func AdvanceRecallRecipient(id int64, owner string, from []string, to string, fields map[string]any) (bool, error) {
	recipient, err := GetRecallRecipientForLease(id, owner)
	if err != nil {
		return false, err
	}
	return AdvanceRecallRecipientLease(context.Background(), id, owner, recipient.LeaseExpiresAt, from, to, fields)
}

func AdvanceRecallRecipientLease(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, from []string, to string, fields map[string]any) (bool, error) {
	if len(from) == 0 {
		return false, nil
	}
	allowedFields := map[string]struct{}{
		"stripe_customer_id":       {},
		"stripe_promotion_code_id": {},
		"promotion_code":           {},
		"promotion_expires_at":     {},
		"last_error_code":          {},
		"last_error_message":       {},
	}
	updates := make(map[string]any, len(fields)+3)
	for key, value := range fields {
		if _, ok := allowedFields[key]; !ok {
			return false, fmt.Errorf("unsupported recall recipient completion field %q", key)
		}
		updates[key] = value
	}
	updates["state"] = to
	updates["lease_owner"] = ""
	updates["lease_expires_at"] = int64(0)
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND lease_owner = ? AND lease_expires_at = ? AND state IN ?", id, owner, expectedLeaseUntil, from).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func PersistRecallRecipientStripeCustomer(ctx context.Context, id int64, customerID string) (bool, error) {
	customerID = strings.TrimSpace(customerID)
	if customerID == "" {
		return false, fmt.Errorf("Stripe Customer ID must not be empty")
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND (stripe_customer_id = '' OR stripe_customer_id = ?)", id, customerID).
		Update("stripe_customer_id", customerID)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 1 {
		return true, nil
	}
	var stored RecallRecipient
	if err := DB.WithContext(ctx).Select("stripe_customer_id").First(&stored, id).Error; err != nil {
		return false, err
	}
	return strings.TrimSpace(stored.StripeCustomerId) == customerID, nil
}

func PrepareRecallRecipientPromotion(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, code string) (bool, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return false, fmt.Errorf("promotion code must not be empty")
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND lease_owner = ? AND lease_expires_at = ? AND state = ? AND promotion_code = ''", id, owner, expectedLeaseUntil, RecallRecipientCustomerReady).
		Update("promotion_code", code)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func PersistRecallRecipientPromotion(ctx context.Context, id int64, promotionID string, code string, issuedAt int64) (bool, error) {
	promotionID = strings.TrimSpace(promotionID)
	code = strings.TrimSpace(code)
	if promotionID == "" || code == "" {
		return false, fmt.Errorf("Stripe Promotion Code ID and code must not be empty")
	}
	updates := map[string]any{
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           code,
	}
	if issuedAt > 0 {
		updates["promotion_issued_at"] = gorm.Expr("CASE WHEN promotion_issued_at IS NULL OR promotion_issued_at = 0 THEN ? ELSE promotion_issued_at END", issuedAt)
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND (stripe_promotion_code_id IS NULL OR stripe_promotion_code_id = '' OR stripe_promotion_code_id = ?)", id, promotionID).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected == 1 {
		return true, nil
	}
	var stored RecallRecipient
	if err := DB.WithContext(ctx).Select("stripe_promotion_code_id", "promotion_code").First(&stored, id).Error; err != nil {
		return false, err
	}
	return stored.StripePromotionCodeId != nil && strings.TrimSpace(*stored.StripePromotionCodeId) == promotionID && stored.PromotionCode == code, nil
}

func DeferRecallRecipientLease(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, retryAt int64, errorCode string) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND lease_owner = ? AND lease_expires_at = ? AND state IN ?", id, owner, expectedLeaseUntil, []string{
			RecallRecipientQueued,
			RecallRecipientCustomerReady,
			RecallRecipientCodeReady,
		}).
		Updates(map[string]any{
			"lease_owner":        "",
			"lease_expires_at":   retryAt,
			"last_error_code":    errorCode,
			"last_error_message": "",
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func PersistRecallRecipientPromotionForLeaseWithContext(ctx context.Context, id int64, campaignID int64, owner string, expectedLeaseUntil int64, promotionID string, code string, issuedAt int64) (RecallPromotionPersistenceOutcome, error) {
	promotionID = strings.TrimSpace(promotionID)
	code = strings.TrimSpace(code)
	if promotionID == "" || code == "" {
		return RecallPromotionPersistenceOutcome{}, fmt.Errorf("Stripe Promotion Code ID and code must not be empty")
	}
	var campaign RecallCampaign
	if err := DB.WithContext(ctx).Select("status").First(&campaign, campaignID).Error; err != nil {
		return RecallPromotionPersistenceOutcome{}, err
	}
	updates := map[string]any{
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           code,
	}
	if issuedAt > 0 {
		updates["promotion_issued_at"] = gorm.Expr("CASE WHEN promotion_issued_at IS NULL OR promotion_issued_at = 0 THEN ? ELSE promotion_issued_at END", issuedAt)
	}
	if campaign.Status == RecallCampaignCancelled {
		updates["promotion_revocation_state"] = RecallPromotionRevocationPending
		updates["promotion_revocation_next_attempt_at"] = int64(0)
		updates["promotion_revocation_lease_owner"] = ""
		updates["promotion_revocation_lease_expires_at"] = int64(0)
		updates["promotion_revocation_last_error_code"] = ""
		updates["lease_owner"] = ""
		updates["lease_expires_at"] = int64(0)
	}
	outcome := RecallPromotionPersistenceOutcome{}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND campaign_id = ? AND state = ?",
			id, campaignID, RecallRecipientCustomerReady).
		Where("(stripe_promotion_code_id IS NULL OR stripe_promotion_code_id = '' OR stripe_promotion_code_id = ?)", promotionID).
		Updates(updates)
	if result.Error != nil {
		return outcome, result.Error
	}
	if result.RowsAffected == 1 {
		outcome.Persisted = true
		outcome.Cancelled = campaign.Status == RecallCampaignCancelled
		return outcome, nil
	}
	var stored RecallRecipient
	if err := DB.WithContext(ctx).Select("stripe_promotion_code_id", "promotion_code").First(&stored, id).Error; err != nil {
		return outcome, err
	}
	outcome.Persisted = stored.StripePromotionCodeId != nil && strings.TrimSpace(*stored.StripePromotionCodeId) == promotionID && stored.PromotionCode == code
	outcome.Cancelled = campaign.Status == RecallCampaignCancelled
	return outcome, nil
}

func ListDueRecallPromotionRevocationsWithContext(ctx context.Context, now int64, limit int) ([]RecallPromotionRevocationWorkItem, error) {
	items := make([]RecallPromotionRevocationWorkItem, 0)
	if limit <= 0 {
		return items, nil
	}
	err := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Select("recall_recipients.id", "recall_recipients.campaign_id").
		Joins("JOIN recall_campaigns ON recall_campaigns.id = recall_recipients.campaign_id").
		Where("recall_recipients.state <> ?", RecallRecipientConverted).
		Where("recall_recipients.stripe_promotion_code_id IS NOT NULL AND recall_recipients.stripe_promotion_code_id <> ''").
		Where("recall_recipients.promotion_code <> ''").
		Where("(recall_recipients.promotion_revocation_lease_expires_at = 0 OR recall_recipients.promotion_revocation_lease_expires_at < ?)", now).
		Where(
			"(recall_recipients.promotion_revocation_state = ? AND (recall_recipients.promotion_revocation_next_attempt_at = 0 OR recall_recipients.promotion_revocation_next_attempt_at <= ?)) OR "+
				"(recall_campaigns.status = ? AND recall_recipients.promotion_revocation_state = '' AND recall_recipients.promotion_expires_at > ?)",
			RecallPromotionRevocationPending,
			now,
			RecallCampaignCancelled,
			now,
		).
		Order("recall_recipients.id ASC").
		Limit(limit).
		Scan(&items).Error
	return items, err
}

func LeaseRecallPromotionRevocation(ctx context.Context, id int64, owner string, now int64, leaseUntil int64) (bool, error) {
	if strings.TrimSpace(owner) == "" {
		return false, fmt.Errorf("recall promotion revocation lease owner is required")
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND state <> ?", id, RecallRecipientConverted).
		Where("stripe_promotion_code_id IS NOT NULL AND stripe_promotion_code_id <> ''").
		Where("promotion_code <> ''").
		Where("(promotion_revocation_lease_expires_at = 0 OR promotion_revocation_lease_expires_at < ?)", now).
		Where(
			"(promotion_revocation_state = ? AND (promotion_revocation_next_attempt_at = 0 OR promotion_revocation_next_attempt_at <= ?)) OR "+
				"(promotion_revocation_state = '' AND promotion_expires_at > ? AND EXISTS (SELECT 1 FROM recall_campaigns WHERE recall_campaigns.id = recall_recipients.campaign_id AND recall_campaigns.status = ?))",
			RecallPromotionRevocationPending,
			now,
			now,
			RecallCampaignCancelled,
		).
		Updates(map[string]any{
			"promotion_revocation_state":            RecallPromotionRevocationPending,
			"promotion_revocation_lease_owner":      strings.TrimSpace(owner),
			"promotion_revocation_lease_expires_at": leaseUntil,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func CompleteRecallPromotionRevocation(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, revokedAt int64, errorCode string) (bool, error) {
	updates := map[string]any{
		"promotion_revocation_state":            RecallPromotionRevocationCompleted,
		"promotion_revocation_next_attempt_at":  int64(0),
		"promotion_revocation_lease_owner":      "",
		"promotion_revocation_lease_expires_at": int64(0),
		"promotion_revoked_at":                  revokedAt,
		"promotion_revocation_last_error_code":  sanitizeRecallErrorCode(errorCode),
	}
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND promotion_revocation_state = ? AND promotion_revocation_lease_owner = ? AND promotion_revocation_lease_expires_at = ?",
			id, RecallPromotionRevocationPending, strings.TrimSpace(owner), expectedLeaseUntil).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func DeferRecallPromotionRevocation(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, retryAt int64, errorCode string) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND promotion_revocation_state = ? AND promotion_revocation_lease_owner = ? AND promotion_revocation_lease_expires_at = ?",
			id, RecallPromotionRevocationPending, strings.TrimSpace(owner), expectedLeaseUntil).
		Updates(map[string]any{
			"promotion_revocation_attempt_count":    gorm.Expr("promotion_revocation_attempt_count + ?", 1),
			"promotion_revocation_next_attempt_at":  retryAt,
			"promotion_revocation_lease_owner":      "",
			"promotion_revocation_lease_expires_at": int64(0),
			"promotion_revocation_last_error_code":  sanitizeRecallErrorCode(errorCode),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func FailRecallPromotionRevocation(ctx context.Context, id int64, owner string, expectedLeaseUntil int64, errorCode string) (bool, error) {
	result := DB.WithContext(ctx).Model(&RecallRecipient{}).
		Where("id = ? AND promotion_revocation_state = ? AND promotion_revocation_lease_owner = ? AND promotion_revocation_lease_expires_at = ?",
			id, RecallPromotionRevocationPending, strings.TrimSpace(owner), expectedLeaseUntil).
		Updates(map[string]any{
			"promotion_revocation_state":            RecallPromotionRevocationFailed,
			"promotion_revocation_attempt_count":    gorm.Expr("promotion_revocation_attempt_count + ?", 1),
			"promotion_revocation_next_attempt_at":  int64(0),
			"promotion_revocation_lease_owner":      "",
			"promotion_revocation_lease_expires_at": int64(0),
			"promotion_revocation_last_error_code":  sanitizeRecallErrorCode(errorCode),
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func sanitizeRecallErrorCode(code string) string {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range code {
		switch {
		case r >= 'a' && r <= 'z':
			b.WriteRune(r)
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '_' || r == '-':
			b.WriteRune(r)
		}
		if b.Len() >= 64 {
			break
		}
	}
	return b.String()
}

func ScheduleRecallStageOneAndAdvance(ctx context.Context, recipientID int64, owner string, expectedLeaseUntil int64, message RecallMessage) (bool, error) {
	return ScheduleRecallStageOneFromStatesAndAdvance(ctx, recipientID, owner, expectedLeaseUntil, []string{RecallRecipientCodeReady}, message)
}

func ScheduleRecallStageOneFromStatesAndAdvance(ctx context.Context, recipientID int64, owner string, expectedLeaseUntil int64, fromStates []string, message RecallMessage) (bool, error) {
	if message.StageNo != 1 {
		return false, fmt.Errorf("recall stage-one message must have stage number 1")
	}
	if len(fromStates) == 0 {
		return false, fmt.Errorf("recall stage-one message requires at least one source state")
	}
	won := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&RecallRecipient{}).
			Where("id = ? AND lease_owner = ? AND lease_expires_at = ? AND state IN ?", recipientID, owner, expectedLeaseUntil, fromStates).
			Updates(map[string]any{
				"state":              RecallRecipientContacting,
				"lease_owner":        "",
				"lease_expires_at":   int64(0),
				"last_error_code":    "",
				"last_error_message": "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		message.RecipientId = recipientID
		message.State = RecallMessageScheduled
		message.ClaimTokenHash = nil
		occurredAt, err := getDBTimestamp(tx)
		if err != nil {
			return err
		}
		if err := CreateRecallMessagesWithStateEventsTx(tx, 0, []RecallMessage{message}, occurredAt); err != nil {
			return err
		}
		won = true
		return nil
	})
	return won, err
}

func SetRecallMessageClaimHash(ctx context.Context, messageID int64, leaseOwner string, expectedLeaseUntil int64, claimHash string) (bool, error) {
	updated := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var message RecallMessage
		if err := tx.Select("recipient_id", "stage_no").
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", messageID, RecallMessageLeased, leaseOwner, expectedLeaseUntil).
			First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		result := tx.Model(&RecallMessage{}).
			Where("id = ? AND state = ? AND lease_owner = ? AND lease_expires_at = ?", messageID, RecallMessageLeased, leaseOwner, expectedLeaseUntil).
			Update("claim_token_hash", claimHash)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return nil
		}
		if message.StageNo == 1 {
			if err := tx.Model(&RecallRecipient{}).
				Where("id = ?", message.RecipientId).
				Update("claim_token_hash", claimHash).Error; err != nil {
				return err
			}
		}
		updated = true
		return nil
	})
	return updated, err
}

func FindRecallClaimByHashWithContext(ctx context.Context, claimHash string) (*RecallClaimRecord, bool, error) {
	recipient := RecallRecipient{}
	storedHash := ""
	err := DB.WithContext(ctx).Where("claim_token_hash = ?", claimHash).First(&recipient).Error
	if err == gorm.ErrRecordNotFound {
		message := RecallMessage{}
		if err := DB.WithContext(ctx).Where("claim_token_hash = ?", claimHash).First(&message).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, false, nil
			}
			return nil, false, err
		}
		if message.ClaimTokenHash != nil {
			storedHash = *message.ClaimTokenHash
		}
		if err := DB.WithContext(ctx).First(&recipient, message.RecipientId).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, false, nil
			}
			return nil, false, err
		}
	} else if err != nil {
		return nil, false, err
	} else if recipient.ClaimTokenHash != nil {
		storedHash = *recipient.ClaimTokenHash
	}
	campaign := RecallCampaign{}
	if err := DB.WithContext(ctx).First(&campaign, recipient.CampaignId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, false, nil
		}
		return nil, false, err
	}
	return &RecallClaimRecord{Recipient: recipient, Campaign: campaign, ClaimTokenHash: storedHash}, true, nil
}

func SetRecallMarketingOptOutWithContext(ctx context.Context, userID int, now int64) (bool, error) {
	found := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		user := User{}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		found = true
		setting := dto.UserSetting{}
		if user.Setting != "" {
			if err := common.Unmarshal([]byte(user.Setting), &setting); err != nil {
				return err
			}
		}
		setting.RecallMarketingOptOut = true
		settingJSON, err := common.Marshal(setting)
		if err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userID).Update("setting", string(settingJSON)).Error; err != nil {
			return err
		}
		_, err = cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
			return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Joins("JOIN recall_recipients ON recall_recipients.id = recall_messages.recipient_id").
				Where("recall_messages.id > ? AND recall_recipients.user_id = ? AND recall_messages.state IN ?", afterID, userID, cancellableRecallMessageStates())
		}, 0, "user_opted_out", now)
		return err
	})
	if err != nil {
		return false, err
	}
	if !found {
		return false, nil
	}
	return true, invalidateUserCache(userID)
}

func SuppressRecallRecipientWithContext(ctx context.Context, recipientID int64, now int64) (bool, error) {
	if recipientID <= 0 {
		return false, gorm.ErrRecordNotFound
	}
	suppressed := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var recipient RecallRecipient
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&recipient, recipientID).Error; err != nil {
			return err
		}
		if recipient.UserId > 0 {
			return nil
		}
		if recipient.State != RecallRecipientSuppressed {
			result := tx.Model(&RecallRecipient{}).
				Where("id = ? AND user_id = 0", recipientID).
				Updates(map[string]any{
					"state":              RecallRecipientSuppressed,
					"lease_owner":        "",
					"lease_expires_at":   int64(0),
					"last_error_code":    "",
					"last_error_message": "",
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				var refreshed RecallRecipient
				if err := tx.First(&refreshed, recipientID).Error; err != nil {
					return err
				}
				if refreshed.UserId > 0 {
					return nil
				}
				return ErrRecallRecipientBindingConflict
			}
		}
		if _, err := cancelRecallMessagesInBatches(tx, func(afterID int64) *gorm.DB {
			return tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("recipient_id = ? AND id > ? AND state IN ?", recipientID, afterID, cancellableRecallMessageStates())
		}, 0, "recipient_unsubscribed", now); err != nil {
			return err
		}
		suppressed = true
		return nil
	})
	return suppressed, err
}

func insertRecallRunEvent(tx *gorm.DB, runEvent *RecallEvent) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		// A duplicate INSERT IGNORE reports zero affected rows; unlike UPDATE, this ownership signal is not changed by clientFoundRows.
		return tx.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(runEvent)
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(runEvent)
}

func InsertRecallRecipientsAndRunEvent(campaignID int64, recipients []RecallRecipient, messages []RecallMessage, runEvent RecallEvent) (int, error) {
	alignedMessages := make([]bool, len(messages))
	hasAlignedMessages := false
	for i := range messages {
		if messages[i].RecipientId == 0 {
			if len(messages) != len(recipients) {
				return 0, fmt.Errorf("cannot align %d recall messages with %d recipients", len(messages), len(recipients))
			}
			alignedMessages[i] = true
			hasAlignedMessages = true
		}
	}
	for i := range recipients {
		recipients[i].CampaignId = campaignID
		if err := normalizeRecallRecipientIdentity(&recipients[i]); err != nil {
			return 0, err
		}
	}
	if err := validateRecallRecipientIdentitiesUnique(recipients); err != nil {
		return 0, err
	}
	runEvent.CampaignId = campaignID

	inserted := int64(0)
	ownedRun := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		eventResult := insertRecallRunEvent(tx, &runEvent)
		if eventResult.Error != nil {
			return eventResult.Error
		}
		if eventResult.RowsAffected == 0 {
			return nil
		}
		ownedRun = true

		if len(recipients) > 0 {
			result := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "campaign_id"}, {Name: "recipient_identity"}},
				DoNothing: true,
			}).Create(&recipients)
			if result.Error != nil {
				return result.Error
			}
			inserted = result.RowsAffected
		}

		if hasAlignedMessages {
			identities := make([]string, len(recipients))
			for i := range recipients {
				identities[i] = recipients[i].RecipientIdentity
			}
			var storedRecipients []RecallRecipient
			if err := tx.Select("id", "recipient_identity").
				Where("campaign_id = ? AND recipient_identity IN ?", campaignID, identities).
				Find(&storedRecipients).Error; err != nil {
				return err
			}
			recipientIDsByIdentity := make(map[string]int64, len(storedRecipients))
			for _, recipient := range storedRecipients {
				recipientIDsByIdentity[recipient.RecipientIdentity] = recipient.Id
			}
			for i, aligned := range alignedMessages {
				if !aligned {
					continue
				}
				recipientID, ok := recipientIDsByIdentity[recipients[i].RecipientIdentity]
				if !ok {
					return fmt.Errorf("recall recipient for campaign %d identity %s was not persisted", campaignID, recipients[i].RecipientIdentity)
				}
				messages[i].RecipientId = recipientID
			}
		}
		if len(messages) == 0 {
			return nil
		}
		occurredAt := runEvent.CreatedAt
		if occurredAt == 0 {
			var err error
			occurredAt, err = getDBTimestamp(tx)
			if err != nil {
				return err
			}
		}
		return CreateRecallMessagesWithStateEventsTx(tx, campaignID, messages, occurredAt)
	})
	if err != nil {
		return 0, err
	}
	if !ownedRun {
		return 0, nil
	}
	return int(inserted), nil
}

func ListRecallRecipients(campaignID int64, offset int, limit int) ([]RecallRecipient, int64, error) {
	return ListRecallRecipientsWithContext(context.Background(), campaignID, offset, limit, "")
}

func ListRecallRecipientsWithContext(ctx context.Context, campaignID int64, offset int, limit int, state string) ([]RecallRecipient, int64, error) {
	recipients := make([]RecallRecipient, 0)
	var total int64
	query := DB.WithContext(ctx).Model(&RecallRecipient{}).Where("campaign_id = ?", campaignID)
	if state != "" {
		query = query.Where("state = ?", state)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset, limit, bounded := boundRecallReadWindow(offset, limit)
	if !bounded {
		return recipients, total, nil
	}
	if err := query.Order("id ASC").Offset(offset).Limit(limit).Find(&recipients).Error; err != nil {
		return nil, 0, err
	}
	return recipients, total, nil
}

func GetRecallRecipientExportSnapshotWithContext(ctx context.Context, campaignID int64) (RecallRecipientExportSnapshot, error) {
	if err := ctx.Err(); err != nil {
		return RecallRecipientExportSnapshot{}, err
	}
	snapshot := RecallRecipientExportSnapshot{}
	err := DB.WithContext(ctx).
		Model(&RecallRecipient{}).
		Select("COALESCE(MAX(id), 0) AS max_id, COUNT(*) AS total").
		Where("campaign_id = ?", campaignID).
		Scan(&snapshot).Error
	return snapshot, err
}

func ListRecallRecipientsForExportWithContext(ctx context.Context, campaignID int64, afterID int64, maxID int64, limit int) ([]RecallRecipient, error) {
	recipients := make([]RecallRecipient, 0)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if maxID <= 0 || limit <= 0 {
		return recipients, nil
	}
	if afterID < 0 {
		afterID = 0
	}
	const exportPageSizeMax = 500
	if limit > exportPageSizeMax {
		limit = exportPageSizeMax
	}
	err := DB.WithContext(ctx).
		Where("campaign_id = ? AND id > ? AND id <= ?", campaignID, afterID, maxID).
		Order("id ASC").
		Limit(limit).
		Find(&recipients).Error
	return recipients, err
}

func ManualRetryRecallRecipientAndAdminEventWithContext(ctx context.Context, campaignID int64, recipientID int64, expectedUpdatedAt int64, to string, event RecallEvent) (bool, error) {
	if event.CampaignId != campaignID || event.RecipientId != recipientID {
		return false, fmt.Errorf("recall recipient admin event target does not match recipient %d", recipientID)
	}
	if err := validateRecallAdminEvent(&event); err != nil {
		return false, err
	}
	retried := false
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		won, err := manualRetryRecallRecipient(tx, campaignID, recipientID, expectedUpdatedAt, to)
		if err != nil {
			return err
		}
		if !won {
			return nil
		}
		retried = true
		return insertRequiredRecallAdminEvent(tx, &event)
	})
	if err != nil {
		return false, err
	}
	return retried, nil
}

func manualRetryRecallRecipient(db *gorm.DB, campaignID int64, recipientID int64, expectedUpdatedAt int64, to string) (bool, error) {
	switch to {
	case RecallRecipientQueued, RecallRecipientCustomerReady, RecallRecipientCodeReady:
	default:
		return false, fmt.Errorf("unsupported recall recipient retry state %q", to)
	}
	result := db.Model(&RecallRecipient{}).
		Where("id = ? AND campaign_id = ? AND state = ? AND updated_at = ?", recipientID, campaignID, RecallRecipientFailed, expectedUpdatedAt).
		Updates(map[string]any{
			"state":              to,
			"lease_owner":        "",
			"lease_expires_at":   int64(0),
			"last_error_code":    "",
			"last_error_message": "",
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MaskPromotionCode(code string) string {
	if len(code) <= 8 {
		return "........"
	}
	return code[:4] + "****" + code[len(code)-2:]
}

type RecallCandidateQuery struct {
	Template              string
	Now                   int64
	RegistrationBefore    int64
	RegistrationStartAt   int64
	RegistrationEndAt     int64
	LastPaymentBefore     int64
	SubscriptionBefore    int64
	MaxQuota              int
	MinRequestCount       int
	MinPaidAmount         float64
	MinSubscriptionAmount float64
	MinSubscriptionCount  int
	PaymentProviders      []string
	SpecifiedUserIDs      []int
	SpecifiedEmails       []string
	Groups                []string
	GroupMode             string
	AfterUserID           int
	Limit                 int
}

type RecallCandidateFact struct {
	User                  User
	RecipientIdentity     string
	Email                 string
	EmailOnly             bool
	HasPayment            bool
	PaidAmount            float64
	LastPaymentAt         int64
	SubscriptionAmount    float64
	SubscriptionCount     int64
	LastSubscriptionEndAt int64
	HasActiveSubscription bool
}

type recallPaymentFactRow struct {
	Id              int
	UserId          int
	Money           float64
	PaymentProvider string
	TradeNo         string
	CreateTime      int64
	CompleteTime    int64
}

func ListRecallCandidateFacts(query RecallCandidateQuery) ([]RecallCandidateFact, error) {
	return ListRecallCandidateFactsWithContext(context.Background(), query)
}

func ListRecallCandidateFactsWithContext(ctx context.Context, query RecallCandidateQuery) ([]RecallCandidateFact, error) {
	facts := make([]RecallCandidateFact, 0)
	if query.Limit <= 0 {
		return facts, nil
	}
	if query.Template == "specified_users" && query.AfterUserID > 0 {
		return facts, nil
	}
	var users []User
	userQuery := DB.WithContext(ctx).Where("id > ?", query.AfterUserID)
	specifiedEmails := make([]string, 0)
	switch query.Template {
	case "registered_only":
		userQuery = userQuery.
			Where("created_at >= ? AND created_at <= ?", query.RegistrationStartAt, query.RegistrationEndAt).
			Where("request_count = ?", 0)
	case "registration_time_range":
		userQuery = userQuery.
			Where("created_at >= ? AND created_at <= ?", query.RegistrationStartAt, query.RegistrationEndAt)
	case "specified_users":
		ids := normalizeRecallCandidateUserIDs(query.SpecifiedUserIDs)
		emails := normalizeRecallCandidateEmails(query.SpecifiedEmails)
		specifiedEmails = emails
		switch {
		case len(ids) > 0 && len(emails) > 0:
			userQuery = DB.WithContext(ctx).Where("(id IN ? OR LOWER(email) IN ?)", ids, emails)
		case len(ids) > 0:
			userQuery = DB.WithContext(ctx).Where("id IN ?", ids)
		case len(emails) > 0:
			userQuery = DB.WithContext(ctx).Where("LOWER(email) IN ?", emails)
		default:
			return facts, nil
		}
		query.Limit = len(ids) + len(emails)
	}
	if err := userQuery.
		Order("id ASC").
		Limit(query.Limit).
		Find(&users).Error; err != nil {
		return nil, err
	}

	userIDs := make([]int, len(users))
	facts = make([]RecallCandidateFact, len(users))
	factByUserID := make(map[int]*RecallCandidateFact, len(users))
	matchedSpecifiedEmails := make(map[string]struct{}, len(users))
	for i := range users {
		userIDs[i] = users[i].Id
		email := strings.ToLower(strings.TrimSpace(users[i].Email))
		if query.Template == "specified_users" {
			for _, specifiedEmail := range specifiedEmails {
				if email == specifiedEmail {
					matchedSpecifiedEmails[specifiedEmail] = struct{}{}
				}
			}
		}
		facts[i] = RecallCandidateFact{
			User:              users[i],
			RecipientIdentity: RecallRecipientIdentityForUser(users[i].Id),
			Email:             email,
		}
		factByUserID[users[i].Id] = &facts[i]
	}
	if query.Template == "specified_users" {
		for _, email := range specifiedEmails {
			if _, matched := matchedSpecifiedEmails[email]; matched {
				continue
			}
			facts = append(facts, RecallCandidateFact{
				RecipientIdentity: RecallRecipientIdentityForEmail(email),
				Email:             email,
				EmailOnly:         true,
			})
		}
	}
	if len(userIDs) == 0 {
		return facts, nil
	}
	if query.Template == "registration_time_range" {
		return facts, nil
	}

	providerFilter := (query.Template == "lapsed_payer" || query.Template == "expired_subscription") && len(query.PaymentProviders) > 0
	topupQuery := DB.WithContext(ctx).Model(&TopUp{}).
		Select("id", "user_id", "money", "payment_provider", "trade_no", "create_time", "complete_time").
		Where("user_id IN ? AND status = ?", userIDs, common.TopUpStatusSuccess)
	if providerFilter {
		topupQuery = topupQuery.Where("payment_provider IN ?", query.PaymentProviders)
	}
	var topups []recallPaymentFactRow
	if err := topupQuery.Find(&topups).Error; err != nil {
		return nil, err
	}

	subscriptionOrderQuery := DB.WithContext(ctx).Model(&SubscriptionOrder{}).
		Select("id", "user_id", "money", "payment_provider", "trade_no", "create_time", "complete_time").
		Where("user_id IN ? AND status = ?", userIDs, common.TopUpStatusSuccess)
	if providerFilter {
		subscriptionOrderQuery = subscriptionOrderQuery.Where("payment_provider IN ?", query.PaymentProviders)
	}
	var subscriptionOrders []recallPaymentFactRow
	if err := subscriptionOrderQuery.Find(&subscriptionOrders).Error; err != nil {
		return nil, err
	}

	seenPayments := make(map[int]map[string]struct{}, len(users))
	addPayment := func(row recallPaymentFactRow, source string) {
		fact := factByUserID[row.UserId]
		if fact == nil {
			return
		}
		fact.HasPayment = true
		paidAt := row.CompleteTime
		if paidAt == 0 {
			paidAt = row.CreateTime
		}
		if paidAt > fact.LastPaymentAt {
			fact.LastPaymentAt = paidAt
		}
		key := row.TradeNo
		if key == "" {
			key = fmt.Sprintf("%s:%d", source, row.Id)
		}
		if seenPayments[row.UserId] == nil {
			seenPayments[row.UserId] = make(map[string]struct{})
		}
		if _, exists := seenPayments[row.UserId][key]; exists {
			return
		}
		seenPayments[row.UserId][key] = struct{}{}
		fact.PaidAmount += row.Money
	}
	for _, topup := range topups {
		addPayment(topup, "topup")
	}
	for _, order := range subscriptionOrders {
		addPayment(order, "subscription")
		if fact := factByUserID[order.UserId]; fact != nil {
			fact.SubscriptionAmount += order.Money
		}
	}

	var subscriptions []UserSubscription
	if err := DB.WithContext(ctx).Where("user_id IN ?", userIDs).Find(&subscriptions).Error; err != nil {
		return nil, err
	}
	for _, subscription := range subscriptions {
		fact := factByUserID[subscription.UserId]
		if fact == nil {
			continue
		}
		fact.SubscriptionCount++
		if subscription.EndTime > fact.LastSubscriptionEndAt {
			fact.LastSubscriptionEndAt = subscription.EndTime
		}
		if subscription.Status == "active" && subscription.EndTime > query.Now {
			fact.HasActiveSubscription = true
		}
	}
	return facts, nil
}

func RecallRecipientIdentityForUser(userID int) string {
	if userID <= 0 {
		return ""
	}
	return fmt.Sprintf("user:%d", userID)
}

func RecallRecipientIdentityForEmail(email string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(email))
	return fmt.Sprintf("email:%x", sum)
}

func normalizeRecallRecipientIdentity(recipient *RecallRecipient) error {
	if recipient == nil {
		return fmt.Errorf("recall recipient is required")
	}
	if strings.TrimSpace(recipient.RecipientIdentity) != "" {
		return nil
	}
	if identity := RecallRecipientIdentityForUser(recipient.UserId); identity != "" {
		recipient.RecipientIdentity = identity
		return nil
	}
	email, ok := normalizeRecallRecipientEmail(recipient.EmailSnapshot)
	if !ok {
		return fmt.Errorf("recall recipient for campaign %d requires a positive user id or valid email snapshot", recipient.CampaignId)
	}
	recipient.RecipientIdentity = RecallRecipientIdentityForEmail(email)
	return nil
}

func validateRecallRecipientIdentitiesUnique(recipients []RecallRecipient) error {
	seen := make(map[string]int, len(recipients))
	for i, recipient := range recipients {
		identity := recipient.RecipientIdentity
		if previous, ok := seen[identity]; ok {
			return fmt.Errorf("duplicate recipient identity %s at recipient indexes %d and %d", identity, previous, i)
		}
		seen[identity] = i
	}
	return nil
}

func normalizeRecallRecipientEmail(email string) (string, bool) {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed {
		return "", false
	}
	return strings.ToLower(trimmed), true
}

func normalizeRecallCandidateUserIDs(values []int) []int {
	normalized := make([]int, 0, len(values))
	seen := make(map[int]struct{}, len(values))
	for _, value := range values {
		if value <= 0 {
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

func normalizeRecallCandidateEmails(values []string) []string {
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

func HasRecallPaymentAfter(userID int, after int64) (bool, error) {
	return HasRecallPaymentAfterWithContext(context.Background(), userID, after)
}

func HasRecallPaymentAfterWithContext(ctx context.Context, userID int, after int64) (bool, error) {
	var count int64
	if err := DB.WithContext(ctx).Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND (complete_time > ? OR (complete_time = 0 AND create_time > ?))", userID, common.TopUpStatusSuccess, after, after).
		Count(&count).Error; err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	}
	if err := DB.WithContext(ctx).Model(&SubscriptionOrder{}).
		Where("user_id = ? AND status = ? AND (complete_time > ? OR (complete_time = 0 AND create_time > ?))", userID, common.TopUpStatusSuccess, after, after).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func FindRecallMessageIDsWithAPIActivityAfterWithContext(ctx context.Context, checks []RecallAPIActivityCheck, batchSize int) (map[int64]struct{}, error) {
	activeMessageIDs := make(map[int64]struct{})
	if len(checks) == 0 {
		return activeMessageIDs, nil
	}
	if batchSize <= 0 {
		return nil, fmt.Errorf("recall log batch size must be positive")
	}
	type lastActivityRow struct {
		UserId       int   `gorm:"column:user_id"`
		LastActiveAt int64 `gorm:"column:last_active_at"`
	}
	for start := 0; start < len(checks); start += batchSize {
		end := start + batchSize
		if end > len(checks) {
			end = len(checks)
		}
		batch := checks[start:end]
		userIDs := make([]int, 0, len(batch))
		seenUserIDs := make(map[int]struct{}, len(batch))
		minimumAfter := batch[0].After
		for _, check := range batch {
			if check.After < minimumAfter {
				minimumAfter = check.After
			}
			if _, seen := seenUserIDs[check.UserId]; !seen {
				seenUserIDs[check.UserId] = struct{}{}
				userIDs = append(userIDs, check.UserId)
			}
		}
		var rows []lastActivityRow
		if err := LOG_DB.WithContext(ctx).Model(&Log{}).
			Select("user_id, MAX(created_at) AS last_active_at").
			Where("type = ? AND created_at > ? AND user_id IN ?", LogTypeConsume, minimumAfter, userIDs).
			Group("user_id").
			Scan(&rows).Error; err != nil {
			return nil, err
		}
		lastActivityByUserID := make(map[int]int64, len(rows))
		for _, row := range rows {
			lastActivityByUserID[row.UserId] = row.LastActiveAt
		}
		for _, check := range batch {
			if lastActivityByUserID[check.UserId] > check.After {
				activeMessageIDs[check.MessageId] = struct{}{}
			}
		}
	}
	return activeMessageIDs, nil
}
