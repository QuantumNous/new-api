package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"errors"
	"fmt"
	"net/mail"
	"reflect"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var ErrRecallDisabled = errors.New("recall campaigns are disabled")

const (
	recallReadPageSizeMax       = 100
	recallExportPageSize        = 500
	defaultRecallExportMaxRows  = int64(100_000)
	defaultRecallExportMaxBytes = 32 << 20
)

type recallCampaignPermanentRunError struct {
	err error
}

func (e *recallCampaignPermanentRunError) Error() string { return e.err.Error() }
func (e *recallCampaignPermanentRunError) Unwrap() error { return e.err }

func permanentRecallCampaignRunError(err error) error {
	return &recallCampaignPermanentRunError{err: err}
}

type RecallCampaignService struct {
	audience        *RecallAudienceSelector
	stripe          *RecallStripeService
	emailTranslator RecallEmailTranslator
	now             func() time.Time
	exportMaxRows   int64
	exportMaxBytes  int
}

type RecallCampaignSummary struct {
	Id                    int64  `json:"id"`
	Name                  string `json:"name"`
	Status                string `json:"status"`
	AudienceTemplate      string `json:"audience_template"`
	ExecutionMode         string `json:"execution_mode"`
	ScheduledAt           int64  `json:"scheduled_at"`
	NextRunAt             int64  `json:"next_run_at"`
	CouponSource          string `json:"coupon_source"`
	StripeCouponID        string `json:"stripe_coupon_id"`
	PromotionValidSeconds int64  `json:"promotion_valid_seconds"`
	EnrollmentLimit       int    `json:"enrollment_limit"`
	WorkerConcurrency     int    `json:"worker_concurrency"`
	ConfigRevision        int64  `json:"config_revision"`
	CreatedBy             int    `json:"created_by"`
	CreatedAt             int64  `json:"created_at"`
	UpdatedAt             int64  `json:"updated_at"`
	ActivatedAt           int64  `json:"activated_at"`
	CompletedAt           int64  `json:"completed_at"`
	RecipientTotal        int64  `json:"recipient_total"`
}

type RecallCampaignDetail struct {
	RecallCampaignSummary
	Draft RecallCampaignDraft `json:"draft"`
}

type RecallMessageView struct {
	Id                int64  `json:"id"`
	RecipientId       int64  `json:"recipient_id"`
	StageNo           int    `json:"stage_no"`
	TemplateVersion   int    `json:"template_version"`
	ScheduledAt       int64  `json:"scheduled_at"`
	State             string `json:"state"`
	AttemptCount      int    `json:"attempt_count"`
	NextAttemptAt     int64  `json:"next_attempt_at"`
	LeaseExpiresAt    int64  `json:"lease_expires_at"`
	ProviderMessageId string `json:"provider_message_id"`
	AcceptedAt        int64  `json:"accepted_at"`
	FailedAt          int64  `json:"failed_at"`
	LastErrorCode     string `json:"last_error_code"`
	LastErrorMessage  string `json:"last_error_message"`
	CreatedAt         int64  `json:"created_at"`
	UpdatedAt         int64  `json:"updated_at"`
}

type RecallRecipientView struct {
	Id                  int64               `json:"id"`
	CampaignId          int64               `json:"campaign_id"`
	UserId              int                 `json:"user_id"`
	LanguageSnapshot    string              `json:"language_snapshot"`
	State               string              `json:"state"`
	StripeCustomerId    string              `json:"stripe_customer_id"`
	PromotionCodeMasked string              `json:"promotion_code_masked"`
	PromotionExpiresAt  int64               `json:"promotion_expires_at"`
	FirstSentAt         int64               `json:"first_sent_at"`
	LastSentAt          int64               `json:"last_sent_at"`
	ClickedAt           int64               `json:"clicked_at"`
	ConvertedAt         int64               `json:"converted_at"`
	ConversionKind      string              `json:"conversion_kind"`
	ConversionTradeNo   string              `json:"conversion_trade_no"`
	ConversionCurrency  string              `json:"conversion_currency"`
	ConversionAmount    int64               `json:"conversion_amount"`
	DiscountAmount      int64               `json:"discount_amount"`
	LastErrorCode       string              `json:"last_error_code"`
	LastErrorMessage    string              `json:"last_error_message"`
	CreatedAt           int64               `json:"created_at"`
	UpdatedAt           int64               `json:"updated_at"`
	Messages            []RecallMessageView `json:"messages"`
}

func NewRecallCampaignService(audience *RecallAudienceSelector, stripeService *RecallStripeService) *RecallCampaignService {
	return NewRecallCampaignServiceWithTranslator(audience, stripeService, nil)
}

func NewRecallCampaignServiceWithTranslator(audience *RecallAudienceSelector, stripeService *RecallStripeService, translator RecallEmailTranslator) *RecallCampaignService {
	if audience == nil {
		audience = NewRecallAudienceSelector()
	}
	if stripeService == nil {
		stripeService = NewRecallStripeService(nil)
	}
	return &RecallCampaignService{
		audience:        audience,
		stripe:          stripeService,
		emailTranslator: translator,
		now:             time.Now,
		exportMaxRows:   defaultRecallExportMaxRows,
		exportMaxBytes:  defaultRecallExportMaxBytes,
	}
}

func (s *RecallCampaignService) List(ctx context.Context, page *common.PageInfo, status string) ([]RecallCampaignSummary, int64, error) {
	if page == nil {
		return nil, 0, fmt.Errorf("recall campaign page is required")
	}
	normalizeRecallPage(page)
	campaigns, total, err := model.ListRecallCampaignsWithContext(ctx, strings.TrimSpace(status), page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		return nil, 0, err
	}
	summaries := make([]RecallCampaignSummary, 0, len(campaigns))
	for i := range campaigns {
		recipientTotal, err := model.CountRecallCampaignRecipientsWithContext(ctx, campaigns[i].Id)
		if err != nil {
			return nil, 0, err
		}
		summaries = append(summaries, recallCampaignSummary(campaigns[i], recipientTotal))
	}
	return summaries, total, nil
}

