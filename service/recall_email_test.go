package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const recallEmailTestNow int64 = 1_784_179_200

type recallEmailSent struct {
	subject   string
	receiver  string
	htmlBody  string
	messageID string
}

type recallEmailFixture struct {
	worker    *RecallEmailWorker
	claims    *RecallClaimService
	campaign  model.RecallCampaign
	user      model.User
	recipient model.RecallRecipient
	message   model.RecallMessage
	sent      *[]recallEmailSent
	now       *time.Time
}

func TestRecallEmailRenderEscapesStoredContentAndOwnsActionMarkup(t *testing.T) {
	subject, body, err := RenderRecallEmail(RecallEmailRenderInput{
		Language: "en",
		Template: RecallEmailTemplate{
			Subject:  "Return <now>",
			BodyText: "Hello <script>alert(1)</script>\nSecond & final line",
		},
		RecipientName:       `Ada <img src=x onerror=alert(1)>`,
		PromotionCodeMasked: `PROM****23`,
		ExpiresAt:           recallEmailTestNow + 3600,
		ProductSummary:      `Top-ups & subscriptions <all>`,
		ClaimURL:            `https://console.example.com/recall/claim?claim=raw_token&next="bad"`,
		UnsubscribeURL:      `https://console.example.com/recall/unsubscribe?token=unsubscribe_token&next="bad"`,
	})
	require.NoError(t, err)
	require.Equal(t, "Return <now>", subject)
	require.NotContains(t, body, "<script>")
	require.NotContains(t, body, "<img")
	require.Contains(t, body, "&lt;script&gt;alert(1)&lt;/script&gt;")
	require.Contains(t, body, "Ada &lt;img src=x onerror=alert(1)&gt;")
	require.Contains(t, body, "<p>Hello &lt;script&gt;alert(1)&lt;/script&gt;</p>")
	require.Contains(t, body, "<p>Second &amp; final line</p>")
	require.Contains(t, body, "<code>PROM****23</code>")
	require.Contains(t, body, "Top-ups &amp; subscriptions &lt;all&gt;")
	require.Contains(t, body, "Claim your offer</a>")
	require.Contains(t, body, "Unsubscribe</a>")
	require.Contains(t, body, "claim=raw_token&amp;next=&#34;bad&#34;")
}

func TestRecallEmailRenderExecutesHTMLTemplateWithoutLegacyWrapper(t *testing.T) {
	template := RecallEmailTemplate{Subject: "Return", BodyHTML: validRecallHTML}
	subject, body, err := RenderRecallEmail(RecallEmailRenderInput{
		Language:            "en",
		Template:            template,
		RecipientName:       `<Admin & Co>`,
		PromotionCodeMasked: `SAVE****25`,
		ProductSummary:      `Top-ups & subscriptions`,
		ExpiresAt:           1_900_000_000,
		ClaimURL:            `https://flatkey.ai/claim?a=1&b=2`,
		UnsubscribeURL:      `https://flatkey.ai/unsubscribe?a=1&b=2`,
	})
	require.NoError(t, err)
	require.Equal(t, "Return", subject)
	require.Contains(t, body, `&lt;Admin &amp; Co&gt;`)
	require.Contains(t, body, `SAVE****25`)
	require.Contains(t, body, `Top-ups &amp; subscriptions`)
	require.Contains(t, body, time.Unix(1_900_000_000, 0).UTC().Format("2006-01-02 15:04 UTC"))
	require.Contains(t, body, `href="https://flatkey.ai/claim?a=1&amp;b=2"`)
	require.Contains(t, body, `href="https://flatkey.ai/unsubscribe?a=1&amp;b=2"`)
	require.NotContains(t, body, recallEmailCopyByLanguage["en"].GreetingPrefix+`&lt;Admin &amp; Co&gt;,`)
}

