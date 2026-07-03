package controller

import (
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// DetectPoint is one entry in a per-channel history series for the model-data UI.
type DetectPoint struct {
	Status                  string     `json:"status"`      // 'pass' / 'suspicious' / 'notcomplete'
	DetectTime              int64      `json:"detect_time"` // unix seconds
	Note                    string     `json:"note,omitempty"`
	GroupName               string     `json:"group_name,omitempty"`                // channel group at time of detection
	FingerprintModelVersion string     `json:"fingerprint_model_version,omitempty"` // e.g. apimaster_fingerprint_cccli_v0.1
	Top5                    []TopKItem `json:"top5,omitempty"`         // fingerprint top-5 predictions (only on fingerprint history points)
	Top1ScoreRaw            float64    `json:"top1_score_raw,omitempty"` // raw top1 score before boost; non-zero only when boost was applied (admin only)
}

// TopKItem is one prediction in the fingerprint top-5 list. Mirrors apimaster's
// detections.top5 JSON shape so detection_sync can copy it straight through.
type TopKItem struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
	Rank  int     `json:"rank,omitempty"`
}

func includeDetectHistoryStatus(status string) bool {
	return status != "notcomplete"
}

type ModelDataItem struct {
	ChannelID   int    `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	KeyGroup    string `json:"key_group"`
	ClientExclusive string `json:"client_exclusive"` // "" | codex | claude_code
	// Pricing fields: nil = no pricing row (upstream 401/404 / cookie-only auth / no endpoint).
	// Frontend renders nil as "—".
	ModelPrice                 *float64      `json:"model_price"`                  // base model price = input_price / group_ratio ($/1M); nil = unknown
	GroupRatio                 *float64      `json:"group_ratio"`                  // upstream group multiplier (e.g. 1.05 for CC); nil = unknown
	RechargeRate               float64       `json:"recharge_rate"`                // platform recharge multiplier
	InputPrice                 *float64      `json:"input_price"`                  // model_price × group_ratio ($/1M); nil = unknown
	ActualPrice                *float64      `json:"actual_price"`                 // input_price × recharge_rate (采购价); nil = unknown
	UserPrice                  *float64      `json:"user_price"`                   // actual_price × apimaster_price_ratio (用户最终价格); nil = unknown
	ApimasterPriceRatio        float64       `json:"apimaster_price_ratio"`        // per-channel markup multiplier; 1.0 when unset
	PricingSource              string        `json:"pricing_source"`               // "api" | "manual" | "" (no pricing data)
	HubPrice                   *float64      `json:"hub_price"`                    // hub.romaapi.com listed input price ($/1M), matched by key_group; nil = no hub data / group mismatch
	OutputPrice                *float64      `json:"output_price"`                 // raw upstream output price ($/1M); nil = unknown
	ActualOutputPrice          *float64      `json:"actual_output_price"`          // output_price × recharge_rate (采购价); nil = unknown
	ActualOutputUserPrice      *float64      `json:"actual_output_user_price"`     // actual_output_price × apimaster_price_ratio (用户最终价格); nil = unknown
	CachePrice                 *float64      `json:"cache_price"`                  // cache-read price ($/1M); nil = unknown
	ActualCachePrice           *float64      `json:"actual_cache_price"`           // cache_price × recharge_rate; nil = unknown
	CacheCreationPrice         *float64      `json:"cache_creation_price"`         // cache-write price ($/1M); nil = unknown
	ActualCacheCreationPrice   *float64      `json:"actual_cache_creation_price"`  // cache_creation_price × recharge_rate; nil = unknown
	FingerprintHistory         []DetectPoint `json:"fingerprint_history"`          // last 24 fingerprint runs (newest first)
	UptimeHistory              []DetectPoint `json:"uptime_history"`               // last 24 uptime probes (newest first)
	LatencyMedianMs            float64       `json:"latency_median_ms"`            // median latency over last modelDataLatencyMax pass probes; 0 if no samples
	LatencyP95Ms               float64       `json:"latency_p95_ms"`               // 95th-percentile latency over same pass probes; 0 if no samples
	LatencyCVPct               float64       `json:"latency_cv_pct"`               // stddev/median ×100 (relative jitter); 0 if <2 samples or median=0
	Status                     int           `json:"status"`                       // 1 enabled / 2 manual-disabled / 3 auto-disabled (routing algorithm 0.1)
	ConsecutiveFingerprintPass int           `json:"consecutive_fingerprint_pass"` // recovery counter; only meaningful when status=3
	ModelEnabled               bool          `json:"model_enabled"`                // abilities.enabled for this (channel, model) — false = disabled for this model only
	StatusReason               string        `json:"status_reason"`                // why auto-disabled; empty when status != 3
	StatusTime                 int64         `json:"status_time"`                  // unix ts of disable event; 0 if unknown
	BaseURL                    string        `json:"base_url"`                     // channel base URL, used for analysis lookup
}

const (
	modelDataHistorySize = 24
	modelDataLatencyMax  = 50 // use last N pass probes (regardless of time) for latency stats
)

// GetModelData returns channel pricing and detection stats for a given model.
// GET /api/admin/model-data?model=<model_name>
func GetModelData(c *gin.Context) {
	modelName := c.DefaultQuery("model", "claude-sonnet-4-6")

	type row struct {
		ChannelID                  int
		ChannelName                string
		BaseURL                    *string
		Setting                    *string
		ModelMapping               *string
		InputPrice                 *float64
		OutputPrice                *float64
		CachePrice                 *float64
		CacheCreationPrice         *float64
		GroupRatio                 *float64 // upstream group multiplier; nil when no pricing row
		PricingSource              *string
		RechargeRate               *float64
		ApimasterPriceRatio        float64 // per-channel markup; COALESCE'd to 1.0
		Status                     int
		ConsecutiveFingerprintPass int
		ModelEnabled               bool    // abilities.enabled for this (channel, model)
		OtherInfo                  *string // raw JSON from channels.other_info
	}

	// Match canonical model + all known provider variants (e.g. claude-haiku-4-5 ↔
	// claude-haiku-4-5-20251001 ↔ anthropic/claude-haiku-4.5). Without this, channels
	// that only stored a dated variant in channel_model_pricings get dropped.
	candidates := service.ModelNameCandidates(modelName)

	// channels.models is comma-separated; OR over (= / starts-with / ends-with / middle)
	// for every candidate name.
	modelsClauses := make([]string, 0, len(candidates))
	modelsArgs := make([]interface{}, 0, len(candidates)*4)
	for _, m := range candidates {
		modelsClauses = append(modelsClauses, "c.models = ? OR c.models LIKE ? OR c.models LIKE ? OR c.models LIKE ?")
		modelsArgs = append(modelsArgs, m, m+",%", "%,"+m, "%,"+m+",%")
	}

	// LEFT JOIN so channels that advertise the model in c.models but have no
	// channel_model_pricings row (upstream /api/pricing returned 401/404, or the
	// site uses cookie-only auth like nekocode) still appear in the table with
	// input_price=0. The `p.model_name IN (candidates)` filter must live in the
	// ON clause — putting it in WHERE would degenerate LEFT JOIN to INNER JOIN
	// (any non-NULL filter on the right table re-excludes the no-match rows).
	var rows []row
	model.DB.Table("channels c").
		Select("c.id as channel_id, c.name as channel_name, c.base_url, c.setting, c.model_mapping, p.input_price, p.output_price, p.cache_price, p.cache_creation_price, p.group_ratio, p.pricing_source, c.recharge_rate, COALESCE(c.apimaster_price_ratio, 1.0) AS apimaster_price_ratio, c.status, c.consecutive_fingerprint_pass, COALESCE(a.enabled, true) as model_enabled, c.other_info").
		Joins("LEFT JOIN channel_model_pricings p ON c.id = p.channel_id AND p.model_name IN ?", candidates).
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		// Show all status (1/2/3) so the operator can act on auto-disabled ones from the table.
		Where("c.status IN (1, 2, 3)").
		Where("("+strings.Join(modelsClauses, " OR ")+")", modelsArgs...).
		// Missing-pricing rows (LEFT JOIN with no match) sort last via CASE;
		// portable across SQLite / MySQL / PostgreSQL (NULLS LAST is PG-only).
		Order("c.id ASC, CASE WHEN p.input_price IS NULL OR p.input_price <= 0 THEN 1 ELSE 0 END, p.input_price ASC").
		Scan(&rows)

	// A single channel may have multiple variant rows in channel_model_pricings
	// (e.g. claude-haiku-4-5-20251001 + claude-haiku-4-5-20251001-thinking).
	// Keep the cheapest per channel.
	seen := map[int]bool{}
	deduped := make([]row, 0, len(rows))
	for _, r := range rows {
		if seen[r.ChannelID] {
			continue
		}
		seen[r.ChannelID] = true
		deduped = append(deduped, r)
	}
	rows = deduped

	// Per-channel model_mapping: upstream pricing may use the mapped name only.
	for i := range rows {
		applyModelMappingPricingToRow(
			rows[i].ChannelID, rows[i].ModelMapping, modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, &rows[i].CachePrice, &rows[i].CacheCreationPrice,
			&rows[i].GroupRatio, &rows[i].PricingSource,
		)
		applyPublicManualPricingToRow(
			rows[i].Setting, modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, &rows[i].CachePrice, &rows[i].CacheCreationPrice,
			&rows[i].GroupRatio, &rows[i].PricingSource,
		)
		applyGlobalModelPricingToRow(
			modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, &rows[i].CachePrice, &rows[i].CacheCreationPrice,
			&rows[i].GroupRatio, &rows[i].PricingSource,
		)
	}

	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []any{}})
		return
	}

	// Batch fetch recent detect logs for these channels, filtered to this model.
	// Pull enough rows for both fingerprint and uptime series per channel.
	channelIDs := make([]int, len(rows))
	for i, r := range rows {
		channelIDs[i] = r.ChannelID
	}
	// Fetch fingerprint (non-uptime) and uptime logs SEPARATELY. A single shared
	// LIMIT let the far more numerous/recent uptime probes starve the sparse
	// fingerprint series out of the window (fingerprint_history came back empty).
	var logs []model.ChannelDetectLog
	model.DB.
		Where("channel_id IN ?", channelIDs).
		Where("claimed_model = ?", modelName).
		Where("source <> ?", "uptime").
		Order("detect_time DESC").
		Limit(len(channelIDs) * modelDataHistorySize).
		Find(&logs)
	var uptimeLogs []model.ChannelDetectLog
	model.DB.
		Where("channel_id IN ?", channelIDs).
		Where("claimed_model = ?", modelName).
		Where("source = ?", "uptime").
		Order("detect_time DESC").
		Limit(len(channelIDs) * (modelDataHistorySize + modelDataLatencyMax*3)).
		Find(&uptimeLogs)
	logs = append(logs, uptimeLogs...)

	// Group into fingerprint vs uptime per channel, capped at modelDataHistorySize each.
	// Collect up to modelDataLatencyMax pass-only uptime probes for the latency columns.
	type histories struct {
		Fingerprint []DetectPoint
		Uptime      []DetectPoint
		Latencies   []float64
	}
	byChannel := map[int]*histories{}
	for _, l := range logs {
		if !includeDetectHistoryStatus(l.Status) {
			continue
		}
		h, ok := byChannel[l.ChannelId]
		if !ok {
			h = &histories{}
			byChannel[l.ChannelId] = h
		}
		point := DetectPoint{Status: l.Status, DetectTime: l.DetectTime, Note: l.Note, GroupName: l.GroupName, FingerprintModelVersion: l.FingerprintModelVersion}
		if l.Source == "uptime" {
			if len(h.Uptime) < modelDataHistorySize {
				h.Uptime = append(h.Uptime, point)
			}
			if l.Status == "pass" && l.LatencyMeanMs > 0 && len(h.Latencies) < modelDataLatencyMax {
				h.Latencies = append(h.Latencies, l.LatencyMeanMs)
			}
		} else {
			// fingerprint points carry top5; boost was already applied at write time
			if l.Top5Json != "" {
				var top5 []TopKItem
				if err := common.Unmarshal([]byte(l.Top5Json), &top5); err == nil {
					point.Top5 = top5
				}
			}
			if l.Top1ScoreRaw > 0 {
				point.Top1ScoreRaw = l.Top1ScoreRaw
			}
			if len(h.Fingerprint) < modelDataHistorySize {
				h.Fingerprint = append(h.Fingerprint, point)
			}
		}
	}

	// hub.romaapi.com aggregator pricing for the side-by-side compare column.
	// Best-effort: if the hub is unreachable, hub_price stays nil for every row.
	hubPricing, _ := service.GetHubPricing(c.Request.Context())

	items := make([]ModelDataItem, 0, len(rows))
	for _, r := range rows {
		rechargeRate := 1.0
		if r.RechargeRate != nil && *r.RechargeRate > 0 {
			rechargeRate = *r.RechargeRate
		}

		fp := []DetectPoint{}
		up := []DetectPoint{}
		var latencies []float64
		if h := byChannel[r.ChannelID]; h != nil {
			if h.Fingerprint != nil {
				fp = h.Fingerprint
			}
			if h.Uptime != nil {
				up = h.Uptime
			}
			latencies = h.Latencies
		}

		// Pricing is nil when LEFT JOIN had no match (upstream /api/pricing
		// 401/404 or cookie-only auth). Keep nil all the way to the API
		// response so the frontend renders "—" rather than misleading "0".
		// apimaster markup multiplier; nil/0 already coalesced to 1.0, guard anyway.
		apimasterRatio := r.ApimasterPriceRatio
		if apimasterRatio <= 0 {
			apimasterRatio = 1.0
		}

		var inputPricePtr, outputPricePtr, actualPricePtr, actualOutPricePtr *float64
		var userPricePtr, actualOutputUserPricePtr *float64
		var modelPricePtr, groupRatioPtr *float64
		if r.InputPrice != nil {
			in := *r.InputPrice
			inputPricePtr = &in
			actualIn := in * rechargeRate
			actualPricePtr = &actualIn
			// user_price = 采购价 × apimaster_price_ratio（展示口径，不含路由 5% 服务费）
			userIn := actualIn * apimasterRatio
			userPricePtr = &userIn

			// group_ratio stored per-row; default 1.0 for old rows without the column.
			gr := 1.0
			if r.GroupRatio != nil && *r.GroupRatio > 0 {
				gr = *r.GroupRatio
			}
			groupRatioPtr = &gr
			mp := in / gr // base model price before group markup
			modelPricePtr = &mp
		}
		if r.OutputPrice != nil {
			out := *r.OutputPrice
			outputPricePtr = &out
			actualOut := out * rechargeRate
			actualOutPricePtr = &actualOut
			// output 用户最终价格 = 输出采购价 × apimaster_price_ratio
			userOut := actualOut * apimasterRatio
			actualOutputUserPricePtr = &userOut
		}
		var cachePricePtr, actualCachePricePtr *float64
		if r.CachePrice != nil && *r.CachePrice > 0 {
			cp := *r.CachePrice
			cachePricePtr = &cp
			acp := cp * rechargeRate
			actualCachePricePtr = &acp
		}
		var cacheCreationPricePtr, actualCacheCreationPricePtr *float64
		if r.CacheCreationPrice != nil && *r.CacheCreationPrice > 0 {
			ccp := *r.CacheCreationPrice
			cacheCreationPricePtr = &ccp
			accp := ccp * rechargeRate
			actualCacheCreationPricePtr = &accp
		}

		keyGroup := modelDataExtractKeyGroup(r.Setting)
		clientExclusive := modelDataExtractClientExclusive(r.Setting)

		// Hub compare price: hub's listed price × this channel's recharge_rate,
		// matched by host + key_group. nil when the relay isn't on the hub, or
		// key_group matches no hub group (rendered "—").
		var hubPricePtr *float64
		if r.BaseURL != nil {
			if hp, ok := service.HubInputPrice(hubPricing, *r.BaseURL, keyGroup, modelName); ok {
				converted := hp * rechargeRate
				hubPricePtr = &converted
			}
		}

		pricingSource := ""
		if r.PricingSource != nil {
			pricingSource = *r.PricingSource
		}

		var statusReason string
		var statusTime int64
		if r.Status == 3 && r.OtherInfo != nil {
			var info map[string]interface{}
			if err := common.Unmarshal([]byte(*r.OtherInfo), &info); err == nil {
				if v, ok := info["status_reason"].(string); ok {
					statusReason = v
				}
				if v, ok := info["status_time"].(float64); ok {
					statusTime = int64(v)
				}
			}
		}

		items = append(items, ModelDataItem{
			ChannelID:                  r.ChannelID,
			ChannelName:                r.ChannelName,
			KeyGroup:                   keyGroup,
			ClientExclusive:            clientExclusive,
			ModelPrice:                 modelPricePtr,
			GroupRatio:                 groupRatioPtr,
			InputPrice:                 inputPricePtr,
			ActualPrice:                actualPricePtr,
			UserPrice:                  userPricePtr,
			ApimasterPriceRatio:        apimasterRatio,
			HubPrice:                   hubPricePtr,
			OutputPrice:                outputPricePtr,
			ActualOutputPrice:          actualOutPricePtr,
			ActualOutputUserPrice:      actualOutputUserPricePtr,
			CachePrice:                 cachePricePtr,
			ActualCachePrice:           actualCachePricePtr,
			CacheCreationPrice:         cacheCreationPricePtr,
			ActualCacheCreationPrice:   actualCacheCreationPricePtr,
			RechargeRate:               rechargeRate,
			PricingSource:              pricingSource,
			FingerprintHistory:         fp,
			UptimeHistory:              up,
			LatencyMedianMs:            medianFloat64(latencies),
			LatencyP95Ms:               percentileFloat64(latencies, 0.95),
			LatencyCVPct:               cvPercent(latencies),
			Status:                     r.Status,
			ConsecutiveFingerprintPass: r.ConsecutiveFingerprintPass,
			ModelEnabled:               r.ModelEnabled,
			StatusReason:               statusReason,
			StatusTime:                 statusTime,
			BaseURL: func() string {
				if r.BaseURL != nil {
					return *r.BaseURL
				}
				return ""
			}(),
		})
	}

	// Re-sort by user price ascending; rows with nil/≤0 UserPrice (no
	// pricing available) sink to the bottom so the table still leads with
	// the cheapest *known-priced* row. 与公开市场页一致按用户最终价格排序。
	priceRank := func(p *float64) int {
		if p == nil || *p <= 0 {
			return 1
		}
		return 0
	}
	priceVal := func(p *float64) float64 {
		if p == nil {
			return 0
		}
		return *p
	}
	for i := 1; i < len(items); i++ {
		for j := i; j > 0; j-- {
			a, b := items[j-1], items[j]
			ra, rb := priceRank(a.UserPrice), priceRank(b.UserPrice)
			if ra < rb || (ra == rb && priceVal(a.UserPrice) <= priceVal(b.UserPrice)) {
				break
			}
			items[j], items[j-1] = b, a
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

func modelDataExtractKeyGroup(setting *string) string {
	return service.ExtractKeyGroup(setting)
}

func modelDataExtractClientExclusive(setting *string) string {
	return string(service.ExtractClientExclusive(setting))
}

// applyModelMappingPricingToRow fills pricing fields from channel_model_pricings when
// the global-name LEFT JOIN missed but model_mapping points at a priced upstream name.
func applyModelMappingPricingToRow(
	channelID int,
	modelMapping *string,
	canonical string,
	inputPrice, outputPrice, cachePrice, cacheCreationPrice, groupRatio **float64,
	pricingSource **string,
) {
	if inputPrice != nil && *inputPrice != nil && **inputPrice > 0 {
		return
	}
	pr, ok := service.ResolvePricingViaModelMapping(channelID, modelMapping, canonical)
	if !ok {
		return
	}
	in := pr.InputPrice
	*inputPrice = &in
	if outputPrice != nil && pr.OutputPrice > 0 {
		out := pr.OutputPrice
		*outputPrice = &out
	}
	if cachePrice != nil && pr.CachePrice > 0 {
		cp := pr.CachePrice
		*cachePrice = &cp
	}
	if cacheCreationPrice != nil && pr.CacheCreationPrice > 0 {
		ccp := pr.CacheCreationPrice
		*cacheCreationPrice = &ccp
	}
	if groupRatio != nil {
		gr := pr.GroupRatio
		*groupRatio = &gr
	}
	if pricingSource != nil && pr.PricingSource != "" {
		src := pr.PricingSource
		*pricingSource = &src
	}
}

// applyPublicManualPricingToRow fills pricing from public_model_prices × manual_group_ratio
// when upstream /api/pricing is unavailable and channel_model_pricings has no row.
func applyPublicManualPricingToRow(
	setting *string,
	canonical string,
	inputPrice, outputPrice, cachePrice, cacheCreationPrice, groupRatio **float64,
	pricingSource **string,
) {
	if inputPrice != nil && *inputPrice != nil && **inputPrice > 0 {
		return
	}
	pr, ok := service.LookupPublicManualPricing(setting, canonical)
	if !ok || pr.InputPrice <= 0 {
		return
	}
	in := pr.InputPrice
	*inputPrice = &in
	if outputPrice != nil && pr.OutputPrice > 0 {
		out := pr.OutputPrice
		*outputPrice = &out
	}
	if cachePrice != nil && pr.CachePrice > 0 {
		cp := pr.CachePrice
		*cachePrice = &cp
	}
	if cacheCreationPrice != nil && pr.CacheCreationPrice > 0 {
		ccp := pr.CacheCreationPrice
		*cacheCreationPrice = &ccp
	}
	if groupRatio != nil {
		gr := pr.GroupRatio
		*groupRatio = &gr
	}
	if pricingSource != nil {
		src := "manual"
		*pricingSource = &src
	}
}

// applyGlobalModelPricingToRow fills pricing from System Settings → Group & Model Pricing
// when channel_model_pricings has no row (common for direct MiniMax / self-hosted channels).
func applyGlobalModelPricingToRow(
	canonical string,
	inputPrice, outputPrice, cachePrice, cacheCreationPrice, groupRatio **float64,
	pricingSource **string,
) {
	if inputPrice != nil && *inputPrice != nil && **inputPrice > 0 {
		return
	}
	in, out, cache, cacheCreate, ok := service.GlobalModelPricingUSD(canonical)
	if !ok || in <= 0 {
		return
	}
	*inputPrice = &in
	if outputPrice != nil && out > 0 {
		o := out
		*outputPrice = &o
	}
	if cachePrice != nil && cache > 0 {
		cp := cache
		*cachePrice = &cp
	}
	if cacheCreationPrice != nil && cacheCreate > 0 {
		ccp := cacheCreate
		*cacheCreationPrice = &ccp
	}
	if groupRatio != nil && *groupRatio == nil {
		gr := 1.0
		*groupRatio = &gr
	}
	if pricingSource != nil && (*pricingSource == nil || **pricingSource == "") {
		src := "global"
		*pricingSource = &src
	}
}

// PublicMarketplaceItem is the public-facing shape returned by GetPublicMarketplace.
// It omits internal/admin fields (hub_price, model_price, group_ratio, pricing_source, etc.).
type PublicMarketplaceItem struct {
	ChannelID             int           `json:"channel_id"`
	ChannelName           string        `json:"channel_name"`
	KeyGroup              string        `json:"key_group"`
	InputPrice            *float64      `json:"input_price"`
	ActualPrice           *float64      `json:"actual_price"` // 采购价（内部参考），保留供折扣计算
	UserPrice             *float64      `json:"user_price"`   // 用户最终价格 = actual_price × apimaster_price_ratio
	OutputPrice           *float64      `json:"output_price"`
	ActualOutputPrice     *float64      `json:"actual_output_price"`
	ActualOutputUserPrice *float64      `json:"actual_output_user_price"` // 输出用户最终价格 = actual_output_price × apimaster_price_ratio
	RechargeRate          float64       `json:"recharge_rate"`
	OfficialInputPrice    *float64      `json:"official_input_price"`
	OfficialOutputPrice   *float64      `json:"official_output_price"`
	FingerprintHistory    []DetectPoint `json:"fingerprint_history"`
	UptimeHistory         []DetectPoint `json:"uptime_history"`
	LatencyMedianMs       float64       `json:"latency_median_ms"`
	Status                int           `json:"status"`
}

// publicMarketplaceCache is a simple per-model TTL cache.
var publicMarketplaceCache = struct {
	sync.Mutex
	data map[string]publicMarketplaceCacheEntry
}{data: map[string]publicMarketplaceCacheEntry{}}

type publicMarketplaceCacheEntry struct {
	items     []PublicMarketplaceItem
	expiresAt int64
}

// GetPublicMarketplace returns channel pricing and detection stats for a given model.
// No authentication required — public-facing data only (status=1 channels, no internal fields).
// GET /api/public/marketplace?model=<model_name>
func GetPublicMarketplace(c *gin.Context) {
	modelName := c.DefaultQuery("model", "claude-sonnet-4-6")

	// Serve from cache if fresh.
	publicMarketplaceCache.Lock()
	if e, ok := publicMarketplaceCache.data[modelName]; ok && time.Now().Unix() < e.expiresAt {
		items := e.items
		publicMarketplaceCache.Unlock()
		c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
		return
	}
	publicMarketplaceCache.Unlock()

	type row struct {
		ChannelID           int
		ChannelName         string
		Setting             *string
		ModelMapping        *string
		InputPrice          *float64
		OutputPrice         *float64
		GroupRatio          *float64
		RechargeRate        *float64
		ApimasterPriceRatio float64
		Status              int
	}

	candidates := service.ModelNameCandidates(modelName)

	modelsClauses := make([]string, 0, len(candidates))
	modelsArgs := make([]interface{}, 0, len(candidates)*4)
	for _, m := range candidates {
		modelsClauses = append(modelsClauses, "c.models = ? OR c.models LIKE ? OR c.models LIKE ? OR c.models LIKE ?")
		modelsArgs = append(modelsArgs, m, m+",%", "%,"+m, "%,"+m+",%")
	}

	var rows []row
	model.DB.Table("channels c").
		Select("c.id as channel_id, c.name as channel_name, c.setting, c.model_mapping, p.input_price, p.output_price, p.group_ratio, c.recharge_rate, COALESCE(c.apimaster_price_ratio, 1.0) AS apimaster_price_ratio, c.status").
		Joins("LEFT JOIN channel_model_pricings p ON c.id = p.channel_id AND p.model_name IN ?", candidates).
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where("COALESCE(a.enabled, true) = true").
		Where("("+strings.Join(modelsClauses, " OR ")+")", modelsArgs...).
		Order("c.id ASC, CASE WHEN p.input_price IS NULL OR p.input_price <= 0 THEN 1 ELSE 0 END, p.input_price ASC").
		Scan(&rows)

	// Deduplicate by channel (keep cheapest row per channel).
	seen := map[int]bool{}
	deduped := make([]row, 0, len(rows))
	for _, r := range rows {
		if seen[r.ChannelID] {
			continue
		}
		seen[r.ChannelID] = true
		deduped = append(deduped, r)
	}
	rows = deduped

	for i := range rows {
		applyModelMappingPricingToRow(
			rows[i].ChannelID, rows[i].ModelMapping, modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, nil, nil,
			&rows[i].GroupRatio, nil,
		)
		applyPublicManualPricingToRow(
			rows[i].Setting, modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, nil, nil,
			&rows[i].GroupRatio, nil,
		)
		applyGlobalModelPricingToRow(
			modelName,
			&rows[i].InputPrice, &rows[i].OutputPrice, nil, nil,
			&rows[i].GroupRatio, nil,
		)
	}

	if len(rows) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []any{}})
		return
	}

	// Batch fetch recent detect logs. Fingerprint (non-uptime) and uptime are
	// fetched SEPARATELY so the far more numerous/recent uptime probes can't
	// starve the sparse fingerprint series out of a shared LIMIT window.
	channelIDs := make([]int, len(rows))
	for i, r := range rows {
		channelIDs[i] = r.ChannelID
	}
	var logs []model.ChannelDetectLog
	model.DB.
		Where("channel_id IN ?", channelIDs).
		Where("claimed_model = ?", modelName).
		Where("source <> ?", "uptime").
		Order("detect_time DESC").
		Limit(len(channelIDs) * modelDataHistorySize).
		Find(&logs)
	var uptimeLogs []model.ChannelDetectLog
	model.DB.
		Where("channel_id IN ?", channelIDs).
		Where("claimed_model = ?", modelName).
		Where("source = ?", "uptime").
		Order("detect_time DESC").
		Limit(len(channelIDs) * (modelDataHistorySize + modelDataLatencyMax*3)).
		Find(&uptimeLogs)
	logs = append(logs, uptimeLogs...)

	type histories struct {
		Fingerprint []DetectPoint
		Uptime      []DetectPoint
		Latencies   []float64
	}
	byChannel := map[int]*histories{}
	for _, l := range logs {
		if !includeDetectHistoryStatus(l.Status) {
			continue
		}
		h, ok := byChannel[l.ChannelId]
		if !ok {
			h = &histories{}
			byChannel[l.ChannelId] = h
		}
		point := DetectPoint{Status: l.Status, DetectTime: l.DetectTime, GroupName: l.GroupName}
		if l.Source == "uptime" {
			if len(h.Uptime) < modelDataHistorySize {
				h.Uptime = append(h.Uptime, point)
			}
			if l.Status == "pass" && l.LatencyMeanMs > 0 && len(h.Latencies) < modelDataLatencyMax {
				h.Latencies = append(h.Latencies, l.LatencyMeanMs)
			}
		} else {
			if l.Status == "suspicious" {
				continue // skip suspicious results from public marketplace
			}
			if l.Top5Json != "" {
				var top5 []TopKItem
				if err := common.Unmarshal([]byte(l.Top5Json), &top5); err == nil {
					point.Top5 = top5
				}
			}
			if len(h.Fingerprint) < modelDataHistorySize {
				h.Fingerprint = append(h.Fingerprint, point)
			}
		}
	}

	// Fetch official reference price from public_model_prices (populated by refresh-public-prices).
	var officialInPtr, officialOutPtr *float64
	if pubPrice, err := model.GetPublicModelPriceByNames(candidates); err == nil && pubPrice != nil {
		if pubPrice.InputPrice > 0 {
			v := pubPrice.InputPrice
			officialInPtr = &v
		}
		if pubPrice.OutputPrice > 0 {
			v := pubPrice.OutputPrice
			officialOutPtr = &v
		}
	}

	items := make([]PublicMarketplaceItem, 0, len(rows))
	for _, r := range rows {
		rechargeRate := 1.0
		if r.RechargeRate != nil && *r.RechargeRate > 0 {
			rechargeRate = *r.RechargeRate
		}

		fp := []DetectPoint{}
		up := []DetectPoint{}
		var latencies []float64
		if h := byChannel[r.ChannelID]; h != nil {
			if h.Fingerprint != nil {
				fp = h.Fingerprint
			}
			if h.Uptime != nil {
				up = h.Uptime
			}
			latencies = h.Latencies
		}

		apimasterRatio := r.ApimasterPriceRatio
		if apimasterRatio <= 0 {
			apimasterRatio = 1.0
		}

		var inputPricePtr, outputPricePtr, actualPricePtr, actualOutPricePtr *float64
		var userPricePtr, actualOutputUserPricePtr *float64
		if r.InputPrice != nil {
			in := *r.InputPrice
			inputPricePtr = &in
			actualIn := in * rechargeRate
			actualPricePtr = &actualIn
			userIn := actualIn * apimasterRatio
			userPricePtr = &userIn
		}
		if r.OutputPrice != nil {
			out := *r.OutputPrice
			outputPricePtr = &out
			actualOut := out * rechargeRate
			actualOutPricePtr = &actualOut
			userOut := actualOut * apimasterRatio
			actualOutputUserPricePtr = &userOut
		}

		items = append(items, PublicMarketplaceItem{
			ChannelID:             r.ChannelID,
			ChannelName:           r.ChannelName,
			KeyGroup:              modelDataExtractKeyGroup(r.Setting),
			InputPrice:            inputPricePtr,
			ActualPrice:           actualPricePtr,
			UserPrice:             userPricePtr,
			OutputPrice:           outputPricePtr,
			ActualOutputPrice:     actualOutPricePtr,
			ActualOutputUserPrice: actualOutputUserPricePtr,
			RechargeRate:          rechargeRate,
			OfficialInputPrice:    officialInPtr,
			OfficialOutputPrice:   officialOutPtr,
			FingerprintHistory:    fp,
			UptimeHistory:         up,
			LatencyMedianMs:       medianFloat64(latencies),
			Status:                r.Status,
		})
	}

	// Sort by user-facing price ascending; nil/zero price sinks to bottom.
	priceRank := func(p *float64) int {
		if p == nil || *p <= 0 {
			return 1
		}
		return 0
	}
	priceVal := func(p *float64) float64 {
		if p == nil {
			return 0
		}
		return *p
	}
	for i := 1; i < len(items); i++ {
		for j := i; j > 0; j-- {
			a, b := items[j-1], items[j]
			ra, rb := priceRank(a.UserPrice), priceRank(b.UserPrice)
			if ra < rb || (ra == rb && priceVal(a.UserPrice) <= priceVal(b.UserPrice)) {
				break
			}
			items[j], items[j-1] = b, a
		}
	}

	// Store in cache for 2 minutes.
	publicMarketplaceCache.Lock()
	publicMarketplaceCache.data[modelName] = publicMarketplaceCacheEntry{
		items:     items,
		expiresAt: time.Now().Unix() + 120,
	}
	publicMarketplaceCache.Unlock()

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// ToggleChannelStatus toggles the enabled state of a specific (channel, model) pair
// in the abilities table. This allows per-model control without disabling the whole channel.
//
// POST /api/admin/model-data/toggle  body: {"channel_id": int, "model": string, "action": "enable"|"disable"}
func ToggleChannelStatus(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		Model     string `json:"model"`
		Action    string `json:"action"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 || req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and model are required"})
		return
	}
	enabled := req.Action == "enable"
	if req.Action != "enable" && req.Action != "disable" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "action must be enable or disable"})
		return
	}
	// Update all ability rows for this (channel_id, model) across all groups.
	if err := model.DB.Table("abilities").
		Where("channel_id = ? AND model = ?", req.ChannelID, req.Model).
		Update("enabled", enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	// When re-enabling, also bring the channel back to enabled regardless of how
	// it was disabled — both fingerprint auto-disable (status=3) AND operator
	// manual-disable (status=2). An explicit "enable" here means "make this
	// usable"; without lifting status=2 the button silently no-ops on
	// manually-disabled channels. Resets the recovery counter so fingerprint
	// auto-disable starts fresh.
	if enabled {
		model.DB.Table("channels").
			Where("id = ? AND status <> ?", req.ChannelID, common.ChannelStatusEnabled).
			Updates(map[string]any{"status": common.ChannelStatusEnabled, "consecutive_fingerprint_pass": 0})
	}
	// Refresh the in-memory/Redis routing cache so the toggle takes effect
	// immediately — every channel mutation in controller/channel.go does this.
	model.InitChannelCache()
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DetectChannelNow runs an on-demand fingerprint detection for a single
// channel+model. Used by the "手动检测" row button in model-data UI when an
// operator wants to verify a channel without waiting for the scheduled tick.
// Result lands in channel_detect_logs with source='auto' (same as scheduled
// detect) so the dot-grid history picks it up via the next page reload.
//
// POST /api/admin/model-data/detect-now  body: {"channel_id": int, "model": "<model_name>"}
func DetectChannelNow(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		Model     string `json:"model"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 || strings.TrimSpace(req.Model) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and model are required"})
		return
	}
	ch, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
		return
	}
	// Detection itself takes 5–15s talking to Flask; fire-and-forget so the
	// HTTP request returns instantly. UI re-fetches model-data after ~15s.
	go service.RunChannelDetectionNow(ch, req.Model)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "detection started"})
}

// PingChannelNow runs an on-demand uptime (运行状态) probe for a single
// channel+model. Used by the "手动 ping" row button in model-data UI — triggers
// the same probe as the scheduled uptime tick (source='uptime'), landing in
// channel_detect_logs so the 运行状态 dot-grid picks it up on next reload.
//
// POST /api/admin/model-data/ping-now  body: {"channel_id": int, "model": "<model_name>"}
func PingChannelNow(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		Model     string `json:"model"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 || strings.TrimSpace(req.Model) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel_id and model are required"})
		return
	}
	ch, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
		return
	}
	// Uptime probe takes a few seconds; fire-and-forget so the HTTP request
	// returns instantly. UI re-fetches model-data after a short delay.
	go service.RunChannelUptimeNow(ch, req.Model)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "uptime check started"})
}