func (s *RecallCampaignService) GetDetail(ctx context.Context, id int64) (RecallCampaignDetail, error) {
	if id <= 0 {
		return RecallCampaignDetail{}, fmt.Errorf("recall campaign ID must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return RecallCampaignDetail{}, err
	}
	draft, err := recallCampaignDraftFromModel(campaign)
	if err != nil {
		return RecallCampaignDetail{}, err
	}
	recipientTotal, err := model.CountRecallCampaignRecipientsWithContext(ctx, id)
	if err != nil {
		return RecallCampaignDetail{}, err
	}
	return RecallCampaignDetail{
		RecallCampaignSummary: recallCampaignSummary(*campaign, recipientTotal),
		Draft:                 draft,
	}, nil
}

func (s *RecallCampaignService) ListRecipients(ctx context.Context, id int64, page *common.PageInfo, state string) ([]RecallRecipientView, int64, error) {
	if id <= 0 || page == nil {
		return nil, 0, fmt.Errorf("recall campaign ID and page are required")
	}
	normalizeRecallPage(page)
	recipients, total, err := model.ListRecallRecipientsWithContext(ctx, id, page.GetStartIdx(), page.GetPageSize(), strings.TrimSpace(state))
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int64, len(recipients))
	for i := range recipients {
		ids[i] = recipients[i].Id
	}
	messages, err := model.ListRecallMessagesForRecipientIDsWithContext(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	messagesByRecipient := make(map[int64][]RecallMessageView, len(ids))
	for i := range messages {
		messagesByRecipient[messages[i].RecipientId] = append(messagesByRecipient[messages[i].RecipientId], recallMessageView(messages[i]))
	}
	views := make([]RecallRecipientView, 0, len(recipients))
	for i := range recipients {
		views = append(views, recallRecipientView(recipients[i], messagesByRecipient[recipients[i].Id]))
	}
	return views, total, nil
}

func (s *RecallCampaignService) ListEvents(ctx context.Context, id int64, page *common.PageInfo) ([]model.RecallEvent, int64, error) {
	if id <= 0 || page == nil {
		return nil, 0, fmt.Errorf("recall campaign ID and page are required")
	}
	normalizeRecallPage(page)
	return model.ListRecallEventsWithContext(ctx, id, page.GetStartIdx(), page.GetPageSize())
}

func normalizeRecallPage(page *common.PageInfo) {
	if page.Page < 1 {
		page.Page = 1
	}
	if page.PageSize < 1 {
		page.PageSize = common.ItemsPerPage
	}
	if page.PageSize > recallReadPageSizeMax {
		page.PageSize = recallReadPageSizeMax
	}
}

func (s *RecallCampaignService) RetryRecipient(ctx context.Context, actorID int, campaignID int64, recipientID int64, acknowledgeUncertain bool) error {
	if err := recallCampaignGate(ctx); err != nil {
		return err
	}
	if actorID <= 0 || campaignID <= 0 || recipientID <= 0 {
		return fmt.Errorf("recall campaign actor, campaign, and recipient IDs must be positive")
	}
	recipient, err := model.GetRecallRecipientByCampaignWithContext(ctx, campaignID, recipientID)
	if err != nil {
		return err
	}
	if recipient.State == model.RecallRecipientFailed {
		nextState := model.RecallRecipientQueued
		if strings.TrimSpace(recipient.StripeCustomerId) != "" {
			nextState = model.RecallRecipientCustomerReady
		}
		if recipient.StripePromotionCodeId != nil && strings.TrimSpace(*recipient.StripePromotionCodeId) != "" && strings.TrimSpace(recipient.PromotionCode) != "" {
			nextState = model.RecallRecipientCodeReady
		}
		event := model.RecallEvent{
			CampaignId:    campaignID,
			RecipientId:   recipientID,
			EventType:     "recipient_retry",
			Source:        "admin",
			SourceEventId: recallAdminSourceEventID(ctx, "retry", fmt.Sprintf("actor:%d:campaign:%d:recipient:%d:state:%s:updated:%d", actorID, campaignID, recipientID, recipient.State, recipient.UpdatedAt)),
			EventData: recallAdminEventData(actorID, map[string]any{
				"action":           "retry",
				"target":           "recipient",
				"previous_state":   recipient.State,
				"previous_updated": recipient.UpdatedAt,
				"next_state":       nextState,
			}),
			CreatedAt: s.now().Unix(),
		}
		won, err := model.ManualRetryRecallRecipientAndAdminEventWithContext(ctx, campaignID, recipientID, recipient.UpdatedAt, nextState, event)
		if err != nil {
			return err
		}
		if !won {
			return fmt.Errorf("recall recipient %d is no longer failed", recipientID)
		}
		return nil
	}

	messages, err := model.ListRecallMessagesForRecipientWithContext(ctx, recipientID)
	if err != nil {
		return err
	}
	var selected *model.RecallMessage
	now := s.now().Unix()
	for i := range messages {
		if messages[i].State == model.RecallMessageFailed {
			selected = &messages[i]
			break
		}
	}
	if selected == nil {
		for i := range messages {
			if messages[i].State == model.RecallMessageUncertain {
				selected = &messages[i]
				break
			}
		}
	}
	if selected == nil {
		for i := range messages {
			if messages[i].State == model.RecallMessageSending && messages[i].LeaseExpiresAt > 0 && messages[i].LeaseExpiresAt < now {
				selected = &messages[i]
				break
			}
		}
	}
	if selected == nil {
		return fmt.Errorf("recall recipient %d has no failed message or failed recipient work", recipientID)
	}
	if (selected.State == model.RecallMessageUncertain || selected.State == model.RecallMessageSending) && !acknowledgeUncertain {
		return fmt.Errorf("acknowledge_uncertain=true is required to retry uncertain recall message %d", selected.Id)
	}
	eventIdentity := fmt.Sprintf("actor:%d:campaign:%d:recipient:%d:message:%d:state:%s:attempt:%d:failed:%d:updated:%d", actorID, campaignID, recipientID, selected.Id, selected.State, selected.AttemptCount, selected.FailedAt, selected.UpdatedAt)
	eventFields := map[string]any{
		"action":                    "retry",
		"target":                    "message",
		"message_id":                selected.Id,
		"previous_state":            selected.State,
		"previous_attempt_count":    selected.AttemptCount,
		"previous_failed_at":        selected.FailedAt,
		"previous_template_version": selected.TemplateVersion,
		"previous_updated":          selected.UpdatedAt,
		"acknowledge_uncertain":     acknowledgeUncertain,
	}
	if selected.State == model.RecallMessageSending {
		eventIdentity = fmt.Sprintf("%s:lease:%d", eventIdentity, selected.LeaseExpiresAt)
		eventFields["previous_lease_expires_at"] = selected.LeaseExpiresAt
	}
	event := model.RecallEvent{
		CampaignId:    campaignID,
		RecipientId:   recipientID,
		EventType:     "recipient_retry",
		Source:        "admin",
		SourceEventId: recallAdminSourceEventID(ctx, "retry", eventIdentity),
		EventData:     recallAdminEventData(actorID, eventFields),
		CreatedAt:     now,
	}
	won, err := model.ManualRetryRecallMessageAndAdminEventWithContext(ctx, selected.Id, selected.State, selected.UpdatedAt, now, event)
	if err != nil {
		return err
	}
	if !won {
		return fmt.Errorf("recall message %d is no longer %s", selected.Id, selected.State)
	}
	return nil
}

func (s *RecallCampaignService) Export(ctx context.Context, id int64) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if id <= 0 {
		return nil, fmt.Errorf("recall campaign ID must be positive")
	}
	if _, err := model.GetRecallCampaignByIDWithContext(ctx, id); err != nil {
		return nil, err
	}
	snapshot, err := model.GetRecallRecipientExportSnapshotWithContext(ctx, id)
	if err != nil {
		return nil, err
	}
	if snapshot.Total > s.exportMaxRows {
		return nil, fmt.Errorf("recall campaign export exceeds maximum of %d recipients", s.exportMaxRows)
	}
	buffer := recallExportBuffer{maxBytes: s.exportMaxBytes}
	writer := csv.NewWriter(&buffer)
	if err := writer.Write([]string{"recipient_id", "user_id", "state", "promotion_code_masked", "conversion_kind", "currency", "conversion_amount", "discount_amount", "converted_at"}); err != nil {
		return nil, err
	}
	afterID := int64(0)
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		recipients, err := model.ListRecallRecipientsForExportWithContext(ctx, id, afterID, snapshot.MaxID, recallExportPageSize)
		if err != nil {
			return nil, err
		}
		for i := range recipients {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			row := []string{
				strconv.FormatInt(recipients[i].Id, 10),
				strconv.Itoa(recipients[i].UserId),
				recipients[i].State,
				model.MaskPromotionCode(recipients[i].PromotionCode),
				recipients[i].ConversionKind,
				strings.ToUpper(strings.TrimSpace(recipients[i].ConversionCurrency)),
				strconv.FormatInt(recipients[i].ConversionAmount, 10),
				strconv.FormatInt(recipients[i].DiscountAmount, 10),
				strconv.FormatInt(recipients[i].ConvertedAt, 10),
			}
			if err := writer.Write(row); err != nil {
				return nil, err
			}
		}
		if len(recipients) < recallExportPageSize {
			break
		}
		afterID = recipients[len(recipients)-1].Id
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

type recallExportBuffer struct {
	buffer   bytes.Buffer
	maxBytes int
}

func (b *recallExportBuffer) Write(data []byte) (int, error) {
	if len(data) > b.maxBytes-b.buffer.Len() {
		return 0, fmt.Errorf("recall campaign export exceeds maximum of %d bytes", b.maxBytes)
	}
	return b.buffer.Write(data)
}

func (b *recallExportBuffer) Bytes() []byte {
	return b.buffer.Bytes()
}

func (s *RecallCampaignService) ValidateStripe(ctx context.Context, draft RecallCampaignDraft) (RecallStripePreview, error) {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return RecallStripePreview{}, err
	}
	normalized, err := validateAndNormalizeRecallCampaignDraft(draft, s.now())
	if err != nil {
		return RecallStripePreview{}, err
	}
	return s.validateStripe(ctx, normalized)
}

func recallCampaignSummary(campaign model.RecallCampaign, recipientTotal int64) RecallCampaignSummary {
	return RecallCampaignSummary{
		Id:                    campaign.Id,
		Name:                  campaign.Name,
		Status:                campaign.Status,
		AudienceTemplate:      campaign.AudienceTemplate,
		ExecutionMode:         campaign.ExecutionMode,
		ScheduledAt:           campaign.ScheduledAt,
		NextRunAt:             campaign.NextRunAt,
		CouponSource:          campaign.CouponSource,
		StripeCouponID:        campaign.StripeCouponId,
		PromotionValidSeconds: campaign.PromotionValidSeconds,
		EnrollmentLimit:       campaign.EnrollmentLimit,
		WorkerConcurrency:     campaign.WorkerConcurrency,
		ConfigRevision:        campaign.ConfigRevision,
		CreatedBy:             campaign.CreatedBy,
		CreatedAt:             campaign.CreatedAt,
		UpdatedAt:             campaign.UpdatedAt,
		ActivatedAt:           campaign.ActivatedAt,
		CompletedAt:           campaign.CompletedAt,
		RecipientTotal:        recipientTotal,
	}
}

