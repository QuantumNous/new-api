package model

// RefreshPricing forces an immediate recalculation of pricing-related caches.
// This method is used for internal management APIs that require the latest data,
// Therefore the default 1 minute refresh delay is bypassed.
func RefreshPricing() {
	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()

	modelSupportEndpointsLock.Lock()
	defer modelSupportEndpointsLock.Unlock()

	updatePricing()
}
