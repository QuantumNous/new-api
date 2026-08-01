package controller

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// MarketModel statuses (mirror model.AllowedMarketModelStatuses).
const (
	MarketModelStatusAvailable  = 1
	MarketModelStatusComingSoon = 2
	MarketModelStatusDisabled   = 3
)

var allowedMarketModelStatuses = map[int]bool{
	MarketModelStatusAvailable:  true,
	MarketModelStatusComingSoon: true,
	MarketModelStatusDisabled:   true,
}

var allowedMarketModelUnits = map[string]bool{
	"token":  true,
	"image":  true,
	"second": true,
	"char":   true,
}

var allowedMarketModelCurrencies = map[string]bool{
	"CNY": true,
	"USD": true,
}

// MarketModelRequest 上架模型的新建/更新请求体。
type MarketModelRequest struct {
	Model       string `json:"model"`
	Provider    string `json:"provider"`
	Category    string `json:"category"`
	Tags        string `json:"tags"`
	InputPrice  int64  `json:"input_price"`
	OutputPrice int64  `json:"output_price"`
	Currency    string `json:"currency"`
	Unit        string `json:"unit"`
	Metadata    string `json:"metadata"`
	TrialQuota  int64  `json:"trial_quota"`
	Status      int    `json:"status"`
	Featured    bool   `json:"featured"`
	Sort        int    `json:"sort"`
}

func validateMarketModelRequest(req *MarketModelRequest, isCreate bool) (bool, string) {
	if isCreate {
		if req.Model == "" || len(req.Model) > 255 {
			return false, "model is required and must be <= 255 characters"
		}
	}
	if req.Category == "" || len(req.Category) > 32 {
		return false, "category is required and must be <= 32 characters"
	}
	if len(req.Provider) > 64 {
		return false, "provider must be <= 64 characters"
	}
	if len(req.Tags) > 255 {
		return false, "tags must be <= 255 characters"
	}
	if req.InputPrice < 0 || req.OutputPrice < 0 {
		return false, "prices must be >= 0"
	}
	if req.TrialQuota < 0 {
		return false, "trial_quota must be >= 0"
	}
	unit := req.Unit
	if unit == "" {
		unit = "token"
	}
	if !allowedMarketModelUnits[unit] {
		return false, "invalid unit (expected token|image|second|char)"
	}
	currency := req.Currency
	if currency == "" {
		currency = "CNY"
	}
	if !allowedMarketModelCurrencies[currency] {
		return false, "invalid currency (expected CNY|USD)"
	}
	if req.Metadata != "" {
		var tmp interface{}
		if err := json.Unmarshal([]byte(req.Metadata), &tmp); err != nil {
			return false, "metadata must be valid JSON"
		}
	}
	if !allowedMarketModelStatuses[req.Status] {
		return false, "invalid status (expected 1 available|2 coming_soon|3 disabled)"
	}
	return true, ""
}

// CreateMarketModel 管理员新建上架模型。
func CreateMarketModel(c *gin.Context) {
	var req MarketModelRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if ok, msg := validateMarketModelRequest(&req, true); !ok {
		common.ApiErrorMsg(c, msg)
		return
	}
	// 唯一性校验
	if cnt, err := model.CountMarketModelsByModel(req.Model); err != nil {
		common.ApiError(c, err)
		return
	} else if cnt > 0 {
		common.ApiErrorMsg(c, "model already listed in market")
		return
	}
	m := &model.MarketModel{
		Model:       req.Model,
		Provider:    req.Provider,
		Category:    req.Category,
		Tags:        req.Tags,
		InputPrice:  req.InputPrice,
		OutputPrice: req.OutputPrice,
		Unit:        orDefault(req.Unit, "token"),
		TrialQuota:  req.TrialQuota,
		Status:      req.Status,
		Featured:    req.Featured,
		Sort:        req.Sort,
	}
	if m.Status == 0 {
		m.Status = MarketModelStatusAvailable
	}
	if m.Currency == "" {
		m.Currency = "CNY"
	}
	if err := model.CreateMarketModel(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": m.Id})
}

// GetMarketModel 管理员查看单条上架记录。
func GetMarketModel(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	m, err := model.GetMarketModelById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, m)
}

// ListMarketModels 管理员列出上架模型，可选 status/category 过滤，支持分页（p/page_size）。
func ListMarketModels(c *gin.Context) {
	status := c.Query("status")
	category := c.Query("category")
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 20
	}
	items, total, err := model.SearchMarketModelsPaginated(status, category, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// UpdateMarketModel 管理员更新上架记录（Model 唯一键不可变）。
func UpdateMarketModel(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	var req MarketModelRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if ok, msg := validateMarketModelRequest(&req, false); !ok {
		common.ApiErrorMsg(c, msg)
		return
	}
	m := &model.MarketModel{
		Id:          id,
		Provider:    req.Provider,
		Category:    req.Category,
		Tags:        req.Tags,
		InputPrice:  req.InputPrice,
		OutputPrice: req.OutputPrice,
		Currency:    orDefault(req.Currency, "CNY"),
		Unit:        orDefault(req.Unit, "token"),
		Metadata:    req.Metadata,
		TrialQuota:  req.TrialQuota,
		Status:      req.Status,
		Featured:    req.Featured,
		Sort:        req.Sort,
	}
	if err := model.UpdateMarketModel(m); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// DeleteMarketModel 管理员删除上架记录。
func DeleteMarketModel(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DeleteMarketModel(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ok": true})
}

// GetPublicMarketModels 门店公开读取：仅返回已上架（status=available）模型，按分类与排序。
// 支持 ?locale=zh|en：从 Metadata 解析对应 locale 的展示覆盖（name/description）叠加到 i18n 字段。
func GetPublicMarketModels(c *gin.Context) {
	items, err := model.SearchMarketModels(strconv.Itoa(MarketModelStatusAvailable), "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	locale := orDefault(c.Query("locale"), "zh")
	result := make([]gin.H, 0, len(items))
	for _, m := range items {
		result = append(result, gin.H{
			"model": m,
			"i18n":  resolveMarketModelI18n(m, locale),
		})
	}
	common.ApiSuccess(c, gin.H{"items": result})
}

// resolveMarketModelI18n 从 Metadata JSON 解析指定 locale 的展示覆盖（name/description）。
// 无 Metadata 或无对应 locale 时返回 nil。
func resolveMarketModelI18n(m *model.MarketModel, locale string) map[string]string {
	if strings.TrimSpace(m.Metadata) == "" {
		return nil
	}
	var data map[string]map[string]string
	if err := json.Unmarshal([]byte(m.Metadata), &data); err != nil {
		return nil
	}
	entry, ok := data[locale]
	if !ok {
		return nil
	}
	out := map[string]string{}
	if v, ok := entry["name"]; ok && v != "" {
		out["name"] = v
	}
	if v, ok := entry["description"]; ok && v != "" {
		out["description"] = v
	}
	if len(out) == 0 {
		return nil
	}
	out["locale"] = locale
	return out
}

// orDefault 返回非空值或默认值。
func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}
