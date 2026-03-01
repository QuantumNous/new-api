package dto

// --- Topup response types ---

type StripePayLinkData struct {
	PayLink string `json:"pay_link"`
}

type CreemPayData struct {
	CheckoutUrl string `json:"checkout_url"`
	OrderId     string `json:"order_id"`
}

type EpayPayResponse struct {
	Params interface{} `json:"params"`
	Url    string      `json:"url"`
}

type TopUpInfoData struct {
	EnableOnlineTopup bool                `json:"enable_online_topup"`
	EnableStripeTopup bool                `json:"enable_stripe_topup"`
	EnableCreemTopup  bool                `json:"enable_creem_topup"`
	CreemProducts     string              `json:"creem_products"`
	PayMethods        []map[string]string `json:"pay_methods"`
	MinTopup          int                 `json:"min_topup"`
	StripeMinTopup    int                 `json:"stripe_min_topup"`
	AmountOptions     []int               `json:"amount_options"`
	Discount          map[int]float64     `json:"discount"`
}

// --- Topup request types ---

// EpayRequest is the request body for POST /api/user/pay (epay).
type EpayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// AmountRequest is the request body for POST /api/user/amount.
type AmountRequest struct {
	Amount int64 `json:"amount"`
}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
}

// CreemPayRequest is the request body for POST /api/user/creem/pay.
type CreemPayRequest struct {
	ProductId     string `json:"product_id"`
	PaymentMethod string `json:"payment_method"`
}

// AdminCompleteTopupRequest is the request body for POST /api/user/topup/complete.
type AdminCompleteTopupRequest struct {
	TradeNo string `json:"trade_no"`
}
