package service

const (
	RecallPurchaseKindTopUp        = "topup"
	RecallPurchaseKindSubscription = "subscription"
)

type RecallCheckoutDiscount struct {
	PromotionCodeID string `json:"promotion_code_id"`
	CampaignID      int64  `json:"campaign_id"`
	RecipientID     int64  `json:"recipient_id"`
}

type RecallCampaignDraft struct {
	Name                  string               `json:"name"`
	AudienceTemplate      string               `json:"audience_template"`
	Audience              RecallAudienceConfig `json:"audience_config"`
	ExecutionMode         string               `json:"execution_mode"`
	Schedule              RecallScheduleConfig `json:"schedule"`
	CouponSource          string               `json:"coupon_source"`
	ExistingCouponID      string               `json:"existing_coupon_id"`
	Discount              RecallDiscountConfig `json:"discount_config"`
	Products              RecallProductScope   `json:"product_scope"`
	PromotionValidSeconds int64                `json:"promotion_valid_seconds"`
	EnrollmentLimit       int                  `json:"enrollment_limit"`
	WorkerConcurrency     int                  `json:"worker_concurrency"`
	Emails                []RecallEmailStage   `json:"email_sequence"`
}

type RecallAudienceConfig struct {
	RegistrationAgeDays     int      `json:"registration_age_days"`
	RegistrationStartAt     int64    `json:"registration_start_at"`
	RegistrationEndAt       int64    `json:"registration_end_at"`
	MinRequestCount         int      `json:"min_request_count"`
	MaxQuota                int      `json:"max_quota"`
	MinPaidAmount           float64  `json:"min_paid_amount"`
	LastAPICallAgeDays      int      `json:"last_api_call_age_days"`
	LastPaymentAgeDays      int      `json:"last_payment_age_days"`
	SubscriptionExpiredDays int      `json:"subscription_expired_days"`
	MinSubscriptionAmount   float64  `json:"min_subscription_amount"`
	MinSubscriptionCount    int      `json:"min_subscription_count"`
	PaymentProviders        []string `json:"payment_providers"`
	Groups                  []string `json:"groups"`
	GroupMode               string   `json:"group_mode"`
	RequireVerifiedEmail    bool     `json:"require_verified_email"`
	SpecifiedUserIDs        []int    `json:"specified_user_ids"`
	SpecifiedEmails         []string `json:"specified_emails"`
}

type RecallScheduleConfig struct {
	ScheduledAt int64  `json:"scheduled_at"`
	Timezone    string `json:"timezone"`
	Frequency   string `json:"frequency"`
	Weekday     int    `json:"weekday"`
	Hour        int    `json:"hour"`
	Minute      int    `json:"minute"`
}

type RecallDiscountConfig struct {
	Type                  string           `json:"type"`
	PercentOff            float64          `json:"percent_off"`
	AmountOff             int64            `json:"amount_off"`
	Currency              string           `json:"currency"`
	CurrencyOptions       map[string]int64 `json:"currency_options"`
	MinimumAmount         int64            `json:"minimum_amount"`
	MinimumAmountCurrency string           `json:"minimum_amount_currency"`
	CouponRedeemBy        int64            `json:"coupon_redeem_by"`
}

type RecallProductScope struct {
	TopUpPriceIDs                []string `json:"topup_price_ids"`
	SubscriptionPriceIDs         []string `json:"subscription_price_ids"`
	TopUpDisplaySnapshots        []string `json:"topup_display_snapshots,omitempty"`
	SubscriptionDisplaySnapshots []string `json:"subscription_display_snapshots,omitempty"`
}

type RecallEmailStage struct {
	StageNo         int                            `json:"stage_no"`
	DelaySeconds    int64                          `json:"delay_seconds"`
	TemplateVersion int                            `json:"template_version"`
	Templates       map[string]RecallEmailTemplate `json:"templates"`
}

type RecallEmailTemplate struct {
	Subject  string `json:"subject"`
	BodyText string `json:"body_text,omitempty"`
	BodyHTML string `json:"body_html,omitempty"`
}

type RecallEmailPreviewRequest struct {
	Template RecallEmailTemplate `json:"template"`
}

type RecallEmailPreviewResponse struct {
	Subject  string `json:"subject"`
	BodyHTML string `json:"body_html"`
}

func PreviewRecallEmail(request RecallEmailPreviewRequest) (RecallEmailPreviewResponse, error) {
	stages, err := normalizeRecallEmailStages([]RecallEmailStage{{
		StageNo:      1,
		DelaySeconds: 0,
		Templates: map[string]RecallEmailTemplate{
			"en": request.Template,
		},
	}})
	if err != nil {
		return RecallEmailPreviewResponse{}, err
	}
	subject, bodyHTML, err := RenderRecallEmail(RecallEmailRenderInput{
		Language:            "en",
		Template:            stages[0].Templates["en"],
		RecipientName:       "Ada",
		PromotionCodeMasked: "SAVE****25",
		ExpiresAt:           1_900_000_000,
		ProductSummary:      "Top-ups: 50 USD, 10 USD; Subscriptions: Pro monthly (20 USD)",
		ClaimURL:            "https://flatkey.ai/recall/claim?preview=1",
		UnsubscribeURL:      "https://flatkey.ai/recall/unsubscribe?preview=1",
	})
	if err != nil {
		return RecallEmailPreviewResponse{}, err
	}
	return RecallEmailPreviewResponse{Subject: subject, BodyHTML: bodyHTML}, nil
}

type RecallClaimView struct {
	CampaignID          int64                `json:"campaign_id"`
	RecipientID         int64                `json:"recipient_id"`
	CampaignName        string               `json:"campaign_name"`
	PromotionCodeMasked string               `json:"promotion_code_masked"`
	ExpiresAt           int64                `json:"expires_at"`
	Discount            RecallDiscountConfig `json:"discount"`
	Products            RecallProductScope   `json:"products"`
	Redeemed            bool                 `json:"redeemed"`
}

type RecallAudiencePreview struct {
	EligibleTotal int64                     `json:"eligible_total"`
	Sample        []RecallAudienceCandidate `json:"sample"`
	Exclusions    map[string]int64          `json:"exclusions"`
}

type RecallAudienceCandidate struct {
	UserID       int    `json:"user_id"`
	EmailMasked  string `json:"email_masked"`
	Language     string `json:"language"`
	SnapshotJSON string `json:"-"`
}

type RecallStripePreview struct {
	CouponSource         string               `json:"coupon_source"`
	CouponID             string               `json:"coupon_id"`
	Discount             RecallDiscountConfig `json:"discount"`
	TopUpPriceIDs        []string             `json:"topup_price_ids"`
	SubscriptionPriceIDs []string             `json:"subscription_price_ids"`
	ProductIDs           []string             `json:"product_ids"`
}
