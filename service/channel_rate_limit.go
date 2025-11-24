package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	ChannelRPMPrefix = "channel:rpm:"
	ChannelTPMPrefix = "channel:tpm:"
	ChannelRPDPrefix = "channel:rpd:"
)

func CheckChannelRateLimit(channelId int, modelName string, rpm, tpm, rpd int) error {
	if !common.RedisEnabled {
		return nil
	}
	ctx := context.Background()
	rdb := common.RDB

	// RPM Check (Sliding Window using List)
	if rpm > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelRPMPrefix, channelId, modelName)
		lenVal, err := rdb.LLen(ctx, key).Result()
		if err == nil && int(lenVal) >= rpm {
			// List is full, check time of the oldest request
			oldTimeVal, err := rdb.LIndex(ctx, key, -1).Int64()
			if err == nil {
				now := time.Now().Unix()
				if now-oldTimeVal < 60 {
					return fmt.Errorf("model %s RPM limit exceeded", modelName)
				}
			}
		}
	}

	// RPD Check (Fixed Window 24h)
	if rpd > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelRPDPrefix, channelId, modelName)
		val, err := rdb.Get(ctx, key).Int64()
		if err == nil && val >= int64(rpd) {
			return fmt.Errorf("model %s RPD limit exceeded", modelName)
		}
	}

	// TPM Check (Fixed Window 1m)
	if tpm > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelTPMPrefix, channelId, modelName)
		val, err := rdb.Get(ctx, key).Int64()
		if err == nil && val >= int64(tpm) {
			return fmt.Errorf("model %s TPM limit exceeded", modelName)
		}
	}

	return nil
}

func RecordChannelRateLimit(channelId int, modelName string, rpm, tpm, rpd int, tokens int) {
	if !common.RedisEnabled {
		return
	}
	ctx := context.Background()
	rdb := common.RDB

	// RPM Record
	if rpm > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelRPMPrefix, channelId, modelName)
		rdb.LPush(ctx, key, time.Now().Unix())
		rdb.LTrim(ctx, key, 0, int64(rpm-1))
		rdb.Expire(ctx, key, time.Minute)
	}

	// RPD Record
	if rpd > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelRPDPrefix, channelId, modelName)
		val, _ := rdb.Incr(ctx, key).Result()
		if val == 1 {
			rdb.Expire(ctx, key, 24*time.Hour)
		}
	}

	// TPM Record
	if tpm > 0 && tokens > 0 {
		key := fmt.Sprintf("%s%d:%s", ChannelTPMPrefix, channelId, modelName)
		val, _ := rdb.IncrBy(ctx, key, int64(tokens)).Result()
		if val == int64(tokens) {
			rdb.Expire(ctx, key, time.Minute)
		}
	}
}
