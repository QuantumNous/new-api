package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html"
	htmltemplate "html/template"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	recallEmailLeaseSeconds           = int64(60)
	recallEmailMaxAttempts            = 5
	recallEmailProductSummaryCacheTTL = 5 * time.Minute
)

var (
	ErrRecallEmailLeaseLost                 = errors.New("recall email message lease was lost")
	errRecallEmailProductScopeInvalid       = errors.New("recall email product scope is invalid")
	errRecallEmailProductSummaryUnavailable = errors.New("recall email product summary is unavailable")
)

type RecallEmailSender func(subject, receiver, content, messageID string) error

type RecallEmailWorker struct {
	sender              RecallEmailSender
	audience            *RecallAudienceSelector
	claims              *RecallClaimService
	now                 func() time.Time
	owner               string
	productSummaryMu    sync.Mutex
	productSummaryCache map[string]recallEmailProductSummaryCacheEntry
}

type recallEmailProductSummaryCacheEntry struct {
	summary   string
	expiresAt time.Time
}

type RecallEmailRenderInput struct {
	Language            string
	Template            RecallEmailTemplate
	RecipientName       string
	PromotionCodeMasked string
	ExpiresAt           int64
	ProductSummary      string
	ClaimURL            string
	UnsubscribeURL      string
}

type recallEmailHTMLRenderData struct {
	RecipientName       string
	PromotionCodeMasked string
	ProductSummary      string
	ExpiresAt           string
	ClaimURL            string
	UnsubscribeURL      string
}

type recallEmailCopy struct {
	GreetingPrefix         string
	GreetingSuffix         string
	ValueSeparator         string
	OfferCodeLabel         string
	ValidForLabel          string
	ExpiresLabel           string
	ClaimLabel             string
	UnsubscribeLabel       string
	TopUpsAndSubscriptions string
	TopUps                 string
	Subscriptions          string
	EligibleProducts       string
}

var recallEmailCopyByLanguage = map[string]recallEmailCopy{
	"en": {
		GreetingPrefix: "Hello ", GreetingSuffix: ",", ValueSeparator: " ", OfferCodeLabel: "Offer code:", ValidForLabel: "Valid for:",
		ExpiresLabel: "Expires:", ClaimLabel: "Claim your offer", UnsubscribeLabel: "Unsubscribe",
		TopUpsAndSubscriptions: "Top-ups and subscriptions", TopUps: "Top-ups", Subscriptions: "Subscriptions", EligibleProducts: "Eligible products",
	},
	"zh": {
		GreetingPrefix: "您好，", GreetingSuffix: "！", OfferCodeLabel: "优惠码：", ValidForLabel: "适用于：",
		ExpiresLabel: "有效期至：", ClaimLabel: "领取优惠", UnsubscribeLabel: "取消订阅",
		TopUpsAndSubscriptions: "充值和订阅", TopUps: "充值", Subscriptions: "订阅", EligibleProducts: "符合条件的产品",
	},
	"es": {
		GreetingPrefix: "Hola ", GreetingSuffix: ",", ValueSeparator: " ", OfferCodeLabel: "Código de oferta:", ValidForLabel: "Válido para:",
		ExpiresLabel: "Caduca:", ClaimLabel: "Canjear tu oferta", UnsubscribeLabel: "Cancelar suscripción",
		TopUpsAndSubscriptions: "Recargas y suscripciones", TopUps: "Recargas", Subscriptions: "Suscripciones", EligibleProducts: "Productos elegibles",
	},
	"fr": {
		GreetingPrefix: "Bonjour ", GreetingSuffix: ",", ValueSeparator: " ", OfferCodeLabel: "Code promotionnel :", ValidForLabel: "Valable pour :",
		ExpiresLabel: "Expire le :", ClaimLabel: "Profiter de votre offre", UnsubscribeLabel: "Se désabonner",
		TopUpsAndSubscriptions: "Recharges et abonnements", TopUps: "Recharges", Subscriptions: "Abonnements", EligibleProducts: "Produits éligibles",
	},
	"pt": {
		GreetingPrefix: "Olá ", GreetingSuffix: ",", ValueSeparator: " ", OfferCodeLabel: "Código da oferta:", ValidForLabel: "Válido para:",
		ExpiresLabel: "Expira em:", ClaimLabel: "Resgatar sua oferta", UnsubscribeLabel: "Cancelar inscrição",
		TopUpsAndSubscriptions: "Recargas e assinaturas", TopUps: "Recargas", Subscriptions: "Assinaturas", EligibleProducts: "Produtos elegíveis",
	},
	"ru": {
		GreetingPrefix: "Здравствуйте, ", GreetingSuffix: "!", ValueSeparator: " ", OfferCodeLabel: "Код предложения:", ValidForLabel: "Действует для:",
		ExpiresLabel: "Истекает:", ClaimLabel: "Получить предложение", UnsubscribeLabel: "Отписаться",
		TopUpsAndSubscriptions: "Пополнения и подписки", TopUps: "Пополнения", Subscriptions: "Подписки", EligibleProducts: "Подходящие продукты",
	},
	"ja": {
		GreetingPrefix: "", GreetingSuffix: " さん、こんにちは。", OfferCodeLabel: "オファーコード：", ValidForLabel: "対象商品：",
		ExpiresLabel: "有効期限：", ClaimLabel: "オファーを利用する", UnsubscribeLabel: "配信停止",
		TopUpsAndSubscriptions: "チャージとサブスクリプション", TopUps: "チャージ", Subscriptions: "サブスクリプション", EligibleProducts: "対象商品",
	},
	"vi": {
		GreetingPrefix: "Xin chào ", GreetingSuffix: ",", ValueSeparator: " ", OfferCodeLabel: "Mã ưu đãi:", ValidForLabel: "Áp dụng cho:",
		ExpiresLabel: "Hết hạn:", ClaimLabel: "Nhận ưu đãi", UnsubscribeLabel: "Hủy đăng ký",
		TopUpsAndSubscriptions: "Nạp tiền và gói đăng ký", TopUps: "Nạp tiền", Subscriptions: "Gói đăng ký", EligibleProducts: "Sản phẩm đủ điều kiện",
	},
}

