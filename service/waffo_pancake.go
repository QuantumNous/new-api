package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	pancake "github.com/waffo-com/waffo-pancake-sdk-go"
)

// -----------------------------------------------------------------------------
// Public types (preserved shapes the controller depends on)
// -----------------------------------------------------------------------------

// WaffoPancakePriceSnapshot is the per-session price override sent with checkout.
type WaffoPancakePriceSnapshot struct {
	Amount      string
	TaxCategory string
}

// WaffoPancakeCreateSessionParams is the input to CreateWaffoPancakeCheckoutSession.
//
// Intentionally simpler than the previous hand-rolled struct:
//   - StoreID is dropped — the server derives the store from ProductID
//   - Currency is dropped — Pancake only supports USD for new-api top-ups
//   - ProductType is dropped — the SDK does not model it client-side
//   - SuccessURL is dropped — bound to the auto-created Product once via
//     EnsureWaffoPancakePrimaryProduct; the operator never sets it per-checkout
//
// BuyerIdentity binds the checkout session to a stable merchant-controlled
// user ID (typically `new-api-user-<UserId>`). This is what makes the order
// resilient to the buyer editing the email on the Waffo checkout form, and
// what lets Pancake issue scoped session tokens for post-purchase self-service
// (refund tickets, subscription cancellation, etc.) bound to this user.
type WaffoPancakeCreateSessionParams struct {
	ProductID        string
	BuyerIdentity    string
	PriceSnapshot    *WaffoPancakePriceSnapshot
	BuyerEmail       string
	ExpiresInSeconds *int
}

// WaffoPancakeCheckoutSession is the response of CreateWaffoPancakeCheckoutSession.
//
// Token / TokenExpiresAt are populated by the SDK's Authenticated checkout
// flow. CheckoutURL already has the `#token=...` fragment appended, so simply
// redirecting the buyer to CheckoutURL is enough for the basic flow. The
// fields are also exposed separately for use cases that want to drive buyer
// self-service from new-api's own UI (e.g., issue refund / cancel subscription
// without leaving new-api).
type WaffoPancakeCheckoutSession struct {
	SessionID      string
	CheckoutURL    string
	ExpiresAt      string
	OrderID        string
	Token          string
	TokenExpiresAt string
}

// waffoPancakeWebhookEvent is the verified webhook payload as exposed to
// controllers. The shape mirrors the SDK's WebhookEvent/WebhookEventData but
// uses plain strings so controllers don't have to import the SDK package.
type waffoPancakeWebhookEvent struct {
	ID        string
	Timestamp string
	EventType string
	EventID   string
	StoreID   string
	Mode      string
	Data      waffoPancakeWebhookData
}

type waffoPancakeWebhookData struct {
	OrderID                       string
	BuyerEmail                    string
	Currency                      string
	Amount                        string
	TaxAmount                     string
	ProductName                   string
	MerchantProvidedBuyerIdentity string
}

// NormalizedEventType returns the event type or empty string for a nil event.
func (e *waffoPancakeWebhookEvent) NormalizedEventType() string {
	if e == nil {
		return ""
	}
	return e.EventType
}

// -----------------------------------------------------------------------------
// SDK client construction
// -----------------------------------------------------------------------------

// waffoPancakeGraphQLEnvelopeFixTransport works around a response-decoding bug
// in waffo-pancake-sdk-go v0.1.1: the SDK assumes the HTTP body is a doubly-
// wrapped envelope of the form
//
//	{"data": {"data": ..., "errors": [...], "warnings": [...]}}
//
// but the live `/v1/graphql` endpoint returns the standard single-wrap
// GraphQL envelope:
//
//	{"data": ..., "errors": [...]}
//
// After the SDK strips the outer `data`, what remains is e.g. `{"stores":...}`,
// which doesn't match the SDK's `GraphQLResponse{Data, Errors, Warnings}`
// struct — so every field of `GraphQLResponse` ends up empty and the caller
// sees a silently-empty response.
//
// To unblock new-api without forking the SDK, we wrap the response body in an
// additional `{"data": ...}` envelope so the SDK's outer unwrap leaves the
// standard GraphQL envelope behind for `GraphQLResponse` to decode normally.
//
// Scope: only `/v1/graphql` requests are touched. Every other endpoint already
// uses the single-wrapped envelope the SDK expects and works unaltered.
//
// Drop this once the upstream SDK fix lands.
type waffoPancakeGraphQLEnvelopeFixTransport struct {
	inner http.RoundTripper
}

