package service

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/textproto"
	"net/url"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const recallEmailTestNow int64 = 1_784_179_200

type recallEmailSent struct {
	config    common.SMTPConfig
	from      string
	subject   string
	receiver  string
	htmlBody  string
	messageID string
	options   common.EmailOptions
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

func TestRecallEmailRenderServicePolicyCannotRenderUnsubscribe(t *testing.T) {
	_, body, err := RenderRecallEmail(RecallEmailRenderInput{
		CampaignType:       model.RecallCampaignTypeContentOnly,
		DeliveryPolicy:     model.RecallDeliveryPolicyService,
		Language:           "en",
		Template:           RecallEmailTemplate{Subject: "Service notice", BodyText: "Account notice"},
		RecipientName:      "Ada",
		UnsubscribeURL:     "https://console.example.com/api/recall/unsubscribe?token=service",
		IncludeUnsubscribe: true,
	})
	require.NoError(t, err)
	require.NotContains(t, body, "/api/recall/unsubscribe")
	require.NotContains(t, body, "Unsubscribe</a>")

	_, _, err = RenderRecallEmail(RecallEmailRenderInput{
		CampaignType:   model.RecallCampaignTypeContentOnly,
		DeliveryPolicy: model.RecallDeliveryPolicyService,
		Language:       "en",
		Template: RecallEmailTemplate{
			Subject:  "Service HTML",
			BodyHTML: `<!doctype html><html><body><p>Hello {{.RecipientName}}</p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></body></html>`,
		},
		RecipientName:  "Ada",
		UnsubscribeURL: "https://console.example.com/api/recall/unsubscribe?token=service",
	})
	require.ErrorContains(t, err, "UnsubscribeURL")

	_, body, err = RenderRecallEmail(RecallEmailRenderInput{
		CampaignType:   model.RecallCampaignTypeContentOnly,
		DeliveryPolicy: model.RecallDeliveryPolicyEngagement,
		Language:       "en",
		Template: RecallEmailTemplate{
			Subject:  "Engagement HTML",
			BodyHTML: `<!doctype html><html><body><p>Hello {{.RecipientName}}</p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></body></html>`,
		},
		RecipientName:  "Ada",
		UnsubscribeURL: "https://console.example.com/api/recall/unsubscribe?token=engagement",
	})
	require.NoError(t, err)
	require.Contains(t, body, "/api/recall/unsubscribe")
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
	require.Zero(t, stored.AttemptCount)
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
	require.Zero(t, stored.AttemptCount)
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
	messageID, err := recallEmailMessageID(42, 3, "notify.example.com")
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

func TestRecallEmailStageOffsetsAreAbsoluteFromFirstSMTPAcceptance(t *testing.T) {
	stages := []RecallEmailStage{
		{StageNo: 1, DelaySeconds: 0, TemplateVersion: 21, Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Stage 1", BodyText: "Body 1"},
		}},
		{StageNo: 2, DelaySeconds: 24 * 60 * 60, TemplateVersion: 22, Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Stage 2", BodyText: "Body 2"},
		}},
		{StageNo: 3, DelaySeconds: 4 * 24 * 60 * 60, TemplateVersion: 23, Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Stage 3", BodyText: "Body 3"},
		}},
	}
	emailJSON, err := common.Marshal(stages)
	require.NoError(t, err)
	firstAcceptedAt := int64(recallEmailTestNow)
	item := &model.RecallEmailWorkItem{
		Campaign:  model.RecallCampaign{EmailSequenceConfig: string(emailJSON)},
		Recipient: model.RecallRecipient{},
		Message:   model.RecallMessage{StageNo: 1},
	}

	stageTwo, err := nextRecallEmailMessage(item, firstAcceptedAt)
	require.NoError(t, err)
	require.NotNil(t, stageTwo)
	require.Equal(t, firstAcceptedAt+24*60*60, stageTwo.ScheduledAt)

	stageTwoAcceptedAt := firstAcceptedAt + 2*24*60*60
	item.Recipient.FirstSentAt = firstAcceptedAt
	item.Message.StageNo = 2
	stageThree, err := nextRecallEmailMessage(item, stageTwoAcceptedAt)
	require.NoError(t, err)
	require.NotNil(t, stageThree)
	require.Equal(t, firstAcceptedAt+4*24*60*60, stageThree.ScheduledAt)
	require.NotEqual(t, stageTwoAcceptedAt+4*24*60*60, stageThree.ScheduledAt)
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
	fixture.worker.sender = func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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

func TestRecallEmailTypedSMTPPreDataFailureRetriesWithNewClaimHash(t *testing.T) {
	calls := 0
	messageIDs := make([]string, 0, 2)
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		calls++
		messageIDs = append(messageIDs, messageID)
		if calls == 1 {
			return &textproto.Error{Code: 421, Msg: "temporary MAIL FROM rejection"}
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
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.changed.example.com", Port: 2525, Account: "changed@example.com", From: "mailer@changed.example.com", Token: "changed-secret",
	})

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

func TestRecallEmailPreSendRetryableFailureUsesDurableCounterAndStops(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	productJSON, err := common.Marshal(RecallProductScope{SubscriptionPriceIDs: []string{"price_sub"}})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", fixture.campaign.Id).
		Update("product_scope", string(productJSON)).Error)
	callbackName := "recall_email_pre_send_retry_bound"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "subscription_plans" {
			tx.AddError(errors.New("temporary subscription plan lookup failure"))
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	messageID := fixture.message.Id
	for attempt := 1; attempt <= recallEmailMaxAttempts; attempt++ {
		attemptStartedAt := fixture.now.Unix()
		require.NoError(t, fixture.worker.ProcessLeased(context.Background(), messageID))
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Zero(t, stored.AttemptCount)
		require.Equal(t, attempt, stored.PreSendAttemptCount)
		if attempt == recallEmailMaxAttempts {
			require.Equal(t, model.RecallMessageFailed, stored.State)
			require.Zero(t, stored.NextAttemptAt)
			break
		}
		require.Equal(t, model.RecallMessageRetryWait, stored.State)
		require.Equal(t, attemptStartedAt+int64(recallSMTPRetryDelays[attempt-1]/time.Second), stored.NextAttemptAt)
		*fixture.now = time.Unix(stored.NextAttemptAt, 0).UTC()
		won, err := model.LeaseRecallMessage(stored.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
		require.NoError(t, err)
		require.True(t, won)
	}
}

func TestRecallEmailPreSendRetryDoesNotConsumeExistingSMTPAttemptBudget(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("attempt_count", recallEmailMaxAttempts-1).Error)
	productJSON, err := common.Marshal(RecallProductScope{SubscriptionPriceIDs: []string{"price_sub"}})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).
		Where("id = ?", fixture.campaign.Id).
		Update("product_scope", string(productJSON)).Error)
	failProductLookup := true
	callbackName := "recall_email_pre_send_retry_independent_from_smtp_attempts"
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if failProductLookup && tx.Statement.Table == "subscription_plans" {
			tx.AddError(errors.New("temporary subscription plan lookup failure"))
		}
	}))
	t.Cleanup(func() { _ = model.DB.Callback().Query().Remove(callbackName) })

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	first := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageRetryWait, first.State)
	require.Equal(t, recallEmailMaxAttempts-1, first.AttemptCount)
	require.Equal(t, 1, first.PreSendAttemptCount)
	require.Equal(t, recallEmailTestNow+30, first.NextAttemptAt)
	require.Empty(t, *fixture.sent)

	failProductLookup = false
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Title:         "Pro monthly",
		PriceAmount:   20,
		Currency:      "USD",
		Enabled:       true,
		StripePriceId: "price_sub",
	}).Error)
	*fixture.now = time.Unix(first.NextAttemptAt, 0).UTC()
	won, err := model.LeaseRecallMessage(first.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), first.Id))

	accepted := loadRecallEmailMessageByID(t, first.Id)
	require.Equal(t, model.RecallMessageAccepted, accepted.State)
	require.Equal(t, recallEmailMaxAttempts, accepted.AttemptCount)
	require.Zero(t, accepted.PreSendAttemptCount)
	require.Len(t, *fixture.sent, 1)
}

