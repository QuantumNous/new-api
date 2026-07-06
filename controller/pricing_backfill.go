package controller

import (
	"net/http"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

// BackfillGlobalRatios seeds the global model-ratio option maps (系统设置 → 模型定价,
// the unified 官方原价 store served by /api/pricing) from two sources:
//
//  1. body "prices" — operator-supplied USD list prices, highest priority. Used for
//     the migration seed taken from pricing-snapshot (当前前端实际显示的划线价).
//     input>0 && output>0 → ratio-based (model_ratio = input/2, completion = out/in);
//     input>0 && output<=0 → per-request price-based (model_price = input, e.g. sora/kling).
//  2. legacy public_model_prices table (romaapi snapshot, read-only) — fills models
//     not covered by (1). May contain discounted prices; review the returned diff.
//
// Merge-only by default: existing keys are never overwritten unless {"overwrite": true}.
// Persisting goes through model.UpdateOption — same path as the settings UI, so the
// in-memory maps and other nodes pick the values up immediately.
//
// POST /api/admin/channel-data/backfill-global-ratios
// body: {"overwrite": false, "prices": {"claude-sonnet-5": {"input": 2, "output": 10}, ...}}
func BackfillGlobalRatios(c *gin.Context) {
	var req struct {
		Overwrite bool `json:"overwrite"`
		Prices    map[string]struct {
			Input  float64 `json:"input"`
			Output float64 `json:"output"`
		} `json:"prices"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid body: " + err.Error()})
		return
	}

	modelRatio := ratio_setting.GetModelRatioCopy()
	modelPrice := ratio_setting.GetModelPriceCopy()
	completionRatio := ratio_setting.GetCompletionRatioCopy()
	cacheRatio := ratio_setting.GetCacheRatioCopy()
	createCacheRatio := ratio_setting.GetCreateCacheRatioCopy()

	added := map[string][]string{}
	skipped := []string{}
	changed := map[string]bool{}

	setIfMissing := func(m map[string]float64, mapKey, name string, v float64) {
		if v <= 0 {
			return
		}
		if _, exists := m[name]; exists && !req.Overwrite {
			return
		}
		m[name] = v
		added[mapKey] = append(added[mapKey], name)
		changed[mapKey] = true
	}

	// Merge per key, not per model: a model whose model_ratio already exists
	// still gets missing completion/cache ratios filled in (half-configured
	// models are common after manual edits). "skipped" reports models whose
	// primary key (model_ratio / model_price) was already present.
	applyRatioBased := func(name string, mr, cr, cacheR, createR float64) {
		if _, exists := modelRatio[name]; exists && !req.Overwrite {
			skipped = append(skipped, name)
		}
		setIfMissing(modelRatio, "model_ratio", name, mr)
		setIfMissing(completionRatio, "completion_ratio", name, cr)
		setIfMissing(cacheRatio, "cache_ratio", name, cacheR)
		setIfMissing(createCacheRatio, "create_cache_ratio", name, createR)
	}
	applyPriceBased := func(name string, mp float64) {
		if _, exists := modelPrice[name]; exists && !req.Overwrite {
			skipped = append(skipped, name)
		}
		setIfMissing(modelPrice, "model_price", name, mp)
	}

	// (1) operator payload — highest priority.
	covered := map[string]bool{}
	for name, p := range req.Prices {
		if name == "" || p.Input <= 0 {
			continue
		}
		covered[name] = true
		if p.Output > 0 {
			applyRatioBased(name, p.Input/2.0, p.Output/p.Input, 0, 0)
		} else {
			applyPriceBased(name, p.Input)
		}
	}

	// (2) legacy romaapi snapshot fills the remainder.
	if pubs, err := model.GetAllPublicModelPrices(); err == nil {
		for _, pub := range pubs {
			if pub.ModelName == "" || covered[pub.ModelName] {
				continue
			}
			if pub.QuotaType == 1 {
				applyPriceBased(pub.ModelName, pub.ModelPrice)
			} else if pub.ModelRatio > 0 {
				applyRatioBased(pub.ModelName, pub.ModelRatio, pub.CompletionRatio, pub.CacheRatio, pub.CreateCacheRatio)
			}
		}
	}

	// Persist only the maps that actually changed.
	persistTargets := map[string]map[string]float64{
		"model_ratio":        modelRatio,
		"model_price":        modelPrice,
		"completion_ratio":   completionRatio,
		"cache_ratio":        cacheRatio,
		"create_cache_ratio": createCacheRatio,
	}
	optionKeys := map[string]string{
		"model_ratio":        "ModelRatio",
		"model_price":        "ModelPrice",
		"completion_ratio":   "CompletionRatio",
		"cache_ratio":        "CacheRatio",
		"create_cache_ratio": "CreateCacheRatio",
	}
	for mapKey, m := range persistTargets {
		if !changed[mapKey] {
			continue
		}
		data, err := common.Marshal(m)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": mapKey + " marshal: " + err.Error()})
			return
		}
		if err := model.UpdateOption(optionKeys[mapKey], string(data)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": mapKey + " persist: " + err.Error()})
			return
		}
	}

	for k := range added {
		sort.Strings(added[k])
	}
	sort.Strings(skipped)
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"added":     added,
		"skipped":   skipped,
		"overwrite": req.Overwrite,
	})
}