func (t *waffoPancakeGraphQLEnvelopeFixTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	inner := t.inner
	if inner == nil {
		inner = http.DefaultTransport
	}
	// Strip the SDK-auto-generated X-Idempotency-Key for GraphQL queries.
	// Idempotency keys belong on state-changing operations (create / update /
	// delete) where they protect against duplicate side effects from retries
	// and double-clicks. The SDK applies them indiscriminately to every POST,
	// including GraphQL queries — and Pancake server-side dedupes on the
	// key, which means an identical query body served a stale snapshot back
	// from before any newly-created entity existed (a freshly-minted Store
	// or Product would never appear in the catalog dropdown). Reads should
	// always be fresh; queries are reads.
	//
	// Mutating the request in RoundTrip is technically against the
	// http.RoundTripper contract, but we're the sole owner of this transport
	// and the inner transport (http.DefaultTransport) only reads the header
	// once during request serialisation, so the deletion is safe.
	if strings.HasSuffix(req.URL.Path, "/v1/graphql") {
		req.Header.Del("X-Idempotency-Key")
	}
	resp, err := inner.RoundTrip(req)
	if err != nil || resp == nil {
		return resp, err
	}
	if !strings.HasSuffix(req.URL.Path, "/v1/graphql") {
		return resp, nil
	}
	body, readErr := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if readErr != nil {
		return resp, readErr
	}
	if len(bytes.TrimSpace(body)) == 0 {
		resp.Body = io.NopCloser(bytes.NewReader(body))
		return resp, nil
	}
	wrapped := make([]byte, 0, len(body)+9)
	wrapped = append(wrapped, []byte(`{"data":`)...)
	wrapped = append(wrapped, body...)
	wrapped = append(wrapped, '}')
	resp.Body = io.NopCloser(bytes.NewReader(wrapped))
	resp.ContentLength = int64(len(wrapped))
	return resp, nil
}

// newWaffoPancakeHTTPClient returns a fresh *http.Client preconfigured with
// the GraphQL envelope-fix transport. Every SDK client builder below must use
// this so GraphQL queries actually decode.
func newWaffoPancakeHTTPClient() *http.Client {
	return &http.Client{Transport: &waffoPancakeGraphQLEnvelopeFixTransport{inner: http.DefaultTransport}}
}

// newWaffoPancakeClient builds a fresh SDK client from the current settings.
// Used by the runtime checkout / webhook paths, where credentials are already
// persisted and trusted.
//
// Configuration endpoints should use newWaffoPancakeClientFromCreds instead so
// the operator can verify / mint entities with typed-but-not-yet-saved
// credentials.
func newWaffoPancakeClient() (*pancake.Client, error) {
	return pancake.New(pancake.Config{
		MerchantID: setting.WaffoPancakeMerchantID,
		PrivateKey: setting.WaffoPancakePrivateKey,
		HTTPClient: newWaffoPancakeHTTPClient(),
	})
}

// newWaffoPancakeClientFromCreds builds an SDK client from explicit
// credentials supplied by the configuration UI. These values come straight
// from the operator's input fields and are NOT persisted to settings — the
// final Save action is what writes them through.
func newWaffoPancakeClientFromCreds(merchantID, privateKey string) (*pancake.Client, error) {
	if strings.TrimSpace(merchantID) == "" || strings.TrimSpace(privateKey) == "" {
		return nil, fmt.Errorf("merchant id and private key are required")
	}
	return pancake.New(pancake.Config{
		MerchantID: merchantID,
		PrivateKey: privateKey,
		HTTPClient: newWaffoPancakeHTTPClient(),
	})
}

