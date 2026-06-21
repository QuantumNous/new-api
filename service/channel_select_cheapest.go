package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AutoCheapestGroup is the magic token group name that activates routing
// algorithm 0.1:
//   - attempt 0 + retry 1: cheapest enabled channel, then next cheapest
//   - retry >= 2: most expensive among remaining (premium fallback)
const AutoCheapestGroup = "default"

// autoCheapestPremiumFallbackRetry is the relay retry index at which
// auto-cheapest switches from price-ascending to price-descending selection.
const autoCheapestPremiumFallbackRetry = 2

// SelectCheapestEnabledChannel returns the channel with the lowest user price
// for modelName, using the exact same formula shown on the Model Data admin page:
//
//	user_price = input_price × recharge_rate × apimaster_price_ratio
//
// Price source priority per channel:
//  1. channel_model_pricings row (direct or via model_mapping alias)
//  2. System Settings global model ratio/price (fallback for channels without a
//     dedicated pricing row)
//
// Channels with no price from either source are excluded.
// Returns (nil, ErrNoCheapestChannel) when no candidate qualifies.
func SelectCheapestEnabledChannel(c *gin.Context, modelName string) (*model.Channel, error) {
	bannedIDs := bannedChannelIDsFromContext(c)
	filter := ChannelPickFilter(c, modelName)
	const maxAttempts = 32
	for attempt := 0; attempt < maxAttempts; attempt++ {
		pickedID := selectCheapestChannelID(modelName, bannedIDs)
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

// ErrNoMostExpensiveChannel is returned when no enabled channel qualifies for
// premium (descending price) fallback routing.
var ErrNoMostExpensiveChannel = errors.New("no enabled channel for premium routing")

// SelectMostExpensiveEnabledChannel picks the highest user-priced enabled
// channel for modelName, excluding channels already recorded in use_channel.
func SelectMostExpensiveEnabledChannel(c *gin.Context, modelName string) (*model.Channel, error) {
	bannedIDs := bannedChannelIDsFromContext(c)
	filter := ChannelPickFilter(c, modelName)
	const maxAttempts = 32
	for attempt := 0; attempt < maxAttempts; attempt++ {
		pickedID := selectMostExpensiveChannelID(modelName, bannedIDs)
		if pickedID == 0 {
			return nil, ErrNoMostExpensiveChannel
		}
		ch, err := model.GetChannelById(pickedID, true)
		if err != nil {
			return nil, fmt.Errorf("auto-cheapest premium load channel %d: %w", pickedID, err)
		}
		if filter == nil || filter(ch) {
			return ch, nil
		}
		bannedIDs = append(bannedIDs, pickedID)
	}
	return nil, ErrNoMostExpensiveChannel
}

// selectCheapestChannelID returns the channel ID with the lowest user price,
// using a single SQL query that mirrors the Model Data page price calculation.
//
// User price = COALESCE(channel_model_pricings.input_price, globalInputUSD)
//
//	× COALESCE(c.recharge_rate, 1)
//	× COALESCE(c.apimaster_price_ratio, 1)
//
// Channels with neither a pricing row nor a global price are excluded.
func selectCheapestChannelID(modelName string, bannedIDs []int) int {
	return selectPricedChannelID(modelName, bannedIDs, true)
}

func selectMostExpensiveChannelID(modelName string, bannedIDs []int) int {
	return selectPricedChannelID(modelName, bannedIDs, false)
}

func selectPricedChannelID(modelName string, bannedIDs []int, ascending bool) int {
	globalInputUSD, _, _, _, hasGlobal := GlobalModelPricingUSD(modelName)
	if !hasGlobal || globalInputUSD <= 0 {
		globalInputUSD = 0
	}

	candidates := ModelPricingLookupNames(modelName)

	modelsCol := "c.models"
	if common.UsingPostgreSQL {
		modelsCol = `c."models"`
	}
	modelsMatchClause, modelsMatchArgs := ChannelsModelsCommaMatchSQL(modelsCol, candidates)

	type result struct {
		ChannelID int
	}
	var row result

	q := model.DB.Table("channels c").
		Select(`c.id AS channel_id`).
		Joins("LEFT JOIN channel_model_pricings p ON p.channel_id = c.id AND p.model_name IN ? AND p.input_price > 0", candidates).
		Joins("LEFT JOIN abilities a ON a.channel_id = c.id AND a.model = ? AND a.group = 'default'", modelName).
		Where("c.status = 1").
		Where(modelsMatchClause, modelsMatchArgs...).
		Where("COALESCE(a.enabled, true) = true")

	if globalInputUSD <= 0 {
		q = q.Where("p.channel_id IS NOT NULL")
	}

	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}

	priceExpr := fmt.Sprintf(
		"(COALESCE(p.input_price, %f) * COALESCE(c.recharge_rate, 1) * COALESCE(c.apimaster_price_ratio, 1))",
		globalInputUSD,
	)
	direction := "DESC"
	tieBreak := "ASC"
	if ascending {
		direction = "ASC"
		tieBreak = "DESC"
	}
	orderExpr := fmt.Sprintf("%s %s, COALESCE(c.priority, 0) %s", priceExpr, direction, tieBreak)
	q = q.Order(orderExpr).Limit(1)

	if err := q.Scan(&row).Error; err != nil || row.ChannelID == 0 {
		return 0
	}
	return row.ChannelID
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