func TestRecallEmailRetryDelayIsBoundedExponential(t *testing.T) {
	require.Equal(t, 30*time.Second, recallEmailRetryDelay(1))
	require.Equal(t, 60*time.Second, recallEmailRetryDelay(2))
	require.Equal(t, 120*time.Second, recallEmailRetryDelay(3))
	require.Equal(t, 240*time.Second, recallEmailRetryDelay(4))
	require.Equal(t, time.Duration(0), recallEmailRetryDelay(5))
	require.Equal(t, time.Duration(0), recallEmailRetryDelay(20))
}

func TestRecallEmailRetryableSMTPFailureSchedulesExactDelaySlotsThenStops(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		return &textproto.Error{Code: 421, Msg: "service temporarily unavailable"}
	})
	messageID := fixture.message.Id
	for attempt := 1; attempt <= recallEmailMaxAttempts; attempt++ {
		attemptStartedAt := fixture.now.Unix()
		require.NoError(t, fixture.worker.ProcessLeased(context.Background(), messageID))
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Equal(t, attempt, stored.AttemptCount)
		if attempt == recallEmailMaxAttempts {
			require.Equal(t, model.RecallMessageFailed, stored.State)
			require.Zero(t, stored.NextAttemptAt)
			break
		}
		require.Equal(t, model.RecallMessageRetryWait, stored.State)
		require.Equal(t, attemptStartedAt+int64(recallSMTPRetryDelays[attempt-1]/time.Second), stored.NextAttemptAt)
		*fixture.now = time.Unix(stored.NextAttemptAt, 0).UTC()
		won, err := model.LeaseRecallMessage(stored.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
		require.NoError(t, err)
		require.True(t, won)
	}
	due, err := model.ListDueRecallMessageIDs(fixture.now.Add(24*time.Hour).Unix(), 10)
	require.NoError(t, err)
	require.NotContains(t, due, messageID)
}

func TestRecallEmailPermanentSMTPFailureStopsImmediately(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		return &textproto.Error{Code: 550, Msg: "mailbox unavailable snapshot@example.com"}
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageFailed, stored.State)
	require.Equal(t, 1, stored.AttemptCount)
	require.Zero(t, stored.NextAttemptAt)
	require.Equal(t, RecallActivitySMTPSendFailedCode, stored.LastErrorCode)
	require.Equal(t, RecallActivitySMTPSendFailedMessage, stored.LastErrorMessage)
	due, err := model.ListDueRecallMessageIDs(recallEmailTestNow+24*3600, 10)
	require.NoError(t, err)
	require.NotContains(t, due, stored.Id)
}

func TestRecallEmailSMTPOutcomeLogsOncePerDurableOutcome(t *testing.T) {
	tests := []struct {
		name        string
		senderErr   error
		wantState   string
		wantOutcome string
	}{
		{
			name:        "accepted",
			wantState:   model.RecallMessageAccepted,
			wantOutcome: "accepted",
		},
		{
			name:        "retryable",
			senderErr:   &textproto.Error{Code: 421, Msg: "service temporarily unavailable"},
			wantState:   model.RecallMessageRetryWait,
			wantOutcome: "retryable",
		},
		{
			name:        "permanent",
			senderErr:   &textproto.Error{Code: 550, Msg: "mailbox unavailable snapshot@example.com"},
			wantState:   model.RecallMessageFailed,
			wantOutcome: "permanent",
		},
		{
			name:        "uncertain",
			senderErr:   recallSMTPUncertainError{err: errors.New("connection reset after DATA")},
			wantState:   model.RecallMessageUncertain,
			wantOutcome: "uncertain",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			originalSysLog := recallSMTPOutcomeSysLog
			var logs []string
			recallSMTPOutcomeSysLog = func(message string) {
				logs = append(logs, message)
			}
			t.Cleanup(func() {
				recallSMTPOutcomeSysLog = originalSysLog
			})
			fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
				return testCase.senderErr
			})

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			stored := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.Equal(t, testCase.wantState, stored.State)
			require.Equal(t, []string{
				"recall smtp attempt outcome outcome=" + testCase.wantOutcome + " scope=process payload=none",
			}, logs)
		})
	}
}

func TestRecallEmailUncertainOutcomeIsNeverAutomaticallyRetried(t *testing.T) {
	uncertainErr := newRecallEmailUncertainError(t)
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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
			fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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
	fixture = newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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
			fixture = newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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

func TestRecallEmailRunBatchBatchesInitialAPIActivityLookup(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	fixture.worker.audience.LogBatchSize = 10
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	addRecallEmailBatchMessage(t, fixture, "activity-batch-2", recallEmailTestNow)
	addRecallEmailBatchMessage(t, fixture, "activity-batch-3", recallEmailTestNow)

	queryCount := 0
	callbackName := "recall_email_activity_query_count_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.LOG_DB.Callback().Row().After("gorm:row").Register(callbackName, func(tx *gorm.DB) {
		if strings.Contains(tx.Statement.SQL.String(), "MAX(created_at)") {
			queryCount++
		}
	}))
	t.Cleanup(func() { _ = model.LOG_DB.Callback().Row().Remove(callbackName) })

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.NoError(t, err)
	require.Equal(t, 3, processed)
	require.Len(t, *fixture.sent, 3)
	require.Equal(t, 4, queryCount, "one initial batch lookup plus one final send fence per message")
}

func TestRecallEmailRunBatchReleasesLeasesWhenInitialActivityLookupFails(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "activity-error-2", recallEmailTestNow)

	expectedErr := errors.New("activity lookup failed")
	callbackName := "recall_email_activity_lookup_failure_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.LOG_DB.Callback().Row().Before("gorm:row").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "Log" {
			return
		}
		tx.AddError(expectedErr)
	}))
	t.Cleanup(func() { _ = model.LOG_DB.Callback().Row().Remove(callbackName) })

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.ErrorIs(t, err, expectedErr)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	for _, messageID := range []int64{fixture.message.Id, secondMessage.Id} {
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Equal(t, model.RecallMessageScheduled, stored.State)
		require.Empty(t, stored.LeaseOwner)
		require.Zero(t, stored.LeaseExpiresAt)
	}
}

func TestRecallEmailRunBatchReleasesLeasesAfterContextCancellation(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "activity-cancel-2", recallEmailTestNow)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	callbackName := "recall_email_activity_cancel_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.LOG_DB.Callback().Row().After("gorm:row").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement == nil || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "Log" {
			return
		}
		cancel()
	}))
	t.Cleanup(func() { _ = model.LOG_DB.Callback().Row().Remove(callbackName) })

	processed, err := fixture.worker.RunBatch(ctx, 10)

	require.ErrorIs(t, err, context.Canceled)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	for _, messageID := range []int64{fixture.message.Id, secondMessage.Id} {
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Equal(t, model.RecallMessageScheduled, stored.State)
		require.Empty(t, stored.LeaseOwner)
		require.Zero(t, stored.LeaseExpiresAt)
	}
}

func TestRecallEmailWorkerStopsAtSharedHourlyLimit(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 2)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	messages := []model.RecallMessage{fixture.message}
	for i := 2; i <= 4; i++ {
		_, _, message := addRecallEmailBatchMessage(t, fixture, fmt.Sprintf("quota-%d", i), recallEmailTestNow)
		messages = append(messages, message)
	}
	for i := 0; i < 2; i++ {
		_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 2)
		require.NoError(t, err)
		require.True(t, reserved)
	}

	processed, err := fixture.worker.RunBatch(context.Background(), 10)
	var waitErr *RecallEmailQuotaWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)

	for _, message := range messages {
		stored := loadRecallEmailMessageByID(t, message.Id)
		require.Equal(t, model.RecallMessageScheduled, stored.State)
		require.Zero(t, stored.NextAttemptAt)
		require.Zero(t, stored.AttemptCount)
		require.Empty(t, stored.LeaseOwner)
		require.Zero(t, stored.LeaseExpiresAt)
	}
	status, statusErr := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 2)
	require.NoError(t, statusErr)
	require.Equal(t, 2, status.Used)
	require.True(t, status.Exhausted)
}