func TestRecallEmailRenderUsesLanguageSpecificWrapperAndProductSummary(t *testing.T) {
	setupRecallCampaignTestDB(t)
	tests := []struct {
		language         string
		products         RecallProductScope
		greeting         string
		offerCodeLabel   string
		validForLabel    string
		productSummary   string
		expiresLabel     string
		claimLabel       string
		unsubscribeLabel string
	}{
		{
			language: "en", products: RecallProductScope{TopUpPriceIDs: []string{"topup"}, SubscriptionPriceIDs: []string{"subscription"}},
			greeting: "Hello Ada,", offerCodeLabel: "Offer code:", validForLabel: "Valid for:", productSummary: "Top-ups and subscriptions",
			expiresLabel: "Expires:", claimLabel: "Claim your offer", unsubscribeLabel: "Unsubscribe",
		},
		{
			language: "zh", products: RecallProductScope{TopUpPriceIDs: []string{"topup"}},
			greeting: "您好，Ada！", offerCodeLabel: "优惠码：", validForLabel: "适用于：", productSummary: "充值",
			expiresLabel: "有效期至：", claimLabel: "领取优惠", unsubscribeLabel: "取消订阅",
		},
		{
			language: "es", products: RecallProductScope{SubscriptionPriceIDs: []string{"subscription"}},
			greeting: "Hola Ada,", offerCodeLabel: "Código de oferta:", validForLabel: "Válido para:", productSummary: "Suscripciones",
			expiresLabel: "Caduca:", claimLabel: "Canjear tu oferta", unsubscribeLabel: "Cancelar suscripción",
		},
		{
			language: "fr", products: RecallProductScope{},
			greeting: "Bonjour Ada,", offerCodeLabel: "Code promotionnel :", validForLabel: "Valable pour :", productSummary: "Produits éligibles",
			expiresLabel: "Expire le :", claimLabel: "Profiter de votre offre", unsubscribeLabel: "Se désabonner",
		},
		{
			language: "pt", products: RecallProductScope{TopUpPriceIDs: []string{"topup"}, SubscriptionPriceIDs: []string{"subscription"}},
			greeting: "Olá Ada,", offerCodeLabel: "Código da oferta:", validForLabel: "Válido para:", productSummary: "Recargas e assinaturas",
			expiresLabel: "Expira em:", claimLabel: "Resgatar sua oferta", unsubscribeLabel: "Cancelar inscrição",
		},
		{
			language: "ru", products: RecallProductScope{TopUpPriceIDs: []string{"topup"}},
			greeting: "Здравствуйте, Ada!", offerCodeLabel: "Код предложения:", validForLabel: "Действует для:", productSummary: "Пополнения",
			expiresLabel: "Истекает:", claimLabel: "Получить предложение", unsubscribeLabel: "Отписаться",
		},
		{
			language: "ja", products: RecallProductScope{SubscriptionPriceIDs: []string{"subscription"}},
			greeting: "Ada さん、こんにちは。", offerCodeLabel: "オファーコード：", validForLabel: "対象商品：", productSummary: "サブスクリプション",
			expiresLabel: "有効期限：", claimLabel: "オファーを利用する", unsubscribeLabel: "配信停止",
		},
		{
			language: "vi", products: RecallProductScope{},
			greeting: "Xin chào Ada,", offerCodeLabel: "Mã ưu đãi:", validForLabel: "Áp dụng cho:", productSummary: "Sản phẩm đủ điều kiện",
			expiresLabel: "Hết hạn:", claimLabel: "Nhận ưu đãi", unsubscribeLabel: "Hủy đăng ký",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.language, func(t *testing.T) {
			for range testCase.products.TopUpPriceIDs {
				testCase.products.TopUpDisplaySnapshots = append(testCase.products.TopUpDisplaySnapshots, "10 USD")
			}
			for range testCase.products.SubscriptionPriceIDs {
				testCase.products.SubscriptionDisplaySnapshots = append(testCase.products.SubscriptionDisplaySnapshots, "Pro monthly (20 USD)")
			}
			productJSON, err := common.Marshal(testCase.products)
			require.NoError(t, err)
			productSummary, err := recallEmailProductSummary(string(productJSON), testCase.language)
			require.NoError(t, err)

			_, body, err := RenderRecallEmail(RecallEmailRenderInput{
				Language:            testCase.language,
				Template:            RecallEmailTemplate{Subject: "Subject", BodyText: "Body"},
				RecipientName:       "Ada",
				PromotionCodeMasked: "SAVE****25",
				ExpiresAt:           recallEmailTestNow + 3600,
				ProductSummary:      productSummary,
				ClaimURL:            "https://console.example.com/claim",
				UnsubscribeURL:      "https://console.example.com/unsubscribe",
			})
			require.NoError(t, err)
			expectedProductCopy := testCase.productSummary
			if len(testCase.products.TopUpPriceIDs) > 0 {
				expectedProductCopy = recallEmailCopyForLanguage(testCase.language).TopUps
			} else if len(testCase.products.SubscriptionPriceIDs) > 0 {
				expectedProductCopy = recallEmailCopyForLanguage(testCase.language).Subscriptions
			}
			for _, expected := range []string{
				testCase.greeting,
				testCase.offerCodeLabel,
				testCase.validForLabel,
				expectedProductCopy,
				testCase.expiresLabel,
				testCase.claimLabel + "</a>",
				testCase.unsubscribeLabel + "</a>",
				time.Unix(recallEmailTestNow+3600, 0).UTC().Format("2006-01-02 15:04 UTC"),
			} {
				require.Contains(t, body, expected)
			}
		})
	}
}

func TestRecallEmailRenderUnknownLanguageUsesEnglish(t *testing.T) {
	setupRecallCampaignTestDB(t)
	productJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:                []string{"topup"},
		SubscriptionPriceIDs:         []string{"subscription"},
		TopUpDisplaySnapshots:        []string{"10 USD"},
		SubscriptionDisplaySnapshots: []string{"Pro monthly (20 USD)"},
	})
	require.NoError(t, err)
	productSummary, err := recallEmailProductSummary(string(productJSON), "de")
	require.NoError(t, err)
	require.Equal(t, "Top-ups: 10 USD; Subscriptions: Pro monthly (20 USD)", productSummary)

	_, body, err := RenderRecallEmail(RecallEmailRenderInput{
		Language:            "de",
		Template:            RecallEmailTemplate{Subject: "Subject", BodyText: "Body"},
		RecipientName:       "Ada",
		PromotionCodeMasked: "SAVE****25",
		ExpiresAt:           recallEmailTestNow + 3600,
		ProductSummary:      productSummary,
		ClaimURL:            "https://console.example.com/claim",
		UnsubscribeURL:      "https://console.example.com/unsubscribe",
	})
	require.NoError(t, err)
	require.Contains(t, body, "Hello Ada,")
	require.Contains(t, body, "Offer code:")
	require.Contains(t, body, "Valid for: Top-ups: 10 USD; Subscriptions: Pro monthly (20 USD)")
	require.Contains(t, body, "Claim your offer</a>")
	require.Contains(t, body, "Unsubscribe</a>")
}

func TestRecallEmailProductSummaryUsesConfiguredAmountsAndPlanDetails(t *testing.T) {
	setupRecallCampaignTestDB(t)
	originalTopUpPriceIDs := setting.StripeTopUpPriceIds
	setting.StripeTopUpPriceIds = `{"10":"price_topup_10","50":"price_topup_50"}`
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUpPriceIDs
	})
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Title:         "Pro monthly",
		PriceAmount:   20,
		Currency:      "USD",
		Enabled:       true,
		StripePriceId: "price_pro_month",
	}).Error)
	productJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:        []string{"price_topup_50", "price_topup_10"},
		SubscriptionPriceIDs: []string{"price_pro_month"},
	})
	require.NoError(t, err)

	productSummary, err := recallEmailProductSummary(string(productJSON), "en")
	require.NoError(t, err)
	require.Equal(t, "Top-ups: 50 USD, 10 USD; Subscriptions: Pro monthly (20 USD)", productSummary)
	require.NotContains(t, productSummary, "price_")
}

func TestRecallEmailProductSummaryRejectsUnresolvedProductsInsteadOfSendingGenericCopy(t *testing.T) {
	setupRecallCampaignTestDB(t)
	originalTopUpPriceIDs := setting.StripeTopUpPriceIds
	setting.StripeTopUpPriceIds = ""
	t.Cleanup(func() {
		setting.StripeTopUpPriceIds = originalTopUpPriceIDs
	})
	productJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:        []string{"missing_topup"},
		SubscriptionPriceIDs: []string{"missing_subscription"},
	})
	require.NoError(t, err)

	productSummary, err := recallEmailProductSummary(string(productJSON), "en")

	require.ErrorIs(t, err, errRecallEmailProductSummaryUnavailable)
	require.Empty(t, productSummary)
}

