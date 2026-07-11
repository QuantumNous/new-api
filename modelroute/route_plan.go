package modelroute

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// IsModelPriorityMode reports whether routing uses model-level priority (PRD §33).
// Default when unset is channel_priority (legacy) so existing deployments stay unchanged until migration.
func IsModelPriorityMode() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return false
	}
	return common.OptionMap[model.RoutingPriorityModeKey] == model.RoutingPriorityModeModel
}

// IsExperienceFirstBehavior reports routing_behavior_mode == experience_first (PRD §33).
func IsExperienceFirstBehavior() bool {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return true
	}
	v, ok := common.OptionMap[model.RoutingBehaviorModeKey]
	if !ok || v == "" {
		return true
	}
	return v == model.RoutingBehaviorExperienceFirst
}

// SetRoutingPriorityMode updates in-memory option map (persistence is caller's responsibility via model.UpdateOption).
func SetRoutingPriorityMode(mode string) {
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap[model.RoutingPriorityModeKey] = mode
}

var (
	routePlanMu    sync.RWMutex
	routePlanStore sync.Map // requested_model → *model.RoutePlan
)

// GetCachedRoutePlan returns a process-local RoutePlan if present.
func GetCachedRoutePlan(requestedModel string) *model.RoutePlan {
	if v, ok := routePlanStore.Load(requestedModel); ok {
		if p, ok := v.(*model.RoutePlan); ok {
			return p
		}
	}
	return nil
}

// StoreRoutePlan caches a RoutePlan for requested_model.
func StoreRoutePlan(plan *model.RoutePlan) {
	if plan == nil || plan.RequestedModel == "" {
		return
	}
	routePlanStore.Store(plan.RequestedModel, plan)
}

// InvalidateRoutePlan drops one cached plan.
func InvalidateRoutePlan(requestedModel string) {
	routePlanStore.Delete(requestedModel)
}

// InvalidateAllRoutePlans clears the process-local plan cache.
func InvalidateAllRoutePlans() {
	routePlanStore.Range(func(key, _ any) bool {
		routePlanStore.Delete(key)
		return true
	})
}

// GetOrBuildRoutePlan returns cached plan or rebuilds via BuildRoutePlanFromPolicies (PRD §7 / §10.4).
func GetOrBuildRoutePlan(requestedModel string) (*model.RoutePlan, error) {
	if p := GetCachedRoutePlan(requestedModel); p != nil {
		return p, nil
	}
	routePlanMu.Lock()
	defer routePlanMu.Unlock()
	if p := GetCachedRoutePlan(requestedModel); p != nil {
		return p, nil
	}
	plan, err := BuildRoutePlanFromPolicies(requestedModel)
	if err != nil {
		return nil, err
	}
	StoreRoutePlan(plan)
	return plan, nil
}
