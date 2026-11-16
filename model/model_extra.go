package model

func GetModelEnableGroups(modelName string) []string {
	// Make sure the cache is up to date
	GetPricing()

	if modelName == "" {
		return make([]string, 0)
	}

	modelEnableGroupsLock.RLock()
	groups, ok := modelEnableGroups[modelName]
	modelEnableGroupsLock.RUnlock()
	if !ok {
		return make([]string, 0)
	}
	return groups
}

// GetModelQuotaTypes returns the billing type collection of the specified model (from cache)
func GetModelQuotaTypes(modelName string) []int {
	GetPricing()

	modelEnableGroupsLock.RLock()
	quota, ok := modelQuotaTypeMap[modelName]
	modelEnableGroupsLock.RUnlock()
	if !ok {
		return []int{}
	}
	return []int{quota}
}