func TestRecallEmailRunBatchDoesNotChurnExpiredLeaseWhileQuotaIsExhausted(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)
	expiredLease := recallEmailTestNow - 30
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageLeased,
		"lease_owner":      "expired-owner",
		"lease_expires_at": expiredLease,
	}).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailQuotaWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageLeased, stored.State)
	require.Equal(t, "expired-owner", stored.LeaseOwner)
	require.Equal(t, expiredLease, stored.LeaseExpiresAt)
}

func TestRecallMaintenanceTreatsEmailQuotaWaitAsBackpressure(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(NewRecallAudienceSelector(), NewRecallStripeService(&recallStripeFakeClient{})),
		Claims:     fixture.claims,
		Recipients: NewRecallRecipientWorker(NewRecallStripeService(&recallStripeFakeClient{}), fixture.claims, fixture.worker.owner),
		Emails:     fixture.worker,
	})

	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})

	RunRecallMaintenanceTick(context.Background())

	require.NotContains(t, logOutput.String(), "recall email maintenance failed")
}

func TestRecallMaintenanceTreatsEmailPacingWaitAsBackpressure(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 180)
	pacingStatus, err := model.GetRecallEmailPacingStatusWithContext(context.Background(), 180)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.RecallEmailPacingState{
		Scope:               pacingStatus.Scope,
		LastStartedAtMillis: pacingStatus.CheckedAtMillis,
	}).Error)
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(NewRecallAudienceSelector(), NewRecallStripeService(&recallStripeFakeClient{})),
		Claims:     fixture.claims,
		Recipients: NewRecallRecipientWorker(NewRecallStripeService(&recallStripeFakeClient{}), fixture.claims, fixture.worker.owner),
		Emails:     fixture.worker,
	})

	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})

	RunRecallMaintenanceTick(context.Background())

	require.NotContains(t, logOutput.String(), "recall email maintenance failed")
}

func TestRecallEmailRunBatchReturnsPacingWaitBeforeLeasing(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 180)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	pacingStatus, err := model.GetRecallEmailPacingStatusWithContext(context.Background(), 180)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.RecallEmailPacingState{
		Scope:               pacingStatus.Scope,
		LastStartedAtMillis: pacingStatus.CheckedAtMillis,
	}).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailPacingWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Greater(t, waitErr.NextAllowedAtMillis, pacingStatus.CheckedAtMillis)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageScheduled, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallEmailRunBatchSendsAtMostOneMessagePerPacingSlot(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 180)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "pacing-slot-second", recallEmailTestNow)
	_, _, thirdMessage := addRecallEmailBatchMessage(t, fixture, "pacing-slot-third", recallEmailTestNow)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailPacingWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Equal(t, 1, len(*fixture.sent))
	require.Equal(t, 1, processed)
	nextAllowedAt := (waitErr.NextAllowedAtMillis + 999) / 1000
	secondStored := loadRecallEmailMessageByID(t, secondMessage.Id)
	thirdStored := loadRecallEmailMessageByID(t, thirdMessage.Id)
	require.Equal(t, model.RecallMessageRetryWait, secondStored.State)
	require.Equal(t, nextAllowedAt, secondStored.NextAttemptAt)
	require.Equal(t, model.RecallMessageRetryWait, thirdStored.State)
	// The remainder is staggered one pacing slot apart so a single slot does not
	// wake every deferred message at once.
	require.Equal(t, nextAllowedAt+20, thirdStored.NextAttemptAt)
}

func TestRecallEmailRunBatchPostLeasePacingRaceUsesPreciseNextTime(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 180)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "pacing-race-second", recallEmailTestNow)
	var precheck model.RecallEmailPacingStatus
	var err error
	precheck, err = model.GetRecallEmailPacingStatusWithContext(context.Background(), 180)
	require.NoError(t, err)

	var raceInjected bool
	updateCallbacks := model.DB.Callback().Update()
	injectPacingRaceCallback := "recall_email_inject_pacing_race_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, updateCallbacks.Before("gorm:update").Register(injectPacingRaceCallback, func(tx *gorm.DB) {
		if raceInjected || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallEmailPacingState" {
			return
		}
		raceInjected = true
		if err := tx.Session(&gorm.Session{NewDB: true}).Model(&model.RecallEmailPacingState{}).
			Where("scope = ?", precheck.Scope).
			Update("last_started_at_millis", precheck.CheckedAtMillis).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { _ = updateCallbacks.Remove(injectPacingRaceCallback) })

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailPacingWaitError
	require.ErrorAs(t, err, &waitErr)
	require.True(t, raceInjected)
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	require.Equal(t, precheck.CheckedAtMillis+20_000, waitErr.NextAllowedAtMillis)
	nextAllowedAt := (waitErr.NextAllowedAtMillis + 999) / 1000
	firstStored := loadRecallEmailMessageByID(t, fixture.message.Id)
	secondStored := loadRecallEmailMessageByID(t, secondMessage.Id)
	require.Equal(t, model.RecallMessageRetryWait, firstStored.State)
	require.Equal(t, nextAllowedAt, firstStored.NextAttemptAt)
	require.Equal(t, model.RecallMessageRetryWait, secondStored.State)
	// The remainder is staggered one pacing slot apart so a single slot does not
	// wake every deferred message at once.
	require.Equal(t, nextAllowedAt+20, secondStored.NextAttemptAt)
}

func TestRecallEmailRunBatchStaggersRemainingRetryAcrossPacingSlots(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailPacing(t, 180, 3600)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "pacing-stagger-second", recallEmailTestNow)
	_, _, thirdMessage := addRecallEmailBatchMessage(t, fixture, "pacing-stagger-third", recallEmailTestNow)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailPacingWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Equal(t, 1, processed)
	require.Len(t, *fixture.sent, 1)
	// Deferred messages must not all become due in the same second, or every
	// replica re-leases the whole remainder at once each slot.
	secondStored := loadRecallEmailMessageByID(t, secondMessage.Id)
	thirdStored := loadRecallEmailMessageByID(t, thirdMessage.Id)
	require.Equal(t, model.RecallMessageRetryWait, secondStored.State)
	require.Equal(t, model.RecallMessageRetryWait, thirdStored.State)
	require.NotEqual(t, secondStored.NextAttemptAt, thirdStored.NextAttemptAt)
	require.Equal(t, int64(20), thirdStored.NextAttemptAt-secondStored.NextAttemptAt)
}

func TestRecallEmailRunBatchStaggerLimitsReleasesPerFollowUpSlot(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailPacing(t, 180, 3600)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageScheduled,
		"lease_owner":      "",
		"lease_expires_at": int64(0),
	}).Error)
	for i := 2; i <= 6; i++ {
		addRecallEmailBatchMessage(t, fixture, fmt.Sprintf("pacing-slot-spread-%d", i), recallEmailTestNow)
	}

	_, err := fixture.worker.RunBatch(context.Background(), 10)

	var waitErr *RecallEmailPacingWaitError
	require.ErrorAs(t, err, &waitErr)
	var deferred []model.RecallMessage
	require.NoError(t, model.DB.Where("state = ?", model.RecallMessageRetryWait).Find(&deferred).Error)
	require.Len(t, deferred, 5)
	// Each follow-up slot must wake at most one message; otherwise every
	// replica re-leases the whole remainder every slot and burns two
	// recall_events rows per message per round.
	countByDueAt := make(map[int64]int, len(deferred))
	for _, message := range deferred {
		countByDueAt[message.NextAttemptAt]++
	}
	require.Len(t, countByDueAt, len(deferred))
	for dueAt, count := range countByDueAt {
		require.Equal(t, 1, count, "slot %d must wake exactly one message", dueAt)
	}
}

