package service

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// SiteLinks 营销站页脚/法务链接。
type SiteLinks struct {
	PrivacyPolicy string `json:"privacy_policy"`
	UserAgreement string `json:"user_agreement"`
	Docs          string `json:"docs"`
}

// PublicSiteConfig 营销站全局配置（复用既有 SystemName/Logo/Footer，无 DB 查询）。
type PublicSiteConfig struct {
	SiteName       string    `json:"site_name"`
	Logo           string    `json:"logo"`
	FooterHTML     string    `json:"footer_html"`
	DefaultLanguage string   `json:"default_language"`
	Links          SiteLinks `json:"links"`
}

// PublicPlan 营销站定价方案（解析后的对外结构，features 为字符串数组）。
// 字段使用 camelCase，与前端 MarketingPlan 类型及兜底数据保持一致。
type PublicPlan struct {
	PlanKey     string   `json:"planKey"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	BillingMode string   `json:"billingMode"`
	PriceText   string   `json:"priceText"`
	Features    []string `json:"features"`
	Sort        int      `json:"sort"`
}

// publicModelItem 数据库内 models 字段的 JSON 反序列化结构（snake_case 存储）。
type publicModelItem struct {
	Name           string   `json:"name"`
	CapabilityTags []string `json:"capability_tags"`
	Note           string   `json:"note"`
}

// PublicModelInfo 营销站模型能力条目（对外 camelCase，对齐前端类型）。
type PublicModelInfo struct {
	Name           string   `json:"name"`
	CapabilityTags []string `json:"capabilityTags"`
	Note           string   `json:"note"`
}

// PublicCategory 营销站模型分类（对外结构）。
type PublicCategory struct {
	Category    string            `json:"category"`
	Title       string            `json:"title"`
	Description string            `json:"description"`
	Models      []PublicModelInfo `json:"models"`
}

// NormalizeLocale 将任意 locale 字符串归一到 en / zh（营销站仅双语文案）。
func NormalizeLocale(locale string) string {
	if strings.HasPrefix(strings.ToLower(locale), "zh") {
		return "zh"
	}
	return "en"
}

// GetPublicSiteConfig 组装营销站配置，复用全局变量，无需 DB 查询。
func GetPublicSiteConfig() PublicSiteConfig {
	return PublicSiteConfig{
		SiteName:        common.SystemName,
		Logo:            common.Logo,
		FooterHTML:      common.Footer,
		DefaultLanguage: i18n.DefaultLang,
		Links: SiteLinks{
			PrivacyPolicy: "/privacy-policy",
			UserAgreement: "/user-agreement",
			Docs:          operation_setting.GetGeneralSetting().DocsLink,
		},
	}
}

// GetPublicPricing 读取并解析某 locale 的定价方案（features 由 JSON 文本解析为数组）。
func GetPublicPricing(locale string) ([]PublicPlan, error) {
	rows, err := model.GetEnabledPublicPricings(NormalizeLocale(locale))
	if err != nil {
		return nil, err
	}
	plans := make([]PublicPlan, 0, len(rows))
	for _, r := range rows {
		var features []string
		if r.Features != "" {
			_ = json.Unmarshal([]byte(r.Features), &features)
		}
		if features == nil {
			features = []string{}
		}
		plans = append(plans, PublicPlan{
			PlanKey:     r.PlanKey,
			Title:       r.Title,
			Description: r.Description,
			BillingMode: r.BillingMode,
			PriceText:   r.PriceText,
			Features:    features,
			Sort:        r.Sort,
		})
	}
	return plans, nil
}

// GetPublicModelCatalog 读取并解析某 locale 的模型能力分类。
func GetPublicModelCatalog(locale string) ([]PublicCategory, error) {
	rows, err := model.GetEnabledPublicModelCategories(NormalizeLocale(locale))
	if err != nil {
		return nil, err
	}
	categories := make([]PublicCategory, 0, len(rows))
	for _, r := range rows {
		var items []publicModelItem
		if r.Models != "" {
			_ = json.Unmarshal([]byte(r.Models), &items)
		}
		models := make([]PublicModelInfo, 0, len(items))
		for _, it := range items {
			models = append(models, PublicModelInfo{
				Name:           it.Name,
				CapabilityTags: it.CapabilityTags,
				Note:           it.Note,
			})
		}
		categories = append(categories, PublicCategory{
			Category:    r.Category,
			Title:       r.Title,
			Description: r.Description,
			Models:      models,
		})
	}
	return categories, nil
}