func recallRecipientView(recipient model.RecallRecipient, messages []RecallMessageView) RecallRecipientView {
	if messages == nil {
		messages = make([]RecallMessageView, 0)
	}
	return RecallRecipientView{
		Id:                  recipient.Id,
		CampaignId:          recipient.CampaignId,
		UserId:              recipient.UserId,
		LanguageSnapshot:    recipient.LanguageSnapshot,
		State:               recipient.State,
		StripeCustomerId:    recipient.StripeCustomerId,
		PromotionCodeMasked: model.MaskPromotionCode(recipient.PromotionCode),
		PromotionExpiresAt:  recipient.PromotionExpiresAt,
		FirstSentAt:         recipient.FirstSentAt,
		LastSentAt:          recipient.LastSentAt,
		ClickedAt:           recipient.ClickedAt,
		ConvertedAt:         recipient.ConvertedAt,
		ConversionKind:      recipient.ConversionKind,
		ConversionTradeNo:   recipient.ConversionTradeNo,
		ConversionCurrency:  strings.ToUpper(strings.TrimSpace(recipient.ConversionCurrency)),
		ConversionAmount:    recipient.ConversionAmount,
		DiscountAmount:      recipient.DiscountAmount,
		LastErrorCode:       recipient.LastErrorCode,
		LastErrorMessage:    recipient.LastErrorMessage,
		CreatedAt:           recipient.CreatedAt,
		UpdatedAt:           recipient.UpdatedAt,
		Messages:            messages,
	}
}

func recallMessageView(message model.RecallMessage) RecallMessageView {
	return RecallMessageView{
		Id:                message.Id,
		RecipientId:       message.RecipientId,
		StageNo:           message.StageNo,
		TemplateVersion:   message.TemplateVersion,
		ScheduledAt:       message.ScheduledAt,
		State:             message.State,
		AttemptCount:      message.AttemptCount,
		NextAttemptAt:     message.NextAttemptAt,
		LeaseExpiresAt:    message.LeaseExpiresAt,
		ProviderMessageId: message.ProviderMessageId,
		AcceptedAt:        message.AcceptedAt,
		FailedAt:          message.FailedAt,
		LastErrorCode:     message.LastErrorCode,
		LastErrorMessage:  message.LastErrorMessage,
		CreatedAt:         message.CreatedAt,
		UpdatedAt:         message.UpdatedAt,
	}
}

func recallAdminEventData(actorID int, fields map[string]any) string {
	data := make(map[string]any, len(fields)+1)
	data["actor_id"] = actorID
	for key, value := range fields {
		data[key] = value
	}
	payload, err := common.Marshal(data)
	if err != nil {
		return `{}`
	}
	return string(payload)
}

func recallAdminSourceEventID(ctx context.Context, action string, fallbackIdentity string) string {
	identity := strings.TrimSpace(fallbackIdentity)
	if requestID, ok := ctx.Value(common.RequestIdKey).(string); ok && strings.TrimSpace(requestID) != "" {
		identity = strings.TrimSpace(requestID)
	}
	digest := sha256.Sum256([]byte(identity))
	return fmt.Sprintf("admin:%s:%x", action, digest)
}

func (s *RecallCampaignService) SaveDraft(ctx context.Context, actorID int, draft RecallCampaignDraft) (*model.RecallCampaign, error) {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return nil, err
	}
	if actorID <= 0 {
		return nil, fmt.Errorf("recall campaign actor ID must be positive")
	}
	canonical, err := canonicalizeRecallEmailDraft(draft)
	if err != nil {
		return nil, err
	}
	normalized, err := validateAndNormalizeRecallCampaignDraft(canonical, s.now())
	if err != nil {
		return nil, err
	}
	normalized.Emails, err = s.localizeRecallEmailStages(ctx, normalized.Emails, nil)
	if err != nil {
		return nil, err
	}
	campaign, err := recallCampaignModelFromDraft(normalized, actorID)
	if err != nil {
		return nil, err
	}
	if err := model.CreateRecallCampaignWithContext(ctx, campaign); err != nil {
		return nil, err
	}
	return campaign, nil
}

func (s *RecallCampaignService) UpdateDraft(ctx context.Context, actorID int, id int64, draft RecallCampaignDraft) (*model.RecallCampaign, error) {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return nil, err
	}
	if actorID <= 0 || id <= 0 {
		return nil, fmt.Errorf("recall campaign actor and campaign IDs must be positive")
	}
	stored, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return nil, err
	}
	if stored.Status == model.RecallCampaignDraft {
		current, err := recallCampaignDraftFromModel(stored)
		if err != nil {
			return nil, err
		}
		canonical, err := canonicalizeRecallEmailDraft(draft)
		if err != nil {
			return nil, err
		}
		normalized, err := validateAndNormalizeRecallCampaignDraft(canonical, s.now())
		if err != nil {
			return nil, err
		}
		normalized.Emails, err = s.localizeRecallEmailStages(ctx, normalized.Emails, current.Emails)
		if err != nil {
			return nil, err
		}
		updated, err := recallCampaignModelFromDraft(normalized, stored.CreatedBy)
		if err != nil {
			return nil, err
		}
		updated.Id = stored.Id
		updated.ConfigRevision = stored.ConfigRevision
		won, err := model.UpdateRecallCampaignDraftWithContext(ctx, updated)
		if err != nil {
			return nil, err
		}
		if !won {
			return nil, fmt.Errorf("recall campaign %d is no longer editable as a draft", id)
		}
		return model.GetRecallCampaignByIDWithContext(ctx, id)
	}
	if stored.Status == model.RecallCampaignCancelled || stored.Status == model.RecallCampaignCompleted {
		return nil, fmt.Errorf("recall campaign %d is in terminal state %s", id, stored.Status)
	}

	current, err := recallCampaignDraftFromModel(stored)
	if err != nil {
		return nil, err
	}
	canonical, err := canonicalizeRecallEmailDraft(draft)
	if err != nil {
		return nil, err
	}
	if !reflect.DeepEqual(recallCampaignImmutableDraft(current), recallCampaignImmutableDraft(canonical)) {
		return nil, fmt.Errorf("activated recall campaign configuration is immutable")
	}
	name := strings.TrimSpace(canonical.Name)
	if name == "" || len(name) > 128 {
		return nil, fmt.Errorf("recall campaign name must contain 1 to 128 characters")
	}
	applyRecallEmailSubjectFallbacks(canonical.Emails, name)
	normalizedEmails, err := normalizeRecallEmailStages(canonical.Emails)
	if err != nil {
		return nil, err
	}
	normalizedEmails, err = s.localizeRecallEmailStages(ctx, normalizedEmails, current.Emails)
	if err != nil {
		return nil, err
	}
	emails, err := incrementRecallEmailTemplateVersions(current.Emails, normalizedEmails)
	if err != nil {
		return nil, err
	}
	emailJSON, err := common.Marshal(emails)
	if err != nil {
		return nil, err
	}
	won, err := model.UpdateRecallCampaignEmailSequenceWithContext(ctx, id, stored.ConfigRevision, name, string(emailJSON))
	if err != nil {
		return nil, err
	}
	if !won {
		return nil, fmt.Errorf("recall campaign %d state changed while updating email content", id)
	}
	return model.GetRecallCampaignByIDWithContext(ctx, id)
}

func (s *RecallCampaignService) Preview(ctx context.Context, id int64, sampleSize int) (RecallAudiencePreview, RecallStripePreview, error) {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return RecallAudiencePreview{}, RecallStripePreview{}, err
	}
	if id <= 0 {
		return RecallAudiencePreview{}, RecallStripePreview{}, fmt.Errorf("recall campaign ID must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return RecallAudiencePreview{}, RecallStripePreview{}, err
	}
	draft, err := recallCampaignDraftFromModel(campaign)
	if err != nil {
		return RecallAudiencePreview{}, RecallStripePreview{}, err
	}
	audiencePreview, err := s.audience.Preview(ctx, draft, sampleSize, s.now())
	if err != nil {
		return RecallAudiencePreview{}, RecallStripePreview{}, err
	}
	stripePreview, err := s.validateStripe(ctx, draft)
	if err != nil {
		return RecallAudiencePreview{}, RecallStripePreview{}, err
	}
	return audiencePreview, stripePreview, nil
}