func TestRecallEmailProductSummaryInvalidScopeIsPermanent(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", fixture.campaign.Id).
		Update("product_scope", "{").Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageFailed, stored.State)
	require.Equal(t, "product_scope_invalid", stored.LastErrorCode)
	require.Zero(t, stored.NextAttemptAt)
}

func TestRecallEmailProductSummaryDatabaseFailureIsRetryable(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	productJSON, err := common.Marshal(RecallProductScope{SubscriptionPriceIDs: []string{"price_sub"}})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", fixture.campaign.Id).
		Update("product_scope", string(productJSON)).Error)
	callbackName := "recall_email_product_summary_database_failure"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			tx.AddError(errors.New("temporary subscription plan lookup failure"))
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageRetryWait, stored.State)
	require.Equal(t, "product_summary_lookup_failed", stored.LastErrorCode)
	require.Equal(t, recallEmailTestNow+30, stored.NextAttemptAt)
}

func TestRecallEmailTemplateForLanguageReturnsResolvedLanguage(t *testing.T) {
	snapshot, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "English subject", BodyText: "English body"},
		"zh": {Subject: "中文主题", BodyText: "中文正文"},
		"de": {Subject: "German subject", BodyText: "German body"},
	})
	require.NoError(t, err)

	template, language, err := recallEmailTemplateForLanguage(string(snapshot), "zh")
	require.NoError(t, err)
	require.Equal(t, RecallEmailTemplate{Subject: "中文主题", BodyText: "中文正文"}, template)
	require.Equal(t, "zh", language)

	template, language, err = recallEmailTemplateForLanguage(string(snapshot), "fr")
	require.NoError(t, err)
	require.Equal(t, RecallEmailTemplate{Subject: "English subject", BodyText: "English body"}, template)
	require.Equal(t, "en", language)

	template, language, err = recallEmailTemplateForLanguage(string(snapshot), "de")
	require.NoError(t, err)
	require.Equal(t, RecallEmailTemplate{Subject: "English subject", BodyText: "English body"}, template)
	require.Equal(t, "en", language)
}

func TestRecallEmailZhExactTemplateUsesZhThroughout(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	snapshot, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "English subject", BodyText: "English body"},
		"zh": {Subject: "中文主题", BodyText: "中文正文"},
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("language_snapshot", "zh").Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("template_snapshot", string(snapshot)).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	require.Len(t, *fixture.sent, 1)
	sent := (*fixture.sent)[0]
	require.Equal(t, "中文主题", sent.subject)
	require.Contains(t, sent.htmlBody, "中文正文")
	require.Contains(t, sent.htmlBody, "您好，Ada &lt;admin&gt;！")
	require.Contains(t, sent.htmlBody, "适用于：充值: 10 USD; 订阅: Pro monthly (20 USD)")
	require.Contains(t, sent.htmlBody, "领取优惠</a>")
}

func TestRecallEmailMissingFrTemplateUsesEnglishThroughout(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	snapshot, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "English subject", BodyText: "English body"},
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("language_snapshot", "fr").Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("template_snapshot", string(snapshot)).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	require.Len(t, *fixture.sent, 1)
	sent := (*fixture.sent)[0]
	require.Equal(t, "English subject", sent.subject)
	require.Contains(t, sent.htmlBody, "English body")
	require.Contains(t, sent.htmlBody, "Hello Ada &lt;admin&gt;,")
	require.Contains(t, sent.htmlBody, "Valid for: Top-ups: 10 USD; Subscriptions: Pro monthly (20 USD)")
	require.Contains(t, sent.htmlBody, "Claim your offer</a>")
	require.NotContains(t, sent.htmlBody, "Bonjour")
	require.NotContains(t, sent.htmlBody, "Recharges")
}

func TestRecallEmailStableMessageIDUsesEffectiveSMTPDomain(t *testing.T) {
	setRecallEmailSMTPFrom(t, "mailer@notify.example.com")
	messageID, err := recallEmailMessageID(42, 3)
	require.NoError(t, err)
	require.Equal(t, "<recall-42-3@notify.example.com>", messageID)
}

func TestRecallEmailAcceptedSchedulesVersionedStagesRelativeToFirstAcceptance(t *testing.T) {
	fixture := newRecallEmailFixture(t, 3, nil)
	*fixture.now = time.Unix(recallEmailTestNow, 0).UTC()

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	require.Len(t, *fixture.sent, 1)
	firstSend := (*fixture.sent)[0]
	require.Equal(t, "Return stage 1", firstSend.subject)
	require.Equal(t, "snapshot@example.com", firstSend.receiver)
	require.Contains(t, firstSend.htmlBody, "/console/topup?recall_claim=")
	require.Equal(t, fmt.Sprintf("<recall-%d-1@notify.example.com>", fixture.recipient.Id), firstSend.messageID)
	require.Contains(t, firstSend.htmlBody, model.MaskPromotionCode(fixture.recipient.PromotionCode))
	require.NotContains(t, firstSend.htmlBody, fixture.recipient.PromotionCode)
	require.Contains(t, firstSend.htmlBody, "Top-ups: 10 USD; Subscriptions: Pro monthly (20 USD)")

	var accepted model.RecallMessage
	require.NoError(t, model.DB.First(&accepted, fixture.message.Id).Error)
	require.Equal(t, model.RecallMessageAccepted, accepted.State)
	require.Equal(t, recallEmailTestNow, accepted.AcceptedAt)
	require.Equal(t, firstSend.messageID, accepted.ProviderMessageId)
	require.NotNil(t, accepted.ClaimTokenHash)
	rawClaim := recallEmailRawClaim(t, firstSend.htmlBody)
	require.Equal(t, recallEmailHash(rawClaim), *accepted.ClaimTokenHash)
	require.NotEqual(t, rawClaim, *accepted.ClaimTokenHash)

	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, fixture.recipient.Id).Error)
	require.Equal(t, recallEmailTestNow, recipient.FirstSentAt)
	require.Equal(t, recallEmailTestNow, recipient.LastSentAt)

	stageTwo := loadRecallEmailMessage(t, fixture.recipient.Id, 2)
	require.Equal(t, model.RecallMessageScheduled, stageTwo.State)
	require.Equal(t, 12, stageTwo.TemplateVersion)
	require.Equal(t, recallEmailTestNow+600, stageTwo.ScheduledAt)
	require.NotEmpty(t, stageTwo.TemplateSnapshot)
	require.Nil(t, stageTwo.ClaimTokenHash)

	*fixture.now = time.Unix(recallEmailTestNow+700, 0).UTC()
	won, err := model.LeaseRecallMessage(stageTwo.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), stageTwo.Id))

	stageThree := loadRecallEmailMessage(t, fixture.recipient.Id, 3)
	require.Equal(t, 13, stageThree.TemplateVersion)
	require.Equal(t, recallEmailTestNow+1200, stageThree.ScheduledAt)
	require.NotEmpty(t, stageThree.TemplateSnapshot)
	require.NoError(t, model.DB.First(&recipient, fixture.recipient.Id).Error)
	require.Equal(t, recallEmailTestNow, recipient.FirstSentAt)
	require.Equal(t, recallEmailTestNow+700, recipient.LastSentAt)

	err = fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)
	require.ErrorIs(t, err, ErrRecallEmailLeaseLost)
	var stageTwoCount int64
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("recipient_id = ? AND stage_no = ?", fixture.recipient.Id, 2).Count(&stageTwoCount).Error)
	require.EqualValues(t, 1, stageTwoCount)
}

