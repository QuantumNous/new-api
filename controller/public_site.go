package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// GetSiteConfig 营销站配置：复用 SystemName/Logo/Footer，无鉴权。
func GetSiteConfig(c *gin.Context) {
	common.ApiSuccess(c, service.GetPublicSiteConfig())
}

// GetPublicPricing 营销站定价方案列表（按 locale）。
func GetPublicPricing(c *gin.Context) {
	locale := c.Query("locale")
	plans, err := service.GetPublicPricing(locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"plans": plans})
}

// GetPublicModelCatalog 营销站模型能力分类列表（按 locale）。
func GetPublicModelCatalog(c *gin.Context) {
	locale := c.Query("locale")
	categories, err := service.GetPublicModelCatalog(locale)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"categories": categories})
}

// ContactSalesRequest “联系销售”表单提交体。
type ContactSalesRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Company        string `json:"company"`
	Region         string `json:"region"`
	UseCase        string `json:"use_case"`
	MonthlyVolume  string `json:"monthly_volume"`
	RequiredModels string `json:"required_models"`
	Message        string `json:"message"`
	Redirect       string `json:"redirect"`
}

// ContactSales 写入销售线索（公开接口，限流 + 字段校验 + redirect 白名单）。
func ContactSales(c *gin.Context) {
	var req ContactSalesRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "name is required and must be <= 64 characters")
		return
	}
	if req.Email == "" || len(req.Email) > 128 || common.Validate.Var(req.Email, "email") != nil {
		common.ApiErrorMsg(c, "a valid email (<=128 chars) is required")
		return
	}
	if req.Region == "" || len(req.Region) > 64 {
		common.ApiErrorMsg(c, "region is required and must be <= 64 characters")
		return
	}
	if req.UseCase == "" || len(req.UseCase) > 256 {
		common.ApiErrorMsg(c, "use_case is required and must be <= 256 characters")
		return
	}
	if len(req.Company) > 128 {
		common.ApiErrorMsg(c, "company must be <= 128 characters")
		return
	}
	if len(req.MonthlyVolume) > 64 {
		common.ApiErrorMsg(c, "monthly_volume must be <= 64 characters")
		return
	}
	if len(req.RequiredModels) > 512 {
		common.ApiErrorMsg(c, "required_models must be <= 512 characters")
		return
	}
	if len(req.Message) > 1024 {
		common.ApiErrorMsg(c, "message must be <= 1024 characters")
		return
	}
	if !common.IsSafeRedirect(req.Redirect) {
		common.ApiErrorMsg(c, "unsafe redirect target")
		return
	}

	lead := &model.SalesLead{
		Name:           req.Name,
		Email:          req.Email,
		Company:        req.Company,
		Region:         req.Region,
		UseCase:        req.UseCase,
		MonthlyVolume:  req.MonthlyVolume,
		RequiredModels: req.RequiredModels,
		Message:        req.Message,
		Status:         "new",
		Source:         c.GetHeader("Referer"),
	}
	if err := model.CreateSalesLead(lead); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": lead.Id})
}
