package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

const channelRPMLimitMark = "CRPM"

var channelRPMInMemoryLimiter common.InMemoryRateLimiter

func ChannelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
		if channelID <= 0 {
			c.Next()
			return
		}

		setting, ok := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
		if !ok || setting.ChannelRPMLimit <= 0 {
			c.Next()
			return
		}

		allowed, err := checkChannelRPMLimit(channelID, setting.ChannelRPMLimit)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "channel_rate_limit_check_failed")
			return
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("channel rpm limit exceeded: %d/min", setting.ChannelRPMLimit))
			return
		}

		c.Next()
	}
}

func checkChannelRPMLimit(channelID int, rpmLimit int) (bool, error) {
	if rpmLimit <= 0 {
		return true, nil
	}

	if common.RedisEnabled && common.RDB != nil {
		return checkChannelRPMLimitRedis(channelID, rpmLimit)
	}
	return checkChannelRPMLimitMemory(channelID, rpmLimit), nil
}

func getChannelRPMBucketKey(channelID int, now time.Time) string {
	minuteBucket := now.Unix() / 60
	return fmt.Sprintf("rateLimit:%s:channel:%d:%d", channelRPMLimitMark, channelID, minuteBucket)
}

func checkChannelRPMLimitRedis(channelID int, rpmLimit int) (bool, error) {
	ctx := context.Background()
	key := getChannelRPMBucketKey(channelID, time.Now())

	count, err := common.RDB.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		if err := common.RDB.Expire(ctx, key, 70*time.Second).Err(); err != nil {
			return false, err
		}
	}

	return count <= int64(rpmLimit), nil
}

func checkChannelRPMLimitMemory(channelID int, rpmLimit int) bool {
	channelRPMInMemoryLimiter.Init(70 * time.Second)
	key := getChannelRPMBucketKey(channelID, time.Now())
	return channelRPMInMemoryLimiter.Request(key, rpmLimit, 70)
}
