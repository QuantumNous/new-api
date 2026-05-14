package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// AutoCheapestGroup is the magic token group name that activates routing
// algorithm 0.1 (cheapest enabled channel first, fallback to next cheapest).
const AutoCheapestGroup = "auto-cheapest"

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
	candidates := ModelNameCandidates(modelName)
	bannedIDs := bannedChannelIDsFromContext(c)

	type row struct {
		ChannelID int
	}
	var picked row

	q := model.DB.Table("channels c").
		Select("c.id AS channel_id").
		Joins("JOIN channel_model_pricings p ON c.id = p.channel_id").
		Where("c.status = 1").
		Where("p.model_name IN ?", candidates).
		Order("(p.input_price * COALESCE(c.recharge_rate, 1)) ASC, c.priority DESC").
		Limit(1)
	if len(bannedIDs) > 0 {
		q = q.Where("c.id NOT IN ?", bannedIDs)
	}
	if err := q.Scan(&picked).Error; err != nil {
		return nil, fmt.Errorf("auto-cheapest query failed: %w", err)
	}
	if picked.ChannelID == 0 {
		return nil, ErrNoCheapestChannel
	}

	ch, err := model.GetChannelById(picked.ChannelID, true)
	if err != nil {
		return nil, fmt.Errorf("auto-cheapest load channel %d: %w", picked.ChannelID, err)
	}
	return ch, nil
}

// ErrNoCheapestChannel signals "no candidate fits" — distinct sentinel so the
// caller can map it to "no available channel" without parsing the error string.
var ErrNoCheapestChannel = errors.New("no enabled channel for cheapest routing")

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