func (s *RecallCampaignService) validateStripe(ctx context.Context, draft RecallCampaignDraft) (RecallStripePreview, error) {
	resolved, err := s.stripe.ValidateAndResolveProducts(ctx, draft.Products)
	if err != nil {
		return RecallStripePreview{}, err
	}
	preview := RecallStripePreview{
		CouponSource:         draft.CouponSource,
		Discount:             draft.Discount,
		TopUpPriceIDs:        append([]string{}, resolved.TopUpPriceIDs...),
		SubscriptionPriceIDs: append([]string{}, resolved.SubscriptionPriceIDs...),
		ProductIDs:           append([]string{}, resolved.ProductIDs...),
	}
	if draft.CouponSource == "existing" {
		coupon, discount, err := s.stripe.EnsureCoupon(
			ctx,
			1,
			1,
			draft.CouponSource,
			draft.ExistingCouponID,
			draft.Discount,
			resolved,
			draft.EnrollmentLimit,
		)
		if err != nil {
			return RecallStripePreview{}, err
		}
		preview.CouponID = coupon.ID
		preview.Discount = discount
	}
	return preview, nil
}

func (s *RecallCampaignService) Activate(ctx context.Context, actorID int, id int64) error {
	if err := recallCampaignGate(ctx); err != nil {
		return err
	}
	if actorID <= 0 || id <= 0 {
		return fmt.Errorf("recall campaign actor and campaign IDs must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return err
	}
	if campaign.Status != model.RecallCampaignDraft {
		if campaign.Status == model.RecallCampaignScheduled || campaign.Status == model.RecallCampaignRunning {
			return nil
		}
		return fmt.Errorf("recall campaign %d cannot activate from %s", id, campaign.Status)
	}
	draft, err := recallCampaignDraftFromModel(campaign)
	if err != nil {
		return err
	}
	activationNow := s.now()
	draft, err = validateAndNormalizeRecallCampaignDraft(draft, activationNow)
	if err != nil {
		return err
	}
	resolved, err := s.stripe.ValidateAndResolveProducts(ctx, draft.Products)
	if err != nil {
		return err
	}
	draft.Products.TopUpPriceIDs = resolved.TopUpPriceIDs
	draft.Products.SubscriptionPriceIDs = resolved.SubscriptionPriceIDs
	draft.Products, err = resolveRecallProductDisplaySnapshots(ctx, draft.Products)
	if err != nil {
		return err
	}
	coupon, discount, err := s.stripe.EnsureCoupon(
		ctx,
		campaign.Id,
		campaign.ConfigRevision,
		draft.CouponSource,
		draft.ExistingCouponID,
		draft.Discount,
		resolved,
		draft.EnrollmentLimit,
	)
	if err != nil {
		return err
	}
	draft.Discount = discount
	if draft.ExecutionMode == "scheduled_once" && draft.Discount.CouponRedeemBy > 0 &&
		draft.Schedule.ScheduledAt >= draft.Discount.CouponRedeemBy {
		return fmt.Errorf("scheduled recall campaign must run before the Stripe Coupon redeem-by time")
	}
	fields, err := recallCampaignActivationFields(draft, coupon.ID, activationNow.Unix())
	if err != nil {
		return err
	}
	switch draft.ExecutionMode {
	case "manual":
		committed, err := s.commitCampaignRun(
			ctx,
			campaign,
			draft,
			[]string{model.RecallCampaignDraft},
			model.RecallCampaignRunning,
			nil,
			fields,
			"manual:"+strconv.FormatInt(campaign.Id, 10),
			activationNow,
		)
		if err != nil {
			return err
		}
		if !committed {
			return s.acceptRecallCampaignTargetState(ctx, id, model.RecallCampaignRunning)
		}
		return nil
	case "scheduled_once":
		fields["scheduled_at"] = draft.Schedule.ScheduledAt
		fields["next_run_at"] = draft.Schedule.ScheduledAt
		won, err := model.TransitionRecallCampaignRevisionWithContext(ctx, id, []string{model.RecallCampaignDraft}, model.RecallCampaignScheduled, campaign.ConfigRevision, fields)
		if err != nil {
			return err
		}
		if !won {
			return s.acceptRecallCampaignTargetState(ctx, id, model.RecallCampaignScheduled)
		}
		return nil
	case "recurring":
		nextRun, err := NextRecallRun(activationNow, draft.Schedule)
		if err != nil {
			return err
		}
		if draft.Discount.CouponRedeemBy > 0 && nextRun.Unix() >= draft.Discount.CouponRedeemBy {
			return fmt.Errorf("recurring recall campaign must first run before the Stripe Coupon redeem-by time")
		}
		fields["next_run_at"] = nextRun.Unix()
		won, err := model.TransitionRecallCampaignRevisionWithContext(ctx, id, []string{model.RecallCampaignDraft}, model.RecallCampaignScheduled, campaign.ConfigRevision, fields)
		if err != nil {
			return err
		}
		if !won {
			return s.acceptRecallCampaignTargetState(ctx, id, model.RecallCampaignScheduled)
		}
		return nil
	default:
		return fmt.Errorf("unsupported recall execution mode %q", draft.ExecutionMode)
	}
}

func (s *RecallCampaignService) Pause(ctx context.Context, actorID int, id int64) error {
	return s.transitionCampaign(ctx, actorID, id, []string{
		model.RecallCampaignScheduled,
		model.RecallCampaignRunning,
	}, model.RecallCampaignPaused, nil)
}

func (s *RecallCampaignService) Resume(ctx context.Context, actorID int, id int64) error {
	return s.transitionCampaign(ctx, actorID, id, []string{model.RecallCampaignPaused}, model.RecallCampaignRunning, nil)
}

func (s *RecallCampaignService) Cancel(ctx context.Context, actorID int, id int64) error {
	if err := recallCampaignGate(ctx); err != nil {
		return err
	}
	if actorID <= 0 || id <= 0 {
		return fmt.Errorf("recall campaign actor and campaign IDs must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return err
	}
	if campaign.Status == model.RecallCampaignCancelled {
		return nil
	}
	if campaign.Status == model.RecallCampaignCompleted {
		return fmt.Errorf("completed recall campaign %d cannot be cancelled", id)
	}
	now := s.now().Unix()
	event := model.RecallEvent{
		CampaignId:    id,
		EventType:     "campaign_cancelled",
		Source:        "admin",
		SourceEventId: recallAdminSourceEventID(ctx, "cancel", fmt.Sprintf("actor:%d:campaign:%d:state:%s:updated:%d", actorID, id, campaign.Status, campaign.UpdatedAt)),
		EventData: recallAdminEventData(actorID, map[string]any{
			"action":         "cancel",
			"previous_state": campaign.Status,
		}),
		CreatedAt: now,
	}
	won, err := model.CancelRecallCampaignAndAdminEventWithContext(ctx, id, []string{
		model.RecallCampaignDraft,
		model.RecallCampaignScheduled,
		model.RecallCampaignRunning,
		model.RecallCampaignPaused,
	}, now, "campaign_cancelled", event)
	if err != nil {
		return err
	}
	if !won {
		return s.acceptRecallCampaignTargetState(ctx, id, model.RecallCampaignCancelled)
	}
	return nil
}

func (s *RecallCampaignService) Complete(ctx context.Context, actorID int, id int64) error {
	if err := recallCampaignGate(ctx); err != nil {
		return err
	}
	if actorID <= 0 || id <= 0 {
		return fmt.Errorf("recall campaign actor and campaign IDs must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return err
	}
	if campaign.Status == model.RecallCampaignCompleted {
		return nil
	}
	from := []string{model.RecallCampaignScheduled, model.RecallCampaignRunning, model.RecallCampaignPaused}
	if !containsRecallCampaignStatus(from, campaign.Status) {
		return fmt.Errorf("recall campaign %d cannot transition from %s to %s", id, campaign.Status, model.RecallCampaignCompleted)
	}
	now := s.now().Unix()
	event := model.RecallEvent{
		CampaignId:    id,
		EventType:     "campaign_completed",
		Source:        "admin",
		SourceEventId: recallAdminSourceEventID(ctx, "complete", fmt.Sprintf("actor:%d:campaign:%d:state:%s:updated:%d", actorID, id, campaign.Status, campaign.UpdatedAt)),
		EventData: recallAdminEventData(actorID, map[string]any{
			"action":         "complete",
			"previous_state": campaign.Status,
		}),
		CreatedAt: now,
	}
	won, err := model.TransitionRecallCampaignAndAdminEventWithContext(ctx, id, from, model.RecallCampaignCompleted, map[string]any{"completed_at": now}, event)
	if err != nil {
		return err
	}
	if !won {
		return s.acceptRecallCampaignTargetState(ctx, id, model.RecallCampaignCompleted)
	}
	return nil
}

func (s *RecallCampaignService) transitionCampaign(ctx context.Context, actorID int, id int64, from []string, to string, fields map[string]any) error {
	if err := recallCampaignGate(ctx); err != nil {
		return err
	}
	if actorID <= 0 || id <= 0 {
		return fmt.Errorf("recall campaign actor and campaign IDs must be positive")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return err
	}
	if campaign.Status == to {
		return nil
	}
	if !containsRecallCampaignStatus(from, campaign.Status) {
		return fmt.Errorf("recall campaign %d cannot transition from %s to %s", id, campaign.Status, to)
	}
	won, err := model.TransitionRecallCampaignWithContext(ctx, id, from, to, fields)
	if err != nil {
		return err
	}
	if !won {
		return s.acceptRecallCampaignTargetState(ctx, id, to)
	}
	return nil
}

func (s *RecallCampaignService) acceptRecallCampaignTargetState(ctx context.Context, id int64, target string) error {
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, id)
	if err != nil {
		return err
	}
	if campaign.Status == target {
		return nil
	}
	return fmt.Errorf("recall campaign %d state changed to %s", id, campaign.Status)
}

func containsRecallCampaignStatus(statuses []string, status string) bool {
	for _, candidate := range statuses {
		if candidate == status {
			return true
		}
	}
	return false
}

func (s *RecallCampaignService) RunDueCampaigns(ctx context.Context, now time.Time, limit int) (int, error) {
	if err := recallCampaignGate(ctx); err != nil {
		return 0, err
	}
	if limit <= 0 {
		return 0, nil
	}
	campaigns, err := model.ListDueRecallCampaignsWithContext(ctx, now.Unix(), limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	errs := make([]error, 0)
	for i := range campaigns {
		campaign := &campaigns[i]
		committed, err := s.runDueCampaignSafely(ctx, campaign, now)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return processed, err
			}
			var permanent *recallCampaignPermanentRunError
			if errors.As(err, &permanent) {
				if _, completeErr := model.CompleteDueRecallCampaignWithContext(ctx, campaign.Id, campaign.NextRunAt, now.Unix()); completeErr != nil {
					errs = append(errs, fmt.Errorf("complete invalid recall campaign %d: %w", campaign.Id, completeErr))
				}
			}
			errs = append(errs, fmt.Errorf("run recall campaign %d: %w", campaign.Id, err))
			continue
		}
		if committed {
			processed++
		}
	}
	return processed, errors.Join(errs...)
}

func (s *RecallCampaignService) runDueCampaignSafely(ctx context.Context, campaign *model.RecallCampaign, now time.Time) (committed bool, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			committed = false
			err = fmt.Errorf("panic while running campaign: %v", recovered)
		}
	}()
	return s.runDueCampaign(ctx, campaign, now)
}

