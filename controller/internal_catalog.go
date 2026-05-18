package controller

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/kids"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// modelRatioToPerMillionUSD converts DeepRouter's internal "model ratio" units
// to USD per 1M tokens. Derived from setting/ratio_setting/model_ratio.go:
//
//	const USD = 500     // $0.002 = 1 ratio unit → $1 = 500 ratio units
//	// 1 ratio === $0.002 / 1K tokens
//
// So price_per_1M_USD = ratio * ($0.002 / 1k tokens) * (1000 / 1) = ratio * 2.
// Verified against authoritative comments in model_ratio.go:
//
//	"gpt-4o":  1.25, // $2.5 / 1M tokens  →  1.25 * 2 = 2.5 ✓
//	"gpt-4":   15,   // $30 / 1M tokens   →  15   * 2 = 30  ✓
//	"chatgpt-4o-latest": 2.5, // $5/1M    →  2.5  * 2 = 5   ✓
const modelRatioToPerMillionUSD = 2.0

// channelTypeToBrand maps DeepRouter's internal channel-type IDs (defined in
// constant/channel.go) to the brand string returned to smart-router. Smart-router
// uses these for the `allowed_brands` constraint filter. The set is intentionally
// small for V0 — unknown types fall through to "other" and remain usable.
var channelTypeToBrand = map[int]string{
	constant.ChannelTypeOpenAI:    "openai",
	constant.ChannelTypeAzure:     "openai",
	constant.ChannelTypeAnthropic: "anthropic",
	constant.ChannelTypeGemini:    "google",
	constant.ChannelTypeVertexAi:  "google",
	constant.ChannelTypeAws:       "anthropic",
	constant.ChannelTypeDeepSeek:  "deepseek",
	constant.ChannelTypeMoonshot:  "moonshot",
}

type CatalogModelInfo struct {
	Name             string   `json:"name"`
	Brand            string   `json:"brand"`
	Available        bool     `json:"available"`
	Capabilities     []string `json:"capabilities"`
	InputPricePer1M  float64  `json:"input_price_per_1m_usd"`
	OutputPricePer1M float64  `json:"output_price_per_1m_usd"`
	Groups           []string `json:"groups"`
}

type CatalogResponse struct {
	Version  time.Time          `json:"version"`
	TenantID string             `json:"tenant_id"`
	KidsMode bool               `json:"kids_mode"`
	Models   []CatalogModelInfo `json:"models"`
}

// GetRouterCatalog serves the model catalog that smart-router polls every 30s.
// The catalog is filtered to models reachable in the tenant's group with at
// least one enabled ability row. Pricing is converted from per-1k-token ratios
// to per-1M-USD figures that match smart-router's Constraints schema.
//
// Auth: InternalToken middleware (Bearer DEEPROUTER_INTERNAL_TOKEN).
// Query: ?tenant_id=<numeric user id>
//
// This endpoint deliberately returns more than smart-router strictly needs
// to act on: the final per-tenant policy gate (kids_mode hard constraints,
// PolicyProfile filtering) runs in the relay path, not here. Smart-router
// is for cost/quality routing; the gateway is the security boundary.
func GetRouterCatalog(c *gin.Context) {
	tenantIDStr := c.Query("tenant_id")
	if tenantIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_tenant_id"})
		return
	}
	tenantID, err := strconv.Atoi(tenantIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_tenant_id"})
		return
	}

	user, err := model.GetUserById(tenantID, false)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant_not_found"})
		return
	}

	abilities, err := model.GetAllEnableAbilityWithChannels()
	if err != nil {
		common.SysError("router-catalog: " + err.Error())
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "catalog_unavailable"})
		return
	}

	type modelAgg struct {
		channelType int
		anyEnabled  bool
	}
	agg := make(map[string]*modelAgg, len(abilities))
	for _, ab := range abilities {
		if ab.Group != user.Group {
			continue
		}
		if !ab.Enabled {
			continue
		}
		row := agg[ab.Model]
		if row == nil {
			row = &modelAgg{channelType: ab.ChannelType}
			agg[ab.Model] = row
		}
		row.anyEnabled = true
	}

	models := make([]CatalogModelInfo, 0, len(agg))
	for name, row := range agg {
		// Models with a fixed per-call price (image / video / audio — see
		// GetModelPrice) don't fit smart-router's per-1M-token schema and
		// the Tier-1 heuristic rules don't route to them either. Skip.
		if _, hasPerCall := ratio_setting.GetModelPrice(name, false); hasPerCall {
			continue
		}
		// kids_mode tenants get a pre-filtered catalog so smart-router can't
		// pick a non-kids-safe model in the first place. relay/airbotix_policy.go
		// re-checks the same whitelist at request time as defense in depth —
		// this filter is a performance optimisation, not the safety boundary.
		if user.KidsMode && !kids.IsModelEligible(name) {
			continue
		}
		brand, ok := channelTypeToBrand[row.channelType]
		if !ok {
			brand = "other"
		}
		ratio, _, _ := ratio_setting.GetModelRatio(name)
		inputPer1M := ratio * modelRatioToPerMillionUSD
		outputPer1M := inputPer1M * ratio_setting.GetCompletionRatio(name)
		models = append(models, CatalogModelInfo{
			Name:             name,
			Brand:            brand,
			Available:        row.anyEnabled,
			Capabilities:     []string{"chat"},
			InputPricePer1M:  inputPer1M,
			OutputPricePer1M: outputPer1M,
			Groups:           []string{user.Group},
		})
	}
	sort.Slice(models, func(i, j int) bool { return models[i].Name < models[j].Name })

	c.JSON(http.StatusOK, CatalogResponse{
		Version:  time.Now().UTC(),
		TenantID: tenantIDStr,
		KidsMode: user.KidsMode,
		Models:   models,
	})
}
