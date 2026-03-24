package common

import "os"

const BillingModeCoin = "coin"
const BillingModeInternal = "internal"

func GetBillingMode() string {
	if os.Getenv("BILLING_MODE") == BillingModeCoin {
		return BillingModeCoin
	}
	return BillingModeInternal
}