func TestRecallEmailAccountBackedRecipientUsesRecipientUnsubscribeToken(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, *fixture.sent, 1)
	unsubscribeToken := recallEmailRawUnsubscribeToken(t, (*fixture.sent)[0].htmlBody)
	requireRecallEmailUnsubscribePayload(t, unsubscribeToken, 2, 0, fixture.recipient.Id, fixture.recipient.PromotionExpiresAt)
}

func TestRecallEmailAcceptedTimestampUsesSMTPAcceptanceTime(t *testing.T) {
	fixture := newRecallEmailFixture(t, 2, nil)
	fixture.worker.sender = func(subject, receiver, content, messageID string) error {
		*fixture.now = fixture.now.Add(90 * time.Second)
		return nil
	}

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	accepted := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, recallEmailTestNow+90, accepted.AcceptedAt)
	require.Equal(t, recallEmailTestNow+90+600, loadRecallEmailMessage(t, fixture.recipient.Id, 2).ScheduledAt)
}

func TestRecallEmailRechecksLeaseExpiryImmediatelyBeforeSending(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	nowCalls := 0
	fixture.worker.now = func() time.Time {
		nowCalls++
		if nowCalls == 1 {
			return time.Unix(recallEmailTestNow, 0).UTC()
		}
		return time.Unix(recallEmailTestNow+recallEmailLeaseSeconds, 0).UTC()
	}

	err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	require.ErrorIs(t, err, ErrRecallEmailLeaseLost)
	require.Empty(t, *fixture.sent)
	require.Equal(t, model.RecallMessageLeased, loadRecallEmailMessageByID(t, fixture.message.Id).State)
}

func TestRecallEmailSameOwnerReLeaseRejectsStaleClaimBody(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	originalLeaseUntil := fixture.message.LeaseExpiresAt
	oldRawClaim := base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{1}, 36))
	newClaimHash := recallEmailHash("new-lease-claim")
	workItemQueries := 0
	reLeased := false
	var callbackErr error
	var newLeaseUntil int64
	callbackName := "recall_email_same_owner_re_lease"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "recall_messages" || len(tx.Statement.Selects) != 0 {
			return
		}
		workItemQueries++
		if workItemQueries != 2 || reLeased {
			return
		}
		reLeased = true
		*fixture.now = time.Unix(originalLeaseUntil+1, 0).UTC()
		newLeaseUntil = fixture.now.Unix() + recallEmailLeaseSeconds
		won, err := model.LeaseRecallMessage(fixture.message.Id, fixture.worker.owner, fixture.now.Unix(), newLeaseUntil)
		if err != nil {
			callbackErr = err
			return
		}
		if !won {
			callbackErr = fmt.Errorf("same-owner re-lease did not win")
			return
		}
		updated, err := model.SetRecallMessageClaimHash(context.Background(), fixture.message.Id, fixture.worker.owner, newLeaseUntil, newClaimHash)
		if err != nil {
			callbackErr = err
			return
		}
		if !updated {
			callbackErr = fmt.Errorf("new lease claim hash was not stored")
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	require.NoError(t, callbackErr)
	require.True(t, reLeased)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.NotNil(t, stored.ClaimTokenHash)
	require.Equal(t, newClaimHash, *stored.ClaimTokenHash)
	if len(*fixture.sent) > 0 {
		sentRawClaim := recallEmailRawClaim(t, (*fixture.sent)[0].htmlBody)
		require.Equal(t, oldRawClaim, sentRawClaim)
		require.NotEqual(t, *stored.ClaimTokenHash, recallEmailHash(sentRawClaim))
	}
	require.ErrorIs(t, err, ErrRecallEmailLeaseLost)
	require.Empty(t, *fixture.sent)
	require.Equal(t, model.RecallMessageLeased, stored.State)
	require.Equal(t, newLeaseUntil, stored.LeaseExpiresAt)
}

func TestRecallEmailLanguageUsesExactSnapshotThenFallsBackToEnglish(t *testing.T) {
	tests := []struct {
		language string
		want     string
	}{
		{language: "zh", want: "回来"},
		{language: "fr", want: "Return stage 1"},
	}
	for _, testCase := range tests {
		t.Run(testCase.language, func(t *testing.T) {
			fixture := newRecallEmailFixture(t, 1, nil)
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("language_snapshot", testCase.language).Error)
			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
			require.Len(t, *fixture.sent, 1)
			require.Equal(t, testCase.want, (*fixture.sent)[0].subject)
		})
	}
}

func TestRecallEmailDefinitePreAcceptFailureRetriesWithNewClaimHash(t *testing.T) {
	calls := 0
	messageIDs := make([]string, 0, 2)
	fixture := newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
		calls++
		messageIDs = append(messageIDs, messageID)
		if calls == 1 {
			return errors.New("temporary MAIL FROM rejection")
		}
		return nil
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	first := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageRetryWait, first.State)
	require.Equal(t, 1, first.AttemptCount)
	require.Equal(t, recallEmailTestNow+30, first.NextAttemptAt)
	require.NotNil(t, first.ClaimTokenHash)
	firstHash := *first.ClaimTokenHash
	common.SMTPFrom = "mailer@changed.example.com"
	common.SMTPAccount = "mailer@changed.example.com"

	*fixture.now = time.Unix(first.NextAttemptAt, 0).UTC()
	won, err := model.LeaseRecallMessage(first.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), first.Id))
	accepted := loadRecallEmailMessageByID(t, first.Id)
	require.Equal(t, model.RecallMessageAccepted, accepted.State)
	require.Equal(t, 2, accepted.AttemptCount)
	require.NotEqual(t, firstHash, *accepted.ClaimTokenHash)
	require.Equal(t, []string{
		fmt.Sprintf("<recall-%d-1@notify.example.com>", fixture.recipient.Id),
		fmt.Sprintf("<recall-%d-1@notify.example.com>", fixture.recipient.Id),
	}, messageIDs)
}