func NewRecallEmailWorker(sender RecallEmailSender, audience *RecallAudienceSelector, claims *RecallClaimService, owner string) *RecallEmailWorker {
	if sender == nil {
		sender = common.SendEmailWithMessageID
	}
	if audience == nil {
		audience = NewRecallAudienceSelector()
	}
	if claims == nil {
		claims = NewRecallClaimService()
	}
	return &RecallEmailWorker{
		sender:              sender,
		audience:            audience,
		claims:              claims,
		now:                 time.Now,
		owner:               strings.TrimSpace(owner),
		productSummaryCache: make(map[string]recallEmailProductSummaryCacheEntry),
	}
}

func (w *RecallEmailWorker) RunBatch(ctx context.Context, limit int) (int, error) {
	if w == nil || limit <= 0 {
		return 0, nil
	}
	if w.owner == "" {
		return 0, fmt.Errorf("recall email worker owner is required")
	}
	now := w.now().Unix()
	messageIDs, err := model.ListDueRecallMessageIDs(now, limit)
	if err != nil {
		return 0, err
	}
	type leasedEmail struct {
		item *model.RecallEmailWorkItem
	}
	leased := make([]leasedEmail, 0, len(messageIDs))
	activityChecks := make([]model.RecallAPIActivityCheck, 0, len(messageIDs))
	processed := 0
	var firstErr error
	for _, messageID := range messageIDs {
		if err := ctx.Err(); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			break
		}
		won, leaseErr := model.LeaseRecallMessage(messageID, w.owner, now, now+recallEmailLeaseSeconds)
		if leaseErr != nil {
			if firstErr == nil {
				firstErr = leaseErr
			}
			continue
		}
		if !won {
			continue
		}
		processed++
		item, loadErr := model.GetRecallEmailWorkItemForLeaseWithContext(ctx, messageID, w.owner)
		if loadErr != nil {
			if firstErr == nil {
				firstErr = loadErr
			}
			continue
		}
		leased = append(leased, leasedEmail{item: item})
		if item.Recipient.UserId > 0 {
			activityChecks = append(activityChecks, model.RecallAPIActivityCheck{
				MessageId: item.Message.Id,
				UserId:    item.Recipient.UserId,
				After:     item.Recipient.CreatedAt,
			})
		}
	}

	activeMessageIDs, activityErr := model.FindRecallMessageIDsWithAPIActivityAfterWithContext(ctx, activityChecks, w.audience.LogBatchSize)
	if activityErr != nil {
		if firstErr == nil {
			firstErr = activityErr
		}
		return processed, firstErr
	}
	for _, leasedMessage := range leased {
		_, recentlyActive := activeMessageIDs[leasedMessage.item.Message.Id]
		if processErr := w.processLeasedItem(ctx, leasedMessage.item, recentlyActive); processErr != nil && !errors.Is(processErr, ErrRecallEmailLeaseLost) && firstErr == nil {
			firstErr = processErr
		}
	}
	return processed, firstErr
}

