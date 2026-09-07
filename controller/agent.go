package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func agentError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	message := "Unable to load agent data"
	switch {
	case errors.Is(err, model.ErrAgentForbidden):
		status = 403
		message = err.Error()
	case errors.Is(err, model.ErrAgentPriceRange):
		status = 400
		message = err.Error()
	case errors.Is(err, model.ErrAgentConflict):
		status = 409
		message = err.Error()
	case errors.Is(err, model.ErrAgentInvitationExpired):
		status = 410
		message = err.Error()
	case errors.Is(err, model.ErrAgentInvitationLimit):
		status = 429
		message = err.Error()
	case errors.Is(err, gorm.ErrRecordNotFound):
		status = 404
		message = "Customer or agent not found"
	}
	c.JSON(status, gin.H{"error": gin.H{"message": message}})
}

func AgentInvitations(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	if requireAgent(c) == nil {
		return
	}
	if c.Request.Method == http.MethodGet {
		links, err := model.ListAgentInvitations(c.GetInt("id"))
		if err != nil {
			agentError(c, err)
			return
		}
		c.JSON(200, links)
		return
	}
	var input struct {
		PriceCents *int `json:"price_cents"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
	if err := common.DecodeJson(c.Request.Body, &input); err != nil || input.PriceCents == nil {
		drawingError(c, 400, "Invalid agent price request")
		return
	}
	link, err := model.CreateAgentInvitation(c.GetInt("id"), *input.PriceCents)
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(201, link)
}

func PreviewAgentInvitation(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	link, err := model.GetAgentInvitation(c.Param("token"))
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(200, gin.H{"model": model.AgentImageModel, "price_cents": link.PriceCents, "expires_at": link.ExpiresAt})
}
func requireAgent(c *gin.Context) *model.AgentProfile {
	profile, err := model.GetAgentProfile(c.GetInt("id"))
	if err != nil {
		agentError(c, err)
		return nil
	}
	if !profile.Enabled {
		agentError(c, model.ErrAgentForbidden)
		return nil
	}
	return profile
}
func AgentSelf(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	profile, err := model.GetAgentProfile(c.GetInt("id"))
	if err != nil {
		agentError(c, err)
		return
	}
	response := gin.H{"profile": profile, "model": model.AgentImageModel, "minimum_cents": 2, "maximum_cents": 6}
	if profile.Enabled {
		user, err := model.GetUserById(c.GetInt("id"), false)
		if err != nil {
			agentError(c, err)
			return
		}
		response["invite_code"] = user.AffCode
	}
	c.JSON(200, response)
}
func AgentPrice(c *gin.Context) {
	if requireAgent(c) == nil {
		return
	}
	var input struct {
		PriceCents *int   `json:"price_cents"`
		Version    *int64 `json:"version"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
	if err := common.DecodeJson(c.Request.Body, &input); err != nil || input.PriceCents == nil || input.Version == nil {
		drawingError(c, 400, "Invalid agent price request")
		return
	}
	profile, err := model.UpdateAgentProfile(c.GetInt("id"), c.GetInt("id"), *input.PriceCents, true, *input.Version, true)
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(200, profile)
}
func AgentCustomers(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	if requireAgent(c) == nil {
		return
	}
	page := common.GetPageQuery(c)
	if page.Page < 1 || page.Page > 1000000 || page.PageSize < 1 || page.PageSize > 100 {
		drawingError(c, 400, "Invalid pagination")
		return
	}
	customers, count, totals, err := model.AgentCustomers(c.GetInt("id"), page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		agentError(c, err)
		return
	}
	summary, paying, err := model.AgentTopUpSummary(c.GetInt("id"))
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(200, gin.H{"customers": customers, "total": count, "customer_topups": totals, "totals": summary, "paying_customers": paying})
}
func AgentCustomerTopUps(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	if requireAgent(c) == nil {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		drawingError(c, 400, "Invalid customer ID")
		return
	}
	page := common.GetPageQuery(c)
	if page.Page < 1 || page.Page > 1000000 || page.PageSize < 1 || page.PageSize > 100 {
		drawingError(c, 400, "Invalid pagination")
		return
	}
	items, count, err := model.AgentCustomerTopUps(c.GetInt("id"), id, page.GetStartIdx(), page.GetPageSize())
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(200, gin.H{"items": items, "total": count})
}
func AdminAgentProfile(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		drawingError(c, 400, "Invalid user ID")
		return
	}
	if _, err = model.GetUserById(id, false); err != nil {
		agentError(c, err)
		return
	}
	if c.Request.Method == http.MethodGet {
		profile, err := model.GetAgentProfile(id)
		if err != nil {
			agentError(c, err)
			return
		}
		c.JSON(200, profile)
		return
	}
	var input struct {
		Enabled    *bool  `json:"enabled"`
		PriceCents *int   `json:"price_cents"`
		Version    *int64 `json:"version"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024)
	if err := common.DecodeJson(c.Request.Body, &input); err != nil || input.Enabled == nil || input.PriceCents == nil || input.Version == nil {
		drawingError(c, 400, "Invalid agent settings")
		return
	}
	profile, err := model.UpdateAgentProfile(id, c.GetInt("id"), *input.PriceCents, *input.Enabled, *input.Version, false)
	if err != nil {
		agentError(c, err)
		return
	}
	c.JSON(200, profile)
}
func CustomerAgentPrice(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	quote, err := service.ResolveAgentImageQuote(c.GetInt("id"), model.AgentImageModel)
	if err != nil {
		agentError(c, err)
		return
	}
	if quote == nil {
		c.JSON(200, gin.H{"model": model.AgentImageModel, "price_cents": nil})
		return
	}
	c.JSON(200, gin.H{"model": quote.Model, "price_cents": quote.PriceCents, "version": quote.Version})
}
