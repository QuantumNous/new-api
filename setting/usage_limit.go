package setting

import (
	"errors"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// Monthly allowances, keyed by user group exactly like ModelRequestRateLimitGroup.
// 0 means uncapped for cost (Pro is bounded by its subscription pool instead)
// and none-allowed for images. An unknown group is uncapped: a group must opt
// in to a ceiling rather than inherit one.
var (
	monthlyLimitMu         sync.RWMutex
	MonthlyCostLimitGroup  = map[string]int64{}
	MonthlyImageLimitGroup = map[string]int{}
)

func MonthlyCostLimitGroup2JSONString() string {
	monthlyLimitMu.RLock()
	defer monthlyLimitMu.RUnlock()
	b, err := common.Marshal(MonthlyCostLimitGroup)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func UpdateMonthlyCostLimitGroupByJSONString(jsonStr string) error {
	monthlyLimitMu.Lock()
	defer monthlyLimitMu.Unlock()
	MonthlyCostLimitGroup = make(map[string]int64)
	return common.Unmarshal([]byte(jsonStr), &MonthlyCostLimitGroup)
}

func GetMonthlyCostLimit(group string) int64 {
	monthlyLimitMu.RLock()
	defer monthlyLimitMu.RUnlock()
	return MonthlyCostLimitGroup[group]
}

func CheckMonthlyCostLimitGroup(jsonStr string) error {
	check := make(map[string]int64)
	if err := common.Unmarshal([]byte(jsonStr), &check); err != nil {
		return err
	}
	for group, limit := range check {
		if limit < 0 {
			return errors.New("monthly cost limit must be >= 0 for group " + group)
		}
	}
	return nil
}

func MonthlyImageLimitGroup2JSONString() string {
	monthlyLimitMu.RLock()
	defer monthlyLimitMu.RUnlock()
	b, err := common.Marshal(MonthlyImageLimitGroup)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func UpdateMonthlyImageLimitGroupByJSONString(jsonStr string) error {
	monthlyLimitMu.Lock()
	defer monthlyLimitMu.Unlock()
	MonthlyImageLimitGroup = make(map[string]int)
	return common.Unmarshal([]byte(jsonStr), &MonthlyImageLimitGroup)
}

// GetMonthlyImageLimit reports the group's configured image limit and whether
// the group is present in the map at all. A group configured at 0 (found=true)
// deliberately gets no images; a group absent from the map (found=false) has
// no entitlement configured yet and must not be treated the same way — see
// service.CheckUsageAllowance, which only enforces the limit when found.
func GetMonthlyImageLimit(group string) (int, bool) {
	monthlyLimitMu.RLock()
	defer monthlyLimitMu.RUnlock()
	limit, found := MonthlyImageLimitGroup[group]
	return limit, found
}

func CheckMonthlyImageLimitGroup(jsonStr string) error {
	check := make(map[string]int)
	if err := common.Unmarshal([]byte(jsonStr), &check); err != nil {
		return err
	}
	for group, limit := range check {
		if limit < 0 {
			return errors.New("monthly image limit must be >= 0 for group " + group)
		}
	}
	return nil
}