func (w *RecallEmailWorker) ProcessLeased(ctx context.Context, messageID int64) error {
	if w == nil || w.owner == "" {
		return fmt.Errorf("recall email worker owner is required")
	}
	item, err := model.GetRecallEmailWorkItemForLeaseWithContext(ctx, messageID, w.owner)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRecallEmailLeaseLost
		}
		return err
	}
	activeMessageIDs := make(map[int64]struct{})
	if item.Recipient.UserId > 0 {
		activeMessageIDs, err = model.FindRecallMessageIDsWithAPIActivityAfterWithContext(ctx, []model.RecallAPIActivityCheck{{
			MessageId: item.Message.Id,
			UserId:    item.Recipient.UserId,
			After:     item.Recipient.CreatedAt,
		}}, w.audience.LogBatchSize)
		if err != nil {
			return err
		}
	}
	_, recentlyActive := activeMessageIDs[item.Message.Id]
	return w.processLeasedItem(ctx, item, recentlyActive)
}

func (w *RecallEmailWorker) processLeasedItem(ctx context.Context, item *model.RecallEmailWorkItem, recentlyActive bool) error {
	expectedLeaseUntil := item.Message.LeaseExpiresAt
	now := w.now().Unix()
	if expectedLeaseUntil <= now {
		return ErrRecallEmailLeaseLost
	}
	stopReason, err := w.recallEmailStopReason(ctx, item, recentlyActive, now)
	if err != nil {
		return err
	}
	if stopReason != "" {
		cancelled, err := model.CancelRecallEmailFlowWithContext(
			ctx,
			item.Message.Id,
			item.Recipient.Id,
			w.owner,
			expectedLeaseUntil,
			stopReason,
			now,
		)
		if err != nil {
			return err
		}
		if !cancelled {
			return ErrRecallEmailLeaseLost
		}
		return nil
	}

	providerMessageID := strings.TrimSpace(item.Message.ProviderMessageId)
	if providerMessageID == "" {
		providerMessageID, err = recallEmailMessageID(item.Recipient.Id, item.Message.StageNo)
		if err != nil {
			return w.finishPreAcceptError(ctx, item, "message_id_invalid", false)
		}
		var won bool
		providerMessageID, won, err = model.EnsureRecallMessageProviderIDWithContext(
			ctx,
			item.Message.Id,
			w.owner,
			expectedLeaseUntil,
			providerMessageID,
		)
		if err != nil {
			return err
		}
		if !won {
			return ErrRecallEmailLeaseLost
		}
	}
	if err := common.ValidateEmailMessageID(providerMessageID); err != nil {
		return w.finishPreAcceptError(ctx, item, "message_id_invalid", false)
	}
	next, err := nextRecallEmailMessage(item, now)
	if err != nil {
		return w.finishPreAcceptError(ctx, item, "next_stage_invalid", false)
	}

	rawClaim, err := w.claims.IssueClaim(ctx, item.Message.Id, w.owner, expectedLeaseUntil)
	if err != nil {
		if errors.Is(err, ErrRecallClaimLeaseLost) {
			return ErrRecallEmailLeaseLost
		}
		return w.finishPreAcceptError(ctx, item, "claim_issue_failed", true)
	}
	unsubscribeToken, err := w.createUnsubscribeToken(item)
	if err != nil {
		return w.finishPreAcceptError(ctx, item, "unsubscribe_token_failed", true)
	}
	template, resolvedLanguage, err := recallEmailTemplateForLanguage(item.Message.TemplateSnapshot, item.Recipient.LanguageSnapshot)
	if err != nil {
		return w.finishPreAcceptError(ctx, item, "template_invalid", false)
	}
	baseOrigin := strings.TrimRight(strings.TrimSpace(topUpBaseOrigin()), "/")
	claimURL := baseOrigin + "/console/topup?recall_claim=" + url.QueryEscape(rawClaim)
	unsubscribeURL := baseOrigin + "/api/recall/unsubscribe?token=" + url.QueryEscape(unsubscribeToken)
	productSummary, err := w.recallEmailProductSummary(ctx, item.Campaign.ProductScope, resolvedLanguage)
	if err != nil {
		if errors.Is(err, errRecallEmailProductScopeInvalid) {
			return w.finishPreAcceptError(ctx, item, "product_scope_invalid", false)
		}
		if errors.Is(err, errRecallEmailProductSummaryUnavailable) {
			return w.finishPreAcceptError(ctx, item, "product_summary_unavailable", false)
		}
		return w.finishPreAcceptError(ctx, item, "product_summary_lookup_failed", true)
	}
	recipientName := strings.TrimSpace(item.User.DisplayName)
	if recipientName == "" {
		recipientName = strings.TrimSpace(item.User.Username)
	}
	subject, htmlBody, err := RenderRecallEmail(RecallEmailRenderInput{
		Language:            resolvedLanguage,
		Template:            template,
		RecipientName:       recipientName,
		PromotionCodeMasked: model.MaskPromotionCode(item.Recipient.PromotionCode),
		ExpiresAt:           item.Recipient.PromotionExpiresAt,
		ProductSummary:      productSummary,
		ClaimURL:            claimURL,
		UnsubscribeURL:      unsubscribeURL,
	})
	if err != nil {
		return w.finishPreAcceptError(ctx, item, "render_invalid", false)
	}
	item, err = model.GetRecallEmailWorkItemForLeaseEpochWithContext(ctx, item.Message.Id, w.owner, expectedLeaseUntil)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRecallEmailLeaseLost
		}
		return err
	}
	activeMessageIDs := make(map[int64]struct{})
	if item.Recipient.UserId > 0 {
		activeMessageIDs, err = model.FindRecallMessageIDsWithAPIActivityAfterWithContext(ctx, []model.RecallAPIActivityCheck{{
			MessageId: item.Message.Id,
			UserId:    item.Recipient.UserId,
			After:     item.Recipient.CreatedAt,
		}}, w.audience.LogBatchSize)
		if err != nil {
			return err
		}
	}
	_, recentlyActive = activeMessageIDs[item.Message.Id]
	fenceNow := w.now().Unix()
	stopReason, err = w.recallEmailStopReason(ctx, item, recentlyActive, fenceNow)
	if err != nil {
		return err
	}
	if stopReason != "" {
		cancelled, err := model.CancelRecallEmailFlowWithContext(
			ctx,
			item.Message.Id,
			item.Recipient.Id,
			w.owner,
			expectedLeaseUntil,
			stopReason,
			fenceNow,
		)
		if err != nil {
			return err
		}
		if !cancelled {
			return ErrRecallEmailLeaseLost
		}
		return nil
	}
	if expectedLeaseUntil <= w.now().Unix() {
		return ErrRecallEmailLeaseLost
	}
	sending, err := model.MarkRecallMessageSendingWithContext(ctx, item.Message.Id, w.owner, expectedLeaseUntil)
	if err != nil {
		return err
	}
	if !sending {
		return ErrRecallEmailLeaseLost
	}

	if err := w.sender(subject, item.Recipient.EmailSnapshot, htmlBody, providerMessageID); err != nil {
		if common.IsEmailSendUncertain(err) {
			won, updateErr := model.CompleteRecallMessageLease(
				item.Message.Id,
				w.owner,
				expectedLeaseUntil,
				model.RecallMessageSending,
				model.RecallMessageUncertain,
				map[string]any{
					"attempt_count":       item.Message.AttemptCount + 1,
					"next_attempt_at":     int64(0),
					"provider_message_id": providerMessageID,
					"last_error_code":     "smtp_uncertain",
					"last_error_message":  "",
				},
			)
			if updateErr != nil {
				return updateErr
			}
			if !won {
				return ErrRecallEmailLeaseLost
			}
			return nil
		}
		return w.finishSendingError(ctx, item, "smtp_definite", true)
	}
	acceptedAt := w.now().Unix()
	if next != nil && item.Recipient.FirstSentAt == 0 {
		next.ScheduledAt += acceptedAt - now
	}

	accepted, err := model.AcceptRecallMessageAndScheduleNextWithContext(
		ctx,
		item.Message.Id,
		w.owner,
		expectedLeaseUntil,
		acceptedAt,
		next,
	)
	if err != nil {
		return err
	}
	if !accepted {
		return ErrRecallEmailLeaseLost
	}
	return nil
}

