package common

// SubscriptionSingleContractEnabled gates the single-contract subscription write path.
var SubscriptionSingleContractEnabled = GetEnvOrDefaultBool("SUBSCRIPTION_SINGLE_CONTRACT_ENABLED", true)