func TestRecallEmailRetryDelayIsBoundedExponential(t *testing.T) {
	require.Equal(t, 30*time.Second, recallEmailRetryDelay(1))
	require.Equal(t, 60*time.Second, recallEmailRetryDelay(2))
	require.Equal(t, 120*time.Second, recallEmailRetryDelay(3))
	require.Equal(t, time.Hour, recallEmailRetryDelay(20))
}

func TestRecallEmailDefiniteFailureStopsAfterBoundedAttempts(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
		return errors.New("temporary pre-accept rejection")
	})
	messageID := fixture.message.Id
	for attempt := 1; attempt <= recallEmailMaxAttempts; attempt++ {
		require.NoError(t, fixture.worker.ProcessLeased(context.Background(), messageID))
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Equal(t, attempt, stored.AttemptCount)
		if attempt == recallEmailMaxAttempts {
			require.Equal(t, model.RecallMessageFailed, stored.State)
			require.Zero(t, stored.NextAttemptAt)
			break
		}
		require.Equal(t, model.RecallMessageRetryWait, stored.State)
		*fixture.now = time.Unix(stored.NextAttemptAt, 0).UTC()
		won, err := model.LeaseRecallMessage(stored.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
		require.NoError(t, err)
		require.True(t, won)
	}
	due, err := model.ListDueRecallMessageIDs(fixture.now.Add(24*time.Hour).Unix(), 10)
	require.NoError(t, err)
	require.NotContains(t, due, messageID)
}

func TestRecallEmailUncertainOutcomeIsNeverAutomaticallyRetried(t *testing.T) {
	uncertainErr := newRecallEmailUncertainError(t)
	fixture := newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
		return uncertainErr
	})
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("next_attempt_at", recallEmailTestNow-1).Error)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageUncertain, stored.State)
	require.Zero(t, stored.NextAttemptAt)
	require.NotNil(t, stored.ClaimTokenHash)
	preservedHash := *stored.ClaimTokenHash
	due, err := model.ListDueRecallMessageIDs(recallEmailTestNow+24*3600, 10)
	require.NoError(t, err)
	require.NotContains(t, due, stored.Id)

	won, err := model.ManualRetryRecallMessageWithContext(context.Background(), stored.Id, false, recallEmailTestNow+10)
	require.NoError(t, err)
	require.False(t, won)
	won, err = model.ManualRetryRecallMessageWithContext(context.Background(), stored.Id, true, recallEmailTestNow+10)
	require.NoError(t, err)
	require.True(t, won)
	retried := loadRecallEmailMessageByID(t, stored.Id)
	require.Equal(t, model.RecallMessageRetryWait, retried.State)
	require.Equal(t, preservedHash, *retried.ClaimTokenHash)

	failed := model.RecallMessage{
		RecipientId: fixture.recipient.Id, StageNo: 2, TemplateVersion: 2,
		TemplateSnapshot: `{}`, State: model.RecallMessageFailed,
	}
	require.NoError(t, model.DB.Create(&failed).Error)
	won, err = model.ManualRetryRecallMessageWithContext(context.Background(), failed.Id, false, recallEmailTestNow+10)
	require.NoError(t, err)
	require.True(t, won)
}

func TestRecallEmailPostSMTPPersistenceFailureNeverBecomesDue(t *testing.T) {
	tests := []struct {
		name      string
		senderErr func(t *testing.T) error
	}{
		{name: "accepted", senderErr: func(t *testing.T) error { return nil }},
		{name: "uncertain", senderErr: newRecallEmailUncertainError},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			senderRan := false
			fixture := newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
				senderRan = true
				installRecallEmailOutcomeUpdateFailure(t)
				return testCase.senderErr(t)
			})

			err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)
			require.ErrorContains(t, err, "injected recall email outcome persistence failure")
			require.True(t, senderRan)

			due, err := model.ListDueRecallMessageIDs(recallEmailTestNow+recallEmailLeaseSeconds+1, 10)
			require.NoError(t, err)
			require.NotContains(t, due, fixture.message.Id, "SMTP already ran, so an expired lease must not make the message sendable again")
			require.Equal(t, model.RecallMessageSending, loadRecallEmailMessageByID(t, fixture.message.Id).State)
		})
	}
}

func TestRecallEmailSenderCrashLeavesNonDueSendingMessage(t *testing.T) {
	stateObservedBySender := ""
	var fixture recallEmailFixture
	fixture = newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
		stateObservedBySender = loadRecallEmailMessageByID(t, fixture.message.Id).State
		panic("simulated sender process crash")
	})

	require.PanicsWithValue(t, "simulated sender process crash", func() {
		_ = fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)
	})
	require.Equal(t, model.RecallMessageSending, stateObservedBySender)
	due, err := model.ListDueRecallMessageIDs(recallEmailTestNow+recallEmailLeaseSeconds+1, 10)
	require.NoError(t, err)
	require.NotContains(t, due, fixture.message.Id)
}

func TestRecallEmailConcurrentCancellationFencesSendingOutcome(t *testing.T) {
	tests := []struct {
		name   string
		cancel func(context.Context, recallEmailFixture) error
	}{
		{name: "global opt out", cancel: func(ctx context.Context, fixture recallEmailFixture) error {
			found, err := model.SetRecallMarketingOptOutWithContext(ctx, fixture.user.Id, recallEmailTestNow+1)
			if err != nil {
				return err
			}
			if !found {
				return errors.New("recall user disappeared during opt out")
			}
			return nil
		}},
		{name: "campaign cancellation", cancel: func(ctx context.Context, fixture recallEmailFixture) error {
			cancelled, err := model.CancelRecallCampaignWithContext(ctx, fixture.campaign.Id, []string{model.RecallCampaignRunning}, recallEmailTestNow+1, "campaign_cancelled")
			if err != nil {
				return err
			}
			if !cancelled {
				return errors.New("recall campaign was not cancelled")
			}
			return nil
		}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			stateObservedBySender := ""
			var fixture recallEmailFixture
			fixture = newRecallEmailFixture(t, 1, func(subject, receiver, content, messageID string) error {
				stateObservedBySender = loadRecallEmailMessageByID(t, fixture.message.Id).State
				return testCase.cancel(context.Background(), fixture)
			})
			require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("next_attempt_at", recallEmailTestNow-1).Error)

			err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)
			require.ErrorIs(t, err, ErrRecallEmailLeaseLost)
			require.Equal(t, model.RecallMessageSending, stateObservedBySender)
			stored := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.Equal(t, model.RecallMessageCancelled, stored.State)
			require.Zero(t, stored.NextAttemptAt)
			require.Empty(t, stored.LeaseOwner)
			require.Zero(t, stored.LeaseExpiresAt)
		})
	}
}

