package service

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stripe/stripe-go/v86"
	checkoutsession "github.com/stripe/stripe-go/v86/checkout/session"
	"github.com/stripe/stripe-go/v86/coupon"
	"github.com/stripe/stripe-go/v86/customer"
	"github.com/stripe/stripe-go/v86/price"
	"github.com/stripe/stripe-go/v86/promotioncode"
)

type RecallStripeClient interface {
	CreateCoupon(context.Context, *stripe.CouponParams) (*stripe.Coupon, error)
	GetCoupon(context.Context, string) (*stripe.Coupon, error)
	CreateCustomer(context.Context, *stripe.CustomerParams) (*stripe.Customer, error)
	GetCustomer(context.Context, string) (*stripe.Customer, error)
	UpdateCustomer(context.Context, string, *stripe.CustomerParams) (*stripe.Customer, error)
	CreatePromotionCode(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error)
	GetPromotionCode(context.Context, string) (*stripe.PromotionCode, error)
	GetPrice(context.Context, string) (*stripe.Price, error)
	GetCheckoutSession(context.Context, string, ...string) (*stripe.CheckoutSession, error)
}

type StripeRecallClient struct{}

func NewStripeRecallClient() RecallStripeClient {
	return &StripeRecallClient{}
}

func (c *StripeRecallClient) CreateCoupon(ctx context.Context, params *stripe.CouponParams) (*stripe.Coupon, error) {
	if params == nil {
		return nil, errors.New("Stripe coupon params are nil")
	}
	params.Context = ctx
	if params.IdempotencyKey != nil {
		params.SetIdempotencyKey(*params.IdempotencyKey)
	}
	client := coupon.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.New(params)
}

func (c *StripeRecallClient) GetCoupon(ctx context.Context, id string) (*stripe.Coupon, error) {
	params := &stripe.CouponParams{}
	params.Context = ctx
	client := coupon.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Get(id, params)
}

func (c *StripeRecallClient) CreateCustomer(ctx context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
	if params == nil {
		return nil, errors.New("Stripe customer params are nil")
	}
	params.Context = ctx
	if params.IdempotencyKey != nil {
		params.SetIdempotencyKey(*params.IdempotencyKey)
	}
	client := customer.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.New(params)
}

func (c *StripeRecallClient) GetCustomer(ctx context.Context, id string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{}
	params.Context = ctx
	client := customer.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Get(id, params)
}

func (c *StripeRecallClient) UpdateCustomer(ctx context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
	if params == nil {
		return nil, errors.New("Stripe customer params are nil")
	}
	params.Context = ctx
	if params.IdempotencyKey != nil {
		params.SetIdempotencyKey(*params.IdempotencyKey)
	}
	client := customer.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Update(id, params)
}

func (c *StripeRecallClient) CreatePromotionCode(ctx context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
	if params == nil {
		return nil, errors.New("Stripe promotion code params are nil")
	}
	params.Context = ctx
	if params.IdempotencyKey != nil {
		params.SetIdempotencyKey(*params.IdempotencyKey)
	}
	client := promotioncode.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.New(params)
}

func (c *StripeRecallClient) GetPromotionCode(ctx context.Context, id string) (*stripe.PromotionCode, error) {
	params := &stripe.PromotionCodeParams{}
	params.Context = ctx
	client := promotioncode.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Get(id, params)
}

func (c *StripeRecallClient) GetPrice(ctx context.Context, id string) (*stripe.Price, error) {
	params := &stripe.PriceParams{}
	params.Context = ctx
	client := price.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Get(id, params)
}

func (c *StripeRecallClient) GetCheckoutSession(ctx context.Context, id string, expand ...string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{}
	params.Context = ctx
	for _, field := range expand {
		params.AddExpand(field)
	}
	client := checkoutsession.Client{B: stripe.GetBackend(stripe.APIBackend), Key: setting.StripeApiSecret}
	return client.Get(id, params)
}

type RecallResolvedProductScope struct {
	TopUpPriceIDs        []string `json:"topup_price_ids"`
	SubscriptionPriceIDs []string `json:"subscription_price_ids"`
	ProductIDs           []string `json:"product_ids"`
}

type RecallStripeErrorKind string

const (
	RecallStripeErrorUnknown   RecallStripeErrorKind = "unknown"
	RecallStripeErrorRetryable RecallStripeErrorKind = "retryable"
	RecallStripeErrorPermanent RecallStripeErrorKind = "permanent"
)

