package service

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AutoCheapestGroup is the magic token group name that activates routing
// algorithm 0.1 (cheapest enabled channel first, fallback to next cheapest).
const AutoCheapestGroup = "default"

// SelectCheapestEnabledChannel returns the lowest-priced channel that:
//   - is status=1 (Enabled — auto-disabled and manually-disabled are excluded)
//   - has a pricing row for `modelName` or any of its known variants
//   - hasn't been used (and failed) in the current request's retry chain
//
// The "actual price" comparison key is `input_price * COALESCE(recharge_rate, 1)`,
// matching the formula used by [controller/model_data.go]. We tie-break with
// channel.priority DESC so an operator can hand-promote a tied channel.
//
// Returns (nil, ErrNoCheapestChannel) when no candidate qualifies — the caller
// should map that to a 503 / model-not-found response.
func SelectCheapestEnabledChannel(c *gin.Context, modelName string) (*model.Channel, error) {
	bannedIDs := bannedChannelIDsFromContext(c)
	filter := ChannelPickFilter(c, modelName)
	const maxAttempts = 32
	for attempt := 0; attempt < maxAttempts; attempt++ {
		id1, price1, ok1 := selectCheapestByPricingCandidates(modelName, ModelNameCandidates(modelName), bannedIDs)
		id2, price2, ok2 := selectCheapestByModelMapping(modelName, bannedIDs)
		id3, price3, ok3 := selectCheapestByGlobalSettings(modelName, bannedIDs)

		var pickedID int
		bestPrice := math.MaxFloat64
		for _, cand := range []struct {
			id    int
			price float64
			ok    bool
		}{
			{id1, price1, ok1},
			{id2, price2, ok2},
			{id3, price3, ok3},
		} {
			if !cand.ok || cand.id <= 0 {
				continue
			}
			if cand.price < bestPrice {
				bestPrice = cand.price
				pickedID = cand.id
			}
		}
		if pickedID == 0 {
			return nil, ErrNoCheapestChannel
		}

		ch, err := model.GetChannelById(pickedID, true)
		if err != nil {
			return nil, fmt.Errorf("auto-cheapest load channel %d: %w", pickedID, err)
		}
		if filter == nil || filter(ch) {
			return ch, nil
		}
		bannedIDs = append(bannedIDs, pickedID)
	}
	return nil, ErrNoCheapestChannel
}

// ErrNoCheapestChannel signals "no candidate fits" — distinct sentinel so the
// caller can map it to "no available channel" without parsing the error string.
var ErrNoCheapestChannel = errors.New("no enabled channel for cheapest routing")

// selectCheapestByGlobalSettings routes to enabled channels that advertise the model
// but have no channel_model_pricings row, using System Settings model ratio/price.
func selectCheapestByGlobalSettings(modelName string, bannedIDs []int) (channelID int, actualPrice float64, ok bool) {
	inputUSD, _, _, _, priceOk := GlobalModelPricingUSD(modelName)
	if !priceOk || inputUSD <= 0 {
		return 0, 0, false
	}

	type row struct {
		ChannelID           int
		RechargeRate        float64
		ApimasterPriceRatio float64
		Priority            int64
	}
	candidates := modelPricingLookupNames(modelName)
	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, candidates)

	var rows []row
	q := model.DB.Table("channels c").
		Select("c.id AS channel_id, COALESCE(c.recharge_rate, 1) AS recharge_rate, COALESCE(c.apimaster_price_ratio, 1) AS apimaster_price_ratio, COALESCE(c.priority, 0) AS priority").
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where(modelsMatchClause, modelsMatchArgs...).
		Where("COALESCE(a.enabled, true) = true").
		Where("NOT EXISTS (SELECT 1 FROM channel_model_pricings p WHERE p.channel_id = c.id AND p.model_name IN ? AND p.input_price > 0)", candidates)
	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}
	if err := q.Find(&rows).Error; err != nil || len(rows) == 0 {
		return 0, 0, false
	}

	bestID := 0
	bestPrice := math.MaxFloat64
	bestPriority := int64(math.MinInt64)
	for _, r := range rows {
		rr := r.RechargeRate
		if rr <= 0 {
			rr = 1.0
		}
		apimasterRatio := r.ApimasterPriceRatio
		if apimasterRatio <= 0 {
			apimasterRatio = 1.0
		}
		userPrice := inputUSD * rr * apimasterRatio
		if userPrice < bestPrice || (userPrice == bestPrice && r.Priority > bestPriority) {
			bestPrice = userPrice
			bestID = r.ChannelID
			bestPriority = r.Priority
		}
	}
	if bestID == 0 {
		return 0, 0, false
	}
	return bestID, bestPrice, true
}

