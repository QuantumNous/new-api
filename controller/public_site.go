package controller

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// resolvePublicLocale 从 query 读取 locale，仅允许 en/zh，缺省 en。
func resolvePublicLocale(c *gin.Context) string {
	locale := strings.ToLower(strings.TrimSpace(c.Query("locale")))
	if locale != "zh" {
		return "en"
	}
	return "zh"
}

// GetPublicSiteConfig 返回站点品牌信息，供营销站页头/页脚使用。
func GetPublicSiteConfig(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"system_name": common.SystemName,
		"logo":        common.Logo,
	})
}

// GetPublicPricing 返回公开定价方案（按 locale）。
func GetPublicPricing(c *gin.Context) {
	locale := resolvePublicLocale(c)
	var items []model.PublicPricing
	if err := model.DB.Where("locale = ? AND enabled = ?", locale, true).
		Order("sort asc").Find(&items).Error; err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, items)
}

// GetPublicModelCategories 返回公开模型目录（按 locale）。
func GetPublicModelCategories(c *gin.Context) {
	locale := resolvePublicLocale(c)
	var items []model.PublicModelCategory
	if err := model.DB.Where("locale = ? AND enabled = ?", locale, true).
		Order("sort asc").Find(&items).Error; err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, items)
}

type salesLeadRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Company        string `json:"company"`
	Region         string `json:"region"`
	UseCase        string `json:"use_case"`
	MonthlyVolume  string `json:"monthly_volume"`
	RequiredModels string `json:"required_models"`
	Message        string `json:"message"`
	Source         string `json:"source"`
	Redirect       string `json:"redirect"`
}

// PostPublicSalesLead 接收「联系销售」表单，写入销售线索。
func PostPublicSalesLead(c *gin.Context) {
	var req salesLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "请求格式错误")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Region = strings.TrimSpace(req.Region)
	req.UseCase = strings.TrimSpace(req.UseCase)

	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "请填写有效的姓名（≤64 字符）")
		return
	}
	if !strings.Contains(req.Email, "@") || len(req.Email) > 128 {
		common.ApiErrorMsg(c, "请填写有效的邮箱")
		return
	}
	if req.Region == "" {
		common.ApiErrorMsg(c, "请选择所在区域")
		return
	}
	if req.UseCase == "" || len(req.UseCase) > 256 {
		common.ApiErrorMsg(c, "请填写使用场景（≤256 字符）")
		return
	}
	if len(req.Company) > 128 || len(req.MonthlyVolume) > 64 ||
		len(req.RequiredModels) > 512 || len(req.Message) > 2000 {
		common.ApiErrorMsg(c, "字段超出长度限制")
		return
	}

	// 开放重定向防护：redirect 仅允许本站相对路径
	safeRedirect := ""
	if r := strings.TrimSpace(req.Redirect); r != "" {
		if strings.HasPrefix(r, "/") && !strings.HasPrefix(r, "//") && !strings.Contains(r, ":") {
			safeRedirect = r
		}
	}

	now := time.Now().Unix()
	lead := model.SalesLead{
		Name:           req.Name,
		Email:          req.Email,
		Company:        req.Company,
		Region:         req.Region,
		UseCase:        req.UseCase,
		MonthlyVolume:  req.MonthlyVolume,
		RequiredModels: req.RequiredModels,
		Message:        req.Message,
		Status:         "new",
		Source:         req.Source,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := model.DB.Create(&lead).Error; err != nil {
		common.ApiErrorMsg(c, "提交失败，请稍后重试")
		return
	}

	common.ApiSuccess(c, gin.H{
		"id":       lead.Id,
		"redirect": safeRedirect,
	})
}