type RecallStripeError struct {
	Kind RecallStripeErrorKind
	Op   string
	Err  error
}

func (e *RecallStripeError) Error() string {
	if e.Op == "" {
		return e.Err.Error()
	}
	return e.Op + ": " + e.Err.Error()
}

func (e *RecallStripeError) Unwrap() error {
	return e.Err
}

func ClassifyRecallStripeError(err error) RecallStripeErrorKind {
	if err == nil {
		return RecallStripeErrorUnknown
	}
	var classified *RecallStripeError
	if errors.As(err, &classified) {
		return classified.Kind
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return RecallStripeErrorRetryable
	}
	if errors.Is(err, context.Canceled) {
		return RecallStripeErrorRetryable
	}
	var networkError net.Error
	if errors.As(err, &networkError) && (networkError.Timeout() || networkError.Temporary()) {
		return RecallStripeErrorRetryable
	}
	var stripeError *stripe.Error
	if errors.As(err, &stripeError) {
		if stripeError.HTTPStatusCode == 429 || stripeError.HTTPStatusCode >= 500 || stripeError.Type == stripe.ErrorTypeAPI {
			return RecallStripeErrorRetryable
		}
		if stripeError.Type == stripe.ErrorTypeInvalidRequest || stripeError.Code == stripe.ErrorCodeResourceMissing {
			return RecallStripeErrorPermanent
		}
	}
	return RecallStripeErrorUnknown
}

func IsRecallStripeRetryable(err error) bool {
	return ClassifyRecallStripeError(err) == RecallStripeErrorRetryable
}

func recallStripePermanent(op string, format string, args ...any) error {
	return &RecallStripeError{Kind: RecallStripeErrorPermanent, Op: op, Err: fmt.Errorf(format, args...)}
}

func wrapRecallStripeError(op string, err error) error {
	if err == nil {
		return nil
	}
	var classified *RecallStripeError
	if errors.As(err, &classified) {
		return err
	}
	return &RecallStripeError{Kind: ClassifyRecallStripeError(err), Op: op, Err: err}
}

func recallStripeCreateWithRetry[T any](op string, create func() (*T, error)) (*T, error) {
	const maxAttempts = 3
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		result, err := create()
		if err == nil {
			return result, nil
		}
		lastErr = err
		if ClassifyRecallStripeError(err) == RecallStripeErrorPermanent || errors.Is(err, context.Canceled) {
			break
		}
	}
	return nil, wrapRecallStripeError(op, lastErr)
}

type RecallStripeService struct {
	client            RecallStripeClient
	codeGenerator     func(int) (string, error)
	externalCallGuard func(context.Context) error
}

func NewRecallStripeService(client RecallStripeClient) *RecallStripeService {
	if client == nil {
		client = NewStripeRecallClient()
	}
	return &RecallStripeService{client: client, codeGenerator: common.GenerateRandomCharsKey}
}

func (s *RecallStripeService) withExternalCallGuard(guard func(context.Context) error) *RecallStripeService {
	guarded := *s
	guarded.externalCallGuard = guard
	return &guarded
}

func (s *RecallStripeService) beforeExternalCall(ctx context.Context) error {
	if s.externalCallGuard == nil {
		return nil
	}
	return s.externalCallGuard(ctx)
}

func (s *RecallStripeService) GenerateRecipientPromotionCode() (string, error) {
	raw, err := s.codeGenerator(12)
	if err != nil {
		return "", wrapRecallStripeError("generate Stripe Promotion Code", err)
	}
	code := normalizeRecallPromotionCode(raw)
	if code == "FK" {
		return "", recallStripePermanent("generate Stripe Promotion Code", "generated promotion code is empty")
	}
	return code, nil
}