// -----------------------------------------------------------------------------
// Checkout
// -----------------------------------------------------------------------------

// CreateWaffoPancakeCheckoutSession creates an authenticated checkout session
// via the official Pancake SDK.
//
// "Authenticated" mode binds the order to a merchant-controlled buyer identity
// (here: the new-api User.Id), so the order remains attributable to the right
// user even if the buyer edits the email on the Waffo checkout form. The SDK
// also issues a scoped session token in parallel and appends `#token=...` to
// the returned CheckoutURL — buyers landing on the checkout page get the token
// for free, and merchants can also drive post-purchase self-service flows
// (refund, cancel subscription) from new-api's own UI using the Token field
// returned below.
func CreateWaffoPancakeCheckoutSession(ctx context.Context, params *WaffoPancakeCreateSessionParams) (*WaffoPancakeCheckoutSession, error) {
	if params == nil {
		return nil, fmt.Errorf("missing checkout params")
	}
	if strings.TrimSpace(params.BuyerIdentity) == "" {
		return nil, fmt.Errorf("missing buyer identity")
	}
	client, err := newWaffoPancakeClient()
	if err != nil {
		return nil, fmt.Errorf("build Waffo Pancake client: %w", err)
	}

	sdkParams := pancake.AuthenticatedCheckoutParams{
		CreateCheckoutSessionParams: pancake.CreateCheckoutSessionParams{
			ProductID:        params.ProductID,
			Currency:         "USD",
			BuyerEmail:       optionalString(params.BuyerEmail),
			ExpiresInSeconds: params.ExpiresInSeconds,
		},
		BuyerIdentity: params.BuyerIdentity,
	}
	if params.PriceSnapshot != nil {
		sdkParams.PriceSnapshot = &pancake.PriceInfo{
			Amount:      params.PriceSnapshot.Amount,
			TaxCategory: pancake.TaxCategory(params.PriceSnapshot.TaxCategory),
		}
	}

	session, err := client.Checkout.Authenticated.Create(ctx, sdkParams)
	if err != nil {
		return nil, err
	}
	if session == nil || strings.TrimSpace(session.CheckoutURL) == "" || strings.TrimSpace(session.SessionID) == "" {
		return nil, fmt.Errorf("Waffo Pancake returned empty checkout session")
	}
	return &WaffoPancakeCheckoutSession{
		SessionID:      session.SessionID,
		CheckoutURL:    session.CheckoutURL,
		ExpiresAt:      session.ExpiresAt,
		Token:          session.Token,
		TokenExpiresAt: session.TokenExpiresAt,
	}, nil
}

