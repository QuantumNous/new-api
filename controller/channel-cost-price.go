package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

// syncChannelCostPricesRequest 渠道成本价格同步请求。
type syncChannelCostPricesRequest struct {
	ChannelID int `json:"channel_id"`
}

// SyncChannelCostPrices 从渠道上游抓取定价，组装该渠道"已添加模型"的成本价格表。
// 返回数据格式与 dto.ChannelCostSettings.ModelPrices 一致，供前端预览/保存。
func SyncChannelCostPrices(c *gin.Context) {
	var req syncChannelCostPricesRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ChannelID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数格式错误"})
		return
	}

	channel, err := model.GetChannelById(req.ChannelID, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "查询渠道失败"})
		return
	}

	baseURL := strings.TrimRight(channel.GetBaseURL(), "/")
	if baseURL == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "渠道未配置 Base URL，无法获取上游定价"})
		return
	}

	isOpenRouter := channel.Type == constant.ChannelTypeOpenRouter
	endpoint := defaultEndpoint
	if isOpenRouter {
		endpoint = "/api/v1/models"
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+endpoint, nil)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if isOpenRouter {
		key, _, apiErr := channel.GetNextEnabledKey()
		if apiErr != nil || strings.TrimSpace(key) == "" {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "OpenRouter 渠道需要有效 API Key"})
			return
		}
		httpReq.Header.Set("Authorization", "Bearer "+strings.TrimSpace(key))
	}

	transport := &http.Transport{
		MaxIdleConns:          20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}
	client := &http.Client{Transport: transport}

	resp, err := client.Do(httpReq)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": fmt.Sprintf("上游返回非 200：%s", resp.Status)})
		return
	}

	limited := io.LimitReader(resp.Body, maxRatioConfigBytes)
	bodyBytes, err := io.ReadAll(limited)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var converted map[string]any
	if isOpenRouter {
		converted, err = convertOpenRouterToRatioData(bytes.NewReader(bodyBytes))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "OpenRouter 定价解析失败: " + err.Error()})
			return
		}
	} else {
		var body struct {
			Success bool            `json:"success"`
			Data    json.RawMessage `json:"data"`
			Message string          `json:"message"`
		}
		if err := common.DecodeJson(bytes.NewReader(bodyBytes), &body); err != nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "上游返回解析失败"})
			return
		}
		if !body.Success {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": body.Message})
			return
		}

		// type1: /api/ratio_config 风格（map 字段）
		var type1Data map[string]any
		if err := common.Unmarshal(body.Data, &type1Data); err == nil {
			isType1 := false
			for _, rt := range pricingSyncFields {
				if _, ok := type1Data[rt]; ok {
					isType1 = true
					break
				}
			}
			if isType1 {
				converted = type1Data
			}
		}

		// type2: /api/pricing 风格（[]Pricing 列表）
		if converted == nil {
			var pricingItems []struct {
				ModelName            string   `json:"model_name"`
				QuotaType            int      `json:"quota_type"`
				ModelRatio           float64  `json:"model_ratio"`
				ModelPrice           float64  `json:"model_price"`
				CompletionRatio      float64  `json:"completion_ratio"`
				CacheRatio           *float64 `json:"cache_ratio"`
				CreateCacheRatio     *float64 `json:"create_cache_ratio"`
				ImageRatio           *float64 `json:"image_ratio"`
				AudioRatio           *float64 `json:"audio_ratio"`
				AudioCompletionRatio *float64 `json:"audio_completion_ratio"`
			}
			if err := common.Unmarshal(body.Data, &pricingItems); err != nil {
				c.JSON(http.StatusOK, gin.H{"success": false, "message": "无法解析上游返回数据"})
				return
			}
			converted = buildChannelCostPricingMap(pricingItems)
		}
	}

	modelPrices := extractChannelCostPrices(converted, channel.GetModels())
	if len(modelPrices) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "上游未返回该渠道已添加模型的价格信息"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"model_prices": modelPrices},
	})
}

