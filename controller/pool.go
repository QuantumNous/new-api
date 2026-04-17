package controller

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func parseRollingWindow(input string) (int, error) {
	window := strings.TrimSpace(strings.ToLower(input))
	if window == "" {
		return 5 * 3600, nil
	}
	if strings.HasSuffix(window, "d") {
		daysStr := strings.TrimSuffix(window, "d")
		days, err := strconv.Atoi(daysStr)
		if err != nil || days <= 0 {
			return 0, fmt.Errorf("invalid window: %s", input)
		}
		return days * 24 * 3600, nil
	}
	duration, err := time.ParseDuration(window)
	if err != nil || duration <= 0 {
		return 0, fmt.Errorf("invalid window: %s", input)
	}
	return int(duration.Seconds()), nil
}

func GetPools(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetPools(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func CreatePool(c *gin.Context) {
	req := &model.Pool{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		common.ApiErrorMsg(c, "pool name cannot be empty")
		return
	}
	if req.Status == 0 {
		req.Status = model.PoolStatusEnabled
	}
	if err := model.CreatePool(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func UpdatePool(c *gin.Context) {
	req := &model.Pool{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "invalid pool id")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		common.ApiErrorMsg(c, "pool name cannot be empty")
		return
	}
	if err := model.UpdatePool(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func DeletePool(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeletePool(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func GetPoolChannels(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	poolId, _ := strconv.Atoi(c.DefaultQuery("pool_id", "0"))
	items, total, err := model.GetPoolChannels(poolId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func CreatePoolChannel(c *gin.Context) {
	req := &model.PoolChannel{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PoolId <= 0 || req.ChannelId <= 0 {
		common.ApiErrorMsg(c, "pool_id and channel_id are required")
		return
	}
	if err := model.CreatePoolChannel(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func UpdatePoolChannel(c *gin.Context) {
	req := &model.PoolChannel{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "invalid pool channel id")
		return
	}
	if req.PoolId <= 0 || req.ChannelId <= 0 {
		common.ApiErrorMsg(c, "pool_id and channel_id are required")
		return
	}
	if err := model.UpdatePoolChannel(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func DeletePoolChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeletePoolChannel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func GetPoolPolicies(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	poolId, _ := strconv.Atoi(c.DefaultQuery("pool_id", "0"))
	metric := strings.TrimSpace(c.Query("metric"))
	scopeType := strings.TrimSpace(c.Query("scope_type"))
	items, total, err := model.GetPoolPolicies(poolId, metric, scopeType, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func CreatePoolPolicy(c *gin.Context) {
	req := &model.PoolQuotaPolicy{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PoolId <= 0 {
		common.ApiErrorMsg(c, "pool_id is required")
		return
	}
	if req.Metric == "" {
		req.Metric = model.PoolQuotaMetricRequestCount
	}
	if req.ScopeType == "" {
		req.ScopeType = model.PoolQuotaScopeUser
	}
	if req.WindowSeconds <= 0 || req.LimitCount <= 0 {
		common.ApiErrorMsg(c, "window_seconds and limit_count must be greater than zero")
		return
	}
	if err := model.CreatePoolPolicy(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func UpdatePoolPolicy(c *gin.Context) {
	req := &model.PoolQuotaPolicy{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "invalid pool policy id")
		return
	}
	if req.PoolId <= 0 {
		common.ApiErrorMsg(c, "pool_id is required")
		return
	}
	if req.WindowSeconds <= 0 || req.LimitCount <= 0 {
		common.ApiErrorMsg(c, "window_seconds and limit_count must be greater than zero")
		return
	}
	if err := model.UpdatePoolPolicy(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func DeletePoolPolicy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeletePoolPolicy(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func GetPoolBindings(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	bindingType := strings.TrimSpace(c.Query("binding_type"))
	bindingValue := strings.TrimSpace(c.Query("binding_value"))
	bindingName := strings.TrimSpace(c.Query("binding_name"))
	items, total, err := model.GetPoolBindings(bindingType, bindingValue, bindingName, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	poolNameById := make(map[int]string, len(items))
	tokenNameById := make(map[int]string)
	userNameById := make(map[int]string)
	respItems := make([]gin.H, 0, len(items))
	for _, item := range items {
		if _, ok := poolNameById[item.PoolId]; !ok {
			if pool, poolErr := model.GetPoolById(item.PoolId); poolErr == nil && pool != nil {
				poolNameById[item.PoolId] = pool.Name
			}
		}
		bindingDisplayName := item.BindingValue
		if item.BindingType == model.PoolBindingTypeToken {
			tokenId, _ := strconv.Atoi(item.BindingValue)
			if tokenId > 0 {
				if _, ok := tokenNameById[tokenId]; !ok {
					if token, tokenErr := model.GetTokenById(tokenId); tokenErr == nil && token != nil {
						tokenNameById[tokenId] = token.Name
					}
				}
				if tokenName := tokenNameById[tokenId]; tokenName != "" {
					bindingDisplayName = tokenName
				}
			}
		} else if item.BindingType == model.PoolBindingTypeUser {
			userId, _ := strconv.Atoi(item.BindingValue)
			if userId > 0 {
				if _, ok := userNameById[userId]; !ok {
					if user, userErr := model.GetUserById(userId, false); userErr == nil && user != nil {
						userNameById[userId] = user.Username
					}
				}
				if userName := userNameById[userId]; userName != "" {
					bindingDisplayName = userName
				}
			}
		}
		respItems = append(respItems, gin.H{
			"id":            item.Id,
			"binding_type":  item.BindingType,
			"binding_value": item.BindingValue,
			"binding_name":  bindingDisplayName,
			"pool_id":       item.PoolId,
			"pool_name":     poolNameById[item.PoolId],
			"priority":      item.Priority,
			"enabled":       item.Enabled,
			"created_at":    item.CreatedAt,
			"updated_at":    item.UpdatedAt,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items":     respItems,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func CreatePoolBinding(c *gin.Context) {
	req := &model.PoolBinding{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.PoolId <= 0 || strings.TrimSpace(req.BindingType) == "" || strings.TrimSpace(req.BindingValue) == "" {
		common.ApiErrorMsg(c, "pool_id, binding_type and binding_value are required")
		return
	}
	if err := model.CreatePoolBinding(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func UpdatePoolBinding(c *gin.Context) {
	req := &model.PoolBinding{}
	if err := c.ShouldBindJSON(req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "invalid pool binding id")
		return
	}
	if req.PoolId <= 0 || strings.TrimSpace(req.BindingType) == "" || strings.TrimSpace(req.BindingValue) == "" {
		common.ApiErrorMsg(c, "pool_id, binding_type and binding_value are required")
		return
	}
	if err := model.UpdatePoolBinding(req); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, req)
}

func DeletePoolBinding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeletePoolBinding(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func GetPoolRollingUsage(c *gin.Context) {
	if !common.RedisEnabled || common.RDB == nil {
		common.ApiErrorMsg(c, "redis is required for rolling usage")
		return
	}
	poolId, _ := strconv.Atoi(c.DefaultQuery("pool_id", "0"))
	if poolId <= 0 {
		common.ApiErrorMsg(c, "pool_id is required")
		return
	}
	scopeType := strings.TrimSpace(strings.ToLower(c.DefaultQuery("scope_type", model.PoolQuotaScopeUser)))
	scopeId, _ := strconv.Atoi(c.DefaultQuery("scope_id", "0"))
	var (
		redisKey    string
		scopeIdName string
	)
	switch scopeType {
	case model.PoolQuotaScopeToken:
		tokenId := scopeId
		if tokenId <= 0 {
			tokenId, _ = strconv.Atoi(c.DefaultQuery("token_id", "0"))
		}
		if tokenId <= 0 {
			common.ApiErrorMsg(c, "token_id is required when scope_type=token")
			return
		}
		scopeId = tokenId
		scopeIdName = "token_id"
		redisKey = fmt.Sprintf("pool:rq:events:%d:token:%d", poolId, tokenId)
	case model.PoolQuotaScopeUser, "":
		scopeType = model.PoolQuotaScopeUser
		userId := scopeId
		if userId <= 0 {
			userId, _ = strconv.Atoi(c.DefaultQuery("user_id", "0"))
		}
		if userId <= 0 {
			common.ApiErrorMsg(c, "user_id is required when scope_type=user")
			return
		}
		scopeId = userId
		scopeIdName = "user_id"
		redisKey = fmt.Sprintf("pool:rq:events:%d:user:%d", poolId, userId)
	default:
		common.ApiErrorMsg(c, "unsupported scope_type, use user or token")
		return
	}

	windowSeconds, err := parseRollingWindow(c.DefaultQuery("window", "5h"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	nowMs := time.Now().UnixMilli()
	startMs := nowMs - int64(windowSeconds)*1000
	count, err := common.RDB.ZCount(context.Background(), redisKey, fmt.Sprintf("(%d", startMs), "+inf").Result()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	resp := gin.H{
		"pool_id":        poolId,
		"scope_type":     scopeType,
		"scope_id":       scopeId,
		"window_seconds": windowSeconds,
		"used_count":     count,
		"redis_key":      redisKey,
	}
	if pool, poolErr := model.GetPoolById(poolId); poolErr == nil && pool != nil {
		resp["pool_name"] = pool.Name
	}
	if scopeType == model.PoolQuotaScopeToken {
		if token, tokenErr := model.GetTokenById(scopeId); tokenErr == nil && token != nil {
			resp["token_name"] = token.Name
		}
	} else if scopeType == model.PoolQuotaScopeUser {
		if user, userErr := model.GetUserById(scopeId, false); userErr == nil && user != nil {
			resp["user_name"] = user.Username
		}
	}
	resp[scopeIdName] = scopeId
	common.ApiSuccess(c, resp)
}

func GetSelfPoolRollingUsage(c *gin.Context) {
	if !common.RedisEnabled || common.RDB == nil {
		common.ApiErrorMsg(c, "redis is required for rolling usage")
		return
	}
	userId := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	if userId <= 0 {
		common.ApiErrorMsg(c, "invalid user")
		return
	}
	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	pool, err := model.ResolvePoolForContext(userId, tokenId, "")
	if err != nil || pool == nil {
		common.ApiErrorMsg(c, "no available pool for current user")
		return
	}
	windowSeconds, err := parseRollingWindow(c.DefaultQuery("window", "5h"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	nowMs := time.Now().UnixMilli()
	startMs := nowMs - int64(windowSeconds)*1000
	redisKey := fmt.Sprintf("pool:rq:events:%d:user:%d", pool.Id, userId)
	count, err := common.RDB.ZCount(context.Background(), redisKey, fmt.Sprintf("(%d", startMs), "+inf").Result()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"pool_id":        pool.Id,
		"pool_name":      pool.Name,
		"user_id":        userId,
		"window_seconds": windowSeconds,
		"used_count":     count,
	})
}