func TestRecallMaintenanceLogsQuotaWaitWithLeaseCleanupFailure(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 2)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "quota-cleanup-failure", recallEmailTestNow)
	quotaStatus, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 2)
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.RecallEmailQuotaWindow{WindowStartedAt: quotaStatus.WindowStartedAt}).Error)
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(NewRecallAudienceSelector(), NewRecallStripeService(&recallStripeFakeClient{})),
		Claims:     fixture.claims,
		Recipients: NewRecallRecipientWorker(NewRecallStripeService(&recallStripeFakeClient{}), fixture.claims, fixture.worker.owner),
		Emails:     fixture.worker,
	})

	var quotaRaceInjected bool
	updateCallbacks := model.DB.Callback().Update()
	injectQuotaRaceCallback := "recall_email_inject_quota_race_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, updateCallbacks.Before("gorm:update").Register(injectQuotaRaceCallback, func(tx *gorm.DB) {
		if quotaRaceInjected || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" || recallEmailUpdateState(tx) != model.RecallMessageSending {
			return
		}
		quotaRaceInjected = true
		if err := tx.Session(&gorm.Session{NewDB: true}).Model(&model.RecallEmailQuotaWindow{}).
			Where("window_started_at = ?", quotaStatus.WindowStartedAt).
			Update("attempts", 2).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { _ = updateCallbacks.Remove(injectQuotaRaceCallback) })
	recallMessageUpdatesAfterQuotaRace := 0
	failRemainingReleaseCallback := "recall_email_fail_remaining_release_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, updateCallbacks.Before("gorm:update").Register(failRemainingReleaseCallback, func(tx *gorm.DB) {
		if !quotaRaceInjected || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" {
			return
		}
		if recallEmailUpdateState(tx) != model.RecallMessageRetryWait {
			return
		}
		recallMessageUpdatesAfterQuotaRace++
		tx.AddError(errors.New("injected release remaining recall email lease failure"))
	}))
	t.Cleanup(func() { _ = updateCallbacks.Remove(failRemainingReleaseCallback) })

	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})

	RunRecallMaintenanceTick(context.Background())

	firstStored := loadRecallEmailMessageByID(t, fixture.message.Id)
	secondStored := loadRecallEmailMessageByID(t, secondMessage.Id)
	require.Contains(t, logOutput.String(), "recall email maintenance failed", "quotaRaceInjected=%v updatesAfterQuotaRace=%d first=%s second=%s", quotaRaceInjected, recallMessageUpdatesAfterQuotaRace, firstStored.State, secondStored.State)
	require.Contains(t, logOutput.String(), "release remaining recall email leases")
	require.Contains(t, logOutput.String(), "injected release remaining recall email lease failure")
	require.True(t, quotaRaceInjected)
	require.Equal(t, 1, recallMessageUpdatesAfterQuotaRace)
	require.Equal(t, model.RecallMessageLeased, secondStored.State)
}

func recallEmailUpdateState(tx *gorm.DB) string {
	updates, ok := tx.Statement.Dest.(map[string]any)
	if !ok {
		return ""
	}
	state, _ := updates["state"].(string)
	return state
}

func TestRecallEmailProcessLeasedDefersOwnedLeaseUntilQuotaReset(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)

	err = fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	var waitErr *RecallEmailQuotaWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageLeased, stored.State)
	require.Equal(t, fixture.worker.owner, stored.LeaseOwner)
	require.Equal(t, waitErr.ResetsAt, stored.LeaseExpiresAt)
}

func TestRecallEmailProcessLeasedShortensOwnedLeaseToEarlierQuotaReset(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)
	farFutureLease := recallEmailTestNow + 30*24*3600
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).
		Update("lease_expires_at", farFutureLease).Error)

	err = fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	var waitErr *RecallEmailQuotaWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Less(t, waitErr.ResetsAt, farFutureLease)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, waitErr.ResetsAt, stored.LeaseExpiresAt)
}

func TestRecallEmailExpiredLeaseDefersUntilQuotaResetAfterConcurrentExhaustion(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	expiredLease := recallEmailTestNow - 30
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state":            model.RecallMessageLeased,
		"lease_owner":      "expired-owner",
		"lease_expires_at": expiredLease,
	}).Error)
	candidates, err := model.ListDueRecallMessages(recallEmailTestNow, 1)
	require.NoError(t, err)
	require.Len(t, candidates, 1)
	leaseUntil := recallEmailTestNow + recallEmailLeaseSeconds
	won, err := model.LeaseDueRecallMessage(candidates[0], fixture.worker.owner, recallEmailTestNow, leaseUntil)
	require.NoError(t, err)
	require.True(t, won)
	item, err := model.GetRecallEmailWorkItemForLeaseEpochWithContext(
		context.Background(), fixture.message.Id, fixture.worker.owner, leaseUntil,
	)
	require.NoError(t, err)
	_, reserved, err := model.ReserveRecallEmailQuotaWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.True(t, reserved)

	err = fixture.worker.processLeasedItem(context.Background(), item, false, &candidates[0], common.SMTPConfig{
		Server: "smtp.activity.example.com", Port: 587, Account: "activity@example.com", From: "mailer@notify.example.com", Token: "activity-secret",
	})

	var waitErr *RecallEmailQuotaWaitError
	require.ErrorAs(t, err, &waitErr)
	require.Greater(t, waitErr.ResetsAt, leaseUntil)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageRetryWait, stored.State)
	require.Equal(t, waitErr.ResetsAt, stored.NextAttemptAt)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallEmailWorkerPreSMTPCancellationDoesNotConsumeQuota(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)
	settingJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("setting", string(settingJSON)).Error)
	_, _, validMessage := addRecallEmailBatchMessage(t, fixture, "after-opt-out", recallEmailTestNow)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Empty(t, *fixture.sent)
	require.Equal(t, model.RecallMessageCancelled, loadRecallEmailMessageByID(t, fixture.message.Id).State)
	require.Equal(t, model.RecallMessageScheduled, loadRecallEmailMessageByID(t, validMessage.Id).State)
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, status.Used)
}

func TestRecallEmailWorkerPersistentExclusionCancelsWithoutSMTP(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 1)
	require.NoError(t, model.DB.Create(&model.RecallCampaignExclusion{
		CampaignId: fixture.campaign.Id, RecipientIdentity: model.RecallRecipientIdentityForUser(fixture.user.Id), UserId: fixture.user.Id,
		Persistent: true, PersistentReasonCode: "operator_csv",
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageCancelled, stored.State)
	require.Equal(t, "operator_csv", stored.LastErrorCode)
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, status.Used)
}

func TestRecallEmailWorkerSenderInvalidStopsBeforeLeaseAndQuota(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	clearRecallActivitySMTP(t)
	setRecallEmailHourlyLimit(t, 5)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.ErrorContains(t, err, "activity_smtp_not_configured")
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageScheduled, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
	status, statusErr := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, statusErr)
	require.Zero(t, status.Used)
}

func TestRecallEmailWorkerActivitySMTPMissingIgnoresGlobalSMTPBeforeDueWork(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	clearRecallActivitySMTP(t)
	setRecallEmailHourlyLimit(t, 5)
	originalServer := common.SMTPServer
	originalPort := common.SMTPPort
	originalAccount := common.SMTPAccount
	originalFrom := common.SMTPFrom
	originalToken := common.SMTPToken
	t.Cleanup(func() {
		common.SMTPServer = originalServer
		common.SMTPPort = originalPort
		common.SMTPAccount = originalAccount
		common.SMTPFrom = originalFrom
		common.SMTPToken = originalToken
	})
	common.SMTPServer = "smtp.transactional.example.com"
	common.SMTPPort = 587
	common.SMTPAccount = "transactional@example.com"
	common.SMTPFrom = "transactional@example.com"
	common.SMTPToken = "transactional-secret"
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)

	messageQueries := 0
	callbackName := "recall_email_missing_activity_smtp_no_due_query_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Schema != nil && tx.Statement.Schema.Name == "RecallMessage" {
			messageQueries++
		}
	}))

	processed, err := fixture.worker.RunBatch(context.Background(), 10)
	require.NoError(t, model.DB.Callback().Query().Remove(callbackName))

	require.ErrorContains(t, err, "activity_smtp_not_configured")
	require.Zero(t, processed)
	require.Empty(t, *fixture.sent)
	require.Zero(t, messageQueries)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageScheduled, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
	status, statusErr := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, statusErr)
	require.Zero(t, status.Used)
}

