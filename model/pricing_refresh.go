package model

// RefreshPricing 强制立即重新计算与定价相关的缓存。
// 该方法用于需要最新数据的内部管理 API，
// 因此会绕过默认的 1 分钟延迟刷新。
func RefreshPricing() {
	// 快照运营配置须在持 updatePricingLock 之前（避免锁序反转，见 GetPricing）。
	imgRaw, vidRaw := snapshotMediaConfigs()

	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()

	modelSupportEndpointsLock.Lock()
	defer modelSupportEndpointsLock.Unlock()

	updatePricing(imgRaw, vidRaw)
}
