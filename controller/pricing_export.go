package controller

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// PricingExport 只读导出渠道费率与 channel_model_pricings 全量数据，
// 供下游部署（Roma）定时拉取做 auto-cheapest 选路。
// 认证：请求头 X-Pricing-Export-Secret 必须等于环境变量 PRICING_EXPORT_SECRET；
// 未配置该环境变量时接口视为关闭（404）。
// 渠道 key 不外发原文，只导出 SHA-256 哈希用于跨部署渠道匹配。

type pricingExportChannel struct {
	Id                  int      `json:"id"`
	Name                string   `json:"name"`
	Type                int      `json:"type"`
	Status              int      `json:"status"`
	KeySHA256           string   `json:"key_sha256"`
	RechargeRate        *float64 `json:"recharge_rate"`
	ApimasterPriceRatio *float64 `json:"apimaster_price_ratio"`
}

type pricingExportPricing struct {
	ChannelId          int     `json:"channel_id"`
	ModelName          string  `json:"model_name"`
	InputPrice         float64 `json:"input_price"`
	OutputPrice        float64 `json:"output_price"`
	CachePrice         float64 `json:"cache_price"`
	CacheCreationPrice float64 `json:"cache_creation_price"`
	GroupRatio         float64 `json:"group_ratio"`
	Currency           string  `json:"currency"`
	PricingSource      string  `json:"pricing_source"`
	FetchedAt          int64   `json:"fetched_at"`
}

func PricingExport(c *gin.Context) {
	secret := strings.TrimSpace(common.GetEnvOrDefaultString("PRICING_EXPORT_SECRET", ""))
	if secret == "" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "pricing export is not enabled"})
		return
	}
	provided := strings.TrimSpace(c.GetHeader("X-Pricing-Export-Secret"))
	if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "invalid secret"})
		return
	}

	var channels []model.Channel
	if err := model.DB.Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportChannels := make([]pricingExportChannel, 0, len(channels))
	for i := range channels {
		ch := &channels[i]
		keyHash := ""
		if trimmed := strings.TrimSpace(ch.Key); trimmed != "" {
			sum := sha256.Sum256([]byte(trimmed))
			keyHash = hex.EncodeToString(sum[:])
		}
		exportChannels = append(exportChannels, pricingExportChannel{
			Id:                  ch.Id,
			Name:                ch.Name,
			Type:                ch.Type,
			Status:              ch.Status,
			KeySHA256:           keyHash,
			RechargeRate:        ch.RechargeRate,
			ApimasterPriceRatio: ch.ApimasterPriceRatio,
		})
	}

	var pricingRows []model.ChannelModelPricing
	if err := model.DB.Find(&pricingRows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportPricings := make([]pricingExportPricing, 0, len(pricingRows))
	for _, row := range pricingRows {
		exportPricings = append(exportPricings, pricingExportPricing{
			ChannelId:          row.ChannelId,
			ModelName:          row.ModelName,
			InputPrice:         row.InputPrice,
			OutputPrice:        row.OutputPrice,
			CachePrice:         row.CachePrice,
			CacheCreationPrice: row.CacheCreationPrice,
			GroupRatio:         row.GroupRatio,
			Currency:           row.Currency,
			PricingSource:      row.PricingSource,
			FetchedAt:          row.FetchedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"generated_at": time.Now().Unix(),
			"channels":     exportChannels,
			"pricings":     exportPricings,
		},
	})
}
