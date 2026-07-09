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

// CatalogExport 只读导出完整的渠道/供应商/模型目录与 channel_model_pricings，
// 供下游部署（Roma）定时拉取，把 new-api 作为渠道/模型目录的唯一主数据源做全量镜像。
//
// 与 PricingExport 的区别：pricing-export 只导渠道费率 + 定价两张扁平数组，用于
// auto-cheapest 选路；catalog-export 额外导出渠道全部展示元数据（含 setting/settings
// 原始 JSON verbatim）、vendors、models，用于 Roma 端目录镜像与展示。
//
// 认证：请求头 X-Catalog-Export-Secret 必须等于环境变量 CATALOG_EXPORT_SECRET；
// 未配置该环境变量时接口视为关闭（404）。
//
// 安全：渠道 key 不外发原文，只导出 SHA-256 哈希用于跨部署渠道匹配；不导出用户 token。
type catalogExportChannel struct {
	Id                         int      `json:"id"`
	Name                       string   `json:"name"`
	Type                       int      `json:"type"`
	Status                     int      `json:"status"`
	BaseURL                    *string  `json:"base_url"`
	Models                     string   `json:"models"`
	Group                      string   `json:"group"`
	Tag                        *string  `json:"tag"`
	Remark                     *string  `json:"remark"`
	ModelMapping               *string  `json:"model_mapping"`
	Setting                    *string  `json:"setting"`  // 原始 JSON 字符串 verbatim，含前端管理的 key_group/client_exclusive 等键
	OtherSettings              string   `json:"settings"` // 原始 JSON 字符串 verbatim，含 gpt_image2_tier 等键
	KeySHA256                  string   `json:"key_sha256"`
	RechargeRate               *float64 `json:"recharge_rate"`
	ApimasterPriceRatio        *float64 `json:"apimaster_price_ratio"`
	LastDetectedAt             *int64   `json:"last_detected_at"`
	LastDetectResult           string   `json:"last_detect_result"`
	ConsecutiveFingerprintPass int      `json:"consecutive_fingerprint_pass"`
}

type catalogExportVendor struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Status      int    `json:"status"`
}

type catalogExportModel struct {
	Id           int    `json:"id"`
	ModelName    string `json:"model_name"`
	Description  string `json:"description"`
	Icon         string `json:"icon"`
	Tags         string `json:"tags"`
	VendorID     int    `json:"vendor_id"`
	Endpoints    string `json:"endpoints"`
	Status       int    `json:"status"`
	SyncOfficial int    `json:"sync_official"`
	NameRule     int    `json:"name_rule"`
}

type catalogExportPricing struct {
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

func CatalogExport(c *gin.Context) {
	secret := strings.TrimSpace(common.GetEnvOrDefaultString("CATALOG_EXPORT_SECRET", ""))
	if secret == "" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "catalog export is not enabled"})
		return
	}
	provided := strings.TrimSpace(c.GetHeader("X-Catalog-Export-Secret"))
	if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "invalid secret"})
		return
	}

	var channels []model.Channel
	if err := model.DB.Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportChannels := make([]catalogExportChannel, 0, len(channels))
	for i := range channels {
		ch := &channels[i]
		keyHash := ""
		if trimmed := strings.TrimSpace(ch.Key); trimmed != "" {
			sum := sha256.Sum256([]byte(trimmed))
			keyHash = hex.EncodeToString(sum[:])
		}
		exportChannels = append(exportChannels, catalogExportChannel{
			Id:                         ch.Id,
			Name:                       ch.Name,
			Type:                       ch.Type,
			Status:                     ch.Status,
			BaseURL:                    ch.BaseURL,
			Models:                     ch.Models,
			Group:                      ch.Group,
			Tag:                        ch.Tag,
			Remark:                     ch.Remark,
			ModelMapping:               ch.ModelMapping,
			Setting:                    ch.Setting,       // verbatim，不经 dto.ChannelSettings 反序列化
			OtherSettings:              ch.OtherSettings, // verbatim，不经 dto.ChannelOtherSettings 反序列化
			KeySHA256:                  keyHash,
			RechargeRate:               ch.RechargeRate,
			ApimasterPriceRatio:        ch.ApimasterPriceRatio,
			LastDetectedAt:             ch.LastDetectedAt,
			LastDetectResult:           ch.LastDetectResult,
			ConsecutiveFingerprintPass: ch.ConsecutiveFingerprintPass,
		})
	}

	var vendors []model.Vendor
	if err := model.DB.Find(&vendors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportVendors := make([]catalogExportVendor, 0, len(vendors))
	for i := range vendors {
		v := &vendors[i]
		exportVendors = append(exportVendors, catalogExportVendor{
			Id:          v.Id,
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
			Status:      v.Status,
		})
	}

	var models []model.Model
	if err := model.DB.Find(&models).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportModels := make([]catalogExportModel, 0, len(models))
	for i := range models {
		m := &models[i]
		exportModels = append(exportModels, catalogExportModel{
			Id:           m.Id,
			ModelName:    m.ModelName,
			Description:  m.Description,
			Icon:         m.Icon,
			Tags:         m.Tags,
			VendorID:     m.VendorID,
			Endpoints:    m.Endpoints,
			Status:       m.Status,
			SyncOfficial: m.SyncOfficial,
			NameRule:     m.NameRule,
		})
	}

	var pricingRows []model.ChannelModelPricing
	if err := model.DB.Find(&pricingRows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	exportPricings := make([]catalogExportPricing, 0, len(pricingRows))
	for _, row := range pricingRows {
		exportPricings = append(exportPricings, catalogExportPricing{
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
			"vendors":      exportVendors,
			"models":       exportModels,
			"pricings":     exportPricings,
		},
	})
}

// ChannelDataExport 是渠道数据页聚合视图的 secret 认证只读别名：认证通过后直接复用
// GetModelData 逻辑（读 ?model= 参数，返回 {success, data, official}），供下游 Roma
// 只读渠道数据页按需代理拉取（Roma 不本地重算检测/官方价/hub 等）。
func ChannelDataExport(c *gin.Context) {
	secret := strings.TrimSpace(common.GetEnvOrDefaultString("CATALOG_EXPORT_SECRET", ""))
	if secret == "" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "catalog export is not enabled"})
		return
	}
	provided := strings.TrimSpace(c.GetHeader("X-Catalog-Export-Secret"))
	if subtle.ConstantTimeCompare([]byte(provided), []byte(secret)) != 1 {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "invalid secret"})
		return
	}
	// 复用现有渠道数据聚合逻辑（读 c.Query("model")，写 {success, data, official}）。
	GetModelData(c)
}