func (w *RecallEmailWorker) createUnsubscribeToken(item *model.RecallEmailWorkItem) (string, error) {
	expiresAt := time.Unix(item.Recipient.PromotionExpiresAt, 0)
	return w.claims.CreateRecipientUnsubscribeToken(item.Recipient.Id, expiresAt)
}

func (w *RecallEmailWorker) recallEmailStopReason(ctx context.Context, item *model.RecallEmailWorkItem, recentlyActive bool, now int64) (string, error) {
	switch item.Campaign.Status {
	case model.RecallCampaignScheduled, model.RecallCampaignRunning, model.RecallCampaignCompleted:
	case model.RecallCampaignPaused:
		return "campaign_paused", nil
	case model.RecallCampaignCancelled:
		return "campaign_cancelled", nil
	default:
		return "campaign_inactive", nil
	}
	if !operation_setting.IsRecallCampaignEnabled() {
		return "campaign_disabled", nil
	}
	if item.Recipient.State == model.RecallRecipientConverted || item.Recipient.ConvertedAt > 0 {
		return "recipient_converted", nil
	}
	if item.Recipient.State == model.RecallRecipientSuppressed {
		return "recipient_suppressed", nil
	}
	if item.Recipient.PromotionExpiresAt <= now {
		return "promotion_expired", nil
	}
	if item.Recipient.StripePromotionCodeId == nil || strings.TrimSpace(*item.Recipient.StripePromotionCodeId) == "" || strings.TrimSpace(item.Recipient.PromotionCode) == "" {
		return "promotion_unavailable", nil
	}
	snapshotEmail, snapshotOK := recallAudienceEmail(item.Recipient.EmailSnapshot)
	if !snapshotOK || snapshotEmail == "" {
		return "email_unavailable", nil
	}
	if item.Recipient.UserId == 0 {
		return "", nil
	}
	if item.User.Status != common.UserStatusEnabled {
		return "user_disabled", nil
	}
	currentEmail, currentOK := recallAudienceEmail(item.User.Email)
	if !currentOK || !strings.EqualFold(snapshotEmail, currentEmail) {
		return "email_unavailable", nil
	}
	if item.User.GetSetting().RecallMarketingOptOut {
		return "user_opted_out", nil
	}
	paid, err := model.HasRecallPaymentAfterWithContext(ctx, item.Recipient.UserId, item.Recipient.CreatedAt)
	if err != nil {
		return "", err
	}
	if paid {
		return "payment_after_enrollment", nil
	}
	if recentlyActive {
		return "api_activity_after_enrollment", nil
	}
	return "", nil
}

