package model

import "slices"

// resolveChannelPriority keeps retry positions stable when the live candidate
// set changes during a request. A nil plan captures the current priorities;
// subsequent calls use that snapshot and only test which levels remain live.
func resolveChannelPriority(currentPriorities []int64, retry int, priorityPlan []int64) (int64, []int64, bool) {
	if len(currentPriorities) == 0 {
		return 0, priorityPlan, false
	}
	if priorityPlan == nil {
		priorityPlan = slices.Clone(currentPriorities)
	}
	if len(priorityPlan) == 0 {
		return 0, priorityPlan, false
	}

	available := make(map[int64]struct{}, len(currentPriorities))
	for _, priority := range currentPriorities {
		available[priority] = struct{}{}
	}

	liveRetry := max(retry, 0)
	planRetry := min(liveRetry, len(priorityPlan)-1)
	for i := planRetry; i < len(priorityPlan); i++ {
		if _, ok := available[priorityPlan[i]]; ok {
			return priorityPlan[i], priorityPlan, true
		}
	}
	// Preserve the existing lowest-live-priority fallback after the plan has
	// been exhausted or its lower levels were disabled during the request.
	for i := len(priorityPlan) - 1; i >= 0; i-- {
		if _, ok := available[priorityPlan[i]]; ok {
			return priorityPlan[i], priorityPlan, true
		}
	}
	// The candidate source can legitimately change during a request, for
	// example when exact-model channels disappear and normalized-model fallback
	// takes over. If none of the snapshotted levels survives, retain availability
	// by applying the legacy retry index to the new live set.
	liveRetry = min(liveRetry, len(currentPriorities)-1)
	return currentPriorities[liveRetry], priorityPlan, true
}