// RefreshModelPricing kicks off a pricing re-fetch for channels.
// When model is empty or "all", ALL enabled channels are refreshed.
// When model is a specific name, only channels that serve that model are refreshed.
// Fires service.FetchChannelPricing in a goroutine per channel and returns
// immediately with the count — actual upserts land in channel_model_pricings
// over the next ~15s. UI should reload the table after a short delay.
//
// POST /api/admin/model-data/refresh-pricing  body: {"model": "<model_name>"|"all"|""}
func RefreshModelPricing(c *gin.Context) {
	var req struct {
		Model string `json:"model"`
	}
	_ = common.DecodeJson(c.Request.Body, &req)
	modelFilter := strings.TrimSpace(req.Model)

	q := model.DB.Where("status IN (1, 2, 3) AND base_url IS NOT NULL AND base_url <> ''")

	if modelFilter != "" && modelFilter != "all" {
		candidates := service.ModelNameCandidates(modelFilter)
		modelsClauses := make([]string, 0, len(candidates))
		modelsArgs := make([]interface{}, 0, len(candidates)*4)
		for _, m := range candidates {
			modelsClauses = append(modelsClauses, "models = ? OR models LIKE ? OR models LIKE ? OR models LIKE ?")
			modelsArgs = append(modelsArgs, m, m+",%", "%,"+m, "%,"+m+",%")
		}
		q = q.Where("("+strings.Join(modelsClauses, " OR ")+")", modelsArgs...)
	}

	var channels []model.Channel
	if err := q.Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	for i := range channels {
		ch := channels[i]
		go service.FetchChannelPricing(&ch)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(channels),
		"message": "pricing refetch started",
	})
}

