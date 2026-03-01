package ratio_setting

import (
	"sync"
	"sync/atomic"
	"time"
)

const exposedDataTTL = 30 * time.Second

type ExposedRatioData struct {
	ModelRatio       map[string]float64 `json:"model_ratio"`
	CompletionRatio  map[string]float64 `json:"completion_ratio"`
	CacheRatio       map[string]float64 `json:"cache_ratio"`
	CreateCacheRatio map[string]float64 `json:"create_cache_ratio"`
	ModelPrice       map[string]float64 `json:"model_price"`
}

type exposedCache struct {
	data      ExposedRatioData
	expiresAt time.Time
}

var (
	exposedData atomic.Value
	rebuildMu   sync.Mutex
)

func InvalidateExposedDataCache() {
	exposedData.Store((*exposedCache)(nil))
}

func cloneFloatMap(src map[string]float64) map[string]float64 {
	if src == nil {
		return nil
	}
	dst := make(map[string]float64, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func (d ExposedRatioData) ToMap() map[string]any {
	return map[string]any{
		"model_ratio":        cloneFloatMap(d.ModelRatio),
		"completion_ratio":   cloneFloatMap(d.CompletionRatio),
		"cache_ratio":        cloneFloatMap(d.CacheRatio),
		"create_cache_ratio": cloneFloatMap(d.CreateCacheRatio),
		"model_price":        cloneFloatMap(d.ModelPrice),
	}
}

func GetExposedData() ExposedRatioData {
	if c, ok := exposedData.Load().(*exposedCache); ok && c != nil && time.Now().Before(c.expiresAt) {
		return c.data
	}
	rebuildMu.Lock()
	defer rebuildMu.Unlock()
	if c, ok := exposedData.Load().(*exposedCache); ok && c != nil && time.Now().Before(c.expiresAt) {
		return c.data
	}
	newData := ExposedRatioData{
		ModelRatio:       GetModelRatioCopy(),
		CompletionRatio:  GetCompletionRatioCopy(),
		CacheRatio:       GetCacheRatioCopy(),
		CreateCacheRatio: GetCreateCacheRatioCopy(),
		ModelPrice:       GetModelPriceCopy(),
	}
	exposedData.Store(&exposedCache{
		data:      newData,
		expiresAt: time.Now().Add(exposedDataTTL),
	})
	return newData
}