func (s *RecallCampaignService) runDueCampaign(ctx context.Context, campaign *model.RecallCampaign, now time.Time) (bool, error) {
	draft, err := recallCampaignDraftFromModel(campaign)
	if err != nil {
		return false, permanentRecallCampaignRunError(err)
	}
	if draft.Discount.CouponRedeemBy > 0 && now.Unix() >= draft.Discount.CouponRedeemBy {
		_, err := model.CompleteDueRecallCampaignWithContext(ctx, campaign.Id, campaign.NextRunAt, now.Unix())
		return false, err
	}
	switch campaign.ExecutionMode {
	case "scheduled_once":
		expected := campaign.NextRunAt
		runKey := fmt.Sprintf("scheduled_once:%d:%d", campaign.Id, campaign.ScheduledAt)
		return s.commitCampaignRun(
			ctx,
			campaign,
			draft,
			[]string{model.RecallCampaignScheduled, model.RecallCampaignRunning},
			model.RecallCampaignRunning,
			&expected,
			map[string]any{"next_run_at": int64(0)},
			runKey,
			now,
		)
	case "recurring":
		next, err := NextRecallRun(time.Unix(campaign.NextRunAt, 0), draft.Schedule)
		if err != nil {
			return false, permanentRecallCampaignRunError(err)
		}
		expected := campaign.NextRunAt
		runKey := fmt.Sprintf("recurring:%d:%d", campaign.Id, expected)
		fields := map[string]any{"next_run_at": next.Unix()}
		if draft.Discount.CouponRedeemBy > 0 && next.Unix() >= draft.Discount.CouponRedeemBy {
			fields["next_run_at"] = int64(0)
		}
		return s.commitCampaignRun(
			ctx,
			campaign,
			draft,
			[]string{model.RecallCampaignScheduled, model.RecallCampaignRunning},
			model.RecallCampaignRunning,
			&expected,
			fields,
			runKey,
			now,
		)
	default:
		return false, permanentRecallCampaignRunError(fmt.Errorf("unsupported due recall execution mode %q", campaign.ExecutionMode))
	}
}

func (s *RecallCampaignService) commitCampaignRun(
	ctx context.Context,
	campaign *model.RecallCampaign,
	draft RecallCampaignDraft,
	from []string,
	to string,
	expectedNextRunAt *int64,
	fields map[string]any,
	runKey string,
	runAt time.Time,
) (bool, error) {
	snapshotLimit := draft.EnrollmentLimit
	if campaign.ExecutionMode == "recurring" {
		enrolled, err := model.CountRecallCampaignRecipientsWithContext(ctx, campaign.Id)
		if err != nil {
			return false, err
		}
		remaining := int64(draft.EnrollmentLimit) - enrolled
		if remaining <= 0 {
			snapshotLimit = 0
		} else {
			snapshotLimit = int(remaining)
		}
	}
	var recipients []model.RecallRecipient
	var exclusions map[string]int64
	var err error
	if campaign.ExecutionMode == "recurring" {
		recipients, exclusions, err = s.snapshotRecurringAudience(ctx, campaign.Id, draft, snapshotLimit, runAt)
	} else {
		recipients, exclusions, err = s.audience.Snapshot(ctx, draft, snapshotLimit, runAt)
	}
	if err != nil {
		return false, err
	}
	expiresAt := runAt.Add(time.Duration(campaign.PromotionValidSeconds) * time.Second).Unix()
	if draft.Discount.CouponRedeemBy > 0 && draft.Discount.CouponRedeemBy < expiresAt {
		expiresAt = draft.Discount.CouponRedeemBy
	}
	if expiresAt <= runAt.Unix() {
		return false, fmt.Errorf("recall promotion expiry must be after its campaign run")
	}
	for i := range recipients {
		recipients[i].PromotionExpiresAt = expiresAt
	}
	eventData, err := common.Marshal(map[string]any{
		"eligible_total": len(recipients),
		"exclusions":     exclusions,
	})
	if err != nil {
		return false, err
	}
	committed, _, err := model.CommitRecallCampaignRun(
		ctx,
		campaign.Id,
		from,
		to,
		expectedNextRunAt,
		campaign.ConfigRevision,
		fields,
		recipients,
		nil,
		model.RecallEvent{
			EventType:     "campaign_run",
			Source:        "scheduler",
			SourceEventId: runKey,
			EventData:     string(eventData),
		},
	)
	return committed, err
}

func (s *RecallCampaignService) snapshotRecurringAudience(
	ctx context.Context,
	campaignID int64,
	draft RecallCampaignDraft,
	limit int,
	runAt time.Time,
) ([]model.RecallRecipient, map[string]int64, error) {
	existing, err := model.ListRecallCampaignRecipientKeysWithContext(ctx, campaignID)
	if err != nil {
		return nil, nil, err
	}
	recipients := make([]model.RecallRecipient, 0, limit)
	exclusions, err := s.audience.iterate(ctx, draft, runAt.Unix(), func(selection recallAudienceSelection) bool {
		candidate := selection.Candidate
		if len(recipients) >= limit {
			return true
		}
		identity := strings.TrimSpace(selection.RecipientIdentity)
		if identity == "" {
			identity = model.RecallRecipientIdentityForUser(candidate.UserID)
		}
		if _, enrolled := existing.Identities[identity]; enrolled && identity != "" {
			return true
		}
		if candidate.UserID > 0 {
			if _, enrolled := existing.UserIDs[candidate.UserID]; enrolled {
				return true
			}
		}
		email, hasEmail := normalizeRecallCampaignRecipientEmailKey(selection.Email)
		if hasEmail {
			if _, enrolled := existing.Emails[email]; enrolled {
				return true
			}
		}
		recipients = append(recipients, model.RecallRecipient{
			UserId:              candidate.UserID,
			EligibilitySnapshot: candidate.SnapshotJSON,
			EmailSnapshot:       selection.Email,
			RecipientIdentity:   identity,
			LanguageSnapshot:    candidate.Language,
			State:               model.RecallRecipientQueued,
		})
		if identity != "" {
			existing.Identities[identity] = struct{}{}
		}
		if candidate.UserID > 0 {
			existing.UserIDs[candidate.UserID] = struct{}{}
		}
		if hasEmail {
			existing.Emails[email] = struct{}{}
		}
		return true
	})
	return recipients, exclusions, err
}

