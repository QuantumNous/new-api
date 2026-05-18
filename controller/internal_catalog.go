package controller

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

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
		brand, ok := channelTypeToBrand[row.channelType]
		if !ok {
			brand = "other"
		}
		ratio, _, _ := ratio_setting.GetModelRatio(name)
		// ratio_setting uses per-1k-token units; smart-router's Constraints
		// schema is per-1M tokens. Scale by 1000.
		inputPer1M := ratio * 1000
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
