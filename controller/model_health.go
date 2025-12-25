package controller

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 公共模型健康度缓存配置
const (
	publicModelHealthCacheKey = "public_model_health:hourly_last24h"
	publicModelHealthCacheTTL = 5 * time.Minute // 缓存 5 分钟
)

// 内存缓存（当 Redis 不可用时使用）
var (
	publicModelHealthMemCache     *publicModelHealthCacheData
	publicModelHealthMemCacheLock sync.RWMutex
)

type publicModelHealthCacheData struct {
	Data      interface{}
	ExpireAt  time.Time
}

type modelHealthHourlyRespItem struct {
	ModelName     string  `json:"model_name"`
	HourStartTs   int64   `json:"hour_start_ts"`
	SuccessSlices int64   `json:"success_slices"`
	TotalSlices   int64   `json:"total_slices"`
	SuccessRate   float64 `json:"success_rate"`
}

type publicModelsHealthHourlyLast24hRespItem struct {
	ModelName     string  `json:"model_name"`
	HourStartTs   int64   `json:"hour_start_ts"`
	SuccessSlices int64   `json:"success_slices"`
	TotalSlices   int64   `json:"total_slices"`
	SuccessRate   float64 `json:"success_rate"`
}

// GetModelHealthHourlyStatsAPI 查询模型在小时 bucket 上的健康度（success_slices/total_slices/success_rate）。
// 参数：
// - model_name: string (required)
// - start_hour: unix seconds, aligned to 3600 (optional when hours provided)
// - end_hour: unix seconds, aligned to 3600, exclusive (optional when hours provided)
// - hours: comma separated unix seconds list, aligned to 3600 (optional)
func GetModelHealthHourlyStatsAPI(c *gin.Context) {
	modelName := strings.TrimSpace(c.Query("model_name"))
	if modelName == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "model_name is required"})
		return
	}

	hours, hasHours, err := parseHourListParam(c.Query("hours"))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var startHourTs int64
	var endHourTs int64
	if hasHours {
		for _, h := range hours {
			if !isAlignedHour(h) {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": "hours must be aligned to hour (ts % 3600 == 0)"})
				return
			}
		}
		startHourTs = hours[0]
		endHourTs = hours[len(hours)-1] + 3600
	} else {
		startHourTs, _ = strconv.ParseInt(c.Query("start_hour"), 10, 64)
		endHourTs, _ = strconv.ParseInt(c.Query("end_hour"), 10, 64)
		if !isAlignedHour(startHourTs) || !isAlignedHour(endHourTs) || endHourTs <= startHourTs {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid hour range, require start_hour/end_hour aligned to hour and end_hour > start_hour"})
			return
		}
		// limit range to 31 days to avoid large scan (best-effort guardrail)
		if endHourTs-startHourTs > 31*24*3600 {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "hour range too large (max 31 days)"})
			return
		}
	}

	rows, err := model.GetModelHealthHourlyStats(model.DB, modelName, startHourTs, endHourTs)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	rowMap := make(map[int64]model.ModelHealthHourlyStat, len(rows))
	for _, r := range rows {
		rowMap[r.HourStartTs] = r
	}

	var wantHours []int64
	if hasHours {
		wantHours = hours
	} else {
		count := int((endHourTs - startHourTs) / 3600)
		wantHours = make([]int64, 0, count)
		for h := startHourTs; h < endHourTs; h += 3600 {
			wantHours = append(wantHours, h)
		}
	}

	resp := make([]modelHealthHourlyRespItem, 0, len(wantHours))
	for _, h := range wantHours {
		if stat, ok := rowMap[h]; ok {
			resp = append(resp, modelHealthHourlyRespItem{
				ModelName:     stat.ModelName,
				HourStartTs:   stat.HourStartTs,
				SuccessSlices: stat.SuccessSlices,
				TotalSlices:   stat.TotalSlices,
				SuccessRate:   stat.SuccessRate,
			})
			continue
		}
		resp = append(resp, modelHealthHourlyRespItem{
			ModelName:     modelName,
			HourStartTs:   h,
			SuccessSlices: 0,
			TotalSlices:   0,
			SuccessRate:   0,
		})
	}

	common.ApiSuccess(c, resp)
}