// buildChannelCostPricingMap 将 type2（[]Pricing）转换为与 type1 一致的 map 结构。
func buildChannelCostPricingMap(items []struct {
	ModelName            string   `json:"model_name"`
	QuotaType            int      `json:"quota_type"`
	ModelRatio           float64  `json:"model_ratio"`
	ModelPrice           float64  `json:"model_price"`
	CompletionRatio      float64  `json:"completion_ratio"`
	CacheRatio           *float64 `json:"cache_ratio"`
	CreateCacheRatio     *float64 `json:"create_cache_ratio"`
	ImageRatio           *float64 `json:"image_ratio"`
	AudioRatio           *float64 `json:"audio_ratio"`
	AudioCompletionRatio *float64 `json:"audio_completion_ratio"`
}) map[string]any {
	modelRatioMap := make(map[string]float64)
	modelPriceMap := make(map[string]float64)
	completionRatioMap := make(map[string]float64)
	cacheRatioMap := make(map[string]float64)
	createCacheRatioMap := make(map[string]float64)
	imageRatioMap := make(map[string]float64)
	audioRatioMap := make(map[string]float64)
	audioCompletionRatioMap := make(map[string]float64)

	for _, item := range items {
		if item.ModelName == "" {
			continue
		}
		if item.QuotaType == 1 {
			modelPriceMap[item.ModelName] = item.ModelPrice
		} else {
			modelRatioMap[item.ModelName] = item.ModelRatio
			completionRatioMap[item.ModelName] = item.CompletionRatio
		}
		if item.CacheRatio != nil {
			cacheRatioMap[item.ModelName] = *item.CacheRatio
		}
		if item.CreateCacheRatio != nil {
			createCacheRatioMap[item.ModelName] = *item.CreateCacheRatio
		}
		if item.ImageRatio != nil {
			imageRatioMap[item.ModelName] = *item.ImageRatio
		}
		if item.AudioRatio != nil {
			audioRatioMap[item.ModelName] = *item.AudioRatio
		}
		if item.AudioCompletionRatio != nil {
			audioCompletionRatioMap[item.ModelName] = *item.AudioCompletionRatio
		}
	}

	converted := make(map[string]any)
	if len(modelRatioMap) > 0 {
		converted["model_ratio"] = modelRatioMap
	}
	if len(modelPriceMap) > 0 {
		converted["model_price"] = modelPriceMap
	}
	if len(completionRatioMap) > 0 {
		converted["completion_ratio"] = completionRatioMap
	}
	if len(cacheRatioMap) > 0 {
		converted["cache_ratio"] = cacheRatioMap
	}
	if len(createCacheRatioMap) > 0 {
		converted["create_cache_ratio"] = createCacheRatioMap
	}
	if len(imageRatioMap) > 0 {
		converted["image_ratio"] = imageRatioMap
	}
	if len(audioRatioMap) > 0 {
		converted["audio_ratio"] = audioRatioMap
	}
	if len(audioCompletionRatioMap) > 0 {
		converted["audio_completion_ratio"] = audioCompletionRatioMap
	}
	return converted
}

// extractChannelCostPrices 从上游 converted map 提取该渠道已添加模型的成本价格表。
func extractChannelCostPrices(converted map[string]any, models []string) map[string]dto.ChannelModelCost {
	modelRatioMap := valueMap(converted["model_ratio"])
	modelPriceMap := valueMap(converted["model_price"])
	completionRatioMap := valueMap(converted["completion_ratio"])
	cacheRatioMap := valueMap(converted["cache_ratio"])
	createCacheRatioMap := valueMap(converted["create_cache_ratio"])
	imageRatioMap := valueMap(converted["image_ratio"])
	audioRatioMap := valueMap(converted["audio_ratio"])
	audioCompletionRatioMap := valueMap(converted["audio_completion_ratio"])

	result := make(map[string]dto.ChannelModelCost)
	for _, model := range models {
		model = strings.TrimSpace(model)
		if model == "" {
			continue
		}
		mc := dto.ChannelModelCost{}
		has := false
		if v, ok := modelRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok && f > 0 {
				mc.ModelRatio = f
				has = true
			}
		}
		if v, ok := modelPriceMap[model]; ok {
			if f, ok := asFloat64(v); ok && f > 0 {
				mc.ModelPrice = f
				// model_price 与 model_ratio 互斥（Validate 强制二选一），按次/按图计费优先。
				mc.ModelRatio = 0
				has = true
			}
		}
		if v, ok := completionRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.CompletionRatio = f
			}
		}
		if v, ok := cacheRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.CacheRatio = f
			}
		}
		if v, ok := createCacheRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.CreateCacheRatio = f
			}
		}
		if v, ok := imageRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.ImageRatio = f
			}
		}
		if v, ok := audioRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.AudioRatio = f
			}
		}
		if v, ok := audioCompletionRatioMap[model]; ok {
			if f, ok := asFloat64(v); ok {
				mc.AudioCompletionRatio = f
			}
		}
		if has {
			result[model] = mc
		}
	}
	return result
}