func (s *RecallStripeService) ValidateAndResolveProducts(ctx context.Context, scope RecallProductScope) (RecallResolvedProductScope, error) {
	resolved := RecallResolvedProductScope{
		TopUpPriceIDs:        normalizeRecallStripeIDs(scope.TopUpPriceIDs),
		SubscriptionPriceIDs: normalizeRecallStripeIDs(scope.SubscriptionPriceIDs),
	}
	if len(resolved.TopUpPriceIDs)+len(resolved.SubscriptionPriceIDs) == 0 {
		return RecallResolvedProductScope{}, recallStripePermanent("validate products", "at least one Stripe Price is required")
	}

	priceCache := make(map[string]*stripe.Price)
	loadPrice := func(priceID string) (*stripe.Price, error) {
		if cached, ok := priceCache[priceID]; ok {
			return cached, nil
		}
		stripePrice, getErr := s.client.GetPrice(ctx, priceID)
		if getErr != nil {
			return nil, wrapRecallStripeError("get Stripe Price "+priceID, getErr)
		}
		if stripePrice == nil {
			return nil, recallStripePermanent("validate products", "Stripe Price %s is unavailable", priceID)
		}
		priceCache[priceID] = stripePrice
		return stripePrice, nil
	}
	validatePrice := func(priceID string, expected stripe.PriceType) (*stripe.Price, error) {
		stripePrice, loadErr := loadPrice(priceID)
		if loadErr != nil {
			return nil, loadErr
		}
		if stripePrice.Deleted {
			return nil, recallStripePermanent("validate products", "Stripe Price %s is deleted", priceID)
		}
		if !stripePrice.Active {
			return nil, recallStripePermanent("validate products", "Stripe Price %s is inactive", priceID)
		}
		if stripePrice.Type != expected {
			return nil, recallStripePermanent("validate products", "Stripe Price %s must be %s", priceID, expected)
		}
		if stripePrice.Product == nil || strings.TrimSpace(stripePrice.Product.ID) == "" {
			return nil, recallStripePermanent("validate products", "Stripe Price %s has no product ID", priceID)
		}
		return stripePrice, nil
	}

	seenProducts := make(map[string]struct{})
	addSelected := func(priceID string, expected stripe.PriceType) error {
		stripePrice, validateErr := validatePrice(priceID, expected)
		if validateErr != nil {
			return validateErr
		}
		productID := strings.TrimSpace(stripePrice.Product.ID)
		if _, exists := seenProducts[productID]; !exists {
			seenProducts[productID] = struct{}{}
			resolved.ProductIDs = append(resolved.ProductIDs, productID)
		}
		return nil
	}
	for _, priceID := range resolved.TopUpPriceIDs {
		if err := addSelected(priceID, stripe.PriceTypeOneTime); err != nil {
			return RecallResolvedProductScope{}, err
		}
	}
	for _, priceID := range resolved.SubscriptionPriceIDs {
		if err := addSelected(priceID, stripe.PriceTypeRecurring); err != nil {
			return RecallResolvedProductScope{}, err
		}
	}
	return resolved, nil
}

func normalizeRecallStripeIDs(ids []string) []string {
	normalized := make([]string, 0, len(ids))
	seen := make(map[string]struct{}, len(ids))
	for _, rawID := range ids {
		id := strings.TrimSpace(rawID)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	return normalized
}

func recallConfiguredTopUpPriceIDs() ([]string, error) {
	raw := strings.TrimSpace(setting.StripeTopUpPriceIds)
	if raw == "" {
		return normalizeRecallStripeIDs([]string{setting.StripePriceId, setting.StripePriceId20, setting.StripePriceId200}), nil
	}
	var configured map[string]string
	if err := common.UnmarshalJsonStr(raw, &configured); err != nil {
		return nil, recallStripePermanent("load configured top-up prices", "invalid StripeTopUpPriceIds: %v", err)
	}
	ids := make([]string, 0, len(configured))
	for _, id := range configured {
		ids = append(ids, id)
	}
	ids = normalizeRecallStripeIDs(ids)
	sort.Strings(ids)
	return ids, nil
}

func (s *RecallStripeService) EnsureCoupon(ctx context.Context, campaignID int64, configRevision int64, source string, existingID string, discount RecallDiscountConfig, products RecallResolvedProductScope, enrollmentLimit int) (*stripe.Coupon, RecallDiscountConfig, error) {
	normalizedDiscount, err := normalizeRecallDiscount(discount)
	if err != nil {
		return nil, RecallDiscountConfig{}, err
	}
	switch strings.ToLower(strings.TrimSpace(source)) {
	case "automatic":
		params, buildErr := buildRecallCouponParams(ctx, campaignID, configRevision, normalizedDiscount, products.ProductIDs, enrollmentLimit)
		if buildErr != nil {
			return nil, RecallDiscountConfig{}, buildErr
		}
		created, createErr := recallStripeCreateWithRetry("create Stripe Coupon", func() (*stripe.Coupon, error) {
			return s.client.CreateCoupon(ctx, params)
		})
		if createErr != nil {
			return nil, RecallDiscountConfig{}, createErr
		}
		if created == nil || strings.TrimSpace(created.ID) == "" {
			return nil, RecallDiscountConfig{}, recallStripePermanent("create Stripe Coupon", "Stripe returned an empty Coupon")
		}
		return created, normalizedDiscount, nil
	case "existing":
		couponID := strings.TrimSpace(existingID)
		if couponID == "" {
			return nil, RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "existing coupon ID is required")
		}
		existing, getErr := s.client.GetCoupon(ctx, couponID)
		if getErr != nil {
			return nil, RecallDiscountConfig{}, wrapRecallStripeError("get Stripe Coupon", getErr)
		}
		normalized, validateErr := validateExistingRecallCoupon(existing, normalizedDiscount, products.ProductIDs, enrollmentLimit)
		if validateErr != nil {
			return nil, RecallDiscountConfig{}, validateErr
		}
		return existing, normalized, nil
	default:
		return nil, RecallDiscountConfig{}, recallStripePermanent("ensure Stripe Coupon", "unsupported coupon source %q", source)
	}
}

