package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// OAuthClientResponse is the response structure for OAuth clients (excludes secret)
type OAuthClientResponse struct {
	Id          int       `json:"id"`
	ClientId    string    `json:"client_id"`
	Name        string    `json:"name"`
	RedirectUri string    `json:"redirect_uri"`
	Scopes      string    `json:"scopes"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   string    `json:"created_at"`
	UpdatedAt   string    `json:"updated_at"`
}

func toOAuthClientResponse(c *model.OAuthClient) *OAuthClientResponse {
	return &OAuthClientResponse{
		Id:          c.Id,
		ClientId:     c.ClientId,
		Name:         c.Name,
		RedirectUri:  c.RedirectUri,
		Scopes:       c.Scopes,
		Enabled:      c.Enabled,
		CreatedAt:    c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListOAuthClients lists all OAuth clients owned by the current user
func ListOAuthClients(c *gin.Context) {
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		common.ApiErrorMsg(c, "需要登录")
		return
	}
	clients, err := model.GetOAuthClientsByOwnerId(identity.UserID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := make([]*OAuthClientResponse, len(clients))
	for i, client := range clients {
		response[i] = toOAuthClientResponse(client)
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": response})
}

// GetOAuthClient returns a single OAuth client by ID (owner only)
func GetOAuthClient(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}
	client, err := model.GetOAuthClientById(id)
	if err != nil {
		common.ApiErrorMsg(c, "客户端不存在")
		return
	}
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok || client.OwnerId != identity.UserID {
		common.ApiErrorMsg(c, "无权访问该客户端")
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toOAuthClientResponse(client)})
}

// CreateOAuthClient registers a new OAuth client
func CreateOAuthClient(c *gin.Context) {
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		common.ApiErrorMsg(c, "需要登录")
		return
	}
	var body struct {
		Name        string `json:"name" binding:"required"`
		RedirectUri string `json:"redirect_uri" binding:"required"`
		Scopes      string `json:"scopes"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		common.ApiErrorMsg(c, "无效的请求体")
		return
	}
	client := &model.OAuthClient{
		Name:        body.Name,
		RedirectUri: body.RedirectUri,
		Scopes:      body.Scopes,
		OwnerId:     identity.UserID,
	}
	if err := model.CreateOAuthClient(client); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"id":            client.Id,
			"client_id":      client.ClientId,
			"client_secret":  client.ClientSecret, // Only returned once at creation!
			"name":           client.Name,
			"redirect_uri":   client.RedirectUri,
			"scopes":        client.Scopes,
			"enabled":       client.Enabled,
			"created_at":     client.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			"updated_at":     client.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		},
	})
}

// UpdateOAuthClient updates an OAuth client
func UpdateOAuthClient(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}
	client, err := model.GetOAuthClientById(id)
	if err != nil {
		common.ApiErrorMsg(c, "客户端不存在")
		return
	}
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok || client.OwnerId != identity.UserID {
		common.ApiErrorMsg(c, "无权修改该客户端")
		return
	}
	var body struct {
		Name        string `json:"name"`
		RedirectUri string `json:"redirect_uri"`
		Scopes      string `json:"scopes"`
		Enabled     *bool  `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		common.ApiErrorMsg(c, "无效的请求体")
		return
	}
	if body.Name != "" {
		client.Name = body.Name
	}
	if body.RedirectUri != "" {
		client.RedirectUri = body.RedirectUri
	}
	if body.Scopes != "" {
		client.Scopes = body.Scopes
	}
	if body.Enabled != nil {
		client.Enabled = *body.Enabled
	}
	if err := model.UpdateOAuthClient(client); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toOAuthClientResponse(client)})
}

// DeleteOAuthClient deletes an OAuth client
func DeleteOAuthClient(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}
	client, err := model.GetOAuthClientById(id)
	if err != nil {
		common.ApiErrorMsg(c, "客户端不存在")
		return
	}
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok || client.OwnerId != identity.UserID {
		common.ApiErrorMsg(c, "无权删除该客户端")
		return
	}
	if err := model.DeleteOAuthClient(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已删除"})
}