func TestRecallEmailStopChecksCancelCurrentAndRemainingMessages(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(t *testing.T, fixture recallEmailFixture)
	}{
		{name: "opted out", mutate: func(t *testing.T, fixture recallEmailFixture) {
			settingJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
			require.NoError(t, err)
			require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("setting", string(settingJSON)).Error)
		}},
		{name: "payment after enrollment", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Create(&model.TopUp{UserId: fixture.user.Id, TradeNo: "recall-paid", Status: common.TopUpStatusSuccess, CompleteTime: fixture.recipient.CreatedAt + 1}).Error)
		}},
		{name: "api activity after enrollment", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: fixture.user.Id, Type: model.LogTypeConsume, CreatedAt: fixture.recipient.CreatedAt + 1}).Error)
		}},
		{name: "converted promotion", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{"state": model.RecallRecipientConverted, "converted_at": recallEmailTestNow - 1}).Error)
		}},
		{name: "expired promotion", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Update("promotion_expires_at", recallEmailTestNow).Error)
		}},
		{name: "disabled user", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("status", common.UserStatusDisabled).Error)
		}},
		{name: "disabled email", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("email", "changed@example.com").Error)
		}},
		{name: "paused campaign", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("status", model.RecallCampaignPaused).Error)
		}},
		{name: "cancelled campaign", mutate: func(t *testing.T, fixture recallEmailFixture) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("status", model.RecallCampaignCancelled).Error)
		}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newRecallEmailFixture(t, 2, nil)
			require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("next_attempt_at", recallEmailTestNow-1).Error)
			remaining := model.RecallMessage{
				RecipientId: fixture.recipient.Id, StageNo: 2, TemplateVersion: 12,
				TemplateSnapshot: fixture.message.TemplateSnapshot, ScheduledAt: recallEmailTestNow + 600, State: model.RecallMessageScheduled, NextAttemptAt: recallEmailTestNow + 700,
			}
			require.NoError(t, model.DB.Create(&remaining).Error)
			testCase.mutate(t, fixture)

			err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)
			require.NoError(t, err)
			require.Empty(t, *fixture.sent)
			current := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.Equal(t, model.RecallMessageCancelled, current.State)
			require.Zero(t, current.NextAttemptAt)
			require.Nil(t, current.ClaimTokenHash)
			remaining = loadRecallEmailMessageByID(t, remaining.Id)
			require.Equal(t, model.RecallMessageCancelled, remaining.State)
			require.Zero(t, remaining.NextAttemptAt)
		})
	}
}

func TestRecallEmailCompletedCampaignContinuesEnrolledFlow(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("status", model.RecallCampaignCompleted).Error)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	require.Len(t, *fixture.sent, 1)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
}

func TestRecallEmailInvalidNextStageConfigurationFailsBeforeSMTP(t *testing.T) {
	fixture := newRecallEmailFixture(t, 2, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("email_sequence_config", "{").Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageFailed, stored.State)
	require.Equal(t, "next_stage_invalid", stored.LastErrorCode)
}

func TestRecallEmailRunBatchLeasesOnlyDueMessages(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	futureRecipient := fixture.recipient
	futureRecipient.Id = 0
	futureRecipient.RecipientIdentity = ""
	futureRecipient.UserId++
	futureRecipient.EmailSnapshot = "future@example.com"
	futurePromotionID := "promo_future"
	futureRecipient.StripePromotionCodeId = &futurePromotionID
	require.NoError(t, model.DB.Create(&futureRecipient).Error)
	future := model.RecallMessage{RecipientId: futureRecipient.Id, StageNo: 1, TemplateVersion: 11, TemplateSnapshot: fixture.message.TemplateSnapshot, ScheduledAt: recallEmailTestNow + 60, State: model.RecallMessageScheduled}
	require.NoError(t, model.DB.Create(&future).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
	require.Equal(t, model.RecallMessageScheduled, loadRecallEmailMessageByID(t, future.Id).State)
}

func TestRecallEmailRunBatchRefreshesStopInputsBeforeEachSend(t *testing.T) {
	tests := []struct {
		name       string
		stopReason string
		mutate     func(t *testing.T, fixture recallEmailFixture, secondUser model.User, secondRecipient model.RecallRecipient)
	}{
		{
			name:       "campaign paused",
			stopReason: "campaign_paused",
			mutate: func(t *testing.T, fixture recallEmailFixture, _ model.User, _ model.RecallRecipient) {
				require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update("status", model.RecallCampaignPaused).Error)
			},
		},
		{
			name:       "user disabled",
			stopReason: "user_disabled",
			mutate: func(t *testing.T, _ recallEmailFixture, secondUser model.User, _ model.RecallRecipient) {
				require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", secondUser.Id).Update("status", common.UserStatusDisabled).Error)
			},
		},
		{
			name:       "api activity after enrollment",
			stopReason: "api_activity_after_enrollment",
			mutate: func(t *testing.T, _ recallEmailFixture, secondUser model.User, secondRecipient model.RecallRecipient) {
				require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: secondUser.Id, Type: model.LogTypeConsume, CreatedAt: secondRecipient.CreatedAt + 1}).Error)
			},
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			fixture := newRecallEmailFixture(t, 1, nil)
			require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
				"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
			}).Error)

			secondUser := fixture.user
			secondUser.Id = 0
			secondUser.Username = "recall-batch-second"
			secondUser.Email = "batch-second@example.com"
			secondUser.AffCode = "recall-batch-second"
			require.NoError(t, model.DB.Create(&secondUser).Error)
			secondRecipient := fixture.recipient
			secondRecipient.Id = 0
			secondRecipient.RecipientIdentity = ""
			secondRecipient.UserId = secondUser.Id
			secondRecipient.EmailSnapshot = secondUser.Email
			secondPromotionID := "promo_batch_second"
			secondRecipient.StripePromotionCodeId = &secondPromotionID
			require.NoError(t, model.DB.Create(&secondRecipient).Error)
			secondMessage := fixture.message
			secondMessage.Id = 0
			secondMessage.RecipientId = secondRecipient.Id
			secondMessage.State = model.RecallMessageScheduled
			secondMessage.LeaseOwner = ""
			secondMessage.LeaseExpiresAt = 0
			require.NoError(t, model.DB.Create(&secondMessage).Error)

			sent := 0
			fixture.worker.sender = func(subject, receiver, content, messageID string) error {
				sent++
				if sent == 1 {
					testCase.mutate(t, fixture, secondUser, secondRecipient)
				}
				return nil
			}

			processed, err := fixture.worker.RunBatch(context.Background(), 10)

			require.NoError(t, err)
			require.Equal(t, 2, processed)
			require.Equal(t, 1, sent)
			require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
			secondStored := loadRecallEmailMessageByID(t, secondMessage.Id)
			require.Equal(t, model.RecallMessageCancelled, secondStored.State)
			require.Equal(t, testCase.stopReason, secondStored.LastErrorCode)
		})
	}
}

