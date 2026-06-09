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

		var pickedID int
		switch {
		case ok1 && ok2:
			if price2 < price1 {
				pickedID = id2
			} else if price1 < price2 {
				pickedID = id1
			} else {
				pickedID = id1
			}
		case ok1:
			pickedID = id1
		case ok2:
			pickedID = id2
		default:
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

func selectCheapestByPricingCandidates(modelName string, candidates []string, bannedIDs []int) (channelID int, actualPrice float64, ok bool) {
	type row struct {
		ChannelID   int
		InputPrice  float64
		RechargeRate float64
		Priority    int64
	}
	var picked row

	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, candidates)

	q := model.DB.Table("channels c").
		Select("c.id AS channel_id, p.input_price, COALESCE(c.recharge_rate, 1) AS recharge_rate, COALESCE(c.priority, 0) AS priority").
		Joins("JOIN channel_model_pricings p ON c.id = p.channel_id").
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where("p.model_name IN ?", candidates).
		Where(modelsMatchClause, modelsMatchArgs...).
		Where("COALESCE(a.enabled, true) = true").
		Where("p.input_price > 0").
		Order("(p.input_price * COALESCE(c.recharge_rate, 1)) ASC, c.priority DESC").
		Limit(1)
	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}
	if err := q.Scan(&picked).Error; err != nil || picked.ChannelID == 0 {
		return 0, 0, false
	}
	return picked.ChannelID, picked.InputPrice * picked.RechargeRate, true
}

// selectCheapestByModelMapping considers channels that map canonical → upstream
// model name in channel_model_pricings (per-channel model_mapping only).
func selectCheapestByModelMapping(modelName string, bannedIDs []int) (channelID int, actualPrice float64, ok bool) {
	type chRow struct {
		ID             int
		ModelMapping   *string
		RechargeRate   float64
		Priority       int64
	}
	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	var channels []chRow
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, ModelNameCandidates(modelName))
	q := model.DB.Table("channels c").
		Select("c.id, c.model_mapping, COALESCE(c.recharge_rate, 1) AS recharge_rate, COALESCE(c.priority, 0) AS priority").
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
		actual := pr.InputPrice * rr
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