func TestRecallEmailProcessLeasedActivitySMTPMissingFailsBeforeDBWork(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	clearRecallActivitySMTP(t)
	callbackName := "recall_email_process_missing_activity_smtp_no_db_" + strings.ReplaceAll(t.Name(), "/", "_")
	require.NoError(t, model.DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement != nil && tx.Statement.Schema != nil && tx.Statement.Schema.Name == "RecallMessage" {
			tx.AddError(errors.New("recall message DB query happened before Activity SMTP preflight"))
		}
	}))
	defer func() { _ = model.DB.Callback().Query().Remove(callbackName) }()

	err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	require.ErrorContains(t, err, "activity_smtp_not_configured")
	require.Empty(t, *fixture.sent)
}

func TestRecallEmailWorkerSenderSnapshotUsesLatestActivityFrom(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.alerts.example.com", Port: 2525, Account: "alerts@example.com", From: "alerts@example.com", Token: "alerts-secret",
	})
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0),
	}).Error)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Len(t, *fixture.sent, 1)
	sent := (*fixture.sent)[0]
	require.Equal(t, "alerts@example.com", sent.from)
	require.Equal(t, fmt.Sprintf("<recall-%d-1@example.com>", fixture.recipient.Id), sent.messageID)
	require.Equal(t, "smtp.alerts.example.com", sent.config.Server)
	require.Equal(t, 2525, sent.config.Port)
	require.Equal(t, "alerts@example.com", sent.config.Account)
	require.Equal(t, "alerts-secret", sent.config.Token)
}

func TestRecallEmailWorkerActivitySMTPConfigIsFreshAndControlsMessageIDDomain(t *testing.T) {
	configs := make([]common.SMTPConfig, 0, 2)
	fixture := newRecallEmailFixture(t, 1, func(config common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		configs = append(configs, config)
		return nil
	})
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.first.example.com", Port: 2525, Account: "first@example.com", From: "first@first.example.com", Token: "first-secret",
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	accepted := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageAccepted, accepted.State)
	require.Equal(t, fmt.Sprintf("<recall-%d-1@first.example.com>", fixture.recipient.Id), accepted.ProviderMessageId)
	require.Len(t, configs, 1)
	require.Equal(t, "smtp.first.example.com", configs[0].Server)
	require.Equal(t, "first-secret", configs[0].Token)

	second := model.RecallMessage{
		RecipientId: fixture.recipient.Id, StageNo: 2, TemplateVersion: 11, TemplateSnapshot: fixture.message.TemplateSnapshot,
		ScheduledAt: recallEmailTestNow + 1, State: model.RecallMessageLeased, LeaseOwner: fixture.worker.owner, LeaseExpiresAt: recallEmailTestNow + 1 + recallEmailLeaseSeconds,
	}
	require.NoError(t, model.DB.Create(&second).Error)
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.second.example.com", Port: 465, Account: "second@example.com", From: "second@second.example.com", Token: "second-secret",
		SSLEnabled: true, ForceAuthLogin: true,
	})
	*fixture.now = time.Unix(recallEmailTestNow+1, 0).UTC()

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), second.Id))
	secondAccepted := loadRecallEmailMessageByID(t, second.Id)
	require.Equal(t, fmt.Sprintf("<recall-%d-2@second.example.com>", fixture.recipient.Id), secondAccepted.ProviderMessageId)
	require.Len(t, configs, 2)
	require.Equal(t, common.SMTPConfig{
		Server: "smtp.second.example.com", Port: 465, Account: "second@example.com", From: "second@second.example.com", Token: "second-secret",
		SSLEnabled: true, ForceAuthLogin: true,
	}, configs[1])
}

func TestRecallEmailRunBatchRefreshesActivitySMTPBeforeEachSend(t *testing.T) {
	firstConfig := common.SMTPConfig{
		Server: "smtp.first.example.com", Port: 2525, Account: "first@example.com", From: "first@first.example.com", Token: "first-secret",
	}
	secondConfig := common.SMTPConfig{
		Server: "smtp.second.example.com", Port: 2465, Account: "second@example.com", From: "second@second.example.com", Token: "second-secret",
		SSLEnabled: true, ForceAuthLogin: true,
	}
	sent := make([]recallEmailSent, 0, 2)
	fixture := newRecallEmailFixture(t, 1, func(config common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent = append(sent, recallEmailSent{config: config, from: config.From, subject: subject, receiver: receiver, htmlBody: content, messageID: messageID})
		if len(sent) == 1 {
			setValidRecallActivitySMTP(t, secondConfig)
		}
		return nil
	})
	setValidRecallActivitySMTP(t, firstConfig)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0), "provider_message_id": "",
	}).Error)
	_, secondRecipient, secondMessage := addRecallEmailBatchMessage(t, fixture, "smtp-refresh", recallEmailTestNow)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.NoError(t, err)
	require.Equal(t, 2, processed)
	require.Len(t, sent, 2)
	require.Equal(t, firstConfig, sent[0].config)
	require.Equal(t, fmt.Sprintf("<recall-%d-1@first.example.com>", fixture.recipient.Id), sent[0].messageID)
	require.Equal(t, secondConfig, sent[1].config)
	require.Equal(t, fmt.Sprintf("<recall-%d-1@second.example.com>", secondRecipient.Id), sent[1].messageID)
	require.Equal(t, sent[1].messageID, loadRecallEmailMessageByID(t, secondMessage.Id).ProviderMessageId)
}

func TestRecallEmailRunBatchReleasesRemainingWhenActivitySMTPBecomesInvalid(t *testing.T) {
	sent := 0
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent++
		if sent == 1 {
			clearRecallActivitySMTP(t)
		}
		return nil
	})
	setRecallEmailHourlyLimit(t, 5)
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.initial.example.com", Port: 2525, Account: "initial@example.com", From: "initial@initial.example.com", Token: "initial-secret",
	})
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"state": model.RecallMessageScheduled, "lease_owner": "", "lease_expires_at": int64(0), "provider_message_id": "",
	}).Error)
	_, _, secondMessage := addRecallEmailBatchMessage(t, fixture, "smtp-invalid-second", recallEmailTestNow)
	_, _, thirdMessage := addRecallEmailBatchMessage(t, fixture, "smtp-invalid-third", recallEmailTestNow)

	processed, err := fixture.worker.RunBatch(context.Background(), 10)

	require.ErrorContains(t, err, "activity_smtp_not_configured")
	require.Equal(t, 1, processed)
	require.Equal(t, 1, sent)
	status, statusErr := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, statusErr)
	require.Equal(t, 1, status.Used)
	for _, messageID := range []int64{secondMessage.Id, thirdMessage.Id} {
		stored := loadRecallEmailMessageByID(t, messageID)
		require.Equal(t, model.RecallMessageScheduled, stored.State)
		require.Empty(t, stored.LeaseOwner)
		require.Zero(t, stored.LeaseExpiresAt)
		require.Empty(t, stored.ProviderMessageId)
		require.Zero(t, stored.AttemptCount)
	}
}

func TestRecallEmailExistingProviderMessageIDSurvivesActivitySMTPConfigChange(t *testing.T) {
	messageID := "<persisted-id@old.example.com>"
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("provider_message_id", messageID).Error)
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server: "smtp.changed.example.com", Port: 587, Account: "changed@example.com", From: "changed@changed.example.com", Token: "changed-secret",
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageAccepted, stored.State)
	require.Equal(t, messageID, stored.ProviderMessageId)
	require.Len(t, *fixture.sent, 1)
	require.Equal(t, messageID, (*fixture.sent)[0].messageID)
}