func (w *RecallEmailWorker) finishPreAcceptError(ctx context.Context, item *model.RecallEmailWorkItem, errorCode string, retryable bool) error {
	return w.finishError(ctx, item, model.RecallMessageLeased, errorCode, retryable)
}

func (w *RecallEmailWorker) finishSendingError(ctx context.Context, item *model.RecallEmailWorkItem, errorCode string, retryable bool) error {
	return w.finishError(ctx, item, model.RecallMessageSending, errorCode, retryable)
}

func (w *RecallEmailWorker) finishError(ctx context.Context, item *model.RecallEmailWorkItem, from string, errorCode string, retryable bool) error {
	attemptCount := item.Message.AttemptCount + 1
	state := model.RecallMessageFailed
	fields := map[string]any{
		"attempt_count":      attemptCount,
		"next_attempt_at":    int64(0),
		"failed_at":          w.now().Unix(),
		"last_error_code":    errorCode,
		"last_error_message": "",
	}
	if retryable && attemptCount < recallEmailMaxAttempts {
		state = model.RecallMessageRetryWait
		fields["next_attempt_at"] = w.now().Add(recallEmailRetryDelay(attemptCount)).Unix()
		fields["failed_at"] = int64(0)
	}
	won, err := model.CompleteRecallMessageLease(
		item.Message.Id,
		w.owner,
		item.Message.LeaseExpiresAt,
		from,
		state,
		fields,
	)
	if err != nil {
		return err
	}
	if !won {
		return ErrRecallEmailLeaseLost
	}
	return nil
}

func recallEmailRetryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	delay := 30 * time.Second
	for step := 1; step < attempt && delay < time.Hour; step++ {
		delay *= 2
		if delay > time.Hour {
			delay = time.Hour
		}
	}
	return delay
}

func recallEmailMessageID(recipientID int64, stageNo int) (string, error) {
	if recipientID <= 0 || stageNo < 1 || stageNo > 3 {
		return "", fmt.Errorf("invalid recall email Message-ID inputs")
	}
	domain, err := common.EmailMessageIDDomain()
	if err != nil {
		return "", err
	}
	messageID := fmt.Sprintf("<recall-%d-%d@%s>", recipientID, stageNo, domain)
	if err := common.ValidateEmailMessageID(messageID); err != nil {
		return "", err
	}
	return messageID, nil
}

func recallEmailTemplateForLanguage(snapshot string, language string) (template RecallEmailTemplate, resolvedLanguage string, err error) {
	templates := make(map[string]RecallEmailTemplate)
	if err := common.Unmarshal([]byte(snapshot), &templates); err != nil {
		return RecallEmailTemplate{}, "", err
	}
	language = strings.TrimSpace(language)
	if _, supported := recallEmailCopyByLanguage[language]; supported {
		if template, ok := templates[language]; ok {
			return template, language, nil
		}
	}
	if template, ok := templates["en"]; ok {
		return template, "en", nil
	}
	return RecallEmailTemplate{}, "", fmt.Errorf("recall email template has no exact supported language or English fallback")
}

func nextRecallEmailMessage(item *model.RecallEmailWorkItem, acceptedAt int64) (*model.RecallMessage, error) {
	stages := make([]RecallEmailStage, 0)
	if err := common.Unmarshal([]byte(item.Campaign.EmailSequenceConfig), &stages); err != nil {
		return nil, err
	}
	if len(stages) < 1 || len(stages) > 3 {
		return nil, fmt.Errorf("recall email sequence must contain one to three stages")
	}
	var nextStage *RecallEmailStage
	for index := range stages {
		if stages[index].StageNo == item.Message.StageNo+1 {
			nextStage = &stages[index]
			break
		}
	}
	if nextStage == nil {
		return nil, nil
	}
	templateSnapshot, err := common.Marshal(nextStage.Templates)
	if err != nil {
		return nil, err
	}
	firstAcceptedAt := item.Recipient.FirstSentAt
	if firstAcceptedAt == 0 {
		firstAcceptedAt = acceptedAt
	}
	return &model.RecallMessage{
		StageNo:          nextStage.StageNo,
		TemplateVersion:  nextStage.TemplateVersion,
		TemplateSnapshot: string(templateSnapshot),
		ScheduledAt:      firstAcceptedAt + nextStage.DelaySeconds,
		State:            model.RecallMessageScheduled,
	}, nil
}

func recallEmailProductSummary(productScopeJSON string, language string) (string, error) {
	return recallEmailProductSummaryWithContext(context.Background(), productScopeJSON, language)
}