func TestRecallEmailRunBatchEmailOnlySendsWithSnapshotAndRecipientUnsubscribe(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	emailOnlyAddress := "snapshot-only@example.com"
	require.NoError(t, model.DB.Delete(&model.User{}, fixture.user.Id).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"user_id":           0,
		"email_snapshot":    emailOnlyAddress,
		"language_snapshot": "",
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	require.NoError(t, model.DB.Create(&model.TopUp{UserId: 0, TradeNo: "email-only-noise", Status: common.TopUpStatusSuccess, CompleteTime: fixture.recipient.CreatedAt + 1}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 0, Type: model.LogTypeConsume, CreatedAt: fixture.recipient.CreatedAt + 1}).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Len(t, *fixture.sent, 1)
	sent := (*fixture.sent)[0]
	require.Equal(t, emailOnlyAddress, sent.receiver)
	require.Equal(t, "Return stage 1", sent.subject)
	require.Contains(t, sent.htmlBody, "Hello ,")
	require.Contains(t, sent.htmlBody, "Offer body 1")
	require.Contains(t, sent.htmlBody, "Valid for: Top-ups: 10 USD; Subscriptions: Pro monthly (20 USD)")
	require.Contains(t, sent.htmlBody, "/console/topup?recall_claim=")
	require.Equal(t, fmt.Sprintf("<recall-%d-1@notify.example.com>", fixture.recipient.Id), sent.messageID)

	unsubscribeToken := recallEmailRawUnsubscribeToken(t, sent.htmlBody)
	requireRecallEmailUnsubscribePayload(t, unsubscribeToken, 2, 0, fixture.recipient.Id, fixture.recipient.PromotionExpiresAt)
	fixture.claims.now = func() time.Time { return time.Unix(recallEmailTestNow, 0).UTC() }
	require.NoError(t, fixture.claims.Unsubscribe(context.Background(), unsubscribeToken))

	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, fixture.recipient.Id).Error)
	require.Equal(t, model.RecallRecipientSuppressed, recipient.State)
	var message model.RecallMessage
	require.NoError(t, model.DB.First(&message, fixture.message.Id).Error)
	require.Equal(t, model.RecallMessageAccepted, message.State)
	require.NotNil(t, message.ClaimTokenHash)
	require.Equal(t, recallEmailHash(recallEmailRawClaim(t, sent.htmlBody)), *message.ClaimTokenHash)
}

func TestRecallEmailProcessLeasedEmailOnlyIgnoresFenceAPIActivityForUserZero(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"user_id":        0,
		"email_snapshot": "single-email-only@example.com",
	}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 0, Type: model.LogTypeConsume, CreatedAt: fixture.recipient.CreatedAt + 1}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, *fixture.sent, 1)
	require.Equal(t, "single-email-only@example.com", (*fixture.sent)[0].receiver)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
}

func TestRecallEmailEmailOnlyInvalidSnapshotCancelsWithoutSMTP(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Delete(&model.User{}, fixture.user.Id).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"user_id":        0,
		"email_snapshot": "Display Name <invalid@example.com>",
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageCancelled, stored.State)
	require.Equal(t, "email_unavailable", stored.LastErrorCode)
}

func TestRecallEmailBoundUserStillCancelsOnCurrentEmailMismatch(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("email", "changed@example.com").Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageCancelled, stored.State)
	require.Equal(t, "email_unavailable", stored.LastErrorCode)
}

