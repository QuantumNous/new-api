package agent

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/agent_setting"
)

func GuardIn(ctx context.Context, userId int) error {
	if userId <= 0 {
		return errors.New("invalid user")
	}
	setting := agent_setting.GetAgentSetting()
	if !setting.Enabled {
		return errors.New("agent service is disabled")
	}
	if setting.ChatRPM > 0 {
		if err := checkRateLimit(fmt.Sprintf("agent:chat:%d:%d", userId, time.Now().Unix()/60), setting.ChatRPM, time.Minute); err != nil {
			return err
		}
	}
	return EnsureAgentQuota(ctx, userId)
}

func GuardConfirm(userId int) error {
	setting := agent_setting.GetAgentSetting()
	if !setting.Enabled {
		return errors.New("agent service is disabled")
	}
	if setting.ConfirmRPM > 0 {
		return checkRateLimit(fmt.Sprintf("agent:confirm:%d:%d", userId, time.Now().Unix()/60), setting.ConfirmRPM, time.Minute)
	}
	return nil
}

func checkRateLimit(key string, limit int, ttl time.Duration) error {
	if !common.RedisEnabled || common.RDB == nil {
		return nil
	}
	ctx := context.Background()
	count, err := common.RDB.Incr(ctx, key).Result()
	if err != nil {
		return err
	}
	if count == 1 {
		_ = common.RDB.Expire(ctx, key, ttl).Err()
	}
	if count > int64(limit) {
		return errors.New("agent rate limit exceeded")
	}
	return nil
}
