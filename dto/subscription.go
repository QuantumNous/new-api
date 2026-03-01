package dto

// BillingPreferenceData is the response data for PUT /api/subscription/self/preference.
type BillingPreferenceData struct {
	BillingPreference string `json:"billing_preference"`
}

// BillingPreferenceRequest is the request body for PUT /api/subscription/self/preference.
type BillingPreferenceRequest struct {
	BillingPreference string `json:"billing_preference"`
}

// AdminUpdateSubscriptionPlanStatusRequest is the request body for PATCH /api/subscription/plans/:id.
type AdminUpdateSubscriptionPlanStatusRequest struct {
	Enabled *bool `json:"enabled"`
}

// AdminBindSubscriptionRequest is the request body for POST /api/subscription/bind.
type AdminBindSubscriptionRequest struct {
	UserId int `json:"user_id"`
	PlanId int `json:"plan_id"`
}

// AdminCreateUserSubscriptionRequest is the request body for POST /api/subscription/users/:id/subscriptions.
type AdminCreateUserSubscriptionRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionActionData is the response data for admin subscription actions
// that may include a warning message.
type SubscriptionActionData struct {
	Message string `json:"message,omitempty"`
}

// SubscriptionStripePayRequest is the request body for POST /api/subscription/stripe/pay.
type SubscriptionStripePayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionCreemPayRequest is the request body for POST /api/subscription/creem/pay.
type SubscriptionCreemPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionEpayPayRequest is the request body for POST /api/subscription/epay/pay.
type SubscriptionEpayPayRequest struct {
	PlanId        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
}