func normalizeRecallDiscount(discount RecallDiscountConfig) (RecallDiscountConfig, error) {
	discount.Type = strings.ToLower(strings.TrimSpace(discount.Type))
	discount.Currency = strings.ToLower(strings.TrimSpace(discount.Currency))
	discount.MinimumAmountCurrency = strings.ToLower(strings.TrimSpace(discount.MinimumAmountCurrency))
	currencyOptions := make(map[string]int64, len(discount.CurrencyOptions))
	for currency, amountOff := range discount.CurrencyOptions {
		currency = strings.ToLower(strings.TrimSpace(currency))
		if currency == "" {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "currency option cannot use an empty currency")
		}
		if _, exists := currencyOptions[currency]; exists {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "currency option %s is duplicated", currency)
		}
		currencyOptions[currency] = amountOff
	}
	discount.CurrencyOptions = currencyOptions
	if discount.MinimumAmount > 0 && discount.MinimumAmountCurrency == "" {
		return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "minimum amount currency is required")
	}
	if discount.Type == "" {
		return discount, nil
	}
	switch discount.Type {
	case "percent":
		if discount.PercentOff <= 0 || discount.PercentOff > 100 {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "percent_off must be greater than zero and at most 100")
		}
		if discount.AmountOff != 0 || discount.Currency != "" || len(discount.CurrencyOptions) > 0 {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "percent discount cannot set amount_off, currency, or currency_options")
		}
	case "fixed":
		if discount.AmountOff <= 0 || discount.Currency == "" {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "fixed discount requires amount_off and currency")
		}
		if discount.PercentOff != 0 {
			return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "fixed discount cannot set percent_off")
		}
	default:
		return RecallDiscountConfig{}, recallStripePermanent("validate recall discount", "unsupported discount type %q", discount.Type)
	}
	return discount, nil
}

func validateRecallAutomaticFixedDiscount(discount RecallDiscountConfig) error {
	if discount.Type != "fixed" {
		return recallStripePermanent("validate recall discount", "automatic fixed discount must use fixed type")
	}
	if discount.Currency != "usd" {
		return recallStripePermanent("validate recall discount", "automatic fixed discount base currency must be usd")
	}
	if discount.AmountOff <= 0 {
		return recallStripePermanent("validate recall discount", "automatic fixed discount amount_off must be positive")
	}
	if discount.PercentOff != 0 {
		return recallStripePermanent("validate recall discount", "automatic fixed discount cannot set percent_off")
	}
	if discount.MinimumAmount != 0 || discount.MinimumAmountCurrency != "" {
		return recallStripePermanent("validate recall discount", "automatic fixed discount cannot set a minimum amount")
	}
	if len(discount.CurrencyOptions) != 3 {
		return recallStripePermanent("validate recall discount", "automatic fixed discount requires exactly inr, brl, and jpy currency options")
	}
	for _, currency := range []string{"inr", "brl", "jpy"} {
		if discount.CurrencyOptions[currency] <= 0 {
			return recallStripePermanent("validate recall discount", "automatic fixed discount requires a positive %s amount", currency)
		}
	}
	return nil
}

