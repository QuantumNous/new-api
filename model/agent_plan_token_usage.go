package model

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"math"

	"github.com/QuantumNous/new-api/common"
)

// AgentPlanUsageKey associates an Ark plan request with its final upstream key.
// The Agent Plan name is retained for the stored log reference.
type AgentPlanUsageKey struct {
	ChannelID int
	KeyRef    string
}

// AgentPlanKeyRef identifies a credential across channels and key rotations.
func AgentPlanKeyRef(key string) string {
	digest := sha256.Sum256([]byte("volcengine-agent-plan:" + key))
	return hex.EncodeToString(digest[:])
}

// AgentPlanTokenUsage is indexed by key reference and then channel ID.
type AgentPlanTokenUsage map[string]map[int]int64

// ReadAgentPlanTokenUsage aggregates attributed usage logs over [start, end).
func ReadAgentPlanTokenUsage(ctx context.Context, channelIDs []int, start, end int64) (AgentPlanTokenUsage, error) {
	totals := make(AgentPlanTokenUsage)
	if len(channelIDs) == 0 {
		return totals, nil
	}

	rows, err := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select("channel_id, prompt_tokens, completion_tokens, other").
		Where("type = ? AND created_at >= ? AND created_at < ? AND channel_id IN ?", LogTypeConsume, start, end, channelIDs).
		Where("other LIKE ?", `%"`+logOtherAgentPlanKeyRef+`":"%`).
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var channelID int
		var prompt, completion int64
		var other string
		if err := rows.Scan(&channelID, &prompt, &completion, &other); err != nil {
			return nil, err
		}
		var usage struct {
			KeyRef      string `json:"agent_plan_key_ref"`
			Semantic    string `json:"usage_semantic"`
			InputTotal  int64  `json:"input_tokens_total"`
			CacheRead   int64  `json:"cache_tokens"`
			CacheWrite  int64  `json:"cache_write_tokens"`
			LegacyWrite int64  `json:"cache_creation_tokens"`
		}
		if common.UnmarshalJsonStr(other, &usage) != nil || usage.KeyRef == "" {
			continue
		}
		// The normalized input total already includes cached input. Raw
		// Anthropic input excludes cache reads and writes.
		input := max(prompt, 0)
		if usage.InputTotal > 0 {
			input = usage.InputTotal
		} else if usage.Semantic == "anthropic" {
			input += min(max(usage.CacheRead, 0), math.MaxInt64-input)
			cacheWrite := usage.CacheWrite
			if cacheWrite == 0 {
				cacheWrite = usage.LegacyWrite
			}
			input += min(max(cacheWrite, 0), math.MaxInt64-input)
		}
		channels := totals[usage.KeyRef]
		if channels == nil {
			channels = make(map[int]int64)
			totals[usage.KeyRef] = channels
		}
		amount := input + min(max(completion, 0), math.MaxInt64-input)
		channels[channelID] += min(amount, math.MaxInt64-channels[channelID])
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return totals, nil
}