// GetPublicModelsHealthHourlyLast24hAPI 公共接口：查询所有模型最近 24 小时每小时健康度。
// GET /api/public/model_health/hourly_last24h
// 支持 Redis 缓存和内存缓存
func GetPublicModelsHealthHourlyLast24hAPI(c *gin.Context) {
	// 尝试从缓存获取
	if cachedData, ok := getPublicModelHealthCache(); ok {
		common.ApiSuccess(c, cachedData)
		return
	}

	// 缓存未命中，从数据库查询
	now := time.Now().Unix()
	endHourTs := now - (now % 3600) + 3600 // exclusive, aligned to next hour
	startHourTs := endHourTs - 24*3600

	rows, err := model.GetAllModelsHealthHourlyStats(model.DB, startHourTs, endHourTs)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Fill missing hours per model with zeros for stable UI rendering.
	// Build desired hours list
	wantHours := make([]int64, 0, 24)
	for h := startHourTs; h < endHourTs; h += 3600 {
		wantHours = append(wantHours, h)
	}

	// Group by model_name
	grouped := make(map[string]map[int64]model.ModelHealthHourlyStat)
	modelOrder := make([]string, 0)
	for _, r := range rows {
		if _, ok := grouped[r.ModelName]; !ok {
			grouped[r.ModelName] = make(map[int64]model.ModelHealthHourlyStat)
			modelOrder = append(modelOrder, r.ModelName)
		}
		grouped[r.ModelName][r.HourStartTs] = r
	}

	resp := make([]publicModelsHealthHourlyLast24hRespItem, 0, len(modelOrder)*len(wantHours))
	for _, modelName := range modelOrder {
		hourMap := grouped[modelName]
		for _, h := range wantHours {
			if stat, ok := hourMap[h]; ok {
				resp = append(resp, publicModelsHealthHourlyLast24hRespItem{
					ModelName:     stat.ModelName,
					HourStartTs:   stat.HourStartTs,
					SuccessSlices: stat.SuccessSlices,
					TotalSlices:   stat.TotalSlices,
					SuccessRate:   stat.SuccessRate,
				})
				continue
			}
			resp = append(resp, publicModelsHealthHourlyLast24hRespItem{
				ModelName:     modelName,
				HourStartTs:   h,
				SuccessSlices: 0,
				TotalSlices:   0,
				SuccessRate:   0,
			})
		}
	}

	result := gin.H{
		"start_hour": startHourTs,
		"end_hour":   endHourTs,
		"rows":       resp,
	}

	// 存入缓存
	setPublicModelHealthCache(result)

	common.ApiSuccess(c, result)
}

// getPublicModelHealthCache 从缓存获取公共模型健康度数据
func getPublicModelHealthCache() (interface{}, bool) {
	// 优先使用 Redis 缓存
	if common.RedisEnabled {
		cached, err := common.RedisGet(publicModelHealthCacheKey)
		if err == nil && cached != "" {
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(cached), &data); err == nil {
				return data, true
			}
		}
	}

	// 回退到内存缓存
	publicModelHealthMemCacheLock.RLock()
	defer publicModelHealthMemCacheLock.RUnlock()

	if publicModelHealthMemCache != nil && time.Now().Before(publicModelHealthMemCache.ExpireAt) {
		return publicModelHealthMemCache.Data, true
	}

	return nil, false
}

// setPublicModelHealthCache 将公共模型健康度数据存入缓存
func setPublicModelHealthCache(data interface{}) {
	// 存入 Redis 缓存
	if common.RedisEnabled {
		jsonData, err := json.Marshal(data)
		if err == nil {
			_ = common.RedisSet(publicModelHealthCacheKey, string(jsonData), publicModelHealthCacheTTL)
		}
	}

	// 同时存入内存缓存（作为备份）
	publicModelHealthMemCacheLock.Lock()
	defer publicModelHealthMemCacheLock.Unlock()

	publicModelHealthMemCache = &publicModelHealthCacheData{
		Data:     data,
		ExpireAt: time.Now().Add(publicModelHealthCacheTTL),
	}
}