func newRecallEmailFixture(t *testing.T, stageCount int, sender RecallEmailSender) recallEmailFixture {
	t.Helper()
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	setRecallEmailSMTPFrom(t, "mailer@notify.example.com")

	stages := make([]RecallEmailStage, 0, stageCount)
	for stageNo := 1; stageNo <= stageCount; stageNo++ {
		stages = append(stages, RecallEmailStage{
			StageNo: stageNo, DelaySeconds: int64(stageNo-1) * 600, TemplateVersion: 10 + stageNo,
			Templates: map[string]RecallEmailTemplate{
				"en": {Subject: fmt.Sprintf("Return stage %d", stageNo), BodyText: fmt.Sprintf("Offer body %d\nUse it soon", stageNo)},
				"zh": {Subject: "回来", BodyText: "优惠正文"},
			},
		})
	}
	emailJSON, err := common.Marshal(stages)
	require.NoError(t, err)
	productJSON, err := common.Marshal(RecallProductScope{
		TopUpPriceIDs:                []string{"price_top"},
		SubscriptionPriceIDs:         []string{"price_sub"},
		TopUpDisplaySnapshots:        []string{"10 USD"},
		SubscriptionDisplaySnapshots: []string{"Pro monthly (20 USD)"},
	})
	require.NoError(t, err)
	discountJSON, err := common.Marshal(RecallDiscountConfig{PercentOff: 20})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "email campaign", Status: model.RecallCampaignRunning, AudienceTemplate: "first_purchase", AudienceConfig: `{}`,
		ExecutionMode: "manual", CouponSource: "existing", StripeCouponId: "coupon_email", DiscountConfig: string(discountJSON),
		ProductScope: string(productJSON), PromotionValidSeconds: 3600, EmailSequenceConfig: string(emailJSON), EnrollmentLimit: 100, WorkerConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	user := model.User{Username: "recall-user", DisplayName: `Ada <admin>`, Password: "password123", Status: common.UserStatusEnabled, Email: "snapshot@example.com", EmailVerifiedAt: recallEmailTestNow - 100}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: user.Id, EligibilitySnapshot: `{}`, EmailSnapshot: user.Email, LanguageSnapshot: "en",
		State: model.RecallRecipientContacting, StripeCustomerId: "cus_email", PromotionCode: "PROMOCODE123", PromotionExpiresAt: recallEmailTestNow + 3600,
		CreatedAt: recallEmailTestNow - 3600,
	}
	promotionID := "promo_email"
	recipient.StripePromotionCodeId = &promotionID
	require.NoError(t, model.DB.Create(&recipient).Error)
	templateJSON, err := common.Marshal(stages[0].Templates)
	require.NoError(t, err)
	message := model.RecallMessage{
		RecipientId: recipient.Id, StageNo: 1, TemplateVersion: stages[0].TemplateVersion, TemplateSnapshot: string(templateJSON),
		ScheduledAt: recallEmailTestNow, State: model.RecallMessageLeased, LeaseOwner: "email-worker", LeaseExpiresAt: recallEmailTestNow + recallEmailLeaseSeconds,
	}
	require.NoError(t, model.DB.Create(&message).Error)

	now := time.Unix(recallEmailTestNow, 0).UTC()
	sent := make([]recallEmailSent, 0)
	if sender == nil {
		sender = func(subject, receiver, content, messageID string) error {
			sent = append(sent, recallEmailSent{subject: subject, receiver: receiver, htmlBody: content, messageID: messageID})
			return nil
		}
	}
	claims := NewRecallClaimService()
	claimRandom := make([]byte, 0, 36*16)
	for value := byte(1); value <= 16; value++ {
		claimRandom = append(claimRandom, bytes.Repeat([]byte{value}, 36)...)
	}
	claims.random = bytes.NewReader(claimRandom)
	audience := NewRecallAudienceSelector()
	audience.LogBatchSize = 2
	worker := NewRecallEmailWorker(sender, audience, claims, "email-worker")
	worker.now = func() time.Time { return now }
	return recallEmailFixture{worker: worker, claims: claims, campaign: campaign, user: user, recipient: recipient, message: message, sent: &sent, now: &now}
}

func setRecallEmailSMTPFrom(t *testing.T, sender string) {
	t.Helper()
	originalFrom := common.SMTPFrom
	originalAccount := common.SMTPAccount
	common.SMTPFrom = sender
	common.SMTPAccount = sender
	t.Cleanup(func() {
		common.SMTPFrom = originalFrom
		common.SMTPAccount = originalAccount
	})
}

func loadRecallEmailMessage(t *testing.T, recipientID int64, stageNo int) model.RecallMessage {
	t.Helper()
	var message model.RecallMessage
	require.NoError(t, model.DB.Where("recipient_id = ? AND stage_no = ?", recipientID, stageNo).First(&message).Error)
	return message
}

func loadRecallEmailMessageByID(t *testing.T, messageID int64) model.RecallMessage {
	t.Helper()
	var message model.RecallMessage
	require.NoError(t, model.DB.First(&message, messageID).Error)
	return message
}

func recallEmailRawClaim(t *testing.T, body string) string {
	t.Helper()
	match := regexp.MustCompile(`claim=([A-Za-z0-9_-]+)`).FindStringSubmatch(body)
	require.Len(t, match, 2)
	return match[1]
}

func recallEmailRawUnsubscribeToken(t *testing.T, body string) string {
	t.Helper()
	match := regexp.MustCompile(`token=([^"&]+)`).FindStringSubmatch(body)
	require.Len(t, match, 2)
	token, err := url.QueryUnescape(strings.ReplaceAll(match[1], "&amp;", "&"))
	require.NoError(t, err)
	return token
}

func requireRecallEmailUnsubscribePayload(t *testing.T, token string, version int, userID int, recipientID int64, expiresAt int64) {
	t.Helper()
	parts := strings.Split(token, ".")
	require.Len(t, parts, 2)
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	require.NoError(t, err)
	var payload struct {
		Version     int   `json:"v"`
		UserID      int   `json:"u"`
		RecipientID int64 `json:"r"`
		ExpiresAt   int64 `json:"e"`
	}
	require.NoError(t, json.Unmarshal(payloadJSON, &payload))
	require.Equal(t, version, payload.Version)
	require.Equal(t, userID, payload.UserID)
	require.Equal(t, recipientID, payload.RecipientID)
	require.Equal(t, expiresAt, payload.ExpiresAt)
}

func recallEmailHash(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(digest[:])
}

func newRecallEmailUncertainError(t *testing.T) error {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	require.NoError(t, listener.Close())

	originalServer := common.SMTPServer
	originalPort := common.SMTPPort
	originalSSL := common.SMTPSSLEnabled
	originalAccount := common.SMTPAccount
	originalFrom := common.SMTPFrom
	originalToken := common.SMTPToken
	common.SMTPServer = "127.0.0.1"
	common.SMTPPort = port
	common.SMTPSSLEnabled = false
	common.SMTPAccount = "mailer@notify.example.com"
	common.SMTPFrom = "mailer@notify.example.com"
	common.SMTPToken = "unused"
	err = common.SendEmailWithMessageID("subject", "user@example.com", "body", "<recall-1-1@notify.example.com>")
	common.SMTPServer = originalServer
	common.SMTPPort = originalPort
	common.SMTPSSLEnabled = originalSSL
	common.SMTPAccount = originalAccount
	common.SMTPFrom = originalFrom
	common.SMTPToken = originalToken
	require.Error(t, err)
	require.True(t, common.IsEmailSendUncertain(err))
	return err
}

func installRecallEmailOutcomeUpdateFailure(t *testing.T) {
	t.Helper()
	callbackName := fmt.Sprintf("test:fail_recall_email_outcome_%p", t)
	callbacks := model.DB.Callback().Update()
	require.NoError(t, callbacks.Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "RecallMessage" {
			tx.AddError(errors.New("injected recall email outcome persistence failure"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, callbacks.Remove(callbackName))
	})
}