func TestRecallEmailActivitySMTPRawProviderFailureStoresSafeUncertainMessage(t *testing.T) {
	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})
	fixture := newRecallEmailFixture(t, 1, func(config common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		return fmt.Errorf(
			"454 temporary lookup failure server=%s port=%d account=%s from=%s token=%s ssl_enabled=%t force_auth_login=%t after DATA %s",
			config.Server,
			config.Port,
			config.Account,
			config.From,
			config.Token,
			config.SSLEnabled,
			config.ForceAuthLogin,
			content,
		)
	})
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server:         "smtp.secret-activity.example.com",
		Port:           2465,
		Account:        "secret-account@example.com",
		From:           "secret-from@example.com",
		Token:          "activity-secret",
		SSLEnabled:     true,
		ForceAuthLogin: true,
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageUncertain, stored.State)
	require.Equal(t, "smtp_uncertain", stored.LastErrorCode)
	require.Empty(t, stored.LastErrorMessage)
	require.NotContains(t, stored.LastErrorMessage, "activity-secret")
	logged := logOutput.String()
	require.Contains(t, logged, "category=smtp_transport_error")
	require.Contains(t, logged, "ssl_enabled=true")
	require.Contains(t, logged, "force_auth_login=true")
	for _, sensitive := range []string{
		"454 temporary lookup failure",
		"smtp.secret-activity.example.com",
		"2465",
		"secret-account@example.com",
		"secret-from@example.com",
		"activity-secret",
		"server=smtp.secret-activity.example.com",
		"port=2465",
		"account=secret-account@example.com",
		"from=secret-from@example.com",
		"token=activity-secret",
	} {
		require.NotContains(t, logged, sensitive)
	}
	require.NotContains(t, logged, "activity-secret")
	require.NotContains(t, logged, "<!doctype html>")
	due, err := model.ListDueRecallMessageIDs(recallEmailTestNow+24*3600, 10)
	require.NoError(t, err)
	require.NotContains(t, due, stored.Id)
}

func TestRecallEmailActivitySMTPFailureLogOmitsTransportEchoedMessageData(t *testing.T) {
	var logOutput bytes.Buffer
	common.LogWriterMu.Lock()
	originalErrorWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logOutput
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalErrorWriter
		common.LogWriterMu.Unlock()
	})
	fixture := newRecallEmailFixture(t, 1, func(config common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		return fmt.Errorf(
			"550 rejected recipient %s subject %s Message-ID %s account %s token %s body snippet Offer body 1 html %s",
			receiver,
			subject,
			messageID,
			config.Account,
			config.Token,
			content,
		)
	})
	setValidRecallActivitySMTP(t, common.SMTPConfig{
		Server:         "smtp.secret-activity.example.com",
		Port:           2465,
		Account:        "secret-account@example.com",
		From:           "secret-from@example.com",
		Token:          "activity-secret",
		SSLEnabled:     true,
		ForceAuthLogin: true,
	})

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	logged := logOutput.String()
	require.Contains(t, logged, "recall activity SMTP delivery failed")
	require.Contains(t, logged, "category=smtp_transport_error")
	for _, sensitive := range []string{
		"snapshot@example.com",
		"Return stage 1",
		fmt.Sprintf("<recall-%d-1@example.com>", fixture.recipient.Id),
		"secret-account@example.com",
		"activity-secret",
		"Offer body 1",
		"<!doctype html>",
	} {
		require.NotContains(t, logged, sensitive)
	}
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageUncertain, stored.State)
	require.Equal(t, "smtp_uncertain", stored.LastErrorCode)
	require.Empty(t, stored.LastErrorMessage)
}

func TestRecallEmailActivitySMTPNonTLSCommandRejectionStoresDefiniteSafeFailure(t *testing.T) {
	for _, failAt := range []string{"AUTH", "MAIL", "RCPT"} {
		t.Run(failAt, func(t *testing.T) {
			port, wait := startRecallSMTPTestServer(t, failAt)
			fixture := newRecallEmailFixture(t, 1, common.SendEmailWithSMTPConfigAndOptions)
			setValidRecallActivitySMTP(t, common.SMTPConfig{
				Server:  "localhost",
				Port:    port,
				Account: "activity@example.com",
				From:    "activity@example.com",
				Token:   "activity-secret",
			})

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
			result := wait()

			stored := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.Equal(t, model.RecallMessageFailed, stored.State)
			require.Equal(t, RecallActivitySMTPSendFailedCode, stored.LastErrorCode)
			require.Equal(t, RecallActivitySMTPSendFailedMessage, stored.LastErrorMessage)
			require.NotContains(t, stored.LastErrorMessage, "activity-secret")
			require.Equal(t, []string{"EHLO", "AUTH", "MAIL", "RCPT"}[:len(result.commands)], recallSMTPCommandNames(result.commands))
		})
	}
}

func TestRecallEmailActivitySMTPPathDoesNotCallGlobalSendWrappers(t *testing.T) {
	source, err := os.ReadFile("recall_email.go")
	require.NoError(t, err)

	require.NotContains(t, string(source), "common.SendEmail(")
	require.NotContains(t, string(source), "common.SendEmailWithMessageID(")
	require.NotContains(t, string(source), "common.SendEmailFromWithMessageID(")
}

func TestRecallEmailWorkerRetryAndUncertainSendReserveNewSlots(t *testing.T) {
	uncertainErr := newRecallEmailUncertainError(t)
	calls := 0
	fixture := newRecallEmailFixture(t, 1, func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		calls++
		if calls == 1 {
			return &textproto.Error{Code: 421, Msg: "temporary MAIL FROM rejection"}
		}
		return uncertainErr
	})
	setRecallEmailHourlyLimit(t, 100000)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	first := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageRetryWait, first.State)
	*fixture.now = time.Unix(first.NextAttemptAt, 0).UTC()
	won, err := model.LeaseRecallMessage(first.Id, fixture.worker.owner, fixture.now.Unix(), fixture.now.Unix()+recallEmailLeaseSeconds)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), first.Id))

	stored := loadRecallEmailMessageByID(t, first.Id)
	require.Equal(t, model.RecallMessageUncertain, stored.State)
	require.Equal(t, 2, stored.AttemptCount)
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 100000)
	require.NoError(t, err)
	require.Equal(t, 2, status.Used)
}

func TestUnrelatedEmailSenderDoesNotReferenceRecallQuota(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	setRecallEmailHourlyLimit(t, 5)
	senderCalls := 0
	unrelatedSender := func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		senderCalls++
		return nil
	}

	require.NoError(t, unrelatedSender(common.SMTPConfig{From: "mailer@notify.example.com"}, "subject", "outside@example.com", "body", "<outside@notify.example.com>", common.EmailOptions{}))
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Zero(t, status.Used)

	fixture.worker.sender = unrelatedSender
	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
	status, err = model.GetRecallEmailQuotaStatusWithContext(context.Background(), 5)
	require.NoError(t, err)
	require.Equal(t, 1, status.Used)
	require.Equal(t, 2, senderCalls)
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
			fixture.worker.sender = func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
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

