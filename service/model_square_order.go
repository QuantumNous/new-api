package service

import (
	"cmp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ModelSquareOrder lists model names for the model square sorts. Models
// missing from a list follow it by name. It holds no usage figures, because
// the model square can be public while the rankings page is off.
type ModelSquareOrder struct {
	Recommended []string `json:"recommended"`
	Requests    []string `json:"requests"`
	Tokens      []string `json:"tokens"`
}

type modelUsageCacheItem struct {
	expiresAt time.Time
	totals    []model.ModelUsageTotal
}

var (
	modelUsageCacheMu sync.Mutex
	modelUsageCache   = map[int]modelUsageCacheItem{}
)

// GetModelUsageTotals returns each model's usage over the last days, cached
// like the rankings. Without dashboard data there is no usage.
func GetModelUsageTotals(days int) ([]model.ModelUsageTotal, error) {
	if !common.DataExportEnabled {
		return nil, nil
	}
	now := time.Now()
	modelUsageCacheMu.Lock()
	item, ok := modelUsageCache[days]
	modelUsageCacheMu.Unlock()
	if ok && now.Before(item.expiresAt) {
		return item.totals, nil
	}

	totals, err := model.GetModelUsageTotals(now.AddDate(0, 0, -days).Unix(), now.Unix())
	if err != nil {
		return nil, err
	}
	modelUsageCacheMu.Lock()
	modelUsageCache[days] = modelUsageCacheItem{expiresAt: now.Add(rankingCacheTTL), totals: totals}
	modelUsageCacheMu.Unlock()
	return totals, nil
}

// BuildModelSquareOrder orders the listed models for the model square sorts.
// Names that are not listed are left out.
func BuildModelSquareOrder(pricing []model.Pricing) ModelSquareOrder {
	listed := make(map[string]struct{}, len(pricing))
	for _, item := range pricing {
		listed[item.ModelName] = struct{}{}
	}
	setting := operation_setting.GetModelSquareSetting()
	totals, err := GetModelUsageTotals(setting.SortDays)
	if err != nil {
		common.SysError(common.LogText("failed to load model usage for the model square: %s", err.Error()))
	}
	order := ModelSquareOrder{
		Requests: modelNamesByUsage(totals, operation_setting.ModelSquareMetricRequests, listed),
		Tokens:   modelNamesByUsage(totals, operation_setting.ModelSquareMetricTokens, listed),
	}
	byMetric := order.Tokens
	if setting.SortMetric == operation_setting.ModelSquareMetricRequests {
		byMetric = order.Requests
	}
	if setting.SortMode == operation_setting.ModelSquareSortUsage {
		order.Recommended = byMetric
		return order
	}

	order.Recommended = make([]string, 0, len(setting.SortModels))
	for _, name := range setting.SortModels {
		if _, ok := listed[name]; ok && !slices.Contains(order.Recommended, name) {
			order.Recommended = append(order.Recommended, name)
		}
	}
	if setting.SortMode == operation_setting.ModelSquareSortMixed {
		pinned := len(order.Recommended)
		for _, name := range byMetric {
			if !slices.Contains(order.Recommended[:pinned], name) {
				order.Recommended = append(order.Recommended, name)
			}
		}
	}
	return order
}

// modelNamesByUsage lists the listed models that have usage of the metric,
// most used first and equal usage in byte order, as the web console does.
func modelNamesByUsage(totals []model.ModelUsageTotal, metric string, listed map[string]struct{}) []string {
	usage := make(map[string]int64, len(totals))
	names := make([]string, 0, len(totals))
	for _, total := range totals {
		value := total.Tokens
		if metric == operation_setting.ModelSquareMetricRequests {
			value = total.Requests
		}
		if _, ok := listed[total.ModelName]; ok && value > 0 {
			usage[total.ModelName] = value
			names = append(names, total.ModelName)
		}
	}
	slices.SortFunc(names, func(a, b string) int {
		return cmp.Or(cmp.Compare(usage[b], usage[a]), strings.Compare(a, b))
	})
	return names
}