func optionalString(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	v := s
	return &v
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// WaffoPancakeBuyerIdentityFromUserID renders the canonical buyer identity
// string used at checkout for a given new-api user. The webhook handler and
// the checkout request must both call this so the strings stay in lock-step:
// any divergence would surface as an identity-mismatch failure during
// webhook processing.
func WaffoPancakeBuyerIdentityFromUserID(userID int) string {
	return fmt.Sprintf("new-api-user-%d", userID)
}

// -----------------------------------------------------------------------------
// Webhook
// -----------------------------------------------------------------------------

// VerifyConfiguredWaffoPancakeWebhook verifies the X-Waffo-Signature header
// against the raw payload.
//
// Environment detection is fully delegated to the SDK: it reads the `mode`
// field from the payload and picks the matching built-in public key (test or
// prod) automatically. No client-side sandbox toggle is involved.
func VerifyConfiguredWaffoPancakeWebhook(payload string, signatureHeader string) (*waffoPancakeWebhookEvent, error) {
	sdkEvent, err := pancake.VerifyWebhook(payload, signatureHeader, nil)
	if err != nil {
		return nil, err
	}
	var data pancake.WebhookEventData
	if err := json.Unmarshal(sdkEvent.Data, &data); err != nil {
		return nil, fmt.Errorf("decode Waffo Pancake webhook data: %w", err)
	}
	return &waffoPancakeWebhookEvent{
		ID:        sdkEvent.ID,
		Timestamp: sdkEvent.Timestamp,
		EventType: sdkEvent.EventType,
		EventID:   sdkEvent.EventID,
		StoreID:   sdkEvent.StoreID,
		Mode:      string(sdkEvent.Mode),
		Data: waffoPancakeWebhookData{
			OrderID:                       data.OrderID,
			BuyerEmail:                    data.BuyerEmail,
			Currency:                      data.Currency,
			Amount:                        data.Amount,
			TaxAmount:                     data.TaxAmount,
			ProductName:                   data.ProductName,
			MerchantProvidedBuyerIdentity: derefString(data.MerchantProvidedBuyerIdentity),
		},
	}, nil
}

// ResolveWaffoPancakeTradeNo maps a verified webhook event back to a local
// TopUp trade_no, and verifies that the buyer identity Pancake echoed back
// matches the one we generated for that user at checkout time.
//
// Defence-in-depth on top of the X-Waffo-Signature check: even if a webhook
// payload survives signature verification, a mismatched
// merchantProvidedBuyerIdentity is a strong signal that the order has been
// tampered with or wires got crossed between merchants — treat it as a hard
// rejection rather than crediting the wrong account.
func ResolveWaffoPancakeTradeNo(event *waffoPancakeWebhookEvent) (string, error) {
	if event == nil {
		return "", fmt.Errorf("missing webhook event")
	}
	tradeNo := strings.TrimSpace(event.Data.OrderID)
	if tradeNo == "" {
		return "", fmt.Errorf("missing webhook orderId")
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	// Use PaymentProvider rather than PaymentMethod here so the guard matches
	// model.RechargeWaffoPancake's cross-gateway defence (a7c38ec8). Both
	// fields are written to the same value on insert, but PaymentProvider is
	// the one that survives any future per-user PaymentMethod customisation.
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderWaffoPancake {
		return "", fmt.Errorf("waffo pancake order not found for webhook orderId=%s", tradeNo)
	}
	expectedIdentity := WaffoPancakeBuyerIdentityFromUserID(topUp.UserId)
	actualIdentity := strings.TrimSpace(event.Data.MerchantProvidedBuyerIdentity)
	if actualIdentity != expectedIdentity {
		return "", fmt.Errorf(
			"waffo pancake buyer identity mismatch for tradeNo=%s: expected=%q actual=%q",
			tradeNo,
			expectedIdentity,
			actualIdentity,
		)
	}
	return tradeNo, nil
}

// ResolveWaffoPancakeSubscriptionTradeNo is the SubscriptionOrder-side
// counterpart of ResolveWaffoPancakeTradeNo: same buyer-identity defence in
// depth, but looks up a SubscriptionOrder (created by
// SubscriptionRequestWaffoPancakePay) instead of a TopUp.
//
// Returns the trade_no so the webhook handler can pass it straight to
// model.CompleteSubscriptionOrder.
func ResolveWaffoPancakeSubscriptionTradeNo(event *waffoPancakeWebhookEvent) (string, error) {
	if event == nil {
		return "", fmt.Errorf("missing webhook event")
	}
	tradeNo := strings.TrimSpace(event.Data.OrderID)
	if tradeNo == "" {
		return "", fmt.Errorf("missing webhook orderId")
	}
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil || order.PaymentProvider != model.PaymentProviderWaffoPancake {
		return "", fmt.Errorf("waffo pancake subscription order not found for webhook orderId=%s", tradeNo)
	}
	expectedIdentity := WaffoPancakeBuyerIdentityFromUserID(order.UserId)
	actualIdentity := strings.TrimSpace(event.Data.MerchantProvidedBuyerIdentity)
	if actualIdentity != expectedIdentity {
		return "", fmt.Errorf(
			"waffo pancake buyer identity mismatch for subscription tradeNo=%s: expected=%q actual=%q",
			tradeNo,
			expectedIdentity,
			actualIdentity,
		)
	}
	return tradeNo, nil
}

// -----------------------------------------------------------------------------
// Auto-provisioning
// -----------------------------------------------------------------------------

// Default names used when the operator clicks "Create new". They are kept as
// constants here so the frontend can render the exact name that will be
// created (transparency), and so the body that goes to Pancake is fully
// deterministic — the SDK's auto-generated X-Idempotency-Key is then stable
// across retries / double-clicks, which lets Pancake dedupe server-side.
const (
	defaultWaffoPancakeStoreName   = "new-api-store"
	defaultWaffoPancakeProductName = "new-api-charge-product"
)

// CreateWaffoPancakePrimaryStore creates a Pancake Store using the operator's
// in-flight credentials (NOT yet persisted to settings). The returned ID is
// passed back to the frontend so the operator can confirm before final Save.
func CreateWaffoPancakePrimaryStore(ctx context.Context, merchantID, privateKey string) (string, error) {
	client, err := newWaffoPancakeClientFromCreds(merchantID, privateKey)
	if err != nil {
		return "", err
	}
	storeRes, err := client.Stores.Create(ctx, pancake.CreateStoreParams{
		Name: defaultWaffoPancakeStoreName,
	})
	if err != nil {
		return "", fmt.Errorf("create Waffo Pancake store: %w", err)
	}
	return storeRes.Store.ID, nil
}

// CreateWaffoPancakePrimaryProduct mints a Pancake OnetimeProduct in the given
// store using the operator's in-flight credentials. 1 USD placeholder price
// (overridden per checkout via PriceSnapshot); SuccessURL is set from the
// supplied returnURL when non-empty. Publishes before returning.
//
// CreateWaffoPancakeProductForPlan mints a Pancake OnetimeProduct sized to
// a specific subscription plan: the buyer pays the plan's `amount` USD up
// front, and the resulting PROD_ ID is what gets pinned to
// SubscriptionPlan.WaffoPancakeProductId.
//
// Why OnetimeProduct (not SubscriptionProduct): new-api models
// subscriptions as time-limited prepayments — UserSubscription has a fixed
// expiration and renewal is a manual re-purchase. There's no renewal-event
// handling on the webhook side, mirroring how the existing Stripe
// integration works. OnetimeProduct semantics line up cleanly: each
// purchase is a discrete payment that activates one fixed-duration
// subscription period. Switch to SubscriptionProduct only if/when new-api
// itself starts handling auto-renewal events.
//
// The returned product is published — buyers can hit it from checkout
// immediately. SuccessURL is bound to the same Return URL the operator
// saved for the wallet flow.
func CreateWaffoPancakeProductForPlan(ctx context.Context, merchantID, privateKey, storeID, name, amount, returnURL string) (string, error) {
	storeID = strings.TrimSpace(storeID)
	if storeID == "" {
		return "", fmt.Errorf("store id is required to create a product")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("plan name is required")
	}
	amount = strings.TrimSpace(amount)
	if amount == "" {
		return "", fmt.Errorf("plan price is required")
	}
	client, err := newWaffoPancakeClientFromCreds(merchantID, privateKey)
	if err != nil {
		return "", err
	}
	prodRes, err := client.OnetimeProducts.Create(ctx, pancake.CreateOnetimeProductParams{
		StoreID: storeID,
		Name:    name,
		Prices: pancake.Prices{
			"USD": {
				Amount:      amount,
				TaxCategory: pancake.TaxCategory("saas"),
			},
		},
		SuccessURL: optionalString(strings.TrimSpace(returnURL)),
	})
	if err != nil {
		return "", fmt.Errorf("create Waffo Pancake plan product: %w", err)
	}
	productID := prodRes.Product.ID
	if _, err := client.OnetimeProducts.Publish(ctx, pancake.PublishOnetimeProductParams{ID: productID}); err != nil {
		return "", fmt.Errorf("publish Waffo Pancake plan product: %w", err)
	}
	return productID, nil
}

// Like the store helper, this only talks to Pancake — nothing is written to
// new-api settings until the operator clicks final Save.
func CreateWaffoPancakePrimaryProduct(ctx context.Context, merchantID, privateKey, storeID, returnURL string) (string, error) {
	storeID = strings.TrimSpace(storeID)
	if storeID == "" {
		return "", fmt.Errorf("store id is required to create a product")
	}
	client, err := newWaffoPancakeClientFromCreds(merchantID, privateKey)
	if err != nil {
		return "", err
	}
	prodRes, err := client.OnetimeProducts.Create(ctx, pancake.CreateOnetimeProductParams{
		StoreID: storeID,
		Name:    defaultWaffoPancakeProductName,
		Prices: pancake.Prices{
			"USD": {
				Amount:      "1.00", // overridden at checkout via PriceSnapshot
				TaxCategory: pancake.TaxCategory("saas"),
			},
		},
		SuccessURL: optionalString(strings.TrimSpace(returnURL)),
	})
	if err != nil {
		return "", fmt.Errorf("create Waffo Pancake product: %w", err)
	}
	productID := prodRes.Product.ID
	if _, err := client.OnetimeProducts.Publish(ctx, pancake.PublishOnetimeProductParams{ID: productID}); err != nil {
		return "", fmt.Errorf("publish Waffo Pancake product: %w", err)
	}
	return productID, nil
}

// WaffoPancakePairResult is the response of CreateWaffoPancakePrimaryPair.
//
// On the unhappy path where Store creation succeeded but Product creation
// failed, ProductID + ProductName stay empty and OrphanStore is true so
// the caller can surface a useful "store landed at STO_xxx but product
// failed" message to the operator (and the next catalog refresh will
// surface that orphan store so they can retry product-only creation).
type WaffoPancakePairResult struct {
	StoreID     string
	StoreName   string
	ProductID   string
	ProductName string
	OrphanStore bool
}

// CreateWaffoPancakePrimaryPair mints a Pancake Store AND a Pancake
// OnetimeProduct in one shot, using the supplied in-flight credentials.
//
// This is the canonical "+ Create" entry point — the frontend never calls
// the Store / Product primitives independently. The wrapper exists so the
// controller can run the two SDK calls back-to-back, return both IDs to
// the operator in one round-trip, and produce a single coherent error on
// the unhappy path where the store landed but the product didn't.
//
// Nothing is persisted to settings — the operator's final Save action is
// what writes the chosen IDs to the OptionMap.
func CreateWaffoPancakePrimaryPair(ctx context.Context, merchantID, privateKey, returnURL string) (*WaffoPancakePairResult, error) {
	storeID, err := CreateWaffoPancakePrimaryStore(ctx, merchantID, privateKey)
	if err != nil {
		return nil, err
	}
	productID, err := CreateWaffoPancakePrimaryProduct(ctx, merchantID, privateKey, storeID, returnURL)
	if err != nil {
		return &WaffoPancakePairResult{
			StoreID:     storeID,
			StoreName:   defaultWaffoPancakeStoreName,
			OrphanStore: true,
		}, fmt.Errorf("store created at %s but product creation failed: %w", storeID, err)
	}
	return &WaffoPancakePairResult{
		StoreID:     storeID,
		StoreName:   defaultWaffoPancakeStoreName,
		ProductID:   productID,
		ProductName: defaultWaffoPancakeProductName,
	}, nil
}

// SaveWaffoPancakeConfig is the single atomic commit at the end of the
// configuration flow: it writes all five operator-controlled values to the
// OptionMap in one go (everything else has been transient up to this point).
// Pure local persistence — no Pancake API calls.
func SaveWaffoPancakeConfig(ctx context.Context, merchantID, privateKey, returnURL, storeID, productID string) error {
	merchantID = strings.TrimSpace(merchantID)
	storeID = strings.TrimSpace(storeID)
	productID = strings.TrimSpace(productID)
	if merchantID == "" || storeID == "" || productID == "" {
		return fmt.Errorf("merchant id, store id, and product id are required to save")
	}
	if err := model.UpdateOption("WaffoPancakeMerchantID", merchantID); err != nil {
		return fmt.Errorf("persist Waffo Pancake merchant id: %w", err)
	}
	// Blank private key means "keep whatever was previously saved", matching
	// the standard Stripe-style API-secret UX.
	if pk := strings.TrimSpace(privateKey); pk != "" {
		if err := model.UpdateOption("WaffoPancakePrivateKey", pk); err != nil {
			return fmt.Errorf("persist Waffo Pancake private key: %w", err)
		}
	}
	trimmedReturn := strings.TrimSpace(returnURL)
	if err := model.UpdateOption("WaffoPancakeReturnURL", trimmedReturn); err != nil {
		return fmt.Errorf("persist Waffo Pancake return URL: %w", err)
	}
	if err := model.UpdateOption("WaffoPancakeStoreID", storeID); err != nil {
		return fmt.Errorf("persist Waffo Pancake store id: %w", err)
	}
	if err := model.UpdateOption("WaffoPancakeProductID", productID); err != nil {
		return fmt.Errorf("persist Waffo Pancake product id: %w", err)
	}
	return nil
}

// -----------------------------------------------------------------------------
// Catalog browsing (for the "pick existing Store / Product" selector)
// -----------------------------------------------------------------------------

// WaffoPancakeCatalogProduct is one row in the product selector.
type WaffoPancakeCatalogProduct struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// WaffoPancakeCatalogStore is one row in the store selector, with the nested
// list of its onetime products so the UI can render a dependent select without
// a second round-trip.
type WaffoPancakeCatalogStore struct {
	ID               string                       `json:"id"`
	Name             string                       `json:"name"`
	Status           string                       `json:"status"`
	ProdEnabled      bool                         `json:"prodEnabled"`
	OnetimeProducts  []WaffoPancakeCatalogProduct `json:"onetimeProducts"`
}

// WaffoPancakeCatalog is the response of ListWaffoPancakeCatalog: every store
// the merchant owns, plus the onetime products under each store.
type WaffoPancakeCatalog struct {
	Stores []WaffoPancakeCatalogStore `json:"stores"`
}

// ListWaffoPancakeCatalog runs a single GraphQL query against Pancake using
// the operator's in-flight credentials (passed in directly, not read from
// settings) and returns the merchant's Stores nested with their
// OnetimeProducts. Doubles as a credential check — a successful response
// proves the supplied MerchantID + PrivateKey can authenticate.
func ListWaffoPancakeCatalog(ctx context.Context, merchantID, privateKey string) (*WaffoPancakeCatalog, error) {
	client, err := newWaffoPancakeClientFromCreds(merchantID, privateKey)
	if err != nil {
		return nil, err
	}

	type queryShape struct {
		Stores []WaffoPancakeCatalogStore `json:"stores"`
	}
	// The `stores` query applies a default pagination limit when none is
	// supplied — the live API returns just one store without the arg, even
	// when the merchant has more. Pass an explicit limit large enough to
	// cover any realistic operator catalog. If this ever needs to grow past
	// the cap we switch to paginated fetches via `offset`.
	resp, err := pancake.GraphQLQuery[queryShape](ctx, client, pancake.GraphQLParams{
		Query: `query {
			stores(limit: 100) {
				id
				name
				status
				prodEnabled
				onetimeProducts {
					id
					name
					status
				}
			}
		}`,
	})
	if err != nil {
		return nil, fmt.Errorf("query Waffo Pancake catalog: %w", err)
	}
	if len(resp.Errors) > 0 {
		return nil, fmt.Errorf("waffo pancake catalog query returned %d errors: %s",
			len(resp.Errors), resp.Errors[0].Message)
	}
	return &WaffoPancakeCatalog{Stores: resp.Data.Stores}, nil
}