func buildRecallCouponParams(ctx context.Context, campaignID int64, configRevision int64, discount RecallDiscountConfig, productIDs []string, enrollmentLimit int) (*stripe.CouponParams, error) {
	if campaignID <= 0 {
		return nil, recallStripePermanent("create Stripe Coupon", "campaign ID must be positive")
	}
	if configRevision <= 0 {
		return nil, recallStripePermanent("create Stripe Coupon", "campaign config revision must be positive")
	}
	productIDs = normalizeRecallStripeIDs(productIDs)
	if len(productIDs) == 0 {
		return nil, recallStripePermanent("create Stripe Coupon", "at least one Stripe Product is required")
	}
	params := &stripe.CouponParams{
		AppliesTo: &stripe.CouponAppliesToParams{},
		Duration:  stripe.String(string(stripe.CouponDurationOnce)),
		Metadata: map[string]string{
			"recall_campaign_id": strconv.FormatInt(campaignID, 10),
			"recall_source":      "automatic",
		},
	}
	params.Context = ctx
	for _, productID := range productIDs {
		params.AppliesTo.Products = append(params.AppliesTo.Products, stripe.String(productID))
	}
	switch discount.Type {
	case "percent":
		params.PercentOff = stripe.Float64(discount.PercentOff)
	case "fixed":
		if err := validateRecallAutomaticFixedDiscount(discount); err != nil {
			return nil, err
		}
		params.AmountOff = stripe.Int64(discount.AmountOff)
		params.Currency = stripe.String(discount.Currency)
		params.CurrencyOptions = make(map[string]*stripe.CouponCurrencyOptionsParams, len(discount.CurrencyOptions))
		for currency, amountOff := range discount.CurrencyOptions {
			params.CurrencyOptions[currency] = &stripe.CouponCurrencyOptionsParams{AmountOff: stripe.Int64(amountOff)}
		}
	default:
		return nil, recallStripePermanent("create Stripe Coupon", "automatic coupon requires a percent or fixed discount")
	}
	if discount.CouponRedeemBy > 0 {
		params.RedeemBy = stripe.Int64(discount.CouponRedeemBy)
	}
	if enrollmentLimit > 0 {
		params.MaxRedemptions = stripe.Int64(int64(enrollmentLimit))
	}
	params.SetIdempotencyKey("recall_coupon:" + strconv.FormatInt(campaignID, 10) + ":" + strconv.FormatInt(configRevision, 10))
	return params, nil
}

func validateExistingRecallCoupon(existing *stripe.Coupon, requested RecallDiscountConfig, productIDs []string, enrollmentLimit int) (RecallDiscountConfig, error) {
	if existing == nil {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon is unavailable")
	}
	if existing.Deleted {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s is deleted", existing.ID)
	}
	if !existing.Valid {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s is invalid", existing.ID)
	}
	if existing.RedeemBy > 0 && existing.RedeemBy <= time.Now().Unix() {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s is expired", existing.ID)
	}
	if existing.Duration != stripe.CouponDurationOnce {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s duration must be once", existing.ID)
	}
	if len(existing.CurrencyOptions) > 0 {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s currency options are not supported", existing.ID)
	}
	if existing.MaxRedemptions > 0 && existing.MaxRedemptions-existing.TimesRedeemed < int64(enrollmentLimit) {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s remaining redemption capacity is insufficient", existing.ID)
	}
	actualProducts := []string(nil)
	if existing.AppliesTo != nil {
		actualProducts = existing.AppliesTo.Products
	}
	if !sameRecallStripeIDs(actualProducts, productIDs) {
		return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s product scope does not match", existing.ID)
	}

	normalized := requested
	normalized.CouponRedeemBy = existing.RedeemBy
	if existing.PercentOff > 0 && existing.AmountOff == 0 && existing.Currency == "" {
		if requested.Type != "" && requested.Type != "percent" {
			return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s discount type does not match", existing.ID)
		}
		if requested.PercentOff > 0 && requested.PercentOff != existing.PercentOff {
			return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s percent_off does not match", existing.ID)
		}
		normalized.Type = "percent"
		normalized.PercentOff = existing.PercentOff
		normalized.AmountOff = 0
		normalized.Currency = ""
		return normalized, nil
	}
	if existing.AmountOff > 0 && existing.PercentOff == 0 && existing.Currency != "" {
		currency := strings.ToLower(string(existing.Currency))
		if requested.Type != "" && requested.Type != "fixed" {
			return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s discount type does not match", existing.ID)
		}
		if requested.AmountOff > 0 && requested.AmountOff != existing.AmountOff {
			return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s amount_off does not match", existing.ID)
		}
		if requested.Currency != "" && requested.Currency != currency {
			return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s currency does not match", existing.ID)
		}
		normalized.Type = "fixed"
		normalized.PercentOff = 0
		normalized.AmountOff = existing.AmountOff
		normalized.Currency = currency
		return normalized, nil
	}
	return RecallDiscountConfig{}, recallStripePermanent("validate Stripe Coupon", "Stripe Coupon %s has an invalid discount", existing.ID)
}