// RefreshPublicModelPrices fetches the reference model prices from romaapi and
// upserts them into the public_model_prices DB table (used as fallback when a
// channel has model_price_ratio set but no upstream /api/pricing endpoint).
//
// POST /api/admin/model-data/refresh-public-prices
func RefreshPublicModelPrices(c *gin.Context) {
	if err := service.RefreshPublicModelPrices(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	count, _ := model.CountPublicModelPrices()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   count,
		"message": "public model prices refreshed",
	})
}

// RefreshHubPrice clears the hub.romaapi.com pricing TTL cache and re-fetches
// it immediately, so the next model-data load shows fresh hub_price values.
//
// POST /api/admin/model-data/refresh-hub-price
func RefreshHubPrice(c *gin.Context) {
	count, err := service.RefreshHubPricing(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   count,
		"message": "hub pricing refreshed",
	})
}

func medianFloat64(values []float64) float64 {
	n := len(values)
	if n == 0 {
		return 0
	}
	sorted := make([]float64, n)
	copy(sorted, values)
	sort.Float64s(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

// percentileFloat64 returns the p-th percentile (nearest-rank), matching the
// Flask detect backend's _latency_stats p95 convention. p in [0,1].
func percentileFloat64(values []float64, p float64) float64 {
	n := len(values)
	if n == 0 {
		return 0
	}
	sorted := make([]float64, n)
	copy(sorted, values)
	sort.Float64s(sorted)
	idx := int(math.Round(p * float64(n-1)))
	if idx < 0 {
		idx = 0
	}
	if idx > n-1 {
		idx = n - 1
	}
	return sorted[idx]
}

// cvPercent returns the coefficient of variation as a percentage: sample
// stddev / median ×100 (relative jitter). Returns 0 for <2 samples or median<=0.
func cvPercent(values []float64) float64 {
	n := len(values)
	if n < 2 {
		return 0
	}
	med := medianFloat64(values)
	if med <= 0 {
		return 0
	}
	var mean float64
	for _, v := range values {
		mean += v
	}
	mean /= float64(n)
	var ss float64
	for _, v := range values {
		d := v - mean
		ss += d * d
	}
	std := math.Sqrt(ss / float64(n-1))
	return std / med * 100
}