func recallEmailProductSummaryWithContext(ctx context.Context, productScopeJSON string, language string) (string, error) {
	products := RecallProductScope{}
	if err := common.Unmarshal([]byte(productScopeJSON), &products); err != nil {
		return "", fmt.Errorf("%w: %v", errRecallEmailProductScopeInvalid, err)
	}
	copy := recallEmailCopyForLanguage(language)
	if len(products.TopUpPriceIDs)+len(products.SubscriptionPriceIDs) == 0 {
		return copy.EligibleProducts, nil
	}
	if !recallProductDisplaySnapshotsComplete(products) {
		resolved, err := resolveRecallProductDisplaySnapshots(ctx, products)
		if err != nil {
			return "", err
		}
		products = resolved
	}

	parts := make([]string, 0, 2)
	if len(products.TopUpPriceIDs) > 0 {
		parts = append(parts, copy.TopUps+": "+strings.Join(products.TopUpDisplaySnapshots, ", "))
	}
	if len(products.SubscriptionPriceIDs) > 0 {
		parts = append(parts, copy.Subscriptions+": "+strings.Join(products.SubscriptionDisplaySnapshots, ", "))
	}
	return strings.Join(parts, "; "), nil
}

func recallProductDisplaySnapshotsComplete(products RecallProductScope) bool {
	if len(products.TopUpDisplaySnapshots) != len(products.TopUpPriceIDs) ||
		len(products.SubscriptionDisplaySnapshots) != len(products.SubscriptionPriceIDs) {
		return false
	}
	for _, snapshot := range append(append([]string{}, products.TopUpDisplaySnapshots...), products.SubscriptionDisplaySnapshots...) {
		if strings.TrimSpace(snapshot) == "" {
			return false
		}
	}
	return true
}

func resolveRecallProductDisplaySnapshots(ctx context.Context, products RecallProductScope) (RecallProductScope, error) {
	products.TopUpPriceIDs = normalizeRecallStripeIDs(products.TopUpPriceIDs)
	products.SubscriptionPriceIDs = normalizeRecallStripeIDs(products.SubscriptionPriceIDs)
	products.TopUpDisplaySnapshots = make([]string, 0, len(products.TopUpPriceIDs))
	products.SubscriptionDisplaySnapshots = make([]string, 0, len(products.SubscriptionPriceIDs))

	amountByPriceID := setting.StripeTopUpAmountsByPriceID()
	for _, priceID := range products.TopUpPriceIDs {
		amount, ok := amountByPriceID[priceID]
		if !ok {
			return RecallProductScope{}, fmt.Errorf("%w: selected top-up amount metadata is missing", errRecallEmailProductSummaryUnavailable)
		}
		products.TopUpDisplaySnapshots = append(products.TopUpDisplaySnapshots, strconv.FormatInt(amount, 10)+" USD")
	}

	plans, err := model.ListRecallSubscriptionPlansByStripePriceIDsWithContext(ctx, products.SubscriptionPriceIDs)
	if err != nil {
		return RecallProductScope{}, err
	}
	planByPriceID := make(map[string]model.SubscriptionPlan, len(plans))
	for _, plan := range plans {
		planByPriceID[strings.TrimSpace(plan.StripePriceId)] = plan
	}
	for _, priceID := range products.SubscriptionPriceIDs {
		plan, ok := planByPriceID[priceID]
		title := strings.TrimSpace(plan.Title)
		currency := strings.ToUpper(strings.TrimSpace(plan.Currency))
		if !ok || title == "" || currency == "" {
			return RecallProductScope{}, fmt.Errorf("%w: selected subscription plan metadata is missing", errRecallEmailProductSummaryUnavailable)
		}
		amount := strconv.FormatFloat(plan.PriceAmount, 'f', -1, 64)
		products.SubscriptionDisplaySnapshots = append(products.SubscriptionDisplaySnapshots, fmt.Sprintf("%s (%s %s)", title, amount, currency))
	}
	return products, nil
}

