package controller

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// DetectPoint is one entry in a per-channel history series for the model-data UI.
type DetectPoint struct {
	Status     string     `json:"status"`      // 'pass' / 'suspicious' / 'notcomplete'
	DetectTime int64      `json:"detect_time"` // unix seconds
	Note       string     `json:"note,omitempty"`
	Top5       []TopKItem `json:"top5,omitempty"` // fingerprint top-5 predictions (only on fingerprint history points)
}

// TopKItem is one prediction in the fingerprint top-5 list. Mirrors apimaster's
// detections.top5 JSON shape so detection_sync can copy it straight through.
type TopKItem struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
	Rank  int     `json:"rank,omitempty"`
}

type ModelDataItem struct {
	ChannelID                  int           `json:"channel_id"`
	ChannelName                string        `json:"channel_name"`
	KeyGroup                   string        `json:"key_group"`
	InputPrice                 float64       `json:"input_price"`                   // raw upstream price ($/1M)
	ActualPrice                float64       `json:"actual_price"`                  // input_price × recharge_rate
	RechargeRate               float64       `json:"recharge_rate"`                 // USD cost per 1 USDT of upstream credit
	FingerprintHistory         []DetectPoint `json:"fingerprint_history"`           // last 24 fingerprint runs (newest first)
	UptimeHistory              []DetectPoint `json:"uptime_history"`                // last 24 uptime probes (newest first)
	LatencyMedianMs            float64       `json:"latency_median_ms"`             // median latency over uptime probes in modelDataLatencyWindowSec; 0 if no samples
	Status                     int           `json:"status"`                        // 1 enabled / 2 manual-disabled / 3 auto-disabled (routing algorithm 0.1)
	ConsecutiveFingerprintPass int           `json:"consecutive_fingerprint_pass"`  // recovery counter; only meaningful when status=3
}

const (
	modelDataHistorySize       = 24
	modelDataLatencyWindowSec  = 24 * 60 * 60 // 24h window for the latency median column
)

// GetModelData returns channel pricing and detection stats for a given model.
// GET /api/admin/model-data?model=<model_name>
func GetModelData(c *gin.Context) {
	modelName := c.DefaultQuery("model", "claude-sonnet-4-6")

	type row struct {
		ChannelID                  int
		ChannelName                string
		Setting                    *string
		InputPrice                 float64
		RechargeRate               *float64
		Status                     int
		ConsecutiveFingerprintPass int
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

	var rows []row
	model.DB.Table("channels c").
		Select("c.id as channel_id, c.name as channel_name, c.setting, p.input_price, c.recharge_rate, c.status, c.consecutive_fingerprint_pass").
		Joins("JOIN channel_model_pricings p ON c.id = p.channel_id").
		Where("p.model_name IN ?", candidates).
		// Show all status (1/2/3) so the operator can act on auto-disabled ones from the table.
		Where("c.status IN (1, 2, 3)").
		Where("("+strings.Join(modelsClauses, " OR ")+")", modelsArgs...).
		Order("c.id ASC, p.input_price ASC").
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
	var logs []model.ChannelDetectLog
	model.DB.
		Where("channel_id IN ?", channelIDs).
		Where("claimed_model = ?", modelName).
		Order("detect_time DESC").
		Limit(len(channelIDs) * modelDataHistorySize * 2).
		Find(&logs)

	// Group into fingerprint vs uptime per channel, capped at modelDataHistorySize each.
	// Also collect uptime latencies (pass-only, within the 24h window) for the median column.
	type histories struct {
		Fingerprint []DetectPoint
		Uptime      []DetectPoint
		Latencies   []float64
	}
	nowSec := time.Now().Unix()
	latencyCutoff := nowSec - modelDataLatencyWindowSec
	byChannel := map[int]*histories{}
	for _, l := range logs {
		h, ok := byChannel[l.ChannelId]
		if !ok {
			h = &histories{}
			byChannel[l.ChannelId] = h
		}
		point := DetectPoint{Status: l.Status, DetectTime: l.DetectTime, Note: l.Note}
		if l.Source == "uptime" {
			if len(h.Uptime) < modelDataHistorySize {
				h.Uptime = append(h.Uptime, point)
			}
			if l.Status == "pass" && l.LatencyMeanMs > 0 && l.DetectTime >= latencyCutoff {
				h.Latencies = append(h.Latencies, l.LatencyMeanMs)
			}
		} else {
			// fingerprint points carry top5 (when present in the log row)
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
			fp = h.Fingerprint
			up = h.Uptime
			latencies = h.Latencies
		}

		items = append(items, ModelDataItem{
			ChannelID:                  r.ChannelID,
			ChannelName:                r.ChannelName,
			KeyGroup:                   modelDataExtractKeyGroup(r.Setting),
			InputPrice:                 r.InputPrice,
			ActualPrice:                r.InputPrice * rechargeRate,
			RechargeRate:               rechargeRate,
			FingerprintHistory:         fp,
			UptimeHistory:              up,
			LatencyMedianMs:            medianFloat64(latencies),
			Status:                     r.Status,
			ConsecutiveFingerprintPass: r.ConsecutiveFingerprintPass,
		})
	}

	// Re-sort by actual price ascending.
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && items[j].ActualPrice < items[j-1].ActualPrice; j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

func modelDataExtractKeyGroup(setting *string) string {
	return service.ExtractKeyGroup(setting)
}

// ToggleChannelStatus is the manual enable/disable button on the Model Data row.
// disable → status=2 (Manual; algorithm leaves it alone forever)
// enable  → status=1 + counter reset (gives a clean slate for any future algorithm action)
//
// POST /api/admin/model-data/toggle  body: {"channel_id": int, "action": "enable"|"disable"}
func ToggleChannelStatus(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id"`
		Action    string `json:"action"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.ChannelID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request"})
		return
	}
	updates := map[string]interface{}{}
	switch req.Action {
	case "disable":
		updates["status"] = 2
	case "enable":
		updates["status"] = 1
		updates["consecutive_fingerprint_pass"] = 0
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "action must be enable or disable"})
		return
	}
	if err := model.DB.Model(&model.Channel{}).Where("id = ?", req.ChannelID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
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
