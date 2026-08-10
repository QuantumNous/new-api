package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListDistributors 分页列出分销商。
func ListDistributors(c *gin.Context) {
	page, pageSize := parsePage(c)
	keyword := c.Query("keyword")
	items, total, err := model.SearchDistributors(page, pageSize, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// CreateDistributor 创建分销商。
func CreateDistributor(c *gin.Context) {
	var req struct {
		UserId         int64  `json:"user_id"`
		Name           string `json:"name"`
		Tier           string `json:"tier"`
		CommissionRate int    `json:"commission_rate"`
		Status         int    `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}
	if req.Name == "" || len(req.Name) > 64 {
		common.ApiErrorMsg(c, "name is required and must be <= 64 characters")
		return
	}
	tier := req.Tier
	if tier == "" {
		tier = "standard"
	}
	if !model.AllowedDistributorTiers[tier] {
		common.ApiErrorMsg(c, "invalid tier (expected standard|gold|platinum)")
		return
	}
	status := req.Status
	if status == 0 {
		status = model.DistributorStatusActive
	}
	if !model.AllowedDistributorStatuses[status] {
		common.ApiErrorMsg(c, "invalid status (expected 1 active|2 disabled)")
		return
	}
	m := &model.Distributor{
		UserId:         req.UserId,
		Name:           req.Name,
		Tier:           tier,
		CommissionRate: req.CommissionRate,
		Status:         status,
	}
	if err := model.CreateDistributor(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// GetDistributor 获取单个分销商。
func GetDistributor(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	m, err := model.GetDistributorById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, m)
}

// UpdateDistributor 更新分销商。
func UpdateDistributor(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req struct {
		Name           string `json:"name"`
		Tier           string `json:"tier"`
		CommissionRate int    `json:"commission_rate"`
		Status         int    `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !model.AllowedDistributorTiers[req.Tier] {
		common.ApiErrorMsg(c, "invalid tier (expected standard|gold|platinum)")
		return
	}
	if !model.AllowedDistributorStatuses[req.Status] {
		common.ApiErrorMsg(c, "invalid status (expected 1 active|2 disabled)")
		return
	}
	m := &model.Distributor{Id: id, Name: req.Name, Tier: req.Tier, CommissionRate: req.CommissionRate, Status: req.Status}
	if err := model.UpdateDistributor(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteDistributor 删除分销商（级联价格覆盖）。
func DeleteDistributor(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteDistributor(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// ListDistributorSubUsers 列出分销商下级用户（基于邀请链）。
func ListDistributorSubUsers(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	d, err := model.GetDistributorById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	page, pageSize := parsePage(c)
	items, total, err := model.GetUsersByInviterId(int(d.UserId), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items, "total": total})
}

// ListDistributorPrices 列出分销商价格覆盖。
func ListDistributorPrices(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	items, err := model.SearchDistributorPrices(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

// CreateDistributorPrice 创建价格覆盖。
func CreateDistributorPrice(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req struct {
		Model       string `json:"model"`
		InputPrice  int64  `json:"input_price"`
		OutputPrice int64  `json:"output_price"`
		Currency    string `json:"currency"`
		Unit        string `json:"unit"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Model == "" {
		common.ApiErrorMsg(c, "model is required")
		return
	}
	if req.InputPrice < 0 || req.OutputPrice < 0 {
		common.ApiErrorMsg(c, "prices must be >= 0")
		return
	}
	currency := req.Currency
	if currency == "" {
		currency = "CNY"
	}
	if !model.AllowedDistributorPriceCurrencies[currency] {
		common.ApiErrorMsg(c, "invalid currency (expected CNY|USD)")
		return
	}
	unit := req.Unit
	if unit == "" {
		unit = "token"
	}
	if !model.AllowedDistributorPriceUnits[unit] {
		common.ApiErrorMsg(c, "invalid unit (expected token|image|second|char)")
		return
	}
	m := &model.DistributorPrice{
		DistributorId: id,
		Model:         req.Model,
		InputPrice:    req.InputPrice,
		OutputPrice:   req.OutputPrice,
		Currency:      currency,
		Unit:          unit,
	}
	if err := model.CreateDistributorPrice(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// UpdateDistributorPrice 更新价格覆盖。
func UpdateDistributorPrice(c *gin.Context) {
	priceId, err := strconv.ParseInt(c.Param("price_id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid price_id")
		return
	}
	var req struct {
		Model       string `json:"model"`
		InputPrice  int64  `json:"input_price"`
		OutputPrice int64  `json:"output_price"`
		Currency    string `json:"currency"`
		Unit        string `json:"unit"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if !model.AllowedDistributorPriceCurrencies[req.Currency] {
		common.ApiErrorMsg(c, "invalid currency (expected CNY|USD)")
		return
	}
	if !model.AllowedDistributorPriceUnits[req.Unit] {
		common.ApiErrorMsg(c, "invalid unit (expected token|image|second|char)")
		return
	}
	m := &model.DistributorPrice{
		Id:          priceId,
		Model:       req.Model,
		InputPrice:  req.InputPrice,
		OutputPrice: req.OutputPrice,
		Currency:    req.Currency,
		Unit:        req.Unit,
	}
	if err := model.UpdateDistributorPrice(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteDistributorPrice 删除价格覆盖。
func DeleteDistributorPrice(c *gin.Context) {
	priceId, err := strconv.ParseInt(c.Param("price_id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid price_id")
		return
	}
	if err := model.DeleteDistributorPrice(priceId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// GetDistributorBilling 分销商下级账单汇总。
func GetDistributorBilling(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	d, err := model.GetDistributorById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	billing, err := model.GetDistributorBilling(d.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, billing)
}