func normalizeRecallCampaignRecipientEmailKey(email string) (string, bool) {
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

func recallCampaignActivationFields(draft RecallCampaignDraft, couponID string, activatedAt int64) (map[string]any, error) {
	discountJSON, err := common.Marshal(draft.Discount)
	if err != nil {
		return nil, err
	}
	productJSON, err := common.Marshal(draft.Products)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"stripe_coupon_id": couponID,
		"discount_config":  string(discountJSON),
		"product_scope":    string(productJSON),
		"activated_at":     activatedAt,
	}, nil
}

func recallCampaignGate(ctx context.Context) error {
	if err := validateRecallCampaignContext(ctx); err != nil {
		return err
	}
	if !operation_setting.IsRecallCampaignEnabled() {
		return ErrRecallDisabled
	}
	return nil
}

func validateRecallCampaignContext(ctx context.Context) error {
	if ctx == nil {
		return fmt.Errorf("recall campaign context is nil")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return nil
}

func validateAndNormalizeRecallCampaignDraft(draft RecallCampaignDraft, now time.Time) (RecallCampaignDraft, error) {
	draft.Name = strings.TrimSpace(draft.Name)
	if draft.Name == "" || len(draft.Name) > 128 {
		return RecallCampaignDraft{}, fmt.Errorf("recall campaign name must contain 1 to 128 characters")
	}
	applyRecallEmailSubjectFallbacks(draft.Emails, draft.Name)
	draft.AudienceTemplate = strings.ToLower(strings.TrimSpace(draft.AudienceTemplate))
	draft.Audience.GroupMode = strings.ToLower(strings.TrimSpace(draft.Audience.GroupMode))
	if err := ValidateRecallAudience(draft.AudienceTemplate, draft.Audience); err != nil {
		return RecallCampaignDraft{}, err
	}
	draft.Audience = normalizeRecallAudienceConfig(draft.Audience)

	draft.ExecutionMode = strings.ToLower(strings.TrimSpace(draft.ExecutionMode))
	switch draft.ExecutionMode {
	case "manual":
		draft.Schedule = RecallScheduleConfig{}
	case "scheduled_once":
		if draft.Schedule.ScheduledAt <= now.Unix() {
			return RecallCampaignDraft{}, fmt.Errorf("scheduled recall campaign must run in the future")
		}
		draft.Schedule = RecallScheduleConfig{ScheduledAt: draft.Schedule.ScheduledAt}
	case "recurring":
		if _, err := NextRecallRun(now, draft.Schedule); err != nil {
			return RecallCampaignDraft{}, err
		}
		draft.Schedule.ScheduledAt = 0
		draft.Schedule.Timezone = strings.TrimSpace(draft.Schedule.Timezone)
		draft.Schedule.Frequency = strings.ToLower(strings.TrimSpace(draft.Schedule.Frequency))
		if draft.Schedule.Frequency == "daily" {
			draft.Schedule.Weekday = 0
		}
	default:
		return RecallCampaignDraft{}, fmt.Errorf("unsupported recall execution mode %q", draft.ExecutionMode)
	}

	draft.CouponSource = strings.ToLower(strings.TrimSpace(draft.CouponSource))
	draft.ExistingCouponID = strings.TrimSpace(draft.ExistingCouponID)
	switch draft.CouponSource {
	case "automatic":
		if draft.ExistingCouponID != "" {
			return RecallCampaignDraft{}, fmt.Errorf("automatic recall coupon cannot set an existing coupon ID")
		}
	case "existing":
		if draft.ExistingCouponID == "" {
			return RecallCampaignDraft{}, fmt.Errorf("existing recall coupon ID is required")
		}
	default:
		return RecallCampaignDraft{}, fmt.Errorf("unsupported recall coupon source %q", draft.CouponSource)
	}

	discount, err := normalizeRecallDiscount(draft.Discount)
	if err != nil {
		return RecallCampaignDraft{}, err
	}
	if draft.CouponSource == "automatic" && discount.Type == "fixed" {
		if err := validateRecallAutomaticFixedDiscount(discount); err != nil {
			return RecallCampaignDraft{}, err
		}
	}
	if discount.Type != "percent" && discount.Type != "fixed" {
		return RecallCampaignDraft{}, fmt.Errorf("recall discount type must be percent or fixed")
	}
	if discount.CouponRedeemBy > 0 && discount.CouponRedeemBy <= now.Unix() {
		return RecallCampaignDraft{}, fmt.Errorf("recall coupon redeem-by must be in the future")
	}
	draft.Discount = discount
	draft.Products.TopUpPriceIDs = normalizeRecallStripeIDs(draft.Products.TopUpPriceIDs)
	draft.Products.SubscriptionPriceIDs = normalizeRecallStripeIDs(draft.Products.SubscriptionPriceIDs)
	draft.Products.TopUpDisplaySnapshots = nil
	draft.Products.SubscriptionDisplaySnapshots = nil
	if len(draft.Products.TopUpPriceIDs)+len(draft.Products.SubscriptionPriceIDs) == 0 {
		return RecallCampaignDraft{}, fmt.Errorf("recall campaign requires at least one Stripe Price")
	}
	if draft.PromotionValidSeconds <= 0 {
		return RecallCampaignDraft{}, fmt.Errorf("recall promotion validity must be positive")
	}
	if draft.EnrollmentLimit < 1 || draft.EnrollmentLimit > 100000 {
		return RecallCampaignDraft{}, fmt.Errorf("recall enrollment limit must be between 1 and 100000")
	}
	if draft.WorkerConcurrency < 1 || draft.WorkerConcurrency > 20 {
		return RecallCampaignDraft{}, fmt.Errorf("recall worker concurrency must be between 1 and 20")
	}
	emails, err := normalizeRecallEmailStages(draft.Emails)
	if err != nil {
		return RecallCampaignDraft{}, err
	}
	draft.Emails = emails
	return draft, nil
}

func applyRecallEmailSubjectFallbacks(stages []RecallEmailStage, campaignName string) {
	for stageIndex := range stages {
		for language, template := range stages[stageIndex].Templates {
			if strings.TrimSpace(template.Subject) != "" {
				continue
			}
			template.Subject = campaignName
			stages[stageIndex].Templates[language] = template
		}
	}
}

func normalizeRecallAudienceConfig(cfg RecallAudienceConfig) RecallAudienceConfig {
	cfg.Groups = normalizeRecallStrings(cfg.Groups)
	cfg.PaymentProviders = normalizeRecallStrings(cfg.PaymentProviders)
	cfg.GroupMode = strings.ToLower(strings.TrimSpace(cfg.GroupMode))
	cfg.SpecifiedUserIDs = normalizeRecallUserIDs(cfg.SpecifiedUserIDs)
	cfg.SpecifiedEmails = normalizeRecallEmails(cfg.SpecifiedEmails)
	return cfg
}

func normalizeRecallStrings(values []string) []string {
	normalized := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
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

func canonicalizeRecallEmailDraft(draft RecallCampaignDraft) (RecallCampaignDraft, error) {
	stages := make([]RecallEmailStage, len(draft.Emails))
	for i, stage := range draft.Emails {
		stages[i] = RecallEmailStage{
			StageNo:         stage.StageNo,
			DelaySeconds:    stage.DelaySeconds,
			TemplateVersion: stage.TemplateVersion,
			Templates:       make(map[string]RecallEmailTemplate, 1),
		}
		for language, template := range stage.Templates {
			if strings.ToLower(strings.TrimSpace(language)) != "en" {
				continue
			}
			if _, exists := stages[i].Templates["en"]; exists {
				return RecallCampaignDraft{}, fmt.Errorf("recall email stage %d has duplicate English templates", stage.StageNo)
			}
			stages[i].Templates["en"] = template
		}
	}
	draft.Emails = stages
	return draft, nil
}

func (s *RecallCampaignService) localizeRecallEmailStages(ctx context.Context, incoming []RecallEmailStage, stored []RecallEmailStage) ([]RecallEmailStage, error) {
	if s.emailTranslator == nil {
		return incoming, nil
	}

	storedByStage := make(map[int]RecallEmailStage, len(stored))
	for _, stage := range stored {
		storedByStage[stage.StageNo] = stage
	}
	localized := make([]RecallEmailStage, len(incoming))
	needsTranslation := make([]RecallEmailStage, 0, len(incoming))
	for i, stage := range incoming {
		localized[i] = stage
		if templates, reusable := reusableRecallEmailTemplates(stage, storedByStage[stage.StageNo]); reusable {
			localized[i].Templates = templates
			continue
		}
		needsTranslation = append(needsTranslation, stage)
	}
	if len(needsTranslation) == 0 {
		return localized, nil
	}

	translated, err := s.emailTranslator.Translate(ctx, needsTranslation)
	if err != nil {
		if errors.Is(err, errRecallEmailTranslationNotConfigured) {
			return localized, nil
		}
		return nil, fmt.Errorf("translate recall campaign email templates: %w", err)
	}
	if len(translated) != len(needsTranslation) {
		return nil, fmt.Errorf("recall email translation returned %d stages; expected %d", len(translated), len(needsTranslation))
	}
	expected := make(map[int]struct{}, len(needsTranslation))
	for _, stage := range needsTranslation {
		expected[stage.StageNo] = struct{}{}
	}
	for stageNo := range translated {
		if _, exists := expected[stageNo]; !exists {
			return nil, fmt.Errorf("recall email translation returned unexpected stage %d", stageNo)
		}
	}
	for i := range localized {
		if _, needs := expected[localized[i].StageNo]; !needs {
			continue
		}
		templates, err := canonicalRecallEmailTemplates(localized[i].StageNo, localized[i].Templates["en"], translated[localized[i].StageNo])
		if err != nil {
			return nil, err
		}
		localized[i].Templates = templates
	}
	return localized, nil
}

func reusableRecallEmailTemplates(incoming RecallEmailStage, stored RecallEmailStage) (map[string]RecallEmailTemplate, bool) {
	if stored.StageNo != incoming.StageNo || len(stored.Templates) != len(recallEmailTranslationLanguages)+1 {
		return nil, false
	}
	storedEnglish, exists := stored.Templates["en"]
	if !exists {
		return nil, false
	}
	storedEnglish, err := normalizeRecallEmailTemplate(stored.StageNo, "en", storedEnglish)
	if err != nil || storedEnglish != incoming.Templates["en"] {
		return nil, false
	}
	targets := make(map[string]RecallEmailTemplate, len(recallEmailTranslationLanguages))
	for _, language := range recallEmailTranslationLanguages {
		template, exists := stored.Templates[language]
		if !exists {
			return nil, false
		}
		template, err = normalizeRecallEmailTemplate(stored.StageNo, language, template)
		if err != nil {
			return nil, false
		}
		targets[language] = template
	}
	templates, err := canonicalRecallEmailTemplates(stored.StageNo, storedEnglish, targets)
	return templates, err == nil
}

func canonicalRecallEmailTemplates(stageNo int, english RecallEmailTemplate, targets map[string]RecallEmailTemplate) (map[string]RecallEmailTemplate, error) {
	if len(targets) != len(recallEmailTranslationLanguages) {
		return nil, fmt.Errorf("recall email translation stage %d must contain exactly seven target languages", stageNo)
	}
	english, err := normalizeRecallEmailTemplate(stageNo, "en", english)
	if err != nil {
		return nil, err
	}
	templates := make(map[string]RecallEmailTemplate, len(recallEmailTranslationLanguages)+1)
	templates["en"] = english
	for _, language := range recallEmailTranslationLanguages {
		template, exists := targets[language]
		if !exists {
			return nil, fmt.Errorf("recall email translation stage %d is missing language %s", stageNo, language)
		}
		template, err = normalizeRecallEmailTemplate(stageNo, language, template)
		if err != nil {
			return nil, err
		}
		templates[language] = template
	}
	return templates, nil
}

func normalizeRecallEmailTemplate(stageNo int, language string, template RecallEmailTemplate) (RecallEmailTemplate, error) {
	template.Subject = strings.TrimSpace(template.Subject)
	template.BodyText = strings.TrimSpace(template.BodyText)
	template.BodyHTML = strings.TrimSpace(template.BodyHTML)
	if template.Subject == "" {
		return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q requires subject", stageNo, language)
	}
	if strings.ContainsAny(template.Subject, "\r\n") {
		return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q subject must be single line", stageNo, language)
	}
	if utf8.RuneCountInString(template.Subject) > recallEmailSubjectMaxRunes {
		return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q subject must contain at most %d characters", stageNo, language, recallEmailSubjectMaxRunes)
	}
	hasText := template.BodyText != ""
	hasHTML := template.BodyHTML != ""
	if hasText == hasHTML {
		return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q requires exactly one of body_text or body_html", stageNo, language)
	}
	if hasHTML {
		if _, err := parseRecallEmailHTML(template.BodyHTML); err != nil {
			return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q body_html: %w", stageNo, language, err)
		}
		return template, nil
	}
	if utf8.RuneCountInString(template.BodyText) > recallEmailBodyMaxRunes {
		return RecallEmailTemplate{}, fmt.Errorf("recall email stage %d language %q body must contain at most %d characters", stageNo, language, recallEmailBodyMaxRunes)
	}
	return template, nil
}

func normalizeRecallEmailStages(stages []RecallEmailStage) ([]RecallEmailStage, error) {
	if len(stages) < 1 || len(stages) > 3 {
		return nil, fmt.Errorf("recall campaign requires one to three email stages")
	}
	normalized := make([]RecallEmailStage, len(stages))
	previousDelay := int64(-1)
	for i, stage := range stages {
		if stage.StageNo != i+1 {
			return nil, fmt.Errorf("recall email stages must be unique and ordered from one")
		}
		if stage.DelaySeconds < 0 || (i == 0 && stage.DelaySeconds != 0) || (i > 0 && stage.DelaySeconds <= previousDelay) {
			return nil, fmt.Errorf("recall email stage delays must start at zero and increase")
		}
		if len(stage.Templates) == 0 {
			return nil, fmt.Errorf("recall email stage %d requires templates", stage.StageNo)
		}
		templates := make(map[string]RecallEmailTemplate, len(stage.Templates))
		for language, template := range stage.Templates {
			language = strings.ToLower(strings.TrimSpace(language))
			if language == "" {
				return nil, fmt.Errorf("recall email stage %d has an empty language", stage.StageNo)
			}
			if _, exists := templates[language]; exists {
				return nil, fmt.Errorf("recall email stage %d has duplicate language %q", stage.StageNo, language)
			}
			template, err := normalizeRecallEmailTemplate(stage.StageNo, language, template)
			if err != nil {
				return nil, err
			}
			templates[language] = template
		}
		if _, exists := templates["en"]; !exists {
			return nil, fmt.Errorf("recall email stage %d requires an English template", stage.StageNo)
		}
		normalized[i] = RecallEmailStage{
			StageNo:         stage.StageNo,
			DelaySeconds:    stage.DelaySeconds,
			TemplateVersion: 1,
			Templates:       templates,
		}
		previousDelay = stage.DelaySeconds
	}
	return normalized, nil
}

func recallCampaignModelFromDraft(draft RecallCampaignDraft, actorID int) (*model.RecallCampaign, error) {
	audienceJSON, err := common.Marshal(draft.Audience)
	if err != nil {
		return nil, err
	}
	discountJSON, err := common.Marshal(draft.Discount)
	if err != nil {
		return nil, err
	}
	productJSON, err := common.Marshal(draft.Products)
	if err != nil {
		return nil, err
	}
	emailJSON, err := common.Marshal(draft.Emails)
	if err != nil {
		return nil, err
	}
	recurrenceJSON := ""
	if draft.ExecutionMode == "recurring" {
		encoded, marshalErr := common.Marshal(draft.Schedule)
		if marshalErr != nil {
			return nil, marshalErr
		}
		recurrenceJSON = string(encoded)
	}
	return &model.RecallCampaign{
		Name:                  draft.Name,
		Status:                model.RecallCampaignDraft,
		AudienceTemplate:      draft.AudienceTemplate,
		AudienceConfig:        string(audienceJSON),
		ExecutionMode:         draft.ExecutionMode,
		ScheduledAt:           draft.Schedule.ScheduledAt,
		RecurrenceConfig:      recurrenceJSON,
		CouponSource:          draft.CouponSource,
		StripeCouponId:        draft.ExistingCouponID,
		DiscountConfig:        string(discountJSON),
		ProductScope:          string(productJSON),
		PromotionValidSeconds: draft.PromotionValidSeconds,
		EmailSequenceConfig:   string(emailJSON),
		EnrollmentLimit:       draft.EnrollmentLimit,
		WorkerConcurrency:     draft.WorkerConcurrency,
		CreatedBy:             actorID,
	}, nil
}

func recallCampaignDraftFromModel(campaign *model.RecallCampaign) (RecallCampaignDraft, error) {
	if campaign == nil {
		return RecallCampaignDraft{}, fmt.Errorf("recall campaign is nil")
	}
	draft := RecallCampaignDraft{
		Name:                  campaign.Name,
		AudienceTemplate:      campaign.AudienceTemplate,
		ExecutionMode:         campaign.ExecutionMode,
		CouponSource:          campaign.CouponSource,
		PromotionValidSeconds: campaign.PromotionValidSeconds,
		EnrollmentLimit:       campaign.EnrollmentLimit,
		WorkerConcurrency:     campaign.WorkerConcurrency,
	}
	if campaign.CouponSource == "existing" {
		draft.ExistingCouponID = campaign.StripeCouponId
	}
	if err := common.Unmarshal([]byte(campaign.AudienceConfig), &draft.Audience); err != nil {
		return RecallCampaignDraft{}, fmt.Errorf("decode recall audience config: %w", err)
	}
	if err := common.Unmarshal([]byte(campaign.DiscountConfig), &draft.Discount); err != nil {
		return RecallCampaignDraft{}, fmt.Errorf("decode recall discount config: %w", err)
	}
	if err := common.Unmarshal([]byte(campaign.ProductScope), &draft.Products); err != nil {
		return RecallCampaignDraft{}, fmt.Errorf("decode recall product scope: %w", err)
	}
	if err := common.Unmarshal([]byte(campaign.EmailSequenceConfig), &draft.Emails); err != nil {
		return RecallCampaignDraft{}, fmt.Errorf("decode recall email sequence: %w", err)
	}
	switch campaign.ExecutionMode {
	case "scheduled_once":
		draft.Schedule.ScheduledAt = campaign.ScheduledAt
	case "recurring":
		if err := common.Unmarshal([]byte(campaign.RecurrenceConfig), &draft.Schedule); err != nil {
			return RecallCampaignDraft{}, fmt.Errorf("decode recall recurrence config: %w", err)
		}
	}
	return draft, nil
}

type recallImmutableCampaignDraft struct {
	AudienceTemplate      string
	Audience              RecallAudienceConfig
	ExecutionMode         string
	Schedule              RecallScheduleConfig
	CouponSource          string
	ExistingCouponID      string
	Discount              RecallDiscountConfig
	Products              RecallProductScope
	PromotionValidSeconds int64
	EnrollmentLimit       int
	WorkerConcurrency     int
	EmailStages           []recallImmutableEmailStage
}

type recallImmutableEmailStage struct {
	StageNo      int
	DelaySeconds int64
}

func recallCampaignImmutableDraft(draft RecallCampaignDraft) recallImmutableCampaignDraft {
	draft.AudienceTemplate = strings.ToLower(strings.TrimSpace(draft.AudienceTemplate))
	draft.Audience = normalizeRecallAudienceConfig(draft.Audience)
	draft.ExecutionMode = strings.ToLower(strings.TrimSpace(draft.ExecutionMode))
	switch draft.ExecutionMode {
	case "manual":
		draft.Schedule = RecallScheduleConfig{}
	case "scheduled_once":
		draft.Schedule = RecallScheduleConfig{ScheduledAt: draft.Schedule.ScheduledAt}
	case "recurring":
		draft.Schedule.ScheduledAt = 0
		draft.Schedule.Timezone = strings.TrimSpace(draft.Schedule.Timezone)
		draft.Schedule.Frequency = strings.ToLower(strings.TrimSpace(draft.Schedule.Frequency))
		if draft.Schedule.Frequency == "daily" {
			draft.Schedule.Weekday = 0
		}
	}
	draft.CouponSource = strings.ToLower(strings.TrimSpace(draft.CouponSource))
	draft.ExistingCouponID = strings.TrimSpace(draft.ExistingCouponID)
	draft.Discount.Type = strings.ToLower(strings.TrimSpace(draft.Discount.Type))
	draft.Discount.Currency = strings.ToLower(strings.TrimSpace(draft.Discount.Currency))
	draft.Discount.MinimumAmountCurrency = strings.ToLower(strings.TrimSpace(draft.Discount.MinimumAmountCurrency))
	if draft.Discount.CurrencyOptions == nil {
		draft.Discount.CurrencyOptions = map[string]int64{}
	}
	draft.Products = RecallProductScope{
		TopUpPriceIDs:        normalizeRecallStripeIDs(draft.Products.TopUpPriceIDs),
		SubscriptionPriceIDs: normalizeRecallStripeIDs(draft.Products.SubscriptionPriceIDs),
	}
	emailStages := make([]recallImmutableEmailStage, len(draft.Emails))
	for i, stage := range draft.Emails {
		emailStages[i] = recallImmutableEmailStage{StageNo: stage.StageNo, DelaySeconds: stage.DelaySeconds}
	}
	return recallImmutableCampaignDraft{
		AudienceTemplate:      draft.AudienceTemplate,
		Audience:              draft.Audience,
		ExecutionMode:         draft.ExecutionMode,
		Schedule:              draft.Schedule,
		CouponSource:          draft.CouponSource,
		ExistingCouponID:      draft.ExistingCouponID,
		Discount:              draft.Discount,
		Products:              draft.Products,
		PromotionValidSeconds: draft.PromotionValidSeconds,
		EnrollmentLimit:       draft.EnrollmentLimit,
		WorkerConcurrency:     draft.WorkerConcurrency,
		EmailStages:           emailStages,
	}
}

func incrementRecallEmailTemplateVersions(current []RecallEmailStage, next []RecallEmailStage) ([]RecallEmailStage, error) {
	if len(current) != len(next) {
		return nil, fmt.Errorf("activated recall email stages cannot be added or removed")
	}
	updated := make([]RecallEmailStage, len(next))
	for i := range next {
		if current[i].StageNo != next[i].StageNo || current[i].DelaySeconds != next[i].DelaySeconds {
			return nil, fmt.Errorf("activated recall email stage numbers and delays are immutable")
		}
		updated[i] = next[i]
		updated[i].TemplateVersion = current[i].TemplateVersion
		if !reflect.DeepEqual(current[i].Templates, next[i].Templates) {
			updated[i].TemplateVersion++
		}
	}
	return updated, nil
}

func NextRecallRun(after time.Time, cfg RecallScheduleConfig) (time.Time, error) {
	timezone := strings.TrimSpace(cfg.Timezone)
	if timezone == "" || timezone == "Local" {
		return time.Time{}, fmt.Errorf("recall recurrence requires an IANA timezone")
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid recall recurrence timezone %q: %w", timezone, err)
	}
	frequency := strings.ToLower(strings.TrimSpace(cfg.Frequency))
	if cfg.Hour < 0 || cfg.Hour > 23 || cfg.Minute < 0 || cfg.Minute > 59 {
		return time.Time{}, fmt.Errorf("recall recurrence hour or minute is invalid")
	}
	localAfter := after.In(location)
	wallClockOnDay := func(day time.Time) (time.Time, bool) {
		candidate := time.Date(day.Year(), day.Month(), day.Day(), cfg.Hour, cfg.Minute, 0, 0, location)
		localCandidate := candidate.In(location)
		valid := localCandidate.Year() == day.Year() &&
			localCandidate.Month() == day.Month() &&
			localCandidate.Day() == day.Day() &&
			localCandidate.Hour() == cfg.Hour &&
			localCandidate.Minute() == cfg.Minute
		return candidate, valid
	}
	var candidate time.Time
	switch frequency {
	case "daily":
		for days := 0; days <= 366; days++ {
			day := localAfter.AddDate(0, 0, days)
			possible, valid := wallClockOnDay(day)
			if valid && possible.After(localAfter) {
				candidate = possible
				break
			}
		}
		if candidate.IsZero() {
			return time.Time{}, fmt.Errorf("could not find the next daily recall wall clock")
		}
	case "weekly":
		if cfg.Weekday < int(time.Sunday) || cfg.Weekday > int(time.Saturday) {
			return time.Time{}, fmt.Errorf("recall weekly recurrence weekday must be between 0 and 6")
		}
		days := (cfg.Weekday - int(localAfter.Weekday()) + 7) % 7
		for weeks := 0; weeks <= 53; weeks++ {
			day := localAfter.AddDate(0, 0, days+weeks*7)
			possible, valid := wallClockOnDay(day)
			if valid && possible.After(localAfter) {
				candidate = possible
				break
			}
		}
		if candidate.IsZero() {
			return time.Time{}, fmt.Errorf("could not find the next weekly recall wall clock")
		}
	default:
		return time.Time{}, fmt.Errorf("recall recurrence frequency must be daily or weekly")
	}
	return candidate.UTC(), nil
}
