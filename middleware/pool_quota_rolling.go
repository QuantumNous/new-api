package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-redis/redis/v8"
	"github.com/gin-gonic/gin"
)

type poolQuotaPolicyLoader func(poolId int, metric string, scopeType string) ([]*model.PoolQuotaPolicy, error)

func filterValidPoolQuotaPolicies(policies []*model.PoolQuotaPolicy) ([]*model.PoolQuotaPolicy, int) {
	validPolicies := make([]*model.PoolQuotaPolicy, 0, len(policies))
	maxWindowSeconds := 0
	for _, p := range policies {
		if p == nil || p.WindowSeconds <= 0 || p.LimitCount <= 0 {
			continue
		}
		validPolicies = append(validPolicies, p)
		if p.WindowSeconds > maxWindowSeconds {
			maxWindowSeconds = p.WindowSeconds
		}
	}
	return validPolicies, maxWindowSeconds
}

// loadPoolQuotaScopePoliciesAndScopeKey resolves active policies and redis scope key.
//
// Scope precedence:
// 1) token scope, if token-scope policies exist
// 2) user scope
//
// If token-scope policies exist but token id is missing/invalid, it falls back
// to user scope key as a safe default.
func loadPoolQuotaScopePoliciesAndScopeKey(c *gin.Context, poolId int, loader poolQuotaPolicyLoader) ([]*model.PoolQuotaPolicy, string, int, error) {
	tokenPolicies, err := loader(poolId, model.PoolQuotaMetricRequestCount, model.PoolQuotaScopeToken)
	if err != nil {
		return nil, "", 0, err
	}
	if validTokenPolicies, tokenMaxWindowSeconds := filterValidPoolQuotaPolicies(tokenPolicies); len(validTokenPolicies) > 0 {
		tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
		scopeKey := ""
		if tokenId > 0 {
			scopeKey = "token:" + strconv.Itoa(tokenId)
		} else {
			// Fallback: token-scope policy exists but token identity is unavailable.
			userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
			scopeKey = "user:" + strconv.Itoa(userId)
		}
		common.SetContextKey(c, constant.ContextKeyPoolScopeKey, scopeKey)
		return validTokenPolicies, scopeKey, tokenMaxWindowSeconds, nil
	}

	userPolicies, err := loader(poolId, model.PoolQuotaMetricRequestCount, model.PoolQuotaScopeUser)
	if err != nil {
		return nil, "", 0, err
	}
	validUserPolicies, userMaxWindowSeconds := filterValidPoolQuotaPolicies(userPolicies)
	if len(validUserPolicies) == 0 || userMaxWindowSeconds <= 0 {
		return nil, "", 0, nil
	}

	scopeKey := common.GetContextKeyString(c, constant.ContextKeyPoolScopeKey)
	if scopeKey == "" {
		userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
		scopeKey = "user:" + strconv.Itoa(userId)
		common.SetContextKey(c, constant.ContextKeyPoolScopeKey, scopeKey)
	}
	return validUserPolicies, scopeKey, userMaxWindowSeconds, nil
}

func PoolRollingQuota() func(c *gin.Context) {
	return func(c *gin.Context) {
		if !common.PoolEnabled || !common.PoolQuotaEnabled || !common.PoolRollingWindowEnabled {
			c.Next()
			return
		}

		if !common.RedisEnabled || common.RDB == nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "pool rolling quota requires redis")
			return
		}

		poolId := common.GetContextKeyInt(c, constant.ContextKeyPoolId)
		if poolId <= 0 {
			c.Next()
			return
		}

		validPolicies, scopeKey, maxWindowSeconds, err := loadPoolQuotaScopePoliciesAndScopeKey(c, poolId, model.GetPoolQuotaPolicies)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to load pool quota policies")
			return
		}

		if len(validPolicies) == 0 || maxWindowSeconds <= 0 {
			c.Next()
			return
		}

		requestId := c.GetString(common.RequestIdKey)
		if requestId == "" {
			requestId = fmt.Sprintf("%d-%s", time.Now().UnixNano(), common.GetRandomString(8))
		}

		redisKey := fmt.Sprintf("pool:rq:events:%d:%s", poolId, scopeKey)
		nowMs := time.Now().UnixMilli()
		ctx := context.Background()

		if err = trimPoolWindowEvents(ctx, redisKey, maxWindowSeconds, nowMs); err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to trim pool quota events")
			return
		}

		for _, p := range validPolicies {
			usedCount, countErr := countRollingWindowEvents(ctx, redisKey, p.WindowSeconds, nowMs)
			if countErr != nil {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to count pool quota events")
				return
			}
			if usedCount >= int64(p.LimitCount) {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("pool request limit exceeded: %d requests in %d seconds", p.LimitCount, p.WindowSeconds))
				return
			}
		}

		if err = reservePoolRequestEvent(ctx, redisKey, requestId, nowMs, maxWindowSeconds); err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "failed to reserve pool quota event")
			return
		}

		c.Next()
		if c.Writer != nil && c.Writer.Status() >= http.StatusBadRequest {
			_ = common.RDB.ZRem(ctx, redisKey, requestId).Err()
		}
	}
}

func trimPoolWindowEvents(ctx context.Context, redisKey string, maxWindowSeconds int, nowMs int64) error {
	trimBeforeMs := nowMs - int64(maxWindowSeconds)*1000
	return common.RDB.ZRemRangeByScore(ctx, redisKey, "-inf", fmt.Sprintf("%d", trimBeforeMs)).Err()
}

func countRollingWindowEvents(ctx context.Context, redisKey string, windowSeconds int, nowMs int64) (int64, error) {
	windowStartMs := nowMs - int64(windowSeconds)*1000
	return common.RDB.ZCount(ctx, redisKey, fmt.Sprintf("(%d", windowStartMs), "+inf").Result()
}

func reservePoolRequestEvent(ctx context.Context, redisKey string, requestId string, nowMs int64, maxWindowSeconds int) error {
	if err := common.RDB.ZAdd(ctx, redisKey, &redis.Z{
		Score:  float64(nowMs),
		Member: requestId,
	}).Err(); err != nil {
		return err
	}
	return common.RDB.Expire(ctx, redisKey, time.Duration(maxWindowSeconds+60)*time.Second).Err()
}