func (w *RecallEmailWorker) recallEmailProductSummary(ctx context.Context, productScopeJSON string, language string) (string, error) {
	cacheKey := strings.TrimSpace(language) + "\x00" + productScopeJSON
	now := w.now()
	w.productSummaryMu.Lock()
	entry, exists := w.productSummaryCache[cacheKey]
	if exists && now.Before(entry.expiresAt) {
		w.productSummaryMu.Unlock()
		return entry.summary, nil
	}
	w.productSummaryMu.Unlock()

	summary, err := recallEmailProductSummaryWithContext(ctx, productScopeJSON, language)
	if err != nil {
		return "", err
	}
	w.productSummaryMu.Lock()
	w.productSummaryCache[cacheKey] = recallEmailProductSummaryCacheEntry{
		summary:   summary,
		expiresAt: now.Add(recallEmailProductSummaryCacheTTL),
	}
	w.productSummaryMu.Unlock()
	return summary, nil
}

func recallEmailCopyForLanguage(language string) recallEmailCopy {
	if copy, ok := recallEmailCopyByLanguage[strings.TrimSpace(language)]; ok {
		return copy
	}
	return recallEmailCopyByLanguage["en"]
}

func RenderRecallEmail(input RecallEmailRenderInput) (subject string, htmlBody string, err error) {
	if strings.ContainsAny(input.Template.Subject, "\r\n") {
		return "", "", fmt.Errorf("recall email subject must not contain CR or LF")
	}
	if strings.TrimSpace(input.Template.BodyHTML) != "" {
		body, renderErr := renderRecallEmailHTML(input.Template.BodyHTML, input)
		if renderErr != nil {
			return "", "", renderErr
		}
		return input.Template.Subject, body, nil
	}
	paragraphs := make([]string, 0)
	bodyText := strings.ReplaceAll(input.Template.BodyText, "\r\n", "\n")
	bodyText = strings.ReplaceAll(bodyText, "\r", "\n")
	for _, line := range strings.Split(bodyText, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		paragraphs = append(paragraphs, "<p>"+html.EscapeString(line)+"</p>")
	}
	copy := recallEmailCopyForLanguage(input.Language)
	expires := time.Unix(input.ExpiresAt, 0).UTC().Format("2006-01-02 15:04 UTC")
	htmlBody = "<!doctype html><html><body>" +
		"<p>" + copy.GreetingPrefix + html.EscapeString(input.RecipientName) + copy.GreetingSuffix + "</p>" +
		strings.Join(paragraphs, "") +
		"<p>" + copy.OfferCodeLabel + copy.ValueSeparator + "<code>" + html.EscapeString(input.PromotionCodeMasked) + "</code></p>" +
		"<p>" + copy.ValidForLabel + copy.ValueSeparator + html.EscapeString(input.ProductSummary) + "</p>" +
		"<p>" + copy.ExpiresLabel + copy.ValueSeparator + html.EscapeString(expires) + "</p>" +
		"<p><a href=\"" + html.EscapeString(input.ClaimURL) + "\">" + copy.ClaimLabel + "</a></p>" +
		"<p><a href=\"" + html.EscapeString(input.UnsubscribeURL) + "\">" + copy.UnsubscribeLabel + "</a></p>" +
		"</body></html>"
	return input.Template.Subject, htmlBody, nil
}

func renderRecallEmailHTML(source string, input RecallEmailRenderInput) (string, error) {
	if _, err := parseRecallEmailHTML(source); err != nil {
		return "", fmt.Errorf("recall email html: %w", err)
	}
	compiled, err := htmltemplate.New("recall_email_html").Option("missingkey=error").Parse(source)
	if err != nil {
		return "", fmt.Errorf("parse recall email html template: %w", err)
	}
	data := recallEmailHTMLRenderData{
		RecipientName:       input.RecipientName,
		PromotionCodeMasked: input.PromotionCodeMasked,
		ProductSummary:      input.ProductSummary,
		ExpiresAt:           time.Unix(input.ExpiresAt, 0).UTC().Format("2006-01-02 15:04 UTC"),
		ClaimURL:            input.ClaimURL,
		UnsubscribeURL:      input.UnsubscribeURL,
	}
	var rendered bytes.Buffer
	if err := compiled.Execute(&rendered, data); err != nil {
		return "", fmt.Errorf("render recall email html: %w", err)
	}
	if rendered.Len() > recallEmailHTMLMaxBytes {
		return "", fmt.Errorf("recall email html must contain at most %d bytes", recallEmailHTMLMaxBytes)
	}
	return rendered.String(), nil
}
