package governor

import (
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
)

type CooldownDecision struct {
	CoolChannel bool
	CoolKey     bool
	TTL         time.Duration
}

func ClassifyRelayError(cfg Config, apiErr *types.NewAPIError) CooldownDecision {
	if apiErr == nil {
		return CooldownDecision{}
	}

	keyTTL := time.Duration(cfg.KeyCooldownSeconds) * time.Second
	if cfg.RespectRetryAfter {
		if retryAfterTTL := parseRetryAfter(apiErr.RetryAfter); retryAfterTTL > 0 {
			keyTTL = retryAfterTTL
		}
	}
	if containsStatus(cfg.KeyCooldownOnStatuses, apiErr.StatusCode) {
		return CooldownDecision{CoolKey: true, TTL: keyTTL}
	}

	if containsStatus(cfg.ChannelCooldownOnStatuses, apiErr.StatusCode) {
		channelTTL := time.Duration(cfg.ChannelCooldownSeconds) * time.Second
		if cfg.RespectRetryAfter {
			if retryAfterTTL := parseRetryAfter(apiErr.RetryAfter); retryAfterTTL > 0 {
				channelTTL = retryAfterTTL
			}
		}
		return CooldownDecision{CoolChannel: true, TTL: channelTTL}
	}

	return CooldownDecision{}
}

func ClassifyTaskError(cfg Config, taskErr *dto.TaskError) CooldownDecision {
	if taskErr == nil {
		return CooldownDecision{}
	}
	if containsStatus(cfg.ChannelCooldownOnStatuses, taskErr.StatusCode) {
		return CooldownDecision{
			CoolChannel: true,
			TTL:         time.Duration(cfg.ChannelCooldownSeconds) * time.Second,
		}
	}
	return CooldownDecision{}
}

func parseRetryAfter(value string) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || seconds <= 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}

func containsStatus(statuses []int, status int) bool {
	for _, candidate := range statuses {
		if candidate == status {
			return true
		}
	}
	return false
}