func selectCheapestByPricingCandidates(modelName string, candidates []string, bannedIDs []int) (channelID int, actualPrice float64, ok bool) {
	type row struct {
		ChannelID           int
		InputPrice          float64
		RechargeRate        float64
		ApimasterPriceRatio float64
		Priority            int64
	}
	var picked row

	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, candidates)

	// Order by USER price (采购价 × apimaster_price_ratio), not raw procurement cost,
	// so routing picks the channel cheapest *for the user*.
	q := model.DB.Table("channels c").
		Select("c.id AS channel_id, p.input_price, COALESCE(c.recharge_rate, 1) AS recharge_rate, COALESCE(c.apimaster_price_ratio, 1) AS apimaster_price_ratio, COALESCE(c.priority, 0) AS priority").
		Joins("JOIN channel_model_pricings p ON c.id = p.channel_id").
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where("p.model_name IN ?", candidates).
		Where(modelsMatchClause, modelsMatchArgs...).
		Where("COALESCE(a.enabled, true) = true").
		Where("p.input_price > 0").
		Order("(p.input_price * COALESCE(c.recharge_rate, 1) * COALESCE(c.apimaster_price_ratio, 1)) ASC, c.priority DESC").
		Limit(1)
	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}
	if err := q.Scan(&picked).Error; err != nil || picked.ChannelID == 0 {
		return 0, 0, false
	}
	rr := picked.RechargeRate
	if rr <= 0 {
		rr = 1.0
	}
	apimasterRatio := picked.ApimasterPriceRatio
	if apimasterRatio <= 0 {
		apimasterRatio = 1.0
	}
	return picked.ChannelID, picked.InputPrice * rr * apimasterRatio, true
}

// selectCheapestByModelMapping considers channels that map canonical → upstream
// model name in channel_model_pricings (per-channel model_mapping only).
func selectCheapestByModelMapping(modelName string, bannedIDs []int) (channelID int, actualPrice float64, ok bool) {
	type chRow struct {
		ID                  int
		ModelMapping        *string
		RechargeRate        float64
		ApimasterPriceRatio float64
		Priority            int64
	}
	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	var channels []chRow
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, ModelNameCandidates(modelName))
	q := model.DB.Table("channels c").
		Select("c.id, c.model_mapping, COALESCE(c.recharge_rate, 1) AS recharge_rate, COALESCE(c.apimaster_price_ratio, 1) AS apimaster_price_ratio, COALESCE(c.priority, 0) AS priority").
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where("c.model_mapping IS NOT NULL AND c.model_mapping != '' AND c.model_mapping != '{}'").
		Where(modelsMatchClause, modelsMatchArgs...).
		Where("COALESCE(a.enabled, true) = true")
	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}
	if err := q.Find(&channels).Error; err != nil || len(channels) == 0 {
		return 0, 0, false
	}

	bestID := 0
	bestPrice := math.MaxFloat64
	bestPriority := int64(math.MinInt64)
	for _, ch := range channels {
		target := ModelMappingTarget(ch.ModelMapping, modelName)
		if target == "" {
			continue
		}
		pr, found := LookupChannelPricingRow(ch.ID, []string{target})
		if !found {
			continue
		}
		rr := ch.RechargeRate
		if rr <= 0 {
			rr = 1.0
		}
		apimasterRatio := ch.ApimasterPriceRatio
		if apimasterRatio <= 0 {
			apimasterRatio = 1.0
		}
		// USER price = 采购价 × apimaster_price_ratio
		actual := pr.InputPrice * rr * apimasterRatio
		if actual < bestPrice || (actual == bestPrice && ch.Priority > bestPriority) {
			bestPrice = actual
			bestID = ch.ID
			bestPriority = ch.Priority
		}
	}
	if bestID == 0 {
		return 0, 0, false
	}
	return bestID, bestPrice, true
}

// bannedChannelIDsFromContext reads the addUsedChannel() history left by the
// retry loop in controller/relay.go so we don't re-pick a channel that already
// failed this request.
func bannedChannelIDsFromContext(c *gin.Context) []int {
	if c == nil {
		return nil
	}
	raw := c.GetStringSlice("use_channel")
	if len(raw) == 0 {
		return nil
	}
	out := make([]int, 0, len(raw))
	for _, s := range raw {
		if id, err := strconv.Atoi(strings.TrimSpace(s)); err == nil && id > 0 {
			out = append(out, id)
		}
	}
	return out
}