func TestRecallContentOnlyEmailSendsWithoutClaimOrPromotionData(t *testing.T) {
	fixture := newRecallEmailFixture(t, 2, nil)
	contentOnlyHTML := `<!doctype html>
<html><head><style>.note{color:#222}</style></head>
<body>
  <p class="note">Hello {{.RecipientName}}</p>
  <a href="https://flatkey.ai/help">Help</a>
  <a href="{{.UnsubscribeURL}}">Unsubscribe</a>
</body></html>`
	stages := []RecallEmailStage{
		{StageNo: 1, DelaySeconds: 0, TemplateVersion: 21, Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Content update", BodyHTML: contentOnlyHTML},
		}},
		{StageNo: 2, DelaySeconds: 600, TemplateVersion: 22, Templates: map[string]RecallEmailTemplate{
			"en": {Subject: "Follow-up", BodyText: "Second content-only note"},
		}},
	}
	emailJSON, err := common.Marshal(stages)
	require.NoError(t, err)
	templateJSON, err := common.Marshal(stages[0].Templates)
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Updates(map[string]any{
		"campaign_type":           model.RecallCampaignTypeContentOnly,
		"stripe_coupon_id":        "",
		"product_scope":           `{not-json`,
		"email_sequence_config":   string(emailJSON),
		"promotion_valid_seconds": int64(3600),
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"promotion_expires_at":     recallEmailTestNow + 3600,
		"claim_token_hash":         nil,
		"last_error_code":          "",
		"last_error_message":       "",
		"state":                    model.RecallRecipientContacting,
		"created_at":               recallEmailTestNow - 3600,
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"template_version":  stages[0].TemplateVersion,
		"template_snapshot": string(templateJSON),
		"claim_token_hash":  nil,
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, *fixture.sent, 1)
	sent := (*fixture.sent)[0]
	require.Equal(t, "Content update", sent.subject)
	require.Contains(t, sent.htmlBody, "Hello Ada")
	require.Contains(t, sent.htmlBody, "https://flatkey.ai/help")
	require.NotContains(t, sent.htmlBody, "recall_claim")
	require.NotContains(t, sent.htmlBody, "PROMOCODE")
	unsubscribeToken := recallEmailRawUnsubscribeToken(t, sent.htmlBody)
	requireRecallEmailUnsubscribePayload(t, unsubscribeToken, 2, 0, fixture.recipient.Id, recallEmailTestNow+3600)

	accepted := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageAccepted, accepted.State)
	require.Nil(t, accepted.ClaimTokenHash)
	stageTwo := loadRecallEmailMessage(t, fixture.recipient.Id, 2)
	require.Equal(t, model.RecallMessageScheduled, stageTwo.State)
	require.Nil(t, stageTwo.ClaimTokenHash)
	var storedRecipient model.RecallRecipient
	require.NoError(t, model.DB.First(&storedRecipient, fixture.recipient.Id).Error)
	require.Nil(t, storedRecipient.ClaimTokenHash)
	require.Empty(t, storedRecipient.PromotionCode)
}

func TestRecallContentOnlyEmailUsesActivityExpiryForUnsubscribeToken(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update(
		"campaign_type", model.RecallCampaignTypeContentOnly,
	).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"claim_token_hash":         nil,
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, *fixture.sent, 1)
	unsubscribeToken := recallEmailRawUnsubscribeToken(t, (*fixture.sent)[0].htmlBody)
	requireRecallEmailUnsubscribePayload(t, unsubscribeToken, 2, 0, fixture.recipient.Id, fixture.recipient.PromotionExpiresAt)
}

func TestRecallContentOnlyEmailCancelsAfterActivityExpiry(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update(
		"campaign_type", model.RecallCampaignTypeContentOnly,
	).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"promotion_expires_at":     recallEmailTestNow - 1,
		"claim_token_hash":         nil,
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageCancelled, stored.State)
	require.Equal(t, "activity_expired", stored.LastErrorCode)
}

func TestRecallContentOnlyEmailCancelsWhenActivityExpiryMissing(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update(
		"campaign_type", model.RecallCampaignTypeContentOnly,
	).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"promotion_expires_at":     int64(0),
		"claim_token_hash":         nil,
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageCancelled, stored.State)
	require.Equal(t, "activity_expired", stored.LastErrorCode)
}

func TestRecallContentOnlyEmailRejectsHistoricalClaimTemplateBeforeSend(t *testing.T) {
	fixture := newRecallEmailFixture(t, 1, nil)
	templateJSON, err := common.Marshal(map[string]RecallEmailTemplate{
		"en": {Subject: "Invalid content update", BodyHTML: validRecallHTML},
	})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Updates(map[string]any{
		"campaign_type": model.RecallCampaignTypeContentOnly,
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"promotion_expires_at":     recallEmailTestNow + 3600,
		"claim_token_hash":         nil,
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
		"template_snapshot": string(templateJSON),
		"claim_token_hash":  nil,
	}).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageFailed, stored.State)
	require.Equal(t, "render_invalid", stored.LastErrorCode)
	require.Nil(t, stored.ClaimTokenHash)
	var storedRecipient model.RecallRecipient
	require.NoError(t, model.DB.First(&storedRecipient, fixture.recipient.Id).Error)
	require.Nil(t, storedRecipient.ClaimTokenHash)
}

func TestRecallEmailWorkerInjectsOpenPixelOnlyIntoFinalOutboundHTML(t *testing.T) {
	tests := []struct {
		name                  string
		consoleOrigin         string
		fallbackServerAddress string
		campaignType          string
		template              RecallEmailTemplate
		wantTrackerCount      int
	}{
		{
			name:             "html body",
			consoleOrigin:    "https://console.flatkey.ai",
			campaignType:     model.RecallCampaignTypePromotion,
			template:         RecallEmailTemplate{Subject: "Tracked HTML", BodyHTML: validRecallHTML},
			wantTrackerCount: 1,
		},
		{
			name:             "content only body text",
			consoleOrigin:    "https://console.flatkey.ai",
			campaignType:     model.RecallCampaignTypeContentOnly,
			template:         RecallEmailTemplate{Subject: "Tracked content", BodyText: "Product update\nOpen Flatkey for details."},
			wantTrackerCount: 1,
		},
		{
			name:                  "missing console origin skips server fallback",
			consoleOrigin:         "",
			fallbackServerAddress: "http://localhost:3000",
			campaignType:          model.RecallCampaignTypePromotion,
			template:              RecallEmailTemplate{Subject: "Untracked without console", BodyHTML: validRecallHTML},
			wantTrackerCount:      0,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("APP_CONSOLE_ORIGIN", testCase.consoleOrigin)
			if testCase.fallbackServerAddress != "" {
				originalServerAddress := system_setting.ServerAddress
				system_setting.ServerAddress = testCase.fallbackServerAddress
				t.Cleanup(func() { system_setting.ServerAddress = originalServerAddress })
			}
			fixture := newRecallEmailFixture(t, 1, nil)
			templateJSON, err := common.Marshal(map[string]RecallEmailTemplate{
				"en": testCase.template,
			})
			require.NoError(t, err)
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Update(
				"campaign_type", testCase.campaignType,
			).Error)
			if testCase.campaignType == model.RecallCampaignTypeContentOnly {
				require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
					"stripe_customer_id":       "",
					"stripe_promotion_code_id": nil,
					"promotion_code":           "",
					"promotion_expires_at":     recallEmailTestNow + 3600,
					"claim_token_hash":         nil,
				}).Error)
			}
			require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Updates(map[string]any{
				"template_snapshot": string(templateJSON),
				"claim_token_hash":  nil,
			}).Error)

			_, previewHTML, err := RenderRecallEmail(RecallEmailRenderInput{
				CampaignType:        testCase.campaignType,
				Language:            "en",
				Template:            testCase.template,
				RecipientName:       "Ada",
				PromotionCodeMasked: "PROM****23",
				ExpiresAt:           recallEmailTestNow + 3600,
				ProductSummary:      "Top-ups",
				ClaimURL:            "https://console.flatkey.ai/console/topup?recall_claim=preview",
				UnsubscribeURL:      "https://console.flatkey.ai/api/recall/unsubscribe?token=preview",
			})
			require.NoError(t, err)
			require.NotContains(t, previewHTML, "/api/recall/open.gif?token=")

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			require.Len(t, *fixture.sent, 1)
			sent := (*fixture.sent)[0]
			require.Equal(t, testCase.wantTrackerCount, strings.Count(sent.htmlBody, "/api/recall/open.gif?token="))
			if testCase.wantTrackerCount > 0 {
				require.Contains(t, sent.htmlBody, `src="https://console.flatkey.ai/api/recall/open.gif?token=`)
			}

			stored := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.NotContains(t, stored.TemplateSnapshot, "/api/recall/open.gif?token=")
			var campaign model.RecallCampaign
			require.NoError(t, model.DB.First(&campaign, fixture.campaign.Id).Error)
			require.NotContains(t, campaign.EmailSequenceConfig, "/api/recall/open.gif?token=")
		})
	}
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
		sender = func(config common.SMTPConfig, subject, receiver, content, messageID string, options common.EmailOptions) error {
			sent = append(sent, recallEmailSent{config: config, from: config.From, subject: subject, receiver: receiver, htmlBody: content, messageID: messageID, options: options})
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

func setRecallEmailHourlyLimit(t *testing.T, limit int) {
	t.Helper()
	previous := operation_setting.GetRecallCampaignSetting()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":            boolString(previous.Enabled),
		"recall_campaign_setting.batch_size":         fmt.Sprintf("%d", previous.BatchSize),
		"recall_campaign_setting.tick_seconds":       fmt.Sprintf("%d", previous.TickSeconds),
		"recall_campaign_setting.email_hourly_limit": fmt.Sprintf("%d", limit),
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":            boolString(previous.Enabled),
			"recall_campaign_setting.batch_size":         fmt.Sprintf("%d", previous.BatchSize),
			"recall_campaign_setting.tick_seconds":       fmt.Sprintf("%d", previous.TickSeconds),
			"recall_campaign_setting.email_hourly_limit": fmt.Sprintf("%d", previous.EmailHourlyLimit),
		}))
	})
}

