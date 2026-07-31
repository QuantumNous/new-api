package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetCreemProducts(c *gin.Context) {
	config := currentCreemConfig()
	products, err := parseCreemProducts(config.Products)
	if err != nil {
		common.ApiErrorMsg(c, "Creem product configuration is invalid")
		return
	}
	safeProducts := make([]gin.H, 0, len(products))
	for _, product := range products {
		safeProducts = append(safeProducts, gin.H{"product_id": product.ProductId, "name": product.Name, "price": product.Price, "currency": product.Currency, "quota": product.Quota, "popular": product.Popular})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"mode": map[bool]string{true: "test", false: "live"}[config.TestMode], "products": safeProducts}})
}

func GetCurrentCreemSubscription(c *gin.Context) {
	link, err := model.GetCreemSubscriptionLinkByUser(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if link == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"subscription_id": link.CreemSubscriptionId, "status": link.ProviderStatus,
		"plan_id": link.PlanId, "user_subscription_id": link.CurrentUserSubscriptionId,
		"product_id": link.ProductId, "period_start": link.PeriodStart,
		"period_end": link.PeriodEnd, "cancel_at_period_end": link.CancelAtPeriodEnd,
	}})
}

type creemCancelRequest struct {
	SubscriptionId string `json:"subscription_id"`
}

var requestCreemScheduledCancel = func(ctx context.Context, config creemConfigSnapshot, subscriptionId string) error {
	baseURL := "https://api.creem.io"
	if config.TestMode {
		baseURL = "https://test-api.creem.io"
	}
	body, _ := common.Marshal(gin.H{"mode": "scheduled", "onExecute": "cancel"})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/subscriptions/"+url.PathEscape(subscriptionId)+"/cancel", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", config.ApiKey)
	response, err := creemHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)
	if response.StatusCode/100 != 2 {
		return fmt.Errorf("unexpected Creem cancellation status %d", response.StatusCode)
	}
	return nil
}

func ScheduleCreemSubscriptionCancel(c *gin.Context) {
	var request creemCancelRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "invalid parameters")
		return
	}
	link, err := model.GetCreemSubscriptionLinkByUser(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if link == nil || strings.TrimSpace(request.SubscriptionId) == "" || request.SubscriptionId != link.CreemSubscriptionId {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "Creem subscription does not belong to the current user"})
		return
	}
	switch link.ProviderStatus {
	case "canceled", "expired", "paused":
		common.ApiErrorMsg(c, "Creem subscription is already terminal")
		return
	}
	if link.ProviderStatus == "scheduled_cancel" {
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}
	config := currentCreemConfig()
	if strings.TrimSpace(config.ApiKey) == "" {
		common.ApiErrorMsg(c, "Creem API key is not configured")
		return
	}
	if err := requestCreemScheduledCancel(c.Request.Context(), config, link.CreemSubscriptionId); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Creem scheduled cancellation failed subscription_id=%s error=%q", link.CreemSubscriptionId, err.Error()))
		common.ApiErrorMsg(c, "Creem cancellation request failed")
		return
	}
	if err := model.MarkCreemScheduledCancel(c.GetInt("id"), link.CreemSubscriptionId); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

type creemConfigRequest struct {
	ApiKey        string        `json:"api_key"`
	WebhookSecret string        `json:"webhook_secret"`
	Products      jsonRawString `json:"products"`
	TestMode      bool          `json:"test_mode"`
}

type jsonRawString string

func (value *jsonRawString) UnmarshalJSON(data []byte) error {
	var text string
	if err := common.Unmarshal(data, &text); err == nil {
		*value = jsonRawString(text)
		return nil
	}
	var products []CreemProduct
	if err := common.Unmarshal(data, &products); err != nil {
		return err
	}
	encoded, err := common.Marshal(products)
	if err != nil {
		return err
	}
	*value = jsonRawString(encoded)
	return nil
}

func UpdateCreemConfiguration(c *gin.Context) {
	var request creemConfigRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "invalid Creem configuration")
		return
	}
	if strings.TrimSpace(request.ApiKey) == "" || strings.TrimSpace(request.WebhookSecret) == "" {
		common.ApiErrorMsg(c, "API key and webhook secret are required")
		return
	}
	productsJSON := strings.TrimSpace(string(request.Products))
	if productsJSON == "" {
		productsJSON = "[]"
	}
	var products []CreemProduct
	if err := common.UnmarshalJsonStr(productsJSON, &products); err != nil {
		common.ApiErrorMsg(c, "invalid Creem product JSON")
		return
	}
	for _, product := range products {
		if strings.TrimSpace(product.ProductId) == "" || strings.TrimSpace(product.Name) == "" || product.Price <= 0 || product.Quota <= 0 || strings.TrimSpace(product.Currency) == "" {
			common.ApiErrorMsg(c, "invalid Creem product catalog entry")
			return
		}
	}
	canonical, err := common.Marshal(products)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateCreemOptionsAtomic(strings.TrimSpace(request.ApiKey), strings.TrimSpace(request.WebhookSecret), string(canonical), request.TestMode); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.creem.update", map[string]interface{}{"test_mode": request.TestMode, "product_count": strconv.Itoa(len(products))})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}
