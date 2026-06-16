package setting

var StripeApiSecret = ""
var StripeWebhookSecret = ""
var StripePriceId = ""
var StripeUnitPrice = 8.0
var StripeMinTopUp = 1
var StripePromotionCodesEnabled = false

// --- Card binding (SetupIntent postpaid) ---

// StripeCardBindEnabled is the master switch for the card-binding onboarding flow.
// When false: no onboarding redirect, no banner, no $10 bonus.
var StripeCardBindEnabled = false

// StripeAutoChargeEnabled toggles threshold-triggered automatic off-session charging.
var StripeAutoChargeEnabled = false

// StripeAutoChargeThreshold is the balance (in topup units / USD) below which an
// automatic charge is triggered for users with a bound card.
var StripeAutoChargeThreshold = 2

// StripeAutoChargeAmount is the USD amount (in topup units) charged each time an
// automatic top-up fires.
var StripeAutoChargeAmount = 20

// StripeNewUserBonusAmount is the USD amount (in topup units) granted once when a
// user binds their first card.
var StripeNewUserBonusAmount = 10