func setRecallEmailPacing(t *testing.T, limit int, tickSeconds int) {
	t.Helper()
	previous := operation_setting.GetRecallCampaignSetting()
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"recall_campaign_setting.enabled":            boolString(previous.Enabled),
		"recall_campaign_setting.batch_size":         fmt.Sprintf("%d", previous.BatchSize),
		"recall_campaign_setting.tick_seconds":       fmt.Sprintf("%d", tickSeconds),
		"recall_campaign_setting.email_hourly_limit": fmt.Sprintf("%d", limit),
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
			"recall_campaign_setting.enabled":            boolString(previous.Enabled),
			"recall_campaign_setting.batch_size":         fmt.Sprintf("%d", previous.BatchSize),
			"recall_campaign_setting.tick_seconds":       fmt.Sprintf("%d", previous.TickSeconds),
			"recall_campaign_setting.email_hourly_limit": fmt.Sprintf("%d", previous.EmailHourlyLimit),
		}))
	})
}

func addRecallEmailBatchMessage(t *testing.T, fixture recallEmailFixture, suffix string, scheduledAt int64) (model.User, model.RecallRecipient, model.RecallMessage) {
	t.Helper()
	user := fixture.user
	user.Id = 0
	user.Username = "recall-" + suffix
	user.Email = suffix + "@example.com"
	user.AffCode = "recall-" + suffix
	user.Setting = ""
	require.NoError(t, model.DB.Create(&user).Error)

	recipient := fixture.recipient
	recipient.Id = 0
	recipient.RecipientIdentity = ""
	recipient.UserId = user.Id
	recipient.EmailSnapshot = user.Email
	recipient.State = model.RecallRecipientContacting
	promotionID := "promo_" + suffix
	recipient.StripePromotionCodeId = &promotionID
	require.NoError(t, model.DB.Create(&recipient).Error)

	message := fixture.message
	message.Id = 0
	message.RecipientId = recipient.Id
	message.State = model.RecallMessageScheduled
	message.ScheduledAt = scheduledAt
	message.AttemptCount = 0
	message.NextAttemptAt = 0
	message.LeaseOwner = ""
	message.LeaseExpiresAt = 0
	message.ProviderMessageId = ""
	message.ClaimTokenHash = nil
	require.NoError(t, model.DB.Create(&message).Error)
	return user, recipient, message
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
	serverDone := make(chan error, 1)
	go func() {
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			serverDone <- acceptErr
			return
		}
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		tp := textproto.NewConn(conn)
		defer tp.Close()
		if err := tp.PrintfLine("220 localhost ESMTP ready"); err != nil {
			serverDone <- err
			return
		}
		if _, err := tp.ReadLine(); err != nil {
			serverDone <- err
			return
		}
		if err := tp.PrintfLine("250-localhost"); err != nil {
			serverDone <- err
			return
		}
		if err := tp.PrintfLine("250 AUTH PLAIN"); err != nil {
			serverDone <- err
			return
		}
		if _, err := tp.ReadLine(); err != nil {
			serverDone <- err
			return
		}
		if err := tp.PrintfLine("235 2.7.0 authenticated"); err != nil {
			serverDone <- err
			return
		}
		for _, reply := range []string{"250 2.1.0 ok", "250 2.1.0 ok", "354 send message, end with dot"} {
			if _, err := tp.ReadLine(); err != nil {
				serverDone <- err
				return
			}
			if err := tp.PrintfLine("%s", reply); err != nil {
				serverDone <- err
				return
			}
		}
		for {
			line, err := tp.ReadLine()
			if err != nil {
				serverDone <- err
				return
			}
			if line == "." {
				serverDone <- nil
				return
			}
		}
	}()
	t.Cleanup(func() { _ = listener.Close() })

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
	select {
	case serverErr := <-serverDone:
		require.NoError(t, serverErr)
	case <-time.After(6 * time.Second):
		require.FailNow(t, "scripted SMTP uncertain server timed out")
	}
	return err
}

type recallSMTPTestResult struct {
	commands []string
	err      error
}

func startRecallSMTPTestServer(t *testing.T, failAt string) (int, func() recallSMTPTestResult) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	results := make(chan recallSMTPTestResult, 1)
	go func() {
		result := recallSMTPTestResult{}
		conn, acceptErr := listener.Accept()
		if acceptErr != nil {
			result.err = acceptErr
			results <- result
			return
		}
		_ = listener.Close()
		defer conn.Close()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		result.err = runRecallSMTPTestScript(conn, failAt, &result)
		results <- result
	}()
	port := listener.Addr().(*net.TCPAddr).Port
	return port, func() recallSMTPTestResult {
		t.Helper()
		select {
		case result := <-results:
			require.NoError(t, result.err)
			return result
		case <-time.After(6 * time.Second):
			require.FailNow(t, "scripted recall SMTP server timed out")
			return recallSMTPTestResult{}
		}
	}
}

func runRecallSMTPTestScript(conn net.Conn, failAt string, result *recallSMTPTestResult) error {
	reader := bufio.NewReader(conn)
	writer := bufio.NewWriter(conn)
	writeReply := func(reply string) error {
		if _, err := writer.WriteString(reply); err != nil {
			return err
		}
		return writer.Flush()
	}
	readCommand := func(name string) error {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(strings.ToUpper(line), name) {
			return fmt.Errorf("expected SMTP %s command, got %q", name, line)
		}
		result.commands = append(result.commands, line)
		return nil
	}
	if err := writeReply("220 localhost ESMTP ready\r\n"); err != nil {
		return err
	}
	if err := readCommand("EHLO"); err != nil {
		return err
	}
	if err := writeReply("250-localhost\r\n250 AUTH PLAIN\r\n"); err != nil {
		return err
	}
	if err := readCommand("AUTH"); err != nil {
		return err
	}
	if failAt == "AUTH" {
		return writeReply("535 5.7.8 authentication rejected\r\n")
	}
	if err := writeReply("235 2.7.0 authenticated\r\n"); err != nil {
		return err
	}
	for _, command := range []string{"MAIL", "RCPT", "DATA"} {
		if err := readCommand(command); err != nil {
			return err
		}
		if failAt == command {
			return writeReply("550 5.1.0 scripted rejection\r\n")
		}
		if command == "DATA" {
			if err := writeReply("354 send message, end with dot\r\n"); err != nil {
				return err
			}
			break
		}
		if err := writeReply("250 2.1.0 ok\r\n"); err != nil {
			return err
		}
	}
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			return err
		}
		if line == ".\r\n" {
			break
		}
	}
	if err := writeReply("250 2.0.0 queued\r\n"); err != nil {
		return err
	}
	line, err := reader.ReadString('\n')
	if errors.Is(err, io.EOF) || errors.Is(err, net.ErrClosed) {
		return nil
	}
	if err == nil && strings.HasPrefix(strings.ToUpper(strings.TrimSpace(line)), "QUIT") {
		result.commands = append(result.commands, strings.TrimSpace(line))
		return writeReply("221 2.0.0 bye\r\n")
	}
	return err
}

func recallSMTPCommandNames(commands []string) []string {
	names := make([]string, 0, len(commands))
	for _, command := range commands {
		name, _, _ := strings.Cut(command, " ")
		names = append(names, strings.ToUpper(name))
	}
	return names
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