func sameRecallStripeIDs(left []string, right []string) bool {
	left = normalizeRecallStripeIDs(left)
	right = normalizeRecallStripeIDs(right)
	if len(left) != len(right) {
		return false
	}
	sort.Strings(left)
	sort.Strings(right)
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func (s *RecallStripeService) EnsureCustomer(ctx context.Context, user model.User) (*stripe.Customer, error) {
	if user.Id <= 0 {
		return nil, recallStripePermanent("ensure Stripe Customer", "user ID must be positive")
	}
	existingID := strings.TrimSpace(user.StripeCustomer)
	if existingID != "" {
		if err := s.beforeExternalCall(ctx); err != nil {
			return nil, err
		}
		existing, err := s.client.GetCustomer(ctx, existingID)
		if err == nil && existing != nil {
			if strings.TrimSpace(existing.ID) != existingID {
				return nil, recallStripePermanent("get Stripe Customer", "Stripe Customer response does not match requested Customer")
			}
			if !existing.Deleted {
				return existing, nil
			}
		}
		if err != nil && !isRecallStripeMissing(err) {
			return nil, wrapRecallStripeError("get Stripe Customer", err)
		}
	}

	params := &stripe.CustomerParams{Metadata: map[string]string{"flatkey_user_id": strconv.Itoa(user.Id)}}
	params.Context = ctx
	params.SetIdempotencyKey("recall_customer:" + strconv.Itoa(user.Id))
	created, err := recallStripeCreateWithRetry("create Stripe Customer", func() (*stripe.Customer, error) {
		if guardErr := s.beforeExternalCall(ctx); guardErr != nil {
			return nil, guardErr
		}
		return s.client.CreateCustomer(ctx, params)
	})
	if err != nil {
		return nil, err
	}
	if created == nil || created.Deleted || strings.TrimSpace(created.ID) == "" {
		return nil, recallStripePermanent("create Stripe Customer", "Stripe returned an unavailable Customer")
	}
	return created, nil
}

func (s *RecallStripeService) syncCustomerEmail(ctx context.Context, user model.User, customer *stripe.Customer) (*stripe.Customer, error) {
	email := strings.TrimSpace(user.Email)
	if email == "" {
		return customer, nil
	}
	normalizedEmail := strings.ToLower(email)
	emailHash := sha256.Sum256([]byte(normalizedEmail))
	params := &stripe.CustomerParams{Email: stripe.String(normalizedEmail)}
	params.Context = ctx
	params.SetIdempotencyKey(fmt.Sprintf("recall_customer_email:v1:%d:%x", user.Id, emailHash))
	customerID := strings.TrimSpace(customer.ID)
	updated, err := recallStripeCreateWithRetry("update Stripe Customer email", func() (*stripe.Customer, error) {
		if guardErr := s.beforeExternalCall(ctx); guardErr != nil {
			return nil, guardErr
		}
		return s.client.UpdateCustomer(ctx, customerID, params)
	})
	if err != nil {
		return nil, err
	}
	if updated == nil || updated.Deleted || strings.TrimSpace(updated.ID) != customerID {
		return nil, recallStripePermanent("update Stripe Customer email", "Stripe returned an unavailable Customer")
	}
	return updated, nil
}

func isRecallStripeMissing(err error) bool {
	var stripeError *stripe.Error
	return errors.As(err, &stripeError) && stripeError.Code == stripe.ErrorCodeResourceMissing
}

func (s *RecallStripeService) CreateRecipientPromotion(ctx context.Context, campaign model.RecallCampaign, recipient model.RecallRecipient, user model.User, coupon *stripe.Coupon, discount RecallDiscountConfig) (*stripe.PromotionCode, error) {
	if campaign.Id <= 0 || recipient.Id <= 0 || (recipient.UserId > 0 && user.Id <= 0) {
		return nil, recallStripePermanent("create Stripe Promotion Code", "campaign, recipient, and bound user IDs must be positive")
	}
	if coupon == nil || strings.TrimSpace(coupon.ID) == "" {
		return nil, recallStripePermanent("create Stripe Promotion Code", "Stripe Coupon is required")
	}
	persistedCode := recipient.PromotionCode
	canonicalCode := normalizeRecallPromotionCode(persistedCode)
	if persistedCode == "" || canonicalCode == "FK" {
		return nil, recallStripePermanent("create Stripe Promotion Code", "persisted promotion code is required before Stripe creation")
	}
	if persistedCode != canonicalCode {
		return nil, recallStripePermanent("create Stripe Promotion Code", "persisted promotion code must already be canonical")
	}
	baseCode := persistedCode
	customerID := strings.TrimSpace(recipient.StripeCustomerId)
	if customerID == "" {
		customerID = strings.TrimSpace(user.StripeCustomer)
	}
	if recipient.UserId == 0 {
		customerID = ""
	} else if customerID == "" {
		return nil, recallStripePermanent("create Stripe Promotion Code", "Stripe Customer is required")
	}
	expiresAt := recipient.PromotionExpiresAt
	if expiresAt <= 0 {
		return nil, recallStripePermanent("create Stripe Promotion Code", "persisted promotion expiration is required before Stripe creation")
	}
	if expiresAt <= time.Now().Unix() {
		return nil, recallStripePermanent("create Stripe Promotion Code", "promotion expiration must be in the future")
	}
	if coupon.RedeemBy > 0 && expiresAt > coupon.RedeemBy {
		return nil, recallStripePermanent("create Stripe Promotion Code", "persisted promotion expiration must not exceed Coupon redeem_by")
	}
	promotionUserID := 0
	if recipient.UserId > 0 {
		promotionUserID = user.Id
	}
	normalizedDiscount, err := normalizeRecallDiscount(discount)
	if err != nil {
		return nil, err
	}

	if recipient.StripePromotionCodeId != nil && strings.TrimSpace(*recipient.StripePromotionCodeId) != "" {
		persistedPromotionID := strings.TrimSpace(*recipient.StripePromotionCodeId)
		if err := s.beforeExternalCall(ctx); err != nil {
			return nil, err
		}
		existing, getErr := s.client.GetPromotionCode(ctx, persistedPromotionID)
		if getErr != nil {
			return nil, wrapRecallStripeError("get Stripe Promotion Code", getErr)
		}
		if existing == nil || strings.TrimSpace(existing.ID) != persistedPromotionID {
			return nil, recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code response does not match requested Promotion Code")
		}
		if reconcileErr := validateExistingRecallPromotion(existing, recipient, coupon.ID, customerID, expiresAt, normalizedDiscount); reconcileErr != nil {
			return nil, reconcileErr
		}
		return existing, nil
	}

	for attempt := 1; attempt <= 5; attempt++ {
		code := baseCode
		if attempt > 1 {
			code = deriveRecallPromotionCode(baseCode, campaign.Id, recipient.Id, attempt)
		}
		params := buildRecallPromotionParams(ctx, campaign.Id, recipient.Id, promotionUserID, attempt, coupon.ID, customerID, code, expiresAt, normalizedDiscount)
		created, createErr := recallStripeCreateWithRetry("create Stripe Promotion Code", func() (*stripe.PromotionCode, error) {
			if guardErr := s.beforeExternalCall(ctx); guardErr != nil {
				return nil, guardErr
			}
			return s.client.CreatePromotionCode(ctx, params)
		})
		if createErr == nil {
			if created == nil || strings.TrimSpace(created.ID) == "" {
				return nil, recallStripePermanent("create Stripe Promotion Code", "Stripe returned an empty Promotion Code")
			}
			return created, nil
		}
		if isRecallPromotionCodeCollision(createErr) {
			continue
		}
		return nil, createErr
	}
	return nil, recallStripePermanent("create Stripe Promotion Code", "promotion code collision limit reached")
}

func buildRecallPromotionParams(ctx context.Context, campaignID int64, recipientID int64, userID int, attempt int, couponID string, customerID string, code string, expiresAt int64, discount RecallDiscountConfig) *stripe.PromotionCodeParams {
	params := &stripe.PromotionCodeParams{
		Code:           stripe.String(code),
		ExpiresAt:      stripe.Int64(expiresAt),
		MaxRedemptions: stripe.Int64(1),
		Promotion: &stripe.PromotionCodePromotionParams{
			Coupon: stripe.String(couponID),
			Type:   stripe.String(string(stripe.PromotionCodePromotionTypeCoupon)),
		},
		Metadata: map[string]string{
			"recall_campaign_id":  strconv.FormatInt(campaignID, 10),
			"recall_recipient_id": strconv.FormatInt(recipientID, 10),
		},
	}
	if customerID != "" {
		params.Customer = stripe.String(customerID)
	}
	if userID > 0 {
		params.Metadata["flatkey_user_id"] = strconv.Itoa(userID)
	}
	params.Context = ctx
	if discount.MinimumAmount > 0 {
		params.Restrictions = &stripe.PromotionCodeRestrictionsParams{
			MinimumAmount:         stripe.Int64(discount.MinimumAmount),
			MinimumAmountCurrency: stripe.String(discount.MinimumAmountCurrency),
		}
	}
	params.SetIdempotencyKey(fmt.Sprintf("recall_promotion:%d:%d:%d", campaignID, recipientID, attempt))
	return params
}

func normalizeRecallPromotionCode(raw string) string {
	raw = strings.TrimSpace(raw)
	if len(raw) >= 2 && strings.EqualFold(raw[:2], "FK") {
		raw = raw[2:]
	}
	var normalized strings.Builder
	normalized.WriteString("FK")
	for _, char := range strings.ToUpper(raw) {
		switch {
		case char >= 'A' && char <= 'Z':
			if char == 'I' || char == 'L' || char == 'O' {
				normalized.WriteByte('X')
			} else {
				normalized.WriteRune(char)
			}
		case char >= '2' && char <= '9':
			normalized.WriteRune(char)
		case char == '0' || char == '1':
			normalized.WriteByte('X')
		}
	}
	return normalized.String()
}

func deriveRecallPromotionCode(baseCode string, campaignID int64, recipientID int64, attempt int) string {
	const safeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	material := fmt.Sprintf("%s:%d:%d:%d", baseCode, campaignID, recipientID, attempt)
	digest := sha256.Sum256([]byte(material))
	var derived strings.Builder
	derived.WriteString("FK")
	for i := 0; i < 16; i++ {
		derived.WriteByte(safeAlphabet[int(digest[i])%len(safeAlphabet)])
	}
	return derived.String()
}

func isRecallPromotionCodeCollision(err error) bool {
	var stripeError *stripe.Error
	if !errors.As(err, &stripeError) || stripeError.Type != stripe.ErrorTypeInvalidRequest || !strings.EqualFold(strings.TrimSpace(stripeError.Param), "code") {
		return false
	}
	detail := strings.ToLower(string(stripeError.Code) + " " + stripeError.Msg)
	for _, marker := range []string{"unique", "duplicate", "already active", "already exists", "in use"} {
		if strings.Contains(detail, marker) {
			return true
		}
	}
	return false
}

func validateExistingRecallPromotion(existing *stripe.PromotionCode, recipient model.RecallRecipient, couponID string, customerID string, expiresAt int64, discount RecallDiscountConfig) error {
	if existing == nil {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code is unavailable")
	}
	if !existing.Active {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s is inactive", existing.ID)
	}
	if existing.Promotion == nil || existing.Promotion.Coupon == nil || existing.Promotion.Coupon.ID != couponID {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s coupon does not match", existing.ID)
	}
	if customerID == "" {
		if existing.Customer != nil {
			return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s customer does not match", existing.ID)
		}
	} else if existing.Customer == nil || existing.Customer.ID != customerID {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s customer does not match", existing.ID)
	}
	if existing.ExpiresAt != expiresAt {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s expiration does not match", existing.ID)
	}
	if existing.MaxRedemptions != 1 || existing.TimesRedeemed >= 1 {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s redemption state does not match", existing.ID)
	}
	if recipient.PromotionCode != existing.Code {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s code does not match", existing.ID)
	}
	if existing.Restrictions != nil && existing.Restrictions.FirstTimeTransaction {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s first-time transaction restriction is not supported", existing.ID)
	}
	if existing.Restrictions != nil && len(existing.Restrictions.CurrencyOptions) > 0 {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s currency options are not supported", existing.ID)
	}
	if discount.MinimumAmount > 0 {
		if existing.Restrictions == nil || existing.Restrictions.MinimumAmount != discount.MinimumAmount || string(existing.Restrictions.MinimumAmountCurrency) != discount.MinimumAmountCurrency {
			return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s minimum restriction does not match", existing.ID)
		}
	} else if existing.Restrictions != nil && (existing.Restrictions.MinimumAmount != 0 || existing.Restrictions.MinimumAmountCurrency != "") {
		return recallStripePermanent("reconcile Stripe Promotion Code", "Stripe Promotion Code %s minimum restriction does not match", existing.ID)
	}
	return nil
}
